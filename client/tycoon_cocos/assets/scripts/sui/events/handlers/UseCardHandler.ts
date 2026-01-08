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
 * NPC 变化项（与 Move 端 NpcChangeItem 对应）
 */
export interface NpcChangeItem {
    tile_id: number;        // u16
    kind: number;           // u8 - NPC类型
    action: number;         // u8: 1=spawn, 2=remove, 3=hit
    consumed: boolean;      // 是否已消耗
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

            // 5. 显示卡牌使用通知（所有客户端）
            await this.showCardNotification(session, event);

            // 6. 触发 UI 刷新事件
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
            if (change.action === 1) {
                // NPC_ACTION_SPAWN: 生成 NPC（数据+渲染）
                await session.spawnNPC(change.tile_id, change.kind, change.consumed);
                console.log(`[UseCardHandler] 在 tile ${change.tile_id} 生成 NPC ${change.kind}`);
            } else if (change.action === 2) {
                // NPC_ACTION_REMOVE: 移除 NPC
                session.removeNPC(change.tile_id);
                console.log(`[UseCardHandler] 从 tile ${change.tile_id} 移除 NPC`);
            } else if (change.action === 3) {
                // NPC_ACTION_HIT: 触发效果（不一定删除，由consumed决定）
                console.log(`[UseCardHandler] NPC被触发 at tile ${change.tile_id}`);
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

    /**
     * 显示卡牌使用通知（所有客户端）
     *
     * @param session GameSession实例
     * @param event UseCardActionEvent事件
     */
    private async showCardNotification(session: any, event: UseCardActionEvent): Promise<void> {
        // 1. 获取使用卡牌的玩家
        const player = session.getPlayerByAddress(event.player);
        if (!player) {
            console.warn('[UseCardHandler] 玩家未找到，无法显示通知:', event.player);
            return;
        }

        // 2. 获取卡牌名称
        const { getCardName } = await import('../../types/cards');
        const cardName = getCardName(event.kind);

        // 3. 获取玩家索引
        const playerIndex = player.getPlayerIndex();

        // 4. 构建消息文本（格式："（对玩家X）使用了 卡牌名"）
        let notificationText = '';

        // 判断是否需要显示目标玩家（只有冰冻卡以player为目标）
        const targetInfo = this._getCardTargetPlayerInfo(event.kind, event.params);
        if (targetInfo) {
            notificationText += targetInfo;  // 如 "（对玩家2）"
        }

        notificationText += `使用了 ${cardName}`;

        // 5. 显示通知
        const { UINotification } = await import('../../../ui/utils/UINotification');
        UINotification.info(notificationText, undefined, 2500, 'center', {
            playerIndex: playerIndex,  // 显示使用者头像
            cards: [event.kind]        // 显示使用的卡片
        });

        console.log('[UseCardHandler] 显示卡牌使用通知:', {
            player: event.player,
            playerIndex,
            cardName,
            text: notificationText
        });
    }

    /**
     * 获取卡牌目标玩家信息（仅针对以player为目标的卡牌）
     *
     * @param kind 卡牌类型
     * @param params 卡牌参数
     * @returns 目标玩家字符串（如"（对玩家2）"），不需要目标时返回空字符串
     */
    private _getCardTargetPlayerInfo(kind: number, params: number[]): string {
        if (!params || params.length === 0) {
            return '';
        }

        switch (kind) {
            case 4: // 冰冻卡 - 唯一以player为目标的卡牌
                if (params.length > 0) {
                    const targetPlayerIndex = params[0];
                    return `（对玩家${targetPlayerIndex + 1}）`;
                }
                break;

            // 其他卡牌不以player为目标：
            // - 0: 遥控骰子（对自己）
            // - 1: 路障卡（对tile）
            // - 2: 炸弹卡（对tile）
            // - 3: 免租卡（对自己）
            // - 5: 恶犬卡（对tile）
            // - 6: 机器娃娃（对tile范围）
            // - 7: 转向卡（对自己）
            default:
                return '';
        }

        return '';
    }
}

// 导出单例访问器
export const useCardHandler = {
    get instance(): UseCardHandler {
        return UseCardHandler.getInstance();
    }
};
