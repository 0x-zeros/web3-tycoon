/**
 * 卡片管理器
 * 
 * 负责游戏中所有卡片相关的管理功能，包括卡片库管理、玩家手牌管理、
 * 卡片使用逻辑处理等核心功能
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component, Node, Prefab, instantiate, resources, JsonAsset } from 'cc';
import { 
    CardData, 
    CardInstance, 
    CardType, 
    CardState,
    CardUseRequest,
    CardUseResult,
    CardDeck,
    PlayerHand,
    CardAcquisitionEvent,
    MVP_CARDS
} from '../map/types/CardTypes';
import { PlayerData, GameEventType } from '../map/types/GameTypes';
import { Card, CardUseContext } from './Card';

const { ccclass, property } = _decorator;

/**
 * 卡片管理器配置接口
 */
interface CardManagerConfig {
    /** 默认手牌上限 */
    defaultHandSize: number;
    /** 每回合最大获得卡片数 */
    maxCardsPerTurn: number;
    /** 是否启用卡片交易 */
    enableCardTrading: boolean;
    /** 卡片获得方式配置 */
    acquisitionConfig: {
        chanceEventRate: number;
        purchaseEnabled: boolean;
        rewardEnabled: boolean;
    };
}

/**
 * 卡片使用结果统计
 */
interface CardUsageStats {
    /** 总使用次数 */
    totalUses: number;
    /** 成功使用次数 */
    successfulUses: number;
    /** 按卡片类型统计 */
    usageByType: { [cardType: string]: number };
    /** 按玩家统计 */
    usageByPlayer: { [playerId: string]: number };
}

/**
 * 卡片管理器主类
 */
@ccclass('CardManager')
export class CardManager extends Component {
    
    // ========================= 编辑器属性 =========================
    
    @property({ displayName: "卡片库文件", tooltip: "JSON格式的卡片库配置文件" })
    public cardDeckPath: string = 'data/cards/cards';
    
    @property({ displayName: "卡片预制件目录", tooltip: "存放卡片预制件的目录" })
    public cardPrefabDir: string = 'prefabs/cards/';
    
    @property({ displayName: "默认手牌上限", tooltip: "玩家默认最大手牌数量" })
    public defaultHandSize: number = 5;
    
    @property({ displayName: "启用卡片交易", tooltip: "是否允许玩家间交易卡片" })
    public enableTrading: boolean = false;
    
    @property({ displayName: "启用调试模式", tooltip: "显示卡片系统调试信息" })
    public debugMode: boolean = false;
    
    // ========================= 卡片预制件引用 =========================
    
    @property({ displayName: "遥控骰子卡预制件", type: Prefab })
    public diceControlCardPrefab: Prefab | null = null;
    
    @property({ displayName: "路障卡预制件", type: Prefab })
    public barrierCardPrefab: Prefab | null = null;
    
    @property({ displayName: "传送卡预制件", type: Prefab })
    public teleportCardPrefab: Prefab | null = null;
    
    @property({ displayName: "拆除卡预制件", type: Prefab })
    public demolishCardPrefab: Prefab | null = null;
    
    @property({ displayName: "免租卡预制件", type: Prefab })
    public freeRentCardPrefab: Prefab | null = null;
    
    // ========================= 私有属性 =========================
    
    /** 卡片库数据 */
    private _cardDeck: CardDeck | null = null;
    
    /** 所有卡片数据映射 */
    private _cardDataMap: Map<string, CardData> = new Map();
    
    /** 玩家手牌映射 */
    private _playerHands: Map<string, PlayerHand> = new Map();
    
    /** 活动卡片实例映射 */
    private _activeCards: Map<string, Card> = new Map();
    
    /** 卡片预制件映射 */
    private _cardPrefabs: Map<CardType, Prefab> = new Map();
    
    /** 管理器配置 */
    private _config: CardManagerConfig = {
        defaultHandSize: 5,
        maxCardsPerTurn: 2,
        enableCardTrading: false,
        acquisitionConfig: {
            chanceEventRate: 0.3,
            purchaseEnabled: true,
            rewardEnabled: true
        }
    };
    
    /** 使用统计 */
    private _usageStats: CardUsageStats = {
        totalUses: 0,
        successfulUses: 0,
        usageByType: {},
        usageByPlayer: {}
    };
    
    /** 获得事件历史 */
    private _acquisitionHistory: CardAcquisitionEvent[] = [];
    
    /** 是否已初始化 */
    private _isInitialized: boolean = false;
    
    // ========================= 生命周期方法 =========================
    
    protected onLoad(): void {
        this.initializeConfig();
        this.setupCardPrefabs();
    }
    
    protected start(): void {
        this.scheduleOnce(() => {
            this.initializeCardSystem();
        }, 0);
    }
    
    protected onDestroy(): void {
        this.cleanup();
    }
    
    // ========================= 初始化方法 =========================
    
    /**
     * 初始化配置
     */
    private initializeConfig(): void {
        this._config.defaultHandSize = this.defaultHandSize;
        this._config.enableCardTrading = this.enableTrading;
    }
    
    /**
     * 设置卡片预制件映射
     */
    private setupCardPrefabs(): void {
        this._cardPrefabs.set(CardType.DICE_CONTROL, this.diceControlCardPrefab!);
        this._cardPrefabs.set(CardType.BARRIER, this.barrierCardPrefab!);
        this._cardPrefabs.set(CardType.TELEPORT, this.teleportCardPrefab!);
        this._cardPrefabs.set(CardType.DEMOLISH, this.demolishCardPrefab!);
        this._cardPrefabs.set(CardType.FREE_RENT, this.freeRentCardPrefab!);
    }
    
    /**
     * 初始化卡片系统
     */
    private async initializeCardSystem(): Promise<void> {
        try {
            console.log('[CardManager] 开始初始化卡片系统...');
            
            // 加载卡片库数据
            await this.loadCardDeck();
            
            // 初始化卡片数据映射
            this.initializeCardDataMap();
            
            this._isInitialized = true;
            
            console.log('[CardManager] 卡片系统初始化完成');
            
            // 触发初始化完成事件
            this.node.emit('card-system-initialized', { 
                totalCards: this._cardDataMap.size 
            });
            
        } catch (error) {
            console.error('[CardManager] 卡片系统初始化失败:', error);
            this.node.emit('card-system-error', { error });
        }
    }
    
    /**
     * 加载卡片库数据
     */
    private async loadCardDeck(): Promise<void> {
        // 首先尝试加载外部卡片数据
        try {
            const jsonAsset = await this.loadJsonResource(this.cardDeckPath);
            this._cardDeck = jsonAsset.json as CardDeck;
            console.log('[CardManager] 从外部文件加载卡片库成功');
        } catch (error) {
            // 如果加载失败，使用内置的MVP卡片
            console.warn('[CardManager] 外部卡片库加载失败，使用内置卡片:', error);
            this._cardDeck = {
                deckId: 'mvp_deck',
                deckName: 'MVP卡片库',
                cards: MVP_CARDS,
                rarityWeights: {
                    common: 70,
                    rare: 25,
                    epic: 4,
                    legendary: 1
                },
                acquisitionRules: {
                    maxCardsPerTurn: 2,
                    maxHandSize: 5,
                    acquisitionMethods: ['chance', 'purchase', 'reward']
                }
            };
        }
    }
    
    /**
     * 加载JSON资源
     */
    private loadJsonResource(path: string): Promise<JsonAsset> {
        return new Promise((resolve, reject) => {
            resources.load(path, JsonAsset, (err, asset) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(asset);
                }
            });
        });
    }
    
    /**
     * 初始化卡片数据映射
     */
    private initializeCardDataMap(): void {
        if (!this._cardDeck) {
            return;
        }
        
        this._cardDataMap.clear();
        
        for (const cardData of this._cardDeck.cards) {
            this._cardDataMap.set(cardData.id, cardData);
        }
        
        console.log(`[CardManager] 卡片数据映射初始化完成，共 ${this._cardDataMap.size} 张卡片`);
    }
    
    // ========================= 玩家手牌管理 =========================
    
    /**
     * 初始化玩家手牌
     * @param playerId 玩家ID
     */
    public initializePlayerHand(playerId: string): PlayerHand {
        const hand: PlayerHand = {
            playerId: playerId,
            cards: [],
            maxHandSize: this._config.defaultHandSize,
            handState: {
                isDisabled: false
            }
        };
        
        this._playerHands.set(playerId, hand);
        
        console.log(`[CardManager] 玩家 ${playerId} 手牌初始化完成`);
        
        return hand;
    }
    
    /**
     * 获取玩家手牌
     * @param playerId 玩家ID
     */
    public getPlayerHand(playerId: string): PlayerHand | null {
        return this._playerHands.get(playerId) || null;
    }
    
    /**
     * 给玩家发放卡片
     * @param playerId 玩家ID
     * @param cardId 卡片ID
     * @param acquisitionMethod 获得方式
     */
    public async giveCardToPlayer(playerId: string, cardId: string, acquisitionMethod: string = 'system'): Promise<boolean> {
        const hand = this.getPlayerHand(playerId);
        if (!hand) {
            console.error(`[CardManager] 玩家 ${playerId} 手牌不存在`);
            return false;
        }
        
        // 检查手牌是否已满
        if (hand.cards.length >= hand.maxHandSize) {
            console.warn(`[CardManager] 玩家 ${playerId} 手牌已满`);
            return false;
        }
        
        // 检查卡片是否存在
        const cardData = this._cardDataMap.get(cardId);
        if (!cardData) {
            console.error(`[CardManager] 卡片 ${cardId} 不存在`);
            return false;
        }
        
        // 创建卡片实例
        const cardInstance: CardInstance = {
            instanceId: `${cardId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            cardId: cardId,
            ownerId: playerId,
            state: CardState.AVAILABLE,
            remainingUses: cardData.maxUses,
            remainingCooldown: 0,
            acquiredAt: Date.now()
        };
        
        // 添加到手牌
        hand.cards.push(cardInstance);
        
        // 记录获得事件
        const acquisitionEvent: CardAcquisitionEvent = {
            eventType: acquisitionMethod as any,
            playerId: playerId,
            cardId: cardId,
            acquisitionMethod: acquisitionMethod,
            timestamp: Date.now()
        };
        
        this._acquisitionHistory.push(acquisitionEvent);
        
        // 触发卡片获得事件
        this.node.emit('card-acquired', {
            playerId: playerId,
            cardId: cardId,
            cardName: cardData.name,
            acquisitionMethod: acquisitionMethod
        });
        
        console.log(`[CardManager] 玩家 ${playerId} 获得卡片: ${cardData.name}`);
        
        return true;
    }
    
    /**
     * 随机给玩家发放卡片
     * @param playerId 玩家ID
     * @param rarity 稀有度过滤（可选）
     */
    public async giveRandomCardToPlayer(playerId: string, rarity?: string): Promise<boolean> {
        if (!this._cardDeck) {
            return false;
        }
        
        // 获取可用卡片列表
        let availableCards = this._cardDeck.cards;
        
        if (rarity) {
            availableCards = availableCards.filter(card => 
                card.rarity.toString().toLowerCase() === rarity.toLowerCase()
            );
        }
        
        if (availableCards.length === 0) {
            console.warn(`[CardManager] 没有可用的卡片 (稀有度: ${rarity})`);
            return false;
        }
        
        // 基于权重的随机选择
        const totalWeight = availableCards.reduce((sum, card) => sum + card.dropWeight, 0);
        let randomValue = Math.random() * totalWeight;
        
        let selectedCard: CardData | null = null;
        for (const card of availableCards) {
            randomValue -= card.dropWeight;
            if (randomValue <= 0) {
                selectedCard = card;
                break;
            }
        }
        
        if (!selectedCard) {
            selectedCard = availableCards[0]; // 备选
        }
        
        return await this.giveCardToPlayer(playerId, selectedCard.id, 'random');
    }
    
    // ========================= 卡片使用管理 =========================
    
    /**
     * 使用卡片
     * @param request 使用请求
     */
    public async useCard(request: CardUseRequest): Promise<CardUseResult> {
        const hand = this.getPlayerHand(request.playerId);
        if (!hand) {
            return {
                success: false,
                message: '玩家手牌不存在',
                errorCode: 'NO_HAND',
                appliedEffects: [],
                affectedPlayerIds: [],
                affectedTileIds: []
            };
        }
        
        // 查找卡片实例
        const cardInstance = hand.cards.find(card => 
            card.instanceId === request.cardInstanceId
        );
        
        if (!cardInstance) {
            return {
                success: false,
                message: '卡片不存在',
                errorCode: 'CARD_NOT_FOUND',
                appliedEffects: [],
                affectedPlayerIds: [],
                affectedTileIds: []
            };
        }
        
        // 获取卡片数据
        const cardData = this._cardDataMap.get(cardInstance.cardId);
        if (!cardData) {
            return {
                success: false,
                message: '卡片数据不存在',
                errorCode: 'INVALID_CARD_DATA',
                appliedEffects: [],
                affectedPlayerIds: [],
                affectedTileIds: []
            };
        }
        
        // 创建卡片实例组件（如果需要）
        const cardComponent = await this.createCardComponent(cardData, cardInstance);
        if (!cardComponent) {
            return {
                success: false,
                message: '无法创建卡片组件',
                errorCode: 'COMPONENT_CREATION_FAILED',
                appliedEffects: [],
                affectedPlayerIds: [],
                affectedTileIds: []
            };
        }
        
        // 创建使用上下文
        // TODO: 这里需要通过GameManager获取完整的玩家数据
        const context: CardUseContext = {
            player: {} as PlayerData, // 需要实际的玩家数据
            target: request.target,
            parameters: request.parameters
        };
        
        // 执行卡片使用
        const result = await cardComponent.useCard(context);
        
        // 更新统计
        this._usageStats.totalUses++;
        if (result.success) {
            this._usageStats.successfulUses++;
            
            // 按类型统计
            const cardType = cardData.type.toString();
            this._usageStats.usageByType[cardType] = (this._usageStats.usageByType[cardType] || 0) + 1;
            
            // 按玩家统计
            this._usageStats.usageByPlayer[request.playerId] = (this._usageStats.usageByPlayer[request.playerId] || 0) + 1;
            
            // 如果卡片已用完，从手牌中移除
            if (cardInstance.state === CardState.USED) {
                const index = hand.cards.indexOf(cardInstance);
                if (index !== -1) {
                    hand.cards.splice(index, 1);
                }
            }
        }
        
        // 清理临时创建的组件
        if (cardComponent.node.isValid) {
            cardComponent.node.destroy();
        }
        
        return result;
    }
    
    /**
     * 创建卡片组件
     * @param cardData 卡片数据
     * @param cardInstance 卡片实例
     */
    private async createCardComponent(cardData: CardData, cardInstance: CardInstance): Promise<Card | null> {
        const prefab = this._cardPrefabs.get(cardData.type);
        if (!prefab) {
            console.error(`[CardManager] 找不到卡片类型 ${cardData.type} 的预制件`);
            return null;
        }
        
        const cardNode = instantiate(prefab);
        cardNode.setParent(this.node); // 临时父节点
        
        const cardComponent = cardNode.getComponent(Card);
        if (!cardComponent) {
            console.error(`[CardManager] 卡片预制件缺少Card组件`);
            cardNode.destroy();
            return null;
        }
        
        // 初始化卡片
        cardComponent.initializeCard(cardData, cardInstance);
        
        return cardComponent;
    }
    
    /**
     * 更新所有玩家手牌的冷却时间
     */
    public updateAllCardCooldowns(): void {
        this._playerHands.forEach((hand, playerId) => {
            hand.cards.forEach(cardInstance => {
                if (cardInstance.remainingCooldown && cardInstance.remainingCooldown > 0) {
                    cardInstance.remainingCooldown--;
                    
                    if (cardInstance.remainingCooldown <= 0 && cardInstance.state === CardState.COOLING_DOWN) {
                        cardInstance.state = CardState.AVAILABLE;
                    }
                }
            });
        });
        
        if (this.debugMode) {
            console.log('[CardManager] 所有卡片冷却时间已更新');
        }
    }
    
    // ========================= 工具方法 =========================
    
    /**
     * 获取卡片数据
     * @param cardId 卡片ID
     */
    public getCardData(cardId: string): CardData | null {
        return this._cardDataMap.get(cardId) || null;
    }
    
    /**
     * 获取所有卡片数据
     */
    public getAllCardData(): CardData[] {
        return Array.from(this._cardDataMap.values());
    }
    
    /**
     * 检查系统是否已初始化
     */
    public isInitialized(): boolean {
        return this._isInitialized;
    }
    
    /**
     * 获取使用统计
     */
    public getUsageStats(): CardUsageStats {
        return { ...this._usageStats };
    }
    
    /**
     * 获取获得历史
     */
    public getAcquisitionHistory(playerId?: string): CardAcquisitionEvent[] {
        if (playerId) {
            return this._acquisitionHistory.filter(event => event.playerId === playerId);
        }
        return [...this._acquisitionHistory];
    }
    
    /**
     * 清理资源
     */
    private cleanup(): void {
        this._cardDataMap.clear();
        this._playerHands.clear();
        this._activeCards.clear();
        this._acquisitionHistory.length = 0;
        
        console.log('[CardManager] 资源清理完成');
    }
    
    /**
     * 重置卡片系统
     */
    public resetCardSystem(): void {
        this.cleanup();
        this._isInitialized = false;
        
        // 重新初始化
        this.scheduleOnce(() => {
            this.initializeCardSystem();
        }, 0);
        
        console.log('[CardManager] 卡片系统已重置');
    }
    
    /**
     * 获取系统状态信息
     */
    public getSystemInfo(): {
        initialized: boolean;
        totalCards: number;
        totalPlayers: number;
        totalAcquisitions: number;
        totalUses: number;
    } {
        return {
            initialized: this._isInitialized,
            totalCards: this._cardDataMap.size,
            totalPlayers: this._playerHands.size,
            totalAcquisitions: this._acquisitionHistory.length,
            totalUses: this._usageStats.totalUses
        };
    }
}