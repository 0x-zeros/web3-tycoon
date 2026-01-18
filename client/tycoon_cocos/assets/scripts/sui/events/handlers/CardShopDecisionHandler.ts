/**
 * CardShopDecisionHandler - 卡片商店决策事件处理器
 *
 * 职责：
 * 1. 监听链上的 CardShopDecisionEvent 事件
 * 2. 更新玩家的卡片数量（通过 player.addCard() 自动触发 UI 刷新）
 * 3. 更新玩家的现金
 * 4. 显示 notification
 */

import type { EventMetadata, CardShopDecisionEvent } from '../types';
import { Blackboard } from '../../../events/Blackboard';
import { UINotification } from '../../../ui/utils/UINotification';
import { getCardName } from '../../types/cards';
import type { GameSession } from '../../../core/GameSession';

/**
 * CardShopDecisionHandler 类
 */
export class CardShopDecisionHandler {
    /** 单例实例 */
    private static _instance: CardShopDecisionHandler | null = null;

    private constructor() {
        console.log('[CardShopDecisionHandler] Handler 创建');
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): CardShopDecisionHandler {
        if (!CardShopDecisionHandler._instance) {
            CardShopDecisionHandler._instance = new CardShopDecisionHandler();
        }
        return CardShopDecisionHandler._instance;
    }

    /**
     * instance getter（与其他 Handler 保持一致）
     */
    public static get instance(): CardShopDecisionHandler {
        return this.getInstance();
    }

    /**
     * 处理 CardShopDecisionEvent 事件
     *
     * @param metadata 事件元数据
     */
    public async handleEvent(metadata: EventMetadata<CardShopDecisionEvent>): Promise<void> {
        const event = metadata.data;
        console.log('[CardShopDecisionHandler] 处理卡片商店决策事件:', event);

        // 获取 GameSession
        const session = Blackboard.instance.get<GameSession>("currentGameSession");
        if (!session) {
            console.warn('[CardShopDecisionHandler] 无游戏会话');
            return;
        }

        // 检查事件是否属于当前游戏
        if (event.game !== session.getGameId()) {
            console.warn('[CardShopDecisionHandler] Event game mismatch, ignoring', {
                eventGame: event.game,
                currentGame: session.getGameId()
            });
            return;
        }

        // 获取玩家
        const player = session.getPlayerByAddress(event.player);
        if (!player) {
            console.warn('[CardShopDecisionHandler] 玩家未找到:', event.player);
            return;
        }

        const decision = event.decision;

        // 更新玩家卡片 - addCard() 内部会触发 Player.CardChange 事件
        for (const cardDraw of decision.purchased_cards) {
            // 处理 Move 事件的 fields 嵌套结构
            const fields = (cardDraw as any).fields || cardDraw;
            if (!fields.is_pass) {
                player.addCard(fields.kind, fields.count);
                console.log('[CardShopDecisionHandler] 添加卡片:', {
                    kind: fields.kind,
                    count: fields.count
                });
            }
        }

        // 更新玩家现金
        const totalCost = BigInt(decision.total_cost);
        player.setCash(player.getCash() - totalCost);
        console.log('[CardShopDecisionHandler] 更新现金:', {
            player: player.getPlayerIndex(),
            cost: totalCost.toString(),
            newCash: player.getCash().toString()
        });

        // 显示 UI 通知
        const cardNames = decision.purchased_cards
            .filter(c => {
                const fields = (c as any).fields || c;
                return !fields.is_pass;
            })
            .map(c => {
                const kind = (c as any).fields?.kind ?? c.kind;
                return getCardName(kind);
            })
            .join(', ');

        if (cardNames) {
            UINotification.info(
                `玩家${player.getPlayerIndex() + 1}购买了: ${cardNames}`,
                '卡片商店',
                3000
            );
        }

        console.log('[CardShopDecisionHandler] CardShopDecisionEvent 处理完成');
    }

    /**
     * 销毁
     */
    public destroy(): void {
        console.log('[CardShopDecisionHandler] Handler 销毁');
        CardShopDecisionHandler._instance = null;
    }
}

// 导出单例访问器（与其他 Handler 保持一致）
export const cardShopDecisionHandler = {
    get instance(): CardShopDecisionHandler {
        return CardShopDecisionHandler.getInstance();
    }
};
