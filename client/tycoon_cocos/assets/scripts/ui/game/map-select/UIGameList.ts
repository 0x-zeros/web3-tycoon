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
import { IdFormatter } from "../../utils/IdFormatter";
import { EventBus } from "../../../events/EventBus";
import { EventTypes } from "../../../events/EventTypes";
import type { Game } from "../../../sui/types/game";
import { getGameStatusText } from "../../../sui/types/constants";
import { ListFilter, FilterConfig } from "../../filter/ListFilter";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';

/**
 * Game 列表过滤配置
 * 支持按 gameid、mapid、player 三个字段联合过滤（AND逻辑）
 */
const GAME_FILTER_CONFIG: FilterConfig<Game> = {
    fields: [
        { name: 'gameid', extractor: (g) => g.id },
        { name: 'mapid', extractor: (g) => g.template_map_id || '' },
        { name: 'player', extractor: (g) => g.players.map(p => p.owner) }
    ],
    logic: 'AND'
};

const { ccclass } = _decorator;

@ccclass('UIGameList')
export class UIGameList extends UIBase {
    // 组件引用
    private m_list: fgui.GList;
    private m_btn_joinGame: fgui.GButton;

    // 搜索组件引用
    private m_searchComponent: fgui.GComponent | null = null;
    private m_btnFilter: fgui.GButton | null = null;
    private m_btnNoFilter: fgui.GButton | null = null;
    private m_gameidInput: fgui.GTextInput | null = null;
    private m_mapidInput: fgui.GTextInput | null = null;
    private m_playerInput: fgui.GTextInput | null = null;

    // 过滤器
    private _filter: ListFilter<Game> = new ListFilter<Game>(GAME_FILTER_CONFIG);

    // 数据
    private _games: Game[] = [];
    private _displayGames: Game[] = [];  // 当前显示的数据（可能是过滤后的）
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
        // 按钮在 data 组件中，this._panel 就是 data
        this.m_btn_joinGame = this.getButton('btn_joinGame');

        // 获取列表
        this.m_list = this.getList("game_id");

        // 获取搜索组件
        this.m_searchComponent = this.getFGuiComponent('searchGame');
        if (this.m_searchComponent) {
            this.m_gameidInput = this.m_searchComponent.getChild('gameid') as fgui.GTextInput;
            this.m_mapidInput = this.m_searchComponent.getChild('mapid') as fgui.GTextInput;
            this.m_playerInput = this.m_searchComponent.getChild('player') as fgui.GTextInput;
            this.m_btnFilter = this.m_searchComponent.getChild('btn_filter') as fgui.GButton;
            this.m_btnNoFilter = this.m_searchComponent.getChild('btn_noFilter') as fgui.GButton;
        }

        console.log('[UIGameList] Components setup');
        console.log('  m_btn_joinGame:', !!this.m_btn_joinGame);
        console.log('  m_list:', !!this.m_list);
        console.log('  m_searchComponent:', !!this.m_searchComponent);
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        this.m_btn_joinGame?.onClick(this._onJoinGameClick, this);

        // 监听游戏列表更新事件（缓存更新时自动刷新）
        EventBus.on(EventTypes.Sui.GamesListUpdated, this._onGamesListUpdated, this);

        // 搜索组件事件绑定
        this.m_btnFilter?.onClick(this._onFilterClick, this);
        this.m_btnNoFilter?.onClick(this._onNoFilterClick, this);

        // 实时过滤：监听输入框变化
        this.m_gameidInput?.on(fgui.Event.TEXT_CHANGE, this._onFilterClick, this);
        this.m_mapidInput?.on(fgui.Event.TEXT_CHANGE, this._onFilterClick, this);
        this.m_playerInput?.on(fgui.Event.TEXT_CHANGE, this._onFilterClick, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        this.m_btn_joinGame?.offClick(this._onJoinGameClick, this);
        EventBus.off(EventTypes.Sui.GamesListUpdated, this._onGamesListUpdated, this);

        // 搜索组件事件解绑
        this.m_btnFilter?.offClick(this._onFilterClick, this);
        this.m_btnNoFilter?.offClick(this._onNoFilterClick, this);
        this.m_gameidInput?.off(fgui.Event.TEXT_CHANGE, this._onFilterClick, this);
        this.m_mapidInput?.off(fgui.Event.TEXT_CHANGE, this._onFilterClick, this);
        this.m_playerInput?.off(fgui.Event.TEXT_CHANGE, this._onFilterClick, this);

        super.unbindEvents();
    }

    /**
     * 刷新数据
     */
    public refresh(): void {
        console.log('[UIGameList] Refreshing game list');

        // 从 SuiManager 获取缓存的 Game 列表
        this._games = SuiManager.instance.getCachedGames();
        this._filter.setData(this._games);

        console.log(`[UIGameList] Loaded ${this._games.length} games`);

        // 重新应用当前过滤条件（保持输入框状态）
        this._applyCurrentFilter();
    }

    /**
     * 应用当前输入框的过滤条件
     */
    private _applyCurrentFilter(): void {
        const searchValues = new Map<string, string>();
        searchValues.set('gameid', this.m_gameidInput?.text ?? '');
        searchValues.set('mapid', this.m_mapidInput?.text ?? '');
        searchValues.set('player', this.m_playerInput?.text ?? '');

        const filtered = this._filter.filter(searchValues);
        this._renderList(filtered);
    }

    /**
     * 渲染列表（供过滤器调用）
     */
    private _renderList(data: Game[]): void {
        this._displayGames = data;

        if (!this.m_list) return;

        // 设置数量并填充
        this.m_list.numItems = data.length;
        console.log('  List updated, numItems:', this.m_list.numItems);

        for (let i = 0; i < data.length; i++) {
            const item = this.m_list.getChildAt(i);
            if (!item) continue;
            this._renderItemWithGame(i, item, data[i]);
        }

        // 处理选中状态并同步 GameDetail
        if (data.length > 0) {
            let selectedIndex = 0;

            // 尝试保持之前的选中状态
            if (this._selectedGameId) {
                const index = data.findIndex(g => g.id === this._selectedGameId);
                if (index >= 0) {
                    selectedIndex = index;
                }
            }

            // 选中并同步当前游戏数据（不弹出面板）
            this._selectGame(selectedIndex);
            SuiManager.instance.setCurrentGame(data[selectedIndex]);
        } else {
            // 清空选中状态
            this._selectedIndex = -1;
            this._selectedGameId = null;
        }
    }

    /**
     * 过滤按钮点击 / 输入框变化
     */
    private _onFilterClick(): void {
        console.log('[UIGameList] Filter triggered');
        this._applyCurrentFilter();
    }

    /**
     * 恢复按钮点击（清空过滤）
     */
    private _onNoFilterClick(): void {
        // 清空输入框
        if (this.m_gameidInput) this.m_gameidInput.text = '';
        if (this.m_mapidInput) this.m_mapidInput.text = '';
        if (this.m_playerInput) this.m_playerInput.text = '';

        const all = this._filter.reset();
        console.log(`[UIGameList] Filter cleared, showing all ${all.length} games`);
        this._renderList(all);
    }

    /**
     * 渲染列表项
     */
    private _renderItemWithGame(index: number, item: fgui.GObject, game: Game): void {
        const button = item.asCom as fgui.GButton;

        // 显示索引（从 1 开始）
        const indexText = button.getChild("index") as fgui.GTextField;
        if (indexText) {
            indexText.text = (index + 1).toString();
        }

        // 根据 FairyGUI 的实际组件名称设置
        const gameidText = button.getChild("gameid") as fgui.GTextField;
        if (gameidText) {
            gameidText.text = game.id;  // ✅ 完整显示
        }

        const mapidText = button.getChild("mapid") as fgui.GTextField;
        if (mapidText) {
            mapidText.text = game.template_map_id || 'N/A';  // ✅ 完整显示
        }

        // 显示游戏状态
        const statusText = button.getChild("status") as fgui.GTextField;
        if (statusText) {
            statusText.text = getGameStatusText(game.status);  // ✅ 中文状态
        }

        // 显示玩家列表（player_0, player_1, player_2, player_3）
        for (let i = 0; i < 4; i++) {
            const playerText = button.getChild(`player_${i}`) as fgui.GTextField;
            if (playerText) {
                if (i < game.players.length) {
                    const player = game.players[i];
                    playerText.text = IdFormatter.shortenAddress(player.owner);  // ✅ 短地址
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
        if (index < 0 || index >= this._displayGames.length) return;

        this._selectedIndex = index;
        const game = this._displayGames[index];
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

            // ✅ 删除错误的 GameStart emit
            // 游戏开始由链上 GameStartedEvent 触发，不是加入时触发

        } catch (error) {
            console.error('[UIGameList] Failed to join game:', error);
            UINotification.error("加入游戏失败");
        }
    }

    /**
     * 根据游戏 ID 选中（用于外部调用）
     */
    public selectGameById(gameId: string): void {
        console.log('[UIGameList] selectGameById:', gameId);

        const index = this._displayGames.findIndex(g => g.id === gameId);

        if (index >= 0) {
            this._selectGame(index);

            // 滚动到该项
            if (this.m_list?.scrollToView) {
                this.m_list.scrollToView(index);
            }
        } else {
            console.warn('[UIGameList] Game not found in list:', gameId);
        }
    }

    /**
     * 列表项点击（统一处理，避免重复绑定多个闭包）
     */
    private _onItemClick(evt: fgui.Event): void {
        const btn = evt.sender as fgui.GButton;
        const index = (btn?.data as number) ?? -1;

        if (index >= 0 && index < this._displayGames.length) {
            this._selectGame(index);

            // ✅ 点击后显示 GameDetail
            const game = this._displayGames[index];
            this._showGameDetail(game);
        }
    }

    /**
     * 显示游戏详情
     */
    private _showGameDetail(game: Game): void {
        console.log('[UIGameList] Showing game detail:', game.id);

        // 1. 设置当前游戏（使用公开方法）
        SuiManager.instance.setCurrentGame(game);

        // 2. 发送事件，让父容器显示 GameDetail
        EventBus.emit(EventTypes.Game.ShowGameDetail, { gameId: game.id });
    }

    /**
     * 游戏列表更新事件（缓存已更新）
     */
    private _onGamesListUpdated(): void {
        console.log('[UIGameList] GamesListUpdated event received');
        this.refresh();  // 刷新显示
    }
}
