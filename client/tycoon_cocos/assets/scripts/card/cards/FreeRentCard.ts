/**
 * 免租卡片
 * 
 * 给玩家添加免租状态，下次需要支付租金时可以免费
 * 这是一张防御性卡片，可以有效避免踩到敌方高价地产时的巨额损失
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
 * 免租卡片实现类
 * 提供租金免除功能
 */
@ccclass('FreeRentCard')
export class FreeRentCard extends Card {
    
    // ========================= 编辑器属性 =========================
    
    @property({ displayName: "免租次数", range: [1, 5], tooltip: "一次使用可以免除的租金次数" })
    public freeRentCount: number = 1;

    @property({ displayName: "最大免租金额", tooltip: "单次免租的最大金额限制（0表示无限制）" })
    public maxFreeRentAmount: number = 0;

    @property({ displayName: "有效期", tooltip: "免租状态的有效回合数（-1表示永久有效直到使用）" })
    public effectDuration: number = -1;

    @property({ displayName: "显示确认界面", tooltip: "使用时是否显示确认界面" })
    public showConfirmation: boolean = true;

    @property({ displayName: "自动使用", tooltip: "是否在需要支付租金时自动使用" })
    public autoUse: boolean = false;

    // ========================= 私有属性 =========================

    /** 免租使用历史记录 */
    private _freeRentHistory: FreeRentRecord[] = [];

    /** 最大历史记录数量 */
    private readonly MAX_HISTORY_SIZE: number = 50;

    // ========================= 抽象属性实现 =========================

    public get cardType(): CardType {
        return CardType.FREE_RENT;
    }

    public get usageTiming(): CardUsageTiming {
        return CardUsageTiming.INSTANT;
    }

    public get targetType(): CardTargetType {
        return CardTargetType.SELF;
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

        // 检查玩家是否已经有免租状态
        if (this.hasActiveFreeRentStatus(context.player)) {
            return {
                canUse: false,
                reasons: ['已经拥有免租状态'],
                requiredTargetType: this.targetType
            };
        }

        // 免租卡只能对自己使用
        if (context.target && context.target.playerId && context.target.playerId !== context.player.id) {
            return {
                canUse: false,
                reasons: ['免租卡只能对自己使用'],
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
        console.log(`[FreeRentCard] 执行免租卡片效果`);
        
        // 显示确认界面
        if (this.showConfirmation) {
            const confirmed = await this.showConfirmationUI(context);
            if (!confirmed) {
                return {
                    success: false,
                    message: '取消了免租卡使用',
                    errorCode: 'USER_CANCELLED',
                    appliedEffects: [],
                    affectedPlayerIds: [],
                    affectedTileIds: []
                };
            }
        }

        // 应用免租状态效果
        const statusEffect = await this.applyFreeRentStatus(context.player);

        if (!statusEffect.success) {
            return {
                success: false,
                message: `免租状态添加失败: ${statusEffect.error}`,
                errorCode: 'STATUS_EFFECT_FAILED',
                appliedEffects: [],
                affectedPlayerIds: [],
                affectedTileIds: []
            };
        }

        // 创建使用结果
        const result: CardUseResult = {
            success: true,
            message: `获得免租状态！可以免除 ${this.freeRentCount} 次租金支付` +
                    (this.maxFreeRentAmount > 0 ? `（单次最多 ${this.maxFreeRentAmount} 金币）` : '') +
                    (this.effectDuration > 0 ? `，持续 ${this.effectDuration} 回合` : '，直到使用完毕'),
            appliedEffects: [{
                type: CardEffectType.STATUS_EFFECT,
                target: context.player.id,
                params: { 
                    statusType: 'free_rent',
                    count: this.freeRentCount,
                    maxAmount: this.maxFreeRentAmount,
                    duration: this.effectDuration,
                    autoUse: this.autoUse
                },
                result: statusEffect
            }],
            affectedPlayerIds: [context.player.id],
            affectedTileIds: [],
            extendedData: {
                freeRentCount: this.freeRentCount,
                maxFreeRentAmount: this.maxFreeRentAmount,
                effectDuration: this.effectDuration,
                cardType: this.cardType
            }
        };

        // 播放特效
        await this.playFreeRentEffect(context.player);

        console.log(`[FreeRentCard] 玩家 ${context.player.nickname} 获得免租状态`);

        return result;
    }

    // ========================= 免租状态管理 =========================

    /**
     * 应用免租状态效果
     * @param player 玩家对象
     */
    private async applyFreeRentStatus(player: any): Promise<StatusEffectResult> {
        try {
            const effectId = `free_rent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const freeRentEffect = {
                effectId: effectId,
                type: 'free_rent',
                name: '免租状态',
                description: `可免除 ${this.freeRentCount} 次租金支付`,
                remainingUses: this.freeRentCount,
                remainingTurns: this.effectDuration,
                maxFreeAmount: this.maxFreeRentAmount,
                autoUse: this.autoUse,
                createdAt: Date.now(),
                source: 'free_rent_card',
                iconPath: 'icons/free_rent_status'
            };

            // 添加到玩家状态效果列表
            if (!player.statusEffects) {
                player.statusEffects = [];
            }

            // 检查是否已经有免租状态
            const existingIndex = player.statusEffects.findIndex((effect: any) => 
                effect.type === 'free_rent'
            );

            if (existingIndex !== -1) {
                // 替换现有的免租状态
                player.statusEffects[existingIndex] = freeRentEffect;
                console.log(`[FreeRentCard] 替换现有免租状态`);
            } else {
                // 添加新的免租状态
                player.statusEffects.push(freeRentEffect);
                console.log(`[FreeRentCard] 添加新免租状态`);
            }

            return {
                success: true,
                effectId: effectId,
                effect: freeRentEffect
            };

        } catch (error) {
            console.error(`[FreeRentCard] 免租状态添加失败:`, error);
            return {
                success: false,
                error: '状态效果添加失败'
            };
        }
    }

    /**
     * 检查玩家是否有激活的免租状态
     * @param player 玩家对象
     */
    private hasActiveFreeRentStatus(player: any): boolean {
        if (!player.statusEffects) {
            return false;
        }

        const freeRentEffect = player.statusEffects.find((effect: any) => 
            effect.type === 'free_rent' && effect.remainingUses > 0
        );

        return !!freeRentEffect;
    }

    /**
     * 触发免租效果（在支付租金时调用）
     * @param player 玩家对象
     * @param originalRentAmount 原始租金金额
     * @param propertyInfo 地产信息
     */
    public triggerFreeRent(player: any, originalRentAmount: number, propertyInfo: any): FreeRentTriggerResult {
        if (!player.statusEffects) {
            return { triggered: false, reason: 'no_status_effects' };
        }

        const freeRentEffect = player.statusEffects.find((effect: any) => 
            effect.type === 'free_rent' && effect.remainingUses > 0
        );

        if (!freeRentEffect) {
            return { triggered: false, reason: 'no_free_rent_status' };
        }

        // 检查是否自动使用
        if (!this.autoUse && !freeRentEffect.autoUse) {
            return { triggered: false, reason: 'manual_use_required' };
        }

        // 检查免租金额限制
        let actualFreeAmount = originalRentAmount;
        if (freeRentEffect.maxFreeAmount > 0 && originalRentAmount > freeRentEffect.maxFreeAmount) {
            actualFreeAmount = freeRentEffect.maxFreeAmount;
        }

        // 消耗一次免租次数
        freeRentEffect.remainingUses--;

        // 如果用完了，移除状态效果
        if (freeRentEffect.remainingUses <= 0) {
            const effectIndex = player.statusEffects.indexOf(freeRentEffect);
            if (effectIndex !== -1) {
                player.statusEffects.splice(effectIndex, 1);
            }
        }

        // 添加使用记录
        this.addFreeRentRecord(player.id, originalRentAmount, actualFreeAmount, propertyInfo);

        console.log(`[FreeRentCard] 免租效果触发，节省 ${actualFreeAmount} 金币租金`);

        return {
            triggered: true,
            originalAmount: originalRentAmount,
            freeAmount: actualFreeAmount,
            remainingUses: freeRentEffect.remainingUses,
            statusRemoved: freeRentEffect.remainingUses <= 0
        };
    }

    /**
     * 显示确认界面
     * @param context 使用上下文
     */
    private async showConfirmationUI(context: CardUseContext): Promise<boolean> {
        // TODO: 实现确认界面
        console.log('[FreeRentCard] 显示免租卡使用确认界面（待实现）');
        
        // 临时实现：直接返回确认
        return new Promise((resolve) => {
            this.scheduleOnce(() => {
                resolve(true);
            }, 0.5);
        });
    }

    /**
     * 播放免租特效
     * @param player 玩家对象
     */
    private async playFreeRentEffect(player: any): Promise<void> {
        console.log(`[FreeRentCard] 播放免租特效，玩家: ${player.nickname}`);
        
        // TODO: 实现免租特效
        // 可以包括：
        // 1. 玩家身上的保护光环
        // 2. 免租状态图标显示
        // 3. 获得保护音效
        // 4. UI状态栏更新
        
        return new Promise((resolve) => {
            this.scheduleOnce(() => {
                resolve();
            }, 1.5);
        });
    }

    /**
     * 添加免租使用记录
     * @param playerId 玩家ID
     * @param originalAmount 原始金额
     * @param freeAmount 免除金额
     * @param propertyInfo 地产信息
     */
    private addFreeRentRecord(playerId: string, originalAmount: number, freeAmount: number, propertyInfo: any): void {
        const record: FreeRentRecord = {
            playerId: playerId,
            originalRentAmount: originalAmount,
            freeRentAmount: freeAmount,
            propertyTileId: propertyInfo?.tileId || 0,
            propertyName: propertyInfo?.name || 'Unknown Property',
            propertyOwnerId: propertyInfo?.ownerId || 'unknown',
            timestamp: Date.now()
        };

        this._freeRentHistory.push(record);

        // 限制历史记录大小
        if (this._freeRentHistory.length > this.MAX_HISTORY_SIZE) {
            this._freeRentHistory.shift();
        }
    }

    // ========================= 回调方法 =========================

    /**
     * 卡片初始化回调
     */
    protected onCardInitialized(cardData: any, cardInstance: any): void {
        super.onCardInitialized(cardData, cardInstance);
        
        // 清空免租历史
        this._freeRentHistory = [];
        
        console.log(`[FreeRentCard] 免租卡片初始化完成`);
    }

    // ========================= 公共方法 =========================

    /**
     * 设置免租次数
     * @param count 免租次数
     */
    public setFreeRentCount(count: number): void {
        if (count >= 1 && count <= 10) {
            this.freeRentCount = count;
            console.log(`[FreeRentCard] 免租次数设置为: ${count}`);
        } else {
            console.warn(`[FreeRentCard] 无效的免租次数: ${count}`);
        }
    }

    /**
     * 设置最大免租金额
     * @param amount 最大金额（0表示无限制）
     */
    public setMaxFreeRentAmount(amount: number): void {
        if (amount >= 0) {
            this.maxFreeRentAmount = amount;
            console.log(`[FreeRentCard] 最大免租金额设置为: ${amount === 0 ? '无限制' : amount + ' 金币'}`);
        } else {
            console.warn(`[FreeRentCard] 无效的最大免租金额: ${amount}`);
        }
    }

    /**
     * 手动触发免租（供玩家主动使用）
     * @param player 玩家对象
     * @param rentAmount 租金金额
     * @param propertyInfo 地产信息
     */
    public manualTriggerFreeRent(player: any, rentAmount: number, propertyInfo: any): FreeRentTriggerResult {
        // 暂时启用自动使用以触发效果
        const originalAutoUse = this.autoUse;
        this.autoUse = true;
        
        const result = this.triggerFreeRent(player, rentAmount, propertyInfo);
        
        // 恢复原始设置
        this.autoUse = originalAutoUse;
        
        return result;
    }

    /**
     * 获取玩家的免租状态信息
     * @param player 玩家对象
     */
    public getFreeRentStatus(player: any): {
        hasStatus: boolean;
        remainingUses: number;
        remainingTurns: number;
        maxFreeAmount: number;
    } | null {
        if (!player.statusEffects) {
            return null;
        }

        const freeRentEffect = player.statusEffects.find((effect: any) => 
            effect.type === 'free_rent' && effect.remainingUses > 0
        );

        if (!freeRentEffect) {
            return null;
        }

        return {
            hasStatus: true,
            remainingUses: freeRentEffect.remainingUses,
            remainingTurns: freeRentEffect.remainingTurns,
            maxFreeAmount: freeRentEffect.maxFreeAmount || 0
        };
    }

    /**
     * 获取免租历史记录
     */
    public getFreeRentHistory(): FreeRentRecord[] {
        return [...this._freeRentHistory];
    }

    /**
     * 清空免租历史
     */
    public clearFreeRentHistory(): void {
        this._freeRentHistory = [];
        console.log('[FreeRentCard] 免租历史已清空');
    }

    /**
     * 获取免租统计信息
     */
    public getFreeRentStats(): {
        totalFreeRents: number;
        totalMoneySaved: number;
        averageSaved: number;
        largestSaving: number;
        recentFreeRents: FreeRentRecord[];
    } {
        const totalFreeRents = this._freeRentHistory.length;
        const totalMoneySaved = this._freeRentHistory.reduce((sum, record) => sum + record.freeRentAmount, 0);
        const averageSaved = totalFreeRents > 0 ? totalMoneySaved / totalFreeRents : 0;
        const largestSaving = this._freeRentHistory.length > 0 ? 
            Math.max(...this._freeRentHistory.map(r => r.freeRentAmount)) : 0;
        const recentFreeRents = this._freeRentHistory.slice(-5); // 最近5次免租

        return {
            totalFreeRents,
            totalMoneySaved,
            averageSaved: Math.round(averageSaved * 100) / 100,
            largestSaving,
            recentFreeRents
        };
    }

    /**
     * 更新免租状态（每回合调用）
     * @param player 玩家对象
     */
    public updateFreeRentStatus(player: any): void {
        if (!player.statusEffects) {
            return;
        }

        const freeRentEffects = player.statusEffects.filter((effect: any) => effect.type === 'free_rent');
        
        for (const effect of freeRentEffects) {
            // 减少剩余回合数（如果有限制）
            if (effect.remainingTurns > 0) {
                effect.remainingTurns--;
                
                // 如果回合数用完，移除状态
                if (effect.remainingTurns <= 0) {
                    const effectIndex = player.statusEffects.indexOf(effect);
                    if (effectIndex !== -1) {
                        player.statusEffects.splice(effectIndex, 1);
                        console.log(`[FreeRentCard] 免租状态因回合数耗尽而移除`);
                    }
                }
            }
        }
    }

    /**
     * 获取卡片的详细使用说明
     */
    public getUsageInstructions(): string {
        const countText = this.freeRentCount === 1 ? '1次' : `${this.freeRentCount}次`;
        const amountText = this.maxFreeRentAmount > 0 ? 
            `，单次最多免除${this.maxFreeRentAmount}金币` : '，金额无限制';
        const durationText = this.effectDuration > 0 ? 
            `，${this.effectDuration}回合内有效` : '，直到使用完毕';
        const autoText = this.autoUse ? '自动触发' : '需手动触发';

        return `使用免租卡可以避免支付租金。\n` +
               `- 给自己添加免租状态\n` +
               `- 可免除${countText}租金支付${amountText}\n` +
               `- ${durationText}\n` +
               `- 踩到敌方地产时${autoText}`;
    }
}

// ========================= 相关类型定义 =========================

/**
 * 免租记录接口
 */
interface FreeRentRecord {
    /** 玩家ID */
    playerId: string;
    /** 原始租金金额 */
    originalRentAmount: number;
    /** 免除的租金金额 */
    freeRentAmount: number;
    /** 地产地块ID */
    propertyTileId: number;
    /** 地产名称 */
    propertyName: string;
    /** 地产拥有者ID */
    propertyOwnerId: string;
    /** 免租时间戳 */
    timestamp: number;
}

/**
 * 状态效果结果接口
 */
interface StatusEffectResult {
    /** 是否成功 */
    success: boolean;
    /** 效果ID */
    effectId?: string;
    /** 效果对象 */
    effect?: any;
    /** 错误信息（如果失败） */
    error?: string;
}

/**
 * 免租触发结果接口
 */
interface FreeRentTriggerResult {
    /** 是否成功触发 */
    triggered: boolean;
    /** 原始租金金额 */
    originalAmount?: number;
    /** 免除的金额 */
    freeAmount?: number;
    /** 剩余使用次数 */
    remainingUses?: number;
    /** 状态是否被移除 */
    statusRemoved?: boolean;
    /** 未触发原因 */
    reason?: string;
}