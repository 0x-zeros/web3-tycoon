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
import { ProfileService } from "../../../sui/services/ProfileService";
import { UINotification } from "../../utils/UINotification";
import { UIMessage } from "../../utils/UIMessage";
import { EventBus } from "../../../events/EventBus";
import { EventTypes } from "../../../events/EventTypes";
import type { MapTemplatePublishedEvent } from "../../../sui/types/admin";
import { ListFilter, FilterConfig } from "../../filter/ListFilter";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';

/**
 * MapTemplate 列表过滤配置
 * 支持按 mapid 字段过滤
 */
const MAP_FILTER_CONFIG: FilterConfig<MapTemplatePublishedEvent> = {
    fields: [
        { name: 'mapid', extractor: (t) => t.template_id || '' }
    ],
    logic: 'AND'
};

const { ccclass } = _decorator;

@ccclass('UIMapList')
export class UIMapList extends UIBase {
    // 组件引用
    private m_list: fgui.GList;

    // 过滤器
    private _filter: ListFilter<MapTemplatePublishedEvent> = new ListFilter<MapTemplatePublishedEvent>(MAP_FILTER_CONFIG);

    // 数据
    private _templates: MapTemplatePublishedEvent[] = [];
    private _displayTemplates: MapTemplatePublishedEvent[] = [];  // 当前显示的数据（可能是过滤后的）
    private _selectedTemplateId: string | null = null;
    private _selectedIndex: number = -1;

    // 当前过滤条件（用于 refresh 时重新应用）
    private _currentFilter: { mapid: string } = { mapid: '' };

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
        // 获取列表
        this.m_list = this.getList("map_id");

        console.log('[UIMapList] Components setup');
        console.log('  m_list:', !!this.m_list);
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        // 监听地图模板发布事件（实时更新列表）
        EventBus.on(EventTypes.Move.MapTemplatePublished, this._onMapTemplatePublished, this);

        // 监听创建游戏参数确认事件
        EventBus.on(EventTypes.Game.CreateGameWithParams, this._onCreateGameWithParams, this);

        // 监听搜索过滤事件
        EventBus.on(EventTypes.Search.MapFilterChanged, this._onFilterChanged, this);
        EventBus.on(EventTypes.Search.FilterCleared, this._onFilterCleared, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        EventBus.off(EventTypes.Move.MapTemplatePublished, this._onMapTemplatePublished, this);
        EventBus.off(EventTypes.Game.CreateGameWithParams, this._onCreateGameWithParams, this);
        EventBus.off(EventTypes.Search.MapFilterChanged, this._onFilterChanged, this);
        EventBus.off(EventTypes.Search.FilterCleared, this._onFilterCleared, this);

        super.unbindEvents();
    }

    /**
     * 刷新数据
     */
    public refresh(): void {
        console.log('[UIMapList] Refreshing map template list');

        // 从 SuiManager 获取缓存的 MapTemplate 列表
        this._templates = SuiManager.instance.getCachedMapTemplates();
        this._filter.setData(this._templates);

        console.log(`[UIMapList] Loaded ${this._templates.length} templates`);

        // 重新应用当前过滤条件
        this._applyCurrentFilter();
    }

    /**
     * 应用当前过滤条件
     */
    private _applyCurrentFilter(): void {
        const { mapid } = this._currentFilter;

        if (mapid) {
            const searchValues = new Map<string, string>();
            searchValues.set('mapid', mapid);
            const filtered = this._filter.filter(searchValues);
            this._renderList(filtered);
        } else {
            this._renderList(this._templates);
        }
    }

    /**
     * 搜索过滤条件变化（由 UISearch 发送）
     */
    private _onFilterChanged(data: { mapid: string }): void {
        console.log('[UIMapList] Filter changed:', data);

        // 存储当前过滤条件
        this._currentFilter = { ...data };

        const searchValues = new Map<string, string>();
        searchValues.set('mapid', data.mapid);

        const filtered = this._filter.filter(searchValues);
        this._renderList(filtered);
    }

    /**
     * 搜索过滤条件清空（由 UISearch 发送）
     */
    private _onFilterCleared(data: { category: number }): void {
        // 只响应 Map 列表的清除（category=1）
        if (data.category !== 1) return;

        console.log('[UIMapList] Filter cleared');

        // 清空存储的过滤条件
        this._currentFilter = { mapid: '' };

        const all = this._filter.reset();
        this._renderList(all);
    }

    /**
     * 渲染列表（供过滤器调用）
     */
    private _renderList(data: MapTemplatePublishedEvent[]): void {
        this._displayTemplates = data;

        if (!this.m_list) return;

        // 设置数量并填充
        this.m_list.numItems = data.length;
        console.log('  List updated, numItems:', this.m_list.numItems);

        for (let i = 0; i < data.length; i++) {
            const item = this.m_list.getChildAt(i);
            if (!item) continue;
            this._renderItemWithTemplate(i, item, data[i]);
        }

        // 处理选中状态
        if (data.length > 0) {
            // 尝试保持之前的选中状态
            if (this._selectedTemplateId) {
                const index = data.findIndex(t => t.template_id === this._selectedTemplateId);
                if (index >= 0) {
                    this._selectTemplate(index);
                    return;
                }
            }
            // 选中第一个
            this._selectTemplate(0);
        } else {
            // 清空选中状态
            this._selectedIndex = -1;
            this._selectedTemplateId = null;
        }
    }

    /**
     * 渲染列表项
     */
    private _renderItemWithTemplate(index: number, item: fgui.GObject, template: MapTemplatePublishedEvent): void {
        if (!template) return;  // 安全检查

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
        if (index < 0 || index >= this._displayTemplates.length) return;

        this._selectedIndex = index;
        const template = this._displayTemplates[index];
        this._selectedTemplateId = template.template_id;

        console.log(`[UIMapList] Selected template ID: ${template.template_id}`);

        // 刷新列表显示选中状态
        if (this.m_list) {
            this.m_list.selectedIndex = index;
        }
    }

    /**
     * 根据模板 ID 选中（用于发布后返回）
     */
    public selectTemplateById(templateId: string): void {
        console.log('[UIMapList] selectTemplateById:', templateId);

        // 查找模板索引
        const index = this._displayTemplates.findIndex(t => t.template_id === templateId);

        if (index >= 0) {
            console.log('  Found template at index:', index);
            this._selectTemplate(index);

            // 滚动到该项
            if (this.m_list && this.m_list.scrollToView) {
                this.m_list.scrollToView(index);
            }
        } else {
            console.warn('  Template not found in current list');
            console.log('  Current templates:', this._displayTemplates.map(t => t.template_id));
        }
    }

    /**
     * 列表项点击（统一处理）
     * 点击后直接打开 GameCreateParams 面板
     */
    private _onItemClick(evt: fgui.Event): void {
        const btn = evt.sender as fgui.GButton;
        const index = (btn?.data as number) ?? -1;
        if (index >= 0 && index < this._displayTemplates.length) {
            this._selectTemplate(index);
            this._showGameCreateParams();
        }
    }

    /**
     * 显示游戏创建参数面板
     */
    private _showGameCreateParams(): void {
        if (!this._selectedTemplateId) return;
        EventBus.emit(EventTypes.Game.ShowGameCreateParams, {
            mapTemplateId: this._selectedTemplateId
        });
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
        settings?: number;  // 位字段
        name?: string;  // 游戏名称（可选）
    }): Promise<void> {
        console.log('[UIMapList] CreateGameWithParams event received');
        console.log('  Parameters:', {
            ...data,
            startingCash: data.startingCash.toString(),  // BigInt需要转为string才能log
            settings: data.settings,
            name: data.name
        });

        try {
            // 调用SuiManager创建游戏，传入用户配置的参数
            const result = await SuiManager.instance.createGameWithTemplate(
                data.templateMapId,
                {
                    startingCash: data.startingCash,
                    priceRiseDays: data.priceRiseDays,
                    maxRounds: data.maxRounds,
                    settings: data.settings
                }
            );

            console.log('[UIMapList] 游戏创建成功:', result);

            // 如果提供了游戏名称，创建 GameProfile（可选，失败不影响游戏创建）
            if (data.name && data.name.length > 0) {
                try {
                    await ProfileService.instance.createGameProfile(result.gameId, data.name);
                    console.log('[UIMapList] GameProfile 创建成功');
                } catch (profileError) {
                    console.warn('[UIMapList] GameProfile 创建失败（不影响游戏）:', profileError);
                    // 不抛出错误，游戏已创建成功
                }
            }

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
