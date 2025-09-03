/**
 * NPC类 - 地图上的特殊实体
 * 
 * 包含福神、炸弹等特殊地图对象的逻辑
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Role } from './Role';
import { RoleType, NPCType, RoleAttribute } from './RoleTypes';
import { Player } from './Player';
import { Skill } from '../skill/Skill';

/**
 * NPC配置接口
 */
export interface NPCConfig {
    /** NPC类型 */
    type: NPCType;
    /** NPC名称 */
    name: string;
    /** 类型ID */
    typeId: number;
    /** 生存时间（回合数，-1表示永久） */
    lifeTime: number;
    /** 影响半径（地块数） */
    radius: number;
    /** 可用技能ID列表 */
    skills: number[];
    /** 模型路径 */
    modelPath: string;
    /** 特效路径 */
    effectPath?: string;
    /** 音效路径 */
    audioPath?: string;
    /** 自定义属性 */
    customProperties?: { [key: string]: any };
}

/**
 * NPC触发条件枚举
 */
export enum NPCTriggerCondition {
    ON_ENTER = 'on_enter',          // 玩家进入时触发
    ON_PASS = 'on_pass',            // 玩家经过时触发
    ON_TURN_START = 'on_turn_start', // 回合开始时触发
    ON_TURN_END = 'on_turn_end',    // 回合结束时触发
    ON_DICE_ROLL = 'on_dice_roll',  // 掷骰时触发
    ON_TIMER = 'on_timer',          // 定时器触发
    MANUAL = 'manual'               // 手动触发
}

/**
 * NPC状态枚举
 */
export enum NPCState {
    SPAWNING = 'spawning',      // 生成中
    ACTIVE = 'active',          // 激活状态
    TRIGGERED = 'triggered',    // 已触发
    COOLING_DOWN = 'cooling_down', // 冷却中
    DYING = 'dying',            // 即将消失
    DEAD = 'dead'               // 已消失
}

/**
 * NPC触发结果接口
 */
export interface NPCTriggerResult {
    /** 是否成功触发 */
    success: boolean;
    /** 结果消息 */
    message: string;
    /** 影响的玩家列表 */
    affectedPlayers: Player[];
    /** 属性变化 */
    attributeChanges: { [playerId: string]: { [attr: number]: number } };
    /** 是否消耗NPC */
    consumeNPC: boolean;
    /** 额外效果 */
    extraEffects?: any[];
}

/**
 * NPC类
 * 地图上的特殊实体，可以影响玩家
 */
export class NPC extends Role {
    
    // ========================= NPC特有属性 =========================
    
    /** NPC类型 */
    protected m_npcType: NPCType = NPCType.FORTUNE;
    
    /** NPC配置 */
    protected m_config: NPCConfig | null = null;
    
    /** NPC状态 */
    protected m_npcState: NPCState = NPCState.SPAWNING;
    
    /** 生存时间（剩余回合数） */
    protected m_lifeTime: number = -1;
    
    /** 影响半径 */
    protected m_effectRadius: number = 0;
    
    /** 触发条件 */
    protected m_triggerCondition: NPCTriggerCondition = NPCTriggerCondition.ON_ENTER;
    
    /** 冷却时间（回合数） */
    protected m_cooldownTurns: number = 0;
    
    /** 剩余冷却时间 */
    protected m_remainingCooldown: number = 0;
    
    /** 是否可重复触发 */
    protected m_canRetrigger: boolean = true;
    
    /** 最大触发次数 */
    protected m_maxTriggers: number = -1;
    
    /** 已触发次数 */
    protected m_triggerCount: number = 0;
    
    /** 创建时间 */
    protected m_createTime: number = 0;
    
    /** 上次触发时间 */
    protected m_lastTriggerTime: number = 0;
    
    // ========================= 构造和初始化 =========================
    
    constructor(npcType: NPCType = NPCType.FORTUNE) {
        super();
        this.m_eType = RoleType.NPC;
        this.m_npcType = npcType;
        this.m_createTime = Date.now();
        this.initializeNPC();
    }
    
    /**
     * 初始化NPC
     */
    protected initializeNPC(): void {
        // 设置默认属性
        this.setAttr(RoleAttribute.HP, 1);
        this.setAttr(RoleAttribute.MONEY, 0);
        
        // 根据类型设置默认配置
        this.setDefaultConfigByType();
    }
    
    /**
     * 根据类型设置默认配置
     */
    protected setDefaultConfigByType(): void {
        switch (this.m_npcType) {
            case NPCType.FORTUNE:
                this.m_strName = '福神';
                this.m_lifeTime = 3;
                this.m_effectRadius = 0;
                this.m_triggerCondition = NPCTriggerCondition.ON_ENTER;
                this.m_maxTriggers = 1;
                break;
                
            case NPCType.BOMB:
                this.m_strName = '炸弹';
                this.m_lifeTime = 5;
                this.m_effectRadius = 1;
                this.m_triggerCondition = NPCTriggerCondition.ON_ENTER;
                this.m_maxTriggers = 1;
                break;
                
            case NPCType.ANGEL:
                this.m_strName = '天使';
                this.m_lifeTime = 2;
                this.m_effectRadius = 0;
                this.m_triggerCondition = NPCTriggerCondition.ON_ENTER;
                this.m_maxTriggers = -1; // 无限触发
                break;
                
            case NPCType.DEVIL:
                this.m_strName = '恶魔';
                this.m_lifeTime = 4;
                this.m_effectRadius = 0;
                this.m_triggerCondition = NPCTriggerCondition.ON_ENTER;
                this.m_maxTriggers = 3;
                break;
                
            case NPCType.BANKER:
                this.m_strName = '银行家';
                this.m_lifeTime = -1; // 永久存在
                this.m_effectRadius = 0;
                this.m_triggerCondition = NPCTriggerCondition.MANUAL;
                this.m_maxTriggers = -1;
                break;
                
            case NPCType.THIEF:
                this.m_strName = '小偷';
                this.m_lifeTime = 2;
                this.m_effectRadius = 2;
                this.m_triggerCondition = NPCTriggerCondition.ON_PASS;
                this.m_maxTriggers = -1;
                break;
        }
    }
    
    /**
     * 从配置初始化NPC
     */
    public initializeFromConfig(config: NPCConfig): void {
        this.m_config = config;
        this.m_npcType = config.type;
        this.m_strName = config.name;
        this.m_iTypeId = config.typeId;
        this.m_lifeTime = config.lifeTime;
        this.m_effectRadius = config.radius;
        
        // 加载技能
        if (config.skills && config.skills.length > 0) {
            this.loadNPCSkills(config.skills);
        }
        
        // 设置自定义属性
        if (config.customProperties) {
            for (const [key, value] of Object.entries(config.customProperties)) {
                this.setCustomProperty(key, value);
            }
        }
        
        console.log(`[NPC] 从配置初始化NPC: ${this.m_strName} (${this.m_npcType})`);
    }
    
    // ========================= 技能系统 =========================
    
    /**
     * 加载NPC技能
     */
    protected loadNPCSkills(skillIds: number[]): void {
        // 这里需要通过SkillManager加载技能
        // 暂时模拟
        console.log(`[NPC] 加载NPC技能: ${skillIds}`);
        
        // 根据NPC类型添加默认技能效果
        this.addDefaultSkillEffects();
    }
    
    /**
     * 添加默认技能效果
     */
    protected addDefaultSkillEffects(): void {
        // 根据NPC类型添加相应的技能效果
        // 这里先用简单的逻辑，后续可以通过配置文件管理
    }
    
    // ========================= 触发系统 =========================
    
    /**
     * 触发NPC效果
     */
    public async triggerEffect(player: Player, condition: NPCTriggerCondition = NPCTriggerCondition.ON_ENTER): Promise<NPCTriggerResult> {
        // 检查是否可以触发
        if (!this.canTrigger(condition)) {
            return this.createFailResult('NPC当前无法触发', []);
        }
        
        console.log(`[NPC] ${this.m_strName} 对 ${player.getName()} 触发效果 (${condition})`);
        
        // 更新触发次数和时间
        this.m_triggerCount++;
        this.m_lastTriggerTime = Date.now();
        
        // 执行对应的NPC效果
        const result = await this.executeNPCEffect(player, condition);
        
        // 设置冷却
        if (this.m_cooldownTurns > 0) {
            this.m_remainingCooldown = this.m_cooldownTurns;
            this.m_npcState = NPCState.COOLING_DOWN;
        }
        
        // 检查是否需要消耗NPC
        if (result.consumeNPC || this.shouldConsume()) {
            this.m_npcState = NPCState.DYING;
        } else {
            this.m_npcState = NPCState.ACTIVE;
        }
        
        // 触发NPC效果事件
        this.emit('npc-triggered', {
            npc: this,
            player: player,
            condition: condition,
            result: result
        });
        
        return result;
    }
    
    /**
     * 执行具体的NPC效果
     */
    protected async executeNPCEffect(player: Player, condition: NPCTriggerCondition): Promise<NPCTriggerResult> {
        const affectedPlayers = [player];
        let message = '';
        let consumeNPC = false;
        const attributeChanges: { [playerId: string]: { [attr: number]: number } } = {};
        
        // 根据NPC类型执行不同效果
        switch (this.m_npcType) {
            case NPCType.FORTUNE:
                message = await this.executeFortuneEffect(player, attributeChanges);
                consumeNPC = true;
                break;
                
            case NPCType.BOMB:
                message = await this.executeBombEffect(player, attributeChanges);
                consumeNPC = true;
                break;
                
            case NPCType.ANGEL:
                message = await this.executeAngelEffect(player, attributeChanges);
                break;
                
            case NPCType.DEVIL:
                message = await this.executeDevilEffect(player, attributeChanges);
                break;
                
            case NPCType.BANKER:
                message = await this.executeBankerEffect(player, attributeChanges);
                break;
                
            case NPCType.THIEF:
                message = await this.executeThiefEffect(player, attributeChanges);
                break;
                
            default:
                message = '未知NPC效果';
                break;
        }
        
        return {
            success: true,
            message: message,
            affectedPlayers: affectedPlayers,
            attributeChanges: attributeChanges,
            consumeNPC: consumeNPC
        };
    }
    
    // ========================= 具体NPC效果实现 =========================
    
    /**
     * 福神效果：给予玩家金钱奖励
     */
    protected async executeFortuneEffect(player: Player, changes: { [playerId: string]: { [attr: number]: number } }): Promise<string> {
        const bonus = this.calculateFortuneBonus(player);
        player.receiveMoney(bonus, 'bonus');
        
        // 记录属性变化
        changes[player.getId()] = { [RoleAttribute.MONEY]: bonus };
        
        // 播放特效
        if (player.getActor()) {
            player.getActor().playEffect('fortune_blessing', 3.0);
            player.getActor().playAudio('fortune_sound');
        }
        
        return `福神保佑！获得 ${bonus} 金币`;
    }
    
    /**
     * 炸弹效果：造成金钱损失
     */
    protected async executeBombEffect(player: Player, changes: { [playerId: string]: { [attr: number]: number } }): Promise<string> {
        const damage = this.calculateBombDamage(player);
        const actualLoss = Math.min(damage, player.getAttr(RoleAttribute.MONEY));
        
        player.payMoney(actualLoss, 'fine');
        
        // 记录属性变化
        changes[player.getId()] = { [RoleAttribute.MONEY]: -actualLoss };
        
        // 播放特效
        if (player.getActor()) {
            player.getActor().playEffect('explosion', 2.0);
            player.getActor().playAudio('explosion_sound');
        }
        
        return `踩到炸弹！损失 ${actualLoss} 金币`;
    }
    
    /**
     * 天使效果：治疗和保护
     */
    protected async executeAngelEffect(player: Player, changes: { [playerId: string]: { [attr: number]: number } }): Promise<string> {
        // 增加幸运值
        const luckBonus = 10;
        player.addTmpAttr(RoleAttribute.LUCK, luckBonus);
        
        // 增加少量金钱
        const heal = 500;
        player.receiveMoney(heal, 'bonus');
        
        changes[player.getId()] = { 
            [RoleAttribute.LUCK]: luckBonus,
            [RoleAttribute.MONEY]: heal
        };
        
        // 播放特效
        if (player.getActor()) {
            player.getActor().playEffect('angel_blessing', 4.0);
        }
        
        return `天使降临！幸运+${luckBonus}，获得 ${heal} 金币`;
    }
    
    /**
     * 恶魔效果：诅咒和损失
     */
    protected async executeDevilEffect(player: Player, changes: { [playerId: string]: { [attr: number]: number } }): Promise<string> {
        // 降低幸运值
        const luckPenalty = -15;
        player.addTmpAttr(RoleAttribute.LUCK, luckPenalty);
        
        // 损失金钱
        const curse = 800;
        const actualLoss = Math.min(curse, player.getAttr(RoleAttribute.MONEY));
        player.payMoney(actualLoss, 'fine');
        
        changes[player.getId()] = { 
            [RoleAttribute.LUCK]: luckPenalty,
            [RoleAttribute.MONEY]: -actualLoss
        };
        
        // 播放特效
        if (player.getActor()) {
            player.getActor().playEffect('devil_curse', 3.0);
        }
        
        return `恶魔诅咒！幸运${luckPenalty}，损失 ${actualLoss} 金币`;
    }
    
    /**
     * 银行家效果：提供贷款和投资服务
     */
    protected async executeBankerEffect(player: Player, changes: { [playerId: string]: { [attr: number]: number } }): Promise<string> {
        // 银行家提供各种金融服务，这里简化为存款奖励
        const currentMoney = player.getAttr(RoleAttribute.MONEY);
        const interest = Math.floor(currentMoney * 0.05); // 5%利息
        
        player.receiveMoney(interest, 'bonus');
        changes[player.getId()] = { [RoleAttribute.MONEY]: interest };
        
        return `银行家提供存款利息：${interest} 金币`;
    }
    
    /**
     * 小偷效果：偷取金钱
     */
    protected async executeThiefEffect(player: Player, changes: { [playerId: string]: { [attr: number]: number } }): Promise<string> {
        const stealAmount = Math.min(1000, Math.floor(player.getAttr(RoleAttribute.MONEY) * 0.1));
        const actualSteal = Math.min(stealAmount, player.getAttr(RoleAttribute.MONEY));
        
        player.payMoney(actualSteal, 'other');
        changes[player.getId()] = { [RoleAttribute.MONEY]: -actualSteal };
        
        // 播放特效
        if (player.getActor()) {
            player.getActor().playEffect('steal', 2.0);
        }
        
        return `遭遇小偷！被偷 ${actualSteal} 金币`;
    }
    
    // ========================= 计算方法 =========================
    
    /**
     * 计算福神奖励
     */
    protected calculateFortuneBonus(player: Player): number {
        const baseMoney = 2000;
        const luckBonus = Math.floor(player.getAttr(RoleAttribute.LUCK) * 10);
        return baseMoney + luckBonus + Math.floor(Math.random() * 1000);
    }
    
    /**
     * 计算炸弹伤害
     */
    protected calculateBombDamage(player: Player): number {
        const baseDamage = 1500;
        const luckReduction = Math.floor(player.getAttr(RoleAttribute.LUCK) * 5);
        return Math.max(500, baseDamage - luckReduction + Math.floor(Math.random() * 500));
    }
    
    // ========================= 生命周期管理 =========================
    
    /**
     * 更新NPC状态（每回合调用）
     */
    public updateNPC(): void {
        // 更新生存时间
        if (this.m_lifeTime > 0) {
            this.m_lifeTime--;
            if (this.m_lifeTime <= 0) {
                this.m_npcState = NPCState.DYING;
            }
        }
        
        // 更新冷却时间
        if (this.m_remainingCooldown > 0) {
            this.m_remainingCooldown--;
            if (this.m_remainingCooldown <= 0 && this.m_npcState === NPCState.COOLING_DOWN) {
                this.m_npcState = NPCState.ACTIVE;
            }
        }
        
        // 检查是否需要消失
        if (this.m_npcState === NPCState.DYING) {
            this.despawn();
        }
    }
    
    /**
     * 消失NPC
     */
    protected despawn(): void {
        this.m_npcState = NPCState.DEAD;
        
        // 播放消失特效
        if (this.m_actor) {
            this.m_actor.playEffect('despawn', 1.0);
        }
        
        // 触发消失事件
        this.emit('npc-despawn', { npc: this });
        
        console.log(`[NPC] ${this.m_strName} 消失了`);
    }
    
    // ========================= 条件检查 =========================
    
    /**
     * 检查是否可以触发
     */
    public canTrigger(condition: NPCTriggerCondition): boolean {
        // 检查NPC状态
        if (this.m_npcState !== NPCState.ACTIVE) {
            return false;
        }
        
        // 检查触发条件
        if (this.m_triggerCondition !== condition && this.m_triggerCondition !== NPCTriggerCondition.MANUAL) {
            return false;
        }
        
        // 检查触发次数
        if (this.m_maxTriggers > 0 && this.m_triggerCount >= this.m_maxTriggers) {
            return false;
        }
        
        // 检查冷却时间
        if (this.m_remainingCooldown > 0) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 检查是否应该消耗NPC
     */
    protected shouldConsume(): boolean {
        // 检查触发次数限制
        if (this.m_maxTriggers > 0 && this.m_triggerCount >= this.m_maxTriggers) {
            return true;
        }
        
        // 检查生存时间
        if (this.m_lifeTime === 0) {
            return true;
        }
        
        return false;
    }
    
    // ========================= 辅助方法 =========================
    
    /**
     * 设置自定义属性
     */
    protected setCustomProperty(key: string, value: any): void {
        // 可以用于存储配置中的自定义属性
        console.log(`[NPC] 设置自定义属性 ${key}: ${value}`);
    }
    
    /**
     * 创建失败结果
     */
    protected createFailResult(message: string, players: Player[]): NPCTriggerResult {
        return {
            success: false,
            message: message,
            affectedPlayers: players,
            attributeChanges: {},
            consumeNPC: false
        };
    }
    
    // ========================= 访问器 =========================
    
    public getNPCType(): NPCType { return this.m_npcType; }
    public getNPCState(): NPCState { return this.m_npcState; }
    public getLifeTime(): number { return this.m_lifeTime; }
    public getEffectRadius(): number { return this.m_effectRadius; }
    public getTriggerCondition(): NPCTriggerCondition { return this.m_triggerCondition; }
    public getTriggerCount(): number { return this.m_triggerCount; }
    public getRemainingCooldown(): number { return this.m_remainingCooldown; }
    public getConfig(): NPCConfig | null { return this.m_config; }
    
    public setLifeTime(time: number): void { this.m_lifeTime = time; }
    public setEffectRadius(radius: number): void { this.m_effectRadius = radius; }
    public setTriggerCondition(condition: NPCTriggerCondition): void { this.m_triggerCondition = condition; }
    public setCooldownTurns(turns: number): void { this.m_cooldownTurns = turns; }
    public setMaxTriggers(max: number): void { this.m_maxTriggers = max; }
    
    // ========================= 状态检查 =========================
    
    public isActive(): boolean { return this.m_npcState === NPCState.ACTIVE; }
    public isDead(): boolean { return this.m_npcState === NPCState.DEAD; }
    public isCoolingDown(): boolean { return this.m_npcState === NPCState.COOLING_DOWN; }
    public canRetrigger(): boolean { return this.m_canRetrigger; }
    
    // ========================= 重写方法 =========================
    
    /**
     * 重写重置方法
     */
    public reset(): void {
        super.reset();
        
        // 重置NPC特有数据
        this.m_npcState = NPCState.SPAWNING;
        this.m_triggerCount = 0;
        this.m_remainingCooldown = 0;
        this.m_createTime = Date.now();
        this.m_lastTriggerTime = 0;
        
        // 重新设置默认配置
        this.setDefaultConfigByType();
        
        console.log(`[NPC] NPC重置完成: ${this.m_strName}`);
    }
    
    /**
     * 重写调试信息
     */
    public debugInfo(): string {
        const baseInfo = super.debugInfo();
        const npcInfo = [
            `NPC类型: ${this.m_npcType}`,
            `状态: ${this.m_npcState}`,
            `生存时间: ${this.m_lifeTime}`,
            `触发次数: ${this.m_triggerCount}/${this.m_maxTriggers}`,
            `冷却: ${this.m_remainingCooldown}`,
            `半径: ${this.m_effectRadius}`
        ];
        
        return `${baseInfo}, ${npcInfo.join(', ')}`;
    }
}