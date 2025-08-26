/**
 * 监狱地块
 * 
 * 限制玩家行动的特殊地块，玩家可能被关押在此
 * 提供多种出狱方式：支付罚金、掷双数、使用越狱卡等
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component } from 'cc';
import { MapTile, TileInteractionResult } from '../core/MapTile';
import { MapTileData, TileType } from '../types/MapTypes';
import { PlayerData, GameEventType, PlayerState } from '../types/GameTypes';

const { ccclass, property } = _decorator;

/**
 * 出狱方式枚举
 */
enum JailExitMethod {
    /** 支付罚金 */
    PAY_FINE = 'pay_fine',
    /** 掷出双数 */
    ROLL_DOUBLES = 'roll_doubles',
    /** 使用越狱卡 */
    USE_CARD = 'use_card',
    /** 服刑期满 */
    SERVE_TIME = 'serve_time',
    /** 被保释 */
    BAIL_OUT = 'bail_out'
}

/**
 * 监狱状态接口
 */
interface JailStatus {
    /** 是否在监狱中 */
    isInJail: boolean;
    /** 入狱时间 */
    jailTime: number;
    /** 剩余刑期（回合数） */
    remainingTurns: number;
    /** 入狱原因 */
    jailReason: string;
    /** 尝试出狱的次数 */
    escapeAttempts: number;
}

/**
 * 监狱地块实现类
 * 提供完整的监狱系统功能
 */
@ccclass('JailTile')
export class JailTile extends MapTile {
    
    // ========================= 编辑器属性 =========================
    
    @property({ displayName: "罚金金额", tooltip: "支付出狱的罚金金额" })
    public bailAmount: number = 50;
    
    @property({ displayName: "最大刑期", tooltip: "最大监禁回合数" })
    public maxJailTurns: number = 3;
    
    @property({ displayName: "允许支付出狱", tooltip: "是否允许玩家支付罚金出狱" })
    public allowPayBail: boolean = true;
    
    @property({ displayName: "允许掷骰出狱", tooltip: "是否允许掷双数出狱" })
    public allowRollEscape: boolean = true;
    
    @property({ displayName: "允许卡片出狱", tooltip: "是否允许使用越狱卡出狱" })
    public allowCardEscape: boolean = true;
    
    @property({ displayName: "严厉模式", tooltip: "严厉模式下更难出狱" })
    public strictMode: boolean = false;
    
    @property({ displayName: "监狱容量", tooltip: "最大可容纳的囚犯数量" })
    public jailCapacity: number = 4;
    
    @property({ displayName: "显示监狱状态", tooltip: "是否显示监狱状态UI" })
    public showJailStatus: boolean = true;
    
    // ========================= 私有属性 =========================
    
    /** 当前囚犯列表 */
    private _prisoners: Map<string, JailStatus> = new Map();
    
    /** 监狱历史记录 */
    private _jailHistory: { 
        playerId: string; 
        action: string; 
        timestamp: number; 
        details: any 
    }[] = [];
    
    /** 监狱事件统计 */
    private _jailStats = {
        totalImprisonments: 0,
        totalEscapes: 0,
        averageJailTime: 0,
        mostCommonEscapeMethod: JailExitMethod.SERVE_TIME
    };
    
    // ========================= 抽象方法实现 =========================
    
    /**
     * 获取地块类型
     */
    public get tileType(): TileType {
        return TileType.JAIL;
    }
    
    /**
     * 地块初始化
     * @param tileData 地块数据
     */
    protected onTileInitialized(tileData: MapTileData): void {
        // 从地块数据中读取监狱配置
        if (tileData.customData) {
            this.bailAmount = tileData.customData.bailAmount || this.bailAmount;
            this.maxJailTurns = tileData.customData.maxJailTurns || this.maxJailTurns;
            this.strictMode = tileData.customData.strictMode || this.strictMode;
        }
        
        // 设置监狱地块的视觉表现
        this.setupJailAppearance();
        
        console.log(`[JailTile] 监狱地块初始化完成: ${this.tileName}, 罚金: ${this.bailAmount}, 最大刑期: ${this.maxJailTurns}`);
    }
    
    /**
     * 玩家停留处理
     * 根据玩家状态处理入狱或探监逻辑
     * @param player 停留的玩家
     */
    protected async onPlayerLandOn(player: PlayerData): Promise<TileInteractionResult> {
        console.log(`[JailTile] 玩家 ${player.nickname} 停留在监狱地块`);
        
        // 检查玩家是否已经在监狱中
        if (player.state === PlayerState.IN_JAIL || this._prisoners.has(player.id)) {
            // 已在监狱中，处理出狱尝试
            return await this.handleJailTurn(player);
        } else {
            // 只是路过监狱，不会被关押（除非是被送进来的）
            return await this.handleJailVisit(player);
        }
    }
    
    /**
     * 玩家经过处理
     * 经过监狱一般不会有特殊效果
     * @param player 经过的玩家
     */
    protected async onPlayerPassThrough(player: PlayerData): Promise<TileInteractionResult> {
        console.log(`[JailTile] 玩家 ${player.nickname} 经过监狱地块`);
        
        return {
            success: true,
            message: `经过 ${this.tileName}，还好没被抓进去！`,
            events: [],
            blockMovement: false
        };
    }
    
    // ========================= 监狱逻辑处理 =========================
    
    /**
     * 处理监狱回合（玩家在监狱中的行动）
     * @param player 在监狱中的玩家
     */
    private async handleJailTurn(player: PlayerData): Promise<TileInteractionResult> {
        const jailStatus = this._prisoners.get(player.id);
        if (!jailStatus) {
            // 数据不一致，重新设置监狱状态
            return await this.imprisonPlayer(player, '数据修复', 1);
        }
        
        console.log(`[JailTile] 处理玩家 ${player.nickname} 的监狱回合，剩余: ${jailStatus.remainingTurns} 回合`);
        
        // 减少剩余刑期
        jailStatus.remainingTurns--;
        
        // 检查是否刑期已满
        if (jailStatus.remainingTurns <= 0) {
            return await this.releasePlayer(player, JailExitMethod.SERVE_TIME);
        }
        
        // 提供出狱选项
        const availableOptions = this.getAvailableEscapeOptions(player);
        
        return {
            success: true,
            message: this.getJailTurnMessage(player, jailStatus, availableOptions),
            needUserInput: availableOptions.length > 0,
            events: [],
            blockMovement: true // 在监狱中无法移动
        };
    }
    
    /**
     * 处理玩家访问监狱（不是囚犯）
     * @param player 访问监狱的玩家
     */
    private async handleJailVisit(player: PlayerData): Promise<TileInteractionResult> {
        const prisonerCount = this._prisoners.size;
        
        let message = `你来到了 ${this.tileName}。`;
        
        if (prisonerCount > 0) {
            const prisonerNames = Array.from(this._prisoners.keys())
                .map(id => this.getPlayerName(id))
                .join('、');
            message += ` 目前关押着 ${prisonerCount} 名囚犯：${prisonerNames}。`;
        } else {
            message += ` 监狱目前没有关押任何人。`;
        }
        
        // 可能的探监或保释选项
        const canBailSomeone = prisonerCount > 0 && player.financialStatus.cash >= this.bailAmount;
        
        return {
            success: true,
            message: message,
            needUserInput: canBailSomeone,
            events: [],
            blockMovement: false
        };
    }
    
    /**
     * 关押玩家
     * @param player 要关押的玩家
     * @param reason 入狱原因
     * @param turns 刑期（回合数）
     */
    public async imprisonPlayer(player: PlayerData, reason: string, turns?: number): Promise<TileInteractionResult> {
        // 检查监狱容量
        if (this._prisoners.size >= this.jailCapacity) {
            return {
                success: false,
                message: `监狱已满，无法关押更多囚犯`,
                events: []
            };
        }
        
        const jailTurns = turns || this.maxJailTurns;
        
        // 创建监狱状态
        const jailStatus: JailStatus = {
            isInJail: true,
            jailTime: Date.now(),
            remainingTurns: jailTurns,
            jailReason: reason,
            escapeAttempts: 0
        };
        
        // 更新玩家状态
        player.state = PlayerState.IN_JAIL;
        player.isInJail = true;
        player.jailTurnsRemaining = jailTurns;
        player.statistics.jailCount++;
        
        // 添加到囚犯列表
        this._prisoners.set(player.id, jailStatus);
        
        // 更新统计
        this._jailStats.totalImprisonments++;
        
        // 记录历史
        this._jailHistory.push({
            playerId: player.id,
            action: 'imprison',
            timestamp: Date.now(),
            details: { reason, turns: jailTurns }
        });
        
        // 触发入狱特效
        if (this.showJailStatus) {
            await this.playImprisonmentEffect(player);
        }
        
        const events = [{
            eventId: `jail_imprison_${Date.now()}`,
            type: GameEventType.TURN_START, // 可以自定义为 JAIL_EVENT
            timestamp: Date.now(),
            turnNumber: 0,
            actorPlayerId: player.id,
            affectedTileId: this.getTileData()?.id,
            parameters: {
                action: 'imprison',
                reason: reason,
                jailTurns: jailTurns
            },
            description: `${player.nickname} 因 ${reason} 被关进监狱 ${jailTurns} 回合`,
            result: { jailStatus: 'imprisoned' }
        }];
        
        console.log(`[JailTile] 玩家 ${player.nickname} 被关押，原因: ${reason}, 刑期: ${jailTurns} 回合`);
        
        return {
            success: true,
            message: `你因 ${reason} 被关进了监狱！刑期 ${jailTurns} 回合。`,
            events: events,
            blockMovement: true
        };
    }
    
    /**
     * 释放玩家
     * @param player 要释放的玩家
     * @param method 出狱方式
     */
    public async releasePlayer(player: PlayerData, method: JailExitMethod): Promise<TileInteractionResult> {
        const jailStatus = this._prisoners.get(player.id);
        if (!jailStatus) {
            return {
                success: false,
                message: '玩家不在监狱中',
                events: []
            };
        }
        
        // 计算监禁时长
        const jailDuration = Date.now() - jailStatus.jailTime;
        
        // 更新玩家状态
        player.state = PlayerState.WAITING;
        player.isInJail = false;
        player.jailTurnsRemaining = 0;
        
        // 从囚犯列表中移除
        this._prisoners.delete(player.id);
        
        // 更新统计
        this._jailStats.totalEscapes++;
        this._jailStats.averageJailTime = 
            (this._jailStats.averageJailTime * (this._jailStats.totalEscapes - 1) + jailDuration) / 
            this._jailStats.totalEscapes;
        
        // 记录历史
        this._jailHistory.push({
            playerId: player.id,
            action: 'release',
            timestamp: Date.now(),
            details: { method, duration: jailDuration }
        });
        
        // 根据出狱方式处理不同的后果
        let message = '';
        let moneyChange = 0;
        
        switch (method) {
            case JailExitMethod.PAY_FINE:
                if (player.financialStatus.cash >= this.bailAmount) {
                    player.financialStatus.cash -= this.bailAmount;
                    player.financialStatus.expenses.other += this.bailAmount;
                    moneyChange = -this.bailAmount;
                    message = `支付 ${this.bailAmount} 金币罚金后获释！`;
                } else {
                    return {
                        success: false,
                        message: `罚金不足！需要 ${this.bailAmount} 金币`,
                        events: []
                    };
                }
                break;
            
            case JailExitMethod.ROLL_DOUBLES:
                message = '恭喜！掷出双数，成功越狱！';
                break;
            
            case JailExitMethod.USE_CARD:
                message = '使用越狱卡成功脱身！';
                // TODO: 消耗越狱卡
                break;
            
            case JailExitMethod.SERVE_TIME:
                message = '刑期已满，恢复自由！';
                break;
            
            case JailExitMethod.BAIL_OUT:
                message = '有人为你支付了保释金，你自由了！';
                break;
            
            default:
                message = '以未知方式获得了自由。';
                break;
        }
        
        // 播放释放特效
        if (this.showJailStatus) {
            await this.playReleaseEffect(player, method);
        }
        
        const events = [{
            eventId: `jail_release_${Date.now()}`,
            type: GameEventType.TURN_START,
            timestamp: Date.now(),
            turnNumber: 0,
            actorPlayerId: player.id,
            affectedTileId: this.getTileData()?.id,
            parameters: {
                action: 'release',
                method: method,
                duration: jailDuration
            },
            description: `${player.nickname} 通过 ${method} 出狱`,
            result: { jailStatus: 'released' }
        }];
        
        console.log(`[JailTile] 玩家 ${player.nickname} 出狱，方式: ${method}`);
        
        return {
            success: true,
            message: message,
            events: events,
            moneyChange: moneyChange,
            blockMovement: false
        };
    }
    
    // ========================= 辅助方法 =========================
    
    /**
     * 获取可用的出狱选项
     * @param player 玩家
     */
    private getAvailableEscapeOptions(player: PlayerData): JailExitMethod[] {
        const options: JailExitMethod[] = [];
        
        // 支付罚金
        if (this.allowPayBail && player.financialStatus.cash >= this.bailAmount) {
            options.push(JailExitMethod.PAY_FINE);
        }
        
        // 掷骰子（如果允许且还有机会）
        const jailStatus = this._prisoners.get(player.id);
        if (this.allowRollEscape && jailStatus && jailStatus.escapeAttempts < this.maxJailTurns) {
            options.push(JailExitMethod.ROLL_DOUBLES);
        }
        
        // 使用卡片
        if (this.allowCardEscape && this.hasEscapeCard(player)) {
            options.push(JailExitMethod.USE_CARD);
        }
        
        return options;
    }
    
    /**
     * 检查玩家是否有越狱卡
     * @param player 玩家
     */
    private hasEscapeCard(player: PlayerData): boolean {
        // TODO: 检查玩家手牌中是否有越狱类型的卡片
        // 这里需要与卡片系统集成
        return player.hand.cards.some(card => 
            card.cardId.includes('escape') || 
            card.cardId.includes('jail') ||
            card.cardId.includes('teleport')
        );
    }
    
    /**
     * 生成监狱回合消息
     */
    private getJailTurnMessage(player: PlayerData, jailStatus: JailStatus, options: JailExitMethod[]): string {
        let message = `你在监狱中度过了一个回合。剩余刑期：${jailStatus.remainingTurns} 回合。`;
        
        if (options.length > 0) {
            message += ` 出狱选项：`;
            
            const optionMessages: string[] = [];
            
            if (options.includes(JailExitMethod.PAY_FINE)) {
                optionMessages.push(`支付 ${this.bailAmount} 金币罚金`);
            }
            
            if (options.includes(JailExitMethod.ROLL_DOUBLES)) {
                optionMessages.push('尝试掷双数');
            }
            
            if (options.includes(JailExitMethod.USE_CARD)) {
                optionMessages.push('使用越狱卡');
            }
            
            message += optionMessages.join('、');
        } else {
            message += ` 目前没有出狱选项，只能等待刑期结束。`;
        }
        
        return message;
    }
    
    /**
     * 获取玩家名称（用于显示）
     */
    private getPlayerName(playerId: string): string {
        // TODO: 通过GameManager获取玩家昵称
        return `玩家${playerId}`;
    }
    
    /**
     * 设置监狱外观
     */
    private setupJailAppearance(): void {
        // 监狱地块使用深灰色
        this.baseColor.set(80, 80, 80, 255);
        this.highlightColor.set(120, 120, 120, 255);
        
        // TODO: 可以添加监狱相关的3D装饰
        // 比如铁栅栏、围墙等
    }
    
    // ========================= 特效方法 =========================
    
    /**
     * 播放入狱特效
     */
    private async playImprisonmentEffect(player: PlayerData): Promise<void> {
        console.log(`[JailTile] 播放入狱特效: ${player.nickname}`);
        
        // TODO: 实现入狱特效
        // 1. 暗化屏幕
        // 2. 播放监狱门关闭音效
        // 3. 显示入狱动画
        
        return new Promise((resolve) => {
            this.scheduleOnce(() => {
                resolve();
            }, 1.5);
        });
    }
    
    /**
     * 播放出狱特效
     */
    private async playReleaseEffect(player: PlayerData, method: JailExitMethod): Promise<void> {
        console.log(`[JailTile] 播放出狱特效: ${player.nickname}, 方式: ${method}`);
        
        // TODO: 实现出狱特效
        // 根据不同的出狱方式播放不同的特效
        
        return new Promise((resolve) => {
            this.scheduleOnce(() => {
                resolve();
            }, 1.0);
        });
    }
    
    // ========================= 公共方法 =========================
    
    /**
     * 检查玩家是否在监狱中
     * @param playerId 玩家ID
     */
    public isPlayerInJail(playerId: string): boolean {
        return this._prisoners.has(playerId);
    }
    
    /**
     * 获取监狱状态
     * @param playerId 玩家ID
     */
    public getJailStatus(playerId: string): JailStatus | null {
        return this._prisoners.get(playerId) || null;
    }
    
    /**
     * 获取所有囚犯列表
     */
    public getPrisoners(): string[] {
        return Array.from(this._prisoners.keys());
    }
    
    /**
     * 获取监狱统计
     */
    public getJailStats(): {
        currentPrisoners: number;
        capacity: number;
        totalImprisonments: number;
        totalReleases: number;
        averageJailTime: number;
    } {
        return {
            currentPrisoners: this._prisoners.size,
            capacity: this.jailCapacity,
            totalImprisonments: this._jailStats.totalImprisonments,
            totalReleases: this._jailStats.totalEscapes,
            averageJailTime: this._jailStats.averageJailTime
        };
    }
    
    /**
     * 清空监狱
     * 释放所有囚犯（调试用）
     */
    public clearJail(): void {
        this._prisoners.forEach((_, playerId) => {
            // TODO: 需要获取玩家对象来更新状态
            console.log(`[JailTile] 强制释放囚犯: ${playerId}`);
        });
        
        this._prisoners.clear();
        console.log('[JailTile] 监狱已清空');
    }
    
    /**
     * 设置监狱配置
     */
    public setJailConfig(config: {
        bailAmount?: number;
        maxJailTurns?: number;
        jailCapacity?: number;
        strictMode?: boolean;
    }): void {
        if (config.bailAmount !== undefined) this.bailAmount = config.bailAmount;
        if (config.maxJailTurns !== undefined) this.maxJailTurns = config.maxJailTurns;
        if (config.jailCapacity !== undefined) this.jailCapacity = config.jailCapacity;
        if (config.strictMode !== undefined) this.strictMode = config.strictMode;
        
        console.log('[JailTile] 监狱配置已更新', config);
    }
    
    /**
     * 获取监狱历史记录
     */
    public getJailHistory(): typeof this._jailHistory {
        return [...this._jailHistory];
    }
}