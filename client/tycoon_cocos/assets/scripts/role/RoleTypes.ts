/**
 * 角色系统类型定义
 * 
 * 定义所有角色相关的枚举、接口和类型
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Vec3 } from 'cc';

/**
 * 角色类型枚举
 * 角色类型枚举
 */
export enum RoleType {
    PLAYER = 1,         // 玩家
    NPC = 4,           // NPC
    BUILDING = 5       // 建筑物
}

/**
 * 角色属性枚举
 * 角色属性枚举
 */
export enum RoleAttribute {
    MONEY = 0,          // 金钱
    HP = 1,             // 生命值
    MOVE_SPEED = 2,     // 移动速度
    LUCK = 3,           // 幸运值
    POSITION = 4,       // 位置（地块ID）
    TURN_ORDER = 5,     // 回合顺序
    VIP_LEVEL = 6,      // VIP等级
    EXPERIENCE = 7,     // 经验值
    LEVEL = 8,          // 等级
    
    // 游戏特定属性
    PROPERTIES_COUNT = 10,    // 拥有房产数量
    CARDS_COUNT = 11,         // 拥有卡牌数量
    JAIL_TURNS = 12,          // 监狱剩余回合
    BANKRUPT = 13,            // 破产状态
    
    MAX = 20            // 最大属性数量
}

/**
 * NPC类型枚举
 */
export enum NPCType {
    FORTUNE = 'fortune',    // 福神
    BOMB = 'bomb',         // 炸弹
    ANGEL = 'angel',       // 天使
    DEVIL = 'devil',       // 恶魔
    BANKER = 'banker',     // 银行家
    THIEF = 'thief'        // 小偷
}

/**
 * 角色状态枚举
 */
export enum RoleState {
    IDLE = 'idle',          // 空闲
    MOVING = 'moving',      // 移动中
    THINKING = 'thinking',  // 思考中（AI）
    JAILED = 'jailed',      // 被监禁
    BANKRUPT = 'bankrupt',  // 破产
    WINNER = 'winner'       // 获胜
}

/**
 * 角色配置接口
 */
export interface RoleConfig {
    /** 角色类型ID */
    typeId: number;
    /** 角色名称 */
    name: string;
    /** 模型路径 */
    modelPath: string;
    /** 默认属性值 */
    defaultAttributes: { [key: string]: number };
    /** 可用技能ID列表 */
    availableSkills?: number[];
    /** 初始卡牌ID列表 */
    initialCards?: number[];
}

/**
 * 角色数据接口
 * 用于保存/加载角色数据
 */
export interface RoleData {
    /** 唯一ID */
    id: string;
    /** 角色类型 */
    type: RoleType;
    /** 类型ID */
    typeId: number;
    /** 名称 */
    name: string;
    /** 当前属性值 */
    attributes: { [key: number]: number };
    /** 临时属性值 */
    tmpAttributes: { [key: number]: number };
    /** 当前位置 */
    position: Vec3;
    /** 当前地块ID */
    currentTileId: number;
    /** 拥有的技能ID */
    skillIds: number[];
    /** 拥有的卡牌数据 */
    cardData: any[];
    /** 当前状态 */
    state: RoleState;
    /** 扩展数据 */
    extraData?: { [key: string]: any };
}

/**
 * 角色创建参数接口
 */
export interface RoleCreateParams {
    /** 角色名称 */
    name: string;
    /** 角色类型 */
    type: RoleType;
    /** 类型ID（可选，用于区分同类型的不同配置） */
    typeId?: number;
    /** 是否AI控制 */
    isAI?: boolean;
    /** 初始位置 */
    startTileId?: number;
    /** 自定义属性 */
    customAttributes?: { [key: string]: number };
    /** 扩展数据 */
    extraData?: { [key: string]: any };
}

/**
 * 角色移动参数接口
 */
export interface RoleMoveParams {
    /** 目标地块ID */
    targetTileId: number;
    /** 移动步数 */
    steps: number;
    /** 移动动画时长 */
    duration?: number;
    /** 移动路径（可选，用于复杂路径） */
    path?: number[];
    /** 是否跳跃移动（传送） */
    teleport?: boolean;
}

/**
 * 角色交互结果接口
 */
export interface RoleInteractionResult {
    /** 是否成功 */
    success: boolean;
    /** 结果消息 */
    message: string;
    /** 影响的角色ID列表 */
    affectedRoleIds: string[];
    /** 属性变化 */
    attributeChanges: { [roleId: string]: { [attr: number]: number } };
    /** 触发的事件 */
    triggeredEvents?: string[];
}

/**
 * 角色管理器配置接口
 */
export interface RoleManagerConfig {
    /** 最大玩家数量 */
    maxPlayers: number;
    /** 对象池配置 */
    poolConfig: {
        /** 初始池大小 */
        initialSize: number;
        /** 最大池大小 */
        maxSize: number;
        /** 是否启用对象池 */
        enabled: boolean;
    };
    /** 角色配置文件路径 */
    roleConfigPath: string;
    /** NPC配置文件路径 */
    npcConfigPath: string;
}

/**
 * 工具函数：检查角色类型
 */
export class RoleTypeUtils {
    /**
     * 是否为玩家
     */
    static isPlayer(type: RoleType): boolean {
        return type === RoleType.PLAYER;
    }
    
    /**
     * 是否为NPC
     */
    static isNPC(type: RoleType): boolean {
        return type === RoleType.NPC;
    }
    
    /**
     * 是否为建筑
     */
    static isBuilding(type: RoleType): boolean {
        return type === RoleType.BUILDING;
    }
    
    /**
     * 获取角色类型名称
     */
    static getTypeName(type: RoleType): string {
        switch (type) {
            case RoleType.PLAYER: return '玩家';
            case RoleType.NPC: return 'NPC';
            case RoleType.BUILDING: return '建筑';
            default: return '未知';
        }
    }
    
    /**
     * 获取属性名称
     */
    static getAttributeName(attr: RoleAttribute): string {
        switch (attr) {
            case RoleAttribute.MONEY: return '金钱';
            case RoleAttribute.HP: return '生命值';
            case RoleAttribute.MOVE_SPEED: return '移动速度';
            case RoleAttribute.LUCK: return '幸运值';
            case RoleAttribute.POSITION: return '位置';
            case RoleAttribute.TURN_ORDER: return '回合顺序';
            case RoleAttribute.VIP_LEVEL: return 'VIP等级';
            case RoleAttribute.LEVEL: return '等级';
            case RoleAttribute.PROPERTIES_COUNT: return '房产数量';
            case RoleAttribute.CARDS_COUNT: return '卡牌数量';
            case RoleAttribute.JAIL_TURNS: return '监狱回合';
            default: return '未知属性';
        }
    }
    
    /**
     * 获取NPC类型名称
     */
    static getNPCTypeName(npcType: NPCType): string {
        switch (npcType) {
            case NPCType.FORTUNE: return '福神';
            case NPCType.BOMB: return '炸弹';
            case NPCType.ANGEL: return '天使';
            case NPCType.DEVIL: return '恶魔';
            case NPCType.BANKER: return '银行家';
            case NPCType.THIEF: return '小偷';
            default: return '未知NPC';
        }
    }
}