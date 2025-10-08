import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { UIGameList } from "./map-select/UIGameList";
import { UIMapList } from "./map-select/UIMapList";
import { UIMapAssetList } from "./map-select/UIMapAssetList";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';

const { ccclass } = _decorator;

/**
 * 地图选择界面（重构版）
 * 主容器，管理 3 个子模块：
 * - UIGameList: 链上 Game 列表
 * - UIMapList: 链上 MapTemplate 列表
 * - UIMapAssetList: 本地地图资源
 */
@ccclass('UIMapSelect')
export class UIMapSelect extends UIBase {
    // Map 组件容器（data）
    private m_dataComponent: fgui.GComponent;

    // Controller（在 data 组件中）
    private m_categoryController: fgui.Controller;

    // 子模块
    private m_gameListUI: UIGameList;
    private m_mapListUI: UIMapList;
    private m_mapAssetListUI: UIMapAssetList;

    /**
     * 初始化回调
     */
    protected onInit(): void {
        this._setupComponents();
        this._initSubModules();
    }

    /**
     * 设置组件引用
     */
    private _setupComponents(): void {
        // 获取 data 组件（Map 类型）
        this.m_dataComponent = this.getChild('data').asCom;

        if (!this.m_dataComponent) {
            console.error('[UIMapSelect] data component not found');
            return;
        }

        // 获取 controller（在 data 组件中）
        this.m_categoryController = this.m_dataComponent.getController('category');

        if (!this.m_categoryController) {
            console.error('[UIMapSelect] category controller not found');
        }

        console.log('[UIMapSelect] Components setup');
    }

    /**
     * 初始化子模块
     */
    private _initSubModules(): void {
        // 3个子模块都挂载在data组件上
        // 子模块 1: UIGameList（链上 Game 列表）
        // const gameIdComp = this.m_dataComponent.getChild('game_id').asCom;
        this.m_gameListUI = this.m_dataComponent.node.addComponent(UIGameList);
        this.m_gameListUI.setUIName("GameList");
        this.m_gameListUI.setPanel(this.m_dataComponent);
        // 触发一次 onEnable，确保子模块完成事件绑定
        this.m_gameListUI.enabled = false;
        this.m_gameListUI.enabled = true;

        // 子模块 2: UIMapList（链上 MapTemplate 列表）
        // const mapIdComp = this.m_dataComponent.getChild('map_id').asCom;
        this.m_mapListUI = this.m_dataComponent.node.addComponent(UIMapList);
        this.m_mapListUI.setUIName("MapList");
        this.m_mapListUI.setPanel(this.m_dataComponent);
        this.m_mapListUI.enabled = false;
        this.m_mapListUI.enabled = true;

        // 子模块 3: UIMapAssetList（本地地图资源）
        // const mapJsonComp = this.m_dataComponent.getChild('map_json').asCom;
        this.m_mapAssetListUI = this.m_dataComponent.node.addComponent(UIMapAssetList);
        this.m_mapAssetListUI.setUIName("MapAssetList");
        this.m_mapAssetListUI.setPanel(this.m_dataComponent);
        this.m_mapAssetListUI.enabled = false;
        this.m_mapAssetListUI.enabled = true;

        console.log('[UIMapSelect] Sub-modules initialized');
    }

    /**
     * 绑定事件（主容器无需绑定，由子模块处理）
     */
    protected bindEvents(): void {
        // 子模块会处理各自的事件
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        super.unbindEvents();
    }

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        console.log("[UIMapSelect] Showing");

        // 播放背景音乐
        EventBus.emit(EventTypes.Audio.PlayBGM, {
            musicPath: "audio/bgm/map_select",
            loop: true
        });

        // 默认显示第一个页面（Game 列表）
        if (this.m_categoryController) {
            this.m_categoryController.selectedIndex = 0;
        }

        // 刷新所有子模块数据
        this.m_gameListUI?.refresh();
        this.m_mapListUI?.refresh();
        this.m_mapAssetListUI?.refresh();

        // 播放显示动画
        this._playShowAnimation();
    }

    /**
     * 隐藏回调
     */
    protected onHide(): void {
        console.log("[UIMapSelect] Hiding");

        // 停止背景音乐
        EventBus.emit(EventTypes.Audio.StopBGM);
    }

    /**
     * 切换分类
     * @param index 0=game_id, 1=map_id, 2=map_json
     */
    public switchCategory(index: number): void {
        if (this.m_categoryController) {
            this.m_categoryController.selectedIndex = index;
            console.log(`[UIMapSelect] Switched to category: ${index}`);
        }
    }

    /**
     * 播放显示动画
     */
    private _playShowAnimation(): void {
        const showTransition = this.getTransition("showAnim");
        if (showTransition) {
            showTransition.play();
        }
    }
}
