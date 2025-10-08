/**
 * 链上 Game 列表子模块
 * 负责显示和管理从 Sui 链查询的 Game 列表
 *
 * 功能：
 * - 显示可加入的游戏列表
 * - 选择游戏
 * - 加入游戏（调用 game::join）
 */

import { UIBase } from "../../core/UIBase";
import { SuiManager } from "../../../sui/managers/SuiManager";
import { UINotification } from "../../utils/UINotification";
import { EventBus } from "../../../events/EventBus";
import { EventTypes } from "../../../events/EventTypes";
import type { Game } from "../../../sui/types/game";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';

const { ccclass } = _decorator;

@ccclass('UIGameList')
export class UIGameList extends UIBase {
    // 组件引用
    private m_list: fgui.GList;
    private m_btn_joinGame: fgui.GButton;

    // 数据
    private _games: Game[] = [];
    private _selectedGameId: string | null = null;
    private _selectedIndex: number = -1;

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
        // 从父组件（data）中获取按钮
        const dataComp = this._panel?.parent as fgui.GComponent;
        if (dataComp) {
            this.m_btn_joinGame = dataComp.getChild('btn_joinGame') as fgui.GButton;
        }

        // 获取列表
        this.m_list = this.getList("list");

        // 设置列表渲染器
        if (this.m_list) {
            this.m_list.itemRenderer = this._renderItem.bind(this);
        }

        console.log('[UIGameList] Components setup');
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        this.m_btn_joinGame?.onClick(this._onJoinGameClick, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        this.m_btn_joinGame?.offClick(this._onJoinGameClick, this);
        super.unbindEvents();
    }

    /**
     * 刷新数据
     */
    public refresh(): void {
        console.log('[UIGameList] Refreshing game list');

        // 从 SuiManager 获取缓存的 Game 列表
        this._games = SuiManager.instance.getCachedGames();

        console.log(`[UIGameList] Loaded ${this._games.length} games`);

        // 更新列表
        if (this.m_list) {
            this.m_list.numItems = this._games.length;

            // 默认选择第一个
            if (this._games.length > 0) {
                this._selectGame(0);
            }
        }
    }

    /**
     * 渲染列表项
     */
    private _renderItem(index: number, item: fgui.GObject): void {
        if (index >= this._games.length) return;

        const game = this._games[index];
        const button = item.asCom as fgui.GButton;

        // 设置显示信息
        const title = button.getChild("title") as fgui.GTextField;
        if (title) {
            title.text = `游戏 #${index + 1} (${game.players.length}/${game.players.length} 人)`;
        }

        const info = button.getChild("info") as fgui.GTextField;
        if (info) {
            info.text = `状态: 等待中`;
        }

        // 设置选中状态
        button.selected = (index === this._selectedIndex);

        // 绑定数据和点击事件
        button.data = index;
        button.onClick(() => this._selectGame(index), this);
    }

    /**
     * 选择游戏
     */
    private _selectGame(index: number): void {
        if (index < 0 || index >= this._games.length) return;

        this._selectedIndex = index;
        const game = this._games[index];
        this._selectedGameId = game.id;

        console.log(`[UIGameList] Selected game: ${game.id}`);

        // 刷新列表显示选中状态
        if (this.m_list) {
            this.m_list.refreshVirtualList();
        }
    }

    /**
     * 加入游戏按钮点击
     */
    private async _onJoinGameClick(): Promise<void> {
        console.log('[UIGameList] Join game clicked');

        if (!this._selectedGameId) {
            UINotification.warning("请先选择游戏");
            return;
        }

        // 检查钱包连接
        if (!SuiManager.instance.isConnected) {
            UINotification.warning("请先连接钱包");
            return;
        }

        try {
            UINotification.info("正在加入游戏...");

            const result = await SuiManager.instance.joinGame(this._selectedGameId);

            console.log('[UIGameList] Joined game successfully');
            console.log('  Seat ID:', result.seatId);
            console.log('  Player index:', result.playerIndex);

            UINotification.success(`已加入游戏，玩家 #${result.playerIndex + 1}`);

            // 发送游戏开始事件（进入等待室或游戏界面）
            EventBus.emit(EventTypes.Game.GameStart, {
                gameId: this._selectedGameId,
                seatId: result.seatId,
                playerIndex: result.playerIndex
            });

        } catch (error) {
            console.error('[UIGameList] Failed to join game:', error);
            UINotification.error("加入游戏失败");
        }
    }
}
