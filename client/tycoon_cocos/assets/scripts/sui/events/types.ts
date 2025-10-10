/**
 * 基础事件类型定义
 * 对应Move端的events.move文件中的事件结构
 *
 * Move源文件: move/tycoon/sources/events.move
 */

// ===== Game Events 游戏事件 =====

/**
 * 游戏创建事件
 * 对应Move: struct GameCreatedEvent
 */
export interface GameCreatedEvent {
    /** 游戏ID */
    game: string;
    /** 创建者地址 */
    creator: string;
    /** 地图模板ID */
    template_map_id: string;
    /** 所有玩家地址列表 */
    players: string[];
}

/**
 * 玩家加入事件
 * 对应Move: struct PlayerJoinedEvent
 */
export interface PlayerJoinedEvent {
    /** 游戏ID */
    game: string;
    /** 玩家地址 */
    player: string;
    /** 玩家索引 */
    player_index: number;
}

/**
 * 游戏开始事件
 * 对应Move: struct GameStartedEvent
 */
export interface GameStartedEvent {
    /** 游戏ID */
    game: string;
    /** 地图模板ID */
    template_map_id: string;
    /** 所有玩家地址列表 */
    players: string[];
    /** 起始玩家地址 */
    starting_player: string;
}

/**
 * 游戏结束事件
 * 对应Move: struct GameEndedEvent
 */
export interface GameEndedEvent {
    /** 游戏ID */
    game: string;
    /** 胜利者地址（可选） */
    winner?: string;
    /** 结束时的轮次 */
    round: number;
    /** 轮内回合 */
    turn_in_round: number;
    /** 结束原因（0=正常结束, 1=达到最大回合数, 2=只剩一个玩家） */
    reason: number;
}

// ===== Turn Events 回合事件 =====

/**
 * 回合开始事件
 * 对应Move: struct TurnStartEvent
 */
export interface TurnStartEvent {
    /** 游戏ID */
    game: string;
    /** 当前玩家地址 */
    player: string;
    /** 当前轮次 */
    round: number;
    /** 轮内回合 */
    turn_in_round: number;
}

/**
 * 跳过回合事件
 * 对应Move: struct SkipTurnEvent
 */
export interface SkipTurnEvent {
    /** 游戏ID */
    game: string;
    /** 被跳过的玩家地址 */
    player: string;
    /** 跳过原因（1=监狱, 2=医院） */
    reason: number;
}

/**
 * 回合结束事件
 * 对应Move: struct EndTurnEvent
 */
export interface EndTurnEvent {
    /** 游戏ID */
    game: string;
    /** 玩家地址 */
    player: string;
    /** 当前轮次 */
    round: number;
    /** 轮内回合 */
    turn_in_round: number;
}

/**
 * 轮次结束事件
 * 对应Move: struct RoundEndedEvent
 */
export interface RoundEndedEvent {
    /** 游戏ID */
    game: string;
    /** 刚结束的轮次 */
    round: number;
    /** 新生成的NPC类型（0表示没有生成） */
    npc_kind: number;
    /** NPC放置的地块ID（npc_kind为0时无意义） */
    tile_id: number;
}

// ===== Economy Events 经济事件 =====

/**
 * 破产事件
 * 对应Move: struct BankruptEvent
 */
export interface BankruptEvent {
    /** 游戏ID */
    game: string;
    /** 破产玩家地址 */
    player: string;
    /** 债务金额 */
    debt: bigint;
    /** 债权人地址（可选） */
    creditor?: string;
}

// ===== 事件类型枚举 =====

/**
 * 事件类型枚举，用于事件分发
 */
export enum EventType {
    // 游戏生命周期
    GAME_CREATED = 'GameCreatedEvent',
    PLAYER_JOINED = 'PlayerJoinedEvent',
    GAME_STARTED = 'GameStartedEvent',
    GAME_ENDED = 'GameEndedEvent',

    // 管理事件
    MAP_TEMPLATE_PUBLISHED = 'MapTemplatePublishedEvent',

    // 回合管理
    TURN_START = 'TurnStartEvent',
    SKIP_TURN = 'SkipTurnEvent',
    END_TURN = 'EndTurnEvent',
    ROUND_ENDED = 'RoundEndedEvent',

    // 经济事件
    BANKRUPT = 'BankruptEvent',

    // 聚合事件（在aggregated.ts中定义）
    USE_CARD_ACTION = 'UseCardActionEvent',
    ROLL_AND_STEP_ACTION = 'RollAndStepActionEvent'
}

/**
 * 所有事件的联合类型
 */
export type GameEvent =
    | GameCreatedEvent
    | PlayerJoinedEvent
    | GameStartedEvent
    | GameEndedEvent
    | TurnStartEvent
    | SkipTurnEvent
    | EndTurnEvent
    | RoundEndedEvent
    | BankruptEvent;

/**
 * 事件监听器类型
 */
export type EventListener<T = GameEvent> = (event: T) => void;

/**
 * 事件过滤器
 */
export interface EventFilter {
    /** 过滤的事件类型 */
    types?: EventType[];
    /** 过滤的游戏ID */
    gameId?: string;
    /** 过滤的玩家地址 */
    player?: string;
    /** 时间范围 - 开始 */
    fromTimestamp?: number;
    /** 时间范围 - 结束 */
    toTimestamp?: number;
}

/**
 * 事件元数据（包装事件数据）
 */
export interface EventMetadata<T = GameEvent> {
    /** 事件类型 */
    type: EventType;
    /** 事件数据 */
    data: T;
    /** 事件时间戳 */
    timestamp: number;
    /** 事件序号 */
    sequence: number;
    /** 交易哈希 */
    txHash: string;
    /** 区块高度 */
    blockHeight: number;
}