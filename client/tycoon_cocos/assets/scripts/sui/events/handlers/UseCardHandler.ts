/**
 * UseCardHandler - UseCardActionEvent 事件处理器
 *
 * 职责：
 * 1. 监听链上的 UseCardActionEvent 事件
 * 2. 更新 GameSession 数据（玩家卡牌、buffs、NPCs、现金）
 * 3. 触发 UI 刷新事件
 *
 * @author Web3 Tycoon Team
 */

import type { EventMetadata } from '../types';
import { EventBus } from '../../../events/EventBus';
import { EventTypes } from '../../../events/EventTypes';
import { Blackboard } from '../../../events/Blackboard';

/**
 * UseCardActionEvent 接口（对应 Move 端）
 */
export interface UseCardActionEvent {
    game: string;           // ID
    player: string;         // address
    round: number;          // u16
    turn_in_round: number;  // u8
    kind: number;           // u8
    params: number[];       // vector<u16>
    npc_changes: NpcChangeItem[];
    buff_changes: BuffChangeItem[];
    cash_changes: CashDelta[];
}

/**
 * NPC 变化项
 */
export interface NpcChangeItem {
    tile_id: number;        // u16
    npc_kind: number;       // u8
    action: number;         // u8: 0=add, 1=remove
    consumable: boolean;
}

/**
 * Buff 变化项
 */
export interface BuffChangeItem {
    buff_kind: number;      // u8
    player: string;         // address
    first_inactive_round: number | null; // option<u16>
}

/**
 * 现金变化项
 */
export interface CashDelta {
    player: string;         // address
    is_expense: boolean;
    amount: bigint;         // u64
    reason: number;         // u8
    related_tile: number;   // u16
}

/**
 * UseCardHandler 类
 */
export class UseCardHandler {
    /** 单例实例 */
    private static _instance: UseCardHandler | null = null;

    private constructor() {
        console.log('[UseCardHandler] Handler 创建');
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): UseCardHandler {
        if (!UseCardHandler._instance) {
            UseCardHandler._instance = new UseCardHandler();
        }
        return UseCardHandler._instance;
    }

    /**
     * 初始化（注册事件监听）
     */
    public initialize(): void {
        console.log('[UseCardHandler] 初始化事件监听');
        // TODO: 在 EventIndexer 中注册此 handler
    }

    /**
     * 处理 UseCardActionEvent 事件
     *
     * @param metadata 事件元数据
     */
    public async handleEvent(metadata: EventMetadata<UseCardActionEvent>): Promise<void> {
        console.log('[UseCardHandler] 收到 UseCardActionEvent', metadata);

        const event = metadata.data;

        try {
            // 获取 GameSession
            const session = Blackboard.instance.get<any>("currentGameSession");
            if (!session) {
                console.warn('[UseCardHandler] GameSession not found');
                return;
            }

            // 1. 更新玩家卡牌（使用卡牌，扣减数量）
            await this.updatePlayerCards(session, event);

            // 2. 从事件更新next_tile_id
            this.updatePlayerNextTileId(session, event);

            // 3. 应用 buff 变化
            await this.applyBuffChanges(session, event.buff_changes);

            // 3. 应用 NPC 变化
            await this.applyNpcChanges(session, event.npc_changes);

            // 4. 应用现金变化
            await this.applyCashChanges(session, event.cash_changes);

            console.log('[UseCardHandler] 事件处理完成');

            // 5. 触发 UI 刷新事件
            EventBus.emit(EventTypes.Card.UseCard, {
                kind: event.kind,
                params: event.params
            });

        } catch (error) {
            console.error('[UseCardHandler] 处理事件失败:', error);
        }
    }

    /**
     * 更新玩家卡牌
     */
    private async updatePlayerCards(session: any, event: UseCardActionEvent): Promise<void> {
        const player = session.getPlayerByAddress(event.player);
        if (!player) {
            console.warn('[UseCardHandler] 玩家未找到:', event.player);
            return;
        }

        // 扣减卡牌（消耗性卡牌）
        // 注意：Move 端的 use_player_card 已经扣减了，这里只是同步客户端状态
        player.removeCard(event.kind, 1);

        console.log(`[UseCardHandler] 玩家 ${event.player} 使用卡牌 ${event.kind}`);
    }

    /**
     * 应用 buff 变化
     */
    private async applyBuffChanges(session: any, buffChanges: BuffChangeItem[]): Promise<void> {
        for (const change of buffChanges) {
            const player = session.getPlayerByAddress(change.player);
            if (!player) {
                console.warn('[UseCardHandler] 玩家未找到（buff）:', change.player);
                continue;
            }

            if (change.first_inactive_round !== null) {
                // ✅ 添加 buff - 构建完整的MoveBuffEntry对象
                player.addBuff({
                    kind: change.buff_kind,
                    last_active_round: change.first_inactive_round,
                    value: 0,  // 默认值，根据实际需求调整
                    spawn_index: 0  // 默认值
                });
                console.log(`[UseCardHandler] 玩家 ${change.player} 获得buff ${change.buff_kind}, 失效回合: ${change.first_inactive_round}`);
            } else {
                // 移除 buff
                player.removeBuff(change.buff_kind);
                console.log(`[UseCardHandler] 玩家 ${change.player} 移除buff ${change.buff_kind}`);
            }
        }
    }

    /**
     * 应用 NPC 变化
     */
    private async applyNpcChanges(session: any, npcChanges: NpcChangeItem[]): Promise<void> {
        for (const change of npcChanges) {
            if (change.action === 0) {
                // 添加 NPC
                session.addNPC(change.tile_id, change.npc_kind, change.consumable);
                console.log(`[UseCardHandler] 在 tile ${change.tile_id} 添加 NPC ${change.npc_kind}`);
            } else {
                // 移除 NPC
                session.removeNPC(change.tile_id);
                console.log(`[UseCardHandler] 从 tile ${change.tile_id} 移除 NPC`);
            }
        }
    }

    /**
     * 应用现金变化
     */
    private async applyCashChanges(session: any, cashChanges: CashDelta[]): Promise<void> {
        for (const change of cashChanges) {
            const player = session.getPlayerByAddress(change.player);
            if (!player) {
                console.warn('[UseCardHandler] 玩家未找到（现金）:', change.player);
                continue;
            }

            // ✅ 使用Player.setCash()方法
            const amount = BigInt(change.amount);  // ✅ 确保类型为BigInt
            const currentCash = player.getCash();

            const newCash = change.is_expense
                ? currentCash - amount
                : currentCash + amount;

            player.setCash(newCash);  // ✅ 正确调用setCash

            console.log(`[UseCardHandler] 玩家 ${change.player} 现金更新`, {
                isExpense: change.is_expense,
                amount: amount.toString(),
                newCash: newCash.toString()
            });
        }
    }

    /**
     * 从事件更新玩家的next_tile_id
     *
     * @param session GameSession实例
     * @param event UseCardActionEvent事件
     */
    private updatePlayerNextTileId(session: any, event: UseCardActionEvent): void {
        const player = session.getPlayerByAddress(event.player);
        if (!player) {
            console.warn('[UseCardHandler] 玩家未找到（next_tile_id）:', event.player);
            return;
        }

        const oldNextTileId = player.getNextTileId();
        const newNextTileId = event.next_tile_id;

        if (oldNextTileId !== newNextTileId) {
            player.setNextTileId(newNextTileId);
            console.log(`[UseCardHandler] 更新next_tile_id: ${oldNextTileId} -> ${newNextTileId}`);

            // 更新玩家朝向（依赖next_tile_id）
            player.updatePaperActorDirection(session);
        }
    }
}

// 导出单例访问器
export const useCardHandler = {
    get instance(): UseCardHandler {
        return UseCardHandler.getInstance();
    }
};
