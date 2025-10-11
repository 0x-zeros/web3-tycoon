import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { Blackboard } from "../../events/Blackboard";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';
import { UIManager } from "../core/UIManager";
import { UIMapElement } from "./UIMapElement";
import { UIEditor } from "./UIEditor";
import { UIInGameDebug } from "./UIInGameDebug";
import { UIInGameCards } from "./UIInGameCards";
import { UIInGameDice } from "./UIInGameDice";
import { UIInGamePlayerPanel } from "./UIInGamePlayerPanel";
import { UIInGameInfo } from "./UIInGameInfo";
import { MapManager } from "../../map/MapManager";

const { ccclass } = _decorator;

/**
 * 游戏内UI界面 - 管理游戏中的HUD和交互界面
 */
@ccclass('UIInGame')
export class UIInGame extends UIBase {

    // ================ 子模块 ================
    private m_mapElementUI: UIMapElement;
    private m_editorUI: UIEditor;
    private m_debugUI: UIInGameDebug | null = null;
    private m_cardsUI: UIInGameCards | null = null;
    private m_diceUI: UIInGameDice | null = null;
    private m_playerPanelUI: UIInGamePlayerPanel | null = null;
    private m_infoUI: UIInGameInfo | null = null;

    // ================ 控制器 ================
    private m_modeController: fgui.Controller;

    // ================ 功能按钮 ================
    private _pauseBtn: fgui.GButton | null = null;
    private _settingsBtn: fgui.GButton | null = null;
    private _bagBtn: fgui.GButton | null = null;
    private _exitGameBtn: fgui.GButton | null = null;

    // ================ 其他 ================
    private _gameTimerID: number | null = null;

    /**
     * 初始化回调
     */
    protected onInit(): void {
        this._setupComponents();
        this._setupDefaultValues();
    }

    /**
     * 设置组件引用
     */
    private _setupComponents(): void {

        this.m_btn_dice = this.getChild('n1').asCom.getChild('n2') as fgui.GButton;
        
        // 获取editor组件并设置UIEditor
        const editorComponent = this.getChild('editor').asCom;
        this.m_editorUI = editorComponent.node.addComponent(UIEditor);
        // 设置UI名称和面板引用
        this.m_editorUI.setUIName("Editor");
        this.m_editorUI.setPanel(editorComponent);
        // 初始化
        this.m_editorUI.init();
        
        // 使用主界面的mode控制器
        this.m_modeController = this.getController('mode');

        //m_mapElementUI
        const mapElementComponent = this.getChild('mapElement').asCom;
        this.m_mapElementUI = mapElementComponent.node.addComponent(UIMapElement);
        // 设置UI名称和面板引用
        this.m_mapElementUI.setUIName("MapElement");
        this.m_mapElementUI.setPanel(mapElementComponent);
        // 初始化
        this.m_mapElementUI.init();
        
        // 设置UIEditor的UIMapElement引用（在m_mapElementUI创建之后）
        this.m_editorUI.setMapElementUI(this.m_mapElementUI);

        //hide
        this.m_mapElementUI.hide();

        // m_debugUI
        const debugComponent = this.getChild('debug')?.asCom;
        if (debugComponent) {
            this.m_debugUI = debugComponent.node.addComponent(UIInGameDebug);
            this.m_debugUI.setUIName("InGameDebug");
            this.m_debugUI.setPanel(debugComponent);
            this.m_debugUI.init();
            console.log('[UIInGame] Debug UI component created');
        } else {
            console.warn('[UIInGame] Debug component not found in FairyGUI');
        }

        // m_cardsUI
        const cardsComponent = this.getChild('cards')?.asCom;
        if (cardsComponent) {
            this.m_cardsUI = cardsComponent.node.addComponent(UIInGameCards);
            this.m_cardsUI.setUIName("InGameCards");
            this.m_cardsUI.setPanel(cardsComponent);
            this.m_cardsUI.init();
            console.log('[UIInGame] Cards UI component created');
        }

        // m_diceUI
        const diceComponent = this.getChild('dice')?.asCom;
        if (diceComponent) {
            this.m_diceUI = diceComponent.node.addComponent(UIInGameDice);
            this.m_diceUI.setUIName("InGameDice");
            this.m_diceUI.setPanel(diceComponent);
            this.m_diceUI.init();
            console.log('[UIInGame] Dice UI component created');
        }

        // m_playerPanelUI（管理 myPlayer 和 playerList）
        // 假设 myPlayer 和 playerList 在同一个容器或直接在主面板
        // 创建一个包装组件传给 UIInGamePlayerPanel
        this.m_playerPanelUI = this.panel.node.addComponent(UIInGamePlayerPanel);
        this.m_playerPanelUI.setUIName("InGamePlayerPanel");
        this.m_playerPanelUI.setPanel(this.panel);
        this.m_playerPanelUI.init();
        console.log('[UIInGame] Player Panel UI component created');

        // m_infoUI
        const infoComponent = this.getChild('gameInfo')?.asCom;
        if (infoComponent) {
            this.m_infoUI = infoComponent.node.addComponent(UIInGameInfo);
            this.m_infoUI.setUIName("InGameInfo");
            this.m_infoUI.setPanel(infoComponent);
            this.m_infoUI.init();
            console.log('[UIInGame] Info UI component created');
        }

        // 根据GameMap的编辑模式设置控制器
        this.updateModeController();

        // 功能按钮
        this._pauseBtn = this.getButton("btnPause");
        this._settingsBtn = this.getButton("btnSettings");
        this._bagBtn = this.getButton("btnBag");
        this._exitGameBtn = this.getButton("btn_exitGame");
    }

    /**
     * 更新模式控制器
     */
    private updateModeController(): void {
        
        // 获取编辑模式状态并设置mode控制器
        if (this.m_modeController) {
            // 0:play模式 1:editor模式
            const isEditMode = MapManager.getInstance().getCurrentMapEditMode();
            this.m_modeController.selectedIndex = isEditMode ? 1 : 0;
        }
    }
    
    /**
     * 设置默认值
     */
    private _setupDefaultValues(): void {
        // 子模块会自己初始化，这里不需要做什么
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        // 绑定功能按钮事件
        if (this._pauseBtn) {
            this._pauseBtn.onClick(this._onPauseClick, this);
        }

        if (this._settingsBtn) {
            this._settingsBtn.onClick(this._onSettingsClick, this);
        }

        if (this._bagBtn) {
            this._bagBtn.onClick(this._onBagClick, this);
        }

        if (this._exitGameBtn) {
            this._exitGameBtn.onClick(this._onExitGameClick, this);
        }

        // 监听游戏事件
        EventBus.on(EventTypes.Game.GameStart, this._onGameStart, this);
        EventBus.on(EventTypes.Game.GamePause, this._onGamePause, this);
        EventBus.on(EventTypes.Game.GameResume, this._onGameResume, this);
        EventBus.on(EventTypes.UI.ScreenSizeChanged, this._onScreenSizeChanged, this);
        EventBus.on(EventTypes.UI.ShowMapSelect, this._onShowMapSelect, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        if (this._pauseBtn) {
            this._pauseBtn.offClick(this._onPauseClick, this);
        }

        if (this._settingsBtn) {
            this._settingsBtn.offClick(this._onSettingsClick, this);
        }

        if (this._bagBtn) {
            this._bagBtn.offClick(this._onBagClick, this);
        }

        if (this._exitGameBtn) {
            this._exitGameBtn.offClick(this._onExitGameClick, this);
        }

        EventBus.off(EventTypes.Game.GameStart, this._onGameStart, this);
        EventBus.off(EventTypes.Game.GamePause, this._onGamePause, this);
        EventBus.off(EventTypes.Game.GameResume, this._onGameResume, this);
        EventBus.off(EventTypes.UI.ScreenSizeChanged, this._onScreenSizeChanged, this);
        EventBus.off(EventTypes.UI.ShowMapSelect, this._onShowMapSelect, this);

        super.unbindEvents();
    }

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        console.log("[UIInGame] Showing in-game UI");

        // 开始游戏计时器
        this._startGameTimer();

        // 刷新所有子模块
        this.refreshAllSubModules();

        // 播放入场动画
        this._playShowAnimation();
    }

    /**
     * 隐藏回调
     */
    protected onHide(): void {
        console.log("[UIInGame] Hiding in-game UI");

        // 停止游戏计时器
        this._stopGameTimer();
    }

    /**
     * 刷新回调
     */
    protected onRefresh(data?: any): void {
        this.updateModeController();
        this.refreshAllSubModules();
    }

    /**
     * 刷新所有子模块
     */
    private refreshAllSubModules(): void {
        this.m_cardsUI?.refresh();
        this.m_playerPanelUI?.refresh();
        this.m_infoUI?.refresh();
    }

    // ================== 按钮事件处理 ==================

    /**
     * 暂停按钮点击
     */
    private _onPauseClick(): void {
        console.log("[UIInGame] Pause clicked");

        // 发送游戏暂停事件
        EventBus.emit(EventTypes.Game.GamePause, {
            source: "in_game_ui"
        });

        // 显示暂停菜单
        EventBus.emit(EventTypes.UI.ShowPauseMenu);
    }

    /**
     * 设置按钮点击
     */
    private _onSettingsClick(): void {
        console.log("[UIInGame] Settings clicked");

        // 发送显示设置界面事件
        EventBus.emit(EventTypes.UI.ShowSettings, {
            source: "in_game_ui"
        });
    }

    /**
     * 背包按钮点击
     */
    private _onBagClick(): void {
        console.log("[UIInGame] Bag clicked");

        // 发送打开背包事件
        EventBus.emit(EventTypes.UI.OpenBag, {
            source: "in_game_ui"
        });
    }

    /**
     * 退出游戏按钮点击
     * 使用EventBus系统退出当前GameMap并返回地图选择界面
     */
    private _onExitGameClick(): void {
        console.log("[UIInGame] Exit game button clicked");

        // 发送请求切换地图事件（不指定目标地图toMapId: null表示卸载当前地图）
        //fromMapId: string; toMapId: string, isEdit?: boolean }
        EventBus.emit(EventTypes.Game.RequestMapChange, {
            toMapId: null
        });

        // 发送请求显示地图选择界面事件
        EventBus.emit(EventTypes.UI.ShowMapSelect);
        this.hide();

        console.log("[UIInGame] Sent events to exit to map selection");
    }

    /**
     * 显示地图选择事件（退出游戏/返回地图选择）
     */
    private _onShowMapSelect(data?: any): void {
        console.log('[UIInGame] ShowMapSelect event received, hiding');
        console.log('  Data:', data);
        this.hide();
    }
    

    // ================== 游戏事件处理 ==================

    /**
     * 游戏开始事件（只负责 UI 显示）
     */
    private _onGameStart(data: any): void {
        console.log('[UIInGame] GameStart event received');
        console.log('  Game ID:', data.game?.id);

        // 显示 UIInGame
        this.show();

        console.log('[UIInGame] UI shown');
    }

    /**
     * 游戏暂停事件
     */
    private _onGamePause(): void {
        console.log("[UIInGame] Game paused");

        if (this._pauseBtn) {
            this._pauseBtn.text = "继续";
        }

        this._stopGameTimer();
    }

    /**
     * 游戏恢复事件
     */
    private _onGameResume(): void {
        console.log("[UIInGame] Game resumed");

        if (this._pauseBtn) {
            this._pauseBtn.text = "暂停";
        }

        this._startGameTimer();
    }

    /**
     * 屏幕尺寸变化
     */
    private _onScreenSizeChanged(data: any): void {
        // console.log("[UIInGame] Screen size changed:", data);

        this._panel.setSize(data.width, data.height);
        // console.log("[UIInGame] panel size changed:", data.width, data.height);
    }

    // ================== 游戏计时器 ==================

    /**
     * 开始游戏计时器
     */
    private _startGameTimer(): void {
        if (this._gameTimerID) {
            this._stopGameTimer();
        }

        this._gameTimerID = window.setInterval(() => {
            const currentTime = Blackboard.instance.get<number>("gameTime", 0);
            Blackboard.instance.set("gameTime", currentTime + 1);
        }, 1000);
    }

    /**
     * 停止游戏计时器
     */
    private _stopGameTimer(): void {
        if (this._gameTimerID) {
            clearInterval(this._gameTimerID);
            this._gameTimerID = null;
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

        console.log("[UIInGame] Playing show animation");
    }

    /**
     * 销毁回调
     */
    protected onDestroy(): void {
        this._stopGameTimer();
        super.onDestroy();
    }
}