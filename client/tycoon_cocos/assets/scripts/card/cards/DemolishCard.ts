/**
 * 拆除卡片
 * 
 * 允许玩家拆除其他玩家的建筑物，将目标建筑降级一级
 * 可以对敌方的房屋、酒店等建筑造成破坏，削弱其收租能力
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component } from 'cc';
import { Card, CardUseContext } from '../Card';
import { 
    CardType, 
    CardUsageTiming, 
    CardTargetType,
    CardUseResult,
    CardEffectType
} from '../../map/types/CardTypes';
import { GameEventType } from '../../map/types/GameTypes';

const { ccclass, property } = _decorator;

/**
 * 拆除卡片实现类
 * 提供建筑拆除功能
 */
@ccclass('DemolishCard')
export class DemolishCard extends Card {
    
    // ========================= 编辑器属性 =========================
    
    @property({ displayName: "拆除等级", range: [1, 3], tooltip: "一次拆除的建筑等级数" })
    public demolishLevels: number = 1;

    @property({ displayName: "补偿比例", range: [0, 1], tooltip: "给被拆除方的补偿金比例" })
    public compensationRatio: number = 0.3;

    @property({ displayName: "可拆除自己建筑", tooltip: "是否允许拆除自己的建筑" })
    public allowSelfDemolish: boolean = false;

    @property({ displayName: "免疫等级", tooltip: "建筑达到此等级后免疫拆除（0表示无免疫）" })
    public immunityLevel: number = 0;

    @property({ displayName: "显示选择界面", tooltip: "使用时是否弹出建筑选择界面" })
    public showTargetSelection: boolean = true;

    @property({ displayName: "拆除动画时长", tooltip: "拆除动画播放时长（秒）" })
    public demolishAnimationDuration: number = 2.5;

    // ========================= 私有属性 =========================

    /** 拆除历史记录 */
    private _demolishHistory: DemolishRecord[] = [];

    /** 最大历史记录数量 */
    private readonly MAX_HISTORY_SIZE: number = 20;

    // ========================= 抽象属性实现 =========================

    public get cardType(): CardType {
        return CardType.DEMOLISH;
    }

    public get usageTiming(): CardUsageTiming {
        return CardUsageTiming.INSTANT;
    }

    public get targetType(): CardTargetType {
        return CardTargetType.BUILDING;
    }

    // ========================= 核心方法实现 =========================

    /**
     * 检查是否可以使用
     * @param context 使用上下文
     */
    protected checkUsability(context: CardUseContext): any {
        const baseCheck = super.checkUsability(context);
        
        if (!baseCheck.canUse) {
            return baseCheck;
        }

        // 检查是否选择了目标建筑
        if (!context.target || context.target.tileId === undefined) {
            return {
                canUse: false,
                reasons: ['需要选择目标建筑'],
                requiredTargetType: this.targetType
            };
        }

        // 获取可拆除的建筑列表
        const availableTargets = this.getAvailableDemolishTargets(context.player);
        
        if (availableTargets.length === 0) {
            return {
                canUse: false,
                reasons: ['当前没有可以拆除的建筑'],
                requiredTargetType: this.targetType
            };
        }

        const targetTileId = context.target.tileId;
        const targetBuilding = availableTargets.find(building => building.tileId === targetTileId);

        if (!targetBuilding) {
            return {
                canUse: false,
                reasons: ['选择的建筑无效或不可拆除'],
                requiredTargetType: this.targetType
            };
        }

        // 检查建筑免疫等级
        if (this.immunityLevel > 0 && targetBuilding.buildingLevel >= this.immunityLevel) {
            return {
                canUse: false,
                reasons: [`建筑等级过高，免疫拆除（等级 ${targetBuilding.buildingLevel}）`],
                requiredTargetType: this.targetType
            };
        }

        return {
            canUse: true,
            reasons: [],
            requiredTargetType: this.targetType
        };
    }

    /**
     * 执行卡片效果
     * @param context 使用上下文
     */
    protected async executeCardEffect(context: CardUseContext): Promise<CardUseResult> {
        console.log(`[DemolishCard] 执行拆除卡片效果`);
        
        let targetTileId = context.target!.tileId!;

        // 如果需要显示目标选择界面
        if (this.showTargetSelection && !context.target?.tileId) {
            const selectedBuilding = await this.showTargetSelectionUI(context);
            if (!selectedBuilding) {
                return {
                    success: false,
                    message: '取消了拆除操作',
                    errorCode: 'USER_CANCELLED',
                    appliedEffects: [],
                    affectedPlayerIds: [],
                    affectedTileIds: []
                };
            }
            targetTileId = selectedBuilding.tileId;
        }

        // 获取目标建筑信息
        const targetBuilding = this.getBuildingInfo(targetTileId);
        if (!targetBuilding) {
            return {
                success: false,
                message: '无法找到目标建筑',
                errorCode: 'BUILDING_NOT_FOUND',
                appliedEffects: [],
                affectedPlayerIds: [],
                affectedTileIds: []
            };
        }

        // 执行拆除操作
        const demolishResult = await this.performDemolish(context.player, targetBuilding);

        if (!demolishResult.success) {
            return {
                success: false,
                message: `拆除失败: ${demolishResult.error}`,
                errorCode: 'DEMOLISH_FAILED',
                appliedEffects: [],
                affectedPlayerIds: [],
                affectedTileIds: []
            };
        }

        // 添加拆除记录
        this.addDemolishRecord(context.player.id, targetBuilding, demolishResult);

        // 创建使用结果
        const result: CardUseResult = {
            success: true,
            message: `成功拆除 ${targetBuilding.ownerName} 的建筑！` +
                    `建筑等级从 ${demolishResult.originalLevel} 降至 ${demolishResult.newLevel}` +
                    (demolishResult.compensation > 0 ? `，支付补偿金 ${demolishResult.compensation} 金币` : ''),
            appliedEffects: [{
                type: CardEffectType.BUILDING_OPERATION,
                target: targetTileId.toString(),
                params: { 
                    operation: 'demolish',
                    levels: this.demolishLevels,
                    originalLevel: demolishResult.originalLevel,
                    newLevel: demolishResult.newLevel,
                    compensation: demolishResult.compensation
                },
                result: demolishResult
            }],
            affectedPlayerIds: [context.player.id, targetBuilding.ownerId],
            affectedTileIds: [targetTileId],
            extendedData: {
                demolishedBuildingId: targetBuilding.id,
                demolishedTileId: targetTileId,
                originalLevel: demolishResult.originalLevel,
                newLevel: demolishResult.newLevel,
                compensationPaid: demolishResult.compensation,
                cardType: this.cardType
            }
        };

        console.log(`[DemolishCard] 拆除完成，地块 ${targetTileId} 建筑等级 ${demolishResult.originalLevel} -> ${demolishResult.newLevel}`);

        return result;
    }

    // ========================= 拆除实现方法 =========================

    /**
     * 执行拆除操作
     * @param player 拆除者
     * @param targetBuilding 目标建筑
     */
    private async performDemolish(player: any, targetBuilding: BuildingInfo): Promise<DemolishResult> {
        try {
            console.log(`[DemolishCard] 开始拆除建筑: ${targetBuilding.name} (等级 ${targetBuilding.buildingLevel})`);

            const originalLevel = targetBuilding.buildingLevel;
            const newLevel = Math.max(0, originalLevel - this.demolishLevels);

            // 播放拆除动画
            await this.playDemolishEffect(targetBuilding);

            // 计算补偿金额
            const buildingValue = this.calculateBuildingValue(originalLevel, newLevel);
            const compensation = Math.floor(buildingValue * this.compensationRatio);

            // 更新建筑等级
            // TODO: 这里需要调用地图管理器或建筑管理器来实际更新建筑
            this.updateBuildingLevel(targetBuilding.tileId, newLevel);

            // 处理金钱交易
            if (compensation > 0) {
                // 拆除者支付补偿金
                player.financialStatus.cash -= compensation;
                player.financialStatus.expenses.other += compensation;

                // 建筑拥有者获得补偿金
                // TODO: 通过玩家管理器获取建筑拥有者并给予补偿
                this.payCompensation(targetBuilding.ownerId, compensation);
            }

            // 更新统计信息
            if (player.gameStats && player.gameStats.actions) {
                player.gameStats.actions.demolishUses++;
                player.gameStats.actions.buildingsDestroyed++;
            }

            return {
                success: true,
                originalLevel: originalLevel,
                newLevel: newLevel,
                compensation: compensation,
                buildingValue: buildingValue,
                animationDuration: this.demolishAnimationDuration
            };

        } catch (error) {
            console.error(`[DemolishCard] 拆除失败:`, error);
            return {
                success: false,
                error: '拆除过程中出现错误'
            };
        }
    }

    /**
     * 显示目标选择UI
     * @param context 使用上下文
     */
    private async showTargetSelectionUI(context: CardUseContext): Promise<BuildingInfo | null> {
        // TODO: 实现建筑选择UI
        // 这里应该显示可拆除建筑的列表供玩家选择
        
        console.log('[DemolishCard] 显示建筑选择界面（待实现）');
        
        const availableTargets = this.getAvailableDemolishTargets(context.player);
        
        if (availableTargets.length === 0) {
            return null;
        }

        // 临时实现：返回第一个可拆除的建筑
        return new Promise((resolve) => {
            this.scheduleOnce(() => {
                // 这里应该弹出UI让玩家选择
                const randomIndex = Math.floor(Math.random() * availableTargets.length);
                resolve(availableTargets[randomIndex]);
            }, 1.0);
        });
    }

    /**
     * 播放拆除特效
     * @param building 被拆除的建筑
     */
    private async playDemolishEffect(building: BuildingInfo): Promise<void> {
        console.log(`[DemolishCard] 播放拆除特效，建筑: ${building.name}`);
        
        // TODO: 实现拆除特效
        // 可以包括：
        // 1. 建筑摇摆/破坏动画
        // 2. 粒子特效（尘土、碎片）
        // 3. 拆除音效
        // 4. 屏幕震动效果
        
        return new Promise((resolve) => {
            this.scheduleOnce(() => {
                resolve();
            }, this.demolishAnimationDuration);
        });
    }

    // ========================= 辅助方法 =========================

    /**
     * 获取可拆除的建筑目标
     * @param player 玩家对象
     */
    private getAvailableDemolishTargets(player: any): BuildingInfo[] {
        const availableTargets: BuildingInfo[] = [];
        
        // TODO: 从地图管理器或建筑管理器获取所有建筑
        // 这里使用临时模拟数据
        const allBuildings = this.getAllBuildings();

        for (const building of allBuildings) {
            // 检查是否可以拆除
            if (!this.canDemolishBuilding(building, player)) {
                continue;
            }

            availableTargets.push(building);
        }
        
        return availableTargets;
    }

    /**
     * 检查是否可以拆除指定建筑
     * @param building 建筑信息
     * @param player 玩家对象
     */
    private canDemolishBuilding(building: BuildingInfo, player: any): boolean {
        // 建筑必须有等级（不是空地）
        if (building.buildingLevel === 0) {
            return false;
        }

        // 检查是否允许拆除自己的建筑
        if (!this.allowSelfDemolish && building.ownerId === player.id) {
            return false;
        }

        // 检查免疫等级
        if (this.immunityLevel > 0 && building.buildingLevel >= this.immunityLevel) {
            return false;
        }

        // TODO: 检查其他限制条件（如保护状态等）

        return true;
    }

    /**
     * 获取建筑信息
     * @param tileId 地块ID
     */
    private getBuildingInfo(tileId: number): BuildingInfo | null {
        // TODO: 从地图管理器获取真实的建筑信息
        // 这里返回模拟数据
        const allBuildings = this.getAllBuildings();
        return allBuildings.find(building => building.tileId === tileId) || null;
    }

    /**
     * 获取所有建筑（临时模拟方法）
     */
    private getAllBuildings(): BuildingInfo[] {
        // TODO: 实际实现应该从地图管理器获取
        return [
            {
                id: 'building_1',
                tileId: 3,
                ownerId: 'player_2',
                ownerName: '玩家2',
                name: '豪华公寓',
                buildingLevel: 2,
                buildingType: 'house'
            },
            {
                id: 'building_2',
                tileId: 7,
                ownerId: 'player_3',
                ownerName: '玩家3',
                name: '商业大厦',
                buildingLevel: 3,
                buildingType: 'hotel'
            }
        ];
    }

    /**
     * 计算建筑价值
     * @param originalLevel 原始等级
     * @param newLevel 新等级
     */
    private calculateBuildingValue(originalLevel: number, newLevel: number): number {
        const levelDifference = originalLevel - newLevel;
        
        // 简单的价值计算公式
        // TODO: 可以根据实际建筑成本来计算
        const baseValue = 100;
        const levelMultiplier = 150;
        
        return levelDifference * (baseValue + originalLevel * levelMultiplier);
    }

    /**
     * 更新建筑等级
     * @param tileId 地块ID
     * @param newLevel 新等级
     */
    private updateBuildingLevel(tileId: number, newLevel: number): void {
        // TODO: 调用地图管理器或建筑管理器来更新建筑
        console.log(`[DemolishCard] 更新地块 ${tileId} 建筑等级为 ${newLevel}`);
    }

    /**
     * 支付补偿金
     * @param ownerId 建筑拥有者ID
     * @param amount 补偿金额
     */
    private payCompensation(ownerId: string, amount: number): void {
        // TODO: 通过玩家管理器给建筑拥有者支付补偿金
        console.log(`[DemolishCard] 向玩家 ${ownerId} 支付补偿金 ${amount} 金币`);
    }

    /**
     * 添加拆除记录
     * @param playerId 拆除者ID
     * @param building 被拆除的建筑
     * @param result 拆除结果
     */
    private addDemolishRecord(playerId: string, building: BuildingInfo, result: DemolishResult): void {
        const record: DemolishRecord = {
            demolisherId: playerId,
            targetBuildingId: building.id,
            targetTileId: building.tileId,
            targetOwnerId: building.ownerId,
            targetOwnerName: building.ownerName,
            originalLevel: result.originalLevel!,
            newLevel: result.newLevel!,
            compensationPaid: result.compensation!,
            timestamp: Date.now()
        };

        this._demolishHistory.push(record);

        // 限制历史记录大小
        if (this._demolishHistory.length > this.MAX_HISTORY_SIZE) {
            this._demolishHistory.shift();
        }
    }

    // ========================= 回调方法 =========================

    /**
     * 卡片初始化回调
     */
    protected onCardInitialized(cardData: any, cardInstance: any): void {
        super.onCardInitialized(cardData, cardInstance);
        
        // 清空拆除历史
        this._demolishHistory = [];
        
        console.log(`[DemolishCard] 拆除卡片初始化完成`);
    }

    // ========================= 公共方法 =========================

    /**
     * 设置拆除等级数
     * @param levels 拆除等级数
     */
    public setDemolishLevels(levels: number): void {
        if (levels >= 1 && levels <= 5) {
            this.demolishLevels = levels;
            console.log(`[DemolishCard] 拆除等级数设置为: ${levels}`);
        } else {
            console.warn(`[DemolishCard] 无效的拆除等级数: ${levels}`);
        }
    }

    /**
     * 设置补偿比例
     * @param ratio 补偿比例 (0-1)
     */
    public setCompensationRatio(ratio: number): void {
        if (ratio >= 0 && ratio <= 1) {
            this.compensationRatio = ratio;
            console.log(`[DemolishCard] 补偿比例设置为: ${Math.round(ratio * 100)}%`);
        } else {
            console.warn(`[DemolishCard] 无效的补偿比例: ${ratio}`);
        }
    }

    /**
     * 获取拆除历史记录
     */
    public getDemolishHistory(): DemolishRecord[] {
        return [...this._demolishHistory];
    }

    /**
     * 清空拆除历史
     */
    public clearDemolishHistory(): void {
        this._demolishHistory = [];
        console.log('[DemolishCard] 拆除历史已清空');
    }

    /**
     * 获取拆除统计信息
     */
    public getDemolishStats(): {
        totalDemolishes: number;
        totalCompensationPaid: number;
        averageCompensation: number;
        demolishedByLevel: { [level: number]: number };
        recentDemolishes: DemolishRecord[];
    } {
        const totalDemolishes = this._demolishHistory.length;
        const totalCompensationPaid = this._demolishHistory.reduce((sum, record) => sum + record.compensationPaid, 0);
        const averageCompensation = totalDemolishes > 0 ? totalCompensationPaid / totalDemolishes : 0;
        
        const demolishedByLevel: { [level: number]: number } = {};
        this._demolishHistory.forEach(record => {
            const level = record.originalLevel;
            demolishedByLevel[level] = (demolishedByLevel[level] || 0) + 1;
        });

        const recentDemolishes = this._demolishHistory.slice(-5); // 最近5次拆除

        return {
            totalDemolishes,
            totalCompensationPaid,
            averageCompensation: Math.round(averageCompensation * 100) / 100,
            demolishedByLevel,
            recentDemolishes
        };
    }

    /**
     * 获取卡片的详细使用说明
     */
    public getUsageInstructions(): string {
        const levelText = this.demolishLevels === 1 ? '降级1级' : `降级${this.demolishLevels}级`;
        const compensationText = this.compensationRatio > 0 ? 
            `，需支付${Math.round(this.compensationRatio * 100)}%补偿金` : '，无需补偿';
        const selfText = this.allowSelfDemolish ? '可拆除自己建筑' : '不能拆除自己建筑';
        const immunityText = this.immunityLevel > 0 ? 
            `，等级${this.immunityLevel}以上建筑免疫拆除` : '';

        return `使用拆除卡可以破坏其他玩家的建筑。
` +
               `- 选择目标建筑进行拆除
` +
               `- 建筑${levelText}
` +
               `- ${compensationText}
` +
               `- ${selfText}${immunityText}`;
    }
}

// ========================= 相关类型定义 =========================

/**
 * 建筑信息接口
 */
interface BuildingInfo {
    /** 建筑唯一ID */
    id: string;
    /** 所在地块ID */
    tileId: number;
    /** 拥有者ID */
    ownerId: string;
    /** 拥有者名称 */
    ownerName: string;
    /** 建筑名称 */
    name: string;
    /** 建筑等级 */
    buildingLevel: number;
    /** 建筑类型 */
    buildingType: string;
}

/**
 * 拆除记录接口
 */
interface DemolishRecord {
    /** 拆除者ID */
    demolisherId: string;
    /** 目标建筑ID */
    targetBuildingId: string;
    /** 目标地块ID */
    targetTileId: number;
    /** 建筑拥有者ID */
    targetOwnerId: string;
    /** 建筑拥有者名称 */
    targetOwnerName: string;
    /** 原始建筑等级 */
    originalLevel: number;
    /** 拆除后等级 */
    newLevel: number;
    /** 支付的补偿金 */
    compensationPaid: number;
    /** 拆除时间戳 */
    timestamp: number;
}

/**
 * 拆除结果接口
 */
interface DemolishResult {
    /** 是否成功 */
    success: boolean;
    /** 原始建筑等级 */
    originalLevel?: number;
    /** 拆除后等级 */
    newLevel?: number;
    /** 补偿金额 */
    compensation?: number;
    /** 建筑总价值 */
    buildingValue?: number;
    /** 动画时长 */
    animationDuration?: number;
    /** 错误信息（如果失败） */
    error?: string;
}