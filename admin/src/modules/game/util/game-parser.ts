/**
 * 游戏数据解析器抽象层
 *
 * 每种游戏的 GameData 格式不同，解析器将不同格式统一为 ParsedGameData，
 * 供 sta-period 定时任务使用。新增游戏只需实现 GameParser 接口并注册即可。
 */

/** 解析后的单个玩家数据 */
export interface ParsedPlayer {
  userId: string;
  /** 是否观战（观战玩家不参与统计） */
  isObserver: boolean;
  /** 余额变动（正=赢，负=输） */
  balanceChange: number;
  /** 有效投注（绝对值） */
  validBet: number;
  /** 税收 */
  tax: number;
  /** 牌面数据，用于牌频统计（仅部分游戏有） */
  cards?: number[];
  /** 牌型名称，用于牌型分布统计（仅部分游戏有） */
  cardType?: string;
  /** 是否庄家 */
  isBanker: boolean;
}

/** 解析后的整局游戏数据 */
export interface ParsedGameData {
  players: ParsedPlayer[];
  roomLevel: number;
  roomType: number;
}

/** 游戏解析器接口 */
export interface GameParser {
  /** 游戏名称标识（与 game_record.game_name 一致） */
  readonly gameName: string;

  /** 解析原始 gameData JSON 对象，返回标准化数据 */
  parse(gameData: any): ParsedGameData;
}

// ──────────────────────────────────────────
// 解析器注册表
// ──────────────────────────────────────────

const parserMap = new Map<string, GameParser>();

/** 注册一个游戏解析器 */
export function registerGameParser(parser: GameParser) {
  parserMap.set(parser.gameName, parser);
}

/** 根据 gameName 获取解析器，未注册则返回 undefined */
export function getGameParser(gameName: string): GameParser | undefined {
  return parserMap.get(gameName);
}
