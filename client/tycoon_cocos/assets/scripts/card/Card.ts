/**
 * 卡片基类
 * 
 * 所有卡片的基础类，定义卡片的通用行为和接口
 * 提供卡片使用、冷却、状态管理等核心功能
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component, Node, Sprite, Label, Button } from 'cc';
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
     * 使用卡片
     * @param context 使用上下文
     */
    public async useCard(context: CardUseContext): Promise<CardUseResult> {
        if (this._isUsingCard) {
            return {
                success: false,
                message: '卡片正在使用中',
                errorCode: 'CARD_IN_USE',
                appliedEffects: [],
                affectedPlayerIds: [],
                affectedTileIds: []
            };
        }
        
        // 检查使用条件
        const usabilityCheck = this.checkUsability(context);
        if (!usabilityCheck.canUse) {
            return {
                success: false,
                message: usabilityCheck.reasons.join('; '),
                errorCode: 'UNUSABLE',
                appliedEffects: [],
                affectedPlayerIds: [],
                affectedTileIds: []
            };
        }
        
        this._isUsingCard = true;
        
        try {
            // 扣除使用消耗
            if (this.useCost > 0) {
                context.player.financialStatus.cash -= this.useCost;
                context.player.financialStatus.expenses.other += this.useCost;
            }
            
            // 执行卡片效果
            const result = await this.executeCardEffect(context);
            
            if (result.success) {
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
                
                // 更新统计
                context.player.statistics.cardsUsed++;
                
                // 更新显示
                this.updateCardDisplay();
                
                // 播放使用特效
                this.playUseEffect();
                
                // 触发使用事件
                this.emitCardUseEvent(context, result);
            }
            
            return result;
            
        } finally {
            this._isUsingCard = false;
        }
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
    
    // ========================= 工具方法 =========================
    
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