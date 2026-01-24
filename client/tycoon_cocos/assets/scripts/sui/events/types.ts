/**
 * 基础事件类型定义
 * 对应Move端的events.move文件中的事件结构
 *
 * Move源文件: move/tycoon/sources/events.move
 */

import type { BuildingDecisionInfo, RentDecisionInfo } from './types/RollAndStepEvent';

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
    /** 胜利者玩家索引（可选） */
    winner?: number;
    /** 结束时的轮次 */
    round: number;
    /** 轮内回合 */
    turn_in_round: number;
    /** 结束原因（0=正常结束, 1=达到最大回合数, 2=只剩一个玩家） */
    reason: number;
}

// ===== Turn Events 回合事件 =====

/**
 * 跳过回合事件
 * 对应Move: struct SkipTurnEvent
 */
export interface SkipTurnEvent {
    /** 游戏ID */
    game: string;
    /** 被跳过的玩家索引 */
    player: number;
    /** 跳过原因（2=医院） */
    reason: number;
    /** 剩余天数 */
    remaining_turns: number;
    /** 轮次 */
    round: number;
    /** 回合 */
    turn: number;
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
    /** 破产玩家索引 */
    player: number;
    /** 债务金额 */
    debt: bigint;
    /** 债权人玩家索引（可选） */
    creditor?: number;
}

// ===== Decision Events 决策事件 =====

/**
 * 建筑决策事件（购买或升级）
 * 对应Move: struct BuildingDecisionEvent
 */
export interface BuildingDecisionEvent {
    /** 游戏ID */
    game: string;
    /** 玩家索引 */
    player: number;
    /** 轮次 */
    round: number;
    /** 回合 */
    turn: number;
    /** 是否为自动决策 */
    auto_decision: boolean;
    /** 决策详情（可能为 null） */
    decision: BuildingDecisionInfo | null;
}

/**
 * 租金决策事件
 * 对应Move: struct RentDecisionEvent
 */
export interface RentDecisionEvent {
    /** 游戏ID */
    game: string;
    /** 轮次 */
    round: number;
    /** 回合 */
    turn: number;
    /** 是否为自动决策 */
    auto_decision: boolean;
    /** 决策详情（可能为 null） */
    decision: RentDecisionInfo | null;
}

/**
 * 卡片商店决策事件
 * 对应Move: struct CardShopDecisionEvent
 */
export interface CardShopDecisionEvent {
    /** 游戏ID */
    game: string;
    /** 玩家索引 */
    player: number;
    /** 轮次 */
    round: number;
    /** 轮内回合 */
    turn_in_round: number;
    /** 决策详情 */
    decision: {
        /** 商店所在地块ID */
        tile_id: number;
        /** 购买的卡片列表 */
        purchased_cards: Array<{ tile_id: number; kind: number; count: number; is_pass: boolean }>;
        /** 总花费 */
        total_cost: string;  // bigint as string
    };
}

/**
 * 跳过决策事件
 * 对应Move: struct DecisionSkippedEvent
 */
export interface DecisionSkippedEvent {
    /** 游戏ID */
    game: string;
    /** 玩家索引 */
    player: number;
    /** 决策类型 */
    decision_type: number;
    /** 地块ID */
    tile_id: number;
    /** 轮次 */
    round: number;
    /** 回合 */
    turn: number;
}

// ===== Profile Events 档案事件 =====
// 注意：这些事件来自 tycoon_profiles 包，不是 tycoon 包

/**
 * 玩家档案创建事件
 * 对应Move: tycoon_profiles::events::PlayerProfileCreatedEvent
 */
export interface PlayerProfileCreatedEvent {
    /** Profile ID */
    profile_id: string;
    /** 所有者地址 */
    owner: string;
}

/**
 * 游戏档案创建事件
 * 对应Move: tycoon_profiles::events::GameProfileCreatedEvent
 */
export interface GameProfileCreatedEvent {
    /** Profile ID */
    profile_id: string;
    /** 关联的 Game ID */
    game_id: string;
    /** 创建者地址 */
    creator: string;
}

/**
 * 地图档案创建事件
 * 对应Move: tycoon_profiles::events::MapProfileCreatedEvent
 */
export interface MapProfileCreatedEvent {
    /** Profile ID */
    profile_id: string;
    /** 关联的 Map ID */
    map_id: string;
    /** 创建者地址 */
    creator: string;
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
    SKIP_TURN = 'SkipTurnEvent',
    ROUND_ENDED = 'RoundEndedEvent',

    // 经济事件
    BANKRUPT = 'BankruptEvent',

    // 决策事件
    BUILDING_DECISION = 'BuildingDecisionEvent',
    RENT_DECISION = 'RentDecisionEvent',
    CARD_SHOP_DECISION = 'CardShopDecisionEvent',
    DECISION_SKIPPED = 'DecisionSkippedEvent',

    // 聚合事件（在aggregated.ts中定义）
    USE_CARD_ACTION = 'UseCardActionEvent',
    ROLL_AND_STEP_ACTION = 'RollAndStepActionEvent',
    TELEPORT_ACTION = 'TeleportActionEvent',

    // Profile 事件（来自 tycoon_profiles 包）
    PLAYER_PROFILE_CREATED = 'PlayerProfileCreatedEvent',
    GAME_PROFILE_CREATED = 'GameProfileCreatedEvent',
    MAP_PROFILE_CREATED = 'MapProfileCreatedEvent',
}

/**
 * 所有事件的联合类型
 */
export type GameEvent =
    | GameCreatedEvent
    | PlayerJoinedEvent
    | GameStartedEvent
    | GameEndedEvent
    | SkipTurnEvent
    | RoundEndedEvent
    | BankruptEvent
    | BuildingDecisionEvent
    | RentDecisionEvent
    | CardShopDecisionEvent
    | DecisionSkippedEvent
    | PlayerProfileCreatedEvent
    | GameProfileCreatedEvent
    | MapProfileCreatedEvent;

/**
 * 事件监听器类型
 */
export type EventListener<T = any> = (event: T) => void;

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
 * 泛型 T 为具体的事件类型（如 GameCreatedEvent, RollAndStepActionEvent 等）
 */
export interface EventMetadata<T = any> {
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