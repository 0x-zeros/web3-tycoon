/**
 * 卡片系统类型定义
 * 
 * 定义游戏中卡片系统的所有数据结构和类型
 * 包括卡片类型、效果、使用条件等核心概念
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Vec3, Color } from 'cc';

// ========================= 基础枚举类型 =========================

/**
 * 卡片类型枚举
 * 定义游戏中所有可用的卡片类型
 */
export enum CardType {
    /** 遥控骰子 - 控制下次骰子点数 */
    DICE_CONTROL = 'dice_control',
    
    /** 路障卡 - 在地块上放置路障阻挡其他玩家 */
    BARRIER = 'barrier',
    
    /** 传送卡 - 直接传送到指定地块 */
    TELEPORT = 'teleport',
    
    /** 拆除卡 - 拆除敌方建筑物 */
    DEMOLISH = 'demolish',
    
    /** 免租卡 - 下次踩到别人地产时免付租金 */
    FREE_RENT = 'free_rent'
}

/**
 * 卡片使用时机枚举
 * 定义卡片可以在何时使用
 */
export enum CardUsageTiming {
    /** 立即使用 - 获得后可立即使用 */
    INSTANT = 'instant',
    
    /** 回合开始 - 在自己回合开始时使用 */
    TURN_START = 'turn_start',
    
    /** 掷骰前 - 在掷骰子之前使用 */
    BEFORE_DICE = 'before_dice',
    
    /** 移动前 - 在移动之前使用 */
    BEFORE_MOVE = 'before_move',
    
    /** 移动后 - 在移动结束后使用 */
    AFTER_MOVE = 'after_move',
    
    /** 被动触发 - 满足特定条件时自动触发 */
    PASSIVE = 'passive'
}

/**
 * 卡片目标类型枚举
 * 定义卡片的作用目标
 */
export enum CardTargetType {
    /** 无需目标 - 卡片效果不需要选择目标 */
    NONE = 'none',
    
    /** 自己 - 只能对自己使用 */
    SELF = 'self',
    
    /** 其他玩家 - 选择一个其他玩家作为目标 */
    OTHER_PLAYER = 'other_player',
    
    /** 任意玩家 - 可以选择包括自己在内的任意玩家 */
    ANY_PLAYER = 'any_player',
    
    /** 地块 - 选择地图上的一个地块 */
    TILE = 'tile',
    
    /** 建筑 - 选择一个建筑物 */
    BUILDING = 'building',
    
    /** 地产 - 选择一个地产地块 */
    PROPERTY = 'property'
}

/**
 * 卡片稀有度枚举
 * 定义卡片的获取难度和强度
 */
export enum CardRarity {
    /** 普通 - 容易获得的基础卡片 */
    COMMON = 'common',
    
    /** 稀有 - 较难获得，效果较强 */
    RARE = 'rare',
    
    /** 史诗 - 很难获得，效果很强 */
    EPIC = 'epic',
    
    /** 传说 - 极难获得，效果极强 */
    LEGENDARY = 'legendary'
}

/**
 * 卡片状态枚举
 * 定义卡片的当前状态
 */
export enum CardState {
    /** 可用 - 可以正常使用 */
    AVAILABLE = 'available',
    
    /** 冷却中 - 正在冷却，暂时不可用 */
    COOLING_DOWN = 'cooling_down',
    
    /** 已使用 - 已经使用，等待销毁或回收 */
    USED = 'used',
    
    /** 被封印 - 被特殊效果封印，不可使用 */
    SEALED = 'sealed'
}

// ========================= 卡片效果类型 =========================

/**
 * 卡片效果类型枚举
 * 定义卡片可以产生的各种效果
 */
export enum CardEffectType {
    /** 控制骰子 - 指定下次骰子结果 */
    CONTROL_DICE = 'control_dice',
    
    /** 放置障碍物 - 在地块上放置路障 */
    PLACE_BARRIER = 'place_barrier',
    
    /** 移除障碍物 - 移除地块上的路障 */
    REMOVE_BARRIER = 'remove_barrier',
    
    /** 传送移动 - 直接移动到指定位置 */
    TELEPORT_MOVE = 'teleport_move',
    
    /** 强制移动 - 强制其他玩家移动 */
    FORCE_MOVE = 'force_move',
    
    /** 建筑操作 - 建设或拆除建筑 */
    BUILDING_OPERATION = 'building_operation',
    
    /** 金钱操作 - 增加或减少金钱 */
    MONEY_OPERATION = 'money_operation',
    
    /** 状态效果 - 给玩家添加特殊状态 */
    STATUS_EFFECT = 'status_effect',
    
    /** 规则修改 - 临时修改游戏规则 */
    RULE_MODIFICATION = 'rule_modification'
}

// ========================= 卡片数据接口 =========================

/**
 * 卡片效果参数接口
 * 定义卡片效果的具体参数
 */
export interface CardEffectParams {
    /** 效果类型 */
    type: CardEffectType;
    
    /** 效果数值（如金钱数量、骰子点数等） */
    value?: number;
    
    /** 效果持续回合数（0表示立即生效，-1表示永久） */
    duration?: number;
    
    /** 效果范围（影响的地块数量或玩家数量） */
    range?: number;
    
    /** 条件参数（触发效果的条件） */
    conditions?: { [key: string]: any };
    
    /** 自定义参数（用于扩展特殊效果） */
    customParams?: { [key: string]: any };
}

/**
 * 卡片视觉配置接口
 * 定义卡片的视觉表现
 */
export interface CardVisualConfig {
    /** 卡片图标路径 */
    iconPath: string;
    
    /** 卡片背景颜色 */
    backgroundColor: Color;
    
    /** 卡片边框颜色 */
    borderColor: Color;
    
    /** 卡片特效名称（预留给特效系统） */
    effectName?: string;
    
    /** 卡片动画名称（使用时播放的动画） */
    animationName?: string;
    
    /** 稀有度光效 */
    rarityEffect?: string;
}

/**
 * 卡片基础数据接口
 * 定义单张卡片的完整信息
 */
export interface CardData {
    /** 卡片唯一标识符 */
    id: string;
    
    /** 卡片类型 */
    type: CardType;
    
    /** 卡片名称 */
    name: string;
    
    /** 卡片描述 */
    description: string;
    
    /** 卡片详细说明（用法提示） */
    detailDescription: string;
    
    /** 卡片稀有度 */
    rarity: CardRarity;
    
    /** 使用时机 */
    usageTiming: CardUsageTiming;
    
    /** 目标类型 */
    targetType: CardTargetType;
    
    /** 卡片效果列表 */
    effects: CardEffectParams[];
    
    /** 使用消耗（如果需要花费金钱） */
    cost?: number;
    
    /** 冷却回合数 */
    cooldown?: number;
    
    /** 最大使用次数（-1表示无限） */
    maxUses?: number;
    
    /** 视觉配置 */
    visualConfig: CardVisualConfig;
    
    /** 获取权重（影响随机获得的概率） */
    dropWeight: number;
    
    /** 卡片标签（用于分类和筛选） */
    tags: string[];
    
    /** 自定义数据（用于扩展功能） */
    customData?: { [key: string]: any };
}

// ========================= 卡片实例接口 =========================

/**
 * 卡片实例接口
 * 表示玩家拥有的具体卡片实例
 */
export interface CardInstance {
    /** 实例唯一ID */
    instanceId: string;
    
    /** 卡片数据ID */
    cardId: string;
    
    /** 拥有者玩家ID */
    ownerId: string;
    
    /** 当前状态 */
    state: CardState;
    
    /** 剩余使用次数 */
    remainingUses?: number;
    
    /** 剩余冷却回合数 */
    remainingCooldown?: number;
    
    /** 获得时间戳 */
    acquiredAt: number;
    
    /** 卡片增强等级（预留给升级系统） */
    enhancementLevel?: number;
    
    /** 实例特定数据 */
    instanceData?: { [key: string]: any };
}

// ========================= 卡片使用相关 =========================

/**
 * 卡片使用请求接口
 * 玩家使用卡片时的请求数据
 */
export interface CardUseRequest {
    /** 卡片实例ID */
    cardInstanceId: string;
    
    /** 使用者玩家ID */
    playerId: string;
    
    /** 目标信息（根据卡片类型不同而不同） */
    target?: {
        /** 目标玩家ID */
        playerId?: string;
        /** 目标地块ID */
        tileId?: number;
        /** 目标位置 */
        position?: Vec3;
        /** 自定义目标数据 */
        customTarget?: any;
    };
    
    /** 使用参数（如遥控骰子的点数选择） */
    parameters?: { [key: string]: any };
}

/**
 * 卡片使用结果接口
 * 卡片使用后的结果反馈
 */
export interface CardUseResult {
    /** 是否使用成功 */
    success: boolean;
    
    /** 结果消息 */
    message: string;
    
    /** 错误代码（如果失败） */
    errorCode?: string;
    
    /** 产生的效果列表 */
    appliedEffects: {
        /** 效果类型 */
        type: CardEffectType;
        /** 效果目标 */
        target: string;
        /** 效果参数 */
        params: any;
        /** 效果结果 */
        result: any;
    }[];
    
    /** 影响的玩家ID列表 */
    affectedPlayerIds: string[];
    
    /** 影响的地块ID列表 */
    affectedTileIds: number[];
    
    /** 扩展结果数据 */
    extendedData?: { [key: string]: any };
}

/**
 * 卡片使用条件检查结果接口
 */
export interface CardUsabilityCheck {
    /** 是否可以使用 */
    canUse: boolean;
    
    /** 不可使用的原因 */
    reasons: string[];
    
    /** 需要的目标类型 */
    requiredTargetType?: CardTargetType;
    
    /** 可用的目标列表 */
    availableTargets?: any[];
}

// ========================= 卡片管理接口 =========================

/**
 * 卡片库配置接口
 * 定义游戏中所有可用卡片的配置
 */
export interface CardDeck {
    /** 卡片库ID */
    deckId: string;
    
    /** 卡片库名称 */
    deckName: string;
    
    /** 包含的卡片列表 */
    cards: CardData[];
    
    /** 稀有度权重分配 */
    rarityWeights: {
        [key in CardRarity]: number;
    };
    
    /** 卡片获取规则 */
    acquisitionRules: {
        /** 每回合最大获得数量 */
        maxCardsPerTurn: number;
        /** 最大持有数量 */
        maxHandSize: number;
        /** 获得卡片的方式 */
        acquisitionMethods: string[];
    };
}

/**
 * 玩家卡片手牌接口
 * 表示玩家当前持有的卡片
 */
export interface PlayerHand {
    /** 玩家ID */
    playerId: string;
    
    /** 持有的卡片实例列表 */
    cards: CardInstance[];
    
    /** 最大手牌数量 */
    maxHandSize: number;
    
    /** 手牌状态 */
    handState: {
        /** 是否被禁用 */
        isDisabled: boolean;
        /** 禁用原因 */
        disableReason?: string;
        /** 禁用剩余回合数 */
        disableRemainingTurns?: number;
    };
}

/**
 * 卡片获取事件接口
 * 玩家获得卡片时的事件数据
 */
export interface CardAcquisitionEvent {
    /** 事件类型 */
    eventType: 'random' | 'purchase' | 'reward' | 'trade' | 'special';
    
    /** 玩家ID */
    playerId: string;
    
    /** 获得的卡片ID */
    cardId: string;
    
    /** 获得方式描述 */
    acquisitionMethod: string;
    
    /** 触发位置（如果是在特定地块获得） */
    triggerTileId?: number;
    
    /** 花费的金钱（如果是购买） */
    cost?: number;
    
    /** 事件时间戳 */
    timestamp: number;
}

// ========================= 预定义卡片数据 =========================

/**
 * MVP阶段的基础卡片配置
 * 包含5种基础卡片的完整定义
 */
export const MVP_CARDS: CardData[] = [
    {
        id: 'dice_control',
        type: CardType.DICE_CONTROL,
        name: '遥控骰子',
        description: '控制下次掷骰子的结果',
        detailDescription: '使用后可以选择1-6中的任意点数作为下次掷骰的结果',
        rarity: CardRarity.COMMON,
        usageTiming: CardUsageTiming.BEFORE_DICE,
        targetType: CardTargetType.NONE,
        effects: [{
            type: CardEffectType.CONTROL_DICE,
            duration: 1
        }],
        visualConfig: {
            iconPath: 'textures/cards/dice_control',
            backgroundColor: new Color(100, 150, 255, 255),
            borderColor: new Color(50, 100, 200, 255)
        },
        dropWeight: 10,
        tags: ['dice', 'control', 'basic']
    },
    {
        id: 'barrier',
        type: CardType.BARRIER,
        name: '路障卡',
        description: '在地块上放置路障阻挡其他玩家',
        detailDescription: '选择一个地块放置路障，其他玩家移动到此地块时会停止',
        rarity: CardRarity.COMMON,
        usageTiming: CardUsageTiming.INSTANT,
        targetType: CardTargetType.TILE,
        effects: [{
            type: CardEffectType.PLACE_BARRIER,
            duration: 3,
            range: 1
        }],
        visualConfig: {
            iconPath: 'textures/cards/barrier',
            backgroundColor: new Color(200, 100, 100, 255),
            borderColor: new Color(150, 50, 50, 255)
        },
        dropWeight: 8,
        tags: ['barrier', 'block', 'basic']
    },
    {
        id: 'teleport',
        type: CardType.TELEPORT,
        name: '传送卡',
        description: '瞬间移动到指定地块',
        detailDescription: '选择地图上的任意地块，立即移动到该位置',
        rarity: CardRarity.RARE,
        usageTiming: CardUsageTiming.INSTANT,
        targetType: CardTargetType.TILE,
        effects: [{
            type: CardEffectType.TELEPORT_MOVE
        }],
        visualConfig: {
            iconPath: 'textures/cards/teleport',
            backgroundColor: new Color(150, 100, 200, 255),
            borderColor: new Color(100, 50, 150, 255)
        },
        dropWeight: 5,
        tags: ['teleport', 'movement', 'rare']
    },
    {
        id: 'demolish',
        type: CardType.DEMOLISH,
        name: '拆除卡',
        description: '拆除其他玩家的建筑物',
        detailDescription: '选择一个敌方建筑，将其降级一级',
        rarity: CardRarity.RARE,
        usageTiming: CardUsageTiming.INSTANT,
        targetType: CardTargetType.BUILDING,
        effects: [{
            type: CardEffectType.BUILDING_OPERATION,
            value: -1
        }],
        visualConfig: {
            iconPath: 'textures/cards/demolish',
            backgroundColor: new Color(200, 150, 100, 255),
            borderColor: new Color(150, 100, 50, 255)
        },
        dropWeight: 4,
        tags: ['demolish', 'building', 'attack']
    },
    {
        id: 'free_rent',
        type: CardType.FREE_RENT,
        name: '免租卡',
        description: '下次踩到别人地产时免付租金',
        detailDescription: '给自己添加免租状态，下次需要支付租金时免费',
        rarity: CardRarity.COMMON,
        usageTiming: CardUsageTiming.INSTANT,
        targetType: CardTargetType.SELF,
        effects: [{
            type: CardEffectType.STATUS_EFFECT,
            duration: -1,
            customParams: { statusType: 'free_rent' }
        }],
        visualConfig: {
            iconPath: 'textures/cards/free_rent',
            backgroundColor: new Color(100, 200, 150, 255),
            borderColor: new Color(50, 150, 100, 255)
        },
        dropWeight: 12,
        tags: ['protection', 'rent', 'basic']
    }
];

// ========================= 导出类型和数据 =========================

export type {
    CardData,
    CardInstance,
    CardEffectParams,
    CardVisualConfig,
    CardUseRequest,
    CardUseResult,
    CardUsabilityCheck,
    CardDeck,
    PlayerHand,
    CardAcquisitionEvent
};

export {
    CardType,
    CardUsageTiming,
    CardTargetType,
    CardRarity,
    CardState,
    CardEffectType,
    MVP_CARDS
};