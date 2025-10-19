/**
 * DecisionSkippedHandler - 跳过决策事件处理器
 *
 * 职责：
 * 1. 监听链上的 DecisionSkippedEvent 事件
 * 2. 更新 GameSession 中的 turn（使用 event.turn + 1）
 * 3. 显示 notification（说明玩家跳过了哪个决策）
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import type { EventMetadata, DecisionSkippedEvent } from '../types';
import { EventType } from '../types';
import { Blackboard } from '../../../events/Blackboard';
import { EventBus } from '../../../events/EventBus';
import { EventTypes } from '../../../events/EventTypes';
import { UINotification } from '../../../ui/utils/UINotification';
import type { GameSession } from '../../../core/GameSession';
import { INVALID_TILE_ID } from '../../types/constants';

/**
 * DecisionSkippedHandler 类
 */
export class DecisionSkippedHandler {
    /** 单例实例 */
    private static _instance: DecisionSkippedHandler | null = null;

    private constructor() {
        console.log('[DecisionSkippedHandler] Handler 创建');
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): DecisionSkippedHandler {
        if (!DecisionSkippedHandler._instance) {
            DecisionSkippedHandler._instance = new DecisionSkippedHandler();
        }
        return DecisionSkippedHandler._instance;
    }

    /**
     * 初始化（注册事件监听）
     */
    public initialize(): void {
        console.log('[DecisionSkippedHandler] 初始化事件监听');
        // TODO: 实际实现时需要从 EventIndexer 监听
        // EventBus.on(EventTypes.Move.DecisionSkipped, this.handleEvent.bind(this));
    }

    /**
     * 处理 DecisionSkippedEvent 事件
     *
     * @param metadata 事件元数据
     */
    public async handleEvent(metadata: EventMetadata<DecisionSkippedEvent>): Promise<void> {
        console.log('[DecisionSkippedHandler] 收到 DecisionSkippedEvent', metadata);

        const event = metadata.data;

        try {
            // 获取 GameSession
            const session = Blackboard.instance.get<GameSession>("currentGameSession");
            if (!session) {
                console.warn('[DecisionSkippedHandler] GameSession not found');
                return;
            }

            // 1. 检查事件是否属于当前游戏
            if (event.game !== session.getGameId()) {
                console.warn('[DecisionSkippedHandler] Event game mismatch, ignoring', {
                    eventGame: event.game,
                    currentGame: session.getGameId()
                });
                return;
            }

            // 2. 更新 turn（注意 +1）
            session.setRound(event.round);
            await session.advance_turn(event.turn);

            console.log('[DecisionSkippedHandler] Turn 已更新', {
                round: event.round,
                turn: event.turn
            });

            // 3. 获取玩家
            const player = session.getPlayerByAddress(event.player);
            if (!player) {
                console.warn('[DecisionSkippedHandler] Player not found', event.player);
                return;
            }

            // 4. 从 tile_id 获取关联的建筑
            const tiles = session.getTiles();
            const tile = tiles[event.tile_id];

            if (!tile || tile.buildingId === INVALID_TILE_ID) {
                // 无法获取建筑信息，显示简单通知
                UINotification.info(
                    `玩家${player.getPlayerIndex() + 1}放弃了决策`
                );

                console.log('[DecisionSkippedHandler] 无关联建筑信息');
                return;
            }

            const building = session.getBuildingByIndex(tile.buildingId);
            const buildingName = building?.getBuildingTypeName() || `建筑${tile.buildingId}`;

            // 5. 显示 notification
            const decisionTypeStr = event.decision_type === 1 ? '购买' : '升级';
            UINotification.info(
                `玩家${player.getPlayerIndex() + 1}放弃${decisionTypeStr}${buildingName}`
            );

            console.log('[DecisionSkippedHandler] DecisionSkippedEvent 处理完成', {
                player: player.getPlayerIndex(),
                decisionType: decisionTypeStr,
                building: buildingName
            });
        } catch (error) {
            console.error('[DecisionSkippedHandler] 处理主逻辑失败', error);
            UINotification.error(`跳过决策处理失败: ${error.message || error}`);
        } finally {
            // 发射游戏事件（在finally中，确保总是发射）
            try {
                EventBus.emit(EventTypes.Game.TurnEnd, {
                    round: event.round,
                    turn: event.turn + 1
                });
                console.log('[DecisionSkippedHandler] 发射 TurnEnd 事件');
            } catch (error) {
                console.error('[DecisionSkippedHandler] 发射事件失败', error);
            }
        }
    }

    /**
     * 销毁
     */
    public destroy(): void {
        console.log('[DecisionSkippedHandler] Handler 销毁');
        DecisionSkippedHandler._instance = null;
    }
}

// 导出单例访问器
export const decisionSkippedHandler = {
    get instance(): DecisionSkippedHandler {
        return DecisionSkippedHandler.getInstance();
    }
};
