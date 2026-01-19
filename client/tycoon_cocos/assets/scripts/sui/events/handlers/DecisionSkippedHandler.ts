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
        console.log('[DecisionSkippedHandler] ========== 开始处理 ==========');
        console.log('[DecisionSkippedHandler] 收到事件:', JSON.stringify(metadata.data));

        const event = metadata.data;

        try {
            // 获取 GameSession
            const session = Blackboard.instance.get<GameSession>("currentGameSession");
            if (!session) {
                console.error('[DecisionSkippedHandler] ❌ GameSession not found');
                return;
            }
            console.log('[DecisionSkippedHandler] ✓ GameSession 获取成功');

            // 1. 检查事件是否属于当前游戏
            if (event.game !== session.getGameId()) {
                console.warn('[DecisionSkippedHandler] ❌ Game ID 不匹配', {
                    eventGame: event.game,
                    currentGame: session.getGameId()
                });
                return;
            }
            console.log('[DecisionSkippedHandler] ✓ Game ID 匹配');

            // 记录调用前状态
            console.log('[DecisionSkippedHandler] 调用 advance_turn 前:', {
                currentRound: session.getRound(),
                currentTurn: session.getTurn(),
                eventRound: event.round,
                eventTurn: event.turn,
                hasPendingDecision: session.hasPendingDecision()
            });

            // 2. 更新 turn（注意 +1）
            session.setRound(event.round);
            await session.advance_turn(event.turn);

            console.log('[DecisionSkippedHandler] 调用 advance_turn 后:', {
                newRound: session.getRound(),
                newTurn: session.getTurn(),
                activePlayerIndex: session.getActivePlayerIndex(),
                isMyTurn: session.isMyTurn()
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
                // 无关联建筑（如卡片商店），显示决策类型
                const decisionTypeStr = this.getDecisionTypeString(event.decision_type);
                UINotification.info(
                    `玩家${player.getPlayerIndex() + 1}放弃了${decisionTypeStr}`
                );

                // 清除待决策状态（关键修复）
                console.log('[DecisionSkippedHandler] 准备调用 clearPendingDecision (无关联建筑)');
                session.clearPendingDecision();
                console.log('[DecisionSkippedHandler] clearPendingDecision 完成, hasPendingDecision:', session.hasPendingDecision());

                console.log('[DecisionSkippedHandler] ========== 处理完成 (无关联建筑) ==========');
                return;
            }

            const building = session.getBuildingByIndex(tile.buildingId);
            const buildingName = building?.getBuildingTypeName() || `建筑${tile.buildingId}`;

            // 5. 显示 notification
            const decisionTypeStr = this.getDecisionTypeString(event.decision_type);
            UINotification.info(
                `玩家${player.getPlayerIndex() + 1}放弃${decisionTypeStr}${buildingName}`
            );

            // 6. 清除待决策状态
            console.log('[DecisionSkippedHandler] 准备调用 clearPendingDecision');
            session.clearPendingDecision();
            console.log('[DecisionSkippedHandler] clearPendingDecision 完成, hasPendingDecision:', session.hasPendingDecision());

            console.log('[DecisionSkippedHandler] ========== 处理完成 ==========', {
                player: player.getPlayerIndex(),
                decisionType: decisionTypeStr,
                building: buildingName
            });
        } catch (error) {
            console.error('[DecisionSkippedHandler] ❌ 处理失败', error);
            UINotification.error(`跳过决策处理失败: ${error.message || error}`);
        }
    }

    /**
     * 获取决策类型的显示文案
     */
    private getDecisionTypeString(decisionType: number): string {
        switch (decisionType) {
            case 1: return '购买';
            case 2: return '升级';
            case 3: return '租金支付';
            case 4: return '卡片商店';
            default: return '决策';
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
