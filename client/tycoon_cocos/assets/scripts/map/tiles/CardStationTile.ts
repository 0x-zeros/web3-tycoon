/**
 * 卡片站地块
 * 
 * 玩家经过时可以获得游戏卡片的特殊地块
 * 实现简单易懂的卡片获得机制，提升游戏趣味性
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component } from 'cc';
import { MapTile, TileInteractionResult } from '../core/MapTile';
import { MapTileData, TileType, CardStationData } from '../types/MapTypes';
import { PlayerData, GameEventType } from '../types/GameTypes';
import { CardType, MVP_CARDS, CardRarity } from '../types/CardTypes';

const { ccclass, property } = _decorator;

/**
 * 卡片站地块实现类
 * 提供经过时获得卡片的功能
 */
@ccclass('CardStationTile')
export class CardStationTile extends MapTile {
    
    // ========================= 编辑器属性 =========================
    
    @property({ displayName: "卡片掉落概率", range: [0, 1], tooltip: "玩家触发时获得卡片的概率" })
    public cardDropRate: number = 1.0;
    
    @property({ displayName: "经过时触发", tooltip: "玩家经过时是否触发卡片获得" })
    public triggerOnPass: boolean = true;
    
    @property({ displayName: "停留时触发", tooltip: "玩家停留时是否触发卡片获得" })
    public triggerOnLand: boolean = true;
    
    @property({ displayName: "显示获得动画", tooltip: "是否显示卡片获得动画" })
    public showCardAnimation: boolean = true;
    
    @property({ displayName: "卡片音效", tooltip: "获得卡片时播放的音效" })
    public cardAudioName: string = 'card_acquire';
    
    // ========================= 私有属性 =========================
    
    /** 卡片站配置数据 */
    private _cardStationConfig: CardStationData | null = null;
    
    /** 获得卡片历史 */
    private _cardHistory: { playerId: string; cardId: string; timestamp: number }[] = [];
    
    // ========================= 抽象方法实现 =========================
    
    /**
     * 获取地块类型
     */
    public get tileType(): TileType {
        return TileType.CARD_STATION;
    }
    
    /**
     * 地块初始化
     * @param tileData 地块数据
     */
    protected onTileInitialized(tileData: MapTileData): void {
        // 从地块数据中读取配置
        if (tileData.cardStationData) {
            this._cardStationConfig = tileData.cardStationData;
            
            // 应用配置到组件属性
            this.cardDropRate = this._cardStationConfig.cardDropRate;
            this.triggerOnPass = this._cardStationConfig.triggerOnPass;
            this.triggerOnLand = this._cardStationConfig.triggerOnLand;
        } else {
            // 使用默认配置
            this._cardStationConfig = {
                cardDropRate: this.cardDropRate,
                triggerOnPass: this.triggerOnPass,
                triggerOnLand: this.triggerOnLand,
                maxCardsPerTrigger: 1,
                cardRarityWeights: {
                    common: 70,
                    rare: 25,
                    epic: 5
                }
            };
        }
        
        console.log(`[CardStationTile] 卡片站初始化完成: ${this.tileName}, 掉落率: ${this.cardDropRate}`);
    }
    
    /**
     * 玩家经过处理
     * @param player 经过的玩家
     */
    protected async onPlayerPassBy(player: PlayerData): Promise<TileInteractionResult> {
        if (!this.triggerOnPass || !this._cardStationConfig) {
            return {
                success: true,
                message: '',
                events: [],
                blockMovement: false
            };
        }
        
        console.log(`[CardStationTile] 玩家 ${player.nickname} 经过卡片站 ${this.tileName}`);
        
        return await this.tryGiveCard(player, '经过');
    }
    
    /**
     * 玩家停留处理
     * @param player 停留的玩家
     */
    protected async onPlayerLandOn(player: PlayerData): Promise<TileInteractionResult> {
        if (!this.triggerOnLand || !this._cardStationConfig) {
            return {
                success: true,
                message: '欢迎来到卡片站！',
                events: [],
                blockMovement: false
            };
        }
        
        console.log(`[CardStationTile] 玩家 ${player.nickname} 停留在卡片站 ${this.tileName}`);
        
        return await this.tryGiveCard(player, '停留');
    }
    
    // ========================= 卡片获得逻辑 =========================
    
    /**
     * 尝试给玩家卡片
     * @param player 目标玩家
     * @param trigger 触发方式
     */
    private async tryGiveCard(player: PlayerData, trigger: string): Promise<TileInteractionResult> {
        if (!this._cardStationConfig) {
            return {
                success: false,
                message: '卡片站配置错误',
                events: []
            };
        }
        
        // 检查掉落概率
        if (Math.random() > this._cardStationConfig.cardDropRate) {
            return {
                success: true,
                message: `${trigger}卡片站，但这次没有获得卡片`,
                events: [],
                blockMovement: false
            };
        }
        
        // 检查手牌是否已满
        if (player.hand.cards.length >= player.hand.maxHandSize) {
            return {
                success: false,
                message: '手牌已满，无法获得新卡片',
                events: [],
                blockMovement: false
            };
        }
        
        // 播放特效动画
        if (this.showCardAnimation) {
            await this.playCardAcquireAnimation();
        }
        
        // 随机选择卡片
        const selectedCard = this.selectRandomCard();
        if (!selectedCard) {
            return {
                success: false,
                message: '没有可用的卡片',
                events: [],
                blockMovement: false
            };
        }
        
        // 创建卡片实例
        const cardInstance = {
            instanceId: `card_${Date.now()}_${Math.random()}`,
            cardId: selectedCard.id,
            ownerId: player.id,
            state: 'available' as const,
            acquiredAt: Date.now()
        };
        
        // 添加到玩家手牌
        player.hand.cards.push(cardInstance);
        player.statistics.cardsAcquired++;
        
        // 记录历史
        this._cardHistory.push({
            playerId: player.id,
            cardId: selectedCard.id,
            timestamp: Date.now()
        });
        
        // 创建游戏事件
        const gameEvent = {
            eventId: `card_station_${Date.now()}`,
            type: GameEventType.CARD_ACQUISITION,
            timestamp: Date.now(),
            turnNumber: 0,
            actorPlayerId: player.id,
            affectedTileId: this.getTileData()?.id,
            parameters: {
                triggerType: trigger,
                cardId: selectedCard.id,
                cardName: selectedCard.name,
                cardRarity: selectedCard.rarity
            },
            description: `${player.nickname} 在${trigger}卡片站时获得卡片：${selectedCard.name}`,
            result: { cardCount: player.hand.cards.length }
        };
        
        return {
            success: true,
            message: `恭喜！${trigger}卡片站获得卡片：${selectedCard.name}！`,
            events: [gameEvent],
            blockMovement: false
        };
    }
    
    /**
     * 随机选择卡片
     */
    private selectRandomCard() {
        if (!this._cardStationConfig) {
            return null;
        }
        
        // 根据权重选择稀有度
        const rarityWeights = this._cardStationConfig.cardRarityWeights;
        const totalWeight = rarityWeights.common + rarityWeights.rare + rarityWeights.epic;
        
        if (totalWeight === 0) {
            return null;
        }
        
        let randomValue = Math.random() * totalWeight;
        let selectedRarity: CardRarity;
        
        if (randomValue <= rarityWeights.common) {
            selectedRarity = CardRarity.COMMON;
        } else if (randomValue <= rarityWeights.common + rarityWeights.rare) {
            selectedRarity = CardRarity.RARE;
        } else {
            selectedRarity = CardRarity.EPIC;
        }
        
        // 筛选出指定稀有度的卡片
        const availableCards = MVP_CARDS.filter(card => card.rarity === selectedRarity);
        
        if (availableCards.length === 0) {
            // 如果没有指定稀有度的卡片，回退到普通卡片
            const commonCards = MVP_CARDS.filter(card => card.rarity === CardRarity.COMMON);
            if (commonCards.length === 0) {
                return null;
            }
            return commonCards[Math.floor(Math.random() * commonCards.length)];
        }
        
        // 随机选择一张卡片
        return availableCards[Math.floor(Math.random() * availableCards.length)];
    }
    
    // ========================= 特效和动画 =========================
    
    /**
     * 播放卡片获得动画
     */
    private async playCardAcquireAnimation(): Promise<void> {
        console.log('[CardStationTile] 播放卡片获得动画');
        
        // TODO: 实现卡片获得的特效动画
        // 可以包括：
        // 1. 卡片飞出动画
        // 2. 闪光特效
        // 3. 音效播放
        // 4. UI提示动画
        
        return new Promise((resolve) => {
            this.scheduleOnce(() => {
                resolve();
            }, 0.8); // 动画持续0.8秒
        });
    }
    
    // ========================= 公共方法 =========================
    
    /**
     * 获取卡片获得历史
     * @param playerId 可选的玩家ID筛选
     */
    public getCardHistory(playerId?: string): { playerId: string; cardId: string; timestamp: number }[] {
        if (playerId) {
            return this._cardHistory.filter(record => record.playerId === playerId);
        }
        return [...this._cardHistory];
    }
    
    /**
     * 清除卡片历史
     */
    public clearCardHistory(): void {
        this._cardHistory = [];
        console.log('[CardStationTile] 卡片历史已清除');
    }
    
    /**
     * 获取卡片站配置
     */
    public getCardStationConfig(): CardStationData | null {
        return this._cardStationConfig;
    }
    
    /**
     * 更新卡片站配置
     * @param config 新的配置
     */
    public updateCardStationConfig(config: Partial<CardStationData>): void {
        if (!this._cardStationConfig) {
            return;
        }
        
        this._cardStationConfig = { ...this._cardStationConfig, ...config };
        
        // 更新组件属性
        if (config.cardDropRate !== undefined) {
            this.cardDropRate = config.cardDropRate;
        }
        if (config.triggerOnPass !== undefined) {
            this.triggerOnPass = config.triggerOnPass;
        }
        if (config.triggerOnLand !== undefined) {
            this.triggerOnLand = config.triggerOnLand;
        }
        
        console.log('[CardStationTile] 卡片站配置已更新', this._cardStationConfig);
    }
    
    /**
     * 获取地块统计信息
     */
    public getCardStationStats(): {
        totalCardGiven: number;
        playerCardCounts: { [playerId: string]: number };
        cardRarityDistribution: { [rarity: string]: number };
        averageCardsPerPlayer: number;
    } {
        const playerCardCounts: { [playerId: string]: number } = {};
        const cardRarityDistribution: { [rarity: string]: number } = {};
        
        this._cardHistory.forEach(record => {
            // 统计玩家获得数量
            playerCardCounts[record.playerId] = (playerCardCounts[record.playerId] || 0) + 1;
            
            // 统计稀有度分布
            const card = MVP_CARDS.find(c => c.id === record.cardId);
            if (card) {
                const rarity = card.rarity.toString();
                cardRarityDistribution[rarity] = (cardRarityDistribution[rarity] || 0) + 1;
            }
        });
        
        const totalPlayers = Object.keys(playerCardCounts).length;
        const averageCardsPerPlayer = totalPlayers > 0 ? this._cardHistory.length / totalPlayers : 0;
        
        return {
            totalCardGiven: this._cardHistory.length,
            playerCardCounts: playerCardCounts,
            cardRarityDistribution: cardRarityDistribution,
            averageCardsPerPlayer: averageCardsPerPlayer
        };
    }
}