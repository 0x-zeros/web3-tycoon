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
 * 对应Move合约 types.move 中的 CARD_* 常量
 */
export const CARD_EFFECTS: Map<number, CardEffect> = new Map([
    [0, { // CARD_MOVE_CTRL - 遥控骰子
        type: 'movement',
        duration: 0,
        description: '控制下次移动的骰子点数'
    }],
    [1, { // CARD_BARRIER - 路障卡
        type: 'npc',
        duration: 0,
        description: '在指定地块放置路障'
    }],
    [2, { // CARD_BOMB - 炸弹卡
        type: 'npc',
        duration: 0,
        description: '在指定地块放置炸弹'
    }],
    [3, { // CARD_RENT_FREE - 免租卡
        type: 'buff',
        duration: 1,
        description: '下次经过地产免租金'
    }],
    [4, { // CARD_FREEZE - 冰冻卡
        type: 'debuff',
        duration: 2,
        description: '冻结目标玩家2回合'
    }],
    [5, { // CARD_DOG - 恶犬卡
        type: 'npc',
        duration: 0,
        description: '在指定地块放置恶犬'
    }],
    [6, { // CARD_CLEANSE - 机器娃娃
        type: 'buff',
        duration: 0,
        description: '清除一段路上所有NPC'
    }],
    [7, { // CARD_TURN - 转向卡
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
 * 对应Move合约 types.move 中的 CARD_* 常量
 */
export function getCardName(kind: number): string {
    const names: { [key: number]: string } = {
        0: '遥控骰子',    // CARD_MOVE_CTRL
        1: '路障卡',      // CARD_BARRIER
        2: '炸弹卡',      // CARD_BOMB
        3: '免租卡',      // CARD_RENT_FREE
        4: '冰冻卡',      // CARD_FREEZE
        5: '恶犬卡',      // CARD_DOG
        6: '机器娃娃',    // CARD_CLEANSE - 清除一段路上所有NPC
        7: '转向卡',      // CARD_TURN
        8: '瞬移卡',      // CARD_TELEPORT
        9: '奖励卡（小）', // CARD_REWARD_SMALL
        10: '奖励卡（大）', // CARD_REWARD_LARGE
        11: '费用卡（小）', // CARD_FEE_SMALL
        12: '费用卡（大）', // CARD_FEE_LARGE
        13: '建造卡',     // CARD_BUILD
        14: '改建卡',     // CARD_REBUILD
        15: '召唤卡',     // CARD_SUMMON
        16: '驱逐卡'      // CARD_BANISH
    };
    return names[kind] || `未知卡牌(${kind})`;
}

/**
 * 判断卡牌是否需要目标
 */
export function cardNeedsTarget(kind: number): boolean {
    // 需要选择目标的卡牌：路障、炸弹、恶犬、冰冻、机器娃娃
    const targetCards = [1, 2, 4, 5, 6];
    return targetCards.includes(kind);
}

/**
 * 判断卡牌是否需要参数
 */
export function cardNeedsParam(kind: number): boolean {
    // 需要额外参数的卡牌：遥控骰子需要指定点数
    const paramCards = [0]; // CARD_MOVE_CTRL
    return paramCards.includes(kind);
}

/**
 * 验证卡牌使用参数
 */
export function validateCardParams(kind: number, context: CardEffectContext): boolean {
    switch (kind) {
        case 0: // CARD_MOVE_CTRL - 遥控骰子
            return context.dice_value !== undefined && context.dice_value >= 1 && context.dice_value <= 6;
        case 1: // CARD_BARRIER - 路障
        case 2: // CARD_BOMB - 炸弹
        case 5: // CARD_DOG - 恶犬
        case 6: // CARD_CLEANSE - 机器娃娃
            return context.target_tile !== undefined;
        case 4: // CARD_FREEZE - 冰冻
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