/**
 * BankruptHandler - 玩家破产事件处理器
 *
 * 职责：
 * 1. 监听链上的 BankruptEvent 事件
 * 2. 更新 GameSession 中的玩家破产状态
 * 3. 显示 UIBankruptcy 通知（5秒后自动消失）
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import type { EventMetadata, BankruptEvent } from '../types';
import { Blackboard } from '../../../events/Blackboard';
import { IdFormatter } from '../../../ui/utils/IdFormatter';
import type { GameSession } from '../../../core/GameSession';

/**
 * BankruptHandler 类
 */
export class BankruptHandler {
    /** 单例实例 */
    private static _instance: BankruptHandler | null = null;

    private constructor() {
        console.log('[BankruptHandler] Handler 创建');
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): BankruptHandler {
        if (!BankruptHandler._instance) {
            BankruptHandler._instance = new BankruptHandler();
        }
        return BankruptHandler._instance;
    }

    /**
     * 初始化（注册事件监听）
     */
    public initialize(): void {
        console.log('[BankruptHandler] 初始化事件监听');
        // TODO: 实际实现时需要从 EventIndexer 监听
        // EventBus.on(EventTypes.Move.PlayerBankrupt, this.handleEvent.bind(this));
    }

    /**
     * 处理 BankruptEvent 事件
     *
     * @param metadata 事件元数据
     */
    public async handleEvent(metadata: EventMetadata<BankruptEvent>): Promise<void> {
        console.log('[BankruptHandler] 收到 BankruptEvent', metadata);

        const event = metadata.data;

        try {
            // 获取 GameSession
            const session = Blackboard.instance.get<GameSession>("currentGameSession");
            if (!session) {
                console.warn('[BankruptHandler] GameSession not found');
                return;
            }

            // 1. 检查事件是否属于当前游戏
            if (event.game !== session.getGameId()) {
                console.warn('[BankruptHandler] Event game mismatch, ignoring', {
                    eventGame: event.game,
                    currentGame: session.getGameId()
                });
                return;
            }

            // 2. 更新玩家破产状态（通过索引）
            const player = session.getPlayerByIndex(event.player);
            if (!player) {
                console.warn('[BankruptHandler] Player not found, index:', event.player);
                return;
            }

            player.setBankrupt(true);

            console.log('[BankruptHandler] 玩家破产状态已更新', {
                playerIndex: event.player,
                debt: event.debt,
                creditorIndex: event.creditor
            });

            // 3. 显示破产通知（5秒后自动消失）
            const playerName = player.getName() || `玩家 ${player.getPlayerIndex() + 1}`;
            const creditorPlayer = (event.creditor !== undefined && event.creditor !== null)
                ? session.getPlayerByIndex(event.creditor)
                : null;
            const creditorName = creditorPlayer?.getName()
                || ((event.creditor !== undefined && event.creditor !== null)
                    ? `玩家 ${(creditorPlayer?.getPlayerIndex() ?? event.creditor) + 1}`
                    : '银行');

            // 动态导入 UIManager（避免循环依赖）
            const { UIManager } = await import('../../../ui/core/UIManager');
            const uiManager = UIManager?.instance;
            if (uiManager) {
                await uiManager.showUI("Bankruptcy", {
                    playerName,
                    creditorName,
                    debt: event.debt
                });

                // 5秒后自动隐藏
                setTimeout(() => {
                    uiManager.hideUI("Bankruptcy");
                }, 5000);
            }

            console.log('[BankruptHandler] BankruptEvent 处理完成');

        } catch (error) {
            console.error('[BankruptHandler] 处理事件失败', error);
        }
    }

    /**
     * 销毁
     */
    public destroy(): void {
        console.log('[BankruptHandler] Handler 销毁');
        BankruptHandler._instance = null;
    }
}

// 导出单例访问器
export const bankruptHandler = {
    get instance(): BankruptHandler {
        return BankruptHandler.getInstance();
    }
};
