/**
 * 本地地图资源列表子模块
 * 负责显示和管理本地的地图资源（map.json）
 *
 * 功能：
 * - 显示本地地图列表
 * - 选择地图
 * - 编辑地图
 */

import { UIBase } from "../../core/UIBase";
import { MapConfig, mapManager } from "../../../map/MapManager";
import { UINotification } from "../../utils/UINotification";
import { EventBus } from "../../../events/EventBus";
import { EventTypes } from "../../../events/EventTypes";
import { Blackboard } from "../../../events/Blackboard";
import * as fgui from "fairygui-cc";
import { _decorator, Rect, resources, Size, SpriteFrame, Texture2D } from 'cc';

const { ccclass } = _decorator;

@ccclass('UIMapAssetList')
export class UIMapAssetList extends UIBase {
    // 组件引用
    private m_list: fgui.GList;
    private m_btn_editMap: fgui.GButton;
    private m_btn_loadFromLocalStorage: fgui.GButton | null = null;

    // 数据
    private _maps: MapConfig[] = [];
    private _selectedMapId: string | null = null;
    private _selectedMapConfig: MapConfig | null = null;
    private _selectedIndex: number = -1;

    /**
     * 初始化回调
     */
    protected onInit(): void {
        this._setupComponents();
        this._loadMapData();
    }

    /**
     * 设置组件引用
     */
    private _setupComponents(): void {
        // 从父组件（data）中获取按钮
        const dataComp = this._panel?.parent as fgui.GComponent;
        if (dataComp) {
            this.m_btn_editMap = dataComp.getChild('btn_editMap') as fgui.GButton;
        }

        // 获取列表
        this.m_list = this.getList("list");

        // 获取复选框（可能在 data 或 panel 中）
        this.m_btn_loadFromLocalStorage = this.getButton("btn_loadFromLocalStorage") ||
                                           dataComp?.getChild('btn_loadFromLocalStorage') as fgui.GButton;

        // 设置列表渲染器
        if (this.m_list) {
            this.m_list.itemRenderer = this._renderItem.bind(this);
        }

        console.log('[UIMapAssetList] Components setup');
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        this.m_btn_editMap?.onClick(this._onEditMapClick, this);

        // 监听地图配置更新
        EventBus.on(EventTypes.Game.MapConfigUpdated, this._onMapConfigUpdated, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        this.m_btn_editMap?.offClick(this._onEditMapClick, this);
        super.unbindEvents();
    }

    /**
     * 刷新数据
     */
    public refresh(): void {
        this._loadMapData();
    }

    /**
     * 加载地图数据
     */
    private _loadMapData(): void {
        console.log('[UIMapAssetList] Loading local map data');

        if (!mapManager.instance) {
            console.error('[UIMapAssetList] MapManager not available');
            return;
        }

        // 获取所有可用地图
        this._maps = mapManager.instance.getAvailableMaps();

        console.log(`[UIMapAssetList] Loaded ${this._maps.length} local maps`);

        // 更新列表
        if (this.m_list) {
            this.m_list.numItems = this._maps.length;

            // 默认选择第一个
            if (this._maps.length > 0) {
                this._selectMap(0);
            }
        }
    }

    /**
     * 渲染列表项
     */
    private _renderItem(index: number, item: fgui.GObject): void {
        if (index >= this._maps.length) return;

        const mapConfig = this._maps[index];
        const button = item.asCom as fgui.GButton;

        // 设置地图信息
        const nameText = button.getChild("mapName") as fgui.GTextField;
        if (nameText) {
            nameText.text = mapConfig.name;
        }

        const typeText = button.getChild("mapType") as fgui.GTextField;
        if (typeText) {
            typeText.text = this._getMapTypeText(mapConfig.type);
        }

        // 设置预览图
        const previewImage = button.getChild("mapPreview") as fgui.GLoader;
        if (previewImage && mapConfig.previewImagePath) {
            this._loadMapPreviewImage(mapConfig, previewImage);
        }

        // 设置选中状态
        button.selected = (index === this._selectedIndex);

        // 绑定数据和点击事件
        button.data = index;
        button.onClick(() => this._selectMap(index), this);
    }

    /**
     * 获取地图类型显示文本
     */
    private _getMapTypeText(type: string): string {
        switch (type) {
            case 'classic': return '经典模式';
            case 'brawl': return '乱斗模式';
            default: return '未知';
        }
    }

    /**
     * 选择地图
     */
    private _selectMap(index: number): void {
        if (index < 0 || index >= this._maps.length) return;

        this._selectedIndex = index;
        const mapConfig = this._maps[index];
        this._selectedMapId = mapConfig.id;
        this._selectedMapConfig = mapConfig;

        console.log(`[UIMapAssetList] Selected map: ${mapConfig.name}`);

        // 刷新列表显示选中状态
        if (this.m_list) {
            this.m_list.refreshVirtualList();
        }
    }

    /**
     * 加载地图预览图片
     */
    private _loadMapPreviewImage(mapConfig: MapConfig, previewImage: fgui.GLoader): void {
        if (!previewImage || !mapConfig.previewImagePath) {
            return;
        }

        const texturePath = mapConfig.previewImagePath + '/texture';
        console.log(`[UIMapAssetList] Loading preview: ${texturePath}`);

        resources.load(texturePath, Texture2D, (err, texture) => {
            if (!err && texture) {
                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;
                spriteFrame.originalSize = new Size(texture.width, texture.height);
                spriteFrame.rect = new Rect(0, 0, texture.width, texture.height);
                previewImage.texture = spriteFrame;
            } else {
                console.warn(`[UIMapAssetList] Failed to load preview:`, err);
                previewImage.url = mapConfig.previewImagePath;
            }
        });
    }

    /**
     * 编辑地图按钮点击
     */
    private _onEditMapClick(): void {
        console.log('[UIMapAssetList] Edit map clicked');

        if (!this._selectedMapId || !this._selectedMapConfig) {
            UINotification.warning("请先选择地图");
            return;
        }

        // 读取复选框状态
        const loadFromLocalStorage = this.m_btn_loadFromLocalStorage?.selected ?? false;

        console.log(`[UIMapAssetList] Editing map: ${this._selectedMapConfig.name}`);
        console.log('  Load from localStorage:', loadFromLocalStorage);

        // 保存选择的地图信息
        Blackboard.instance.set("selectedMapId", this._selectedMapId, true);
        Blackboard.instance.set("selectedMapConfig", this._selectedMapConfig, true);
        Blackboard.instance.set("loadFromLocalStorage", loadFromLocalStorage, true);

        // 发送地图选择事件（编辑模式）
        EventBus.emit(EventTypes.Game.MapSelected, {
            mapId: this._selectedMapId,
            isEdit: true,
            mapConfig: this._selectedMapConfig,
            loadFromLocalStorage: loadFromLocalStorage,
            source: "map_asset_list"
        });
    }

    /**
     * 地图配置更新事件
     */
    private _onMapConfigUpdated(): void {
        console.log('[UIMapAssetList] Map config updated, refreshing');
        this._loadMapData();
    }
}
