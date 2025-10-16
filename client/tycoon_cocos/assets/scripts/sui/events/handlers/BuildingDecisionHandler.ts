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
import { CashFlyAnimation } from '../../../ui/effects/CashFlyAnimation';

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
                console.log('[BuildingDecisionHandler] Auto-decision event ignored (handled by RollAndStepHandler)', {
                    buildingId: event.building_id,
                    player: event.player,
                    amount: event.amount.toString(),
                    decisionType: event.decision_type,
                    newLevel: event.new_level
                });
                return;
            }

            // 3. 手动决策：更新 turn
            session.setRound(event.round);
            session.advance_turn(event.turn);

            console.log('[BuildingDecisionHandler] Turn 已更新', {
                round: event.round,
                turn: event.turn
            });

            // 3. 获取玩家
            const player = session.getPlayerByAddress(event.player);
            if (!player) {
                console.warn('[BuildingDecisionHandler] Player not found', event.player);
                return;
            }

            // 4. 扣除玩家现金
            const newCash = player.getCash() - BigInt(event.amount);
            player.setCash(newCash);

            // 播放减钱动画
            CashFlyAnimation.getInstance().playCashDecrease(player, BigInt(event.amount));
            console.log('[BuildingDecisionHandler] 触发减钱动画');

            console.log('[BuildingDecisionHandler] 玩家现金已更新', {
                player: player.getPlayerIndex(),
                oldCash: player.getCash().toString(),
                newCash: newCash.toString(),
                amount: event.amount.toString()
            });

            // 5. 更新建筑（owner、level和building_type）- 会自动触发渲染更新
            session.updateBuilding(
                event.building_id,
                player.getPlayerIndex(),
                event.new_level,
                event.building_type  // 新增：传递建筑类型
            );

            console.log('[BuildingDecisionHandler] 建筑已更新', {
                buildingId: event.building_id,
                owner: player.getPlayerIndex(),
                level: event.new_level,
                buildingType: event.building_type
            });

            // 6. 显示 notification
            const decisionTypeStr = event.decision_type === 1 ? '购买' : '升级';
            const autoTag = event.auto_decision ? '（自动）' : '';
            const building = session.getBuildingByIndex(event.building_id);
            const buildingName = building?.getBuildingTypeName() || `建筑${event.building_id}`;

            UINotification.success(
                `玩家${player.getPlayerIndex() + 1}${autoTag}${decisionTypeStr}了${buildingName}，花费${BigInt(event.amount).toString()}`
            );

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
