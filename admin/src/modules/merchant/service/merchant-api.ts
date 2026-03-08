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
        avatar: avatar || this.generateAvatar(userId),
        enable: true,
        balance: 0,
        balance_lock: 0,
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
    fetch(line+"/api/api-speed",{mode:"cors",cache:"no-store"}).then(function(res){
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
      return { balanceAvailable: 0, balanceTotal: 0 };
    }
    return {
      balanceAvailable: user.balance,
      balanceTotal: user.balance + (user.balance_lock || 0),
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
        balanceAvailable: user?.balance || 0,
        balanceTotal: (user?.balance || 0) + (user?.balance_lock || 0),
        created: false,
      };
    }

    const dataSource = this.userEntity.manager.connection;
    return dataSource.transaction(async manager => {
      const userRepo = manager.getRepository(GameUserEntity);
      let user = await userRepo
        .createQueryBuilder('u')
        .setLock('pessimistic_write')
        .where('u.user_id = :userId', { userId })
        .getOne();

      let created = false;
      if (!user) {
        // 玩家不存在，自动创建
        user = userRepo.create({
          user_id: userId,
          app_id: appId,
          app_user_id: playerId,
          nick_name: nickname || playerId,
          avatar: avatar || this.generateAvatar(userId),
          enable: true,
          balance: 0,
          balance_lock: 0,
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

      const recordRepo = manager.getRepository(GameUserRecordEntity);
      const record = recordRepo.create({
        user_id: userId,
        record_type: 0, // RecordTypeDeposit
        balance_before: balanceBefore,
        balance_after: user.balance,
        order_id: orderId,
      } as any);
      await recordRepo.save(record);

      return { duplicate: false, amount, balanceAvailable: user.balance, balanceTotal: user.balance + (user.balance_lock || 0), created };
    });
  }

  /**
   * 转出（提现）
   */
  async transferOut(param: {
    appId: string;
    playerId: string;
    amount: number;
    orderId: string;
  }) {
    const { appId, playerId, amount, orderId } = param;
    const userId = appId + playerId;

    const existing = await this.userRecordEntity.findOneBy({
      order_id: orderId,
    } as any);
    if (existing) {
      const user = await this.userEntity.findOneBy({ user_id: userId });
      return {
        duplicate: true,
        amount: 0,
        balanceAvailable: user?.balance || 0,
        balanceTotal: (user?.balance || 0) + (user?.balance_lock || 0),
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

      if (user.balance < amount) {
        throw apiError(3002, 'insufficient balance');
      }

      if (user.balance_lock > 0) {
        throw apiError(3003, 'player is in game, cannot transfer out');
      }

      const balanceBefore = user.balance;
      user.balance -= amount;
      user.total_with_draw = (user.total_with_draw || 0) + amount;
      await userRepo.save(user);

      const recordRepo = manager.getRepository(GameUserRecordEntity);
      const record = recordRepo.create({
        user_id: userId,
        record_type: 1, // RecordTypeWithDraw
        balance_before: balanceBefore,
        balance_after: user.balance,
        order_id: orderId,
      } as any);
      await recordRepo.save(record);

      return { duplicate: false, amount, balanceAvailable: user.balance, balanceTotal: user.balance + (user.balance_lock || 0) };
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
    const { appId, playerId, startTime, endTime, page = 1, size = 20 } = param;

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
        balanceBefore: r.balance_before,
        balanceAfter: r.balance_after,
        gameName: (r as any).gameRecord?.game_name || '',
        createAt: r.create_at,
      })),
      pagination: { page, size, total },
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

  /** 根据 userId 确定性分配默认头像编号（1-12） */
  private generateAvatar(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash |= 0;
    }
    return `${(Math.abs(hash) % 12) + 1}`;
  }
}
