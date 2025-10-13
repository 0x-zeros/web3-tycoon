/**
 * UIInGameDice - 游戏内骰子模块
 *
 * 功能：
 * - 管理骰子投掷按钮
 * - 处理骰子投掷逻辑和动画
 * - 发送骰子相关事件
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { Blackboard } from "../../events/Blackboard";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';
import { DiceController } from "../../game/DiceController";
import { SuiManager } from "../../sui/managers/SuiManager";
import { BuffKind } from "../../sui/types/constants";
import { WalkingPreference } from "../../sui/pathfinding/WalkingPreference";
import { HistoryStorage } from "../../sui/pathfinding/HistoryStorage";
import { UIMessage } from "../utils/UIMessage";
import { UINotification } from "../utils/UINotification";
import { GameInitializer } from "../../core/GameInitializer";

const { ccclass } = _decorator;

@ccclass('UIInGameDice')
export class UIInGameDice extends UIBase {

    /** 投掷骰子按钮 */
    private m_btn_roll: fgui.GButton;

    /** 跳过回合按钮 */
    private m_btn_skipTurn: fgui.GButton;

    /**
     * 初始化回调
     */
    protected onInit(): void {
        this._setupComponents();
    }

    /**
     * 设置组件引用
     */
    private _setupComponents(): void {
        // dice 组件结构：dice > n2（按钮组件）
        // n2 本身是 Button 组件（extention="Button"）
        this.m_btn_roll = this.getButton('btn_roll');
        this.m_btn_skipTurn = this.getButton('btn_skipTurn');

        if (this.m_btn_roll) {
            console.log('[UIInGameDice] Dice button found');
        } else {
            console.error('[UIInGameDice] Dice button (n2) not found');
        }

        // 默认隐藏 skipTurn 按钮
        if (this.m_btn_skipTurn) {
            this.m_btn_skipTurn.visible = false;
            console.log('[UIInGameDice] Skip turn button found');
        } else {
            console.error('[UIInGameDice] Skip turn button not found');
        }
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        if (this.m_btn_roll) {
            this.m_btn_roll.onClick(this._onRollDiceOnSui, this);
        }

        if (this.m_btn_skipTurn) {
            this.m_btn_skipTurn.onClick(this._onSkipTurnClick, this);
        }

        // 监听骰子事件
        EventBus.on(EventTypes.Dice.StartRoll, this._onDiceStart, this);
        EventBus.on(EventTypes.Dice.RollComplete, this._onDiceComplete, this);

        // 监听回合变化（更新骰子按钮状态）
        EventBus.on(EventTypes.Game.TurnChanged, this._onTurnChanged, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        if (this.m_btn_roll) {
            this.m_btn_roll.offClick(this._onRollDiceOnSui, this);
        }

        if (this.m_btn_skipTurn) {
            this.m_btn_skipTurn.offClick(this._onSkipTurnClick, this);
        }

        EventBus.off(EventTypes.Dice.StartRoll, this._onDiceStart, this);
        EventBus.off(EventTypes.Dice.RollComplete, this._onDiceComplete, this);
        EventBus.off(EventTypes.Game.TurnChanged, this._onTurnChanged, this);

        super.unbindEvents();
    }

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        console.log("[UIInGameDice] Showing");

        // 根据当前回合设置按钮初始状态
        this._updateButtonState();
    }

    /**
     * 刷新回调
     */
    protected onRefresh(data?: any): void {
        this._updateButtonState();
    }

    /**
     * 更新按钮状态（根据当前回合）
     */
    private _updateButtonState(): void {
        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            this.m_btn_roll.enabled = false;
            if (this.m_btn_skipTurn) {
                this.m_btn_skipTurn.visible = false;
            }
            console.log('[UIInGameDice] No session, 骰子按钮禁用');
            return;
        }

        const isMyTurn = session.isMyTurn();
        const myPlayer = session.getMyPlayer();

        // 检查是否在监狱或医院
        const shouldSkip = myPlayer && (
            myPlayer.isInPrison() || myPlayer.isInHospital()
        );

        // btn_skipTurn: 轮到自己 && 在监狱/医院
        if (this.m_btn_skipTurn) {
            this.m_btn_skipTurn.visible = isMyTurn && shouldSkip;
            console.log('[UIInGameDice] SkipTurn 按钮:', shouldSkip ? '显示' : '隐藏');
        }

        // dice: 轮到自己 && 不在监狱/医院
        this.m_btn_roll.enabled = isMyTurn && !shouldSkip;

        console.log('[UIInGameDice] Dice 按钮:', (isMyTurn && !shouldSkip) ? '启用' : '禁用');
    }

    /**
     * 投掷骰子按钮点击, 留作测试用
     */
    private _onRollDiceClick(): void {
        console.log("[UIInGameDice] Roll dice clicked");

        // 禁用骰子按钮，防止重复点击
        if (this.m_btn_roll) {
            this.m_btn_roll.enabled = false;
        }

        // 生成随机骰子值 (1-6)
        const diceValue = Math.floor(Math.random() * 6) + 1;
        console.log(`[UIInGameDice] 骰子点数: ${diceValue}`);

        // 使用DiceController播放骰子动画
        DiceController.instance.roll(diceValue, () => {
            console.log(`[UIInGameDice] 骰子动画完成，最终点数: ${diceValue}`);

            // 动画完成后重新启用骰子按钮
            if (this.m_btn_roll) {
                this.m_btn_roll.enabled = true;
            }

            // 发送骰子投掷完成事件
            EventBus.emit(EventTypes.Dice.RollComplete, {
                value: diceValue,
                playerId: Blackboard.instance.get("currentPlayerId"),
                source: "in_game_ui"
            });
        });

        // 发送投掷骰子事件
        EventBus.emit(EventTypes.Dice.StartRoll, {
            playerId: Blackboard.instance.get("currentPlayerId"),
            source: "in_game_ui"
        });
    }

    /**
     * 掷骰子按钮点击（链上交互版本）
     *
     * 流程：
     * 1. 获取游戏会话和玩家信息
     * 2. 根据 buffs 确定骰子数量（1-3个）
     * 3. 根据行走偏好计算路径
     * 4. 播放骰子动画
     * 5. 构建 PTB 并提交链上交易
     * 6. 等待事件处理和动画播放
     */
    private async _onRollDiceOnSui(): Promise<void> {
        console.log("[UIInGameDice] 掷骰子按钮点击（链上版本）");

        // 禁用骰子按钮，防止重复点击
        if (this.m_btn_roll) {
            this.m_btn_roll.enabled = false;
        }

        let transactionSuccess = false;  // 记录交易是否成功

        try {
            // ===== 1. 获取游戏数据 =====
            const session = GameInitializer.getInstance()?.getGameSession();
            if (!session) {
                throw new Error("GameSession 未找到");
            }

            const player = session.getMyPlayer();
            if (!player) {
                throw new Error("当前玩家未找到");
            }

            const template = session.getMapTemplate();
            if (!template) {
                throw new Error("地图模板未找到");
            }

            console.log("[UIInGameDice] 游戏数据获取成功", {
                gameId: session.getGameId(),
                player: player.getPlayerIndex(),
                currentTile: player.getPos()
            });

            // ===== 2. 确定骰子数量 =====
            const diceCount = this._getDiceCount(player, session.getRound());
            const maxSteps = diceCount * 6;  // 每个骰子最多6步

            console.log(`[UIInGameDice] 骰子数量: ${diceCount}, 最大步数: ${maxSteps}`);

            // ===== 3. 计算路径 =====
            const preference = this._getWalkingPreference();
            console.log(`[UIInGameDice] 使用行走偏好: ${preference}`);

            // 导入 PathCalculator（动态导入避免循环依赖）
            const { PathCalculator } = await import("../../sui/pathfinding/PathCalculator");

            // 加载 Rotor-Router 历史记录（如果使用该偏好）
            let rotorHistory = undefined;
            if (preference === WalkingPreference.ROTOR_ROUTER) {
                rotorHistory = HistoryStorage.load(session.getGameId(), player.getPlayerIndex());
                console.log("[UIInGameDice] Rotor-Router 历史记录已加载", {
                    recordCount: rotorHistory.lastDirection.size
                });
            }

            const pathCalculator = new PathCalculator(template, rotorHistory);

            const pathResult = pathCalculator.calculatePath({
                startTile: player.getPos(),
                steps: maxSteps,
                preference: preference,
                lastTile: player.getLastTileId(),
                rotorHistory: rotorHistory
            });

            if (!pathResult.success) {
                throw new Error(`路径计算失败: ${pathResult.error}`);
            }

            console.log("[UIInGameDice] 路径计算成功", {
                path: pathResult.path,
                steps: pathResult.actualSteps
            });

            // 保存 Rotor-Router 历史记录（如果使用该偏好）
            if (preference === WalkingPreference.ROTOR_ROUTER) {
                const updatedHistory = pathCalculator.getRotorHistory();
                HistoryStorage.save(session.getGameId(), player.getPlayerIndex(), updatedHistory);
                console.log("[UIInGameDice] Rotor-Router 历史记录已保存");
            }

            // ===== 4. 校验路径合法性 =====
            const isValid = pathCalculator.validatePath(player.getPos(), pathResult.path);
            if (!isValid) {
                throw new Error("路径校验失败：包含无效的邻接关系");
            }

            console.log("[UIInGameDice] 路径校验通过");

            // ===== 5. 播放骰子动画 =====
            await this._playDiceAnimation(diceCount);

            // ===== 6. 提交链上交易 =====
            console.log("[UIInGameDice] 提交链上交易...");

            const result = await SuiManager.instance.rollAndStep(session, pathResult.path);

            console.log("[UIInGameDice] 交易成功", {
                txHash: result.txHash,
                dice: result.dice,
                endPos: result.endPos
            });

            transactionSuccess = true;  // 标记交易成功

            // ===== 7. 交易成功，等待事件处理 =====
            // EventIndexer 会监听链上 RollAndStepActionEvent
            // 然后触发 RollAndStepHandler 处理，自动播放动画
            // TurnChanged 事件会更新按钮状态，这里不需要恢复

        } catch (error) {
            console.error("[UIInGameDice] 掷骰子失败:", error);

            // 显示错误提示（根据错误类型选择提示方式）
            const errorMessage = error instanceof Error ? error.message : String(error);

            // 重要错误：需要用户确认（使用 UIMessage）
            if (errorMessage.includes("GameSession") ||
                errorMessage.includes("Seat not found") ||
                errorMessage.includes("No current game") ||
                errorMessage.includes("transaction") ||
                errorMessage.includes("签名")) {
                // 使用 MessageBox（需要用户点击确认）
                UIMessage.error(errorMessage, "掷骰子失败").catch(e => {
                    console.error('[UIInGameDice] UIMessage error:', e);
                });
            } else {
                // 一般错误：自动消失（使用 Notification）
                UINotification.error(errorMessage, "掷骰子失败");
            }

        } finally {
            // 只在失败时恢复按钮状态
            if (!transactionSuccess && this.m_btn_roll) {
                // 恢复为当前回合状态（而不是无条件 true）
                const session = GameInitializer.getInstance()?.getGameSession();
                const isMyTurn = session?.isMyTurn() || false;
                this.m_btn_roll.enabled = isMyTurn;

                console.log('[UIInGameDice] 交易失败，恢复按钮状态:', isMyTurn ? '启用' : '禁用');
            }
            // 成功时保持 disabled，等待 TurnChanged 事件更新
        }
    }

    /**
     * 确定骰子数量
     *
     * 根据玩家的 buffs 判断：
     * - 有遥控骰子 buff (MOVE_CTRL)：可以使用 1-3 个骰子
     * - 无遥控骰子：固定 1 个骰子
     *
     * @param player 玩家对象
     * @param currentRound 当前轮次
     * @returns 骰子数量（1-3）
     */
    private _getDiceCount(player: any, currentRound: number): number {
        // 检查是否有遥控骰子 buff
        const hasMoveCtr = player.hasActiveBuff(BuffKind.MOVE_CTRL, currentRound);

        if (hasMoveCtr) {
            // 有遥控骰子，可以选择 1-3 个
            // TODO: 弹出选择器让玩家选择骰子数量
            // 目前默认使用 2 个骰子
            return 2;
        } else {
            // 无遥控骰子，固定 1 个
            return 1;
        }
    }

    /**
     * 获取行走偏好设置
     *
     * @returns 行走偏好（默认 ROTOR_ROUTER）
     */
    private _getWalkingPreference(): WalkingPreference {
        // 从 Blackboard 获取用户设置，默认使用 ROTOR_ROUTER
        return Blackboard.instance.get("walkingPreference", WalkingPreference.ROTOR_ROUTER);
    }

    /**
     * 跳过回合按钮点击
     */
    private async _onSkipTurnClick(): Promise<void> {
        console.log('[UIInGameDice] Skip turn button clicked');

        // 禁用按钮防止重复点击
        if (this.m_btn_skipTurn) {
            this.m_btn_skipTurn.enabled = false;
        }

        try {
            const session = GameInitializer.getInstance()?.getGameSession();
            if (!session) {
                throw new Error('GameSession 未找到');
            }

            // 调用 SuiManager 封装方法
            await SuiManager.instance.skipTurn(session);

            console.log('[UIInGameDice] 跳过回合交易已发送');

        } catch (error) {
            console.error('[UIInGameDice] 跳过回合失败', error);
            UINotification.error('跳过回合失败');

            // 恢复按钮（如果仍然需要跳过）
            if (this.m_btn_skipTurn) {
                this.m_btn_skipTurn.enabled = true;
            }
        }
    }

    /**
     * 播放骰子动画
     *
     * @param diceCount 骰子数量
     * @returns Promise，动画完成后 resolve
     */
    private async _playDiceAnimation(diceCount: number): Promise<void> {
        console.log(`[UIInGameDice] 开始播放骰子循环动画，数量: ${diceCount}`);

        // 使用 DiceController 播放循环动画（不等待链上结果）
        // DiceController 会持续循环，直到收到 Dice.RollResult 事件
        DiceController.instance.startRolling(diceCount, () => {
            console.log("[UIInGameDice] 骰子动画完成（已停在链上值）");
        });

        // 发送投掷开始事件
        EventBus.emit(EventTypes.Dice.StartRoll, {
            diceCount: diceCount,
            source: "ui_dice"
        });

        // 立即返回，不等待链上结果（避免阻塞交易提交）
        // 骰子会在后台持续循环，收到 RollResult 事件后自动停止
    }

    /**
     * 骰子开始投掷
     */
    private _onDiceStart(): void {
        if (this.m_btn_roll) {
            this.m_btn_roll.enabled = false;
        }
    }

    /**
     * 骰子投掷完成
     */
    private _onDiceComplete(data: any): void {
        console.log("[UIInGameDice] Dice roll completed:", data);
        // 按钮在回调中已重新启用
    }

    /**
     * 回合变化处理（更新骰子按钮状态）
     */
    private _onTurnChanged(data: { isMyTurn: boolean }): void {
        this._updateButtonState();  // 统一使用 _updateButtonState
    }
}
