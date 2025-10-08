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
        this.m_list = this.getList("game_id");

        // 说明：这里使用“非虚拟列表”的填充方式，
        // 直接通过 numItems + getChildAt(i) 设置内容，避免依赖 setVirtual/itemRenderer
        // 这样与项目中 Wallet 列表的用法保持一致。
        
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
            // 设置数量并填充
            this.m_list.numItems = this._games.length;
            console.log('  List updated, numItems:', this.m_list.numItems);

            for (let i = 0; i < this._games.length; i++) {
                const item = this.m_list.getChildAt(i);
                if (!item) continue;
                this._renderItem(i, item);
            }

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

        // 根据 FairyGUI 的实际组件名称设置
        const gameidText = button.getChild("gameid") as fgui.GTextField;
        if (gameidText) {
            gameidText.text = game.id.slice(0, 10) + '...';  // 截短显示
        }

        const mapidText = button.getChild("mapid") as fgui.GTextField;
        if (mapidText) {
            mapidText.text = game.template_map_id ? game.template_map_id.slice(0, 10) + '...' : 'N/A';
        }

        // 显示玩家列表（player_0, player_1, player_2, player_3）
        for (let i = 0; i < 4; i++) {
            const playerText = button.getChild(`player_${i}`) as fgui.GTextField;
            if (playerText) {
                if (i < game.players.length) {
                    const player = game.players[i];
                    playerText.text = player.owner.slice(0, 8) + '...';
                } else {
                    playerText.text = '---';  // 空位
                }
            }
        }

        // 设置选中状态
        button.selected = (index === this._selectedIndex);

        // 绑定数据和点击事件（先清理旧的监听，再绑定统一的处理函数）
        button.data = index;
        button.offClick(this._onItemClick, this);
        button.onClick(this._onItemClick, this);
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
            this.m_list.selectedIndex = index;
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

    /**
     * 列表项点击（统一处理，避免重复绑定多个闭包）
     */
    private _onItemClick(evt: fgui.Event): void {
        const btn = evt.sender as fgui.GButton;
        const index = (btn?.data as number) ?? -1;
        if (index >= 0) {
            this._selectGame(index);
        }
    }
}
