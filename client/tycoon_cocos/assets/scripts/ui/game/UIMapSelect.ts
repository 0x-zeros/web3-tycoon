import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { Blackboard } from "../../events/Blackboard";
import { MapConfig, mapManager } from "../../map/MapManager";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';

const { ccclass } = _decorator;

/**
 * 地图选择界面 - 玩家选择游戏地图
 */
@ccclass('UIMapSelect')
export class UIMapSelect extends UIBase {
    /** 地图列表容器 */
    private _mapList: fgui.GList | null = null;
    /** 地图预览图片 */
    private _previewImage: fgui.GLoader | null = null;
    /** 地图名称文本 */
    private _mapNameText: fgui.GTextField | null = null;
    /** 地图描述文本 */
    private _mapDescText: fgui.GTextField | null = null;
    /** 玩家数量文本 */
    private _playerCountText: fgui.GTextField | null = null;
    /** 开始游戏按钮 */
    private _startButton: fgui.GButton | null = null;
    /** 返回按钮 */
    private _backButton: fgui.GButton | null = null;
    /** 刷新按钮 */
    private _refreshButton: fgui.GButton | null = null;

    // 当前选中的地图
    private _selectedMapId: string | null = null;
    private _selectedMapConfig: MapConfig | null = null;

    // 地图配置数据
    private _availableMaps: MapConfig[] = [];

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
        // 获取地图列表
        this._mapList = this.getList("mapList");
        
        // 获取预览区域组件
        this._previewImage = this.getLoader("previewImage");
        this._mapNameText = this.getText("mapName");
        this._mapDescText = this.getText("mapDescription");
        this._playerCountText = this.getText("playerCount");
        
        // 获取按钮
        this._startButton = this.getButton("btnStart");
        this._backButton = this.getButton("btnBack");
        this._refreshButton = this.getButton("btnRefresh");

        // 设置列表渲染器
        if (this._mapList) {
            this._mapList.itemRenderer = this._renderMapItem.bind(this);
        }
    }

    /**
     * 加载地图数据
     */
    private _loadMapData(): void {
        if (!mapManager.instance) {
            console.error('[UIMapSelect] MapManager not available');
            return;
        }

        // 获取已解锁的地图
        this._availableMaps = mapManager.instance.getUnlockedMaps();
        
        // 更新列表数据
        if (this._mapList && this._availableMaps.length > 0) {
            this._mapList.numItems = this._availableMaps.length;
            
            // 默认选择第一个地图
            this._selectMap(0);
        }

        console.log(`[UIMapSelect] 已加载 ${this._availableMaps.length} 个可用地图`);
    }

    /**
     * 渲染地图列表项
     */
    private _renderMapItem(index: number, item: fgui.GObject): void {
        if (index >= this._availableMaps.length) return;

        const mapConfig = this._availableMaps[index];
        
        // 获取列表项组件
        const nameText = item.getChild("mapName")?.asTextField;
        const typeText = item.getChild("mapType")?.asTextField;
        const statusIcon = item.getChild("statusIcon")?.asLoader;
        const lockIcon = item.getChild("lockIcon")?.asLoader;

        // 设置地图信息
        if (nameText) nameText.text = mapConfig.name;
        if (typeText) typeText.text = this._getMapTypeText(mapConfig.type);
        
        // 设置状态图标
        if (statusIcon) {
            statusIcon.url = mapConfig.unlocked ? "ui://Common/icon_unlocked" : "ui://Common/icon_locked";
        }
        
        if (lockIcon) {
            lockIcon.visible = !mapConfig.unlocked;
        }

        // 设置选择状态
        const bgButton = item.getChild("background")?.asButton;
        if (bgButton) {
            bgButton.selected = (this._selectedMapId === mapConfig.id);
        }
    }

    /**
     * 获取地图类型显示文本
     */
    private _getMapTypeText(type: string): string {
        switch (type) {
            case 'standard': return '标准地图';
            case 'custom': return '自定义';
            case 'special': return '特殊地图';
            default: return '未知';
        }
    }

    /**
     * 选择地图
     */
    private _selectMap(index: number): void {
        if (index < 0 || index >= this._availableMaps.length) return;

        const mapConfig = this._availableMaps[index];
        this._selectedMapId = mapConfig.id;
        this._selectedMapConfig = mapConfig;

        // 更新预览信息
        this._updateMapPreview(mapConfig);

        // 更新列表选择状态
        if (this._mapList) {
            this._mapList.refreshVirtualList();
        }

        console.log(`[UIMapSelect] 选择了地图: ${mapConfig.name}`);
    }

    /**
     * 更新地图预览信息
     */
    private _updateMapPreview(mapConfig: MapConfig): void {
        // 设置预览图
        if (this._previewImage && mapConfig.previewImagePath) {
            this._previewImage.url = mapConfig.previewImagePath;
        }

        // 设置地图信息
        if (this._mapNameText) {
            this._mapNameText.text = mapConfig.name;
        }

        if (this._mapDescText) {
            this._mapDescText.text = mapConfig.description;
        }

        if (this._playerCountText) {
            this._playerCountText.text = `${mapConfig.playerCount.min}-${mapConfig.playerCount.max} 人`;
        }

        // 设置开始按钮状态
        if (this._startButton) {
            this._startButton.enabled = mapConfig.unlocked;
            this._startButton.grayed = !mapConfig.unlocked;
        }
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        // 绑定按钮事件
        this._startButton?.onClick(this._onStartClick, this);
        this._backButton?.onClick(this._onBackClick, this);
        this._refreshButton?.onClick(this._onRefreshClick, this);

        // 绑定列表选择事件
        if (this._mapList) {
            this._mapList.on(fgui.Event.CLICK_ITEM, this._onMapItemClick, this);
        }

        // 监听地图配置更新事件
        EventBus.onEvent(EventTypes.Game.MapConfigUpdated, this._onMapConfigUpdated, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        // 解绑按钮事件
        this._startButton?.offClick(this._onStartClick, this);
        this._backButton?.offClick(this._onBackClick, this);
        this._refreshButton?.offClick(this._onRefreshClick, this);

        // 解绑列表事件
        if (this._mapList) {
            this._mapList.off(fgui.Event.CLICK_ITEM, this._onMapItemClick, this);
        }

        // 解绑全局事件
        EventBus.offEvent(EventTypes.Game.MapConfigUpdated, this._onMapConfigUpdated, this);

        // 调用父类解绑
        super.unbindEvents();
    }

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        console.log("[UIMapSelect] Showing map select UI");
        
        // 播放背景音乐
        EventBus.emitEvent(EventTypes.Audio.PlayBGM, {
            musicPath: "audio/bgm/map_select",
            loop: true
        });

        // 刷新地图数据
        this._loadMapData();

        // 播放显示动画
        this._playShowAnimation();
    }

    /**
     * 隐藏回调
     */
    protected onHide(): void {
        console.log("[UIMapSelect] Hiding map select UI");
        
        // 停止背景音乐
        EventBus.emitEvent(EventTypes.Audio.StopBGM);
    }

    /**
     * 刷新回调
     */
    protected onRefresh(data?: any): void {
        this._loadMapData();
    }

    // ================== 事件处理器 ==================

    /**
     * 开始游戏按钮点击
     */
    private _onStartClick(): void {
        if (!this._selectedMapId || !this._selectedMapConfig) {
            console.warn('[UIMapSelect] No map selected');
            return;
        }

        if (!this._selectedMapConfig.unlocked) {
            console.warn('[UIMapSelect] Selected map is locked');
            // 这里可以显示解锁提示
            return;
        }

        console.log(`[UIMapSelect] 开始游戏，地图: ${this._selectedMapConfig.name}`);

        // 保存选择的地图信息
        Blackboard.instance.set("selectedMapId", this._selectedMapId, true);
        Blackboard.instance.set("selectedMapConfig", this._selectedMapConfig, true);

        // 发送地图选择事件
        EventBus.emitEvent(EventTypes.Game.MapSelected, {
            mapId: this._selectedMapId,
            mapConfig: this._selectedMapConfig,
            source: "map_select"
        });

        // 隐藏当前界面
        this.hide();
    }

    /**
     * 返回按钮点击
     */
    private _onBackClick(): void {
        console.log("[UIMapSelect] Back to mode select");

        // 发送返回模式选择事件
        EventBus.emitEvent(EventTypes.UI.ShowModeSelect, {
            source: "map_select_back"
        });

        this.hide();
    }

    /**
     * 刷新按钮点击
     */
    private _onRefreshClick(): void {
        console.log("[UIMapSelect] Refreshing map list");
        this._loadMapData();
    }

    /**
     * 地图列表项点击
     */
    private _onMapItemClick(evt: fgui.Event): void {
        const index = evt.data as number;
        this._selectMap(index);
    }

    /**
     * 地图配置更新事件
     */
    private _onMapConfigUpdated(): void {
        console.log("[UIMapSelect] Map config updated, refreshing");
        this._loadMapData();
    }

    // ================== 私有方法 ==================

    /**
     * 播放显示动画
     */
    private _playShowAnimation(): void {
        // 可以使用FairyGUI的Transition播放动画
        const showTransition = this.getTransition("showAnim");
        if (showTransition) {
            showTransition.play();
        }

        console.log("[UIMapSelect] Playing show animation");
    }
}