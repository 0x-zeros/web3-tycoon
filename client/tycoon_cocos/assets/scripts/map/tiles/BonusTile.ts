/**
 * 奖励地块
 * 
 * 玩家停留时获得固定奖励的安全地块
 * 实现大富翁10,11风格的简化奖励机制
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component } from 'cc';
import { MapTile, TileInteractionResult } from '../core/MapTile';
import { MapTileData, TileType, FreeParkingData } from '../types/MapTypes';
import { PlayerData, GameEventType } from '../types/GameTypes';

const { ccclass, property } = _decorator;

/**
 * 奖励地块实现类
 * 提供固定金额奖励的安全地块功能
 */
@ccclass('BonusTile')
export class BonusTile extends MapTile {
    
    // ========================= 编辑器属性 =========================
    
    @property({ displayName: "奖励金额", tooltip: "玩家停留时获得的固定奖励金额" })
    public bonusAmount: number = 200;
    
    @property({ displayName: "显示奖励动画", tooltip: "是否显示获得奖励的动画" })
    public showBonusAnimation: boolean = true;
    
    @property({ displayName: "奖励音效", tooltip: "获得奖励时播放的音效" })
    public bonusAudioName: string = 'bonus_reward';
    
    // ========================= 私有属性 =========================
    
    /** 奖励配置数据 */
    private _bonusConfig: FreeParkingData | null = null;
    
    /** 奖励发放历史 */
    private _bonusHistory: { playerId: string; amount: number; timestamp: number }[] = [];
    
    // ========================= 抽象方法实现 =========================
    
    /**
     * 获取地块类型
     */
    public get tileType(): TileType {
        return TileType.FREE_PARKING;
    }
    
    /**
     * 地块初始化
     * @param tileData 地块数据
     */
    protected onTileInitialized(tileData: MapTileData): void {
        // 从地块数据中读取配置
        if (tileData.freeParkingData) {
            this._bonusConfig = tileData.freeParkingData;
            this.bonusAmount = this._bonusConfig.bonusAmount;
        } else {
            // 使用默认配置
            this._bonusConfig = {
                bonusAmount: this.bonusAmount,
                description: `停留时获得${this.bonusAmount}游戏币奖励`,
                welcomeMessage: `恭喜！获得${this.bonusAmount}游戏币奖励！`
            };
        }
        
        console.log(`[BonusTile] 奖励地块初始化完成: ${this.tileName}, 奖励金额: ${this.bonusAmount}`);
    }
    
    /**
     * 玩家停留处理
     * 给予玩家固定的金钱奖励
     * @param player 停留的玩家
     */
    protected async onPlayerLandOn(player: PlayerData): Promise<TileInteractionResult> {
        if (!this._bonusConfig) {
            return {
                success: false,
                message: '奖励地块配置错误',
                events: []
            };
        }
        
        console.log(`[BonusTile] 玩家 ${player.nickname} 停留在奖励地块 ${this.tileName}`);
        
        // 播放特效动画
        if (this.showBonusAnimation) {
            await this.playBonusAnimation();
        }
        
        // 给予奖励
        const bonusAmount = this._bonusConfig.bonusAmount;
        player.financialStatus.cash += bonusAmount;
        player.financialStatus.income.other += bonusAmount;
        
        // 记录历史
        this._bonusHistory.push({
            playerId: player.id,
            amount: bonusAmount,
            timestamp: Date.now()
        });
        
        // 创建游戏事件
        const gameEvent = {
            eventId: `bonus_reward_${Date.now()}`,
            type: GameEventType.TURN_START, // 可以自定义为 BONUS_REWARD
            timestamp: Date.now(),
            turnNumber: 0,
            actorPlayerId: player.id,
            affectedTileId: this.getTileData()?.id,
            parameters: {
                bonusAmount: bonusAmount,
                bonusType: 'tile_bonus'
            },
            description: `${player.nickname} 在奖励地块获得 ${bonusAmount} 游戏币奖励`,
            result: { 
                newBalance: player.financialStatus.cash,
                bonusReceived: bonusAmount
            }
        };
        
        return {
            success: true,
            message: this._bonusConfig.welcomeMessage,
            events: [gameEvent],
            moneyChange: bonusAmount,
            blockMovement: false
        };
    }
    
    /**
     * 玩家经过处理
     * 奖励地块只在停留时给奖励，经过时无效果
     * @param player 经过的玩家
     */
    protected async onPlayerPassBy(player: PlayerData): Promise<TileInteractionResult> {
        return {
            success: true,
            message: '',
            events: [],
            blockMovement: false
        };
    }
    
    // ========================= 特效和动画 =========================
    
    /**
     * 播放奖励获得动画
     */
    private async playBonusAnimation(): Promise<void> {
        console.log('[BonusTile] 播放奖励获得动画');
        
        // TODO: 实现奖励获得的特效动画
        // 可以包括：
        // 1. 金币飞出动画
        // 2. 闪光特效
        // 3. 音效播放
        // 4. UI提示动画
        
        return new Promise((resolve) => {
            this.scheduleOnce(() => {
                resolve();
            }, 1.2); // 动画持续1.2秒
        });
    }
    
    // ========================= 公共方法 =========================
    
    /**
     * 获取奖励发放历史
     * @param playerId 可选的玩家ID筛选
     */
    public getBonusHistory(playerId?: string): { playerId: string; amount: number; timestamp: number }[] {
        if (playerId) {
            return this._bonusHistory.filter(record => record.playerId === playerId);
        }
        return [...this._bonusHistory];
    }
    
    /**
     * 清除奖励历史
     */
    public clearBonusHistory(): void {
        this._bonusHistory = [];
        console.log('[BonusTile] 奖励历史已清除');
    }
    
    /**
     * 获取奖励配置
     */
    public getBonusConfig(): FreeParkingData | null {
        return this._bonusConfig;
    }
    
    /**
     * 更新奖励配置
     * @param config 新的配置
     */
    public updateBonusConfig(config: Partial<FreeParkingData>): void {
        if (!this._bonusConfig) {
            return;
        }
        
        this._bonusConfig = { ...this._bonusConfig, ...config };
        
        // 更新组件属性
        if (config.bonusAmount !== undefined) {
            this.bonusAmount = config.bonusAmount;
        }
        
        console.log('[BonusTile] 奖励配置已更新', this._bonusConfig);
    }
    
    /**
     * 获取地块统计信息
     */
    public getBonusStats(): {
        totalBonusGiven: number;
        totalBonusAmount: number;
        playerBonusCounts: { [playerId: string]: number };
        playerBonusAmounts: { [playerId: string]: number };
        averageBonusPerPlayer: number;
    } {
        const playerBonusCounts: { [playerId: string]: number } = {};
        const playerBonusAmounts: { [playerId: string]: number } = {};
        let totalBonusAmount = 0;
        
        this._bonusHistory.forEach(record => {
            // 统计玩家获得次数
            playerBonusCounts[record.playerId] = (playerBonusCounts[record.playerId] || 0) + 1;
            
            // 统计玩家获得总额
            playerBonusAmounts[record.playerId] = (playerBonusAmounts[record.playerId] || 0) + record.amount;
            
            // 累计总额
            totalBonusAmount += record.amount;
        });
        
        const totalPlayers = Object.keys(playerBonusCounts).length;
        const averageBonusPerPlayer = totalPlayers > 0 ? totalBonusAmount / totalPlayers : 0;
        
        return {
            totalBonusGiven: this._bonusHistory.length,
            totalBonusAmount: totalBonusAmount,
            playerBonusCounts: playerBonusCounts,
            playerBonusAmounts: playerBonusAmounts,
            averageBonusPerPlayer: averageBonusPerPlayer
        };
    }
}