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
import { BuffKind, DecisionType, BuildingSize } from "../../sui/types/constants";
import { WalkingPreference } from "../../sui/pathfinding/WalkingPreference";
import { HistoryStorage } from "../../sui/pathfinding/HistoryStorage";
import { UIMessage } from "../utils/UIMessage";
import { UINotification } from "../utils/UINotification";
import { GameInitializer } from "../../core/GameInitializer";
import { handleSuiTransactionError } from "../../sui/utils/TransactionErrorHandler";
import { DecisionDialogHelper } from "../utils/DecisionDialogHelper";
import type { PendingDecisionInfo } from "../../core/GameSession";
import { UICardTileSelector } from './UICardTileSelector';
import { CardUsageManager } from '../../card/CardUsageManager';
import { UIManager } from "../core/UIManager";

const { ccclass } = _decorator;

@ccclass('UIInGameDice')
export class UIInGameDice extends UIBase {

    /** 静态实例引用（供其他模块获取骰子数量） */
    private static _instance: UIInGameDice | null = null;

    /** 投掷骰子按钮 */
    private m_btn_roll: fgui.GButton;

    /** 跳过回合按钮 */
    private m_btn_skipTurn: fgui.GButton;

    /** 骰子数量选择按钮 */
    private m_btn_diceNum_1: fgui.GButton;
    private m_btn_diceNum_2: fgui.GButton;
    private m_btn_diceNum_3: fgui.GButton;

    /** 骰子数量控制器 */
    private m_ctrl_diceNum: fgui.Controller;

    /** 当前选中的骰子数量 */
    private _selectedDiceCount: number = 1;

    /**
     * 初始化回调
     */
    protected onInit(): void {
        UIInGameDice._instance = this;
        this._setupComponents();
    }

    /**
     * 获取当前选择的骰子数量
     * 供其他模块（如遥控骰子卡）查询
     */
    public static getSelectedDiceCount(): number {
        return UIInGameDice._instance?._selectedDiceCount ?? 1;
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

        // 骰子数量选择按钮
        this.m_btn_diceNum_1 = this.getButton('btn_diceNum_1');
        this.m_btn_diceNum_2 = this.getButton('btn_diceNum_2');
        this.m_btn_diceNum_3 = this.getButton('btn_diceNum_3');

        // 获取骰子数量控制器
        this.m_ctrl_diceNum = this.getController('dice_num');

        if (this.m_ctrl_diceNum) {
            console.log('[UIInGameDice] Dice num controller found');
        }

        // 更新骰子选择按钮可用性
        this._updateDiceCountOptions();
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

        // 骰子数量选择按钮
        if (this.m_btn_diceNum_1) {
            this.m_btn_diceNum_1.onClick(() => this._onDiceCountSelect(1), this);
        }
        if (this.m_btn_diceNum_2) {
            this.m_btn_diceNum_2.onClick(() => this._onDiceCountSelect(2), this);
        }
        if (this.m_btn_diceNum_3) {
            this.m_btn_diceNum_3.onClick(() => this._onDiceCountSelect(3), this);
        }

        // 监听骰子事件
        EventBus.on(EventTypes.Dice.StartRoll, this._onDiceStart, this);
        EventBus.on(EventTypes.Dice.RollComplete, this._onDiceComplete, this);

        // 监听回合变化（更新骰子按钮状态）
        EventBus.on(EventTypes.Game.TurnChanged, this._onTurnChanged, this);

        // 监听决策状态变化（更新骰子按钮状态）
        EventBus.on(EventTypes.Game.DecisionPending, this._onDecisionStateChanged, this);
        EventBus.on(EventTypes.Game.DecisionCleared, this._onDecisionStateChanged, this);

        // 监听Buff变化（更新骰子数量选项，用于摩托车卡/汽车卡）
        EventBus.on(EventTypes.Player.BuffsUpdated, this._onBuffsUpdated, this);
        EventBus.on(EventTypes.Player.BuffAdded, this._onBuffsUpdated, this);
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

        // 骰子数量选择按钮（FairyGUI onClick with arrow function 不需要 offClick）
        // 因为使用了箭头函数，每次绑定都是新函数引用，无法精确解绑
        // 但由于 UIBase 在销毁时会清理整个组件，不会造成内存泄漏

        EventBus.off(EventTypes.Dice.StartRoll, this._onDiceStart, this);
        EventBus.off(EventTypes.Dice.RollComplete, this._onDiceComplete, this);
        EventBus.off(EventTypes.Game.TurnChanged, this._onTurnChanged, this);
        EventBus.off(EventTypes.Game.DecisionPending, this._onDecisionStateChanged, this);
        EventBus.off(EventTypes.Game.DecisionCleared, this._onDecisionStateChanged, this);
        EventBus.off(EventTypes.Player.BuffsUpdated, this._onBuffsUpdated, this);
        EventBus.off(EventTypes.Player.BuffAdded, this._onBuffsUpdated, this);

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
        console.log('[UIInGameDice] _updateButtonState 开始');

        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            console.error('[UIInGameDice] ❌ session 为空');
            this.m_btn_roll.enabled = false;
            if (this.m_btn_skipTurn) {
                this.m_btn_skipTurn.visible = false;
            }
            console.log('[UIInGameDice] No session, 骰子按钮禁用');
            return;
        }

        // 观战模式：禁用所有骰子操作
        if (session.isSpectatorMode()) {
            this.m_btn_roll.enabled = false;
            if (this.m_btn_skipTurn) {
                this.m_btn_skipTurn.visible = false;
            }
            if (this.m_btn_diceNum_1) this.m_btn_diceNum_1.enabled = false;
            if (this.m_btn_diceNum_2) this.m_btn_diceNum_2.enabled = false;
            if (this.m_btn_diceNum_3) this.m_btn_diceNum_3.enabled = false;
            console.log('[UIInGameDice] Spectator mode, 骰子按钮禁用');
            return;
        }

        const isMyTurn = session.isMyTurn();
        const myPlayer = session.getMyPlayer();

        // 检查是否在医院
        const shouldSkip = myPlayer && myPlayer.isInHospital();

        // 检查是否有待决策（任何玩家的待决策都会阻塞游戏）
        const hasPendingDecision = session.hasPendingDecision();
        const canRollButton = isMyTurn && !shouldSkip;
        const decisionFallback = hasPendingDecision && canRollButton;

        // 【调试日志】详细输出状态信息
        console.log('[UIInGameDice] _updateButtonState DEBUG:', {
            myPlayerIndex: session.getMyPlayerIndex(),
            activePlayerIndex: session.getActivePlayerIndex(),
            turn: session.getTurn(),
            round: session.getRound(),
            isMyTurn: isMyTurn,
            hasMyPlayer: !!myPlayer,
            inHospital: myPlayer?.getInHospitalTurns() || 0,
            shouldSkip: shouldSkip,
            hasPendingDecision: hasPendingDecision,
            btnRollEnabled: canRollButton,
            decisionFallback: decisionFallback,
            btnSkipVisible: isMyTurn && shouldSkip
        });

        // btn_skipTurn: 轮到自己 && 在医院
        if (this.m_btn_skipTurn) {
            this.m_btn_skipTurn.visible = isMyTurn && shouldSkip;
            this.m_btn_skipTurn.enabled = isMyTurn && shouldSkip;  // ✅ 同时设置 enabled
            console.log('[UIInGameDice] SkipTurn 按钮:', (isMyTurn && shouldSkip) ? '显示并启用' : '隐藏');
        }

        // dice: 轮到自己 && 不在医院（待决策时作为兜底入口）
        this.m_btn_roll.enabled = canRollButton;

        console.log('[UIInGameDice] 骰子按钮 enabled =', canRollButton);
        console.log('[UIInGameDice] _updateButtonState 完成');
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

        // 如果正在选择卡牌目标tile，先取消选择
        if (UICardTileSelector.isSelecting()) {
            console.log('[UIInGameDice] 掷骰子前取消卡牌tile选择');
            UICardTileSelector.cancelSelection();
            CardUsageManager.instance.clearCurrentCard();
        }

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

            // ===== 【兜底检测】检查是否有待决策 =====
            const pendingDecision = session.getPendingDecision();
            if (pendingDecision) {
                console.log('[UIInGameDice] 检测到待决策，显示决策窗口（兜底）', pendingDecision);

                // 停止骰子动画
                DiceController.instance.stopRolling();

                // 恢复按钮状态
                if (this.m_btn_roll) {
                    this.m_btn_roll.enabled = true;
                }

                const decisionAlreadyShowing = this._isDecisionUIShowing(pendingDecision);
                if (!decisionAlreadyShowing) {
                    // 显示决策窗口
                    this._showDecisionDialogFallback(pendingDecision, session);

                    // 提示用户
                    UINotification.warning('请先处理待决策事项', undefined, undefined, 'center');
                } else {
                    console.log('[UIInGameDice] 决策窗口已显示，忽略重复点击');
                }

                return;  // 不提交交易
            }

            // ===== 2. 检查跳过移动 / 遥控骰子路径 =====
            const pendingPath = session.getPendingRemoteDicePath();
            const currentRound = session.getRound();

            let pathResult: { success: boolean; path: number[]; actualSteps: number; error?: string };
            let diceCount: number;

            // 通用化检测：是否应该跳过移动（冰冻、瞬移等）
            const shouldSkipMovement = player.shouldSkipMovement(currentRound);

            if (shouldSkipMovement) {
                // === 跳过移动模式 ===
                // 被冰冻或瞬移后，直接传 path=[], diceCount=0
                console.log('[UIInGameDice] 检测到跳过移动 buff，使用 diceCount=0');
                pathResult = { success: true, path: [], actualSteps: 0 };
                diceCount = 0;
            } else if (pendingPath && pendingPath.length > 0) {
                // 遥控骰子模式：直接使用已保存的路径
                console.log("[UIInGameDice] 遥控骰子模式，使用已保存路径:", pendingPath);

                pathResult = {
                    success: true,
                    path: pendingPath,
                    actualSteps: pendingPath.length
                };
                // 遥控骰子的骰子数量由路径长度决定（向上取整）
                diceCount = Math.ceil(pendingPath.length / 6);
            } else {
                // ===== 3. 正常骰子模式：计算路径 =====
                diceCount = this._getDiceCount(player, session.getRound());
                const maxSteps = diceCount * 6;  // 每个骰子最多6步

                console.log(`[UIInGameDice] 骰子数量: ${diceCount}, 最大步数: ${maxSteps}`);

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

                pathResult = pathCalculator.calculatePath({
                    startTile: player.getPos(),
                    steps: maxSteps,
                    preference: preference,
                    lastTile: player.getLastTileId(),
                    nextTileId: player.getNextTileId(),
                    rotorHistory: rotorHistory
                });

                if (!pathResult.success) {
                    throw new Error(`路径计算失败: ${pathResult.error}`);
                }

                // 保存 Rotor-Router 历史记录（如果使用该偏好）
                if (preference === WalkingPreference.ROTOR_ROUTER) {
                    const updatedHistory = pathCalculator.getRotorHistory();
                    HistoryStorage.save(session.getGameId(), player.getPlayerIndex(), updatedHistory);
                    console.log("[UIInGameDice] Rotor-Router 历史记录已保存");
                }

                // 校验路径合法性
                const isValid = pathCalculator.validatePath(player.getPos(), pathResult.path);
                if (!isValid) {
                    throw new Error("路径校验失败：包含无效的邻接关系");
                }
            }

            console.log("[UIInGameDice] 路径计算成功", {
                path: pathResult.path,
                steps: pathResult.actualSteps,
                isRemoteDice: !!pendingPath,
                diceCount: diceCount
            });

            // ===== 5. 播放骰子动画（使用 UI 选中的骰子数） =====
            await this._playDiceAnimation(this._selectedDiceCount);

            // ===== 6. 提交链上交易 =====
            console.log("[UIInGameDice] 提交链上交易...");

            const result = await SuiManager.instance.rollAndStep(session, pathResult.path, diceCount);

            console.log("[UIInGameDice] 交易成功", {
                txHash: result.txHash,
                diceValues: result.diceValues,
                endPos: result.endPos
            });

            transactionSuccess = true;  // 标记交易成功

            // 清除遥控骰子路径（如果有）
            session.clearPendingRemoteDicePath();

            // ===== 显示成功通知 =====
            const gasInfo = (result as any)._gasInfo;
            const txUrl = SuiManager.instance.getExplorer(result.txHash, 'txblock');
            UINotification.txNotification(true, '掷骰成功', result.txHash, gasInfo, txUrl);

            // ===== 7. 交易成功，等待事件处理 =====
            // EventIndexer 会监听链上 RollAndStepActionEvent
            // 然后触发 RollAndStepHandler 处理，自动播放动画
            // TurnChanged 事件会更新按钮状态，这里不需要恢复

        } catch (error) {
            console.error("[UIInGameDice] 掷骰子失败:", error);

            // ===== 添加详细调试日志 =====
            console.log('========== 掷骰子失败 - 详细调试信息 ==========');

            try {
                const session = GameInitializer.getInstance()?.getGameSession();

                // 1. 打印 Game 对象完整 JSON（从 SuiManager 获取）
                const { SuiManager } = await import('../../sui/managers/SuiManager');
                const gameId = session?.getGameId();
                if (gameId) {
                    const game = await SuiManager.instance.getGameState(gameId);
                    if (game) {
                        console.log('【链上 Game 对象】:', JSON.stringify(game, (key, value) =>
                            typeof value === 'bigint' ? value.toString() : value
                        , 2));
                    } else {
                        console.log('【链上 Game 对象】: 查询失败');
                    }
                }

                // 2. 打印 GameSession 状态
                if (session) {
                    console.log('【GameSession 状态】:');
                    console.log('  游戏ID:', session.getGameId());
                    console.log('  当前轮次 (round):', session.getRound());
                    console.log('  轮内回合 (turn):', session.getTurn());
                    console.log('  活跃玩家索引 (activePlayerIndex):', session.getActivePlayerIndex());
                    console.log('  我的玩家索引 (myPlayerIndex):', session.getMyPlayerIndex());
                    console.log('  是否已掷骰 (hasRolled):', session.hasRolled());
                    console.log('  是否我的回合 (isMyTurn):', session.isMyTurn());

                    // 3. 打印待决策详细信息
                    const pendingDecision = session.getPendingDecision();
                    if (pendingDecision) {
                        console.log('【客户端 PendingDecision】:');
                        console.log('  决策类型 (type):', pendingDecision.type);
                        console.log('  相关地块ID (tileId):', pendingDecision.tileId);
                        console.log('  相关金额 (amount):', pendingDecision.amount?.toString());

                        // 打印建筑详细信息
                        const building = session.getBuildingByTileId(pendingDecision.tileId);
                        if (building) {
                            console.log('  建筑信息:', {
                                buildingId: building.buildingId,
                                size: building.size,
                                level: building.level,
                                owner: building.owner,
                                entranceTileIds: building.entranceTileIds
                            });
                        } else {
                            console.log('  未找到建筑（地块ID:', pendingDecision.tileId, '）');
                        }
                    } else {
                        console.log('【客户端 PendingDecision】: null');
                    }

                    // 4. 打印玩家列表
                    const players = session.getPlayers();
                    console.log('【玩家列表】:', players.map((p, i) => ({
                        index: i,
                        address: p.getOwner()?.substring(0, 10) + '...',
                        pos: p.getPos(),
                        cash: p.getCash()?.toString(),
                        isActive: i === session.getActivePlayerIndex()
                    })));
                }

                // 5. 打印 SuiManager 当前地址
                console.log('【SuiManager】:');
                console.log('  当前地址:', SuiManager.instance.currentAddress?.substring(0, 10) + '...');

            } catch (debugError) {
                console.error('[UIInGameDice] 打印调试日志失败:', debugError);
            }

            console.log('========== 调试信息结束 ==========');

            // ===== 停止骰子动画 =====
            DiceController.instance.stopRolling();

            // ===== 使用统一错误处理器 =====
            handleSuiTransactionError(error, {
                title: '掷骰子失败',
                messagePrefix: ''  // 不添加前缀，直接显示翻译后的错误
            });

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
     * 获取当前选择的骰子数量
     *
     * 遥控骰子(MOVE_CTRL)和机车卡(LOCOMOTIVE)是独立功能：
     * - 机车卡：控制骰子数量（无buff只能1个，摩托车buff可选1-2个，汽车buff可选1-3个）
     * - 遥控骰子：控制骰子点数（用户指定路径而非随机）
     *
     * @param player 玩家对象
     * @param currentRound 当前轮次
     * @returns 骰子数量（1-3）
     */
    private _getDiceCount(player: any, currentRound: number): number {
        // 获取最大允许骰子数
        let maxDice = 1;
        if (player) {
            const locomotiveBuff = player.getBuff(BuffKind.LOCOMOTIVE);
            // 永久buff: last_active_round = 0xFFFF (65535)
            if (locomotiveBuff && currentRound <= locomotiveBuff.last_active_round) {
                const value = Number(locomotiveBuff.value);  // 显式转换为 number 进行比较
                maxDice = value >= 3 ? 3 : value >= 2 ? 2 : 1;
            }
        }

        // 验证选择不超出范围
        if (this._selectedDiceCount > maxDice) {
            console.warn(`[UIInGameDice] 骰子数量超出范围，强制使用${maxDice}个`);
            return maxDice;
        }

        return this._selectedDiceCount;
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

        let transactionSuccess = false;  // 记录交易是否成功

        try {
            const session = GameInitializer.getInstance()?.getGameSession();
            if (!session) {
                throw new Error('GameSession 未找到');
            }

            // 调用 SuiManager 封装方法
            const result = await SuiManager.instance.skipTurn(session);

            console.log('[UIInGameDice] 跳过回合交易已发送');

            transactionSuccess = true;  // 标记交易成功

            // 显示成功通知
            const gasInfo = (result as any)._gasInfo;
            const txUrl = SuiManager.instance.getExplorer(result.txHash, 'txblock');
            UINotification.txNotification(true, '跳过回合成功', result.txHash, gasInfo, txUrl);

            // ===== 7. 交易成功，等待事件处理 =====
            // EventIndexer 会监听链上 SkipTurnEvent
            // 然后触发 SkipTurnHandler 处理，更新回合状态
            // TurnChanged 事件会更新按钮状态，这里不需要恢复

        } catch (error) {
            console.error('[UIInGameDice] 跳过回合失败', error);

            // 使用统一错误处理器
            handleSuiTransactionError(error, {
                title: '跳过回合失败'
            });

        } finally {
            // 只在失败时恢复按钮状态
            if (!transactionSuccess && this.m_btn_skipTurn) {
                // 恢复为当前回合状态（而不是无条件 true）
                const session = GameInitializer.getInstance()?.getGameSession();
                if (session) {
                    const myPlayer = session.getMyPlayer();
                    const shouldSkip = myPlayer && myPlayer.isInHospital();
                    const isMyTurn = session.isMyTurn();
                    this.m_btn_skipTurn.enabled = isMyTurn && shouldSkip;

                    console.log('[UIInGameDice] 交易失败，恢复按钮状态:', (isMyTurn && shouldSkip) ? '启用' : '禁用');
                }
            }
            // 成功时保持 disabled，等待 TurnChanged 事件更新
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
        console.log('[UIInGameDice] >>>>>> _onTurnChanged 被调用 <<<<<<', data);
        this._updateButtonState();  // 统一使用 _updateButtonState
        this._updateDiceCountOptions();  // 同时更新骰子数量选项
    }

    /**
     * 决策状态变化处理（待决策/决策完成时更新骰子按钮状态）
     */
    private _onDecisionStateChanged(): void {
        console.log('[UIInGameDice] >>>>>> _onDecisionStateChanged 被调用 <<<<<<');
        this._updateButtonState();
    }

    /**
     * Buff变化处理（使用摩托车卡/汽车卡后更新骰子数量选项）
     */
    private _onBuffsUpdated(): void {
        console.log('[UIInGameDice] >>>>>> _onBuffsUpdated 被调用 <<<<<<');
        this._updateDiceCountOptions();
    }

    /**
     * 更新骰子数量选择按钮的可用性
     *
     * - 无buff：只能选1个骰子
     * - LOCOMOTIVE buff value=2（摩托车）：可选1-2个骰子
     * - LOCOMOTIVE buff value=3（汽车）：可选1-3个骰子
     * - 永久buff：last_active_round = 0xFFFF (65535)
     */
    private _updateDiceCountOptions(): void {
        const session = GameInitializer.getInstance()?.getGameSession();
        const player = session?.getMyPlayer();
        const round = session?.getRound() || 0;

        // 获取最大骰子数（默认1，有LOCOMOTIVE buff时根据value决定）
        let maxDice = 1;
        if (player) {
            const locomotiveBuff = player.getBuff(BuffKind.LOCOMOTIVE);
            if (locomotiveBuff && round <= locomotiveBuff.last_active_round) {
                const value = Number(locomotiveBuff.value);  // 显式转换为 number 进行比较
                maxDice = value >= 3 ? 3 : value >= 2 ? 2 : 1;
            }
        }

        // 根据maxDice设置按钮可用状态
        if (this.m_btn_diceNum_1) {
            this.m_btn_diceNum_1.enabled = true;  // 1始终可用
        }
        if (this.m_btn_diceNum_2) {
            this.m_btn_diceNum_2.enabled = maxDice >= 2;
        }
        if (this.m_btn_diceNum_3) {
            this.m_btn_diceNum_3.enabled = maxDice >= 3;
        }

        // 如果当前选择超出范围，重置为1
        if (this._selectedDiceCount > maxDice) {
            this._selectedDiceCount = 1;
        }

        // 更新控制器状态
        if (this.m_ctrl_diceNum) {
            this.m_ctrl_diceNum.selectedIndex = this._selectedDiceCount - 1;
        }
    }

    /**
     * 骰子数量选择按钮点击
     *
     * @param count 骰子数量（1-3）
     */
    private _onDiceCountSelect(count: number): void {
        console.log(`[UIInGameDice] 选择骰子数量: ${count}`);

        this._selectedDiceCount = count;

        // 更新控制器状态（控制器索引从0开始）
        if (this.m_ctrl_diceNum) {
            this.m_ctrl_diceNum.selectedIndex = count - 1;
        }
    }

    /**
     * 判断决策窗口是否已显示（避免重复弹窗）
     */
    private _isDecisionUIShowing(decision: PendingDecisionInfo): boolean {
        if (decision.type === DecisionType.CARD_SHOP) {
            return UIManager.instance.isUIShowing('CardShop');
        }
        return UIManager.instance.isUIShowing('MessageBox');
    }

    /**
     * 显示决策窗口（兜底方案）
     * 用于在掷骰子前检测到待决策时主动显示
     */
    private _showDecisionDialogFallback(decision: PendingDecisionInfo, session: any): void {
        const myPlayer = session.getMyPlayer();
        if (!myPlayer) {
            console.warn('[UIInGameDice] 无法获取当前玩家');
            return;
        }

        // 根据决策类型显示不同的窗口
        switch (decision.type) {
            case DecisionType.BUY_PROPERTY:
                console.log('[UIInGameDice] 显示购买决策窗口');
                DecisionDialogHelper.showBuyDialog(decision, session);
                break;

            case DecisionType.UPGRADE_PROPERTY:
                // 检查是否是 2x2 lv0 升级（需要选择建筑类型）
                const building = session.getBuildingByTileId(decision.tileId);
                if (building && building.size === BuildingSize.SIZE_2X2 && building.level === 0) {
                    console.log('[UIInGameDice] 2x2 lv0 升级，触发 DecisionPending 事件');
                    // 触发事件，让 UIInGameBuildingSelect 处理
                    EventBus.emit(EventTypes.Game.DecisionPending, {
                        session: session,
                        decision: decision
                    });
                } else {
                    console.log('[UIInGameDice] 显示升级决策窗口');
                    DecisionDialogHelper.showUpgradeDialog(decision, session);
                }
                break;

            case DecisionType.PAY_RENT:
                console.log('[UIInGameDice] 显示租金决策窗口');
                DecisionDialogHelper.showRentDialog(decision, session);
                break;

            case DecisionType.CARD_SHOP:
                console.log('[UIInGameDice] 显示卡片商店');
                UIManager.instance.showUI('CardShop', { parentUIName: 'InGame' });
                break;

            default:
                console.warn('[UIInGameDice] 未知的决策类型', decision.type);
        }
    }
}
