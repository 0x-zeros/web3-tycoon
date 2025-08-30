/**
 * 费用地块
 * 
 * 玩家停留时需要缴纳固定费用的地块
 * 实现大富翁10,11风格的简化费用机制
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component } from 'cc';
import { MapTile, TileInteractionResult } from '../core/MapTile';
import { MapTileData, TileType, TaxData } from '../types/MapTypes';
import { PlayerData, GameEventType } from '../types/GameTypes';

const { ccclass, property } = _decorator;

/**
 * 费用地块实现类
 * 提供固定金额费用征收功能
 */
@ccclass('FeeTile')
export class FeeTile extends MapTile {
    
    // ========================= 编辑器属性 =========================
    
    @property({ displayName: "费用金额", tooltip: "玩家停留时需要缴纳的固定费用" })
    public feeAmount: number = 200;
    
    @property({ displayName: "费用类型", type: cc.Enum({ fixed: 0, percentage: 1 }), tooltip: "费用计算方式" })
    public feeType: number = 0; // 0: fixed, 1: percentage
    
    @property({ displayName: "显示费用动画", tooltip: "是否显示缴纳费用的动画" })
    public showFeeAnimation: boolean = true;
    
    @property({ displayName: "费用音效", tooltip: "缴纳费用时播放的音效" })
    public feeAudioName: string = 'fee_payment';
    
    // ========================= 私有属性 =========================
    
    /** 费用配置数据 */
    private _feeConfig: TaxData | null = null;
    
    /** 费用征收历史 */
    private _feeHistory: { playerId: string; amount: number; timestamp: number }[] = [];
    
    // ========================= 抽象方法实现 =========================
    
    /**
     * 获取地块类型
     */
    public get tileType(): TileType {
        return TileType.TAX;
    }
    
    /**
     * 地块初始化
     * @param tileData 地块数据
     */
    protected onTileInitialized(tileData: MapTileData): void {
        // 从地块数据中读取配置
        if (tileData.taxData) {
            this._feeConfig = tileData.taxData;
            this.feeAmount = this._feeConfig.amount;
            this.feeType = this._feeConfig.type === 'fixed' ? 0 : 1;
        } else {
            // 使用默认配置
            this._feeConfig = {
                amount: this.feeAmount,
                type: this.feeType === 0 ? 'fixed' : 'percentage',
                taxName: '费用'
            };
        }
        
        console.log(`[FeeTile] 费用地块初始化完成: ${this.tileName}, 费用: ${this.feeAmount}, 类型: ${this._feeConfig.type}`);
    }
    
    /**
     * 玩家停留处理
     * 征收玩家的费用
     * @param player 停留的玩家
     */
    protected async onPlayerLandOn(player: PlayerData): Promise<TileInteractionResult> {
        if (!this._feeConfig) {
            return {
                success: false,
                message: '费用地块配置错误',
                events: []
            };
        }
        
        console.log(`[FeeTile] 玩家 ${player.nickname} 停留在费用地块 ${this.tileName}`);
        
        // 计算费用金额
        let feeAmount = 0;
        if (this._feeConfig.type === 'fixed') {
            feeAmount = this._feeConfig.amount;
        } else {
            // 按比例征收（基于现金）
            feeAmount = Math.floor(player.financialStatus.cash * (this._feeConfig.amount / 100));
        }
        
        // 确保不会征收超过玩家现金的费用
        const actualFeeAmount = Math.min(feeAmount, player.financialStatus.cash);
        
        // 播放特效动画
        if (this.showFeeAnimation) {
            await this.playFeeAnimation();
        }
        
        // 征收费用
        player.financialStatus.cash -= actualFeeAmount;
        player.financialStatus.expenses.tax += actualFeeAmount;
        
        // 记录历史
        this._feeHistory.push({
            playerId: player.id,
            amount: actualFeeAmount,
            timestamp: Date.now()
        });
        
        // 创建游戏事件
        const gameEvent = {
            eventId: `fee_payment_${Date.now()}`,
            type: GameEventType.TURN_START, // 可以自定义为 FEE_PAYMENT
            timestamp: Date.now(),
            turnNumber: 0,
            actorPlayerId: player.id,
            affectedTileId: this.getTileData()?.id,
            parameters: {
                feeAmount: actualFeeAmount,
                feeType: this._feeConfig.type,
                feeName: this._feeConfig.taxName,
                originalAmount: feeAmount
            },
            description: `${player.nickname} 缴纳${this._feeConfig.taxName} ${actualFeeAmount} 游戏币`,
            result: { 
                newBalance: player.financialStatus.cash,
                feePaid: actualFeeAmount
            }
        };
        
        // 构建消息
        let message = `需要缴纳${this._feeConfig.taxName} ${actualFeeAmount} 游戏币`;
        if (actualFeeAmount < feeAmount) {
            message += `（原应缴纳 ${feeAmount}，但现金不足）`;
        }
        
        return {
            success: true,
            message: message,
            events: [gameEvent],
            moneyChange: -actualFeeAmount,
            blockMovement: false
        };
    }
    
    /**
     * 玩家经过处理
     * 费用地块只在停留时征费，经过时无效果
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
     * 播放费用征收动画
     */
    private async playFeeAnimation(): Promise<void> {
        console.log('[FeeTile] 播放费用征收动画');
        
        // TODO: 实现费用征收的特效动画
        // 可以包括：
        // 1. 金币消失动画
        // 2. 费用单据特效
        // 3. 音效播放
        // 4. UI警告动画
        
        return new Promise((resolve) => {
            this.scheduleOnce(() => {
                resolve();
            }, 1.0); // 动画持续1秒
        });
    }
    
    // ========================= 公共方法 =========================
    
    /**
     * 获取费用征收历史
     * @param playerId 可选的玩家ID筛选
     */
    public getFeeHistory(playerId?: string): { playerId: string; amount: number; timestamp: number }[] {
        if (playerId) {
            return this._feeHistory.filter(record => record.playerId === playerId);
        }
        return [...this._feeHistory];
    }
    
    /**
     * 清除费用历史
     */
    public clearFeeHistory(): void {
        this._feeHistory = [];
        console.log('[FeeTile] 费用历史已清除');
    }
    
    /**
     * 获取费用配置
     */
    public getFeeConfig(): TaxData | null {
        return this._feeConfig;
    }
    
    /**
     * 更新费用配置
     * @param config 新的配置
     */
    public updateFeeConfig(config: Partial<TaxData>): void {
        if (!this._feeConfig) {
            return;
        }
        
        this._feeConfig = { ...this._feeConfig, ...config };
        
        // 更新组件属性
        if (config.amount !== undefined) {
            this.feeAmount = config.amount;
        }
        if (config.type !== undefined) {
            this.feeType = config.type === 'fixed' ? 0 : 1;
        }
        
        console.log('[FeeTile] 费用配置已更新', this._feeConfig);
    }
    
    /**
     * 计算费用预览
     * @param player 目标玩家
     */
    public previewFeeAmount(player: PlayerData): number {
        if (!this._feeConfig) {
            return 0;
        }
        
        let feeAmount = 0;
        if (this._feeConfig.type === 'fixed') {
            feeAmount = this._feeConfig.amount;
        } else {
            feeAmount = Math.floor(player.financialStatus.cash * (this._feeConfig.amount / 100));
        }
        
        return Math.min(feeAmount, player.financialStatus.cash);
    }
    
    /**
     * 获取地块统计信息
     */
    public getFeeStats(): {
        totalFeeCollected: number;
        totalFeeEvents: number;
        playerFeeCounts: { [playerId: string]: number };
        playerFeeAmounts: { [playerId: string]: number };
        averageFeePerPlayer: number;
        averageFeePerEvent: number;
    } {
        const playerFeeCounts: { [playerId: string]: number } = {};
        const playerFeeAmounts: { [playerId: string]: number } = {};
        let totalFeeCollected = 0;
        
        this._feeHistory.forEach(record => {
            // 统计玩家缴费次数
            playerFeeCounts[record.playerId] = (playerFeeCounts[record.playerId] || 0) + 1;
            
            // 统计玩家缴费总额
            playerFeeAmounts[record.playerId] = (playerFeeAmounts[record.playerId] || 0) + record.amount;
            
            // 累计总费用
            totalFeeCollected += record.amount;
        });
        
        const totalPlayers = Object.keys(playerFeeCounts).length;
        const averageFeePerPlayer = totalPlayers > 0 ? totalFeeCollected / totalPlayers : 0;
        const averageFeePerEvent = this._feeHistory.length > 0 ? totalFeeCollected / this._feeHistory.length : 0;
        
        return {
            totalFeeCollected: totalFeeCollected,
            totalFeeEvents: this._feeHistory.length,
            playerFeeCounts: playerFeeCounts,
            playerFeeAmounts: playerFeeAmounts,
            averageFeePerPlayer: averageFeePerPlayer,
            averageFeePerEvent: averageFeePerEvent
        };
    }
}