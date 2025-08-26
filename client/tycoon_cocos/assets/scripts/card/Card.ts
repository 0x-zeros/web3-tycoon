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
    
    // ========================= 私有属性 =========================\n    \n    /** 卡片数据 */\n    protected _cardData: CardData | null = null;\n    \n    /** 卡片实例 */\n    protected _cardInstance: CardInstance | null = null;\n    \n    /** 当前状态 */\n    protected _currentState: CardState = CardState.AVAILABLE;\n    \n    /** 剩余使用次数 */\n    protected _remainingUses: number = -1;\n    \n    /** 剩余冷却时间 */\n    protected _remainingCooldown: number = 0;\n    \n    /** 是否正在使用中 */\n    protected _isUsingCard: boolean = false;\n    \n    // ========================= 抽象属性和方法 =========================\n    \n    /** 卡片类型（子类必须实现） */\n    public abstract get cardType(): CardType;\n    \n    /** 使用时机（子类必须实现） */\n    public abstract get usageTiming(): CardUsageTiming;\n    \n    /** 目标类型（子类必须实现） */\n    public abstract get targetType(): CardTargetType;\n    \n    /**\n     * 执行卡片效果（子类必须实现）\n     * @param context 使用上下文\n     */\n    protected abstract executeCardEffect(context: CardUseContext): Promise<CardUseResult>;\n    \n    /**\n     * 检查是否可以使用（子类可重写）\n     * @param context 使用上下文\n     */\n    protected checkUsability(context: CardUseContext): CardUsabilityCheck {\n        const reasons: string[] = [];\n        \n        // 检查卡片状态\n        if (this._currentState !== CardState.AVAILABLE) {\n            reasons.push('卡片当前不可用');\n        }\n        \n        // 检查冷却时间\n        if (this._remainingCooldown > 0) {\n            reasons.push(`冷却中，剩余 ${this._remainingCooldown} 回合`);\n        }\n        \n        // 检查使用次数\n        if (this._remainingUses === 0) {\n            reasons.push('使用次数已耗尽');\n        }\n        \n        // 检查使用消耗\n        if (this.useCost > 0 && context.player.financialStatus.cash < this.useCost) {\n            reasons.push(`金钱不足，需要 ${this.useCost}`);\n        }\n        \n        return {\n            canUse: reasons.length === 0,\n            reasons: reasons,\n            requiredTargetType: this.targetType\n        };\n    }\n    \n    // ========================= 生命周期方法 =========================\n    \n    protected onLoad(): void {\n        this.initializeUI();\n        this.setupEventHandlers();\n    }\n    \n    protected start(): void {\n        this.updateCardDisplay();\n    }\n    \n    protected onDestroy(): void {\n        this.cleanup();\n    }\n    \n    // ========================= 初始化方法 =========================\n    \n    /**\n     * 初始化UI组件\n     */\n    private initializeUI(): void {\n        // 更新卡片名称\n        if (this.nameLabel && this.cardName) {\n            this.nameLabel.string = this.cardName;\n        }\n        \n        // 更新卡片描述\n        if (this.descriptionLabel && this.cardDescription) {\n            this.descriptionLabel.string = this.cardDescription;\n        }\n        \n        // 初始化使用次数显示\n        this.updateUsesDisplay();\n        \n        console.log(`[Card] 卡片UI初始化完成: ${this.cardName}`);\n    }\n    \n    /**\n     * 设置事件处理器\n     */\n    private setupEventHandlers(): void {\n        // 设置使用按钮点击事件\n        if (this.useButton) {\n            this.useButton.node.on(Button.EventType.CLICK, this.onUseButtonClick, this);\n        }\n        \n        // 设置拖拽事件（如果支持）\n        if (this.draggableUse) {\n            this.setupDragHandlers();\n        }\n    }\n    \n    /**\n     * 设置拖拽事件处理器\n     */\n    private setupDragHandlers(): void {\n        // TODO: 实现拖拽功能\n        // 这里需要根据Cocos Creator的触摸系统实现拖拽逻辑\n        console.log('[Card] 拖拽功能待实现');\n    }\n    \n    /**\n     * 清理资源\n     */\n    private cleanup(): void {\n        if (this.useButton && this.useButton.isValid) {\n            this.useButton.node.off(Button.EventType.CLICK, this.onUseButtonClick, this);\n        }\n    }\n    \n    // ========================= 公共接口方法 =========================\n    \n    /**\n     * 初始化卡片\n     * @param cardData 卡片数据\n     * @param cardInstance 卡片实例\n     */\n    public initializeCard(cardData: CardData, cardInstance: CardInstance): void {\n        this._cardData = cardData;\n        this._cardInstance = cardInstance;\n        \n        // 更新基本属性\n        this.cardName = cardData.name;\n        this.cardDescription = cardData.description;\n        this.useCost = cardData.cost || 0;\n        this.cooldownTurns = cardData.cooldown || 0;\n        this.maxUses = cardData.maxUses || -1;\n        \n        // 初始化使用次数\n        if (cardInstance.remainingUses !== undefined) {\n            this._remainingUses = cardInstance.remainingUses;\n        } else {\n            this._remainingUses = this.maxUses;\n        }\n        \n        // 初始化冷却时间\n        this._remainingCooldown = cardInstance.remainingCooldown || 0;\n        \n        // 初始化状态\n        this._currentState = cardInstance.state;\n        \n        // 更新显示\n        this.updateCardDisplay();\n        \n        // 调用子类初始化\n        this.onCardInitialized(cardData, cardInstance);\n        \n        console.log(`[Card] 卡片初始化完成: ${this.cardName} (${this.cardType})`);\n    }\n    \n    /**\n     * 使用卡片\n     * @param context 使用上下文\n     */\n    public async useCard(context: CardUseContext): Promise<CardUseResult> {\n        if (this._isUsingCard) {\n            return {\n                success: false,\n                message: '卡片正在使用中',\n                errorCode: 'CARD_IN_USE',\n                appliedEffects: [],\n                affectedPlayerIds: [],\n                affectedTileIds: []\n            };\n        }\n        \n        // 检查使用条件\n        const usabilityCheck = this.checkUsability(context);\n        if (!usabilityCheck.canUse) {\n            return {\n                success: false,\n                message: usabilityCheck.reasons.join('; '),\n                errorCode: 'UNUSABLE',\n                appliedEffects: [],\n                affectedPlayerIds: [],\n                affectedTileIds: []\n            };\n        }\n        \n        this._isUsingCard = true;\n        \n        try {\n            // 扣除使用消耗\n            if (this.useCost > 0) {\n                context.player.financialStatus.cash -= this.useCost;\n                context.player.financialStatus.expenses.other += this.useCost;\n            }\n            \n            // 执行卡片效果\n            const result = await this.executeCardEffect(context);\n            \n            if (result.success) {\n                // 更新使用次数\n                if (this._remainingUses > 0) {\n                    this._remainingUses--;\n                }\n                \n                // 设置冷却时间\n                if (this.cooldownTurns > 0) {\n                    this._remainingCooldown = this.cooldownTurns;\n                    this._currentState = CardState.COOLING_DOWN;\n                }\n                \n                // 检查是否用完\n                if (this._remainingUses === 0) {\n                    this._currentState = CardState.USED;\n                }\n                \n                // 更新统计\n                context.player.statistics.cardsUsed++;\n                \n                // 更新显示\n                this.updateCardDisplay();\n                \n                // 播放使用特效\n                this.playUseEffect();\n                \n                // 触发使用事件\n                this.emitCardUseEvent(context, result);\n            }\n            \n            return result;\n            \n        } finally {\n            this._isUsingCard = false;\n        }\n    }\n    \n    /**\n     * 更新冷却时间（每回合调用）\n     */\n    public updateCooldown(): void {\n        if (this._remainingCooldown > 0) {\n            this._remainingCooldown--;\n            \n            if (this._remainingCooldown <= 0) {\n                // 冷却结束，恢复可用状态\n                if (this._remainingUses !== 0) {\n                    this._currentState = CardState.AVAILABLE;\n                }\n            }\n            \n            this.updateCardDisplay();\n        }\n    }\n    \n    /**\n     * 检查是否可以使用\n     * @param context 使用上下文\n     */\n    public canUse(context: CardUseContext): boolean {\n        return this.checkUsability(context).canUse;\n    }\n    \n    // ========================= UI更新方法 =========================\n    \n    /**\n     * 更新卡片显示\n     */\n    private updateCardDisplay(): void {\n        // 更新使用次数显示\n        this.updateUsesDisplay();\n        \n        // 更新冷却显示\n        this.updateCooldownDisplay();\n        \n        // 更新按钮状态\n        this.updateButtonState();\n        \n        // 更新视觉状态\n        this.updateVisualState();\n    }\n    \n    /**\n     * 更新使用次数显示\n     */\n    private updateUsesDisplay(): void {\n        if (this.usesLabel) {\n            if (this._remainingUses === -1) {\n                this.usesLabel.string = '∞';\n            } else {\n                this.usesLabel.string = this._remainingUses.toString();\n            }\n        }\n    }\n    \n    /**\n     * 更新冷却显示\n     */\n    private updateCooldownDisplay(): void {\n        if (this.cooldownMask) {\n            const isOnCooldown = this._remainingCooldown > 0;\n            this.cooldownMask.active = isOnCooldown;\n            \n            // TODO: 可以添加冷却进度显示\n        }\n    }\n    \n    /**\n     * 更新按钮状态\n     */\n    private updateButtonState(): void {\n        if (this.useButton) {\n            const isUsable = this._currentState === CardState.AVAILABLE && \n                           this._remainingCooldown <= 0 && \n                           this._remainingUses !== 0;\n            \n            this.useButton.interactable = isUsable;\n        }\n    }\n    \n    /**\n     * 更新视觉状态\n     */\n    private updateVisualState(): void {\n        // 根据卡片状态调整透明度\n        let alpha = 1.0;\n        \n        switch (this._currentState) {\n            case CardState.COOLING_DOWN:\n                alpha = 0.6;\n                break;\n            case CardState.USED:\n                alpha = 0.3;\n                break;\n            case CardState.SEALED:\n                alpha = 0.4;\n                break;\n        }\n        \n        // 应用透明度到整个卡片\n        this.node.opacity = Math.floor(alpha * 255);\n    }\n    \n    // ========================= 事件处理方法 =========================\n    \n    /**\n     * 使用按钮点击处理\n     */\n    private onUseButtonClick(): void {\n        console.log(`[Card] 点击使用卡片: ${this.cardName}`);\n        \n        // 触发卡片使用事件，由上层处理具体的使用逻辑\n        this.node.emit('card-use-request', {\n            card: this,\n            cardType: this.cardType,\n            targetType: this.targetType\n        });\n    }\n    \n    /**\n     * 发射卡片使用事件\n     */\n    private emitCardUseEvent(context: CardUseContext, result: CardUseResult): void {\n        this.node.emit('card-used', {\n            card: this,\n            context: context,\n            result: result\n        });\n    }\n    \n    // ========================= 特效方法 =========================\n    \n    /**\n     * 播放使用特效\n     */\n    private playUseEffect(): void {\n        console.log(`[Card] 播放卡片使用特效: ${this.cardName}`);\n        \n        // TODO: 实现卡片使用特效\n        // 可以包括：\n        // 1. 卡片发光效果\n        // 2. 使用音效\n        // 3. 粒子特效\n        // 4. UI动画\n    }\n    \n    // ========================= 子类回调方法 =========================\n    \n    /**\n     * 卡片初始化回调（子类可重写）\n     * @param cardData 卡片数据\n     * @param cardInstance 卡片实例\n     */\n    protected onCardInitialized(cardData: CardData, cardInstance: CardInstance): void {\n        // 默认实现：无特殊处理\n    }\n    \n    // ========================= 工具方法 =========================\n    \n    /**\n     * 获取卡片数据\n     */\n    public getCardData(): CardData | null {\n        return this._cardData;\n    }\n    \n    /**\n     * 获取卡片实例\n     */\n    public getCardInstance(): CardInstance | null {\n        return this._cardInstance;\n    }\n    \n    /**\n     * 获取当前状态\n     */\n    public getCurrentState(): CardState {\n        return this._currentState;\n    }\n    \n    /**\n     * 获取剩余使用次数\n     */\n    public getRemainingUses(): number {\n        return this._remainingUses;\n    }\n    \n    /**\n     * 获取剩余冷却时间\n     */\n    public getRemainingCooldown(): number {\n        return this._remainingCooldown;\n    }\n    \n    /**\n     * 强制设置卡片状态（调试用）\n     */\n    public setState(state: CardState): void {\n        this._currentState = state;\n        this.updateCardDisplay();\n    }\n    \n    /**\n     * 重置卡片（恢复到初始状态）\n     */\n    public resetCard(): void {\n        this._remainingUses = this.maxUses;\n        this._remainingCooldown = 0;\n        this._currentState = CardState.AVAILABLE;\n        this.updateCardDisplay();\n        \n        console.log(`[Card] 卡片已重置: ${this.cardName}`);\n    }\n    \n    /**\n     * 获取卡片详细信息（用于UI显示）\n     */\n    public getCardInfo(): {\n        name: string;\n        description: string;\n        type: CardType;\n        state: CardState;\n        remainingUses: number;\n        remainingCooldown: number;\n        canUse: boolean;\n    } {\n        return {\n            name: this.cardName,\n            description: this.cardDescription,\n            type: this.cardType,\n            state: this._currentState,\n            remainingUses: this._remainingUses,\n            remainingCooldown: this._remainingCooldown,\n            canUse: this._currentState === CardState.AVAILABLE && \n                   this._remainingCooldown <= 0 && \n                   this._remainingUses !== 0\n        };\n    }\n}