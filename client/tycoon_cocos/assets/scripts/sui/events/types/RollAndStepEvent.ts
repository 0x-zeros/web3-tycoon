/**
 * RollAndStepActionEvent 客户端类型定义
 * 对应 Move 端的 events.move 中的结构
 *
 * Move源文件: move/tycoon/sources/events.move
 */

import { BuffChangeItem } from '../aggregated';

// 现金变动项
export interface CashDelta {
    player: number;  // 玩家索引
    is_debit: boolean;
    amount: bigint;
    reason: number;  // 1=toll, 2=buy, 3=upgrade, 4=bonus, 5=fee, 6=card
    details: number;
}

// 卡牌获取项
export interface CardDrawItem {
    tile_id: number;
    kind: number;
    count: number;
    is_pass: boolean;
}

// 建筑决策信息
export interface BuildingDecisionInfo {
    decision_type: number;  // 1=购买, 2=升级
    building_id: number;
    tile_id: number;
    amount: bigint;
    new_level: number;
    building_type: number;
}

// 租金决策信息
export interface RentDecisionInfo {
    payer: number;   // 玩家索引
    owner: number;   // 玩家索引
    building_id: number;
    tile_id: number;
    rent_amount: bigint;
    used_rent_free: boolean;
}

// NPC步骤事件
export interface NpcStepEvent {
    tile_id: number;
    kind: number;
    result: number;  // 0=none, 1=send_hospital, 2=barrier_stop
    consumed: boolean;
    result_tile: number | null;  // Option<u16>
}

// 停留效果
export interface StopEffect {
    tile_id: number;
    tile_kind: number;
    stop_type: number;  // 0=none, 1=toll, 2=no_rent, 3=hospital, 5=bonus, 6=fee, 7=card_stop, 8=unowned, 9=land_seize
    amount: bigint;
    owner: number | null;  // 玩家索引
    level: number | null;
    turns: number | null;
    card_gains: CardDrawItem[];
    pending_decision: number;
    decision_tile: number;
    decision_amount: bigint;
    building_decision: BuildingDecisionInfo | null;  // 建筑决策信息（自动决策时）
    rent_decision: RentDecisionInfo | null;          // 租金决策信息（自动决策时）
    npc_buff: BuffChangeItem | null;                 // NPC触发的buff（土地神等）
}

// 步骤效果（核心）
export interface StepEffect {
    step_index: number;
    from_tile: number;
    to_tile: number;
    remaining_steps: number;
    pass_draws: CardDrawItem[];
    npc_event: NpcStepEvent | null;
    stop_effect: StopEffect | null;
}

// 掷骰移动操作聚合事件
export interface RollAndStepActionEvent {
    game: string;
    player: number;  // 玩家索引
    round: number;
    turn_in_round: number;
    dice_values: number[];   // 每颗骰子的值（长度1-3）
    path_choices: number[];  // 分叉选择序列
    from: number;
    steps: StepEffect[];     // 核心：每一步的详细信息
    cash_changes: CashDelta[];
    end_pos: number;
}

// 常量定义
export enum NpcAction {
    SPAWN = 1,
    REMOVE = 2,
    HIT = 3
}

export enum NpcResult {
    NONE = 0,
    SEND_HOSPITAL = 1,
    BARRIER_STOP = 2,
    BUFF = 3             // 增益型NPC触发（土地神等）
}

export enum StopType {
    NONE = 0,
    BUILDING_TOLL = 1,
    BUILDING_NO_RENT = 2,
    HOSPITAL = 3,
    BONUS = 5,
    FEE = 6,
    CARD_STOP = 7,
    BUILDING_UNOWNED = 8,
    LAND_SEIZE = 9       // 土地神附身抢地
}

export enum CashReason {
    TOLL = 1,
    BUY = 2,
    UPGRADE = 3,
    BONUS = 4,
    FEE = 5,
    CARD = 6
}
