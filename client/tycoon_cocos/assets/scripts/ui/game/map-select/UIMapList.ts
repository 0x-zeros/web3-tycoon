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
import { UIMessage } from "../../utils/UIMessage";
import { EventBus } from "../../../events/EventBus";
import { EventTypes } from "../../../events/EventTypes";
import type { MapTemplatePublishedEvent } from "../../../sui/types/admin";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';

const { ccclass } = _decorator;

@ccclass('UIMapList')
export class UIMapList extends UIBase {
    // 组件引用
    private m_list: fgui.GList;
    private m_btn_createGame: fgui.GButton;

    // 数据
    private _templates: MapTemplatePublishedEvent[] = [];
    private _selectedTemplateId: string | null = null;
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
        this.m_btn_createGame = this.getButton('btn_createGame');

        // 获取列表
        this.m_list = this.getList("map_id");

        console.log('[UIMapList] Components setup');
        console.log('  m_btn_createGame:', !!this.m_btn_createGame);
        console.log('  m_list:', !!this.m_list);
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        this.m_btn_createGame?.onClick(this._onCreateGameClick, this);

        // 监听地图模板发布事件（实时更新列表）
        EventBus.on(EventTypes.Move.MapTemplatePublished, this._onMapTemplatePublished, this);

        // 监听创建游戏参数确认事件
        EventBus.on(EventTypes.Game.CreateGameWithParams, this._onCreateGameWithParams, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        this.m_btn_createGame?.offClick(this._onCreateGameClick, this);
        EventBus.off(EventTypes.Move.MapTemplatePublished, this._onMapTemplatePublished, this);
        EventBus.off(EventTypes.Game.CreateGameWithParams, this._onCreateGameWithParams, this);
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
        if (!template) return;  // ✅ 安全检查

        const button = item.asCom as fgui.GButton;

        // 显示索引（从 1 开始）
        const indexText = button.getChild("index") as fgui.GTextField;
        if (indexText) {
            indexText.text = (index + 1).toString();
        }

        // 根据 FairyGUI 的实际组件名称设置
        const mapidText = button.getChild("mapid") as fgui.GTextField;
        if (mapidText) {
            mapidText.text = template.template_id || 'N/A';  // ✅ 添加 fallback
        }

        const tileText = button.getChild("tile") as fgui.GTextField;
        if (tileText) {
            tileText.text = (template.tile_count ?? 0).toString();  // ✅ 添加 ?? 0
        }

        const buildingText = button.getChild("building") as fgui.GTextField;
        if (buildingText) {
            buildingText.text = (template.building_count ?? 0).toString();  // ✅ 添加 ?? 0
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
        this._selectedTemplateId = template.template_id;

        console.log(`[UIMapList] Selected template ID: ${template.template_id}`);

        // 刷新列表显示选中状态
        if (this.m_list) {
            this.m_list.selectedIndex = index;
        }
    }

    /**
     * 创建游戏按钮点击
     */
    private _onCreateGameClick(): void {
        console.log('[UIMapList] Create game clicked');

        if (this._selectedTemplateId === null) {
            UINotification.warning("请先选择地图模板");
            return;
        }

        // 发送事件，让UIMapSelect显示参数配置界面
        EventBus.emit(EventTypes.Game.ShowGameCreateParams, {
            mapTemplateId: this._selectedTemplateId
        });
    }

    /**
     * 根据模板 ID 选中（用于发布后返回）
     */
    public selectTemplateById(templateId: string): void {
        console.log('[UIMapList] selectTemplateById:', templateId);

        // 查找模板索引
        const index = this._templates.findIndex(t => t.template_id === templateId);

        if (index >= 0) {
            console.log('  Found template at index:', index);
            this._selectTemplate(index);

            // 滚动到该项
            if (this.m_list && this.m_list.scrollToView) {
                this.m_list.scrollToView(index);
            }
        } else {
            console.warn('  Template not found in current list');
            console.log('  Current templates:', this._templates.map(t => t.id));
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

    /**
     * 地图模板发布事件（实时更新列表）
     */
    private _onMapTemplatePublished(eventData: any): void {
        console.log('[UIMapList] MapTemplatePublished event received');
        console.log('  Template ID:', eventData.template_id);
        this.refresh();  // 刷新列表
    }

    /**
     * 使用参数创建游戏（由UIGameCreateParams触发）
     */
    private async _onCreateGameWithParams(data: {
        templateMapId: string;
        startingCash: bigint;
        priceRiseDays: number;
        maxRounds: number;
    }): Promise<void> {
        console.log('[UIMapList] CreateGameWithParams event received');
        console.log('  Parameters:', {
            ...data,
            startingCash: data.startingCash.toString()  // BigInt需要转为string才能log
        });

        try {
            // 调用SuiManager创建游戏，传入用户配置的参数
            const result = await SuiManager.instance.createGameWithTemplate(
                data.templateMapId,
                {
                    startingCash: data.startingCash,
                    priceRiseDays: data.priceRiseDays,
                    maxRounds: data.maxRounds
                }
            );

            console.log('[UIMapList] 游戏创建成功:', result);

            // 显示成功消息
            UIMessage.success(
                `游戏创建成功！\n游戏ID: ${result.gameId}\n座位ID: ${result.seatId}`,
                '成功'
            );

            // 等待EventIndexer收到GameCreatedEvent后，会自动显示GameDetail
        } catch (error) {
            console.error('[UIMapList] 创建游戏失败:', error);
            UIMessage.error(
                `创建游戏失败: ${error.message}`,
                '错误'
            );
        }
    }
}
