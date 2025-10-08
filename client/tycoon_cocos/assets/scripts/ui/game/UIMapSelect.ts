import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { UIGameList } from "./map-select/UIGameList";
import { UIMapList } from "./map-select/UIMapList";
import { UIMapAssetList } from "./map-select/UIMapAssetList";
import { UIGameDetail } from "./map-select/UIGameDetail";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';
import { SuiManager } from "../../sui/managers/SuiManager";

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

    // GameDetail 组件容器
    private m_gameDetailComponent: fgui.GComponent;

    // Controller（在 data 组件中）
    private m_categoryController: fgui.Controller;

    // 子模块
    private m_gameListUI: UIGameList;
    private m_mapListUI: UIMapList;
    private m_mapAssetListUI: UIMapAssetList;
    private m_gameDetailUI: UIGameDetail;

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

        // 获取 gameDetail 组件
        this.m_gameDetailComponent = this.getChild('gameDetail').asCom;

        if (!this.m_gameDetailComponent) {
            console.error('[UIMapSelect] gameDetail component not found');
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
        this.m_gameListUI = this.m_dataComponent.node.addComponent(UIGameList);
        this.m_gameListUI.setUIName("GameList");
        this.m_gameListUI.setPanel(this.m_dataComponent);

        // 子模块 2: UIMapList（链上 MapTemplate 列表）
        this.m_mapListUI = this.m_dataComponent.node.addComponent(UIMapList);
        this.m_mapListUI.setUIName("MapList");
        this.m_mapListUI.setPanel(this.m_dataComponent);

        // 子模块 3: UIMapAssetList（本地地图资源）
        this.m_mapAssetListUI = this.m_dataComponent.node.addComponent(UIMapAssetList);
        this.m_mapAssetListUI.setUIName("MapAssetList");
        this.m_mapAssetListUI.setPanel(this.m_dataComponent);

        // 子模块 4: UIGameDetail（游戏详情）
        this.m_gameDetailUI = this.m_gameDetailComponent.node.addComponent(UIGameDetail);
        this.m_gameDetailUI.setUIName("GameDetail");
        this.m_gameDetailUI.setPanel(this.m_gameDetailComponent);
        this.m_gameDetailUI.setParentUI(this);

        console.log('[UIMapSelect] Sub-modules initialized');
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        // 监听地图选择事件（编辑地图）
        EventBus.on(EventTypes.Game.MapSelected, this._onMapSelected, this);

        // 监听游戏开始事件（开始游戏）
        EventBus.on(EventTypes.Game.GameStart, this._onGameStart, this);

        // 监听 Move 链上游戏创建事件（由 EventIndexer 转发）
        EventBus.on(EventTypes.Move.GameCreated, this._onMoveGameCreated, this);

        // 监听显示游戏详情事件（由 UIGameList 触发）
        EventBus.on(EventTypes.Game.ShowGameDetail, this._onShowGameDetail, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        EventBus.off(EventTypes.Game.MapSelected, this._onMapSelected, this);
        EventBus.off(EventTypes.Game.GameStart, this._onGameStart, this);
        EventBus.off(EventTypes.Move.GameCreated, this._onMoveGameCreated, this);
        EventBus.off(EventTypes.Game.ShowGameDetail, this._onShowGameDetail, this);
        super.unbindEvents();
    }

    /**
     * 地图选择事件（编辑地图）
     */
    private _onMapSelected(data: any): void {
        console.log('[UIMapSelect] MapSelected event received');
        console.log('  Source:', data.source);
        console.log('  Hiding UIMapSelect');
        this.hide();
    }

    /**
     * 游戏开始事件（开始游戏）
     */
    private _onGameStart(data: any): void {
        console.log('[UIMapSelect] GameStart event received');
        console.log('  Hiding UIMapSelect');
        this.hide();
    }

    /**
     * 处理 Move 链上游戏创建事件
     * 事件数据：{ game, creator, template_map_id, max_players }
     */
    private _onMoveGameCreated(eventData: any): void {
        console.log('[UIMapSelect] Move.GameCreated event received');
        console.log('  Game:', eventData.game);
        console.log('  Creator:', eventData.creator);

        // 1. 刷新 game list（数据已由 SuiManager 更新缓存）
        console.log('[UIMapSelect] Refreshing game list');
        this.m_gameListUI?.refresh();

        // 2. 判断是否是自己创建的
        const currentAddress = SuiManager.instance.currentAddress;
        const isMyGame = eventData.creator === currentAddress;

        console.log('  Is my game:', isMyGame);
        console.log('  Current address:', currentAddress);

        // 3. 只有是自己创建的才显示详情
        if (isMyGame) {
            console.log('[UIMapSelect] My game created, querying details...');

            // 查询游戏详情并缓存
            SuiManager.instance.getGameState(eventData.game).then(game => {
                if (game) {
                    // 缓存游戏
                    (SuiManager.instance as any)._currentGame = game;
                    console.log('[UIMapSelect] Game cached, showing detail');

                    // ✅ 显示 GameDetail（使用统一方法）
                    this.showGameDetail(eventData.game);
                }
            }).catch(error => {
                console.error('[UIMapSelect] Failed to query game:', error);
            });
        }
    }

    /**
     * 显示游戏详情事件处理（由 UIGameList 触发）
     */
    private _onShowGameDetail(data: any): void {
        this.showGameDetail(data.gameId);
    }

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        console.log("[UIMapSelect] Showing");
        console.log("  Data:", data);

        // 播放背景音乐
        EventBus.emit(EventTypes.Audio.PlayBGM, {
            musicPath: "audio/bgm/map_select",
            loop: true
        });

        // 确保初始状态：显示 data，隐藏 gameDetail
        if (this.m_dataComponent) {
            this.m_dataComponent.visible = true;
        }
        if (this.m_gameDetailComponent) {
            this.m_gameDetailComponent.visible = false;
        }

        // 根据参数切换 category（默认 0 = Game 列表）
        const category = data?.category ?? 0;
        if (this.m_categoryController) {
            this.m_categoryController.selectedIndex = category;
            console.log('  Category set to:', category);
        }

        // 刷新所有子模块数据
        this.m_gameListUI?.refresh();
        this.m_mapListUI?.refresh();
        this.m_mapAssetListUI?.refresh();

        // 如果指定了要选中的模板 ID
        if (data?.selectTemplateId !== undefined) {
            console.log('  Will select template:', data.selectTemplateId);
            // 延迟一帧执行，确保列表已刷新
            setTimeout(() => {
                this.m_mapListUI?.selectTemplateById(data.selectTemplateId);
            }, 100);
        }

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
     * 显示主界面（从 gameDetail 返回）
     */
    public showMainPanel(): void {
        console.log('[UIMapSelect] Showing main panel');

        // 只隐藏游戏详情
        if (this.m_gameDetailComponent) {
            this.m_gameDetailComponent.visible = false;
        }

        // data 始终保持可见，不需要额外设置
    }

    /**
     * 显示游戏详情
     * @param gameId 游戏 ID
     */
    public showGameDetail(gameId: string): void {
        console.log('[UIMapSelect] Showing game detail:', gameId);

        // 1. 保持 data 可见（不隐藏）
        if (this.m_dataComponent) {
            this.m_dataComponent.visible = true;
        }

        // 2. 切换到 Game 列表 tab（controller = 0）
        if (this.m_categoryController) {
            this.m_categoryController.selectedIndex = 0;
            console.log('  Category set to: 0 (Game list)');
        }

        // 3. Game 列表选中对应游戏
        this.m_gameListUI?.selectGameById(gameId);

        // 4. 显示 GameDetail
        if (this.m_gameDetailComponent && this.m_gameDetailUI) {
            this.m_gameDetailComponent.visible = true;
            this.m_gameDetailUI.showGame();
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
