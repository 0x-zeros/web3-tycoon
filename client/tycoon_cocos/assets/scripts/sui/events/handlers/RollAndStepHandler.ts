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
import type { RollAndStepActionEvent } from '../types/RollAndStepEvent';
import { EventType } from '../types';
import { RollAndStepAction } from '../actions/RollAndStepAction';
import { EventBus } from '../../events/EventBus';
import { EventTypes } from '../../events/EventTypes';
import { Blackboard } from '../../events/Blackboard';

/**
 * RollAndStepHandler 类
 */
export class RollAndStepHandler {
    /** 单例实例 */
    private static _instance: RollAndStepHandler | null = null;

    /** 当前播放的 action */
    private currentAction: RollAndStepAction | null = null;

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
            // 1. 更新 GameSession 数据
            await this.updateGameSession(event);

            // 2. 创建 RollAndStepAction 播放实例
            const action = new RollAndStepAction(event, {
                stepDelay: 800,        // 每步延迟 800ms
                autoPlay: true,        // 自动播放
                playbackSpeed: 1.0     // 正常速度
            });

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

        // 获取 GameSession
        const session = Blackboard.instance.get<any>("currentGameSession");
        if (!session) {
            console.warn('[RollAndStepHandler] GameSession 未找到');
            return;
        }

        // 找到对应的玩家
        const player = session.getPlayerByAddress(event.player);
        if (!player) {
            console.warn('[RollAndStepHandler] 玩家未找到', event.player);
            return;
        }

        // TODO: 从链上重新获取完整的 Game 数据，然后更新 GameSession
        // 目前只更新关键字段
        console.log('[RollAndStepHandler] 更新玩家位置', {
            from: event.from,
            to: event.end_pos
        });

        // 注意：实际的数据更新应该在链上查询后进行
        // 这里只是示例，实际实现需要完整的状态同步机制
    }

    /**
     * 处理步骤开始
     */
    private async handleStepStart(
        step: any,
        index: number,
        event: RollAndStepActionEvent
    ): Promise<void> {
        // 获取 GameSession 和玩家
        const session = Blackboard.instance.get<any>("currentGameSession");
        if (!session) return;

        const player = session.getPlayerByAddress(event.player);
        if (!player) return;

        // 触发玩家移动动画
        // TODO: 调用 Player 的移动方法
        // await player.moveTo(step.to_tile);

        console.log(`[RollAndStepHandler] 玩家移动: ${step.from_tile} -> ${step.to_tile}`);
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
            // TODO: 显示停留效果 UI（租金提示、卡牌获取等）
        }

        // 处理 NPC 交互
        if (step.npc_event) {
            console.log('[RollAndStepHandler] 处理 NPC 交互', step.npc_event);
            // TODO: 播放 NPC 交互动画
        }

        // 处理路过获得的卡牌
        if (step.pass_draws && step.pass_draws.length > 0) {
            console.log('[RollAndStepHandler] 处理路过卡牌', step.pass_draws);
            // TODO: 显示卡牌获取动画
        }
    }

    /**
     * 处理播放完成
     */
    private async handlePlaybackComplete(event: RollAndStepActionEvent): Promise<void> {
        console.log('[RollAndStepHandler] 所有步骤播放完成');

        // 处理现金变动
        if (event.cash_changes && event.cash_changes.length > 0) {
            console.log('[RollAndStepHandler] 处理现金变动', event.cash_changes);
            // TODO: 更新玩家现金显示
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

        // TODO: 检查是否有待决策状态（如购买地产、支付租金等）
        // 如果有，显示决策 UI
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
