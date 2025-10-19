/**
 * RentDecisionHandler - 租金决策事件处理器
 *
 * 职责：
 * 1. 监听链上的 RentDecisionEvent 事件
 * 2. 更新 GameSession 中的 turn（使用 event.turn + 1）
 * 3. 如果使用免租卡：删除玩家的免租卡，触发卡牌飞出动画
 * 4. 如果支付现金：更新支付者和接收者的现金
 * 5. 显示 notification（包含自动决策标识）
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import type { EventMetadata, RentDecisionEvent } from '../types';
import { EventType } from '../types';
import { Blackboard } from '../../../events/Blackboard';
import { EventBus } from '../../../events/EventBus';
import { EventTypes } from '../../../events/EventTypes';
import { UINotification } from '../../../ui/utils/UINotification';
import type { GameSession } from '../../../core/GameSession';
import { CardKind } from '../../types/constants';

/**
 * RentDecisionHandler 类
 */
export class RentDecisionHandler {
    /** 单例实例 */
    private static _instance: RentDecisionHandler | null = null;

    private constructor() {
        console.log('[RentDecisionHandler] Handler 创建');
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): RentDecisionHandler {
        if (!RentDecisionHandler._instance) {
            RentDecisionHandler._instance = new RentDecisionHandler();
        }
        return RentDecisionHandler._instance;
    }

    /**
     * 初始化（注册事件监听）
     */
    public initialize(): void {
        console.log('[RentDecisionHandler] 初始化事件监听');
        // TODO: 实际实现时需要从 EventIndexer 监听
        // EventBus.on(EventTypes.Move.RentDecision, this.handleEvent.bind(this));
    }

    /**
     * 处理 RentDecisionEvent 事件
     *
     * @param metadata 事件元数据
     */
    public async handleEvent(metadata: EventMetadata<RentDecisionEvent>): Promise<void> {
        console.log('[RentDecisionHandler] 收到 RentDecisionEvent', metadata);

        const event = metadata.data;

        try {
            // 获取 GameSession
            const session = Blackboard.instance.get<GameSession>("currentGameSession");
            if (!session) {
                console.warn('[RentDecisionHandler] GameSession not found');
                return;
            }

            // 1. 检查事件是否属于当前游戏
            if (event.game !== session.getGameId()) {
                console.warn('[RentDecisionHandler] Event game mismatch, ignoring', {
                    eventGame: event.game,
                    currentGame: session.getGameId()
                });
                return;
            }

            // ✅ 2. 忽略自动决策事件（已在 RollAndStepHandler 中完整处理）
            if (event.auto_decision) {
                if (!event.decision) {
                    console.warn('[RentDecisionHandler] Auto-decision event with null decision, ignoring');
                    return;
                }

                console.log('[RentDecisionHandler] Auto-decision event ignored (handled by RollAndStepHandler)', {
                    payer: event.decision.payer,
                    owner: event.decision.owner,
                    rentAmount: event.decision.rent_amount.toString(),
                    usedRentFree: event.decision.used_rent_free
                });
                return;
            }

            // ✅ 3. 手动决策：获取决策详情
            const decision = event.decision;

            // 检查 decision 是否存在
            if (!decision) {
                console.error('[RentDecisionHandler] Missing decision data in RentDecisionEvent');
                return;
            }

            // 4. 手动决策：更新 turn
            session.setRound(event.round);
            await session.advance_turn(event.turn);

            console.log('[RentDecisionHandler] Turn 已更新', {
                round: event.round,
                turn: event.turn
            });

            // 5. 获取玩家
            const payer = session.getPlayerByAddress(decision.payer);
            const owner = session.getPlayerByAddress(decision.owner);

            if (!payer || !owner) {
                console.warn('[RentDecisionHandler] Player not found', {
                    payer: decision.payer,
                    owner: decision.owner
                });
                return;
            }

            // 6. 处理租金支付
            if (decision.used_rent_free) {
                // 使用免租卡
                const success = payer.removeCard(CardKind.RENT_FREE, 1);

                if (success) {
                    console.log('[RentDecisionHandler] 免租卡已使用', {
                        player: payer.getPlayerIndex()
                    });

                    UINotification.info(
                        `玩家${payer.getPlayerIndex() + 1}使用了免租卡`
                    );

                    // 如果是当前玩家，触发卡牌飞出动画
                    if (session.getMyPlayer() === payer) {
                        EventBus.emit(EventTypes.UI.CardFlyOut, {
                            cardKind: CardKind.RENT_FREE,
                            fromSlot: payer.getCardCount(CardKind.RENT_FREE) + 1 // 原slot位置（删除前的数量）
                        });

                        console.log('[RentDecisionHandler] 触发卡牌飞出动画');
                    }
                } else {
                    console.error('[RentDecisionHandler] 免租卡使用失败');
                }
            } else {
                // 支付现金
                const rentAmount = BigInt(decision.rent_amount);
                const newPayerCash = payer.getCash() - rentAmount;
                const newOwnerCash = owner.getCash() + rentAmount;

                payer.setCash(newPayerCash);
                owner.setCash(newOwnerCash);

                console.log('[RentDecisionHandler] 租金已支付', {
                    payer: payer.getPlayerIndex(),
                    owner: owner.getPlayerIndex(),
                    amount: rentAmount.toString()
                });

                // 只有myplayer才显示现金变动Notification
                const myPlayer = session.getMyPlayer();
                if (myPlayer) {
                    if (payer === myPlayer) {
                        // 我是付款者，显示减钱
                        UINotification.info(`-${rentAmount}`, undefined, 2000);
                    } else if (owner === myPlayer) {
                        // 我是收款者，显示加钱
                        UINotification.info(`+${rentAmount}`, undefined, 2000);
                    }
                }
            }

            console.log('[RentDecisionHandler] RentDecisionEvent 处理完成');

        } catch (error) {
            console.error('[RentDecisionHandler] 处理事件失败', error);
            UINotification.error(`租金决策处理失败: ${error.message || error}`);
        }
    }

    /**
     * 销毁
     */
    public destroy(): void {
        console.log('[RentDecisionHandler] Handler 销毁');
        RentDecisionHandler._instance = null;
    }
}

// 导出单例访问器
export const rentDecisionHandler = {
    get instance(): RentDecisionHandler {
        return RentDecisionHandler.getInstance();
    }
};
