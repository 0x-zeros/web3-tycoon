/**
 * 起点地块
 * 
 * 游戏的起始地块，玩家经过时获得薪水，停留时获得额外奖励
 * 所有玩家的起始位置，也是计算游戏进度的重要标志
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component } from 'cc';
import { MapTile, TileInteractionResult } from '../core/MapTile';
import { MapTileData, TileType } from '../types/MapTypes';
import { PlayerData, GameEventType } from '../types/GameTypes';

const { ccclass, property } = _decorator;

/**
 * 起点地块实现类
 * 提供薪水发放和起始位置功能
 */
@ccclass('StartTile')
export class StartTile extends MapTile {
    
    // ========================= 编辑器属性 =========================
    
    @property({ displayName: "经过薪水", tooltip: "玩家经过起点时获得的金钱" })
    public passingBonus: number = 200;
    
    @property({ displayName: "停留薪水", tooltip: "玩家停留在起点时获得的金钱" })
    public landingBonus: number = 400;
    
    @property({ displayName: "显示特效", tooltip: "是否在玩家获得薪水时显示特效" })
    public showBonusEffect: boolean = true;
    
    @property({ displayName: "薪水声效", tooltip: "获得薪水时播放的音效名称" })
    public bonusAudioName: string = 'bonus_sound';
    
    // ========================= 私有属性 =========================
    
    /** 本轮游戏中经过此地块的玩家统计 */
    private _passageCount: Map<string, number> = new Map();
    
    // ========================= 抽象方法实现 =========================
    
    /**
     * 获取地块类型
     */
    public get tileType(): TileType {
        return TileType.START;
    }
    
    /**
     * 地块初始化
     * @param tileData 地块数据
     */
    protected onTileInitialized(tileData: MapTileData): void {
        // 从地块数据中读取薪水配置
        if (tileData.salaryAmount) {
            this.passingBonus = tileData.salaryAmount;
            this.landingBonus = tileData.salaryAmount * 2; // 停留奖励是经过的两倍
        }
        
        console.log(`[StartTile] 起点地块初始化完成，经过奖励: ${this.passingBonus}, 停留奖励: ${this.landingBonus}`);
    }
    
    /**
     * 玩家停留处理
     * 玩家停留在起点时，给予额外的起点奖励
     * @param player 停留的玩家
     */
    protected async onPlayerLandOn(player: PlayerData): Promise<TileInteractionResult> {
        console.log(`[StartTile] 玩家 ${player.nickname} 停留在起点`);
        
        // 给予停留奖励
        const bonusAmount = this.landingBonus;
        player.financialStatus.cash += bonusAmount;
        player.financialStatus.income.salary += bonusAmount;
        
        // 更新统计
        player.statistics.startPassCount++;
        
        // 记录经过次数
        const currentCount = this._passageCount.get(player.id) || 0;
        this._passageCount.set(player.id, currentCount + 1);
        
        // 播放特效和音效
        if (this.showBonusEffect) {
            await this.playBonusEffect(player, bonusAmount, true);
        }
        
        // 创建游戏事件
        const events = [{
            eventId: `start_land_${Date.now()}`,
            type: GameEventType.TURN_START, // 可以自定义为 SALARY_RECEIVED
            timestamp: Date.now(),
            turnNumber: 0, // 需要从游戏管理器获取
            actorPlayerId: player.id,
            parameters: {
                bonusType: 'landing',
                amount: bonusAmount,
                totalPasses: this._passageCount.get(player.id)
            },
            description: `${player.nickname} 停留在起点，获得 ${bonusAmount} 金币`,
            result: { newBalance: player.financialStatus.cash }
        }];
        
        return {
            success: true,
            message: `欢迎回到起点！获得 ${bonusAmount} 金币！`,
            events: events,
            moneyChange: bonusAmount,
            blockMovement: false
        };
    }
    
    /**
     * 玩家经过处理
     * 玩家经过起点时，给予经过奖励
     * @param player 经过的玩家
     */
    protected async onPlayerPassThrough(player: PlayerData): Promise<TileInteractionResult> {
        console.log(`[StartTile] 玩家 ${player.nickname} 经过起点`);
        
        // 给予经过奖励
        const bonusAmount = this.passingBonus;
        player.financialStatus.cash += bonusAmount;
        player.financialStatus.income.salary += bonusAmount;
        
        // 更新统计
        player.statistics.startPassCount++;
        
        // 记录经过次数
        const currentCount = this._passageCount.get(player.id) || 0;
        this._passageCount.set(player.id, currentCount + 1);
        
        // 播放特效和音效
        if (this.showBonusEffect) {
            await this.playBonusEffect(player, bonusAmount, false);
        }
        
        // 创建游戏事件
        const events = [{
            eventId: `start_pass_${Date.now()}`,
            type: GameEventType.TURN_START, // 可以自定义为 SALARY_RECEIVED
            timestamp: Date.now(),
            turnNumber: 0, // 需要从游戏管理器获取
            actorPlayerId: player.id,
            parameters: {
                bonusType: 'passing',
                amount: bonusAmount,
                totalPasses: this._passageCount.get(player.id)
            },
            description: `${player.nickname} 经过起点，获得 ${bonusAmount} 金币`,
            result: { newBalance: player.financialStatus.cash }
        }];
        
        return {
            success: true,
            message: `经过起点，获得 ${bonusAmount} 金币！`,
            events: events,
            moneyChange: bonusAmount,
            blockMovement: false
        };
    }
    
    // ========================= 特效和动画方法 =========================
    
    /**
     * 播放奖励特效
     * @param player 获得奖励的玩家
     * @param amount 奖励金额
     * @param isLanding 是否是停留奖励
     */
    private async playBonusEffect(player: PlayerData, amount: number, isLanding: boolean): Promise<void> {
        // TODO: 实现特效播放逻辑
        // 这里可以播放金币飞舞动画、音效等
        
        console.log(`[StartTile] 播放奖励特效: 玩家 ${player.nickname} 获得 ${amount} 金币 (${isLanding ? '停留' : '经过'})`);
        
        // 示例：创建金币文字动画
        this.createFloatingText(`+${amount}`, isLanding);
        
        // 示例：播放音效
        this.playBonusSound();
        
        // 模拟异步特效持续时间
        return new Promise((resolve) => {
            this.scheduleOnce(() => {
                resolve();
            }, 0.5); // 特效持续0.5秒
        });
    }
    
    /**
     * 创建浮动文字效果
     * @param text 显示的文字
     * @param isLanding 是否是停留奖励
     */
    private createFloatingText(text: string, isLanding: boolean): void {
        // TODO: 实现浮动文字效果
        // 在地块上方显示获得的金币数量
        // 可以使用Cocos Creator的Label组件和Tween动画
        
        console.log(`[StartTile] 创建浮动文字: ${text} (${isLanding ? '停留奖励' : '经过奖励'})`);
        
        // 实现提示：
        // 1. 创建Label节点
        // 2. 设置文字内容和样式
        // 3. 播放向上飞行并逐渐消失的动画
        // 4. 动画结束后销毁节点
    }
    
    /**
     * 播放奖励音效
     */
    private playBonusSound(): void {
        // TODO: 实现音效播放
        // 使用AudioSource组件播放获得奖励的音效
        
        console.log(`[StartTile] 播放奖励音效: ${this.bonusAudioName}`);
        
        // 实现提示：
        // 1. 获取AudioSource组件
        // 2. 加载音效资源
        // 3. 播放音效
    }
    
    // ========================= 公共方法 =========================
    
    /**
     * 获取玩家的经过次数
     * @param playerId 玩家ID
     */
    public getPlayerPassageCount(playerId: string): number {
        return this._passageCount.get(playerId) || 0;
    }
    
    /**
     * 重置经过次数统计
     */
    public resetPassageCounts(): void {
        this._passageCount.clear();
        console.log('[StartTile] 经过次数统计已重置');
    }
    
    /**
     * 获取所有玩家的经过统计
     */
    public getAllPassageCounts(): { [playerId: string]: number } {
        const result: { [playerId: string]: number } = {};
        this._passageCount.forEach((count, playerId) => {
            result[playerId] = count;
        });
        return result;
    }
    
    /**
     * 设置薪水金额
     * @param passingAmount 经过时的薪水
     * @param landingAmount 停留时的薪水
     */
    public setSalaryAmounts(passingAmount: number, landingAmount: number): void {
        this.passingBonus = passingAmount;
        this.landingBonus = landingAmount;
        
        console.log(`[StartTile] 薪水金额已更新: 经过 ${passingAmount}, 停留 ${landingAmount}`);
    }
    
    /**
     * 检查是否是玩家的第一次经过起点
     * @param playerId 玩家ID
     */
    public isFirstPass(playerId: string): boolean {
        return this.getPlayerPassageCount(playerId) <= 1;
    }
    
    /**
     * 计算玩家的累计薪水收入
     * @param playerId 玩家ID
     */
    public calculateTotalSalary(playerId: string): number {
        const passCount = this.getPlayerPassageCount(playerId);
        // 假设大部分是经过，少数是停留
        // 这里简化计算，实际应该记录详细的经过/停留历史
        return passCount * this.passingBonus;
    }
    
    // ========================= 状态和配置 =========================
    
    /**
     * 获取起点地块的详细信息
     */
    public getStartTileInfo(): {
        passingBonus: number;
        landingBonus: number;
        totalPassages: number;
        activePlayersCount: number;
    } {
        let totalPassages = 0;
        this._passageCount.forEach(count => totalPassages += count);
        
        return {
            passingBonus: this.passingBonus,
            landingBonus: this.landingBonus,
            totalPassages: totalPassages,
            activePlayersCount: this._passageCount.size
        };
    }
    
    /**
     * 检查起点地块是否繁忙
     * 如果有很多玩家停留，可能需要特殊处理
     */
    public isBusy(): boolean {
        return this.getPlayersOnTile().length > 1;
    }
}