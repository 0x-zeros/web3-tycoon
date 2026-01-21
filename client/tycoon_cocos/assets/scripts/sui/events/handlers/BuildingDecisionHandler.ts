/**
 * BuildingDecisionHandler - 建筑购买/升级事件处理器
 *
 * 职责：
 * 1. 监听链上的 BuildingDecisionEvent 事件
 * 2. 更新 GameSession 中的 turn（使用 event.turn + 1）
 * 3. 更新玩家现金
 * 4. 更新建筑数据和渲染（owner, level）
 * 5. 显示 notification（包含自动决策标识）
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import type { EventMetadata, BuildingDecisionEvent } from '../types';
import { EventType } from '../types';
import { Blackboard } from '../../../events/Blackboard';
import { UINotification } from '../../../ui/utils/UINotification';
import type { GameSession } from '../../../core/GameSession';

/**
 * BuildingDecisionHandler 类
 */
export class BuildingDecisionHandler {
    /** 单例实例 */
    private static _instance: BuildingDecisionHandler | null = null;

    private constructor() {
        console.log('[BuildingDecisionHandler] Handler 创建');
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): BuildingDecisionHandler {
        if (!BuildingDecisionHandler._instance) {
            BuildingDecisionHandler._instance = new BuildingDecisionHandler();
        }
        return BuildingDecisionHandler._instance;
    }

    /**
     * 初始化（注册事件监听）
     */
    public initialize(): void {
        console.log('[BuildingDecisionHandler] 初始化事件监听');
        // TODO: 实际实现时需要从 EventIndexer 监听
        // EventBus.on(EventTypes.Move.BuildingDecision, this.handleEvent.bind(this));
    }

    /**
     * 处理 BuildingDecisionEvent 事件
     *
     * @param metadata 事件元数据
     */
    public async handleEvent(metadata: EventMetadata<BuildingDecisionEvent>): Promise<void> {
        console.log('[BuildingDecisionHandler] 收到 BuildingDecisionEvent', metadata);

        const event = metadata.data;

        try {
            // 获取 GameSession
            const session = Blackboard.instance.get<GameSession>("currentGameSession");
            if (!session) {
                console.warn('[BuildingDecisionHandler] GameSession not found');
                return;
            }

            // 1. 检查事件是否属于当前游戏
            if (event.game !== session.getGameId()) {
                console.warn('[BuildingDecisionHandler] Event game mismatch, ignoring', {
                    eventGame: event.game,
                    currentGame: session.getGameId()
                });
                return;
            }

            // ✅ 2. 忽略自动决策事件（已在 RollAndStepHandler 中完整处理）
            if (event.auto_decision) {
                if (!event.decision) {
                    console.warn('[BuildingDecisionHandler] Auto-decision event with null decision, ignoring');
                    return;
                }

                console.log('[BuildingDecisionHandler] Auto-decision event ignored (handled by RollAndStepHandler)', {
                    buildingId: event.decision.building_id,
                    player: event.player,
                    amount: event.decision.amount.toString(),
                    decisionType: event.decision.decision_type,
                    newLevel: event.decision.new_level
                });
                return;
            }

            // ✅ 3. 手动决策：获取决策详情
            const decision = event.decision;

            // 检查 decision 是否存在
            if (!decision) {
                console.error('[BuildingDecisionHandler] Missing decision data in BuildingDecisionEvent');
                return;
            }

            // 4. 手动决策：更新 turn
            session.setRound(event.round);
            await session.advance_turn(event.turn);

            console.log('[BuildingDecisionHandler] Turn 已更新', {
                round: event.round,
                turn: event.turn
            });

            // 5. 获取玩家（通过索引）
            const player = session.getPlayerByIndex(event.player);
            if (!player) {
                console.warn('[BuildingDecisionHandler] Player not found, index:', event.player);
                return;
            }

            // 6. 扣除玩家现金
            const amount = BigInt(decision.amount);
            const newCash = player.getCash() - amount;
            player.setCash(newCash);

            // 只有myplayer才显示现金变动Notification（显示在屏幕中央）
            const myPlayer = session.getMyPlayer();
            if (myPlayer && player === myPlayer) {
                UINotification.info(`-${amount}`, undefined, 2000, 'center');
                console.log('[BuildingDecisionHandler] 显示现金变动: -', amount.toString());
            }

            console.log('[BuildingDecisionHandler] 玩家现金已更新', {
                player: player.getPlayerIndex(),
                oldCash: player.getCash().toString(),
                newCash: newCash.toString(),
                amount: amount.toString()
            });

            // 7. 更新建筑（owner、level和building_type）- 会自动触发渲染更新
            session.updateBuilding(
                decision.building_id,
                player.getPlayerIndex(),
                decision.new_level,
                decision.building_type
            );

            console.log('[BuildingDecisionHandler] 建筑已更新', {
                buildingId: decision.building_id,
                owner: player.getPlayerIndex(),
                level: decision.new_level,
                buildingType: decision.building_type
            });

            // 8. 显示 notification
            const decisionTypeStr = decision.decision_type === 1 ? '购买' : '升级';
            const building = session.getBuildingByIndex(decision.building_id);
            const buildingName = building?.getBuildingTypeName() || `建筑${decision.building_id}`;

            UINotification.success(
                `玩家${player.getPlayerIndex() + 1}${decisionTypeStr}了${buildingName}，花费${amount.toString()}`
            );

            // 9. 清除待决策状态
            session.clearPendingDecision();

            console.log('[BuildingDecisionHandler] BuildingDecisionEvent 处理完成');

        } catch (error) {
            console.error('[BuildingDecisionHandler] 处理事件失败', error);
            UINotification.error(`建筑决策处理失败: ${error.message || error}`);
        }
    }

    /**
     * 销毁
     */
    public destroy(): void {
        console.log('[BuildingDecisionHandler] Handler 销毁');
        BuildingDecisionHandler._instance = null;
    }
}

// 导出单例访问器
export const buildingDecisionHandler = {
    get instance(): BuildingDecisionHandler {
        return BuildingDecisionHandler.getInstance();
    }
};
