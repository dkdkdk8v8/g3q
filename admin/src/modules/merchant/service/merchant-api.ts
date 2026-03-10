import { Inject, Provide } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { GameUserEntity } from '../../game/entityGame/user';
import { GameUserRecordEntity } from '../../game/entityGame/user-record';
import { GameRecordEntity } from '../../game/entityGame/game-record';
import { GameRpcService } from '../../game/service/rpc';
import { BaseSysParamService } from '../../base/service/sys/param';

/** 带错误码的业务异常 */
function apiError(code: number, message: string): Error {
  const err = new Error(message);
  (err as any).code = code;
  return err;
}

/** 确保金额为整数（分） */
function cents(value: any): number {
  return Math.round(Number(value) || 0);
}

/**
 * 运营商对外API服务
 * 使用 appId 作为商户标识和玩家关联
 */
@Provide()
export class MerchantApiService extends BaseService {
  @InjectEntityModel(GameUserEntity)
  userEntity: Repository<GameUserEntity>;

  @InjectEntityModel(GameUserRecordEntity)
  userRecordEntity: Repository<GameUserRecordEntity>;

  @InjectEntityModel(GameRecordEntity)
  gameRecordEntity: Repository<GameRecordEntity>;

  @Inject()
  rpcService: GameRpcService;

  @Inject()
  baseSysParamService: BaseSysParamService;

  /**
   * 启动游戏 — 返回游戏H5的URL
   */
  async launchGame(param: {
    appId: string;
    playerId: string;
    nickname?: string;
    avatar?: string;
    gameCode: string;
    mode?: string;
  }) {
    const { appId, playerId, nickname, avatar, gameCode, mode } = param;

    // 确保玩家存在
    const userId = appId + playerId;
    let user = await this.userEntity.findOneBy({ user_id: userId });
    if (!user) {
      user = this.userEntity.create({
        user_id: userId,
        app_id: appId,
        app_user_id: playerId,
        nick_name: nickname || playerId,
        avatar: avatar || await this.generateAvatar(userId),
        enable: true,
        balance: 0,
        balance_lock: 0,
        create_at: new Date(),
      });
      await this.userEntity.save(user);
    } else if (nickname || avatar) {
      const updates: any = {};
      if (nickname) updates.nick_name = nickname;
      if (avatar) updates.avatar = avatar;
      await this.userEntity.update({ user_id: userId }, updates);
    }

    // 获取可用线路域名列表
    const lines: string[] =
      (await this.baseSysParamService.dataByKey('game.Lines')) || [];
    if (!lines.length) {
      throw apiError(3005, 'game service unavailable');
    }

    const token = this.generateToken(appId, playerId);

    // qznn/qznn3/qznn4 统一使用路径 /qznn，通过 mode 参数区分玩法
    const gameModeMap: Record<string, number> = { qznn: 0, qznn3: 1, qznn4: 2 };
    const gamePath = gameCode in gameModeMap ? 'qznn' : gameCode;
    const gameMode = gameModeMap[gameCode];
    const modeParam = gameMode !== undefined ? `&mode=${gameMode}` : '';
    const queryStr = `/${gamePath}?app=${appId}&uid=${playerId}&token=${token}${modeParam}`;

    if (mode === 'html') {
      // 返回 HTML：内嵌 JS 并发测速所有线路，最快返回 200 的线路优先使用
      const linesJson = JSON.stringify(lines);
      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body><script>
(function(){
  var lines=${linesJson};
  var params="${queryStr}";
  var done=false;
  lines.forEach(function(line){
    fetch(line+"/${gamePath}/api/api-speed",{mode:"cors",cache:"no-store"}).then(function(res){
      if(!done&&res.status===200){done=true;window.location.href=line+params;}
    }).catch(function(){});
  });
  setTimeout(function(){
    if(!done){done=true;window.location.href=lines[Math.floor(Math.random()*lines.length)]+params;}
  },5000);
})();
<\/script></body></html>`;
      return { html };
    }

    // 默认 mode=url：随机分配一个线路
    const gameHost = lines[Math.floor(Math.random() * lines.length)];
    return { url: `${gameHost}${queryStr}` };
  }

  /**
   * 获取余额
   */
  async getBalance(appId: string, playerId: string) {
    const userId = appId + playerId;
    const user = await this.userEntity.findOneBy({ user_id: userId });
    if (!user) {
      return { balanceAvailable: 0, balanceLock: 0, balanceTotal: 0 };
    }
    return {
      balanceAvailable: cents(user.balance),
      balanceLock: cents(user.balance_lock),
      balanceTotal: cents(user.balance) + cents(user.balance_lock),
    };
  }

  /**
   * 转入（充值）
   */
  async transferIn(param: {
    appId: string;
    playerId: string;
    amount: number;
    orderId: string;
    nickname?: string;
    avatar?: string;
  }) {
    const { appId, playerId, amount, orderId, nickname, avatar } = param;
    const userId = appId + playerId;

    // 幂等：检查 orderId 是否已处理
    const existing = await this.userRecordEntity.findOneBy({
      order_id: orderId,
    } as any);
    if (existing) {
      const user = await this.userEntity.findOneBy({ user_id: userId });
      return {
        duplicate: true,
        amount: 0,
        balanceAvailable: cents(user?.balance),
        balanceTotal: cents(user?.balance) + cents(user?.balance_lock),
        created: false,
      };
    }

    // 先创建 record（state=0 处理中）
    const pendingRecord = await this.userRecordEntity.save({
      user_id: userId,
      record_type: 0, // RecordTypeDeposit
      balance_before: 0,
      balance_after: 0,
      order_id: orderId,
      order_state: 0,
      create_at: new Date(),
    } as any) as unknown as GameUserRecordEntity;

    const dataSource = this.userEntity.manager.connection;
    try {
      const result = await dataSource.transaction(async manager => {
        const userRepo = manager.getRepository(GameUserEntity);
        let user = await userRepo
          .createQueryBuilder('u')
          .setLock('pessimistic_write')
          .where('u.user_id = :userId', { userId })
          .getOne();

        let created = false;
        if (!user) {
          user = userRepo.create({
            user_id: userId,
            app_id: appId,
            app_user_id: playerId,
            nick_name: nickname || playerId,
            avatar: avatar || await this.generateAvatar(userId),
            enable: true,
            balance: 0,
            balance_lock: 0,
            create_at: new Date(),
          });
          created = true;
        } else if (nickname || avatar) {
          if (nickname) user.nick_name = nickname;
          if (avatar) user.avatar = avatar;
        }

        const balanceBefore = user.balance;
        user.balance += amount;
        user.total_deposit = (user.total_deposit || 0) + amount;
        await userRepo.save(user);

        // 事务内更新 record 为成功
        const recordRepo = manager.getRepository(GameUserRecordEntity);
        await recordRepo.update(pendingRecord.id, {
          order_state: 1,
          balance_before: balanceBefore,
          balance_after: user.balance,
        } as any);

        return { duplicate: false, amount: cents(amount), balanceAvailable: cents(user.balance), balanceTotal: cents(user.balance) + cents(user.balance_lock), created };
      });
      return result;
    } catch (e) {
      // 事务失败，更新 record 为失败
      await this.userRecordEntity.update(pendingRecord.id, {
        order_state: 2,
        order_remark: e.message || 'unknown error',
      } as any);
      throw e;
    }
  }

  /**
   * 转出（提现）
   */
  async transferOut(param: {
    appId: string;
    playerId: string;
    amount?: number;
    orderId: string;
    type?: string;
  }) {
    const { appId, playerId, amount, orderId, type = 'amount' } = param;
    const userId = appId + playerId;

    const existing = await this.userRecordEntity.findOneBy({
      order_id: orderId,
    } as any);
    if (existing) {
      const user = await this.userEntity.findOneBy({ user_id: userId });
      return {
        duplicate: true,
        amount: 0,
        balanceAvailable: cents(user?.balance),
        balanceLock: cents(user?.balance_lock),
        balanceTotal: cents(user?.balance) + cents(user?.balance_lock),
      };
    }

    const dataSource = this.userEntity.manager.connection;
    return dataSource.transaction(async manager => {
      const userRepo = manager.getRepository(GameUserEntity);
      const user = await userRepo
        .createQueryBuilder('u')
        .setLock('pessimistic_write')
        .where('u.user_id = :userId', { userId })
        .getOne();

      if (!user) {
        throw apiError(3001, 'player not found');
      }

      if (user.balance_lock > 0) {
        throw apiError(3003, 'player is in game, cannot transfer out');
      }

      // 确定实际提现金额
      const actualAmount = type === 'all' ? user.balance : amount;

      if (!actualAmount || actualAmount <= 0) {
        throw apiError(3002, 'insufficient balance');
      }

      if (user.balance < actualAmount) {
        throw apiError(3002, 'insufficient balance');
      }

      const balanceBefore = user.balance;
      user.balance -= actualAmount;
      user.total_with_draw = (user.total_with_draw || 0) + actualAmount;
      await userRepo.save(user);

      const recordRepo = manager.getRepository(GameUserRecordEntity);
      const record = recordRepo.create({
        user_id: userId,
        record_type: 1, // RecordTypeWithDraw
        balance_before: balanceBefore,
        balance_after: user.balance,
        order_id: orderId,
        order_state: 1,
        create_at: new Date(),
      } as any);
      await recordRepo.save(record);

      return { duplicate: false, amount: cents(actualAmount), balanceAvailable: cents(user.balance), balanceLock: cents(user.balance_lock), balanceTotal: cents(user.balance) + cents(user.balance_lock) };
    });
  }

  /**
   * 踢出玩家
   */
  async kickPlayer(appId: string, playerId: string) {
    const userId = appId + playerId;
    const url = await this.rpcService.getUrl(`rpc/kick?userId=${userId}`);
    try {
      const axios = require('axios');
      const res = await axios.get(url);
      return res.data;
    } catch (e) {
      throw apiError(3004, 'kick player failed');
    }
  }

  /**
   * 查询在线状态
   */
  async getOnlineStatus(appId: string, playerId: string) {
    const userId = appId + playerId;
    const url = await this.rpcService.getUrl(`rpc/online?userId=${userId}`);
    try {
      const axios = require('axios');
      const res = await axios.get(url);
      return res.data;
    } catch (e) {
      const user = await this.userEntity.findOneBy({ user_id: userId });
      return { online: user && user.balance_lock > 0 };
    }
  }

  /**
   * 查询投注记录
   */
  async getBetRecords(param: {
    appId: string;
    playerId?: string;
    startTime?: string;
    endTime?: string;
    page?: number;
    size?: number;
  }) {
    const { appId, playerId, startTime, endTime, page = 1, size: rawSize = 20 } = param;
    const size = Math.min(rawSize, 500);

    const qb = this.userRecordEntity
      .createQueryBuilder('r')
      .leftJoinAndMapOne(
        'r.gameRecord',
        GameRecordEntity,
        'g',
        'r.game_record_id = g.id',
      )
      .where('r.user_id LIKE :prefix', { prefix: `${appId}%` })
      .andWhere('r.record_type = :type', { type: 2 }); // RecordTypeGame

    if (playerId) {
      qb.andWhere('r.user_id = :userId', { userId: appId + playerId });
    }
    if (startTime) {
      qb.andWhere('r.create_at >= :start', { start: startTime });
    }
    if (endTime) {
      qb.andWhere('r.create_at <= :end', { end: endTime });
    }

    const [list, total] = await qb
      .orderBy('r.id', 'DESC')
      .skip((page - 1) * size)
      .take(size)
      .getManyAndCount();

    return {
      list: list.map(r => ({
        id: r.id,
        playerId: r.user_id.replace(appId, ''),
        recordType: r.record_type,
        balanceBefore: cents(r.balance_before),
        balanceAfter: cents(r.balance_after),
        gameName: (r as any).gameRecord?.game_name || '',
        createAt: r.create_at,
      })),
      pagination: { page, size, total },
    };
  }

  /**
   * 查询资金记录
   */
  async getFundRecords(param: {
    appId: string;
    playerId?: string;
    recordType?: number;
    startTime?: string;
    endTime?: string;
    page?: number;
    size?: number;
  }) {
    const { appId, playerId, recordType, startTime, endTime, page = 1, size: rawSize = 20 } = param;
    const size = Math.min(rawSize, 500);

    const recordTypeTextMap: Record<number, string> = {
      0: 'deposit',
      1: 'withdraw',
      2: 'game',
      3: 'admin',
    };

    const qb = this.userRecordEntity
      .createQueryBuilder('r')
      .where('r.user_id LIKE :prefix', { prefix: `${appId}%` });

    if (playerId) {
      qb.andWhere('r.user_id = :userId', { userId: appId + playerId });
    }
    if (recordType !== undefined && recordType !== null) {
      qb.andWhere('r.record_type = :type', { type: recordType });
    }
    if (startTime) {
      qb.andWhere('r.create_at >= :start', { start: startTime });
    }
    if (endTime) {
      qb.andWhere('r.create_at <= :end', { end: endTime });
    }

    const [list, total] = await qb
      .orderBy('r.id', 'DESC')
      .skip((page - 1) * size)
      .take(size)
      .getManyAndCount();

    return {
      list: list.map(r => ({
        id: r.id,
        playerId: r.user_id.replace(appId, ''),
        recordType: r.record_type,
        recordTypeText: recordTypeTextMap[r.record_type] || 'unknown',
        balanceBefore: cents(r.balance_before),
        balanceAfter: cents(r.balance_after),
        changeAmount: cents(r.balance_after) - cents(r.balance_before),
        orderId: r.order_id || '',
        createAt: r.create_at,
      })),
      pagination: { page, size, total },
    };
  }

  /**
   * 订单查询（支持充值和提现订单）
   */
  async queryOrder(appId: string, orderId: string) {
    const record = await this.userRecordEntity.findOneBy({
      order_id: orderId,
    } as any);
    if (!record) return null;

    // 验证该记录属于当前商户
    if (!record.user_id.startsWith(appId)) return null;

    const stateTextMap: Record<number, string> = {
      0: 'processing',
      1: 'success',
      2: 'failed',
    };

    const recordTypeTextMap: Record<number, string> = {
      0: 'deposit',
      1: 'withdraw',
    };

    return {
      orderId: record.order_id,
      playerId: record.user_id.replace(appId, ''),
      recordType: record.record_type,
      recordTypeText: recordTypeTextMap[record.record_type] || 'unknown',
      orderState: record.order_state,
      orderStateText: stateTextMap[record.order_state] || 'unknown',
      amount: Math.abs(cents(record.balance_after) - cents(record.balance_before)),
      balanceBefore: cents(record.balance_before),
      balanceAfter: cents(record.balance_after),
      remark: (record.order_remark && record.order_remark !== 'null') ? record.order_remark : '',
      createAt: record.create_at,
    };
  }

  /**
   * 生成启动 token（HMAC-SHA256 签名，Go 服务端同密钥验证）
   * 格式: {timestamp_hex}.{hmac_sha256_hex}
   */
  private generateToken(appId: string, playerId: string): string {
    const crypto = require('crypto');
    const timestamp = Math.floor(Date.now() / 1000);
    const tsHex = timestamp.toString(16);
    const hmac = crypto
      .createHmac('sha256', 'bG0nWM8GJkDg3rmZ1tv1a6ecFYYRp0XX')
      .update(`${appId}:${playerId}:${timestamp}`)
      .digest('hex');
    return `${tsHex}.${hmac}`;
  }

  /** 根据 userId 确定性分配默认随机头像 */
  private async generateAvatar(userId: string): Promise<string> {
    const count = (await this.baseSysParamService.dataByKey('admin.AvatarCount')) || 12;
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash |= 0;
    }
    const index = (Math.abs(hash) % count) + 1;
    return `gwd3czq/${index}.jpg`;
  }
}
