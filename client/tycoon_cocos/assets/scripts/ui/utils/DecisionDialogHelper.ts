/**
 * DecisionDialogHelper - 决策对话框统一处理工具
 *
 * 职责：
 * - 提供统一的决策对话框显示方法（购买、升级、租金）
 * - 提供统一的交易执行方法
 * - 被 UIInGame 和 RollAndStepHandler 共享使用
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { UIMessage, MessageBoxType, MessageBoxIcon } from './UIMessage';
import { UINotification } from './UINotification';
import { SuiManager } from '../../sui/managers/SuiManager';
import { DecisionType } from '../../sui/types/constants';
import type { PendingDecisionInfo } from '../../core/GameSession';
import type { Player } from '../../role/Player';
import { handleSuiTransactionError } from '../../sui/utils/TransactionErrorHandler';

/**
 * 决策对话框助手类
 */
export class DecisionDialogHelper {

    /**
     * 显示购买建筑对话框
     *
     * @param decision 决策信息
     * @param session GameSession
     */
    public static async showBuyDialog(
        decision: PendingDecisionInfo,
        session: any
    ): Promise<void> {
        const player = session.getMyPlayer();
        if (!player) {
            console.warn('[DecisionDialogHelper] My player not found');
            return;
        }

        const price = Number(decision.amount);
        const balance = Number(player.getCash());
        const canAfford = balance >= price;

        // 获取建筑名称
        const building = session.getBuildingByTileId(decision.tileId);
        const buildingName = building?.getBuildingTypeName() || `建筑${decision.tileId}`;

        await UIMessage.show({
            title: "购买建筑",
            message: `${buildingName}\n\n购买价格：${price}\n当前现金：${balance}${canAfford ? '' : ' (现金不足)'}\n购买后余额：${balance - price}`,
            icon: MessageBoxIcon.NONE,
            componentType: MessageBoxType.STYLE1,
            buttons: {
                primary: {
                    text: canAfford ? "购买" : "购买 (现金不足)",
                    disabled: !canAfford,  // 现金不足时禁用按钮
                    callback: async () => {
                        await DecisionDialogHelper._executeBuyBuilding(session);
                    }
                },
                secondary: {
                    text: "跳过",
                    visible: true,
                    callback: async () => {
                        await DecisionDialogHelper._executeSkipDecision(session);
                    }
                },
                close: {
                    visible: false
                }
            }
        });
    }

    /**
     * 显示升级建筑对话框
     *
     * @param decision 决策信息
     * @param session GameSession
     * @param currentLevel 当前建筑等级（可选）
     */
    public static async showUpgradeDialog(
        decision: PendingDecisionInfo,
        session: any,
        currentLevel?: number
    ): Promise<void> {
        const player = session.getMyPlayer();
        if (!player) {
            console.warn('[DecisionDialogHelper] My player not found');
            return;
        }

        const price = Number(decision.amount);
        const balance = Number(player.getCash());
        const canAfford = balance >= price;

        // 获取建筑名称
        const building = session.getBuildingByTileId(decision.tileId);
        const buildingName = building?.getBuildingTypeName() || `建筑${decision.tileId}`;
        const level = currentLevel ?? building?.level ?? 0;

        await UIMessage.show({
            title: "升级建筑",
            message: `${buildingName}\n\n当前等级：${level}\n升级价格：${price}\n当前现金：${balance}${canAfford ? '' : ' (现金不足)'}\n升级后余额：${balance - price}`,
            icon: MessageBoxIcon.NONE,
            componentType: MessageBoxType.STYLE1,
            buttons: {
                primary: {
                    text: canAfford ? "升级" : "升级 (现金不足)",
                    disabled: !canAfford,  // 现金不足时禁用按钮
                    callback: async () => {
                        await DecisionDialogHelper._executeUpgradeBuilding(session);
                    }
                },
                secondary: {
                    text: "跳过",
                    visible: true,
                    callback: async () => {
                        await DecisionDialogHelper._executeSkipDecision(session);
                    }
                },
                close: {
                    visible: false
                }
            }
        });
    }

    /**
     * 显示支付租金对话框
     *
     * @param decision 决策信息
     * @param session GameSession
     * @param owner 建筑所有者（可选）
     */
    public static async showRentDialog(
        decision: PendingDecisionInfo,
        session: any,
        owner?: string | number
    ): Promise<void> {
        const player = session.getMyPlayer();
        if (!player) {
            console.warn('[DecisionDialogHelper] My player not found');
            return;
        }

        const rent = Number(decision.amount);
        const balance = Number(player.getCash());
        const canAfford = balance >= rent;

        // 获取建筑名称
        const building = session.getBuildingByTileId(decision.tileId);
        const buildingName = building?.getBuildingTypeName() || `建筑${decision.tileId}`;

        // 获取所有者信息
        const ownerStr = owner !== undefined ? `玩家 ${owner}` : '未知';

        // 检查是否有免租卡（kind=3 是免租卡）
        const hasRentFreeCard = player.getCardCount(3) > 0;

        await UIMessage.show({
            title: "支付租金",
            message: `${buildingName}\n\n地产所有者：${ownerStr}\n租金金额：${rent}\n当前现金：${balance}\n${hasRentFreeCard ? '(持有免租卡)' : ''}`,
            icon: MessageBoxIcon.WARNING,
            componentType: MessageBoxType.STYLE1,
            buttons: {
                primary: {
                    text: "使用免租卡",
                    visible: hasRentFreeCard,
                    callback: async () => {
                        await DecisionDialogHelper._executePayRent(session, true);
                    }
                },
                secondary: {
                    text: "支付现金",
                    visible: true,
                    callback: async () => {
                        if (!canAfford) {
                            UINotification.error('现金不足，将破产');
                            // 仍然允许执行（链上会处理破产逻辑）
                        }
                        await DecisionDialogHelper._executePayRent(session, false);
                    }
                },
                btn_3: {
                    text: "取消",
                    visible: true,
                    callback: () => {
                        UINotification.info('已取消支付');
                    }
                },
                close: {
                    visible: false
                }
            }
        });
    }

    // ==================== 私有交易执行方法 ====================

    /**
     * 执行购买建筑
     */
    private static async _executeBuyBuilding(session: any): Promise<void> {
        try {
            const suiManager = SuiManager.instance;

            // 检查 Seat 是否存在
            const seat = session.getMySeat();
            if (!seat) {
                console.error('[DecisionDialogHelper] Seat not loaded');
                UINotification.error('游戏状态未加载完成');
                return;
            }

            const tx = suiManager.gameClient.game.buildBuyBuildingTx(
                session.getGameId(),
                seat.id,
                session.getTemplateMapId()
            );

            await suiManager.signAndExecuteTransaction(tx);
            UINotification.success('建筑购买成功');
            console.log('[DecisionDialogHelper] 建筑购买成功');

        } catch (error) {
            console.error('[DecisionDialogHelper] 购买建筑失败', error);
            handleSuiTransactionError(error, {
                title: '购买建筑失败'
            });
        }
    }

    /**
     * 执行升级建筑
     */
    private static async _executeUpgradeBuilding(session: any): Promise<void> {
        try {
            const suiManager = SuiManager.instance;

            // 检查 Seat 是否存在
            const seat = session.getMySeat();
            if (!seat) {
                console.error('[DecisionDialogHelper] Seat not loaded');
                UINotification.error('游戏状态未加载完成');
                return;
            }

            const tx = suiManager.gameClient.game.buildUpgradeBuildingTx(
                session.getGameId(),
                seat.id,
                session.getTemplateMapId()
            );

            await suiManager.signAndExecuteTransaction(tx);
            UINotification.success('建筑升级成功');
            console.log('[DecisionDialogHelper] 建筑升级成功');

        } catch (error) {
            console.error('[DecisionDialogHelper] 升级建筑失败', error);
            handleSuiTransactionError(error, {
                title: '升级建筑失败'
            });
        }
    }

    /**
     * 执行支付租金
     *
     * @param session GameSession
     * @param useRentFree 是否使用免租卡
     */
    private static async _executePayRent(session: any, useRentFree: boolean): Promise<void> {
        try {
            const suiManager = SuiManager.instance;

            // 检查 Seat 是否存在
            const seat = session.getMySeat();
            if (!seat) {
                console.error('[DecisionDialogHelper] Seat not loaded');
                UINotification.error('游戏状态未加载完成');
                return;
            }

            // 使用统一的 buildDecideRentPaymentTx 方法
            const tx = suiManager.gameClient.game.buildDecideRentPaymentTx(
                session.getGameId(),
                seat.id,
                session.getTemplateMapId(),
                useRentFree  // true: 使用免租卡, false: 现金支付
            );

            await suiManager.signAndExecuteTransaction(tx);
            UINotification.success(useRentFree ? '已使用免租卡' : '租金支付成功');
            console.log('[DecisionDialogHelper] 租金支付成功', { useRentFree });

        } catch (error) {
            console.error('[DecisionDialogHelper] 支付租金失败', error);
            handleSuiTransactionError(error, {
                title: '支付租金失败'
            });
        }
    }

    /**
     * 执行跳过决策
     */
    private static async _executeSkipDecision(session: any): Promise<void> {
        try {
            const suiManager = SuiManager.instance;

            // 检查 Seat 是否存在
            const seat = session.getMySeat();
            if (!seat) {
                console.error('[DecisionDialogHelper] Seat not loaded');
                UINotification.error('游戏状态未加载完成');
                return;
            }

            const tx = suiManager.gameClient.game.buildSkipBuildingDecisionTx(
                session.getGameId(),
                seat.id,
                session.getTemplateMapId()
            );

            await suiManager.signAndExecuteTransaction(tx);
            UINotification.info('已跳过');
            console.log('[DecisionDialogHelper] 已跳过决策');

        } catch (error) {
            console.error('[DecisionDialogHelper] 跳过决策失败', error);
            handleSuiTransactionError(error, {
                title: '跳过决策失败'
            });
        }
    }
}
