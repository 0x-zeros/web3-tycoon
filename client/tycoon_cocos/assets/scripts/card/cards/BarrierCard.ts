// /**
//  * 路障卡片
//  * 
//  * 在指定地块上放置路障，阻挡其他玩家通过
//  * 路障会持续一定回合数，其他玩家移动到路障地块时会被迫停止
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
//  * 路障卡片实现类
//  * 提供地块路障放置功能
//  */
// @ccclass('BarrierCard')
// export class BarrierCard extends Card {
    
//     // ========================= 编辑器属性 =========================
    
//     @property({ displayName: "路障持续回合数", range: [1, 10], tooltip: "路障存在的回合数" })
//     public barrierDuration: number = 3;

//     @property({ displayName: "路障范围", range: [1, 3], tooltip: "路障影响的地块范围" })
//     public barrierRange: number = 1;

//     @property({ displayName: "可阻挡自己", tooltip: "路障是否也会阻挡放置者" })
//     public blocksOwner: boolean = false;

//     @property({ displayName: "显示选择界面", tooltip: "使用时是否弹出地块选择界面" })
//     public showTargetSelection: boolean = true;

//     // ========================= 私有属性 =========================

//     /** 已放置的路障信息 */
//     private _activeBarriers: Map<number, BarrierInfo> = new Map();

//     // ========================= 抽象属性实现 =========================

//     public get cardType(): CardType {
//         return CardType.BARRIER;
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

//         // 检查是否选择了目标地块
//         if (!context.target || context.target.tileId === undefined) {
//             return {
//                 canUse: false,
//                 reasons: ['需要选择目标地块'],
//                 requiredTargetType: this.targetType
//             };
//         }

//         const targetTileId = context.target.tileId;

//         // 检查目标地块是否已经有路障
//         if (this._activeBarriers.has(targetTileId)) {
//             return {
//                 canUse: false,
//                 reasons: ['目标地块已存在路障'],
//                 requiredTargetType: this.targetType
//             };
//         }

//         // 检查目标地块是否是起始地块
//         if (targetTileId === 0) {
//             return {
//                 canUse: false,
//                 reasons: ['不能在起始地块放置路障'],
//                 requiredTargetType: this.targetType
//             };
//         }

//         // TODO: 检查目标地块是否存在
//         // TODO: 检查目标地块是否允许放置路障（如监狱地块可能不允许）

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
//         console.log(`[BarrierCard] 执行路障卡片效果`);
        
//         const targetTileId = context.target!.tileId!;

//         // 如果需要显示目标选择界面
//         if (this.showTargetSelection && !context.target?.tileId) {
//             const selectedTile = await this.showTargetSelectionUI(context);
//             if (!selectedTile) {
//                 return {
//                     success: false,
//                     message: '取消了路障放置',
//                     errorCode: 'USER_CANCELLED',
//                     appliedEffects: [],
//                     affectedPlayerIds: [],
//                     affectedTileIds: []
//                 };
//             }
//         }

//         // 创建路障
//         const barrier = await this.createBarrier(context.player, targetTileId);
        
//         if (!barrier) {
//             return {
//                 success: false,
//                 message: '路障放置失败',
//                 errorCode: 'BARRIER_CREATION_FAILED',
//                 appliedEffects: [],
//                 affectedPlayerIds: [],
//                 affectedTileIds: []
//             };
//         }

//         // 添加到活动路障列表
//         this._activeBarriers.set(targetTileId, barrier);

//         // 创建使用结果
//         const result: CardUseResult = {
//             success: true,
//             message: `在地块 ${targetTileId} 放置了路障，将持续 ${this.barrierDuration} 回合`,
//             appliedEffects: [{
//                 type: CardEffectType.PLACE_BARRIER,
//                 target: targetTileId.toString(),
//                 params: { 
//                     duration: this.barrierDuration,
//                     range: this.barrierRange,
//                     blocksOwner: this.blocksOwner
//                 },
//                 result: barrier
//             }],
//             affectedPlayerIds: [], // 路障影响所有玩家，但这里先不填充
//             affectedTileIds: [targetTileId],
//             extendedData: {
//                 barrierId: barrier.id,
//                 barrierTileId: targetTileId,
//                 cardType: this.cardType
//             }
//         };

//         // 播放特效
//         await this.playBarrierPlacementEffect(targetTileId, barrier);

//         console.log(`[BarrierCard] 路障已放置在地块 ${targetTileId}`);

//         return result;
//     }

//     // ========================= 路障管理方法 =========================

//     /**
//      * 创建路障
//      * @param player 放置者
//      * @param tileId 目标地块ID
//      */
//     private async createBarrier(player: any, tileId: number): Promise<BarrierInfo | null> {
//         const barrierId = `barrier_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
//         const barrier: BarrierInfo = {
//             id: barrierId,
//             tileId: tileId,
//             ownerId: player.id,
//             ownerName: player.nickname || player.id,
//             remainingTurns: this.barrierDuration,
//             placedAt: Date.now(),
//             blocksOwner: this.blocksOwner,
//             range: this.barrierRange,
//             cardSource: this.cardType
//         };

//         console.log(`[BarrierCard] 创建路障: ${barrierId} 在地块 ${tileId}`);
        
//         return barrier;
//     }

//     /**
//      * 显示目标选择UI
//      * @param context 使用上下文
//      */
//     private async showTargetSelectionUI(context: CardUseContext): Promise<number | null> {
//         // TODO: 实现地块选择UI
//         // 这里应该弹出一个对话框让玩家选择可用的地块
        
//         console.log('[BarrierCard] 显示地块选择界面（待实现）');
        
//         // 临时实现：返回一个随机有效地块
//         return new Promise((resolve) => {
//             // 模拟UI选择过程
//             this.scheduleOnce(() => {
//                 // 这里应该显示地图，让玩家点击选择地块
//                 // 现在返回一个临时的地块ID
//                 const randomTileId = Math.floor(Math.random() * 20) + 1; // 1-20
//                 resolve(randomTileId);
//             }, 0.8);
//         });
//     }

//     /**
//      * 播放路障放置特效
//      * @param tileId 地块ID
//      * @param barrier 路障信息
//      */
//     private async playBarrierPlacementEffect(tileId: number, barrier: BarrierInfo): Promise<void> {
//         console.log(`[BarrierCard] 播放路障放置特效在地块 ${tileId}`);
        
//         // TODO: 实现路障放置特效
//         // 可以包括：
//         // 1. 在地块上显示路障模型
//         // 2. 播放放置音效
//         // 3. 显示路障持续时间UI
//         // 4. 路障警告特效
        
//         return new Promise((resolve) => {
//             this.scheduleOnce(() => {
//                 resolve();
//             }, 1.2);
//         });
//     }

//     // ========================= 路障检查和管理 =========================

//     /**
//      * 检查玩家是否会被路障阻挡
//      * @param playerId 玩家ID
//      * @param targetTileId 目标地块ID
//      */
//     public checkBarrierBlocking(playerId: string, targetTileId: number): BarrierBlockResult {
//         const barrier = this._activeBarriers.get(targetTileId);
        
//         if (!barrier) {
//             return { isBlocked: false };
//         }

//         // 检查路障是否还有效
//         if (barrier.remainingTurns <= 0) {
//             this.removeBarrier(targetTileId);
//             return { isBlocked: false };
//         }

//         // 检查是否阻挡放置者
//         if (!barrier.blocksOwner && barrier.ownerId === playerId) {
//             return { isBlocked: false };
//         }

//         return {
//             isBlocked: true,
//             barrier: barrier,
//             blockMessage: `前方有 ${barrier.ownerName} 放置的路障！无法通过。`
//         };
//     }

//     /**
//      * 更新所有路障状态（每回合调用）
//      */
//     public updateBarriers(): void {
//         const toRemove: number[] = [];

//         this._activeBarriers.forEach((barrier, tileId) => {
//             barrier.remainingTurns--;
            
//             if (barrier.remainingTurns <= 0) {
//                 toRemove.push(tileId);
//                 console.log(`[BarrierCard] 路障 ${barrier.id} 已过期`);
//             }
//         });

//         // 移除过期路障
//         toRemove.forEach(tileId => {
//             this.removeBarrier(tileId);
//         });
//     }

//     /**
//      * 移除路障
//      * @param tileId 地块ID
//      */
//     public removeBarrier(tileId: number): boolean {
//         const barrier = this._activeBarriers.get(tileId);
        
//         if (!barrier) {
//             return false;
//         }

//         this._activeBarriers.delete(tileId);
        
//         // TODO: 播放路障消失特效
//         console.log(`[BarrierCard] 路障已从地块 ${tileId} 移除`);
        
//         return true;
//     }

//     /**
//      * 获取所有活动路障
//      */
//     public getActiveBarriers(): Map<number, BarrierInfo> {
//         return new Map(this._activeBarriers);
//     }

//     /**
//      * 清除所有路障
//      */
//     public clearAllBarriers(): void {
//         this._activeBarriers.clear();
//         console.log('[BarrierCard] 所有路障已清除');
//     }

//     // ========================= 回调方法 =========================

//     /**
//      * 卡片初始化回调
//      */
//     protected onCardInitialized(cardData: any, cardInstance: any): void {
//         super.onCardInitialized(cardData, cardInstance);
        
//         // 重置路障状态
//         this._activeBarriers.clear();
        
//         console.log(`[BarrierCard] 路障卡片初始化完成`);
//     }

//     // ========================= 公共方法 =========================

//     /**
//      * 设置路障持续时间
//      * @param duration 持续回合数
//      */
//     public setBarrierDuration(duration: number): void {
//         if (duration >= 1 && duration <= 10) {
//             this.barrierDuration = duration;
//             console.log(`[BarrierCard] 路障持续时间设置为: ${duration} 回合`);
//         } else {
//             console.warn(`[BarrierCard] 无效的路障持续时间: ${duration}`);
//         }
//     }

//     /**
//      * 获取指定地块的路障信息
//      * @param tileId 地块ID
//      */
//     public getBarrierInfo(tileId: number): BarrierInfo | null {
//         return this._activeBarriers.get(tileId) || null;
//     }

//     /**
//      * 检查指定地块是否有路障
//      * @param tileId 地块ID
//      */
//     public hasBarrier(tileId: number): boolean {
//         return this._activeBarriers.has(tileId);
//     }

//     /**
//      * 获取路障统计信息
//      */
//     public getBarrierStats(): {
//         totalBarriers: number;
//         activeBarriers: { tileId: number; remainingTurns: number; owner: string; }[];
//     } {
//         const activeBarriers: { tileId: number; remainingTurns: number; owner: string; }[] = [];

//         this._activeBarriers.forEach((barrier, tileId) => {
//             activeBarriers.push({
//                 tileId: tileId,
//                 remainingTurns: barrier.remainingTurns,
//                 owner: barrier.ownerName
//             });
//         });

//         return {
//             totalBarriers: this._activeBarriers.size,
//             activeBarriers: activeBarriers
//         };
//     }

//     /**
//      * 获取卡片的详细使用说明
//      */
//     public getUsageInstructions(): string {
//         return `使用路障卡可以阻挡其他玩家的移动。
// ` +
//                `- 选择一个地块放置路障
// ` +
//                `- 路障持续 ${this.barrierDuration} 回合
// ` +
//                `- 其他玩家移动到路障地块时会被强制停止
// ` +
//                `${this.blocksOwner ? '- 路障也会阻挡放置者' : '- 路障不会阻挡放置者'}`;
//     }
// }

// // ========================= 相关类型定义 =========================

// /**
//  * 路障信息接口
//  */
// interface BarrierInfo {
//     /** 路障唯一ID */
//     id: string;
//     /** 路障所在地块ID */
//     tileId: number;
//     /** 放置者ID */
//     ownerId: string;
//     /** 放置者名称 */
//     ownerName: string;
//     /** 剩余回合数 */
//     remainingTurns: number;
//     /** 放置时间戳 */
//     placedAt: number;
//     /** 是否阻挡放置者 */
//     blocksOwner: boolean;
//     /** 影响范围 */
//     range: number;
//     /** 来源卡片类型 */
//     cardSource: CardType;
// }

// /**
//  * 路障阻挡检查结果接口
//  */
// interface BarrierBlockResult {
//     /** 是否被阻挡 */
//     isBlocked: boolean;
//     /** 路障信息（如果被阻挡） */
//     barrier?: BarrierInfo;
//     /** 阻挡消息 */
//     blockMessage?: string;
// }