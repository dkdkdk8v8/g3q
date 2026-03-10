import { GameParser, ParsedGameData, ParsedPlayer, registerGameParser } from './game-parser';

/**
 * 百人牛牛 (BRNN) 游戏数据解析器
 *
 * GameData 格式:
 * {
 *   PlayerBets: [{ UserId, Bets: number[], Win, Tax }],
 *   DealerCards: number[],
 *   AreaCards: number[][],
 *   AreaNiu: number[],
 *   AreaWin: number[],
 *   AreaMult: number[],
 *   DealerNiu: number,
 *   DealerMult: number,
 * }
 *
 * 说明：
 * - 没有 Room 包裹，没有 Config/Level/BankerType
 * - ValidBet = sum(abs(Bets))
 * - BalanceChange = Win
 * - 没有观战概念，没有庄家玩家
 * - 牌面在区域上，不在玩家上，暂不做牌型统计
 */
class BrnnParser implements GameParser {
  readonly gameName = 'brnn';

  parse(gameData: any): ParsedGameData {
    const { PlayerBets = [] } = gameData;

    const players: ParsedPlayer[] = (PlayerBets as any[])
      .filter(Boolean)
      .map(p => {
        const bets = Array.isArray(p.Bets) ? p.Bets : [];
        const validBet = bets.reduce((sum: number, b: number) => sum + Math.abs(b || 0), 0);

        return {
          userId: p.UserId,
          isObserver: false,
          balanceChange: Number(p.Win) || 0,
          validBet,
          tax: Number(p.Tax) || 0,
          isBanker: false,
        };
      });

    return { players, roomLevel: 0, roomType: 0 };
  }
}

// 注册
registerGameParser(new BrnnParser());
