/**
 * RollAndStepHandler - RollAndStepActionEvent 事件处理器
 *
 * 职责：
 * 1. 监听链上的 RollAndStepActionEvent 事件
 * 2. 更新 GameSession 数据（玩家位置、现金等）
 * 3. 创建 RollAndStepAction 播放实例
 * 4. 触发动画播放
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import type { EventMetadata } from '../types';
import type { RollAndStepActionEvent, StopEffect } from '../types/RollAndStepEvent';
import { EventType } from '../types';
import { RollAndStepAction } from '../actions/RollAndStepAction';
import { EventBus } from '../../../events/EventBus';
import { EventTypes } from '../../../events/EventTypes';
import { Blackboard } from '../../../events/Blackboard';
import { UIMessage, MessageBoxType, MessageBoxIcon } from '../../../ui/utils/UIMessage';
import { UINotification } from '../../../ui/utils/UINotification';
import { SuiManager } from '../../managers/SuiManager';
import { DecisionType } from '../../types/constants';
import type { Player } from '../../types/game';

/**
 * RollAndStepHandler 类
 */
export class RollAndStepHandler {
    /** 单例实例 */
    private static _instance: RollAndStepHandler | null = null;

    /** 当前播放的 action */
    private currentAction: RollAndStepAction | null = null;

    /** 当前 GameSession（缓存，避免重复获取） */
    private currentSession: any = null;

    private constructor() {
        console.log('[RollAndStepHandler] Handler 创建');
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): RollAndStepHandler {
        if (!RollAndStepHandler._instance) {
            RollAndStepHandler._instance = new RollAndStepHandler();
        }
        return RollAndStepHandler._instance;
    }

    /**
     * 初始化（注册事件监听）
     */
    public initialize(): void {
        console.log('[RollAndStepHandler] 初始化事件监听');

        // 监听 ROLL_AND_STEP_ACTION 事件（由 EventIndexer 触发）
        // TODO: 实际实现时需要从 EventIndexer 监听
        // EventBus.on(EventTypes.Move.RollAndStepAction, this.handleEvent.bind(this));
    }

    /**
     * 处理 RollAndStepActionEvent 事件
     *
     * @param metadata 事件元数据
     */
    public async handleEvent(metadata: EventMetadata<RollAndStepActionEvent>): Promise<void> {
        console.log('[RollAndStepHandler] 收到 RollAndStepActionEvent', metadata);

        const event = metadata.data;

        try {
            // 获取并缓存 GameSession
            this.currentSession = Blackboard.instance.get<any>("currentGameSession");
            if (!this.currentSession) {
                console.warn('[RollAndStepHandler] GameSession not found');
                return;
            }

            // 0. 发送链上骰子结果，让骰子动画停在正确的值
            // 骰子动画在 dice 点击时就开始播放（循环动画）
            // 收到链上真实值后，让动画停止在该值
            // 无论是普通骰子还是遥控骰子，都以链上返回的 dice 值为准
            EventBus.emit(EventTypes.Dice.RollResult, {
                value: event.dice,  // 链上真实骰子值（1-6 或遥控骰子时可能更大）
                source: 'chain'
            });

            console.log('[RollAndStepHandler] 发送骰子结果:', event.dice);

            // TODO: DiceController 需要监听 Dice.RollResult 事件
            // 在收到后停止循环动画，播放减速到目标值的动画

            // 1. 更新 GameSession 数据
            await this.updateGameSession(event);

            // 2. 创建 RollAndStepAction 播放实例
            const action = new RollAndStepAction(
                event,
                this.currentSession,  // 传递缓存的 session
                {
                    stepDelay: 400,        // 每步延迟 400ms（缩短间隔）
                    autoPlay: true,        // 自动播放
                    playbackSpeed: 1.0     // 正常速度
                }
            );

            // 3. 注册回调
            action
                .onStepStart(async (step, index) => {
                    console.log(`[RollAndStepHandler] Step ${index} 开始`, step);
                    await this.handleStepStart(step, index, event);
                })
                .onStepComplete(async (step, index) => {
                    console.log(`[RollAndStepHandler] Step ${index} 完成`, step);
                    await this.handleStepComplete(step, index, event);
                })
                .onComplete(async () => {
                    console.log('[RollAndStepHandler] 播放完成');
                    await this.handlePlaybackComplete(event);
                })
                .onError((error) => {
                    console.error('[RollAndStepHandler] 播放错误', error);
                    this.handlePlaybackError(error, event);
                });

            // 4. 保存当前 action
            this.currentAction = action;

            // 5. 开始播放
            await action.play();

        } catch (error) {
            console.error('[RollAndStepHandler] 处理事件失败', error);
            // TODO: 触发错误事件
        }
    }

    /**
     * 更新 GameSession 数据
     *
     * 根据事件更新玩家的最终位置、现金等
     *
     * @param event RollAndStepActionEvent
     */
    private async updateGameSession(event: RollAndStepActionEvent): Promise<void> {
        console.log('[RollAndStepHandler] 更新 GameSession 数据');

        // 使用缓存的 GameSession
        const session = this.currentSession;

        // 找到对应的玩家
        const player = session.getPlayerByAddress(event.player);
        if (!player) {
            console.warn('[RollAndStepHandler] 玩家未找到', event.player);
            return;
        }

        // TODO: 从链上重新获取完整的 Game 数据
        // 完整的状态同步机制（推荐在播放完成后执行）：
        //
        // const { SuiManager } = await import('../../managers/SuiManager');
        // const updatedGame = await SuiManager.instance.getGameState(event.game);
        //
        // if (!updatedGame) {
        //     console.error('[RollAndStepHandler] Failed to get updated game state');
        //     return;
        // }
        //
        // // 获取当前玩家的索引
        // const playerIndex = player.getPlayerIndex();
        //
        // // 更新玩家数据（从 Move Player 重新加载）
        // player.loadFromMovePlayer(updatedGame.players[playerIndex], playerIndex);
        //
        // // 更新 GameSession 的其他状态
        // const template = session.getMapTemplate();
        // const gameData = session.getGameData();
        //
        // if (template && gameData) {
        //     await session.loadFromMoveGame(updatedGame, template, gameData);
        // }
        //
        // console.log('[RollAndStepHandler] GameSession 状态同步完成');

        // 目前使用轻量级更新（仅日志）
        console.log('[RollAndStepHandler] 更新玩家位置', {
            from: event.from,
            to: event.end_pos,
            dice: event.dice,
            steps: event.steps.length
        });

        // 注意：实际的数据更新应该在链上查询后进行
        // 动画播放期间可以使用事件数据进行乐观更新
        // 播放完成后再从链上获取权威状态
    }

    /**
     * 处理步骤开始
     */
    private async handleStepStart(
        step: any,
        index: number,
        event: RollAndStepActionEvent
    ): Promise<void> {
        // 使用缓存的 GameSession
        const session = this.currentSession;

        const player = session.getPlayerByAddress(event.player);
        if (!player) return;

        // 获取目标 tile 的顶部中心点
        const targetCenter = session.getTileWorldCenter(step.to_tile);

        // 触发玩家移动动画（根据玩家索引使用不同动画）
        try {
            await player.moveTo({
                targetTileId: step.to_tile,
                steps: 1,
                path: [step.to_tile],
                targetPosition: targetCenter,  // Tile 顶部中心点
                playerIndex: player.getPlayerIndex()  // 玩家索引（用于选择动画）
            });

            console.log(`[RollAndStepHandler] 玩家移动完成: ${step.from_tile} -> ${step.to_tile}`);
        } catch (error) {
            console.error('[RollAndStepHandler] 玩家移动失败', error);
        }
    }

    /**
     * 处理步骤完成
     */
    private async handleStepComplete(
        step: any,
        index: number,
        event: RollAndStepActionEvent
    ): Promise<void> {
        // 处理停留效果（如收租、奖金等）
        if (step.stop_effect) {
            console.log('[RollAndStepHandler] 处理停留效果', step.stop_effect);

            // TODO: 显示停留效果 UI
            // 根据 stop_type 显示不同的 UI 效果：
            //
            // - StopType.BUILDING_TOLL (1): 支付过路费
            //   显示：租金飞字动画，从玩家飞向地产所有者
            //   金额：step.stop_effect.amount
            //   所有者：step.stop_effect.owner
            //
            // - StopType.BUILDING_NO_RENT (2): 免租通过
            //   显示：免租提示（"使用免租卡，免费通过"）
            //
            // - StopType.HOSPITAL (3): 送往医院
            //   显示：医院提示，停留回合数
            //   回合数：step.stop_effect.turns
            //
            // - StopType.PRISON (4): 进入监狱
            //   显示：监狱提示，停留回合数
            //   回合数：step.stop_effect.turns
            //
            // - StopType.BONUS (5): 获得奖金
            //   显示：奖金飞字动画（金币特效）
            //   金额：step.stop_effect.amount
            //
            // - StopType.FEE (6): 支付罚款
            //   显示：罚款飞字动画（负数）
            //   金额：step.stop_effect.amount
            //
            // - StopType.CARD_STOP (7): 卡片停留
            //   显示：卡牌获取动画
            //   卡牌：step.stop_effect.card_gains
            //
            // - StopType.BUILDING_UNOWNED (8): 无主建筑（可购买）
            //   显示：购买提示 UI（触发待决策状态）
            //   价格：step.stop_effect.amount
            //   等级：step.stop_effect.level
        }

        // 处理 NPC 交互
        if (step.npc_event) {
            console.log('[RollAndStepHandler] 处理 NPC 交互', step.npc_event);

            // TODO: 播放 NPC 交互动画
            // 根据 NPC result 播放不同动画：
            //
            // - NpcResult.SEND_HOSPITAL (1): 送往医院
            //   动画：炸弹爆炸特效 + 玩家被击飞
            //   目标：step.npc_event.result_tile（医院位置）
            //
            // - NpcResult.BARRIER_STOP (2): 路障阻挡
            //   动画：路障震动 + 玩家被弹回
            //   效果：停止前进，剩余步数作废
            //
            // 如果 consumed === true，播放 NPC 消耗动画（消失特效）
        }

        // 处理路过获得的卡牌
        if (step.pass_draws && step.pass_draws.length > 0) {
            console.log('[RollAndStepHandler] 处理路过卡牌', step.pass_draws);

            // TODO: 显示卡牌获取动画
            // 每个卡牌：
            // - 从地块位置飞向玩家
            // - 显示卡牌图标和数量（+count）
            // - 播放获取音效
            //
            // 数据：step.pass_draws 数组
            // 格式：{ tile_id, kind, count, is_pass: true }
        }
    }

    /**
     * 处理播放完成
     */
    private async handlePlaybackComplete(event: RollAndStepActionEvent): Promise<void> {
        console.log('[RollAndStepHandler] 所有步骤播放完成');

        // 使用缓存的 GameSession
        const session = this.currentSession;

        if (session) {
            // 1. 检查事件是否属于当前游戏
            if (event.game !== session.getGameId()) {
                console.warn('[RollAndStepHandler] Event game mismatch, ignoring', {
                    eventGame: event.game,
                    currentGame: session.getGameId()
                });
                return;
            }

            // 2. 使用事件数据更新 GameSession（而不是重新查询 Game）
            // RollAndStepActionEvent 包含 round 和 turn_in_round
            // GameSession 通过事件保持与链上同步，不需要重新查询
            session.setRound(event.round);
            session.setTurn(event.turn_in_round);

            console.log('[RollAndStepHandler] 回合状态已同步（from event）', {
                round: event.round,
                turn: event.turn_in_round
            });
        }

        // 处理现金变动
        if (event.cash_changes && event.cash_changes.length > 0) {
            console.log('[RollAndStepHandler] 处理现金变动', event.cash_changes);

            // TODO: 更新玩家现金显示
            // 遍历所有 cash_changes，更新对应玩家的现金：
            //
            // for (const change of event.cash_changes) {
            //     const player = session.getPlayerByAddress(change.player);
            //     if (player) {
            //         // 更新玩家现金（根据 is_debit）
            //         const newCash = change.is_debit
            //             ? player.getCash() - change.amount
            //             : player.getCash() + change.amount;
            //
            //         player.setCash(newCash);  // 需要在 Player 类中添加 setCash 方法
            //
            //         // 触发现金飞字动画
            //         EventBus.emit(EventTypes.Player.MoneyChange, {
            //             player: change.player,
            //             amount: change.is_debit ? -change.amount : change.amount,
            //             reason: change.reason,  // CashReason 枚举
            //             details: change.details
            //         });
            //     }
            // }
        }

        // 清除当前 action
        this.currentAction = null;

        // 触发完成事件
        EventBus.emit(EventTypes.Game.PlayerMove, {
            player: event.player,
            from: event.from,
            to: event.end_pos,
            steps: event.steps.length
        });

        // 检查是否有待决策状态
        await this._handleDecisionIfNeeded(event);
    }

    /**
     * 处理播放错误
     */
    private handlePlaybackError(error: Error, event: RollAndStepActionEvent): void {
        console.error('[RollAndStepHandler] 播放错误', error, event);

        // 清除当前 action
        this.currentAction = null;

        // TODO: 显示错误提示
        // UINotification.error(`动作播放失败: ${error.message}`);
    }

    /**
     * 获取当前播放的 action
     */
    public getCurrentAction(): RollAndStepAction | null {
        return this.currentAction;
    }

    /**
     * 是否正在播放
     */
    public isPlaying(): boolean {
        return this.currentAction !== null && this.currentAction.isPlaying();
    }

    /**
     * 停止当前播放
     */
    public stopCurrentAction(): void {
        if (this.currentAction) {
            this.currentAction.stop();
            this.currentAction = null;
        }
    }

    // ==================== 决策处理 ====================

    /**
     * 检查并处理待决策状态
     */
    private async _handleDecisionIfNeeded(event: RollAndStepActionEvent): Promise<void> {
        const lastStep = event.steps[event.steps.length - 1];
        const stopEffect = lastStep?.stop_effect;

        // 检查是否需要决策
        if (!stopEffect ||
            stopEffect.pending_decision === undefined ||
            stopEffect.pending_decision === DecisionType.NONE) {
            return; // 无需决策
        }

        console.log('[RollAndStepHandler] 检测到待决策', {
            decisionType: stopEffect.pending_decision,
            amount: stopEffect.decision_amount
        });

        // 使用缓存的 GameSession
        const session = this.currentSession;

        const player = session.getActivePlayer();
        if (!player) {
            console.warn('[RollAndStepHandler] Active player not found');
            return;
        }

        const canAfford = Number(player.getCash()) >= Number(stopEffect.decision_amount);

        // 显示决策 MessageBox
        await this._showDecisionDialog(stopEffect, player, canAfford, session);
    }

    /**
     * 显示决策对话框
     */
    private async _showDecisionDialog(
        stopEffect: StopEffect,
        player: Player,
        canAfford: boolean,
        session: any
    ): Promise<void> {
        const decisionType = stopEffect.pending_decision;

        if (decisionType === DecisionType.BUY_PROPERTY) {
            await this._showBuyDialog(stopEffect, player, canAfford, session);
        } else if (decisionType === DecisionType.UPGRADE_PROPERTY) {
            await this._showUpgradeDialog(stopEffect, player, canAfford, session);
        } else if (decisionType === DecisionType.PAY_RENT) {
            await this._showRentDialog(stopEffect, player, canAfford, session);
        }
    }

    /**
     * 显示购买对话框
     */
    private async _showBuyDialog(
        stopEffect: StopEffect,
        player: Player,
        canAfford: boolean,
        session: any
    ): Promise<void> {
        const price = Number(stopEffect.decision_amount);
        const balance = Number(player.getCash());

        await UIMessage.show({
            title: "购买建筑",
            message: `购买价格：${price}\n当前现金：${balance}${canAfford ? '' : ' (现金不足)'}\n购买后余额：${balance - price}`,
            icon: MessageBoxIcon.NONE,
            type: MessageBoxType.STYLE1,
            buttons: {
                primary: {
                    text: canAfford ? "购买" : "购买 (现金不足)",
                    callback: async () => {
                        if (!canAfford) {
                            UINotification.warning('现金不足，无法购买');
                            return;
                        }
                        await this._executeBuyBuilding(session);
                    }
                },
                secondary: {
                    text: "跳过",
                    visible: true,
                    callback: async () => {
                        await this._executeSkipDecision(session);
                    }
                },
                close: {
                    visible: false
                }
            }
        });
    }

    /**
     * 显示升级对话框
     */
    private async _showUpgradeDialog(
        stopEffect: StopEffect,
        player: Player,
        canAfford: boolean,
        session: any
    ): Promise<void> {
        const price = Number(stopEffect.decision_amount);
        const balance = Number(player.getCash());
        const currentLevel = stopEffect.level ?? 0;

        await UIMessage.show({
            title: "升级建筑",
            message: `当前等级：${currentLevel}\n升级价格：${price}\n当前现金：${balance}${canAfford ? '' : ' (现金不足)'}\n升级后余额：${balance - price}`,
            icon: MessageBoxIcon.NONE,
            type: MessageBoxType.STYLE1,
            buttons: {
                primary: {
                    text: canAfford ? "升级" : "升级 (现金不足)",
                    callback: async () => {
                        if (!canAfford) {
                            UINotification.warning('现金不足，无法升级');
                            return;
                        }
                        await this._executeUpgradeBuilding(session);
                    }
                },
                secondary: {
                    text: "跳过",
                    visible: true,
                    callback: async () => {
                        await this._executeSkipDecision(session);
                    }
                },
                close: {
                    visible: false
                }
            }
        });
    }

    /**
     * 显示租金对话框
     */
    private async _showRentDialog(
        stopEffect: StopEffect,
        player: Player,
        canAfford: boolean,
        session: any
    ): Promise<void> {
        const rent = Number(stopEffect.decision_amount);
        const balance = Number(player.getCash());
        const owner = stopEffect.owner ?? '未知';

        // 检查是否有免租卡（kind=3 是免租卡）
        const hasRentFreeCard = player.getCardCount(3) > 0;

        await UIMessage.show({
            title: "支付租金",
            message: `地产所有者：${owner}\n租金金额：${rent}\n当前现金：${balance}\n${hasRentFreeCard ? '(持有免租卡)' : ''}`,
            icon: MessageBoxIcon.WARNING,
            type: MessageBoxType.STYLE1,
            buttons: {
                primary: {
                    text: "使用免租卡",
                    visible: hasRentFreeCard,
                    callback: async () => {
                        await this._executePayRent(session, true);
                    }
                },
                secondary: {
                    text: "支付现金",
                    visible: true,
                    // TODO: 当 MessageBoxButtonConfig 支持 disabled 时启用
                    // disabled: !canAfford,
                    callback: async () => {
                        if (!canAfford) {
                            UINotification.error('现金不足，将破产');
                            // 仍然允许执行（链上会处理破产逻辑）
                        }
                        await this._executePayRent(session, false);
                    }
                },
                btn_3: {
                    text: "取消",
                    visible: true,
                    callback: () => {
                        UINotification.info('已取消支付');
                    }
                },
                close: {
                    visible: false
                }
            }
        });
    }

    /**
     * 执行购买建筑
     */
    private async _executeBuyBuilding(session: any): Promise<void> {
        try {
            const suiManager = SuiManager.instance;
            const tx = suiManager.gameClient.game.buildBuyBuildingTx(
                session.getGameId(),
                session.getMySeat().id,
                session.getTemplateMapId()
            );

            await suiManager.signAndExecuteTransaction(tx);
            UINotification.success('建筑购买成功');
            console.log('[RollAndStepHandler] 建筑购买成功');

        } catch (error) {
            console.error('[RollAndStepHandler] 购买建筑失败', error);
            UINotification.error('购买失败');
        }
    }

    /**
     * 执行升级建筑
     */
    private async _executeUpgradeBuilding(session: any): Promise<void> {
        try {
            const suiManager = SuiManager.instance;
            const tx = suiManager.gameClient.game.buildUpgradeBuildingTx(
                session.getGameId(),
                session.getMySeat().id,
                session.getTemplateMapId()
            );

            await suiManager.signAndExecuteTransaction(tx);
            UINotification.success('建筑升级成功');
            console.log('[RollAndStepHandler] 建筑升级成功');

        } catch (error) {
            console.error('[RollAndStepHandler] 升级建筑失败', error);
            UINotification.error('升级失败');
        }
    }

    /**
     * 执行支付租金
     */
    private async _executePayRent(session: any, useRentFree: boolean): Promise<void> {
        try {
            const suiManager = SuiManager.instance;
            let tx;

            if (useRentFree) {
                // 使用免租卡支付
                tx = suiManager.gameClient.game.buildPayRentWithCardTx(
                    session.getGameId(),
                    session.getMySeat().id,
                    session.getTemplateMapId()
                );
            } else {
                // 使用现金支付
                tx = suiManager.gameClient.game.buildPayRentWithCashTx(
                    session.getGameId(),
                    session.getMySeat().id,
                    session.getTemplateMapId()
                );
            }

            await suiManager.signAndExecuteTransaction(tx);
            UINotification.success(useRentFree ? '已使用免租卡' : '租金支付成功');
            console.log('[RollAndStepHandler] 租金支付成功', { useRentFree });

        } catch (error) {
            console.error('[RollAndStepHandler] 支付租金失败', error);
            UINotification.error('支付失败');
        }
    }

    /**
     * 执行跳过决策
     */
    private async _executeSkipDecision(session: any): Promise<void> {
        try {
            const suiManager = SuiManager.instance;
            const tx = suiManager.gameClient.game.buildSkipBuildingDecisionTx(
                session.getGameId(),
                session.getMySeat().id,
                session.getTemplateMapId()
            );

            await suiManager.signAndExecuteTransaction(tx);
            UINotification.info('已跳过');
            console.log('[RollAndStepHandler] 已跳过决策');

        } catch (error) {
            console.error('[RollAndStepHandler] 跳过决策失败', error);
            UINotification.error('操作失败');
        }
    }

    /**
     * 销毁
     */
    public destroy(): void {
        this.stopCurrentAction();
        RollAndStepHandler._instance = null;
        console.log('[RollAndStepHandler] Handler 销毁');
    }
}

// 导出单例访问器
export const rollAndStepHandler = {
    get instance(): RollAndStepHandler {
        return RollAndStepHandler.getInstance();
    }
};
