/**
 * TeleportActionHandler - TeleportActionEvent 事件处理器
 *
 * 职责：
 * 1. 监听链上的 TeleportActionEvent 事件
 * 2. 更新目标玩家位置
 * 3. 处理瞬移后的停留效果（购买/租金/奖金等）
 * 4. 更新 GameSession 数据
 *
 * @author Web3 Tycoon Team
 */

import type { EventMetadata } from '../types';
import type { TeleportActionEvent } from '../types/TeleportActionEvent';
import type { StopEffect, CashDelta, CardDrawItem } from '../types/RollAndStepEvent';
import { Blackboard } from '../../../events/Blackboard';
import { UINotification } from '../../../ui/utils/UINotification';
import { DecisionType, StopType } from '../../types/constants';
import { getCardName } from '../../types/cards';

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

            // 1. 获取被瞬移的玩家
            const targetPlayer = session.getPlayerByAddress(event.target_player);
            if (!targetPlayer) {
                console.warn('[TeleportActionHandler] 目标玩家未找到:', event.target_player);
                return;
            }

            // 2. 更新目标玩家位置（瞬移不更新lastTile）
            targetPlayer.setPos(event.to_pos, false);

            // 3. 执行视觉瞬移
            const targetCenter = session.getTileWorldCenter(event.to_pos);
            if (targetCenter) {
                await targetPlayer.moveTo({
                    targetTileId: event.to_pos,
                    steps: 0,
                    targetPosition: targetCenter,
                    teleport: true
                });
            }

            console.log('[TeleportActionHandler] 玩家已瞬移', {
                from: event.from_pos,
                to: event.to_pos,
                targetPlayer: event.target_player
            });

            // 4. 处理停留效果
            if (event.stop_effect) {
                await this._processStopEffect(
                    session,
                    event.target_player,
                    event.stop_effect,
                    event.cash_changes
                );
            }

            // 5. 处理现金变动
            await this._processCashChanges(session, event.cash_changes);

            // 6. 显示通知
            const sourcePlayer = session.getPlayerByAddress(event.player);
            const sourceIndex = sourcePlayer?.getPlayerIndex() ?? 0;
            const targetIndex = targetPlayer.getPlayerIndex();

            let notificationText = '';
            if (event.player === event.target_player) {
                notificationText = `瞬移到了 ${event.to_pos}`;
            } else {
                notificationText = `将玩家${targetIndex + 1}瞬移到了 ${event.to_pos}`;
            }

            UINotification.info(notificationText, '瞬移卡', 3000, 'center', {
                playerIndex: sourceIndex,
                cards: [8]  // CARD_TELEPORT = 8
            });

            console.log('[TeleportActionHandler] 事件处理完成');

        } catch (error) {
            console.error('[TeleportActionHandler] 处理事件失败:', error);
        }
    }

    /**
     * 处理停留效果
     */
    private async _processStopEffect(
        session: any,
        playerAddress: string,
        stopEffect: StopEffect,
        cashChanges: CashDelta[]
    ): Promise<void> {
        const player = session.getPlayerByAddress(playerAddress);
        if (!player) return;

        console.log('[TeleportActionHandler] 处理停留效果:', stopEffect);

        // 1. 处理卡片获取
        if (stopEffect.card_gains && stopEffect.card_gains.length > 0) {
            for (const cardDraw of stopEffect.card_gains) {
                const fields = (cardDraw as any).fields || cardDraw;
                player.addCard(fields.kind, fields.count);
            }

            // 构建卡片列表用于显示
            const cards: number[] = [];
            for (const cardDraw of stopEffect.card_gains) {
                const fields = (cardDraw as any).fields || cardDraw;
                for (let i = 0; i < fields.count && cards.length < 3; i++) {
                    cards.push(fields.kind);
                }
            }

            const cardNames = stopEffect.card_gains
                .map((c: CardDrawItem) => {
                    const fields = (c as any).fields || c;
                    return `${getCardName(fields.kind)} x${fields.count}`;
                })
                .join(', ');

            UINotification.info(`获得: ${cardNames}`, '卡牌', 4000, 'center', {
                playerIndex: player.getPlayerIndex(),
                cards: cards
            });
        }

        // 2. 处理免租通过提示
        if (stopEffect.stop_type === StopType.BUILDING_NO_RENT) {
            UINotification.info('免租通过', undefined, 2000, 'center');
        }

        // 3. 土地神抢地提示
        if (stopEffect.stop_type === StopType.LAND_SEIZE) {
            UINotification.info('土地神附身，免费占有地产！', '土地神', 3000, 'center');
        }

        // 4. 卡片商店
        if (stopEffect.stop_type === StopType.CARD_SHOP) {
            const { SuiManager } = await import('../../managers/SuiManager');
            const myAddress = SuiManager.instance.currentAddress;

            if (myAddress && playerAddress === myAddress) {
                const { UIManager } = await import('../../../ui/core/UIManager');
                UIManager.instance.showUI('CardShop', { parentUIName: 'InGame' });
            }
        }

        // 5. 处理医院状态
        if (stopEffect.stop_type === StopType.HOSPITAL && stopEffect.turns != null) {
            player.setInHospitalTurns(stopEffect.turns);
            console.log('[TeleportActionHandler] 玩家进入医院:', stopEffect.turns);
        }

        // 6. 处理 NPC buff
        if (stopEffect.npc_buff) {
            const npcBuff = (stopEffect.npc_buff as any).fields || stopEffect.npc_buff;
            const buffName = this._getBuffName(npcBuff.buff_type);
            UINotification.info(`获得 ${buffName}！`, 'NPC祝福', 3000, 'center');

            player.addBuff({
                kind: npcBuff.buff_type,
                last_active_round: npcBuff.last_active_round ?? 0,
                value: BigInt(0),
                spawn_index: 0xFFFF
            });

            // NPC被消耗
            session.removeNPC(stopEffect.tile_id);
        }

        // 7. 处理建筑决策
        if (stopEffect.building_decision) {
            await this._handleBuildingUpdate(stopEffect.building_decision, playerAddress, session);
        }

        // 8. 设置待决策（如果有）
        if (stopEffect.pending_decision !== undefined &&
            stopEffect.pending_decision !== DecisionType.NONE) {

            const { SuiManager } = await import('../../managers/SuiManager');
            const myAddress = SuiManager.instance.currentAddress;

            // 只有被瞬移玩家是自己时才显示决策UI
            if (myAddress && playerAddress === myAddress) {
                session.setPendingDecision({
                    type: stopEffect.pending_decision,
                    tileId: stopEffect.decision_tile,
                    amount: BigInt(stopEffect.decision_amount || 0)
                });

                console.log('[TeleportActionHandler] 已设置待决策状态', {
                    type: stopEffect.pending_decision,
                    tileId: stopEffect.decision_tile,
                    amount: stopEffect.decision_amount?.toString()
                });
            }
        }
    }

    /**
     * 处理现金变动
     */
    private async _processCashChanges(session: any, cashChanges: CashDelta[]): Promise<void> {
        if (!cashChanges || cashChanges.length === 0) return;

        for (const change of cashChanges) {
            const player = session.getPlayerByAddress(change.player);
            if (!player) continue;

            const amount = BigInt(change.amount);
            const newCash = change.is_debit
                ? player.getCash() - amount
                : player.getCash() + amount;

            player.setCash(newCash);

            // 显示现金变动通知
            const isSpectator = session.isSpectatorMode?.() || false;
            const myPlayer = session.getMyPlayer?.();

            if (isSpectator || (myPlayer && player === myPlayer)) {
                const prefix = isSpectator ? `玩家${player.getPlayerIndex() + 1} ` : '';
                const text = change.is_debit ? `${prefix}-${amount}` : `${prefix}+${amount}`;
                UINotification.info(text, undefined, 2000, 'center');
            }

            console.log('[TeleportActionHandler] 玩家现金已更新', {
                player: change.player,
                isDebit: change.is_debit,
                amount: amount.toString(),
                newCash: newCash.toString()
            });
        }
    }

    /**
     * 处理建筑更新
     */
    private async _handleBuildingUpdate(
        buildingDecision: any,
        playerAddress: string,
        session: any
    ): Promise<void> {
        const player = session.getPlayerByAddress(playerAddress);
        if (!player) return;

        const buildingId = buildingDecision.building_id;
        const newOwner = player.getPlayerIndex();
        const newLevel = buildingDecision.new_level;
        const buildingType = buildingDecision.building_type;

        console.log('[TeleportActionHandler] 更新建筑状态', {
            buildingId,
            owner: newOwner,
            level: newLevel,
            buildingType
        });

        session.updateBuilding(buildingId, newOwner, newLevel, buildingType);
    }

    /**
     * Buff 类型中文名称
     */
    private _getBuffName(buffType: number): string {
        switch (buffType) {
            case 1: return '遥控骰子';
            case 2: return '冰冻';
            case 3: return '免租';
            case 4: return '土地神附身';
            case 5: return '福神祝福';
            case 6: return '机车';
            default: return `效果(${buffType})`;
        }
    }
}

// 导出单例访问器
export const teleportActionHandler = {
    get instance(): TeleportActionHandler {
        return TeleportActionHandler.getInstance();
    }
};
