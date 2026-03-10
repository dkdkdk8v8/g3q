import { GameParser, ParsedGameData, ParsedPlayer, registerGameParser } from './game-parser';
import { QznnCardUtil } from './qznn-card';

/**
 * 抢庄牛牛 (QZNN) 游戏数据解析器
 *
 * GameData 格式:
 * {
 *   Room: {
 *     Players: [{ ID, IsOb, BalanceChange, ValidBet, Cards, Tax, CallMult, BetMult }],
 *     Config: { Level },
 *     BankerType: number,
 *     BankerID: string,
 *   }
 * }
 */
class QznnParser implements GameParser {
  readonly gameName = 'qznn';

  parse(gameData: any): ParsedGameData {
    const { Room } = gameData;
    const { Players = [], Config, BankerID } = Room;
    const roomLevel = Config?.Level || 0;
    const roomType = Room?.BankerType || 0;

    const players: ParsedPlayer[] = (Players as any[])
      .filter(Boolean)
      .map(p => {
        const cards = Array.isArray(p.Cards) ? p.Cards : undefined;
        const isOb = !!p.IsOb;
        return {
          userId: p.ID,
          isObserver: isOb,
          balanceChange: Number(p.BalanceChange) || 0,
          validBet: Math.abs(Number(p.ValidBet) || 0),
          tax: Number(p.Tax) || 0,
          cards,
          cardType: !isOb ? QznnCardUtil.calculateCardResult(cards) : undefined,
          isBanker: !!BankerID && String(BankerID) === String(p.ID),
        };
      });

    return { players, roomLevel, roomType };
  }
}

// 注册
registerGameParser(new QznnParser());
