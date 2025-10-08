/**
 * 游戏详情子模块
 * 显示创建成功的游戏详情，管理开始游戏、退出游戏等操作
 */

import { UIBase } from "../../core/UIBase";
import { SuiManager } from "../../../sui/managers/SuiManager";
import { UINotification } from "../../utils/UINotification";
import type { Game } from "../../../sui/types/game";
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
            this.m_gameid.text = game.id.slice(0, 10) + '...';
        }

        // 显示地图 ID
        if (this.m_mapid) {
            this.m_mapid.text = game.template_map_id.slice(0, 10) + '...';
        }

        // 显示玩家列表
        const currentAddress = SuiManager.instance.currentAddress;
        let isPlayer = false;

        for (let i = 0; i < 4; i++) {
            const playerField = this[`m_player_${i}`] as fgui.GTextField;
            if (playerField) {
                if (i < game.players.length) {
                    const player = game.players[i];
                    playerField.text = player.owner.slice(0, 8) + '...';

                    // 检查是否是当前玩家
                    if (player.owner === currentAddress) {
                        isPlayer = true;
                    }
                } else {
                    playerField.text = '---';  // 空位
                }
            }
        }

        // 按钮显示逻辑
        // quitGame 和 startGame：只有是玩家时才显示
        if (this.m_btn_quitGame) {
            this.m_btn_quitGame.visible = isPlayer;
        }

        if (this.m_btn_startGame) {
            this.m_btn_startGame.visible = isPlayer;

            // startGame 按钮状态：玩家数 >= 2 才能开始
            const canStart = game.players.length >= 2;
            this.m_btn_startGame.enabled = canStart;
            this.m_btn_startGame.grayed = !canStart;
        }

        console.log('[UIGameDetail] Game displayed');
        console.log('  Players count:', game.players.length);
        console.log('  Is player:', isPlayer);
        console.log('  Can start:', game.players.length >= 2);
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
     * 开始游戏按钮点击
     */
    private async _onStartGameClick(): Promise<void> {
        console.log('[UIGameDetail] Start game clicked');

        const game = SuiManager.instance.currentGame;
        if (!game) {
            console.error('[UIGameDetail] No current game');
            return;
        }

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
}
