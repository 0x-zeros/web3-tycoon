/**
 * 聚合事件类型定义
 * 对应Move端的events.move文件中的聚合事件结构
 *
 * Move源文件: move/tycoon/sources/events.move
 */

// ===== Aggregated Event Data Types 聚合事件数据类型 =====

/**
 * 现金变动项
 * 对应Move: struct CashDelta
 */
export interface CashDelta {
    /** 玩家地址 */
    player: string;
    /** 是否为支出（true=支出，false=收入） */
    is_debit: boolean;
    /** 金额 */
    amount: bigint;
    /** 原因（1=toll, 2=buy, 3=upgrade, 4=bonus, 5=fee, 6=card） */
    reason: number;
    /** 详情（如地块ID） */
    details: number;
}

/**
 * 卡牌获取项
 * 对应Move: struct CardDrawItem
 */
export interface CardDrawItem {
    /** 地块ID */
    tile_id: number;
    /** 卡牌类型 */
    kind: number;
    /** 数量 */
    count: number;
    /** 是否为经过获得（true=经过，false=停留） */
    is_pass: boolean;
}

/**
 * NPC变更项
 * 对应Move: struct NpcChangeItem
 */
export interface NpcChangeItem {
    /** 地块ID */
    tile_id: number;
    /** NPC类型 */
    kind: number;
    /** 操作类型（1=生成, 2=移除, 3=触发） */
    action: number;
    /** 是否被消耗 */
    consumed: boolean;
}

/**
 * Buff变更项
 * 对应Move: struct BuffChangeItem
 */
export interface BuffChangeItem {
    /** Buff类型 */
    buff_type: number;
    /** 目标玩家地址 */
    target: string;
    /** 最后激活轮次（包含） */
    last_active_round?: number;
}

/**
 * NPC步骤事件
 * 对应Move: struct NpcStepEvent
 */
export interface NpcStepEvent {
    /** 遇到NPC的地块ID */
    tile_id: number;
    /** NPC类型（路障/炸弹/狗） */
    kind: number;
    /** 交互结果（0=无效果, 1=送医院, 2=路障停止） */
    result: number;
    /** NPC是否被消耗 */
    consumed: boolean;
    /** 结果地块（如送医院的目标地块） */
    result_tile?: number;
}

/**
 * 停留效果
 * 对应Move: struct StopEffect
 */
export interface StopEffect {
    /** 地块ID */
    tile_id: number;
    /** 地块类型 */
    tile_kind: number;
    /** 停留类型（0=无效果, 1=地产过路费, 2=地产免租等） */
    stop_type: number;
    /** 金额（过路费、奖金、罚款等） */
    amount: bigint;
    /** 地产所有者地址 */
    owner?: string;
    /** 地产等级 */
    level?: number;
    /** 停留回合数（医院、监狱） */
    turns?: number;
    /** 获得的卡牌 */
    card_gains: CardDrawItem[];
}

/**
 * 步骤效果
 * 对应Move: struct StepEffect
 */
export interface StepEffect {
    /** 步骤索引 */
    step_index: number;
    /** 起始地块 */
    from_tile: number;
    /** 目标地块 */
    to_tile: number;
    /** 剩余步数 */
    remaining_steps: number;
    /** 经过时获得的卡牌 */
    pass_draws: CardDrawItem[];
    /** NPC交互事件 */
    npc_event?: NpcStepEvent;
    /** 停留效果 */
    stop_effect?: StopEffect;
}

// ===== Aggregated Events 聚合事件 =====

/**
 * 使用卡牌操作聚合事件
 * 对应Move: struct UseCardActionEvent
 */
export interface UseCardActionEvent {
    /** 游戏ID */
    game: string;
    /** 玩家地址 */
    player: string;
    /** 轮次 */
    round: number;
    /** 轮内回合 */
    turn_in_round: number;
    /** 卡牌类型 */
    kind: number;
    /** 参数列表（玩家索引、地块ID、骰子值等） */
    params: number[];
    /** NPC变更列表 */
    npc_changes: NpcChangeItem[];
    /** Buff变更列表 */
    buff_changes: BuffChangeItem[];
    /** 现金变动列表 */
    cash_changes: CashDelta[];
}

/**
 * 掷骰移动操作聚合事件
 * 对应Move: struct RollAndStepActionEvent
 */
export interface RollAndStepActionEvent {
    /** 游戏ID */
    game: string;
    /** 玩家地址 */
    player: string;
    /** 轮次 */
    round: number;
    /** 轮内回合 */
    turn_in_round: number;
    /** 骰子点数 */
    dice: number;
    /** 分叉选择序列 */
    path_choices: number[];
    /** 起始位置 */
    from: number;
    /** 移动步骤列表 */
    steps: StepEffect[];
    /** 现金变动列表 */
    cash_changes: CashDelta[];
    /** 最终位置 */
    end_pos: number;
}

// ===== 辅助类型和函数 =====

/**
 * 现金变动原因说明
 */
export const CASH_REASON_TEXT: { [key: number]: string } = {
    1: '过路费',
    2: '购买地产',
    3: '升级地产',
    4: '获得奖金',
    5: '支付罚款',
    6: '卡牌效果'
};

/**
 * NPC操作类型说明
 */
export const NPC_ACTION_TEXT: { [key: number]: string } = {
    1: '生成',
    2: '移除',
    3: '触发'
};

/**
 * NPC结果类型说明
 */
export const NPC_RESULT_TEXT: { [key: number]: string } = {
    0: '无效果',
    1: '送往医院',
    2: '路障阻挡'
};

/**
 * 停留类型说明
 */
export const STOP_TYPE_TEXT: { [key: number]: string } = {
    0: '无停留效果',
    1: '支付过路费',
    2: '免租通过',
    3: '送往医院',
    4: '进入监狱',
    5: '获得奖金',
    6: '支付罚款',
    7: '卡片停留',
    8: '可购买地产'
};

/**
 * 计算事件中的总现金变动
 */
export function calculateTotalCashChange(cashDeltas: CashDelta[], player: string): bigint {
    let total = 0n;
    for (const delta of cashDeltas) {
        if (delta.player === player) {
            if (delta.is_debit) {
                total -= delta.amount;
            } else {
                total += delta.amount;
            }
        }
    }
    return total;
}

/**
 * 获取事件中的所有受影响玩家
 */
export function getAffectedPlayers(event: UseCardActionEvent | RollAndStepActionEvent): string[] {
    const players = new Set<string>();
    players.add(event.player);

    for (const cashDelta of event.cash_changes) {
        players.add(cashDelta.player);
    }

    if ('buff_changes' in event) {
        for (const buffChange of event.buff_changes) {
            players.add(buffChange.target);
        }
    }

    return Array.from(players);
}

/**
 * 分析移动路径
 */
export function analyzePath(event: RollAndStepActionEvent): {
    tiles: number[];
    npcs: NpcStepEvent[];
    cards: CardDrawItem[];
    finalStop?: StopEffect;
} {
    const tiles: number[] = [event.from];
    const npcs: NpcStepEvent[] = [];
    const cards: CardDrawItem[] = [];
    let finalStop: StopEffect | undefined;

    for (const step of event.steps) {
        tiles.push(step.to_tile);

        if (step.npc_event) {
            npcs.push(step.npc_event);
        }

        cards.push(...step.pass_draws);

        if (step.stop_effect) {
            finalStop = step.stop_effect;
            cards.push(...step.stop_effect.card_gains);
        }
    }

    return { tiles, npcs, cards, finalStop };
}