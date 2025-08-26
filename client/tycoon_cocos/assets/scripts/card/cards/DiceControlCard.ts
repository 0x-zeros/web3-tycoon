/**
 * 遥控骰子卡片
 * 
 * 允许玩家控制下次掷骰子的结果，可以指定1-6中的任意点数
 * 是最基础也是最实用的卡片之一，适合战术性使用
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
 * 遥控骰子卡片实现类
 * 提供骰子点数控制功能
 */
@ccclass('DiceControlCard')
export class DiceControlCard extends Card {
    
    // ========================= 编辑器属性 =========================
    
    @property({ displayName: "默认骰子点数", range: [1, 6], tooltip: "如果不选择，使用的默认点数" })
    public defaultDiceValue: number = 6;
    
    @property({ displayName: "允许重复使用", tooltip: "是否允许在同一回合内多次使用" })
    public allowMultipleUse: boolean = false;
    
    @property({ displayName: "显示选择界面", tooltip: "使用时是否弹出点数选择界面" })
    public showSelectionUI: boolean = true;
    
    // ========================= 私有属性 =========================
    
    /** 选择的骰子点数 */
    private _selectedValue: number = 6;
    
    /** 本回合已使用次数 */
    private _usedThisTurn: number = 0;
    
    // ========================= 抽象属性实现 =========================
    
    public get cardType(): CardType {
        return CardType.DICE_CONTROL;
    }
    
    public get usageTiming(): CardUsageTiming {
        return CardUsageTiming.BEFORE_DICE;
    }
    
    public get targetType(): CardTargetType {
        return CardTargetType.NONE; // 不需要选择目标
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
        
        // 检查是否已在本回合使用过（如果不允许重复使用）
        if (!this.allowMultipleUse && this._usedThisTurn > 0) {
            return {
                canUse: false,
                reasons: ['本回合已使用过遥控骰子'],
                requiredTargetType: this.targetType
            };
        }
        
        // TODO: 检查是否在正确的游戏阶段使用
        // 遥控骰子只能在掷骰子前使用
        
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
        console.log(`[DiceControlCard] 执行遥控骰子效果`);
        
        // 获取选择的点数
        let selectedValue = this._selectedValue;
        
        // 如果提供了参数，使用参数中的值
        if (context.parameters && context.parameters.diceValue) {
            selectedValue = Math.max(1, Math.min(6, context.parameters.diceValue));
        }
        
        // 如果需要显示选择界面
        if (this.showSelectionUI && !context.parameters?.diceValue) {
            selectedValue = await this.showDiceSelectionUI();
        }
        
        // 验证选择的值
        if (selectedValue < 1 || selectedValue > 6) {
            return {
                success: false,
                message: '无效的骰子点数',
                errorCode: 'INVALID_DICE_VALUE',
                appliedEffects: [],
                affectedPlayerIds: [],
                affectedTileIds: []
            };
        }
        
        // 应用骰子控制效果
        const effectResult = this.applyDiceControlEffect(context.player, selectedValue);
        
        // 增加使用计数
        this._usedThisTurn++;
        
        // 创建使用结果
        const result: CardUseResult = {
            success: true,
            message: `遥控骰子设置成功！下次掷骰结果将是 ${selectedValue} 点`,
            appliedEffects: [{
                type: CardEffectType.CONTROL_DICE,
                target: context.player.id,
                params: { controlledValue: selectedValue },
                result: effectResult
            }],
            affectedPlayerIds: [context.player.id],
            affectedTileIds: [],
            extendedData: {
                controlledDiceValue: selectedValue,
                cardType: this.cardType
            }
        };
        
        // 播放特效
        await this.playDiceControlEffect(selectedValue);
        
        return result;
    }
    
    // ========================= 特殊效果方法 =========================
    
    /**
     * 应用骰子控制效果
     * @param player 玩家
     * @param diceValue 控制的点数
     */
    private applyDiceControlEffect(player: any, diceValue: number): any {
        // 给玩家添加骰子控制状态效果
        const controlEffect = {
            effectId: `dice_control_${Date.now()}`,
            type: 'controlled_dice',
            name: '遥控骰子',
            description: `下次掷骰结果将是 ${diceValue} 点`,
            remainingTurns: 1, // 只影响下一次掷骰
            parameters: {
                controlledValue: diceValue,
                cardSource: this.cardType
            },
            source: 'dice_control_card',
            iconPath: 'icons/dice_control'
        };
        
        // 添加到玩家状态效果列表
        if (player.statusEffects) {
            // 移除之前的骰子控制效果（如果有）
            const existingIndex = player.statusEffects.findIndex((effect: any) => 
                effect.type === 'controlled_dice'
            );
            
            if (existingIndex !== -1) {
                player.statusEffects.splice(existingIndex, 1);
            }
            
            player.statusEffects.push(controlEffect);
        }
        
        console.log(`[DiceControlCard] 玩家 ${player.nickname || player.id} 获得骰子控制效果: ${diceValue}`);
        
        return {
            effectApplied: true,
            controlledValue: diceValue,
            effectDuration: 1
        };
    }
    
    /**
     * 显示骰子点数选择界面
     */
    private async showDiceSelectionUI(): Promise<number> {
        // TODO: 实现骰子点数选择UI
        // 这里应该弹出一个对话框让玩家选择1-6的点数
        
        console.log('[DiceControlCard] 显示骰子点数选择界面（待实现）');
        
        // 临时实现：返回默认值
        return new Promise((resolve) => {
            // 模拟UI选择过程
            this.scheduleOnce(() => {
                resolve(this.defaultDiceValue);
            }, 0.5);
        });
        
        // 实际实现应该类似：
        // 1. 创建选择对话框
        // 2. 显示1-6的按钮
        // 3. 等待玩家选择
        // 4. 返回选择的值
    }
    
    /**
     * 播放骰子控制特效
     * @param diceValue 控制的点数
     */
    private async playDiceControlEffect(diceValue: number): Promise<void> {
        console.log(`[DiceControlCard] 播放骰子控制特效: ${diceValue}`);
        
        // TODO: 实现骰子控制特效
        // 可以包括：
        // 1. 骰子发光效果
        // 2. 数字显示动画
        // 3. 控制音效
        // 4. 粒子特效
        
        return new Promise((resolve) => {
            this.scheduleOnce(() => {
                resolve();
            }, 1.0);
        });
    }
    
    // ========================= 回调方法 =========================
    
    /**
     * 卡片初始化回调
     */
    protected onCardInitialized(cardData: any, cardInstance: any): void {
        super.onCardInitialized(cardData, cardInstance);
        
        // 重置回合使用计数
        this._usedThisTurn = 0;
        this._selectedValue = this.defaultDiceValue;
        
        console.log(`[DiceControlCard] 遥控骰子卡片初始化完成`);
    }
    
    // ========================= 公共方法 =========================
    
    /**
     * 设置骰子点数
     * @param value 1-6的点数
     */
    public setDiceValue(value: number): void {
        if (value >= 1 && value <= 6) {
            this._selectedValue = value;
            console.log(`[DiceControlCard] 骰子点数设置为: ${value}`);
        } else {
            console.warn(`[DiceControlCard] 无效的骰子点数: ${value}`);
        }
    }
    
    /**
     * 获取当前设置的骰子点数
     */
    public getDiceValue(): number {
        return this._selectedValue;
    }
    
    /**
     * 重置回合计数（在新回合开始时调用）
     */
    public resetTurnCounter(): void {
        this._usedThisTurn = 0;
        console.log('[DiceControlCard] 回合使用计数已重置');
    }
    
    /**
     * 检查本回合是否已使用
     */
    public isUsedThisTurn(): boolean {
        return this._usedThisTurn > 0;
    }
    
    /**
     * 获取本回合使用次数
     */
    public getUsageCountThisTurn(): number {
        return this._usedThisTurn;
    }
    
    /**
     * 检查指定的骰子点数是否有效
     * @param value 要检查的点数
     */
    public static isValidDiceValue(value: number): boolean {
        return Number.isInteger(value) && value >= 1 && value <= 6;
    }
    
    /**
     * 获取卡片的详细使用说明
     */
    public getUsageInstructions(): string {
        return `使用遥控骰子可以控制下次掷骰的结果。\n` +
               `- 可选择1-6中的任意点数\n` +
               `- 只影响下一次掷骰\n` +
               `- 在掷骰子前使用\n` +
               `${this.allowMultipleUse ? '- 每回合可多次使用' : '- 每回合只能使用一次'}`;
    }
}