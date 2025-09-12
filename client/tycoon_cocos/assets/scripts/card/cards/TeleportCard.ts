// /**
//  * 传送卡片
//  * 
//  * 允许玩家瞬间移动到指定的地块位置
//  * 无视距离限制，可直接传送到地图上的任意地块
//  * 
//  * @author Web3 Tycoon Team
//  * @version 1.0.0
//  */

// import { _decorator, Component } from 'cc';
// import { Card, CardUseContext } from '../Card';
// import { 
//     CardType, 
//     CardUsageTiming, 
//     CardTargetType,
//     CardUseResult,
//     CardEffectType
// } from '../../map/types/CardTypes';
// import { GameEventType } from '../../map/types/GameTypes';

// const { ccclass, property } = _decorator;

// /**
//  * 传送卡片实现类
//  * 提供玩家传送功能
//  */
// @ccclass('TeleportCard')
// export class TeleportCard extends Card {
    
//     // ========================= 编辑器属性 =========================
    
//     @property({ displayName: "传送冷却时间", range: [0, 5], tooltip: "传送后的冷却回合数" })
//     public teleportCooldown: number = 1;

//     @property({ displayName: "传送费用", tooltip: "使用传送的金钱费用（0表示免费）" })
//     public teleportCost: number = 0;

//     @property({ displayName: "可传送到起始点", tooltip: "是否允许传送到起始地块" })
//     public allowTeleportToStart: boolean = true;

//     @property({ displayName: "可传送到监狱", tooltip: "是否允许传送到监狱地块" })
//     public allowTeleportToJail: boolean = false;

//     @property({ displayName: "显示选择界面", tooltip: "使用时是否弹出地块选择界面" })
//     public showTargetSelection: boolean = true;

//     @property({ displayName: "传送动画时长", tooltip: "传送动画播放时长（秒）" })
//     public teleportAnimationDuration: number = 2.0;

//     // ========================= 私有属性 =========================

//     /** 传送历史记录 */
//     private _teleportHistory: TeleportRecord[] = [];

//     /** 最大历史记录数量 */
//     private readonly MAX_HISTORY_SIZE: number = 10;

//     // ========================= 抽象属性实现 =========================

//     public get cardType(): CardType {
//         return CardType.TELEPORT;
//     }

//     public get usageTiming(): CardUsageTiming {
//         return CardUsageTiming.INSTANT;
//     }

//     public get targetType(): CardTargetType {
//         return CardTargetType.TILE;
//     }

//     // ========================= 核心方法实现 =========================

//     /**
//      * 检查是否可以使用
//      * @param context 使用上下文
//      */
//     protected checkUsability(context: CardUseContext): any {
//         const baseCheck = super.checkUsability(context);
        
//         if (!baseCheck.canUse) {
//             return baseCheck;
//         }

//         // 检查玩家是否有足够的金钱支付传送费用
//         if (this.teleportCost > 0 && context.player.financialStatus.cash < this.teleportCost) {
//             return {
//                 canUse: false,
//                 reasons: [`金钱不足，需要 ${this.teleportCost} 金币`],
//                 requiredTargetType: this.targetType
//             };
//         }

//         // 检查是否选择了目标地块
//         if (!context.target || context.target.tileId === undefined) {
//             return {
//                 canUse: false,
//                 reasons: ['需要选择目标地块'],
//                 requiredTargetType: this.targetType
//             };
//         }

//         const targetTileId = context.target.tileId;

//         // 检查是否传送到当前位置
//         if (targetTileId === context.player.currentTile) {
//             return {
//                 canUse: false,
//                 reasons: ['不能传送到当前位置'],
//                 requiredTargetType: this.targetType
//             };
//         }

//         // 检查特殊地块限制
//         if (!this.allowTeleportToStart && targetTileId === 0) {
//             return {
//                 canUse: false,
//                 reasons: ['不能传送到起始地块'],
//                 requiredTargetType: this.targetType
//             };
//         }

//         // TODO: 检查是否允许传送到监狱地块
//         // TODO: 检查目标地块是否存在和有效

//         return {
//             canUse: true,
//             reasons: [],
//             requiredTargetType: this.targetType
//         };
//     }

//     /**
//      * 执行卡片效果
//      * @param context 使用上下文
//      */
//     protected async executeCardEffect(context: CardUseContext): Promise<CardUseResult> {
//         console.log(`[TeleportCard] 执行传送卡片效果`);
        
//         let targetTileId = context.target!.tileId!;

//         // 如果需要显示目标选择界面
//         if (this.showTargetSelection && !context.target?.tileId) {
//             const selectedTile = await this.showTargetSelectionUI(context);
//             if (selectedTile === null) {
//                 return {
//                     success: false,
//                     message: '取消了传送',
//                     errorCode: 'USER_CANCELLED',
//                     appliedEffects: [],
//                     affectedPlayerIds: [],
//                     affectedTileIds: []
//                 };
//             }
//             targetTileId = selectedTile;
//         }

//         // 记录原始位置
//         const originalTileId = context.player.currentTile;

//         // 扣除传送费用
//         if (this.teleportCost > 0) {
//             context.player.financialStatus.cash -= this.teleportCost;
//             context.player.financialStatus.expenses.other += this.teleportCost;
//         }

//         // 执行传送
//         const teleportResult = await this.performTeleport(context.player, originalTileId, targetTileId);

//         if (!teleportResult.success) {
//             // 如果传送失败，退还费用
//             if (this.teleportCost > 0) {
//                 context.player.financialStatus.cash += this.teleportCost;
//                 context.player.financialStatus.expenses.other -= this.teleportCost;
//             }

//             return {
//                 success: false,
//                 message: `传送失败: ${teleportResult.error}`,
//                 errorCode: 'TELEPORT_FAILED',
//                 appliedEffects: [],
//                 affectedPlayerIds: [],
//                 affectedTileIds: []
//             };
//         }

//         // 添加传送记录
//         this.addTeleportRecord(context.player.id, originalTileId, targetTileId);

//         // 创建使用结果
//         const result: CardUseResult = {
//             success: true,
//             message: `成功传送到地块 ${targetTileId}${this.teleportCost > 0 ? `，花费 ${this.teleportCost} 金币` : ''}`,
//             appliedEffects: [{
//                 type: CardEffectType.TELEPORT_MOVE,
//                 target: context.player.id,
//                 params: { 
//                     fromTile: originalTileId,
//                     toTile: targetTileId,
//                     cost: this.teleportCost
//                 },
//                 result: teleportResult
//             }],
//             affectedPlayerIds: [context.player.id],
//             affectedTileIds: [originalTileId, targetTileId],
//             extendedData: {
//                 teleportFromTile: originalTileId,
//                 teleportToTile: targetTileId,
//                 teleportCost: this.teleportCost,
//                 cardType: this.cardType
//             }
//         };

//         console.log(`[TeleportCard] 玩家 ${context.player.nickname} 从地块 ${originalTileId} 传送到 ${targetTileId}`);

//         return result;
//     }

//     // ========================= 传送实现方法 =========================

//     /**
//      * 执行传送操作
//      * @param player 玩家对象
//      * @param fromTileId 原始位置
//      * @param toTileId 目标位置
//      */
//     private async performTeleport(player: any, fromTileId: number, toTileId: number): Promise<TeleportResult> {
//         try {
//             console.log(`[TeleportCard] 开始传送玩家 ${player.nickname} 从 ${fromTileId} 到 ${toTileId}`);

//             // 播放传送出现特效
//             await this.playTeleportDepartureEffect(player, fromTileId);

//             // 更新玩家位置
//             const oldPosition = player.currentTile;
//             player.currentTile = toTileId;
//             player.lastTile = oldPosition;

//             // 更新玩家移动统计
//             if (player.gameStats && player.gameStats.movement) {
//                 player.gameStats.movement.totalMoves++;
//                 player.gameStats.movement.teleports++;
//             }

//             // 播放传送到达特效
//             await this.playTeleportArrivalEffect(player, toTileId);

//             // TODO: 通知地图管理器更新玩家视觉位置
//             // TODO: 触发地块的停留事件（如果需要）

//             return {
//                 success: true,
//                 newPosition: toTileId,
//                 animationDuration: this.teleportAnimationDuration
//             };

//         } catch (error) {
//             console.error(`[TeleportCard] 传送失败:`, error);
//             return {
//                 success: false,
//                 error: '传送过程中出现错误'
//             };
//         }
//     }

//     /**
//      * 显示目标选择UI
//      * @param context 使用上下文
//      */
//     private async showTargetSelectionUI(context: CardUseContext): Promise<number | null> {
//         // TODO: 实现地块选择UI
//         // 这里应该弹出一个地图界面让玩家选择传送目标
        
//         console.log('[TeleportCard] 显示传送目标选择界面（待实现）');
        
//         // 临时实现：返回一个随机有效地块
//         return new Promise((resolve) => {
//             // 模拟UI选择过程
//             this.scheduleOnce(() => {
//                 // 这里应该显示完整地图，让玩家点击选择目标地块
//                 // 现在返回一个临时的地块ID
//                 const availableTiles = this.getAvailableTeleportTargets(context.player);
//                 if (availableTiles.length === 0) {
//                     resolve(null);
//                 } else {
//                     const randomIndex = Math.floor(Math.random() * availableTiles.length);
//                     resolve(availableTiles[randomIndex]);
//                 }
//             }, 1.0);
//         });
//     }

//     /**
//      * 播放传送离开特效
//      * @param player 玩家对象
//      * @param fromTileId 离开的地块ID
//      */
//     private async playTeleportDepartureEffect(player: any, fromTileId: number): Promise<void> {
//         console.log(`[TeleportCard] 播放传送离开特效，玩家: ${player.nickname}，地块: ${fromTileId}`);
        
//         // TODO: 实现传送离开特效
//         // 可以包括：
//         // 1. 玩家淡出效果
//         // 2. 魔法阵出现
//         // 3. 传送光效
//         // 4. 传送音效
        
//         return new Promise((resolve) => {
//             const departureTime = this.teleportAnimationDuration * 0.4; // 40%时间用于离开动画
//             this.scheduleOnce(() => {
//                 resolve();
//             }, departureTime);
//         });
//     }

//     /**
//      * 播放传送到达特效
//      * @param player 玩家对象
//      * @param toTileId 到达的地块ID
//      */
//     private async playTeleportArrivalEffect(player: any, toTileId: number): Promise<void> {
//         console.log(`[TeleportCard] 播放传送到达特效，玩家: ${player.nickname}，地块: ${toTileId}`);
        
//         // TODO: 实现传送到达特效
//         // 可以包括：
//         // 1. 玩家淡入效果
//         // 2. 魔法阵消失
//         // 3. 到达光效
//         // 4. 成功音效
        
//         return new Promise((resolve) => {
//             const arrivalTime = this.teleportAnimationDuration * 0.6; // 60%时间用于到达动画
//             this.scheduleOnce(() => {
//                 resolve();
//             }, arrivalTime);
//         });
//     }

//     // ========================= 辅助方法 =========================

//     /**
//      * 获取可用的传送目标列表
//      * @param player 玩家对象
//      */
//     private getAvailableTeleportTargets(player: any): number[] {
//         const availableTargets: number[] = [];
        
//         // TODO: 从地图管理器获取所有有效地块
//         // 这里临时使用固定的地块列表
//         for (let i = 0; i < 20; i++) {
//             // 跳过当前位置
//             if (i === player.currentTile) {
//                 continue;
//             }
            
//             // 根据设置过滤特殊地块
//             if (!this.allowTeleportToStart && i === 0) {
//                 continue;
//             }
            
//             // TODO: 检查监狱地块等其他限制
            
//             availableTargets.push(i);
//         }
        
//         return availableTargets;
//     }

//     /**
//      * 添加传送记录
//      * @param playerId 玩家ID
//      * @param fromTileId 起始地块
//      * @param toTileId 目标地块
//      */
//     private addTeleportRecord(playerId: string, fromTileId: number, toTileId: number): void {
//         const record: TeleportRecord = {
//             playerId: playerId,
//             fromTileId: fromTileId,
//             toTileId: toTileId,
//             timestamp: Date.now(),
//             cost: this.teleportCost
//         };

//         this._teleportHistory.push(record);

//         // 限制历史记录大小
//         if (this._teleportHistory.length > this.MAX_HISTORY_SIZE) {
//             this._teleportHistory.shift();
//         }
//     }

//     // ========================= 回调方法 =========================

//     /**
//      * 卡片初始化回调
//      */
//     protected onCardInitialized(cardData: any, cardInstance: any): void {
//         super.onCardInitialized(cardData, cardInstance);
        
//         // 清空传送历史
//         this._teleportHistory = [];
        
//         console.log(`[TeleportCard] 传送卡片初始化完成`);
//     }

//     // ========================= 公共方法 =========================

//     /**
//      * 设置传送费用
//      * @param cost 传送费用
//      */
//     public setTeleportCost(cost: number): void {
//         if (cost >= 0) {
//             this.teleportCost = cost;
//             console.log(`[TeleportCard] 传送费用设置为: ${cost} 金币`);
//         } else {
//             console.warn(`[TeleportCard] 无效的传送费用: ${cost}`);
//         }
//     }

//     /**
//      * 设置传送动画时长
//      * @param duration 动画时长（秒）
//      */
//     public setAnimationDuration(duration: number): void {
//         if (duration > 0 && duration <= 10) {
//             this.teleportAnimationDuration = duration;
//             console.log(`[TeleportCard] 传送动画时长设置为: ${duration} 秒`);
//         } else {
//             console.warn(`[TeleportCard] 无效的动画时长: ${duration}`);
//         }
//     }

//     /**
//      * 获取传送历史记录
//      */
//     public getTeleportHistory(): TeleportRecord[] {
//         return [...this._teleportHistory];
//     }

//     /**
//      * 清空传送历史
//      */
//     public clearTeleportHistory(): void {
//         this._teleportHistory = [];
//         console.log('[TeleportCard] 传送历史已清空');
//     }

//     /**
//      * 获取传送统计信息
//      */
//     public getTeleportStats(): {
//         totalTeleports: number;
//         totalCostPaid: number;
//         averageCost: number;
//         recentTeleports: TeleportRecord[];
//     } {
//         const totalTeleports = this._teleportHistory.length;
//         const totalCostPaid = this._teleportHistory.reduce((sum, record) => sum + record.cost, 0);
//         const averageCost = totalTeleports > 0 ? totalCostPaid / totalTeleports : 0;
//         const recentTeleports = this._teleportHistory.slice(-5); // 最近5次传送

//         return {
//             totalTeleports,
//             totalCostPaid,
//             averageCost: Math.round(averageCost * 100) / 100, // 保留2位小数
//             recentTeleports
//         };
//     }

//     /**
//      * 检查指定地块是否为有效传送目标
//      * @param tileId 地块ID
//      * @param player 玩家对象
//      */
//     public isValidTeleportTarget(tileId: number, player: any): boolean {
//         // 不能传送到当前位置
//         if (tileId === player.currentTile) {
//             return false;
//         }

//         // 检查特殊地块限制
//         if (!this.allowTeleportToStart && tileId === 0) {
//             return false;
//         }

//         if (!this.allowTeleportToJail && tileId === 10) { // 假设监狱在地块10
//             return false;
//         }

//         // TODO: 检查其他限制条件

//         return true;
//     }

//     /**
//      * 获取卡片的详细使用说明
//      */
//     public getUsageInstructions(): string {
//         const costText = this.teleportCost > 0 ? `，费用 ${this.teleportCost} 金币` : '，免费使用';
//         const startText = this.allowTeleportToStart ? '可传送到起始地块' : '不可传送到起始地块';
//         const jailText = this.allowTeleportToJail ? '可传送到监狱' : '不可传送到监狱';
        
//         return `使用传送卡可以瞬间移动到指定地块。
// ` +
//                `- 选择地图上的任意地块作为传送目标
// ` +
//                `- 无视距离限制，立即到达目标位置
// ` +
//                `- ${costText}
// ` +
//                `- ${startText}
// ` +
//                `- ${jailText}`;
//     }
// }

// // ========================= 相关类型定义 =========================

// /**
//  * 传送记录接口
//  */
// interface TeleportRecord {
//     /** 玩家ID */
//     playerId: string;
//     /** 起始地块ID */
//     fromTileId: number;
//     /** 目标地块ID */
//     toTileId: number;
//     /** 传送时间戳 */
//     timestamp: number;
//     /** 传送费用 */
//     cost: number;
// }

// /**
//  * 传送结果接口
//  */
// interface TeleportResult {
//     /** 是否成功 */
//     success: boolean;
//     /** 新位置（如果成功） */
//     newPosition?: number;
//     /** 动画时长 */
//     animationDuration?: number;
//     /** 错误信息（如果失败） */
//     error?: string;
// }