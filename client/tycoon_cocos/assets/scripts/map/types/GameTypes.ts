/**
 * 游戏核心类型定义
 * 
 * 定义游戏的核心概念：玩家、游戏状态、回合制、事件等
 * 为整个游戏系统提供统一的数据结构和类型约束
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Vec3, Color, Node } from 'cc';
import { MapTileData, PropertyGroup } from './MapTypes';
import { CardInstance, PlayerHand } from './CardTypes';

// ========================= 基础枚举类型 =========================

/**
 * 游戏状态枚举
 * 定义游戏当前的整体状态
 */
export enum GameState {
    /** 等待开始 - 游戏还未开始，等待玩家准备 */
    WAITING_TO_START = 'waiting_to_start',
    
    /** 游戏中 - 正常游戏进行中 */
    PLAYING = 'playing',
    
    /** 暂停中 - 游戏被暂停 */
    PAUSED = 'paused',
    
    /** 游戏结束 - 已分出胜负 */
    FINISHED = 'finished',
    
    /** 错误状态 - 游戏遇到错误需要处理 */
    ERROR = 'error'
}

/**
 * 回合阶段枚举
 * 定义单个玩家回合内的不同阶段
 */
export enum TurnPhase {
    /** 回合开始 - 回合开始时的初始化阶段 */
    TURN_START = 'turn_start',
    
    /** 掷骰前 - 可以使用影响骰子的卡片 */
    BEFORE_DICE = 'before_dice',
    
    /** 掷骰中 - 正在掷骰子 */
    DICE_ROLLING = 'dice_rolling',
    
    /** 移动前 - 可以使用影响移动的卡片 */
    BEFORE_MOVE = 'before_move',
    
    /** 移动中 - 正在移动棋子 */
    MOVING = 'moving',
    
    /** 地块交互 - 到达地块后的交互阶段 */
    TILE_INTERACTION = 'tile_interaction',
    
    /** 回合结束 - 回合结束前的清理阶段 */
    TURN_END = 'turn_end'
}

/**
 * 玩家状态枚举
 * 定义玩家的当前状态
 */
export enum PlayerState {
    /** 等待中 - 等待轮到自己的回合 */
    WAITING = 'waiting',
    
    /** 行动中 - 正在进行自己的回合 */
    ACTING = 'acting',
    
    /** 在监狱 - 被关在监狱中 */
    IN_JAIL = 'in_jail',
    
    /** 破产 - 已经破产，游戏结束 */
    BANKRUPT = 'bankrupt',
    
    /** 获胜 - 赢得游戏 */
    WINNER = 'winner',
    
    /** 离线 - 玩家离线（预留给网络版本） */
    OFFLINE = 'offline'
}

/**
 * 玩家类型枚举
 * 区分不同类型的玩家
 */
export enum PlayerType {
    /** 人类玩家 */
    HUMAN = 'human',
    
    /** AI玩家 */
    AI = 'ai',
    
    /** 观察者 */
    SPECTATOR = 'spectator'
}

/**
 * 游戏事件类型枚举
 * 定义游戏中可能发生的各种事件
 */
export enum GameEventType {
    /** 游戏开始 */
    GAME_START = 'game_start',
    
    /** 游戏结束 */
    GAME_END = 'game_end',
    
    /** 回合开始 */
    TURN_START = 'turn_start',
    
    /** 回合结束 */
    TURN_END = 'turn_end',
    
    /** 掷骰子 */
    DICE_ROLL = 'dice_roll',
    
    /** 玩家移动 */
    PLAYER_MOVE = 'player_move',
    
    /** 购买地产 */
    PROPERTY_PURCHASE = 'property_purchase',
    
    /** 支付租金 */
    RENT_PAYMENT = 'rent_payment',
    
    /** 建设建筑 */
    BUILDING_CONSTRUCTION = 'building_construction',
    
    /** 使用卡片 */
    CARD_USE = 'card_use',
    
    /** 获得卡片 */
    CARD_ACQUISITION = 'card_acquisition',
    
    /** 玩家破产 */
    PLAYER_BANKRUPT = 'player_bankrupt',
    
    /** 玩家获胜 */
    PLAYER_WIN = 'player_win'
}

/**
 * 胜利条件类型枚举
 */
export enum VictoryCondition {
    /** 最后存活者 - 其他玩家全部破产 */
    LAST_SURVIVOR = 'last_survivor',
    
    /** 资产目标 - 达到指定资产总额 */
    ASSET_TARGET = 'asset_target',
    
    /** 时间限制 - 时间结束时资产最多者获胜 */
    TIME_LIMIT = 'time_limit',
    
    /** 回合限制 - 指定回合数后资产最多者获胜 */
    TURN_LIMIT = 'turn_limit'
}

// ========================= 玩家数据接口 =========================

/**
 * 玩家状态效果接口
 * 定义作用在玩家身上的各种状态效果
 */
export interface PlayerStatusEffect {
    /** 效果唯一ID */
    effectId: string;
    
    /** 效果类型 */
    type: string;
    
    /** 效果名称 */
    name: string;
    
    /** 效果描述 */
    description: string;
    
    /** 剩余持续回合数（-1表示永久，0表示即将结束） */
    remainingTurns: number;
    
    /** 效果参数 */
    parameters: { [key: string]: any };
    
    /** 效果来源（卡片ID或事件ID） */
    source: string;
    
    /** 效果图标 */
    iconPath?: string;
}

/**
 * 玩家统计数据接口
 * 记录玩家在游戏中的各种统计信息
 */
export interface PlayerStatistics {
    /** 总移动步数 */
    totalMovement: number;
    
    /** 购买地产数量 */
    propertiesPurchased: number;
    
    /** 建设建筑数量 */
    buildingsConstructed: number;
    
    /** 收取租金总额 */
    totalRentCollected: number;
    
    /** 支付租金总额 */
    totalRentPaid: number;
    
    /** 使用卡片数量 */
    cardsUsed: number;
    
    /** 获得卡片数量 */
    cardsAcquired: number;
    
    /** 经过起点次数 */
    startPassCount: number;
    
    /** 进监狱次数 */
    jailCount: number;
    
    /** 最高资产值 */
    maxAssetValue: number;
    
    /** 游戏时长（秒） */
    playTime: number;
}

/**
 * 玩家财务状态接口
 * 详细记录玩家的财务状况
 */
export interface PlayerFinancialStatus {
    /** 现金金额 */
    cash: number;
    
    /** 地产总价值 */
    propertyValue: number;
    
    /** 建筑总价值 */
    buildingValue: number;
    
    /** 总资产（现金 + 地产价值 + 建筑价值） */
    totalAssets: number;
    
    /** 债务总额 */
    totalDebt: number;
    
    /** 净资产（总资产 - 债务） */
    netWorth: number;
    
    /** 收入统计 */
    income: {
        /** 薪水收入 */
        salary: number;
        /** 租金收入 */
        rent: number;
        /** 其他收入 */
        other: number;
    };
    
    /** 支出统计 */
    expenses: {
        /** 租金支出 */
        rent: number;
        /** 购买地产支出 */
        property: number;
        /** 建设支出 */
        building: number;
        /** 税费支出 */
        tax: number;
        /** 其他支出 */
        other: number;
    };
}

/**
 * 玩家数据接口
 * 定义单个玩家的完整信息
 */
export interface PlayerData {
    /** 玩家唯一标识符 */
    id: string;
    
    /** 玩家昵称 */
    nickname: string;
    
    /** 玩家类型 */
    type: PlayerType;
    
    /** 当前状态 */
    state: PlayerState;
    
    /** 玩家颜色（用于UI和棋子显示） */
    color: Color;
    
    /** 头像路径 */
    avatarPath: string;
    
    // ====== 游戏状态 ======
    
    /** 当前所在地块ID */
    currentTileId: number;
    
    /** 财务状态 */
    financialStatus: PlayerFinancialStatus;
    
    /** 持有的卡片 */
    hand: PlayerHand;
    
    /** 拥有的地产ID列表 */
    ownedPropertyIds: number[];
    
    /** 状态效果列表 */
    statusEffects: PlayerStatusEffect[];
    
    // ====== 监狱相关 ======
    
    /** 是否在监狱 */
    isInJail: boolean;
    
    /** 剩余监狱回合数 */
    jailTurnsRemaining: number;
    
    // ====== 统计数据 ======
    
    /** 游戏统计 */
    statistics: PlayerStatistics;
    
    /** 加入游戏时间 */
    joinTime: number;
    
    /** 游戏顺序（决定回合顺序） */
    turnOrder: number;
    
    // ====== Cocos Creator 相关 ======
    
    /** 玩家棋子节点（Cocos Creator Node对象） */
    pieceNode?: Node;
    
    /** 棋子动画状态 */
    animationState?: {
        /** 是否正在移动 */
        isMoving: boolean;
        /** 移动目标位置 */
        targetPosition?: Vec3;
        /** 动画完成回调 */
        onComplete?: () => void;
    };
    
    // ====== 扩展数据 ======
    
    /** 自定义玩家数据 */
    customData?: { [key: string]: any };
}

// ========================= 游戏状态接口 =========================

/**
 * 回合信息接口
 * 记录当前回合的详细信息
 */
export interface TurnInfo {
    /** 当前回合数（从1开始） */
    turnNumber: number;
    
    /** 当前行动玩家ID */
    currentPlayerId: string;
    
    /** 当前回合阶段 */
    currentPhase: TurnPhase;
    
    /** 回合开始时间 */
    turnStartTime: number;
    
    /** 本回合骰子结果 */
    diceResult?: number;
    
    /** 是否使用了遥控骰子 */
    isDiceControlled?: boolean;
    
    /** 本回合移动步数 */
    movementSteps?: number;
    
    /** 本回合经过的地块ID列表 */
    passedTileIds: number[];
    
    /** 本回合使用的卡片ID列表 */
    usedCardIds: string[];
    
    /** 本回合触发的事件列表 */
    triggeredEvents: string[];
    
    /** 回合剩余时间（秒，用于限时模式） */
    remainingTime?: number;
}

/**
 * 游戏配置接口
 * 定义游戏的规则和参数配置
 */
export interface GameConfig {
    /** 游戏规则版本 */
    ruleVersion: string;
    
    /** 最大玩家数 */
    maxPlayers: number;
    
    /** 最小玩家数 */
    minPlayers: number;
    
    /** 游戏时长限制（分钟，0表示无限制） */
    timeLimitMinutes: number;
    
    /** 最大回合数限制（0表示无限制） */
    maxTurns: number;
    
    /** 每回合时间限制（秒，0表示无限制） */
    turnTimeLimit: number;
    
    /** 胜利条件 */
    victoryCondition: VictoryCondition;
    
    /** 胜利条件参数（如资产目标金额） */
    victoryParameter?: number;
    
    // ====== 经济设置 ======
    
    /** 起始资金 */
    startingMoney: number;
    
    /** 经过起点薪水 */
    passingStartSalary: number;
    
    /** 停在起点薪水 */
    landOnStartSalary: number;
    
    /** 破产阈值 */
    bankruptThreshold: number;
    
    // ====== 游戏机制设置 ======
    
    /** 是否启用卡片系统 */
    enableCards: boolean;
    
    /** 每回合最大获得卡片数 */
    maxCardsPerTurn: number;
    
    /** 最大手牌数量 */
    maxHandSize: number;
    
    /** 是否启用垄断租金加倍 */
    enableMonopolyBonus: boolean;
    
    /** 垄断租金倍数 */
    monopolyRentMultiplier: number;
    
    /** 监狱最大停留回合数 */
    maxJailTurns: number;
    
    // ====== 随机事件设置 ======
    
    /** 机会事件触发概率（0-1） */
    chanceEventProbability: number;
    
    /** 卡片获得概率（0-1） */
    cardAcquisitionProbability: number;
    
    // ====== AI设置 ======
    
    /** AI难度等级 */
    aiDifficulty: 'easy' | 'medium' | 'hard';
    
    /** AI思考延迟（毫秒） */
    aiThinkingDelay: number;
}

/**
 * 游戏事件接口
 * 定义游戏中发生的事件记录
 */
export interface GameEvent {
    /** 事件唯一ID */
    eventId: string;
    
    /** 事件类型 */
    type: GameEventType;
    
    /** 事件发生时间戳 */
    timestamp: number;
    
    /** 回合数 */
    turnNumber: number;
    
    /** 事件发起者玩家ID */
    actorPlayerId?: string;
    
    /** 事件目标玩家ID */
    targetPlayerId?: string;
    
    /** 事件影响的地块ID */
    affectedTileId?: number;
    
    /** 事件参数 */
    parameters: { [key: string]: any };
    
    /** 事件描述 */
    description: string;
    
    /** 事件结果 */
    result?: any;
}

/**
 * 游戏状态快照接口
 * 用于保存和恢复游戏状态
 */
export interface GameSnapshot {
    /** 快照版本 */
    version: string;
    
    /** 快照创建时间 */
    timestamp: number;
    
    /** 游戏状态 */
    gameState: GameState;
    
    /** 所有玩家数据 */
    players: PlayerData[];
    
    /** 地图状态（地块的当前状态） */
    mapState: {
        /** 地块状态映射 */
        tileStates: { [tileId: number]: any };
        /** 路障位置 */
        barriers: number[];
    };
    
    /** 当前回合信息 */
    turnInfo: TurnInfo;
    
    /** 游戏配置 */
    gameConfig: GameConfig;
    
    /** 事件历史 */
    eventHistory: GameEvent[];
    
    /** 随机数种子（用于可重现的随机） */
    randomSeed: string;
}

/**
 * 完整游戏数据接口
 * 包含整个游戏的完整状态
 */
export interface GameData {
    /** 游戏唯一ID */
    gameId: string;
    
    /** 游戏名称 */
    gameName: string;
    
    /** 游戏创建时间 */
    createdAt: number;
    
    /** 游戏开始时间 */
    startedAt?: number;
    
    /** 游戏结束时间 */
    endedAt?: number;
    
    /** 当前游戏状态 */
    currentState: GameState;
    
    /** 游戏配置 */
    config: GameConfig;
    
    /** 使用的地图ID */
    mapId: string;
    
    /** 所有玩家 */
    players: PlayerData[];
    
    /** 当前回合信息 */
    currentTurn: TurnInfo;
    
    /** 游戏事件历史 */
    eventHistory: GameEvent[];
    
    /** 获胜者玩家ID */
    winnerId?: string;
    
    /** 游戏结束原因 */
    endReason?: string;
    
    // ====== 游戏统计 ======
    
    /** 游戏总时长（毫秒） */
    totalDuration?: number;
    
    /** 总回合数 */
    totalTurns: number;
    
    /** 游戏模式标签 */
    gameMode: string[];
    
    // ====== 扩展数据 ======
    
    /** 自定义游戏数据 */
    customData?: { [key: string]: any };
}

// ========================= 工具接口 =========================

/**
 * 玩家动作接口
 * 定义玩家可以执行的动作
 */
export interface PlayerAction {
    /** 动作类型 */
    type: string;
    
    /** 执行动作的玩家ID */
    playerId: string;
    
    /** 动作参数 */
    parameters: { [key: string]: any };
    
    /** 动作时间戳 */
    timestamp: number;
}

/**
 * 动作验证结果接口
 */
export interface ActionValidation {
    /** 是否有效 */
    isValid: boolean;
    
    /** 错误消息 */
    errorMessage?: string;
    
    /** 错误代码 */
    errorCode?: string;
    
    /** 需要的前置条件 */
    prerequisites?: string[];
}

/**
 * 游戏规则接口
 * 定义游戏规则的检查和执行逻辑
 */
export interface GameRules {
    /** 检查动作是否有效 */
    validateAction(action: PlayerAction, gameData: GameData): ActionValidation;
    
    /** 检查胜利条件 */
    checkVictoryCondition(gameData: GameData): { hasWinner: boolean; winnerId?: string };
    
    /** 检查破产条件 */
    checkBankruptcy(player: PlayerData): boolean;
    
    /** 计算租金 */
    calculateRent(property: MapTileData, owner: PlayerData, tenant: PlayerData): number;
}

// ========================= 导出类型 =========================

export type {
    PlayerData,
    PlayerStatusEffect,
    PlayerStatistics,
    PlayerFinancialStatus,
    TurnInfo,
    GameConfig,
    GameEvent,
    GameSnapshot,
    GameData,
    PlayerAction,
    ActionValidation,
    GameRules
};

export {
    GameState,
    TurnPhase,
    PlayerState,
    PlayerType,
    GameEventType,
    VictoryCondition
};