/**
 * 链上 MapTemplate 列表子模块
 * 负责显示和管理从 Sui 链查询的 MapTemplate 列表
 *
 * 功能：
 * - 显示地图模板列表
 * - 选择地图模板
 * - 创建游戏（调用 game::create_game）
 */

import { UIBase } from "../../core/UIBase";
import { SuiManager } from "../../../sui/managers/SuiManager";
import { UINotification } from "../../utils/UINotification";
import { EventBus } from "../../../events/EventBus";
import { EventTypes } from "../../../events/EventTypes";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';

const { ccclass } = _decorator;

@ccclass('UIMapList')
export class UIMapList extends UIBase {
    // 组件引用
    private m_list: fgui.GList;
    private m_btn_createGame: fgui.GButton;

    // 数据
    private _templates: { id: number; name: string }[] = [];
    private _selectedTemplateId: number | null = null;
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
            this.m_btn_createGame = dataComp.getChild('btn_createGame') as fgui.GButton;
        }

        // 获取列表
        this.m_list = this.getList("list");

        // 设置列表渲染器
        if (this.m_list) {
            this.m_list.itemRenderer = this._renderItem.bind(this);
        }

        console.log('[UIMapList] Components setup');
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        this.m_btn_createGame?.onClick(this._onCreateGameClick, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        this.m_btn_createGame?.offClick(this._onCreateGameClick, this);
        super.unbindEvents();
    }

    /**
     * 刷新数据
     */
    public refresh(): void {
        console.log('[UIMapList] Refreshing map template list');

        // 从 SuiManager 获取缓存的 MapTemplate 列表
        this._templates = SuiManager.instance.getCachedMapTemplates();

        console.log(`[UIMapList] Loaded ${this._templates.length} templates`);

        // 更新列表
        if (this.m_list) {
            this.m_list.numItems = this._templates.length;

            // 默认选择第一个
            if (this._templates.length > 0) {
                this._selectTemplate(0);
            }
        }
    }

    /**
     * 渲染列表项
     */
    private _renderItem(index: number, item: fgui.GObject): void {
        if (index >= this._templates.length) return;

        const template = this._templates[index];
        const button = item.asCom as fgui.GButton;

        // 设置显示信息
        const title = button.getChild("title") as fgui.GTextField;
        if (title) {
            title.text = template.name || `地图模板 #${template.id}`;
        }

        const info = button.getChild("info") as fgui.GTextField;
        if (info) {
            info.text = `模板 ID: ${template.id}`;
        }

        // 设置选中状态
        button.selected = (index === this._selectedIndex);

        // 绑定数据和点击事件
        button.data = index;
        button.onClick(() => this._selectTemplate(index), this);
    }

    /**
     * 选择地图模板
     */
    private _selectTemplate(index: number): void {
        if (index < 0 || index >= this._templates.length) return;

        this._selectedIndex = index;
        const template = this._templates[index];
        this._selectedTemplateId = template.id;

        console.log(`[UIMapList] Selected template: ${template.name} (ID: ${template.id})`);

        // 刷新列表显示选中状态
        if (this.m_list) {
            this.m_list.refreshVirtualList();
        }
    }

    /**
     * 创建游戏按钮点击
     */
    private async _onCreateGameClick(): Promise<void> {
        console.log('[UIMapList] Create game clicked');

        if (this._selectedTemplateId === null) {
            UINotification.warning("请先选择地图模板");
            return;
        }

        // 检查钱包连接
        if (!SuiManager.instance.isConnected) {
            UINotification.warning("请先连接钱包");
            return;
        }

        try {
            UINotification.info("正在创建游戏...");

            const result = await SuiManager.instance.createGame({
                template_map_id: this._selectedTemplateId.toString(),
                max_players: 4,
                starting_cash: 0n,      // 使用默认值
                price_rise_days: 0,
                max_rounds: 0
            });

            console.log('[UIMapList] Game created successfully');
            console.log('  Game ID:', result.gameId);
            console.log('  Seat ID:', result.seatId);

            UINotification.success("游戏创建成功");

            // 发送游戏开始事件（进入等待室）
            EventBus.emit(EventTypes.Game.GameStart, {
                gameId: result.gameId,
                seatId: result.seatId,
                playerIndex: 0,  // 创建者是玩家 0
                isCreator: true
            });

        } catch (error) {
            console.error('[UIMapList] Failed to create game:', error);
            UINotification.error("创建游戏失败");
        }
    }
}
