/**
 * 卡牌相关类型定义
 * 对应Move端的cards.move文件中的struct定义
 *
 * Move源文件: move/tycoon/sources/cards.move
 */

/**
 * 卡牌条目（注册表中的定义）
 * 对应Move: struct CardEntry
 */
export interface CardEntry {
    /** 卡牌类型ID */
    kind: number;
    /** 卡牌名称 */
    name: string;
    /** 描述 */
    description: string;
    /** 最大持有数量 */
    max_hold: number;
    /** 使用时是否消耗 */
    consumable: boolean;
}

/**
 * 卡牌实例（玩家持有的）
 * 对应Move: struct Card
 */
export interface Card {
    /** 卡牌类型 */
    kind: number;
    /** 数量 */
    count: number;
}

/**
 * 卡牌注册表
 * 对应Move: struct CardRegistry
 */
export interface CardRegistry {
    /** 注册表ID */
    id: string;
    /** 已注册的卡牌（key: card_kind, value: CardEntry） */
    cards: Map<number, CardEntry>;
}

/**
 * 掉落配置
 * 对应Move: struct DropConfig
 */
export interface DropConfig {
    /** 配置ID */
    id: string;
    /** 经过时掉落规则 */
    pass_drops: DropRule[];
    /** 停留时掉落规则 */
    stop_drops: DropRule[];
}

/**
 * 掉落规则
 * 对应Move: struct DropRule
 */
export interface DropRule {
    /** 卡牌类型 */
    kind: number;
    /** 掉落权重 */
    weight: number;
}

/**
 * 卡牌效果上下文（使用卡牌时的参数）
 * 对应Move: struct CardEffectContext
 */
export interface CardEffectContext {
    /** 使用者玩家索引 */
    player_idx: number;
    /** 目标玩家索引（如冰冻卡） */
    target_player_idx?: number;
    /** 目标地块ID（如路障卡） */
    target_tile?: number;
    /** 骰子点数（如遥控骰子） */
    dice_value?: number;
    /** 其他参数 */
    extra_params?: number[];
}

/**
 * 卡牌使用结果
 */
export interface CardUseResult {
    /** 是否成功 */
    success: boolean;
    /** 消息 */
    message: string;
    /** 影响的玩家列表 */
    affected_players?: string[];
    /** 影响的地块列表 */
    affected_tiles?: number[];
}

/**
 * 卡牌库存（玩家的卡牌背包）
 */
export interface CardInventory {
    /** 玩家地址 */
    player: string;
    /** 持有的卡牌（key: card_kind, value: count） */
    cards: Map<number, number>;
    /** 总卡牌数量 */
    total_count: number;
}

/**
 * 卡牌效果定义（用于客户端展示）
 */
export interface CardEffect {
    /** 效果类型 */
    type: 'buff' | 'debuff' | 'npc' | 'movement' | 'economic';
    /** 持续时间（回合数，0表示立即生效） */
    duration: number;
    /** 效果描述 */
    description: string;
    /** 视觉效果ID（客户端用） */
    visual_effect?: string;
}

/**
 * 预定义的卡牌效果
 */
export const CARD_EFFECTS: Map<number, CardEffect> = new Map([
    [1, { // CARD_MOVE_CTRL
        type: 'movement',
        duration: 0,
        description: '控制下次移动的骰子点数'
    }],
    [2, { // CARD_BARRIER
        type: 'npc',
        duration: 0,
        description: '在指定地块放置路障'
    }],
    [10, { // CARD_BOMB
        type: 'npc',
        duration: 0,
        description: '在指定地块放置炸弹'
    }],
    [11, { // CARD_DOG
        type: 'npc',
        duration: 0,
        description: '在指定地块放置恶犬'
    }],
    [20, { // CARD_RENT_FREE
        type: 'buff',
        duration: 1,
        description: '下次经过地产免租金'
    }],
    [30, { // CARD_FREEZE
        type: 'debuff',
        duration: 2,
        description: '冻结目标玩家2回合'
    }],
    [41, { // CARD_CLEANSE
        type: 'buff',
        duration: 0,
        description: '清除自身所有负面效果'
    }],
    [50, { // CARD_TURN
        type: 'movement',
        duration: 0,
        description: '改变移动方向'
    }]
]);

/**
 * 辅助函数
 */

/**
 * 获取卡牌名称
 */
export function getCardName(kind: number): string {
    const names: { [key: number]: string } = {
        1: '遥控骰子',
        2: '路障卡',
        10: '炸弹卡',
        11: '恶犬卡',
        20: '免租卡',
        30: '冰冻卡',
        41: '净化卡',
        50: '转向卡'
    };
    return names[kind] || `未知卡牌(${kind})`;
}

/**
 * 判断卡牌是否需要目标
 */
export function cardNeedsTarget(kind: number): boolean {
    // 需要选择目标的卡牌
    const targetCards = [2, 10, 11, 30]; // 路障、炸弹、恶犬、冰冻
    return targetCards.includes(kind);
}

/**
 * 判断卡牌是否需要参数
 */
export function cardNeedsParam(kind: number): boolean {
    // 需要额外参数的卡牌
    const paramCards = [1]; // 遥控骰子需要指定点数
    return paramCards.includes(kind);
}

/**
 * 验证卡牌使用参数
 */
export function validateCardParams(kind: number, context: CardEffectContext): boolean {
    switch (kind) {
        case 1: // 遥控骰子
            return context.dice_value !== undefined && context.dice_value >= 1 && context.dice_value <= 6;
        case 2: // 路障
        case 10: // 炸弹
        case 11: // 恶犬
            return context.target_tile !== undefined;
        case 30: // 冰冻
            return context.target_player_idx !== undefined;
        default:
            return true;
    }
}

/**
 * 计算卡牌掉落
 */
export function calculateCardDrop(rules: DropRule[], randomSeed: number): number | null {
    if (rules.length === 0) return null;

    // 计算总权重
    const totalWeight = rules.reduce((sum, rule) => sum + rule.weight, 0);
    if (totalWeight === 0) return null;

    // 根据随机数选择
    let random = randomSeed % totalWeight;
    for (const rule of rules) {
        if (random < rule.weight) {
            return rule.kind;
        }
        random -= rule.weight;
    }

    return rules[rules.length - 1].kind;
}