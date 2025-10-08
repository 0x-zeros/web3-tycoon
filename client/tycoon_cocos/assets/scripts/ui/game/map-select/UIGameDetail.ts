/**
 * 游戏详情子模块
 * 显示创建成功的游戏详情，管理开始游戏、退出游戏等操作
 */

import { UIBase } from "../../core/UIBase";
import { SuiManager } from "../../../sui/managers/SuiManager";
import { UINotification } from "../../utils/UINotification";
import { UIMessage } from "../../utils/UIMessage";
import { IdFormatter } from "../../utils/IdFormatter";
import type { Game } from "../../../sui/types/game";
import { DEFAULT_MAX_PLAYERS } from "../../../sui/types/constants";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';

const { ccclass } = _decorator;

@ccclass('UIGameDetail')
export class UIGameDetail extends UIBase {
    // 按钮
    private m_btn_ok: fgui.GButton;
    private m_btn_quitGame: fgui.GButton;
    private m_btn_startGame: fgui.GButton;

    // 文本字段
    private m_gameid: fgui.GTextField;
    private m_mapid: fgui.GTextField;
    private m_player_0: fgui.GTextField;
    private m_player_1: fgui.GTextField;
    private m_player_2: fgui.GTextField;
    private m_player_3: fgui.GTextField;

    // 父容器引用（用于返回）
    private _parentUI: any = null;

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
        // 获取按钮
        this.m_btn_ok = this.getButton('btn_ok');
        this.m_btn_quitGame = this.getButton('btn_quitGame');
        this.m_btn_startGame = this.getButton('btn_startGame');

        // 获取文本字段
        this.m_gameid = this.getText('gameid');
        this.m_mapid = this.getText('mapid');
        this.m_player_0 = this.getText('player_0');
        this.m_player_1 = this.getText('player_1');
        this.m_player_2 = this.getText('player_2');
        this.m_player_3 = this.getText('player_3');

        console.log('[UIGameDetail] Components setup');
        console.log('  Buttons found:', !!this.m_btn_ok, !!this.m_btn_quitGame, !!this.m_btn_startGame);
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        this.m_btn_ok?.onClick(this._onOkClick, this);
        this.m_btn_quitGame?.onClick(this._onQuitGameClick, this);
        this.m_btn_startGame?.onClick(this._onStartGameClick, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        this.m_btn_ok?.offClick(this._onOkClick, this);
        this.m_btn_quitGame?.offClick(this._onQuitGameClick, this);
        this.m_btn_startGame?.offClick(this._onStartGameClick, this);
        super.unbindEvents();
    }

    /**
     * 设置父容器引用
     */
    public setParentUI(parent: any): void {
        this._parentUI = parent;
    }

    /**
     * 显示游戏详情
     */
    public showGame(): void {
        const game = SuiManager.instance.currentGame;
        if (!game) {
            console.error('[UIGameDetail] No current game');
            UINotification.error("无法获取游戏详情");
            return;
        }

        console.log('[UIGameDetail] Showing game:', game.id);

        // 显示游戏 ID
        if (this.m_gameid) {
            this.m_gameid.text = game.id;  // ✅ 完整显示
        }

        // 显示地图 ID
        if (this.m_mapid) {
            this.m_mapid.text = game.template_map_id;  // ✅ 完整显示
        }

        // 显示玩家列表
        const currentAddress = SuiManager.instance.currentAddress;
        const isPlayer = game.players.some(p => p.owner === currentAddress);

        for (let i = 0; i < 4; i++) {
            const playerField = this[`m_player_${i}`] as fgui.GTextField;
            if (playerField) {
                if (i < game.players.length) {
                    const player = game.players[i];
                    playerField.text = IdFormatter.shortenAddress(player.owner);  // ✅ 短地址
                } else {
                    playerField.text = '---';  // 空位
                }
            }
        }

        // 按钮显示逻辑
        const canJoin = game.players.length < DEFAULT_MAX_PLAYERS;
        const canStart = game.players.length >= 2;

        if (isPlayer) {
            // 已是玩家：显示"开始游戏"
            this.m_btn_startGame.title = "开始游戏";
            this.m_btn_startGame.visible = true;
            this.m_btn_startGame.enabled = canStart;  // 人数 >= 2 才能开始
            this.m_btn_startGame.grayed = !canStart;

            this.m_btn_quitGame.visible = true;
        } else if (canJoin) {
            // 不是玩家但可加入：显示"加入游戏"
            this.m_btn_startGame.title = "加入游戏";
            this.m_btn_startGame.visible = true;
            this.m_btn_startGame.enabled = true;
            this.m_btn_startGame.grayed = false;

            this.m_btn_quitGame.visible = false;
        } else {
            // 不是玩家且已满员：显示"已满员"
            this.m_btn_startGame.title = "已满员";
            this.m_btn_startGame.visible = true;
            this.m_btn_startGame.enabled = false;
            this.m_btn_startGame.grayed = true;

            this.m_btn_quitGame.visible = false;
        }

        console.log('[UIGameDetail] Game displayed');
        console.log('  Players count:', game.players.length);
        console.log('  Is player:', isPlayer);
        console.log('  Can join:', canJoin);
        console.log('  Can start:', canStart);
    }

    /**
     * OK 按钮点击 - 返回主界面
     */
    private _onOkClick(): void {
        console.log('[UIGameDetail] OK clicked, returning to main panel');

        // 调用父容器的方法返回主界面
        if (this._parentUI && this._parentUI.showMainPanel) {
            this._parentUI.showMainPanel();
        }
    }

    /**
     * 退出游戏按钮点击
     */
    private _onQuitGameClick(): void {
        console.log('[UIGameDetail] Quit game clicked');
        // TODO: 实现退出游戏逻辑
        UINotification.info("退出游戏功能待实现");
    }

    /**
     * 开始游戏/加入游戏按钮点击
     */
    private async _onStartGameClick(): Promise<void> {
        console.log('[UIGameDetail] Start/Join game clicked');

        const game = SuiManager.instance.currentGame;
        if (!game) {
            console.error('[UIGameDetail] No current game');
            return;
        }

        const currentAddress = SuiManager.instance.currentAddress;
        const isPlayer = game.players.some(p => p.owner === currentAddress);

        if (isPlayer) {
            // 已是玩家：开始游戏
            await this._handleStartGame(game);
        } else {
            // 不是玩家：加入游戏
            await this._handleJoinGame(game);
        }
    }

    /**
     * 处理开始游戏
     */
    private async _handleStartGame(game: Game): Promise<void> {
        // 验证玩家数
        if (game.players.length < 2) {
            UINotification.warning("至少需要 2 名玩家才能开始游戏");
            return;
        }

        try {
            UINotification.info("正在开始游戏...");

            await SuiManager.instance.startGame(game.id, game.template_map_id);

            UINotification.success("游戏已开始");

            // 游戏开始后的处理由 SuiManager.startGame 发送 GameStart 事件

        } catch (error) {
            console.error('[UIGameDetail] Failed to start game:', error);
            UINotification.error("开始游戏失败");
        }
    }

    /**
     * 处理加入游戏
     */
    private async _handleJoinGame(game: Game): Promise<void> {
        try {
            UINotification.info("正在加入游戏...");

            const result = await SuiManager.instance.joinGame(game.id);

            console.log('[UIGameDetail] Joined game successfully');
            console.log('  Seat ID:', result.seatId);
            console.log('  Player index:', result.playerIndex);

            // ✅ 使用 MessageBox 显示详细成功信息
            await UIMessage.success(
                `加入游戏成功！\n\n` +
                `座位 ID: ${result.seatId}\n` +
                `玩家序号: #${result.playerIndex + 1}\n` +
                `交易哈希: ${result.txHash}\n\n` +
                `等待其他玩家加入或游戏开始...`,
                "加入成功"
            );

            // 重新查询游戏详情并刷新显示
            const updatedGame = await SuiManager.instance.getGameState(game.id);
            if (updatedGame) {
                (SuiManager.instance as any)._currentGame = updatedGame;
                this.showGame();  // 刷新显示
            }

        } catch (error) {
            console.error('[UIGameDetail] Failed to join game:', error);

            // ✅ 使用 MessageBox 显示详细错误信息
            const errorMsg = (error as any)?.message || error?.toString() || '未知错误';
            await UIMessage.error(
                `加入游戏失败\n\n` +
                `错误信息: ${errorMsg}\n\n` +
                `请检查网络连接或稍后重试`,
                "加入失败"
            );
        }
    }
}
