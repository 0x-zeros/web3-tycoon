/**
 * 机会地块
 * 
 * 触发随机事件的特殊地块，玩家停留时可能获得卡片、金钱或其他特殊效果
 * 为游戏增加随机性和策略深度的重要地块类型
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component } from 'cc';
import { MapTile, TileInteractionResult } from '../core/MapTile';
import { MapTileData, TileType } from '../types/MapTypes';
import { PlayerData, GameEventType } from '../types/GameTypes';
import { CardType, MVP_CARDS } from '../types/CardTypes';

const { ccclass, property } = _decorator;

/**
 * 机会事件类型枚举
 */
enum ChanceEventType {
    /** 获得金钱 */
    GAIN_MONEY = 'gain_money',
    /** 失去金钱 */
    LOSE_MONEY = 'lose_money',
    /** 获得卡片 */
    GAIN_CARD = 'gain_card',
    /** 移动到指定位置 */
    MOVE_TO = 'move_to',
    /** 获得免费建筑 */
    FREE_BUILDING = 'free_building',
    /** 免费经过起点 */
    FREE_START_PASS = 'free_start_pass',
    /** 随机传送 */
    RANDOM_TELEPORT = 'random_teleport'
}

/**
 * 机会事件配置接口
 */
interface ChanceEvent {
    /** 事件ID */
    id: string;
    /** 事件类型 */
    type: ChanceEventType;
    /** 事件名称 */
    name: string;
    /** 事件描述 */
    description: string;
    /** 触发权重（影响随机概率） */
    weight: number;
    /** 事件参数 */
    parameters: { [key: string]: any };
    /** 是否是正面事件 */
    isPositive: boolean;
}

/**
 * 机会地块实现类
 * 提供随机事件触发和卡片获得功能
 */
@ccclass('ChanceTile')
export class ChanceTile extends MapTile {
    
    // ========================= 编辑器属性 =========================
    
    @property({ displayName: "卡片获得概率", range: [0, 1], tooltip: "玩家停留时获得卡片的概率" })
    public cardDropRate: number = 0.3;
    
    @property({ displayName: "金钱事件概率", range: [0, 1], tooltip: "触发金钱相关事件的概率" })
    public moneyEventRate: number = 0.5;
    
    @property({ displayName: "特殊事件概率", range: [0, 1], tooltip: "触发特殊事件的概率" })
    public specialEventRate: number = 0.2;
    
    @property({ displayName: "显示事件动画", tooltip: "是否显示事件触发动画" })
    public showEventAnimation: boolean = true;
    
    @property({ displayName: "事件音效", tooltip: "触发事件时播放的音效" })
    public eventAudioName: string = 'chance_event';
    
    // ========================= 私有属性 =========================
    
    /** 机会事件列表 */
    private _chanceEvents: ChanceEvent[] = [];
    
    /** 事件触发历史 */
    private _eventHistory: { playerId: string; eventId: string; timestamp: number }[] = [];
    
    // ========================= 抽象方法实现 =========================
    
    /**
     * 获取地块类型
     */
    public get tileType(): TileType {
        return TileType.CHANCE;
    }
    
    /**
     * 地块初始化
     * @param tileData 地块数据
     */
    protected onTileInitialized(tileData: MapTileData): void {
        // 初始化机会事件列表
        this.initializeChanceEvents();
        
        // 从地块数据中读取事件权重配置
        if (tileData.eventWeight) {
            this.adjustEventWeights(tileData.eventWeight);
        }
        
        console.log(`[ChanceTile] 机会地块初始化完成: ${this.tileName}, 事件数量: ${this._chanceEvents.length}`);
    }
    
    /**
     * 玩家停留处理
     * 触发随机机会事件
     * @param player 停留的玩家
     */
    protected async onPlayerLandOn(player: PlayerData): Promise<TileInteractionResult> {
        console.log(`[ChanceTile] 玩家 ${player.nickname} 停留在机会地块 ${this.tileName}`);
        
        // 播放特效动画
        if (this.showEventAnimation) {
            await this.playChanceAnimation();
        }
        
        // 随机选择事件
        const selectedEvent = this.selectRandomEvent();
        if (!selectedEvent) {
            return {
                success: false,
                message: '机会事件配置错误',
                events: []
            };
        }
        
        // 执行事件
        const result = await this.executeChanceEvent(player, selectedEvent);
        
        // 记录事件历史
        this._eventHistory.push({
            playerId: player.id,
            eventId: selectedEvent.id,
            timestamp: Date.now()
        });
        
        return result;
    }
    
    // ========================= 事件系统 =========================
    
    /**
     * 初始化机会事件列表
     */
    private initializeChanceEvents(): void {
        this._chanceEvents = [
            // 金钱类事件
            {
                id: 'gain_money_small',
                type: ChanceEventType.GAIN_MONEY,
                name: '意外收获',
                description: '你在路上发现了一些金钱',
                weight: 15,
                parameters: { amount: 50 },
                isPositive: true
            },
            {
                id: 'gain_money_medium',
                type: ChanceEventType.GAIN_MONEY,
                name: '投资回报',
                description: '你的投资获得了不错的回报',
                weight: 10,
                parameters: { amount: 100 },
                isPositive: true
            },
            {
                id: 'lose_money_small',
                type: ChanceEventType.LOSE_MONEY,
                name: '意外支出',
                description: '你需要支付一笔意外的费用',
                weight: 12,
                parameters: { amount: 30 },
                isPositive: false
            },
            {
                id: 'lose_money_tax',
                type: ChanceEventType.LOSE_MONEY,
                name: '税务检查',
                description: '税务部门要求你补缴税款',
                weight: 8,
                parameters: { amount: 80 },
                isPositive: false
            },
            
            // 卡片类事件
            {
                id: 'gain_card_common',
                type: ChanceEventType.GAIN_CARD,
                name: '神秘礼物',
                description: '你获得了一张神秘卡片',
                weight: 20,
                parameters: { cardRarity: 'common' },
                isPositive: true
            },
            {
                id: 'gain_card_rare',
                type: ChanceEventType.GAIN_CARD,
                name: '稀有发现',
                description: '你获得了一张稀有卡片',
                weight: 5,
                parameters: { cardRarity: 'rare' },
                isPositive: true
            },
            
            // 移动类事件
            {
                id: 'move_to_start',
                type: ChanceEventType.MOVE_TO,
                name: '回到起点',
                description: '直接移动到起点，获得薪水',
                weight: 10,
                parameters: { targetType: 'start' },
                isPositive: true
            },
            {
                id: 'random_teleport',
                type: ChanceEventType.RANDOM_TELEPORT,
                name: '随机传送',
                description: '被随机传送到地图上的某个位置',
                weight: 8,
                parameters: {},
                isPositive: true // 可能是正面也可能是负面
            },
            
            // 特殊事件
            {
                id: 'free_start_pass',
                type: ChanceEventType.FREE_START_PASS,
                name: '快速通道',
                description: '下次经过起点时获得双倍薪水',
                weight: 7,
                parameters: { multiplier: 2 },
                isPositive: true
            }
        ];
    }
    
    /**
     * 调整事件权重
     * @param weightMultiplier 权重倍数
     */
    private adjustEventWeights(weightMultiplier: number): void {
        this._chanceEvents.forEach(event => {
            event.weight = Math.floor(event.weight * weightMultiplier);
        });
    }
    
    /**
     * 随机选择事件
     */
    private selectRandomEvent(): ChanceEvent | null {
        if (this._chanceEvents.length === 0) {
            return null;
        }
        
        // 计算总权重
        const totalWeight = this._chanceEvents.reduce((sum, event) => sum + event.weight, 0);
        if (totalWeight === 0) {
            return null;
        }
        
        // 随机选择
        let randomValue = Math.random() * totalWeight;
        
        for (const event of this._chanceEvents) {
            randomValue -= event.weight;
            if (randomValue <= 0) {
                return event;
            }
        }
        
        // 备选：返回第一个事件
        return this._chanceEvents[0];
    }
    
    /**
     * 执行机会事件
     * @param player 触发事件的玩家
     * @param event 要执行的事件
     */
    private async executeChanceEvent(player: PlayerData, event: ChanceEvent): Promise<TileInteractionResult> {
        console.log(`[ChanceTile] 执行机会事件: ${event.name}`);
        
        switch (event.type) {
            case ChanceEventType.GAIN_MONEY:
                return await this.handleGainMoneyEvent(player, event);
            
            case ChanceEventType.LOSE_MONEY:
                return await this.handleLoseMoneyEvent(player, event);
            
            case ChanceEventType.GAIN_CARD:
                return await this.handleGainCardEvent(player, event);
            
            case ChanceEventType.MOVE_TO:
                return await this.handleMoveToEvent(player, event);
            
            case ChanceEventType.RANDOM_TELEPORT:
                return await this.handleRandomTeleportEvent(player, event);
            
            case ChanceEventType.FREE_START_PASS:
                return await this.handleFreeStartPassEvent(player, event);
            
            default:
                return {
                    success: false,
                    message: `未知的事件类型: ${event.type}`,
                    events: []
                };
        }
    }
    
    // ========================= 事件处理方法 =========================
    
    /**
     * 处理获得金钱事件
     */
    private async handleGainMoneyEvent(player: PlayerData, event: ChanceEvent): Promise<TileInteractionResult> {
        const amount = event.parameters.amount || 50;
        
        player.financialStatus.cash += amount;
        player.financialStatus.income.other += amount;
        
        const gameEvent = {
            eventId: `chance_gain_money_${Date.now()}`,
            type: GameEventType.TURN_START, // 可以自定义为 CHANCE_EVENT
            timestamp: Date.now(),
            turnNumber: 0,
            actorPlayerId: player.id,
            affectedTileId: this.getTileData()?.id,
            parameters: {
                eventType: event.type,
                eventName: event.name,
                amount: amount
            },
            description: `${player.nickname} ${event.description}，获得 ${amount} 金币`,
            result: { newBalance: player.financialStatus.cash }
        };
        
        return {
            success: true,
            message: `${event.name}！${event.description}，获得 ${amount} 金币！`,
            events: [gameEvent],
            moneyChange: amount,
            blockMovement: false
        };
    }
    
    /**
     * 处理失去金钱事件
     */
    private async handleLoseMoneyEvent(player: PlayerData, event: ChanceEvent): Promise<TileInteractionResult> {
        const amount = event.parameters.amount || 30;
        const actualAmount = Math.min(amount, player.financialStatus.cash);
        
        player.financialStatus.cash -= actualAmount;
        player.financialStatus.expenses.other += actualAmount;
        
        const gameEvent = {
            eventId: `chance_lose_money_${Date.now()}`,
            type: GameEventType.TURN_START,
            timestamp: Date.now(),
            turnNumber: 0,
            actorPlayerId: player.id,
            affectedTileId: this.getTileData()?.id,
            parameters: {
                eventType: event.type,
                eventName: event.name,
                amount: actualAmount
            },
            description: `${player.nickname} ${event.description}，失去 ${actualAmount} 金币`,
            result: { newBalance: player.financialStatus.cash }
        };
        
        return {
            success: true,
            message: `${event.name}！${event.description}，失去 ${actualAmount} 金币。`,
            events: [gameEvent],
            moneyChange: -actualAmount,
            blockMovement: false
        };
    }
    
    /**
     * 处理获得卡片事件
     */
    private async handleGainCardEvent(player: PlayerData, event: ChanceEvent): Promise<TileInteractionResult> {
        // 检查手牌是否已满
        if (player.hand.cards.length >= player.hand.maxHandSize) {
            return {
                success: false,
                message: '手牌已满，无法获得新卡片',
                events: [],
                blockMovement: false
            };
        }
        
        // 根据稀有度随机选择卡片
        const cardRarity = event.parameters.cardRarity || 'common';
        const availableCards = MVP_CARDS.filter(card => 
            card.rarity.toString().toLowerCase() === cardRarity.toLowerCase()
        );
        
        if (availableCards.length === 0) {
            return {
                success: false,
                message: '没有可用的卡片',
                events: [],
                blockMovement: false
            };
        }
        
        // 随机选择一张卡片
        const selectedCard = availableCards[Math.floor(Math.random() * availableCards.length)];
        
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
        
        const gameEvent = {
            eventId: `chance_gain_card_${Date.now()}`,
            type: GameEventType.CARD_ACQUISITION,
            timestamp: Date.now(),
            turnNumber: 0,
            actorPlayerId: player.id,
            affectedTileId: this.getTileData()?.id,
            parameters: {
                eventType: event.type,
                eventName: event.name,
                cardId: selectedCard.id,
                cardName: selectedCard.name
            },
            description: `${player.nickname} ${event.description}，获得卡片：${selectedCard.name}`,
            result: { cardCount: player.hand.cards.length }
        };
        
        return {
            success: true,
            message: `${event.name}！${event.description}，获得卡片：${selectedCard.name}！`,
            events: [gameEvent],
            blockMovement: false
        };
    }
    
    /**
     * 处理移动到指定位置事件
     */
    private async handleMoveToEvent(player: PlayerData, event: ChanceEvent): Promise<TileInteractionResult> {
        const targetType = event.parameters.targetType;
        
        // TODO: 这里需要通过Map组件执行实际的移动
        // 当前只是记录事件，实际移动需要在上层处理
        
        const gameEvent = {
            eventId: `chance_move_to_${Date.now()}`,
            type: GameEventType.PLAYER_MOVE,
            timestamp: Date.now(),
            turnNumber: 0,
            actorPlayerId: player.id,
            affectedTileId: this.getTileData()?.id,
            parameters: {
                eventType: event.type,
                eventName: event.name,
                targetType: targetType,
                needMovement: true
            },
            description: `${player.nickname} ${event.description}`,
            result: { movementRequired: true }
        };
        
        return {
            success: true,
            message: `${event.name}！${event.description}！`,
            events: [gameEvent],
            blockMovement: true // 需要等待移动完成
        };
    }
    
    /**
     * 处理随机传送事件
     */
    private async handleRandomTeleportEvent(player: PlayerData, event: ChanceEvent): Promise<TileInteractionResult> {
        // TODO: 随机选择一个地块进行传送
        
        const gameEvent = {
            eventId: `chance_teleport_${Date.now()}`,
            type: GameEventType.PLAYER_MOVE,
            timestamp: Date.now(),
            turnNumber: 0,
            actorPlayerId: player.id,
            affectedTileId: this.getTileData()?.id,
            parameters: {
                eventType: event.type,
                eventName: event.name,
                isRandomTeleport: true
            },
            description: `${player.nickname} ${event.description}`,
            result: { teleportRequired: true }
        };
        
        return {
            success: true,
            message: `${event.name}！${event.description}！`,
            events: [gameEvent],
            blockMovement: true
        };
    }
    
    /**
     * 处理免费经过起点事件
     */
    private async handleFreeStartPassEvent(player: PlayerData, event: ChanceEvent): Promise<TileInteractionResult> {
        const multiplier = event.parameters.multiplier || 2;
        
        // 添加状态效果
        const statusEffect = {
            effectId: `free_start_pass_${Date.now()}`,
            type: 'double_salary',
            name: '双倍薪水',
            description: `下次经过起点时获得 ${multiplier} 倍薪水`,
            remainingTurns: -1, // 永久直到触发
            parameters: { multiplier: multiplier },
            source: 'chance_event',
            iconPath: 'icons/double_salary'
        };
        
        player.statusEffects.push(statusEffect);
        
        const gameEvent = {
            eventId: `chance_free_start_${Date.now()}`,
            type: GameEventType.TURN_START,
            timestamp: Date.now(),
            turnNumber: 0,
            actorPlayerId: player.id,
            affectedTileId: this.getTileData()?.id,
            parameters: {
                eventType: event.type,
                eventName: event.name,
                statusEffectId: statusEffect.effectId
            },
            description: `${player.nickname} ${event.description}`,
            result: { statusAdded: statusEffect.type }
        };
        
        return {
            success: true,
            message: `${event.name}！${event.description}！`,
            events: [gameEvent],
            blockMovement: false
        };
    }
    
    // ========================= 特效和动画 =========================
    
    /**
     * 播放机会动画
     */
    private async playChanceAnimation(): Promise<void> {
        console.log('[ChanceTile] 播放机会事件动画');
        
        // TODO: 实现机会事件的特效动画
        // 可以包括：
        // 1. 卡片翻转动画
        // 2. 光效特效
        // 3. 音效播放
        // 4. UI提示动画
        
        return new Promise((resolve) => {
            this.scheduleOnce(() => {
                resolve();
            }, 1.0); // 动画持续1秒
        });
    }
    
    // ========================= 公共方法 =========================
    
    /**
     * 获取事件历史
     * @param playerId 可选的玩家ID筛选
     */
    public getEventHistory(playerId?: string): { playerId: string; eventId: string; timestamp: number }[] {
        if (playerId) {
            return this._eventHistory.filter(record => record.playerId === playerId);
        }
        return [...this._eventHistory];
    }
    
    /**
     * 清除事件历史
     */
    public clearEventHistory(): void {
        this._eventHistory = [];
        console.log('[ChanceTile] 事件历史已清除');
    }
    
    /**
     * 获取可用事件列表
     */
    public getAvailableEvents(): ChanceEvent[] {
        return [...this._chanceEvents];
    }
    
    /**
     * 添加自定义事件
     * @param event 自定义事件
     */
    public addCustomEvent(event: ChanceEvent): void {
        this._chanceEvents.push(event);
        console.log(`[ChanceTile] 添加自定义事件: ${event.name}`);
    }
    
    /**
     * 获取地块统计信息
     */
    public getChanceStats(): {
        totalEvents: number;
        totalTriggers: number;
        positiveEventCount: number;
        negativeEventCount: number;
        playerTriggerCounts: { [playerId: string]: number };
    } {
        const playerTriggerCounts: { [playerId: string]: number } = {};
        
        this._eventHistory.forEach(record => {
            playerTriggerCounts[record.playerId] = (playerTriggerCounts[record.playerId] || 0) + 1;
        });
        
        return {
            totalEvents: this._chanceEvents.length,
            totalTriggers: this._eventHistory.length,
            positiveEventCount: this._chanceEvents.filter(e => e.isPositive).length,
            negativeEventCount: this._chanceEvents.filter(e => !e.isPositive).length,
            playerTriggerCounts: playerTriggerCounts
        };
    }
}