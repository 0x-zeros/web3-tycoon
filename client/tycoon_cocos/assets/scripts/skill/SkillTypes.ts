/**
 * 技能系统类型定义
 * 
 * 定义技能相关的枚举、接口和类型
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

/**
 * 技能属性枚举
 */
export enum SkillAttribute {
    COST = 0,               // 使用消耗
    COOLDOWN = 1,           // 冷却时间
    RANGE = 2,              // 作用范围
    DAMAGE = 3,             // 伤害值
    HEAL = 4,               // 治疗量
    DURATION = 5,           // 持续时间
    PROBABILITY = 6,        // 触发概率
    LEVEL_REQUIREMENT = 7,  // 等级需求
    USE_UP_EXP = 8,        // 使用消耗经验
    USE_UP_EXP_ADD = 9,    // 使用消耗经验增长
    CAST_TIME = 10,        // 施法时间
    INTERRUPT = 11,        // 是否可中断
    
    MAX = 20               // 最大属性数量
}

/**
 * 技能类型枚举
 */
export enum SkillType {
    PASSIVE = 'passive',     // 被动技能
    ACTIVE = 'active',       // 主动技能
    INSTANT = 'instant',     // 瞬发技能
    CHANNELING = 'channeling', // 引导技能
    TOGGLE = 'toggle',       // 切换技能
    COMBO = 'combo'          // 连击技能
}

/**
 * 技能效果类型枚举
 */
export enum SkillEffectType {
    // 基础效果
    DAMAGE = 'damage',           // 伤害
    HEAL = 'heal',              // 治疗
    MOVE = 'move',              // 移动
    TELEPORT = 'teleport',      // 传送
    
    // 属性效果
    MONEY = 'money',            // 金钱变化
    LUCK = 'luck',              // 幸运值变化
    SPEED = 'speed',            // 速度变化
    
    // 状态效果
    BUFF = 'buff',              // 增益效果
    DEBUFF = 'debuff',          // 减益效果
    SHIELD = 'shield',          // 护盾
    STUN = 'stun',              // 眩晕
    SILENCE = 'silence',        // 沉默
    
    // 游戏特有效果
    PROPERTY_GAIN = 'property_gain',     // 获得房产
    PROPERTY_LOSE = 'property_lose',     // 失去房产
    RENT_FREE = 'rent_free',             // 免租
    JAIL_ESCAPE = 'jail_escape',         // 出狱
    JAIL_ENTER = 'jail_enter',           // 入狱
    DICE_CONTROL = 'dice_control',       // 控制骰子
    CARD_DRAW = 'card_draw',             // 抽卡
    CARD_STEAL = 'card_steal',           // 偷卡
    
    // 特殊效果
    SUMMON = 'summon',          // 召唤NPC
    BANISH = 'banish',          // 驱逐NPC
    TRANSFORM = 'transform',     // 变换
    SWAP = 'swap',              // 交换位置
    CLONE = 'clone',            // 复制
    REFLECT = 'reflect'         // 反射
}

/**
 * 技能目标类型枚举
 */
export enum SkillTargetType {
    NONE = 'none',              // 无目标
    SELF = 'self',              // 自己
    SINGLE_ENEMY = 'single_enemy',       // 单个敌人
    SINGLE_ALLY = 'single_ally',         // 单个盟友
    SINGLE_PLAYER = 'single_player',     // 单个玩家
    ALL_ENEMIES = 'all_enemies',         // 所有敌人
    ALL_ALLIES = 'all_allies',           // 所有盟友
    ALL_PLAYERS = 'all_players',         // 所有玩家
    AREA = 'area',              // 区域
    TILE = 'tile',              // 地块
    PROPERTY = 'property',       // 房产
    NPC = 'npc'                 // NPC
}

/**
 * 技能状态枚举
 */
export enum SkillState {
    READY = 'ready',            // 准备就绪
    CASTING = 'casting',        // 施法中
    CHANNELING = 'channeling',  // 引导中
    COOLING_DOWN = 'cooling_down', // 冷却中
    DISABLED = 'disabled',      // 禁用
    SEALED = 'sealed'           // 封印
}

/**
 * 技能效果配置接口
 */
export interface SkillEffect {
    /** 效果类型 */
    type: SkillEffectType;
    /** 效果数值 */
    value: number;
    /** 目标类型 */
    target: SkillTargetType;
    /** 持续时间（秒） */
    duration?: number;
    /** 触发概率（0-1） */
    probability?: number;
    /** 延迟时间（秒） */
    delay?: number;
    /** 是否可叠加 */
    stackable?: boolean;
    /** 最大叠加层数 */
    maxStacks?: number;
    /** 额外参数 */
    params?: { [key: string]: any };
}

/**
 * 技能配置接口
 */
export interface SkillConfig {
    /** 技能ID */
    id: number;
    /** 技能名称 */
    name: string;
    /** 技能描述 */
    description: string;
    /** 技能类型 */
    type: SkillType;
    /** 技能图标路径 */
    iconPath: string;
    /** 技能等级 */
    level: number;
    /** 技能属性 */
    attributes: { [key: string]: number };
    /** 技能效果列表 */
    effects: SkillEffect[];
    /** 学习需求 */
    requirements?: SkillRequirement;
    /** 升级配置 */
    upgradeConfig?: SkillUpgradeConfig;
    /** 动画配置 */
    animationConfig?: SkillAnimationConfig;
    /** 音效配置 */
    audioConfig?: SkillAudioConfig;
}

/**
 * 技能需求接口
 */
export interface SkillRequirement {
    /** 等级需求 */
    level?: number;
    /** 金钱需求 */
    money?: number;
    /** 前置技能 */
    prerequisiteSkills?: number[];
    /** 禁用条件 */
    disabledConditions?: string[];
}

/**
 * 技能升级配置接口
 */
export interface SkillUpgradeConfig {
    /** 最大等级 */
    maxLevel: number;
    /** 升级消耗 */
    upgradeCosts: number[];
    /** 各级别属性加成 */
    levelBonuses: { [level: number]: { [attr: string]: number } };
    /** 各级别效果加成 */
    levelEffectBonuses: { [level: number]: { [effectIndex: number]: { [key: string]: number } } };
}

/**
 * 技能动画配置接口
 */
export interface SkillAnimationConfig {
    /** 施法动画 */
    castAnimation?: string;
    /** 命中动画 */
    hitAnimation?: string;
    /** 特效路径 */
    effectPath?: string;
    /** 特效持续时间 */
    effectDuration?: number;
    /** 摄像机震动 */
    cameraShake?: boolean;
}

/**
 * 技能音效配置接口
 */
export interface SkillAudioConfig {
    /** 施法音效 */
    castSound?: string;
    /** 命中音效 */
    hitSound?: string;
    /** 环境音效 */
    ambientSound?: string;
    /** 音量 */
    volume?: number;
}

/**
 * 技能实例接口
 */
export interface SkillInstance {
    /** 技能配置 */
    config: SkillConfig;
    /** 当前等级 */
    currentLevel: number;
    /** 当前经验 */
    currentExp: number;
    /** 剩余冷却时间 */
    remainingCooldown: number;
    /** 技能状态 */
    state: SkillState;
    /** 使用次数 */
    useCount: number;
    /** 最后使用时间 */
    lastUseTime: number;
    /** 临时属性加成 */
    tempAttributes: Map<SkillAttribute, number>;
    /** 是否解锁 */
    unlocked: boolean;
}

/**
 * 技能使用结果接口
 */
export interface SkillUseResult {
    /** 是否成功 */
    success: boolean;
    /** 结果消息 */
    message: string;
    /** 消耗的资源 */
    costs: { [resource: string]: number };
    /** 影响的目标 */
    affectedTargets: any[];
    /** 应用的效果 */
    appliedEffects: SkillEffect[];
    /** 触发的事件 */
    triggeredEvents: string[];
    /** 额外数据 */
    extraData?: any;
}

/**
 * 技能管理器配置接口
 */
export interface SkillManagerConfig {
    /** 技能配置文件路径 */
    configPath: string;
    /** 是否启用技能升级 */
    enableUpgrade: boolean;
    /** 是否启用技能学习 */
    enableLearning: boolean;
    /** 全局冷却时间 */
    globalCooldown: number;
    /** 最大同时激活技能数 */
    maxActiveSkills: number;
}

/**
 * 技能查询条件接口
 */
export interface SkillQuery {
    /** 技能ID */
    id?: number;
    /** 技能名称 */
    name?: string;
    /** 技能类型 */
    type?: SkillType;
    /** 效果类型 */
    effectType?: SkillEffectType;
    /** 目标类型 */
    targetType?: SkillTargetType;
    /** 等级范围 */
    levelRange?: { min: number; max: number };
    /** 是否已解锁 */
    unlocked?: boolean;
    /** 是否可用 */
    available?: boolean;
}

/**
 * 工具函数类
 */
export class SkillUtils {
    /**
     * 获取技能属性名称
     */
    static getAttributeName(attr: SkillAttribute): string {
        switch (attr) {
            case SkillAttribute.COST: return '消耗';
            case SkillAttribute.COOLDOWN: return '冷却时间';
            case SkillAttribute.RANGE: return '作用范围';
            case SkillAttribute.DAMAGE: return '伤害值';
            case SkillAttribute.HEAL: return '治疗量';
            case SkillAttribute.DURATION: return '持续时间';
            case SkillAttribute.PROBABILITY: return '触发概率';
            case SkillAttribute.LEVEL_REQUIREMENT: return '等级需求';
            case SkillAttribute.CAST_TIME: return '施法时间';
            default: return '未知属性';
        }
    }
    
    /**
     * 获取技能类型名称
     */
    static getTypeName(type: SkillType): string {
        switch (type) {
            case SkillType.PASSIVE: return '被动';
            case SkillType.ACTIVE: return '主动';
            case SkillType.INSTANT: return '瞬发';
            case SkillType.CHANNELING: return '引导';
            case SkillType.TOGGLE: return '切换';
            case SkillType.COMBO: return '连击';
            default: return '未知类型';
        }
    }
    
    /**
     * 获取效果类型名称
     */
    static getEffectTypeName(effectType: SkillEffectType): string {
        switch (effectType) {
            case SkillEffectType.DAMAGE: return '伤害';
            case SkillEffectType.HEAL: return '治疗';
            case SkillEffectType.MOVE: return '移动';
            case SkillEffectType.TELEPORT: return '传送';
            case SkillEffectType.MONEY: return '金钱';
            case SkillEffectType.LUCK: return '幸运';
            case SkillEffectType.BUFF: return '增益';
            case SkillEffectType.DEBUFF: return '减益';
            case SkillEffectType.PROPERTY_GAIN: return '获得房产';
            case SkillEffectType.RENT_FREE: return '免租';
            case SkillEffectType.JAIL_ESCAPE: return '出狱';
            case SkillEffectType.DICE_CONTROL: return '控制骰子';
            case SkillEffectType.CARD_DRAW: return '抽卡';
            default: return '未知效果';
        }
    }
    
    /**
     * 获取目标类型名称
     */
    static getTargetTypeName(targetType: SkillTargetType): string {
        switch (targetType) {
            case SkillTargetType.NONE: return '无目标';
            case SkillTargetType.SELF: return '自己';
            case SkillTargetType.SINGLE_PLAYER: return '单个玩家';
            case SkillTargetType.ALL_PLAYERS: return '所有玩家';
            case SkillTargetType.AREA: return '区域';
            case SkillTargetType.TILE: return '地块';
            case SkillTargetType.PROPERTY: return '房产';
            case SkillTargetType.NPC: return 'NPC';
            default: return '未知目标';
        }
    }
    
    /**
     * 计算技能伤害
     */
    static calculateDamage(baseDamage: number, level: number, attributes: Map<SkillAttribute, number>): number {
        const damage = attributes.get(SkillAttribute.DAMAGE) || baseDamage;
        const levelBonus = (level - 1) * 0.1; // 每级增加10%伤害
        return Math.floor(damage * (1 + levelBonus));
    }
    
    /**
     * 计算技能冷却时间
     */
    static calculateCooldown(baseCooldown: number, level: number, attributes: Map<SkillAttribute, number>): number {
        const cooldown = attributes.get(SkillAttribute.COOLDOWN) || baseCooldown;
        const levelReduction = (level - 1) * 0.05; // 每级减少5%冷却
        return Math.max(1, Math.floor(cooldown * (1 - levelReduction)));
    }
    
    /**
     * 检查技能是否满足使用条件
     */
    static checkSkillRequirements(skill: SkillInstance, caster: any): boolean {
        if (!skill.unlocked) {
            return false;
        }
        
        if (skill.state !== SkillState.READY) {
            return false;
        }
        
        if (skill.remainingCooldown > 0) {
            return false;
        }
        
        const cost = skill.config.attributes['COST'] || 0;
        if (caster && caster.getAttr && caster.getAttr(0) < cost) { // 假设属性0是金钱
            return false;
        }
        
        return true;
    }
    
    /**
     * 格式化技能描述
     */
    static formatSkillDescription(skill: SkillConfig, level: number = 1): string {
        let description = skill.description;
        
        // 替换占位符
        for (const [key, value] of Object.entries(skill.attributes)) {
            const placeholder = `{${key}}`;
            if (description.includes(placeholder)) {
                description = description.replace(new RegExp(placeholder, 'g'), value.toString());
            }
        }
        
        // 替换等级相关占位符
        description = description.replace(/{LEVEL}/g, level.toString());
        
        return description;
    }
}