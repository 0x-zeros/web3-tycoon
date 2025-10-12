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

const { ccclass } = _decorator;

@ccclass('UIInGameDice')
export class UIInGameDice extends UIBase {

    /** 投掷骰子按钮 */
    private m_btn_roll: fgui.GButton;

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

        if (this.m_btn_roll) {
            console.log('[UIInGameDice] Dice button found');
        } else {
            console.error('[UIInGameDice] Dice button (n2) not found');
        }
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        if (this.m_btn_roll) {
            this.m_btn_roll.onClick(this._onRollDiceOnSui, this);
        }

        // 监听骰子事件
        EventBus.on(EventTypes.Dice.StartRoll, this._onDiceStart, this);
        EventBus.on(EventTypes.Dice.RollComplete, this._onDiceComplete, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        if (this.m_btn_roll) {
            this.m_btn_roll.offClick(this._onRollDiceOnSui, this);
        }

        EventBus.off(EventTypes.Dice.StartRoll, this._onDiceStart, this);
        EventBus.off(EventTypes.Dice.RollComplete, this._onDiceComplete, this);

        super.unbindEvents();
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

        try {
            // ===== 1. 获取游戏数据 =====
            const session = Blackboard.instance.get<any>("currentGameSession");
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

            const result = await SuiManager.instance.rollAndStep(pathResult.path);

            console.log("[UIInGameDice] 交易成功", {
                txHash: result.txHash,
                dice: result.dice,
                endPos: result.endPos
            });

            // ===== 7. 交易成功，等待事件处理 =====
            // EventIndexer 会监听链上 RollAndStepActionEvent
            // 然后触发 RollAndStepHandler 处理，自动播放动画

        } catch (error) {
            console.error("[UIInGameDice] 掷骰子失败:", error);

            // 显示错误提示
            const errorMessage = error instanceof Error ? error.message : String(error);
            alert(`掷骰子失败: ${errorMessage}`);

        } finally {
            // 重新启用骰子按钮
            if (this.m_btn_roll) {
                this.m_btn_roll.enabled = true;
            }
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
     * 播放骰子动画
     *
     * @param diceCount 骰子数量
     * @returns Promise，动画完成后 resolve
     */
    private _playDiceAnimation(diceCount: number): Promise<void> {
        return new Promise((resolve) => {
            // 生成随机骰子值（实际值由链上决定，这里只是动画）
            const diceValue = Math.floor(Math.random() * 6) + 1;

            console.log(`[UIInGameDice] 播放骰子动画，数量: ${diceCount}, 显示值: ${diceValue}`);

            // 使用 DiceController 播放动画
            DiceController.instance.roll(diceValue, () => {
                console.log("[UIInGameDice] 骰子动画完成");
                resolve();
            });

            // 发送投掷开始事件
            EventBus.emit(EventTypes.Dice.StartRoll, {
                diceCount: diceCount,
                source: "ui_dice"
            });
        });
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
}
