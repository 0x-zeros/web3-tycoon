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
        this.m_list = this.getList("map_id");

        // 使用非虚拟列表的填充方式：numItems + getChildAt(i)
        // 与项目中其它列表保持一致，避免依赖 setVirtual/itemRenderer

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
            // 设置数量并填充
            this.m_list.numItems = this._templates.length;

            console.log('  List updated, numItems:', this.m_list.numItems);

            for (let i = 0; i < this._templates.length; i++) {
                const item = this.m_list.getChildAt(i);
                if (!item) continue;
                this._renderItem(i, item);
            }

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

        // 根据 FairyGUI 的实际组件名称设置
        const mapidText = button.getChild("mapid") as fgui.GTextField;
        if (mapidText) {
            mapidText.text = template.id.toString();
        }

        const tileText = button.getChild("tile") as fgui.GTextField;
        if (tileText) {
            // TODO: 需要完整的 MapTemplate 对象才能获取 tiles_static.size
            // 当前缓存只有 {id, name}，暂时显示 N/A
            tileText.text = 'N/A';
        }

        const buildingText = button.getChild("building") as fgui.GTextField;
        if (buildingText) {
            // TODO: 需要完整的 MapTemplate 对象才能获取 buildings_static.size
            buildingText.text = 'N/A';
        }

        // 设置选中状态
        button.selected = (index === this._selectedIndex);

        // 绑定数据和点击事件（先清理旧的监听，再绑定统一的处理函数）
        button.data = index;
        button.offClick(this._onItemClick, this);
        button.onClick(this._onItemClick, this);
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
            this.m_list.selectedIndex = index;
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

    /**
     * 列表项点击（统一处理）
     */
    private _onItemClick(evt: fgui.Event): void {
        const btn = evt.sender as fgui.GButton;
        const index = (btn?.data as number) ?? -1;
        if (index >= 0) {
            this._selectTemplate(index);
        }
    }
}
