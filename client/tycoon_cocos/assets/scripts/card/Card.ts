/**
 * 卡片基类
 * 
 * 重构整合技能系统，卡牌通过技能来实现效果
 * 卡片作为技能的包装器和使用载体
 * 
 * @author Web3 Tycoon Team
 * @version 2.0.0 - 整合技能系统
 */

import { _decorator, Component, Node, Sprite, Label, Button, EventTarget } from 'cc';
import { 
    CardData, 
    CardInstance, 
    CardType, 
    CardState, 
    CardUsageTiming, 
    CardTargetType,
    CardUseRequest,
    CardUseResult,
    CardUsabilityCheck
} from '../map/types/CardTypes';
import { PlayerData, GameEventType } from '../map/types/GameTypes';
import { Role } from '../role/Role';
import { Skill } from '../skill/Skill';
import { SkillManager } from '../skill/SkillManager';
import { SkillUseResult } from '../skill/SkillTypes';

const { ccclass, property } = _decorator;

/**
 * 卡片使用上下文接口
 */
export interface CardUseContext {
    /** 使用者 */
    player: PlayerData;
    /** 目标信息 */
    target?: any;
    /** 游戏状态 */
    gameState?: any;
    /** 额外参数 */
    parameters?: { [key: string]: any };
}

/**
 * 卡片基类
 * 定义所有卡片的通用功能和抽象接口
 */
@ccclass('Card')
export abstract class Card extends Component {
    
    // ========================= 编辑器属性 =========================
    
    @property({ displayName: "卡片名称", tooltip: "卡片的显示名称" })
    public cardName: string = '';
    
    @property({ displayName: "卡片描述", multiline: true, tooltip: "卡片的详细描述" })
    public cardDescription: string = '';
    
    @property({ displayName: "使用消耗", tooltip: "使用卡片的金钱消耗" })
    public useCost: number = 0;
    
    @property({ displayName: "冷却时间", tooltip: "使用后的冷却回合数" })
    public cooldownTurns: number = 0;
    
    @property({ displayName: "最大使用次数", tooltip: "卡片最大使用次数，-1表示无限" })
    public maxUses: number = -1;
    
    @property({ displayName: "可拖拽使用", tooltip: "是否支持拖拽到目标使用" })
    public draggableUse: boolean = true;
    
    // ========================= UI组件引用 =========================
    
    @property({ displayName: "卡片图标", type: Sprite, tooltip: "卡片图标Sprite组件" })
    public cardIcon: Sprite | null = null;
    
    @property({ displayName: "卡片名称标签", type: Label, tooltip: "显示卡片名称的Label" })
    public nameLabel: Label | null = null;
    
    @property({ displayName: "描述标签", type: Label, tooltip: "显示卡片描述的Label" })
    public descriptionLabel: Label | null = null;
    
    @property({ displayName: "使用按钮", type: Button, tooltip: "使用卡片的按钮" })
    public useButton: Button | null = null;
    
    @property({ displayName: "冷却遮罩", type: Node, tooltip: "冷却状态的遮罩节点" })
    public cooldownMask: Node | null = null;
    
    @property({ displayName: "使用次数标签", type: Label, tooltip: "显示剩余使用次数" })
    public usesLabel: Label | null = null;
    
    // ========================= 技能整合属性 =========================
    
    @property({ displayName: "关联技能ID", tooltip: "卡牌关联的技能ID" })
    public skillId: number = 0;
    
    // ========================= 私有属性 =========================
    
    /** 卡片数据 */
    protected _cardData: CardData | null = null;
    
    /** 卡片实例 */
    protected _cardInstance: CardInstance | null = null;
    
    /** 当前状态 */
    protected _currentState: CardState = CardState.AVAILABLE;
    
    /** 剩余使用次数 */
    protected _remainingUses: number = -1;
    
    /** 剩余冷却时间 */
    protected _remainingCooldown: number = 0;
    
    /** 是否正在使用中 */
    protected _isUsingCard: boolean = false;
    
    /** 关联的技能实例 */
    protected _skill: Skill | null = null;
    
    /** 卡牌唯一ID */
    protected _cardId: string = '';
    
    /** 创建时间 */
    protected _createTime: number = 0;
    
    // ========================= 抽象属性和方法 =========================
    
    /** 卡片类型（子类必须实现） */
    public abstract get cardType(): CardType;
    
    /** 使用时机（子类必须实现） */
    public abstract get usageTiming(): CardUsageTiming;
    
    /** 目标类型（子类必须实现） */
    public abstract get targetType(): CardTargetType;
    
    /**
     * 执行卡片效果（子类必须实现）
     * @param context 使用上下文
     */
    protected abstract executeCardEffect(context: CardUseContext): Promise<CardUseResult>;
    
    /**
     * 检查是否可以使用（子类可重写）
     * @param context 使用上下文
     */
    protected checkUsability(context: CardUseContext): CardUsabilityCheck {
        const reasons: string[] = [];
        
        // 检查卡片状态
        if (this._currentState !== CardState.AVAILABLE) {
            reasons.push('卡片当前不可用');
        }
        
        // 检查冷却时间
        if (this._remainingCooldown > 0) {
            reasons.push(`冷却中，剩余 ${this._remainingCooldown} 回合`);
        }
        
        // 检查使用次数
        if (this._remainingUses === 0) {
            reasons.push('使用次数已耗尽');
        }
        
        // 检查使用消耗
        if (this.useCost > 0 && context.player.financialStatus.cash < this.useCost) {
            reasons.push(`金钱不足，需要 ${this.useCost}`);
        }
        
        return {
            canUse: reasons.length === 0,
            reasons: reasons,
            requiredTargetType: this.targetType
        };
    }
    
    // ========================= 生命周期方法 =========================
    
    protected onLoad(): void {
        this.initializeCardInternal();
        this.initializeUI();
        this.setupEventHandlers();
    }
    
    protected start(): void {
        this.updateCardDisplay();
    }
    
    protected onDestroy(): void {
        this.cleanup();
    }
    
    // ========================= 初始化方法 =========================
    
    /**
     * 初始化卡牌
     */
    private initializeCardInternal(): void {
        this._cardId = this.generateCardId();
        this._createTime = Date.now();
        
        // 加载关联技能
        this.loadSkill();
        
        console.log(`[Card] 卡牌初始化: ${this.cardName} (技能ID: ${this.skillId})`);
    }
    
    /**
     * 加载关联技能
     */
    private loadSkill(): void {
        if (this.skillId > 0 && SkillManager.instance) {
            this._skill = SkillManager.instance.getSkill(this.skillId);
            
            if (this._skill) {
                // 从技能同步一些属性
                if (!this.cardName) {
                    this.cardName = this._skill.getName();
                }
                if (!this.cardDescription) {
                    this.cardDescription = this._skill.getDescription();
                }
                
                console.log(`[Card] 加载技能成功: ${this._skill.getName()}`);
            } else {
                console.warn(`[Card] 技能加载失败: ${this.skillId}`);
            }
        }
    }
    
    /**
     * 生成卡牌ID
     */
    private generateCardId(): string {
        return `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 初始化UI组件
     */
    private initializeUI(): void {
        // 更新卡片名称
        if (this.nameLabel && this.cardName) {
            this.nameLabel.string = this.cardName;
        }
        
        // 更新卡片描述
        if (this.descriptionLabel && this.cardDescription) {
            this.descriptionLabel.string = this.cardDescription;
        }
        
        // 初始化使用次数显示
        this.updateUsesDisplay();
        
        console.log(`[Card] 卡片UI初始化完成: ${this.cardName}`);
    }
    
    /**
     * 设置事件处理器
     */
    private setupEventHandlers(): void {
        // 设置使用按钮点击事件
        if (this.useButton) {
            this.useButton.node.on(Button.EventType.CLICK, this.onUseButtonClick, this);
        }
        
        // 设置拖拽事件（如果支持）
        if (this.draggableUse) {
            this.setupDragHandlers();
        }
    }
    
    /**
     * 设置拖拽事件处理器
     */
    private setupDragHandlers(): void {
        // TODO: 实现拖拽功能
        // 这里需要根据Cocos Creator的触摸系统实现拖拽逻辑
        console.log('[Card] 拖拽功能待实现');
    }
    
    /**
     * 清理资源
     */
    private cleanup(): void {
        if (this.useButton && this.useButton.isValid) {
            this.useButton.node.off(Button.EventType.CLICK, this.onUseButtonClick, this);
        }
    }
    
    // ========================= 公共接口方法 =========================
    
    /**
     * 初始化卡片
     * @param cardData 卡片数据
     * @param cardInstance 卡片实例
     */
    public initializeCard(cardData: CardData, cardInstance: CardInstance): void {
        this._cardData = cardData;
        this._cardInstance = cardInstance;
        
        // 更新基本属性
        this.cardName = cardData.name;
        this.cardDescription = cardData.description;
        this.useCost = cardData.cost || 0;
        this.cooldownTurns = cardData.cooldown || 0;
        this.maxUses = cardData.maxUses || -1;
        
        // 初始化使用次数
        if (cardInstance.remainingUses !== undefined) {
            this._remainingUses = cardInstance.remainingUses;
        } else {
            this._remainingUses = this.maxUses;
        }
        
        // 初始化冷却时间
        this._remainingCooldown = cardInstance.remainingCooldown || 0;
        
        // 初始化状态
        this._currentState = cardInstance.state;
        
        // 更新显示
        this.updateCardDisplay();
        
        // 调用子类初始化
        this.onCardInitialized(cardData, cardInstance);
        
        console.log(`[Card] 卡片初始化完成: ${this.cardName} (${this.cardType})`);
    }
    
    /**
     * 使用卡片（通过技能系统）
     * @param owner 卡片拥有者
     * @param target 目标对象
     */
    public async use(owner: Role, target?: Role): Promise<boolean> {
        if (this._isUsingCard) {
            console.warn('[Card] 卡片正在使用中');
            return false;
        }
        
        // 检查使用条件
        if (!this.canUse(owner)) {
            console.warn(`[Card] 卡片无法使用: ${this.cardName}`);
            return false;
        }
        
        this._isUsingCard = true;
        
        try {
            let success = false;
            
            // 如果有关联技能，通过技能系统执行
            if (this._skill) {
                console.log(`[Card] 通过技能执行: ${this._skill.getName()}`);
                success = await this._skill.use(owner, target);
            } else {
                // 降级到原有的卡片效果系统
                console.log(`[Card] 使用传统卡片效果: ${this.cardName}`);
                const context = this.createLegacyContext(owner, target);
                const result = await this.executeCardEffect(context);
                success = result.success;
            }
            
            if (success) {
                // 更新使用次数
                if (this._remainingUses > 0) {
                    this._remainingUses--;
                }
                
                // 设置冷却时间
                if (this.cooldownTurns > 0) {
                    this._remainingCooldown = this.cooldownTurns;
                    this._currentState = CardState.COOLING_DOWN;
                }
                
                // 检查是否用完
                if (this._remainingUses === 0) {
                    this._currentState = CardState.USED;
                }
                
                // 更新显示
                this.updateCardDisplay();
                
                // 播放使用特效
                this.playUseEffect();
                
                // 触发使用事件
                this.emitCardUseEvent(owner, target, success);
            }
            
            return success;
            
        } finally {
            this._isUsingCard = false;
        }
    }

    /**
     * 供管理器调用的上下文式使用接口
     * 子类应在 executeCardEffect 中实现具体效果
     */
    public async useCard(context: CardUseContext): Promise<CardUseResult> {
        return await this.executeCardEffect(context);
    }
    
    /**
     * 检查卡片是否可以使用
     */
    public canUse(owner: Role): boolean {
        // 检查卡片状态
        if (this._currentState !== CardState.AVAILABLE) {
            return false;
        }
        
        // 检查冷却时间
        if (this._remainingCooldown > 0) {
            return false;
        }
        
        // 检查使用次数
        if (this._remainingUses === 0) {
            return false;
        }
        
        // 如果有关联技能，检查技能使用条件
        if (this._skill) {
            return this._skill.canUse(owner);
        }
        
        // 检查基础消耗（降级处理）
        if (this.useCost > 0 && owner.getAttr(0) < this.useCost) { // 假设属性0是金钱
            return false;
        }
        
        return true;
    }
    
    /**
     * 创建传统上下文（向后兼容）
     */
    private createLegacyContext(owner: Role, target?: Role): CardUseContext {
        return {
            player: this.convertRoleToPlayerData(owner),
            target: target,
            gameState: null,
            parameters: {}
        };
    }
    
    /**
     * 转换Role到PlayerData（临时兼容方法）
     */
    private convertRoleToPlayerData(role: Role): PlayerData {
        // 这里需要根据实际的PlayerData结构来转换
        // 暂时返回一个模拟对象
        return {
            id: role.getId(),
            name: role.getName(),
            financialStatus: {
                cash: role.getAttr(0), // 假设属性0是金钱
                expenses: { other: 0 },
            },
            statistics: {
                cardsUsed: 0
            }
        } as any;
    }
    
    /**
     * 触发卡片使用事件
     */
    private emitCardUseEvent(owner: Role, target?: Role, success?: boolean): void {
        this.node.emit('card-used', {
            card: this,
            owner: owner,
            target: target,
            success: success
        });
    }
    
    /**
     * 更新冷却时间（每回合调用）
     */
    public updateCooldown(): void {
        if (this._remainingCooldown > 0) {
            this._remainingCooldown--;
            
            if (this._remainingCooldown <= 0) {
                // 冷却结束，恢复可用状态
                if (this._remainingUses !== 0) {
                    this._currentState = CardState.AVAILABLE;
                }
            }
            
            this.updateCardDisplay();
        }
    }
    
    /**
     * 检查是否可以使用
     * @param context 使用上下文
     */
    public canUse(context: CardUseContext): boolean {
        return this.checkUsability(context).canUse;
    }
    
    // ========================= UI更新方法 =========================
    
    /**
     * 更新卡片显示
     */
    private updateCardDisplay(): void {
        // 更新使用次数显示
        this.updateUsesDisplay();
        
        // 更新冷却显示
        this.updateCooldownDisplay();
        
        // 更新按钮状态
        this.updateButtonState();
        
        // 更新视觉状态
        this.updateVisualState();
    }
    
    /**
     * 更新使用次数显示
     */
    private updateUsesDisplay(): void {
        if (this.usesLabel) {
            if (this._remainingUses === -1) {
                this.usesLabel.string = '∞';
            } else {
                this.usesLabel.string = this._remainingUses.toString();
            }
        }
    }
    
    /**
     * 更新冷却显示
     */
    private updateCooldownDisplay(): void {
        if (this.cooldownMask) {
            const isOnCooldown = this._remainingCooldown > 0;
            this.cooldownMask.active = isOnCooldown;
            
            // TODO: 可以添加冷却进度显示
        }
    }
    
    /**
     * 更新按钮状态
     */
    private updateButtonState(): void {
        if (this.useButton) {
            const isUsable = this._currentState === CardState.AVAILABLE && 
                           this._remainingCooldown <= 0 && 
                           this._remainingUses !== 0;
            
            this.useButton.interactable = isUsable;
        }
    }
    
    /**
     * 更新视觉状态
     */
    private updateVisualState(): void {
        // 根据卡片状态调整透明度
        let alpha = 1.0;
        
        switch (this._currentState) {
            case CardState.COOLING_DOWN:
                alpha = 0.6;
                break;
            case CardState.USED:
                alpha = 0.3;
                break;
            case CardState.SEALED:
                alpha = 0.4;
                break;
        }
        
        // 应用透明度到整个卡片
        this.node.opacity = Math.floor(alpha * 255);
    }
    
    // ========================= 事件处理方法 =========================
    
    /**
     * 使用按钮点击处理
     */
    private onUseButtonClick(): void {
        console.log(`[Card] 点击使用卡片: ${this.cardName}`);
        
        // 触发卡片使用事件，由上层处理具体的使用逻辑
        this.node.emit('card-use-request', {
            card: this,
            cardType: this.cardType,
            targetType: this.targetType
        });
    }
    
    /**
     * 发射卡片使用事件
     */
    private emitCardUseEvent(context: CardUseContext, result: CardUseResult): void {
        this.node.emit('card-used', {
            card: this,
            context: context,
            result: result
        });
    }
    
    // ========================= 特效方法 =========================
    
    /**
     * 播放使用特效
     */
    private playUseEffect(): void {
        console.log(`[Card] 播放卡片使用特效: ${this.cardName}`);
        
        // TODO: 实现卡片使用特效
        // 可以包括：
        // 1. 卡片发光效果
        // 2. 使用音效
        // 3. 粒子特效
        // 4. UI动画
    }
    
    // ========================= 子类回调方法 =========================
    
    /**
     * 卡片初始化回调（子类可重写）
     * @param cardData 卡片数据
     * @param cardInstance 卡片实例
     */
    protected onCardInitialized(cardData: CardData, cardInstance: CardInstance): void {
        // 默认实现：无特殊处理
    }
    
    // ========================= 技能相关方法 =========================
    
    /**
     * 获取关联的技能
     */
    public getSkill(): Skill | null {
        return this._skill;
    }
    
    /**
     * 设置关联技能
     */
    public setSkill(skill: Skill): void {
        this._skill = skill;
        this.skillId = skill.getId();
        
        // 同步一些属性
        if (!this.cardName) {
            this.cardName = skill.getName();
        }
        if (!this.cardDescription) {
            this.cardDescription = skill.getDescription();
        }
    }
    
    /**
     * 获取技能ID
     */
    public getSkillId(): number {
        return this.skillId;
    }
    
    /**
     * 重新加载技能
     */
    public reloadSkill(): void {
        this.loadSkill();
    }
    
    /**
     * 获取卡片类型字符串（用于判断特殊卡片）
     */
    public getCardType(): string {
        if (this._skill) {
            const effects = this._skill.getEffects();
            if (effects.length > 0) {
                return effects[0].type;
            }
        }
        return this.cardType.toString();
    }
    
    // ========================= 工具方法 =========================
    
    /**
     * 获取卡片唯一ID
     */
    public getCardId(): string {
        return this._cardId;
    }
    
    /**
     * 获取卡片数据
     */
    public getCardData(): CardData | null {
        return this._cardData;
    }
    
    /**
     * 获取卡片实例
     */
    public getCardInstance(): CardInstance | null {
        return this._cardInstance;
    }
    
    /**
     * 获取当前状态
     */
    public getCurrentState(): CardState {
        return this._currentState;
    }
    
    /**
     * 获取剩余使用次数
     */
    public getRemainingUses(): number {
        return this._remainingUses;
    }
    
    /**
     * 获取剩余冷却时间
     */
    public getRemainingCooldown(): number {
        return this._remainingCooldown;
    }
    
    /**
     * 获取创建时间
     */
    public getCreateTime(): number {
        return this._createTime;
    }
    
    /**
     * 导出卡片数据
     */
    public exportData(): any {
        return {
            cardId: this._cardId,
            skillId: this.skillId,
            cardName: this.cardName,
            cardDescription: this.cardDescription,
            currentState: this._currentState,
            remainingUses: this._remainingUses,
            remainingCooldown: this._remainingCooldown,
            createTime: this._createTime,
            useCost: this.useCost,
            cooldownTurns: this.cooldownTurns,
            maxUses: this.maxUses
        };
    }
    
    /**
     * 从数据加载卡片
     */
    public loadData(data: any): void {
        this._cardId = data.cardId || this._cardId;
        this.skillId = data.skillId || this.skillId;
        this.cardName = data.cardName || this.cardName;
        this.cardDescription = data.cardDescription || this.cardDescription;
        this._currentState = data.currentState || this._currentState;
        this._remainingUses = data.remainingUses !== undefined ? data.remainingUses : this._remainingUses;
        this._remainingCooldown = data.remainingCooldown || 0;
        this._createTime = data.createTime || this._createTime;
        this.useCost = data.useCost || this.useCost;
        this.cooldownTurns = data.cooldownTurns || this.cooldownTurns;
        this.maxUses = data.maxUses !== undefined ? data.maxUses : this.maxUses;
        
        // 重新加载技能
        this.reloadSkill();
        
        // 更新显示
        this.updateCardDisplay();
    }
    
    /**
     * 强制设置卡片状态（调试用）
     */
    public setState(state: CardState): void {
        this._currentState = state;
        this.updateCardDisplay();
    }
    
    /**
     * 重置卡片（恢复到初始状态）
     */
    public resetCard(): void {
        this._remainingUses = this.maxUses;
        this._remainingCooldown = 0;
        this._currentState = CardState.AVAILABLE;
        this.updateCardDisplay();
        
        console.log(`[Card] 卡片已重置: ${this.cardName}`);
    }
    
    /**
     * 获取卡片详细信息（用于UI显示）
     */
    public getCardInfo(): {
        name: string;
        description: string;
        type: CardType;
        state: CardState;
        remainingUses: number;
        remainingCooldown: number;
        canUse: boolean;
    } {
        return {
            name: this.cardName,
            description: this.cardDescription,
            type: this.cardType,
            state: this._currentState,
            remainingUses: this._remainingUses,
            remainingCooldown: this._remainingCooldown,
            canUse: this._currentState === CardState.AVAILABLE && 
                   this._remainingCooldown <= 0 && 
                   this._remainingUses !== 0
        };
    }
}