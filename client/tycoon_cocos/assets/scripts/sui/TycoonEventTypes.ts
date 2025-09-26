/**
 * Tycoon游戏事件类型定义
 * 完全对齐Move端的事件结构
 *
 * Move源文件: move/tycoon/sources/events.move
 */

// ===== 基础事件类型 =====

/**
 * 游戏创建事件
 */
export interface GameCreatedEvent {
    game: string;               // ID类型
    creator: string;            // address
    template_id: number;        // u16 (0-65535)
    max_players: number;        // u8
    created_at_ms: bigint;      // u64
}

/**
 * 玩家加入事件
 */
export interface PlayerJoinedEvent {
    game: string;               // ID
    player: string;             // address
    player_index: number;       // u8
}

/**
 * 游戏开始事件
 */
export interface GameStartedEvent {
    game: string;               // ID
    player_count: number;       // u8
    starting_player: string;    // address
}

/**
 * 游戏结束事件
 */
export interface GameEndedEvent {
    game: string;               // ID
    winner?: string;            // Option<address>
    turn: bigint;               // u64
    reason: number;             // u8: 0=正常结束, 1=达到最大回合数, 2=只剩一个玩家
}

/**
 * 回合开始事件
 */
export interface TurnStartEvent {
    game: string;               // ID
    player: string;             // address
    turn: bigint;               // u64
}

/**
 * 跳过回合事件
 */
export interface SkipTurnEvent {
    game: string;               // ID
    player: string;             // address
    reason: number;             // u8: 1=监狱, 2=医院
}

/**
 * 回合结束事件
 */
export interface EndTurnEvent {
    game: string;               // ID
    player: string;             // address
    turn: bigint;               // u64
}

/**
 * 破产事件
 */
export interface BankruptEvent {
    game: string;               // ID
    player: string;             // address
    debt: bigint;               // u64
    creditor?: string;          // Option<address>
}

/**
 * 轮次结束事件
 */
export interface RoundEndedEvent {
    game: string;               // ID: 游戏 ID
    round: number;              // u16: 刚结束的轮次
    npc_kind: number;           // u8: 新生成的NPC类型（0表示没有生成）
    tile_id: number;            // u16: NPC放置的地块ID（npc_kind为0时无意义）
}

// ===== 聚合事件数据类型 =====

/**
 * 现金变动项
 */
export interface CashDelta {
    player: string;             // address
    is_debit: boolean;          // 是否支出
    amount: bigint;             // u64
    reason: number;             // u8: 1=toll, 2=buy, 3=upgrade, 4=bonus, 5=fee, 6=card
    details: bigint;            // u64: 额外信息（如地块ID）
}

/**
 * 卡牌获取项
 */
export interface CardDrawItem {
    tile_id: bigint;            // u64
    kind: number;               // u16: 卡牌种类
    count: bigint;              // u64: 数量
    is_pass: boolean;           // 是否是经过获得
}

/**
 * NPC变更项
 */
export interface NpcChangeItem {
    tile_id: bigint;            // u64
    kind: number;               // u8: NPC类型
    action: number;             // u8: NPC_ACTION_*
    consumed: boolean;          // 是否被消耗
}

/**
 * Buff变更项
 */
export interface BuffChangeItem {
    buff_type: number;          // u8: Buff类型
    target: string;             // address: 目标玩家
    first_inactive_turn?: bigint; // Option<u64>: 首个未激活回合
}

/**
 * NPC步骤事件
 */
export interface NpcStepEvent {
    tile_id: bigint;            // u64
    kind: number;               // u8: NPC类型
    result: number;             // u8: NPC_RESULT_*
    consumed: boolean;          // 是否被消耗
    result_tile?: bigint;       // Option<u64>: 结果地块（如传送目标）
}

/**
 * 停留效果
 */
export interface StopEffect {
    tile_id: bigint;            // u64
    tile_kind: number;          // u8: 地块类型
    stop_type: number;          // u8: STOP_*
    amount: bigint;             // u64: 金额（如租金、奖金）
    owner?: string;             // Option<address>: 地块所有者
    level?: number;             // Option<u8>: 地块等级
    turns?: number;             // Option<u8>: 回合数（如监狱/医院）
    card_gains: CardDrawItem[]; // 获得的卡牌
}

/**
 * 步骤效果
 */
export interface StepEffect {
    step_index: number;         // u8: 步骤索引
    from_tile: bigint;          // u64: 起始地块
    to_tile: bigint;            // u64: 目标地块
    remaining_steps: number;    // u8: 剩余步数
    pass_draws: CardDrawItem[]; // 经过时抽取的卡牌
    npc_event?: NpcStepEvent;   // Option<NpcStepEvent>: NPC事件
    stop_effect?: StopEffect;   // Option<StopEffect>: 停留效果
}

// ===== 核心聚合事件 =====

/**
 * 使用卡牌操作聚合事件
 */
export interface UseCardActionEvent {
    game: string;               // ID
    player: string;             // address
    turn: bigint;               // u64
    kind: number;               // u16: 卡牌种类
    target_addr?: string;       // Option<address>: 目标玩家
    target_tile?: bigint;       // Option<u64>: 目标地块
    npc_changes: NpcChangeItem[]; // NPC变更列表
    buff_changes: BuffChangeItem[]; // Buff变更列表
    cash_changes: CashDelta[];  // 现金变动列表
}

/**
 * 掷骰移动操作聚合事件
 */
export interface RollAndStepActionEvent {
    game: string;               // ID
    player: string;             // address
    turn: bigint;               // u64
    dice: number;               // u8: 骰子点数
    dir: number;                // u8: 移动方向
    from: bigint;               // u64: 起始位置
    steps: StepEffect[];        // 步骤效果列表
    cash_changes: CashDelta[];  // 现金变动列表
    end_pos: bigint;            // u64: 最终位置
    path_choices: bigint[];     // 路径选择序列 (新增字段)
}

// ===== 事件类型枚举 =====

/**
 * Tycoon事件类型枚举
 */
export enum TycoonEventType {
    // 游戏核心事件
    GameCreated = 'GameCreatedEvent',
    GameStarted = 'GameStartedEvent',
    GameEnded = 'GameEndedEvent',
    RoundEnded = 'RoundEndedEvent',

    // 玩家事件
    PlayerJoined = 'PlayerJoinedEvent',
    TurnStart = 'TurnStartEvent',
    SkipTurn = 'SkipTurnEvent',
    EndTurn = 'EndTurnEvent',
    Bankrupt = 'BankruptEvent',

    // 聚合事件
    UseCardAction = 'UseCardActionEvent',
    RollAndStepAction = 'RollAndStepActionEvent'
}

// ===== 游戏结束原因 =====

export enum GameEndReason {
    Normal = 0,           // 正常结束
    MaxTurnsReached = 1,  // 达到最大回合数
    OnePlayerLeft = 2     // 只剩一个玩家
}

// ===== 跳过回合原因 =====

export enum SkipTurnReason {
    Prison = 1,   // 监狱
    Hospital = 2  // 医院
}

// ===== 现金变动原因 =====

export enum CashDeltaReason {
    Toll = 1,     // 过路费
    Buy = 2,      // 购买
    Upgrade = 3,  // 升级
    Bonus = 4,    // 奖金
    Fee = 5,      // 罚款
    Card = 6      // 卡牌效果
}

// ===== 辅助类型 =====

/**
 * Sui事件包装器
 * 包含事件元数据
 */
export interface SuiTycoonEvent<T = any> {
    /** 事件类型 */
    type: TycoonEventType;
    /** 事件数据 */
    data: T;
    /** 事件序列号 */
    eventSeq?: string;
    /** 交易摘要 */
    txDigest?: string;
    /** 时间戳 */
    timestamp?: number;
}

/**
 * 事件过滤器配置
 */
export interface TycoonEventFilter {
    /** 游戏ID（可选） */
    gameId?: string;
    /** 玩家地址（可选） */
    player?: string;
    /** 事件类型列表（可选） */
    eventTypes?: TycoonEventType[];
}

// ===== 类型守卫函数 =====

/**
 * 检查是否为游戏创建事件
 */
export function isGameCreatedEvent(event: any): event is GameCreatedEvent {
    return event &&
           typeof event.game === 'string' &&
           typeof event.creator === 'string' &&
           typeof event.template_id === 'number' &&
           typeof event.max_players === 'number';
}

/**
 * 检查是否为移动聚合事件
 */
export function isRollAndStepActionEvent(event: any): event is RollAndStepActionEvent {
    return event &&
           typeof event.game === 'string' &&
           typeof event.player === 'string' &&
           Array.isArray(event.steps) &&
           Array.isArray(event.cash_changes);
}

/**
 * 检查是否为卡牌使用事件
 */
export function isUseCardActionEvent(event: any): event is UseCardActionEvent {
    return event &&
           typeof event.game === 'string' &&
           typeof event.player === 'string' &&
           typeof event.kind === 'number' &&
           Array.isArray(event.npc_changes) &&
           Array.isArray(event.buff_changes);
}