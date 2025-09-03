/**
 * Skill类 - 技能基类
 * 
 * 包含技能的核心数据和执行逻辑
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { forEach, find } from 'lodash-es';
import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';
import { Role } from '../role/Role';
import { RoleAttribute } from '../role/RoleTypes';
import { 
    SkillAttribute, 
    SkillType, 
    SkillState, 
    SkillConfig, 
    SkillEffect, 
    SkillEffectType,
    SkillTargetType,
    SkillUseResult,
    SkillInstance,
    SkillUtils
} from './SkillTypes';

/**
 * 技能基类
 * 包含技能的所有核心逻辑
 */
export class Skill {
    
    // ========================= 基础属性 =========================
    
    /** 技能ID */
    protected m_oId: number = 0;
    
    /** 技能类型ID */
    protected m_iTypeId: number = 0;
    
    /** 技能等级 */
    protected m_iLevel: number = 1;
    
    /** 技能名称 */
    protected m_strName: string = '';
    
    /** 技能描述 */
    protected m_strDescription: string = '';
    
    /** 技能类型 */
    protected m_eType: SkillType = SkillType.ACTIVE;
    
    // ========================= 属性系统 =========================
    
    /** 永久属性 */
    protected m_attr: Map<SkillAttribute, number> = new Map();
    
    /** 临时属性 */
    protected m_tmpAttr: Map<SkillAttribute, number> = new Map();
    
    // ========================= 配置和状态 =========================
    
    /** 技能配置 */
    protected m_config: SkillConfig | null = null;
    
    /** 技能状态 */
    protected m_eState: SkillState = SkillState.READY;
    
    /** 技能效果列表 */
    protected m_effects: SkillEffect[] = [];
    
    // ========================= 使用统计 =========================
    
    /** 使用次数 */
    protected m_iUseCount: number = 0;
    
    /** 最后使用时间 */
    protected m_fLastUseTime: number = 0;
    
    /** 剩余冷却时间（毫秒） */
    protected m_fRemainingCooldown: number = 0;
    
    /** 当前经验值 */
    protected m_iCurrentExp: number = 0;
    
    /** 是否已解锁 */
    protected m_bUnlocked: boolean = true;
    
    // ========================= 效果工作状态 =========================
    
    /** 效果是否正在工作 */
    protected m_bEffectWork: boolean = false;
    
    /** 施法开始时间 */
    protected m_fCastStartTime: number = 0;
    
    /** 是否可中断 */
    protected m_bInterruptible: boolean = true;
    
    // ========================= 构造和初始化 =========================
    
    constructor(config?: SkillConfig) {
        if (config) {
            this.initializeFromConfig(config);
        }
    }
    
    /**
     * 从配置初始化技能
     */
    public initializeFromConfig(config: SkillConfig): void {
        this.m_config = config;
        this.m_oId = config.id;
        this.m_iTypeId = config.id;
        this.m_strName = config.name;
        this.m_strDescription = config.description;
        this.m_eType = config.type;
        this.m_iLevel = config.level || 1;
        
        // 加载属性
        this.loadAttributes(config.attributes);
        
        // 加载效果
        this.m_effects = [...config.effects];
        
        console.log(`[Skill] 技能初始化完成: ${this.m_strName} (${this.m_oId})`);
    }
    
    /**
     * 加载技能属性
     */
    protected loadAttributes(attributes: { [key: string]: number }): void {
        this.m_attr.clear();
        
        for (const [attrName, value] of Object.entries(attributes)) {
            const attr = SkillAttribute[attrName as keyof typeof SkillAttribute];
            if (attr !== undefined) {
                this.m_attr.set(attr, value);
            }
        }
        
        // 设置默认属性
        if (!this.m_attr.has(SkillAttribute.COOLDOWN)) {
            this.m_attr.set(SkillAttribute.COOLDOWN, 0);
        }
        if (!this.m_attr.has(SkillAttribute.COST)) {
            this.m_attr.set(SkillAttribute.COST, 0);
        }
    }
    
    // ========================= 属性访问方法 =========================
    
    /**
     * 获取属性值（永久 + 临时）
     */
    public getAttr(attr: SkillAttribute): number {
        const permanent = this.m_attr.get(attr) || 0;
        const temporary = this.m_tmpAttr.get(attr) || 0;
        return permanent + temporary;
    }
    
    /**
     * 设置永久属性
     */
    public setAttr(attr: SkillAttribute, value: number): void {
        this.m_attr.set(attr, value);
    }
    
    /**
     * 增加永久属性
     */
    public addAttr(attr: SkillAttribute, add: number): void {
        const current = this.m_attr.get(attr) || 0;
        this.m_attr.set(attr, current + add);
    }
    
    /**
     * 获取临时属性
     */
    public getTmpAttr(attr: SkillAttribute): number {
        return this.m_tmpAttr.get(attr) || 0;
    }
    
    /**
     * 设置临时属性
     */
    public setTmpAttr(attr: SkillAttribute, value: number): void {
        this.m_tmpAttr.set(attr, value);
    }
    
    /**
     * 增加临时属性
     */
    public addTmpAttr(attr: SkillAttribute, add: number): void {
        const current = this.m_tmpAttr.get(attr) || 0;
        this.m_tmpAttr.set(attr, current + add);
    }
    
    /**
     * 获取有效属性值
     */
    public getValidAttr(attr: SkillAttribute): number {
        return this.getAttr(attr);
    }
    
    // ========================= 技能使用 =========================
    
    /**
     * 检查是否可以使用技能
     */
    public canUse(caster: Role, target?: Role): boolean {
        // 检查技能状态
        if (this.m_eState !== SkillState.READY) {
            return false;
        }
        
        // 检查是否解锁
        if (!this.m_bUnlocked) {
            return false;
        }
        
        // 检查冷却时间
        if (this.m_fRemainingCooldown > 0) {
            return false;
        }
        
        // 检查使用消耗
        const cost = this.getAttr(SkillAttribute.COST);
        if (cost > 0 && caster.getAttr(RoleAttribute.MONEY) < cost) {
            return false;
        }
        
        // 检查等级需求
        const levelReq = this.getAttr(SkillAttribute.LEVEL_REQUIREMENT);
        if (levelReq > 0 && caster.getAttr(RoleAttribute.LEVEL) < levelReq) {
            return false;
        }
        
        // 检查目标
        if (this.needTarget() && !target) {
            return false;
        }
        
        // 检查目标有效性
        if (target && !this.isValidTarget(caster, target)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 使用技能
     */
    public async use(caster: Role, target?: Role): Promise<SkillUseResult> {
        // 检查使用条件
        if (!this.canUse(caster, target)) {
            return this.createFailResult('技能无法使用', caster, target);
        }
        
        console.log(`[Skill] ${caster.getName()} 使用技能: ${this.m_strName}`);
        
        // 设置技能状态
        this.m_eState = SkillState.CASTING;
        this.m_bEffectWork = true;
        this.m_fCastStartTime = Date.now();
        
        try {
            // 扣除使用消耗
            const costs = await this.consumeResources(caster);
            
            // 检查施法时间
            const castTime = this.getAttr(SkillAttribute.CAST_TIME);
            if (castTime > 0) {
                await this.performCasting(caster, castTime);
            }
            
            // 执行技能效果
            const result = await this.executeSkillEffects(caster, target);
            
            // 更新使用统计
            this.m_iUseCount++;
            this.m_fLastUseTime = Date.now();
            
            // 设置冷却时间
            this.startCooldown();
            
            // 触发使用完成事件
            EventBus.emitEvent(EventTypes.Skill.Used, {
                skillId: this.m_oId,
                casterId: caster.getRoleId(),
                targetId: target?.getRoleId(),
                result: result
            });
            
            return {
                success: true,
                message: `${this.m_strName} 使用成功`,
                costs: costs,
                affectedTargets: result.affectedTargets,
                appliedEffects: result.appliedEffects,
                triggeredEvents: result.triggeredEvents
            };
            
        } catch (error) {
            console.error(`[Skill] 技能使用失败: ${this.m_strName}`, error);
            return this.createFailResult(`技能使用失败: ${error}`, caster, target);
            
        } finally {
            this.m_bEffectWork = false;
            if (this.m_eState === SkillState.CASTING) {
                this.m_eState = SkillState.READY;
            }
        }
    }
    
    /**
     * 执行技能
     */
    public async execute(caster: Role, target?: Role): Promise<boolean> {
        const result = await this.use(caster, target);
        return result.success;
    }
    
    // ========================= 技能效果执行 =========================
    
    /**
     * 执行技能效果
     */
    protected async executeSkillEffects(caster: Role, target?: Role): Promise<SkillUseResult> {
        const appliedEffects: SkillEffect[] = [];
        const affectedTargets: Role[] = [];
        const triggeredEvents: string[] = [];
        
        for (const effect of this.m_effects) {
            try {
                // 检查触发概率
                if (effect.probability && Math.random() > effect.probability) {
                    continue;
                }
                
                // 应用延迟
                if (effect.delay && effect.delay > 0) {
                    await this.delay(effect.delay * 1000);
                }
                
                // 执行具体效果
                const effectResult = await this.applyEffect(effect, caster, target);
                
                if (effectResult.success) {
                    appliedEffects.push(effect);
                    affectedTargets.push(...effectResult.affectedTargets);
                    triggeredEvents.push(...effectResult.triggeredEvents);
                }
                
            } catch (error) {
                console.error(`[Skill] 效果执行失败: ${effect.type}`, error);
            }
        }
        
        return {
            success: appliedEffects.length > 0,
            message: `应用了 ${appliedEffects.length} 个效果`,
            costs: {},
            affectedTargets: affectedTargets,
            appliedEffects: appliedEffects,
            triggeredEvents: triggeredEvents
        };
    }
    
    /**
     * 应用单个效果
     */
    protected async applyEffect(effect: SkillEffect, caster: Role, target?: Role): Promise<SkillUseResult> {
        const effectTargets = this.getEffectTargets(effect, caster, target);
        const affectedTargets: Role[] = [];
        const triggeredEvents: string[] = [];
        
        for (const effectTarget of effectTargets) {
            const success = await this.applyEffectToTarget(effect, caster, effectTarget);
            if (success) {
                affectedTargets.push(effectTarget);
            }
        }
        
        // 根据效果类型触发相应事件
        this.triggerEffectEvents(effect, caster, affectedTargets, triggeredEvents);
        
        return {
            success: affectedTargets.length > 0,
            message: `效果 ${effect.type} 影响了 ${affectedTargets.length} 个目标`,
            costs: {},
            affectedTargets: affectedTargets,
            appliedEffects: [effect],
            triggeredEvents: triggeredEvents
        };
    }
    
    /**
     * 对单个目标应用效果
     */
    protected async applyEffectToTarget(effect: SkillEffect, caster: Role, target: Role): Promise<boolean> {
        console.log(`[Skill] 对 ${target.getName()} 应用效果: ${effect.type}, 数值: ${effect.value}`);
        
        switch (effect.type) {
            case SkillEffectType.DAMAGE:
                return this.applyDamageEffect(effect, caster, target);
                
            case SkillEffectType.HEAL:
                return this.applyHealEffect(effect, caster, target);
                
            case SkillEffectType.MONEY:
                return this.applyMoneyEffect(effect, caster, target);
                
            case SkillEffectType.MOVE:
                return await this.applyMoveEffect(effect, caster, target);
                
            case SkillEffectType.TELEPORT:
                return await this.applyTeleportEffect(effect, caster, target);
                
            case SkillEffectType.BUFF:
                return this.applyBuffEffect(effect, caster, target);
                
            case SkillEffectType.DEBUFF:
                return this.applyDebuffEffect(effect, caster, target);
                
            case SkillEffectType.JAIL_ESCAPE:
                return this.applyJailEscapeEffect(effect, caster, target);
                
            case SkillEffectType.RENT_FREE:
                return this.applyRentFreeEffect(effect, caster, target);
                
            case SkillEffectType.DICE_CONTROL:
                return this.applyDiceControlEffect(effect, caster, target);
                
            case SkillEffectType.CARD_DRAW:
                return this.applyCardDrawEffect(effect, caster, target);
                
            default:
                console.warn(`[Skill] 未实现的效果类型: ${effect.type}`);
                return false;
        }
    }
    
    // ========================= 具体效果实现 =========================
    
    /**
     * 伤害效果
     */
    protected applyDamageEffect(effect: SkillEffect, caster: Role, target: Role): boolean {
        const damage = this.calculateEffectValue(effect.value, caster);
        target.addAttr(RoleAttribute.HP, -damage);
        
        // 播放受击特效
        if (target.getActor()) {
            target.getActor().playEffect('damage', 1.0);
        }
        
        return true;
    }
    
    /**
     * 治疗效果
     */
    protected applyHealEffect(effect: SkillEffect, caster: Role, target: Role): boolean {
        const heal = this.calculateEffectValue(effect.value, caster);
        target.addAttr(RoleAttribute.HP, heal);
        
        // 播放治疗特效
        if (target.getActor()) {
            target.getActor().playEffect('heal', 1.5);
        }
        
        return true;
    }
    
    /**
     * 金钱效果
     */
    protected applyMoneyEffect(effect: SkillEffect, caster: Role, target: Role): boolean {
        const money = this.calculateEffectValue(effect.value, caster);
        
        if (money > 0) {
            target.addAttr(RoleAttribute.MONEY, money);
            // 播放获得金钱特效
            if (target.getActor()) {
                target.getActor().playEffect('money_gain', 2.0);
            }
        } else {
            // 扣除金钱，需要检查是否足够
            const currentMoney = target.getAttr(RoleAttribute.MONEY);
            const actualLoss = Math.min(-money, currentMoney);
            target.addAttr(RoleAttribute.MONEY, -actualLoss);
            
            // 播放失去金钱特效
            if (target.getActor()) {
                target.getActor().playEffect('money_loss', 1.5);
            }
        }
        
        return true;
    }
    
    /**
     * 移动效果
     */
    protected async applyMoveEffect(effect: SkillEffect, caster: Role, target: Role): Promise<boolean> {
        const steps = Math.floor(this.calculateEffectValue(effect.value, caster));
        
        // 这里需要通过GameManager来处理移动
        // 暂时记录移动请求
        console.log(`[Skill] ${target.getName()} 移动 ${steps} 步`);
        
        // 触发移动事件，由上层处理
        target.emit('skill-move-request', {
            target: target,
            steps: steps,
            skill: this
        });
        
        return true;
    }
    
    /**
     * 传送效果
     */
    protected async applyTeleportEffect(effect: SkillEffect, caster: Role, target: Role): Promise<boolean> {
        const targetTileId = Math.floor(this.calculateEffectValue(effect.value, caster));
        
        console.log(`[Skill] ${target.getName()} 传送到地块 ${targetTileId}`);
        
        // 触发传送事件
        target.emit('skill-teleport-request', {
            target: target,
            tileId: targetTileId,
            skill: this
        });
        
        return true;
    }
    
    /**
     * 增益效果
     */
    protected applyBuffEffect(effect: SkillEffect, caster: Role, target: Role): boolean {
        const attribute = this.getAttributeFromParams(effect.params);
        const value = this.calculateEffectValue(effect.value, caster);
        const duration = (effect.duration || 3) * 1000; // 转换为毫秒
        
        if (attribute !== undefined) {
            target.addTmpAttr(attribute, value);
            
            // 设置定时器移除临时属性
            setTimeout(() => {
                target.addTmpAttr(attribute, -value);
            }, duration);
        }
        
        // 播放增益特效
        if (target.getActor()) {
            target.getActor().playEffect('buff', effect.duration || 3);
        }
        
        return true;
    }
    
    /**
     * 减益效果
     */
    protected applyDebuffEffect(effect: SkillEffect, caster: Role, target: Role): boolean {
        const attribute = this.getAttributeFromParams(effect.params);
        const value = -Math.abs(this.calculateEffectValue(effect.value, caster)); // 确保是负值
        const duration = (effect.duration || 3) * 1000;
        
        if (attribute !== undefined) {
            target.addTmpAttr(attribute, value);
            
            // 设置定时器移除临时属性
            setTimeout(() => {
                target.addTmpAttr(attribute, -value);
            }, duration);
        }
        
        // 播放减益特效
        if (target.getActor()) {
            target.getActor().playEffect('debuff', effect.duration || 3);
        }
        
        return true;
    }
    
    /**
     * 出狱效果
     */
    protected applyJailEscapeEffect(effect: SkillEffect, caster: Role, target: Role): boolean {
        if (target.getAttr(RoleAttribute.JAIL_TURNS) > 0) {
            target.setAttr(RoleAttribute.JAIL_TURNS, 0);
            target.setState('idle' as any);
            
            // 播放出狱特效
            if (target.getActor()) {
                target.getActor().playEffect('jail_escape', 2.0);
            }
            
            return true;
        }
        
        return false;
    }
    
    /**
     * 免租效果
     */
    protected applyRentFreeEffect(effect: SkillEffect, caster: Role, target: Role): boolean {
        const turns = Math.floor(this.calculateEffectValue(effect.value, caster));
        
        // 设置免租回合数（这里需要扩展Player类来支持）
        console.log(`[Skill] ${target.getName()} 获得 ${turns} 回合免租`);
        
        // 触发免租事件
        target.emit('skill-rent-free', {
            target: target,
            turns: turns,
            skill: this
        });
        
        return true;
    }
    
    /**
     * 骰子控制效果
     */
    protected applyDiceControlEffect(effect: SkillEffect, caster: Role, target: Role): boolean {
        const diceValue = Math.floor(this.calculateEffectValue(effect.value, caster));
        
        console.log(`[Skill] ${target.getName()} 下次骰子结果为 ${diceValue}`);
        
        // 触发骰子控制事件
        target.emit('skill-dice-control', {
            target: target,
            diceValue: diceValue,
            skill: this
        });
        
        return true;
    }
    
    /**
     * 抽卡效果
     */
    protected applyCardDrawEffect(effect: SkillEffect, caster: Role, target: Role): boolean {
        const cardCount = Math.floor(this.calculateEffectValue(effect.value, caster));
        
        console.log(`[Skill] ${target.getName()} 抽取 ${cardCount} 张卡牌`);
        
        // 触发抽卡事件
        target.emit('skill-card-draw', {
            target: target,
            cardCount: cardCount,
            cardType: effect.params?.cardType || 'any',
            skill: this
        });
        
        return true;
    }
    
    // ========================= 辅助方法 =========================
    
    /**
     * 计算效果数值
     */
    protected calculateEffectValue(baseValue: number, caster: Role): number {
        // 可以根据施法者属性调整效果值
        const casterLevel = caster.getAttr(RoleAttribute.LEVEL) || 1;
        const levelBonus = (casterLevel - 1) * 0.1; // 每级增加10%效果
        
        return Math.floor(baseValue * (1 + levelBonus));
    }
    
    /**
     * 获取效果目标列表
     */
    protected getEffectTargets(effect: SkillEffect, caster: Role, target?: Role): Role[] {
        switch (effect.target) {
            case SkillTargetType.SELF:
                return [caster];
                
            case SkillTargetType.SINGLE_PLAYER:
                return target ? [target] : [];
                
            case SkillTargetType.ALL_PLAYERS:
                // 这里需要通过GameManager获取所有玩家
                console.log('[Skill] 需要获取所有玩家列表');
                return target ? [target] : [caster]; // 暂时简化
                
            default:
                return target ? [target] : [caster];
        }
    }
    
    /**
     * 从参数中获取属性类型
     */
    protected getAttributeFromParams(params?: { [key: string]: any }): RoleAttribute | undefined {
        if (!params || !params.attribute) {
            return undefined;
        }
        
        const attrName = params.attribute.toUpperCase();
        return RoleAttribute[attrName as keyof typeof RoleAttribute];
    }
    
    /**
     * 触发效果事件
     */
    protected triggerEffectEvents(effect: SkillEffect, caster: Role, targets: Role[], events: string[]): void {
        const eventName = `effect-${effect.type}`;
        events.push(eventName);
        
        this.emit(eventName, {
            effect: effect,
            caster: caster,
            targets: targets,
            skill: this
        });
    }
    
    /**
     * 检查是否需要目标
     */
    protected needTarget(): boolean {
        return this.m_effects.some(effect => 
            effect.target !== SkillTargetType.SELF && 
            effect.target !== SkillTargetType.NONE
        );
    }
    
    /**
     * 检查目标有效性
     */
    protected isValidTarget(caster: Role, target: Role): boolean {
        // 基础有效性检查
        if (!target || target === caster) {
            return this.m_effects.some(effect => effect.target === SkillTargetType.SELF);
        }
        
        // 检查目标是否存活
        if (!target.isAlive()) {
            return false;
        }
        
        // 检查距离（如果有范围限制）
        const range = this.getAttr(SkillAttribute.RANGE);
        if (range > 0) {
            // 这里需要计算实际距离
            // 暂时假设都在范围内
        }
        
        return true;
    }
    
    /**
     * 消耗资源
     */
    protected async consumeResources(caster: Role): Promise<{ [resource: string]: number }> {
        const costs: { [resource: string]: number } = {};
        
        const moneyCost = this.getAttr(SkillAttribute.COST);
        if (moneyCost > 0) {
            caster.addAttr(RoleAttribute.MONEY, -moneyCost);
            costs['money'] = moneyCost;
        }
        
        return costs;
    }
    
    /**
     * 执行施法过程
     */
    protected async performCasting(caster: Role, castTime: number): Promise<void> {
        console.log(`[Skill] ${caster.getName()} 开始施法: ${this.m_strName}, 施法时间: ${castTime}秒`);
        
        // 播放施法动画
        if (caster.getActor()) {
            caster.getActor().playAnimation('cast');
        }
        
        // 等待施法时间
        await this.delay(castTime * 1000);
        
        // 检查是否被中断
        if (this.m_eState !== SkillState.CASTING) {
            throw new Error('技能施法被中断');
        }
    }
    
    /**
     * 开始冷却
     */
    protected startCooldown(): void {
        const cooldown = this.getAttr(SkillAttribute.COOLDOWN);
        if (cooldown > 0) {
            this.m_fRemainingCooldown = cooldown * 1000; // 转换为毫秒
            this.m_eState = SkillState.COOLING_DOWN;
            
            // 触发冷却开始事件
            EventBus.emitEvent(EventTypes.Skill.CooldownStart, {
                skillId: this.m_oId,
                cooldownTime: cooldown
            });
            
            // 启动冷却定时器
            this.startCooldownTimer();
        }
    }
    
    /**
     * 启动冷却定时器
     */
    protected startCooldownTimer(): void {
        const updateInterval = 100; // 100ms更新一次
        
        const timer = setInterval(() => {
            this.m_fRemainingCooldown -= updateInterval;
            
            if (this.m_fRemainingCooldown <= 0) {
                this.m_fRemainingCooldown = 0;
                this.m_eState = SkillState.READY;
                
                // 触发冷却结束事件
                EventBus.emitEvent(EventTypes.Skill.CooldownEnd, {
                    skillId: this.m_oId
                });
                
                clearInterval(timer);
            }
        }, updateInterval);
    }
    
    /**
     * 延迟函数
     */
    protected delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 创建失败结果
     */
    protected createFailResult(message: string, caster: Role, target?: Role): SkillUseResult {
        return {
            success: false,
            message: message,
            costs: {},
            affectedTargets: [],
            appliedEffects: [],
            triggeredEvents: []
        };
    }
    
    // ========================= 冷却和状态管理 =========================
    
    /**
     * 更新冷却时间（每帧调用）
     */
    public updateCooldown(deltaTime: number): void {
        if (this.m_fRemainingCooldown > 0) {
            this.m_fRemainingCooldown -= deltaTime;
            
            if (this.m_fRemainingCooldown <= 0) {
                this.m_fRemainingCooldown = 0;
                if (this.m_eState === SkillState.COOLING_DOWN) {
                    this.m_eState = SkillState.READY;
                    this.emit('cooldown-finished', { skill: this });
                }
            }
        }
    }
    
    /**
     * 重置冷却时间
     */
    public resetCooldown(): void {
        this.m_fRemainingCooldown = 0;
        if (this.m_eState === SkillState.COOLING_DOWN) {
            this.m_eState = SkillState.READY;
        }
        
        this.emit('cooldown-reset', { skill: this });
    }
    
    /**
     * 中断技能
     */
    public interrupt(): boolean {
        if (this.m_eState === SkillState.CASTING && this.m_bInterruptible) {
            this.m_eState = SkillState.READY;
            this.m_bEffectWork = false;
            
            this.emit('skill-interrupted', { skill: this });
            
            console.log(`[Skill] 技能被中断: ${this.m_strName}`);
            return true;
        }
        
        return false;
    }
    
    // ========================= 访问器 =========================
    
    public getId(): number { return this.m_oId; }
    public getTypeId(): number { return this.m_iTypeId; }
    public getName(): string { return this.m_strName; }
    public getDescription(): string { return this.m_strDescription; }
    public getType(): SkillType { return this.m_eType; }
    public getLevel(): number { return this.m_iLevel; }
    public getState(): SkillState { return this.m_eState; }
    public getConfig(): SkillConfig | null { return this.m_config; }
    public getEffects(): SkillEffect[] { return [...this.m_effects]; }
    public getUseCount(): number { return this.m_iUseCount; }
    public getLastUseTime(): number { return this.m_fLastUseTime; }
    public getRemainingCooldown(): number { return this.m_fRemainingCooldown; }
    public isUnlocked(): boolean { return this.m_bUnlocked; }
    public isReady(): boolean { return this.m_eState === SkillState.READY && this.m_fRemainingCooldown <= 0; }
    public isOnCooldown(): boolean { return this.m_fRemainingCooldown > 0; }
    public isCasting(): boolean { return this.m_eState === SkillState.CASTING; }
    
    public setLevel(level: number): void { this.m_iLevel = Math.max(1, level); }
    public setUnlocked(unlocked: boolean): void { this.m_bUnlocked = unlocked; }
    public setState(state: SkillState): void { this.m_eState = state; }
    
    // ========================= 导出数据 =========================
    
    /**
     * 导出技能实例数据
     */
    public exportInstance(): SkillInstance {
        return {
            config: this.m_config!,
            currentLevel: this.m_iLevel,
            currentExp: this.m_iCurrentExp,
            remainingCooldown: this.m_fRemainingCooldown,
            state: this.m_eState,
            useCount: this.m_iUseCount,
            lastUseTime: this.m_fLastUseTime,
            tempAttributes: new Map(this.m_tmpAttr),
            unlocked: this.m_bUnlocked
        };
    }
    
    /**
     * 从实例数据加载
     */
    public loadInstance(instance: SkillInstance): void {
        this.initializeFromConfig(instance.config);
        this.m_iLevel = instance.currentLevel;
        this.m_iCurrentExp = instance.currentExp;
        this.m_fRemainingCooldown = instance.remainingCooldown;
        this.m_eState = instance.state;
        this.m_iUseCount = instance.useCount;
        this.m_fLastUseTime = instance.lastUseTime;
        this.m_tmpAttr = new Map(instance.tempAttributes);
        this.m_bUnlocked = instance.unlocked;
    }
    
    /**
     * 调试信息
     */
    public debugInfo(): string {
        const info = [
            `ID: ${this.m_oId}`,
            `名称: ${this.m_strName}`,
            `类型: ${this.m_eType}`,
            `等级: ${this.m_iLevel}`,
            `状态: ${this.m_eState}`,
            `冷却: ${Math.ceil(this.m_fRemainingCooldown / 1000)}秒`,
            `使用次数: ${this.m_iUseCount}`,
            `已解锁: ${this.m_bUnlocked}`
        ];
        
        return `[Skill] ${info.join(', ')}`;
    }
}