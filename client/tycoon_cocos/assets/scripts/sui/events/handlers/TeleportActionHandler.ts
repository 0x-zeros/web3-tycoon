/**
 * TeleportActionHandler - TeleportActionEvent 事件处理器
 *
 * 职责：
 * 1. 监听链上的 TeleportActionEvent 事件
 * 2. 更新目标玩家位置
 * 3. 执行视觉瞬移动画
 * 4. 显示通知
 *
 * 注意：瞬移卡本身只改变位置，瞬移自己时通过合并 PTB 触发停留效果
 * Buff 通过 UseCardActionEvent 的 buff_changes 处理，这里不需要处理
 *
 * @author Web3 Tycoon Team
 */

import type { EventMetadata } from '../types';
import type { TeleportActionEvent } from '../types/TeleportActionEvent';
import { Blackboard } from '../../../events/Blackboard';
import { UINotification } from '../../../ui/utils/UINotification';

/**
 * TeleportActionHandler 类
 */
export class TeleportActionHandler {
    /** 单例实例 */
    private static _instance: TeleportActionHandler | null = null;

    private constructor() {
        console.log('[TeleportActionHandler] Handler 创建');
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): TeleportActionHandler {
        if (!TeleportActionHandler._instance) {
            TeleportActionHandler._instance = new TeleportActionHandler();
        }
        return TeleportActionHandler._instance;
    }

    /**
     * 处理 TeleportActionEvent 事件
     */
    public async handleEvent(metadata: EventMetadata<TeleportActionEvent>): Promise<void> {
        console.log('[TeleportActionHandler] 收到 TeleportActionEvent', metadata);

        const event = metadata.data;

        try {
            // 获取 GameSession
            const session = Blackboard.instance.get<any>("currentGameSession");
            if (!session) {
                console.warn('[TeleportActionHandler] GameSession not found');
                return;
            }

            // 1. 通过 index 获取被瞬移的玩家
            const targetPlayer = session.getPlayerByIndex(event.target_player);
            if (!targetPlayer) {
                console.warn('[TeleportActionHandler] 目标玩家未找到, index:', event.target_player);
                return;
            }

            // 2. 更新位置（瞬移不更新lastTile）
            targetPlayer.setPos(event.to_pos, false);

            // 3. 清除强制方向（与Move端同步）
            targetPlayer.setNextTileId(65535);

            // 4. 执行视觉瞬移
            const targetCenter = session.getTileWorldCenter(event.to_pos);
            if (targetCenter) {
                await targetPlayer.moveTo({
                    targetTileId: event.to_pos,
                    steps: 0,
                    targetPosition: targetCenter,
                    teleport: true
                });
            }

            // 判断是否对自己使用
            const isSelfTeleport = event.source_player === event.target_player;

            console.log('[TeleportActionHandler] 玩家已瞬移', {
                from: event.from_pos,
                to: event.to_pos,
                targetPlayer: event.target_player,
                sourcePlayer: event.source_player,
                isSelfTeleport
            });

            // 5. 显示通知
            let notificationText = '';
            if (isSelfTeleport) {
                notificationText = `瞬移到了 ${event.to_pos}`;
            } else {
                notificationText = `将玩家${event.target_player + 1}瞬移到了 ${event.to_pos}`;
            }

            UINotification.info(notificationText, '瞬移卡', 3000, 'center', {
                playerIndex: event.source_player,
                cards: [8]  // CARD_TELEPORT = 8
            });

            console.log('[TeleportActionHandler] 事件处理完成');

        } catch (error) {
            console.error('[TeleportActionHandler] 处理事件失败:', error);
        }
    }
}

// 导出单例访问器
export const teleportActionHandler = {
    get instance(): TeleportActionHandler {
        return TeleportActionHandler.getInstance();
    }
};
