/**
 * GameEndedHandler - 游戏结束事件处理器
 *
 * 职责：
 * 1. 监听链上的 GameEndedEvent 事件
 * 2. 更新 GameSession 状态（status=ENDED, winner）
 * 3. 显示 UIGameEnd 界面
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import type { EventMetadata, GameEndedEvent } from '../types';
import { Blackboard } from '../../../events/Blackboard';
import { GameStatus } from '../../types/constants';
import { IdFormatter } from '../../../ui/utils/IdFormatter';
import type { GameSession } from '../../../core/GameSession';

/**
 * GameEndedHandler 类
 */
export class GameEndedHandler {
    /** 单例实例 */
    private static _instance: GameEndedHandler | null = null;

    private constructor() {
        console.log('[GameEndedHandler] Handler 创建');
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): GameEndedHandler {
        if (!GameEndedHandler._instance) {
            GameEndedHandler._instance = new GameEndedHandler();
        }
        return GameEndedHandler._instance;
    }

    /**
     * 初始化（注册事件监听）
     */
    public initialize(): void {
        console.log('[GameEndedHandler] 初始化事件监听');
        // TODO: 实际实现时需要从 EventIndexer 监听
        // EventBus.on(EventTypes.Move.GameEnded, this.handleEvent.bind(this));
    }

    /**
     * 处理 GameEndedEvent 事件
     *
     * @param metadata 事件元数据
     */
    public async handleEvent(metadata: EventMetadata<GameEndedEvent>): Promise<void> {
        console.log('[GameEndedHandler] 收到 GameEndedEvent', metadata);

        const event = metadata.data;

        try {
            // 获取 GameSession
            const session = Blackboard.instance.get<GameSession>("currentGameSession");
            if (!session) {
                console.warn('[GameEndedHandler] GameSession not found');
                return;
            }

            // 1. 检查事件是否属于当前游戏
            if (event.game !== session.getGameId()) {
                console.warn('[GameEndedHandler] Event game mismatch, ignoring', {
                    eventGame: event.game,
                    currentGame: session.getGameId()
                });
                return;
            }

            // 2. 更新 GameSession 状态（winner 现在是玩家索引）
            session.setWinner(event.winner ?? null);
            session.setStatus(GameStatus.ENDED);

            console.log('[GameEndedHandler] 游戏状态已更新', {
                status: GameStatus.ENDED,
                winnerIndex: event.winner ?? '无',
                reason: event.reason,
                round: event.round,
                turn: event.turn_in_round
            });

            // 3. 准备游戏结束信息
            const winnerName = (event.winner !== undefined && event.winner !== null)
                ? `玩家 ${event.winner + 1}`
                : '无';

            const reasonText = this._getReasonText(event.reason);

            // 4. 显示游戏结束界面
            // 动态导入 UIManager（避免循环依赖）
            const { UIManager } = await import('../../../ui/core/UIManager');
            const uiManager = UIManager?.instance;
            if (uiManager) {
                await uiManager.showUI("GameEnd", {
                    winner: event.winner,
                    winnerName,
                    reason: event.reason,
                    reasonText,
                    round: event.round,
                    turn: event.turn_in_round
                });
            }

            console.log('[GameEndedHandler] GameEndedEvent 处理完成');

        } catch (error) {
            console.error('[GameEndedHandler] 处理事件失败', error);
        }
    }

    /**
     * 获取结束原因的文本描述
     */
    private _getReasonText(reason: number): string {
        switch (reason) {
            case 0: return '正常结束';
            case 1: return '达到最大回合数';
            case 2: return '只剩一个玩家';
            default: return '未知原因';
        }
    }

    /**
     * 销毁
     */
    public destroy(): void {
        console.log('[GameEndedHandler] Handler 销毁');
        GameEndedHandler._instance = null;
    }
}

// 导出单例访问器
export const gameEndedHandler = {
    get instance(): GameEndedHandler {
        return GameEndedHandler.getInstance();
    }
};
