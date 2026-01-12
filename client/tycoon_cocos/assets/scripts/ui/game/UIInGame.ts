import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { Blackboard } from "../../events/Blackboard";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';
import { UIMapElement } from "./UIMapElement";
import { UIEditor } from "./UIEditor";
import { UIInGameDebug } from "./UIInGameDebug";
import { UIInGameCards } from "./UIInGameCards";
import { UIInGameDice } from "./UIInGameDice";
import { UIInGamePlayer } from "./UIInGamePlayer";
import { UIInGameInfo } from "./UIInGameInfo";
import { UIInGameBuildingSelect } from "./UIInGameBuildingSelect";
import { UIInGamePlaySetting } from "./UIInGamePlaySetting";
import { UIPlayerDetail } from "./UIPlayerDetail";
import { UIMinimap } from "./UIMinimap";
import { MapManager } from "../../map/MapManager";
import { DecisionType, BuildingSize } from "../../sui/types/constants";
import type { PendingDecisionInfo } from "../../core/GameSession";
import { DecisionDialogHelper } from "../utils/DecisionDialogHelper";

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
    private m_playerPanelUI: UIInGamePlayer | null = null;
    private m_infoUI: UIInGameInfo | null = null;
    private m_buildingSelectUI: UIInGameBuildingSelect | null = null;
    private m_playSettingUI: UIInGamePlaySetting | null = null;
    private m_playerDetailUI: UIPlayerDetail | null = null;
    private m_minimapUI: UIMinimap | null = null;

    // ================ 控制器 ================
    private m_modeController: fgui.Controller;

    // ================ 功能按钮 ================
    private _pauseBtn: fgui.GButton | null = null;
    private _settingsBtn: fgui.GButton | null = null;
    private _bagBtn: fgui.GButton | null = null;

    // ================ 其他 ================
    private _gameTimerID: number | null = null;

    // ================ 决策窗口 ================
    private _isInitialized: boolean = false;

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
        // 创建一个包装组件传给 UIInGamePlayer
        this.m_playerPanelUI = this.panel.node.addComponent(UIInGamePlayer);
        this.m_playerPanelUI.setUIName("InGamePlayer");
        this.m_playerPanelUI.setPanel(this.panel);
        this.m_playerPanelUI.init();
        console.log('[UIInGame] Player UI component created');

        // m_infoUI
        const infoComponent = this.getChild('gameInfo')?.asCom;
        if (infoComponent) {
            this.m_infoUI = infoComponent.node.addComponent(UIInGameInfo);
            this.m_infoUI.setUIName("InGameInfo");
            this.m_infoUI.setPanel(infoComponent);
            this.m_infoUI.init();
            console.log('[UIInGame] Info UI component created');
        }

        // m_buildingSelectUI
        const buildingSelectComponent = this.getChild('buildingSelect')?.asCom;
        if (buildingSelectComponent) {
            this.m_buildingSelectUI = buildingSelectComponent.node.addComponent(UIInGameBuildingSelect);
            this.m_buildingSelectUI.setUIName("InGameBuildingSelect");
            this.m_buildingSelectUI.setPanel(buildingSelectComponent);
            this.m_buildingSelectUI.init();
            console.log('[UIInGame] BuildingSelect UI component created');
        }

        // m_playSettingUI
        const playSettingComponent = this.getChild('playSetting')?.asCom;
        if (playSettingComponent) {
            this.m_playSettingUI = playSettingComponent.node.addComponent(UIInGamePlaySetting);
            this.m_playSettingUI.setUIName("InGamePlaySetting");
            this.m_playSettingUI.setPanel(playSettingComponent);
            this.m_playSettingUI.init();
            console.log('[UIInGame] PlaySetting UI component created');
        }

        // 功能按钮
        this._pauseBtn = this.getButton("btnPause");
        this._settingsBtn = this.getButton("btnSettings");
        this._bagBtn = this.getButton("btnBag");

        // m_playerDetailUI
        const playerDetailComponent = this.getChild('playerDetail')?.asCom;
        if (playerDetailComponent) {
            this.m_playerDetailUI = playerDetailComponent.node.addComponent(UIPlayerDetail);
            this.m_playerDetailUI.setUIName("PlayerDetail");
            this.m_playerDetailUI.setPanel(playerDetailComponent);
            this.m_playerDetailUI.init();
            this.m_playerDetailUI.hide();
            console.log('[UIInGame] PlayerDetail UI component created');
        }

        // m_minimapUI
        const minimapComponent = this.getChild('minimap')?.asCom;
        if (minimapComponent) {
            this.m_minimapUI = minimapComponent.node.addComponent(UIMinimap);
            this.m_minimapUI.setUIName("Minimap");
            this.m_minimapUI.setPanel(minimapComponent);
            this.m_minimapUI.init();
            // 默认隐藏（Main.xml中已设置visible="false"）
            console.log('[UIInGame] Minimap UI component created');
        }

        // 初始化时主动设置一次 mode 控制器（防止错过 EditModeChanged 事件）
        this.updateModeController();
    }

    /**
     * 更新模式控制器（直接从 GameMap 读取）
     */
    private updateModeController(): void {
        if (!this.m_modeController) return;

        const gameMap = MapManager.getInstance()?.getCurrentGameMap();
        const isEditMode = gameMap?.isEditMode || false;

        this.m_modeController.selectedIndex = isEditMode ? 1 : 0;
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

        // 监听游戏事件
        EventBus.on(EventTypes.Game.GamePause, this._onGamePause, this);
        EventBus.on(EventTypes.Game.GameResume, this._onGameResume, this);
        EventBus.on(EventTypes.Map.EditModeChanged, this._onEditModeChanged, this);
        EventBus.on(EventTypes.UI.ScreenSizeChanged, this._onScreenSizeChanged, this);
        EventBus.on(EventTypes.UI.ShowMapSelect, this._onShowMapSelect, this);

        // 监听待决策事件
        EventBus.on(EventTypes.Game.DecisionPending, this._onDecisionPending, this);

        // 监听 GameSession 加载完成事件，确保在正确时机检查待决策
        EventBus.on(EventTypes.Game.SessionLoaded, this._onSessionLoaded, this);

        // 监听显示玩家详情事件
        EventBus.on(EventTypes.UI.ShowPlayerDetail, this._onShowPlayerDetail, this);
    }

    /**
     * GameSession 加载完成后的处理
     */
    private _onSessionLoaded(data: any): void {
        console.log('[UIInGame] GameSession 已加载，检查是否有待决策');

        // 主动检查待决策状态
        this._checkPendingDecisionAfterSessionLoaded().catch(error => {
            console.error('[UIInGame] Failed to check pending decision after session loaded:', error);
        });
    }

    /**
     * SessionLoaded 后主动检查待决策（异步）
     */
    private async _checkPendingDecisionAfterSessionLoaded(): Promise<void> {
        const { GameInitializer } = await import("../../core/GameInitializer");
        const session = GameInitializer.getInstance()?.getGameSession();

        if (!session) {
            console.log('[UIInGame] GameSession 未找到');
            return;
        }

        const pendingDecision = session.getPendingDecision();
        if (!pendingDecision) {
            console.log('[UIInGame] 没有待决策');
            return;
        }

        console.log('[UIInGame] SessionLoaded 后检测到待决策，主动显示', pendingDecision);

        // 检查是否是我的回合
        if (!session.isMyTurn()) {
            console.log('[UIInGame] 不是我的回合，不显示决策窗口', {
                myPlayerIndex: session.getMyPlayerIndex(),
                activePlayerIndex: session.getActivePlayerIndex()
            });
            return;
        }

        const myPlayer = session.getMyPlayer();
        if (!myPlayer) {
            console.warn('[UIInGame] 我的玩家未找到');
            return;
        }

        this._showDecisionDialog(pendingDecision, myPlayer, session);
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

        EventBus.off(EventTypes.Game.GamePause, this._onGamePause, this);
        EventBus.off(EventTypes.Game.GameResume, this._onGameResume, this);
        EventBus.off(EventTypes.Map.EditModeChanged, this._onEditModeChanged, this);
        EventBus.off(EventTypes.UI.ScreenSizeChanged, this._onScreenSizeChanged, this);
        EventBus.off(EventTypes.UI.ShowMapSelect, this._onShowMapSelect, this);

        // 移除待决策事件监听
        EventBus.off(EventTypes.Game.DecisionPending, this._onDecisionPending, this);
        EventBus.off(EventTypes.Game.SessionLoaded, this._onSessionLoaded, this);

        // 移除显示玩家详情事件监听
        EventBus.off(EventTypes.UI.ShowPlayerDetail, this._onShowPlayerDetail, this);

        super.unbindEvents();
    }

    /**
     * 显示回调
     */
    protected async onShow(data?: any): Promise<void> {
        console.log("[UIInGame] Showing in-game UI");

        // 开始游戏计时器
        this._startGameTimer();

        // 刷新所有子模块
        this.refreshAllSubModules();

        // 播放入场动画
        this._playShowAnimation();

        // 标记已初始化
        this._isInitialized = true;

        // 设置 CommonSetting 模式（根据是否为编辑模式）
        const { UIManager, SettingMode } = await import("../core/UIManager");
        const gameMap = MapManager.getInstance()?.getCurrentGameMap();
        const isEditMode = gameMap?.isEditMode || false;
        UIManager.instance?.setCommonSettingMode(isEditMode ? SettingMode.GameEditor : SettingMode.GamePlay);

        // 主动检查是否有待决策需要显示（异步，不阻塞）
        this._showDecisionDialogIfNeeded().catch(error => {
            console.error('[UIInGame] Failed to show decision dialog:', error);
        });

        console.log('[UIInGame] 界面初始化完成，已检查待决策状态');
    }

    /**
     * 隐藏回调
     */
    protected async onHide(): Promise<void> {
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
     * 显示地图选择事件（退出游戏/返回地图选择）
     */
    private _onShowMapSelect(data?: any): void {
        console.log('[UIInGame] ShowMapSelect event received, hiding');
        console.log('  Data:', data);
        this.hide();
    }
    

    // ================== 游戏事件处理 ==================

    /**
     * 编辑器模式变化事件
     */
    private async _onEditModeChanged(data: any): Promise<void> {
        console.log('[UIInGame] EditModeChanged event received');
        console.log('  isEditMode:', data.isEditMode);

        // 更新 UIInGame 的 mode controller
        if (this.m_modeController) {
            // 0:play, 1:editor
            this.m_modeController.selectedIndex = data.isEditMode ? 1 : 0;
            console.log('[UIInGame] Mode controller set to:', this.m_modeController.selectedIndex);
        }

        // 更新 CommonSetting 模式
        const { UIManager, SettingMode } = await import("../core/UIManager");
        UIManager.instance?.setCommonSettingMode(data.isEditMode ? SettingMode.GameEditor : SettingMode.GamePlay);
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

    // ================== 决策窗口处理 ==================

    /**
     * 处理待决策事件
     */
    private _onDecisionPending(data: any): void {
        console.log('[UIInGame] 收到待决策事件', data);

        // 直接从事件数据获取决策信息，避免异步时序问题
        const decision = data.decision;  // PendingDecisionInfo
        const session = data.session;    // GameSession

        if (!decision || !session) {
            console.warn('[UIInGame] DecisionPending 事件缺少数据');
            return;
        }

        // 如果 UI 已经初始化完成，直接显示决策窗口
        if (this._isInitialized) {
            const myPlayer = session.getMyPlayer();
            if (myPlayer) {
                console.log('[UIInGame] 直接显示决策窗口（从事件数据）', decision);
                this._showDecisionDialog(decision, myPlayer, session);
            } else {
                console.warn('[UIInGame] My player not found in event session');
            }
        }
        // 如果还没初始化完成，什么都不做（等待 onShow 中的主动查询）
    }

    /**
     * 检查并显示决策窗口（如果需要）
     */
    private async _showDecisionDialogIfNeeded(): Promise<void> {
        // 动态导入 GameInitializer（避免循环依赖）
        const { GameInitializer } = await import("../../core/GameInitializer");
        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            console.log('[UIInGame] GameSession 未找到');
            return;
        }

        // 检查是否有待决策
        const pendingDecision = session.getPendingDecision();
        if (!pendingDecision) {
            console.log('[UIInGame] 没有待决策');
            return;
        }

        // 检查是否轮到我
        if (!session.isMyTurn()) {
            console.log('[UIInGame] 不是我的回合，不显示决策窗口', {
                myPlayerIndex: session.getMyPlayerIndex(),
                activePlayerIndex: session.getActivePlayerIndex()
            });
            return;
        }

        const myPlayer = session.getMyPlayer();
        if (!myPlayer) {
            console.warn('[UIInGame] 我的玩家未找到');
            return;
        }

        console.log('[UIInGame] 显示决策窗口', pendingDecision);

        // 显示决策窗口
        this._showDecisionDialog(pendingDecision, myPlayer, session);
    }

    /**
     * 显示决策窗口（根据类型分发）
     */
    private _showDecisionDialog(decision: PendingDecisionInfo, myPlayer: any, session: any): void {
        switch (decision.type) {
            case DecisionType.BUY_PROPERTY:
                DecisionDialogHelper.showBuyDialog(decision, session);
                break;
            case DecisionType.UPGRADE_PROPERTY:
                // 检查是否是 2x2 建筑 lv0→lv1 升级（需要选择建筑类型）
                const building = session.getBuildingByTileId(decision.tileId);
                if (building &&
                    building.size === BuildingSize.SIZE_2X2 &&
                    building.level === 0) {
                    // 2x2 lv0 升级需要选择建筑类型
                    console.log('[UIInGame] 2x2 lv0 升级，显示建筑类型选择');

                    // 主动显示 UIInGameBuildingSelect（兜底方案）
                    if (this.m_buildingSelectUI) {
                        this.m_buildingSelectUI.show(undefined, false);
                    } else {
                        console.warn('[UIInGame] BuildingSelect 组件未找到，使用默认升级对话框');
                        DecisionDialogHelper.showUpgradeDialog(decision, session);
                    }
                } else {
                    // 普通升级使用 DecisionDialogHelper
                    DecisionDialogHelper.showUpgradeDialog(decision, session);
                }
                break;
            case DecisionType.PAY_RENT:
                DecisionDialogHelper.showRentDialog(decision, session);
                break;
            default:
                console.warn('[UIInGame] 未知的决策类型', decision.type);
        }
    }

    // ================== 子组件控制方法 ==================

    /**
     * 切换 PlaySetting 面板显示/隐藏
     * 由 CommonSetting.btn_playSetting 调用
     */
    public togglePlaySetting(): boolean {
        if (!this.m_playSettingUI || !this.m_playSettingUI.panel) {
            console.warn('[UIInGame] PlaySetting UI not initialized');
            return false;
        }

        const newVisible = !this.m_playSettingUI.panel.visible;
        this.m_playSettingUI.panel.visible = newVisible;

        console.log('[UIInGame] PlaySetting toggled:', newVisible);

        // 关闭时发送事件，同步按钮状态
        if (!newVisible) {
            EventBus.emit(EventTypes.UI.PlaySettingClosed);
        }

        return newVisible;
    }

    /**
     * 切换 Debug 面板显示/隐藏
     * 由 CommonSetting.btn_debug 调用
     */
    public toggleDebug(): boolean {
        if (!this.m_debugUI || !this.m_debugUI.panel) {
            console.warn('[UIInGame] Debug UI not initialized');
            return false;
        }

        const newVisible = !this.m_debugUI.panel.visible;
        this.m_debugUI.panel.visible = newVisible;

        console.log('[UIInGame] Debug toggled:', newVisible);
        return newVisible;
    }

    /**
     * 获取 PlaySetting 可见性状态
     */
    public isPlaySettingVisible(): boolean {
        return this.m_playSettingUI?.panel?.visible || false;
    }

    /**
     * 获取 Debug 可见性状态
     */
    public isDebugVisible(): boolean {
        return this.m_debugUI?.panel?.visible || false;
    }

    /**
     * 显示玩家详情面板
     */
    public showPlayerDetail(playerIndex: number): void {
        if (!this.m_playerDetailUI) {
            console.warn('[UIInGame] PlayerDetail UI not initialized');
            return;
        }

        this.m_playerDetailUI.show({ playerIndex });
        console.log('[UIInGame] 显示玩家详情:', playerIndex);
    }

    /**
     * 隐藏玩家详情面板
     */
    public hidePlayerDetail(): void {
        this.m_playerDetailUI?.hide();
    }

    /**
     * 显示玩家详情事件处理
     */
    private _onShowPlayerDetail(data: { playerIndex: number }): void {
        this.showPlayerDetail(data.playerIndex);
    }

    // ================== 小地图控制方法 ==================

    /**
     * 显示小地图
     */
    public showMinimap(): void {
        if (!this.m_minimapUI || !this.m_minimapUI.panel) {
            console.warn('[UIInGame] Minimap UI not initialized');
            return;
        }

        this.m_minimapUI.panel.visible = true;
        this.m_minimapUI.show(undefined, false);
        console.log('[UIInGame] Minimap shown');
    }

    /**
     * 隐藏小地图
     */
    public hideMinimap(): void {
        if (this.m_minimapUI?.panel) {
            this.m_minimapUI.panel.visible = false;
        }
        this.m_minimapUI?.hide();
    }

    /**
     * 切换小地图显示/隐藏
     */
    public toggleMinimap(): boolean {
        if (!this.m_minimapUI || !this.m_minimapUI.panel) {
            console.warn('[UIInGame] Minimap UI not initialized');
            return false;
        }

        const newVisible = !this.m_minimapUI.panel.visible;
        if (newVisible) {
            this.showMinimap();
        } else {
            this.hideMinimap();
        }

        console.log('[UIInGame] Minimap toggled:', newVisible);
        return newVisible;
    }

    /**
     * 获取小地图可见性状态
     */
    public isMinimapVisible(): boolean {
        return this.m_minimapUI?.panel?.visible || false;
    }

    /**
     * 销毁回调
     */
    protected onDestroy(): void {
        this._stopGameTimer();
        super.onDestroy();
    }
}