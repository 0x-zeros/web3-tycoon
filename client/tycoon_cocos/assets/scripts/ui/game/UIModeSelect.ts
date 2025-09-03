import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { Blackboard } from "../../events/Blackboard";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';

const { ccclass } = _decorator;

/**
 * 模式选择界面 - 玩家选择游戏模式
 */
@ccclass('UIModeSelect')
export class UIModeSelect extends UIBase {
    /** 单人游戏按钮 */
    private _singlePlayerBtn: fgui.GButton | null = null;
    /** 多人游戏按钮 */
    private _multiPlayerBtn: fgui.GButton | null = null;
    /** 设置按钮 */
    private _settingsBtn: fgui.GButton | null = null;
    /** 退出按钮 */
    private _exitBtn: fgui.GButton | null = null;
    /** 标题文本 */
    private _titleText: fgui.GTextField | null = null;
    /** 版本文本 */
    private _versionText: fgui.GTextField | null = null;


    public m_btn_start:fgui.GButton;
	public m_btn1:fgui.GButton;

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

        this.m_btn_start = this.getButton("btn_start");
        this.m_btn1 = this.getButton("btn1");

        // 获取按钮组件
        this._singlePlayerBtn = this.getButton("btnSinglePlayer");
        this._multiPlayerBtn = this.getButton("btnMultiPlayer");
        this._settingsBtn = this.getButton("btnSettings");
        this._exitBtn = this.getButton("btnExit");

        // 获取文本组件
        this._titleText = this.getText("txtTitle");
        this._versionText = this.getText("txtVersion");
    }

    /**
     * 设置默认值
     */
    private _setupDefaultValues(): void {
        // 设置标题和版本
        if (this._titleText) {
            this._titleText.text = "Web3 Tycoon";
        }

        if (this._versionText) {
            this._versionText.text = "v1.0.0";
        }

        // 根据网络状态设置多人按钮可用性
        this._updateMultiPlayerButton();
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        // 绑定按钮点击事件

        this.m_btn_start?.onClick(this._onSinglePlayerClick, this);



        this.m_btn1?.onClick(this._onBtn1Click, this);



        this._singlePlayerBtn?.onClick(this._onSinglePlayerClick, this);



        this._multiPlayerBtn?.onClick(this._onMultiPlayerClick, this);



        this._settingsBtn?.onClick(this._onSettingsClick, this);



        this._exitBtn?.onClick(this._onExitClick, this);


        // 监听游戏事件
        EventBus.onEvent(EventTypes.Game.GameStart, this._onGameStart, this);
        EventBus.onEvent(EventTypes.Game.GameEnd, this._onGameEnd, this);
        EventBus.onEvent(EventTypes.Network.Connected, this._onNetworkConnected, this);
        EventBus.onEvent(EventTypes.Network.Disconnected, this._onNetworkDisconnected, this);

        // 监听玩家数据变化
        Blackboard.instance.watch("playerName", this._onPlayerNameChange, this);
        Blackboard.instance.watch("isNetworkAvailable", this._onNetworkStateChange, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {

        // 解绑按钮事件
        this.m_btn_start?.offClick(this._onSinglePlayerClick, this);



        this.m_btn1?.offClick(this._onBtn1Click, this);



        

        this._singlePlayerBtn?.offClick(this._onSinglePlayerClick, this);


        this._multiPlayerBtn?.offClick(this._onMultiPlayerClick, this);



        this._settingsBtn?.offClick(this._onSettingsClick, this);



        this._exitBtn?.offClick(this._onExitClick, this);


        // 调用父类解绑
        super.unbindEvents();
    }

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        console.log("[UIModeSelect] Showing mode select UI");
        
        // 播放背景音乐
        EventBus.emitEvent(EventTypes.Audio.PlayBGM, {
            musicPath: "audio/bgm/main_menu",
            loop: true
        });

        // 检查玩家数据
        this._checkPlayerData();

        // 播放显示动画
        this._playShowAnimation();
    }

    /**
     * 隐藏回调
     */
    protected onHide(): void {
        console.log("[UIModeSelect] Hiding mode select UI");
        
        // 停止背景音乐
        EventBus.emitEvent(EventTypes.Audio.StopBGM);
    }

    /**
     * 刷新回调
     */
    protected onRefresh(data?: any): void {
        this._checkPlayerData();
        this._updateMultiPlayerButton();
    }

    // ================== 按钮事件处理 ==================

    /**
     * 单人游戏按钮点击
     */
    private _onSinglePlayerClick(): void {
        console.log("[UIModeSelect] Single player clicked");

        // 保存游戏模式
        Blackboard.instance.set("gameMode", "single_player", true);

        // 显示地图选择界面
        // EventBus.emitEvent(EventTypes.UI.ShowMapSelect, {
        //     gameMode: "single_player",
        //     source: "mode_select"
        // });

        EventBus.emitEvent(EventTypes.Game.GameStart, {
            mode: "single_player",
            source: "mode_select"
        });

        this.hide();
    }


    private _onBtn1Click(): void {
        console.log("[UIModeSelect] btn1 clicked");
       
    }



    /**
     * 多人游戏按钮点击
     */
    private _onMultiPlayerClick(): void {
        console.log("[UIModeSelect] Multi player clicked");

        // 检查网络连接
        const isNetworkAvailable = Blackboard.instance.get<boolean>("isNetworkAvailable", false);
        if (!isNetworkAvailable) {
            // 显示网络错误提示
            this._showNetworkErrorDialog();
            return;
        }

        // 保存游戏模式
        Blackboard.instance.set("gameMode", "multi_player", true);

        // 显示地图选择界面
        EventBus.emitEvent(EventTypes.UI.ShowMapSelect, {
            gameMode: "multi_player",
            source: "mode_select"
        });

        this.hide();
    }

    /**
     * 设置按钮点击
     */
    private _onSettingsClick(): void {
        console.log("[UIModeSelect] Settings clicked");

        // 发送显示设置界面事件
        EventBus.emitEvent(EventTypes.UI.ShowSettings, {
            source: "mode_select"
        });
    }

    /**
     * 退出按钮点击
     */
    private _onExitClick(): void {
        console.log("[UIModeSelect] Exit clicked");

        // 发送应用退出事件
        EventBus.emitEvent(EventTypes.System.AppBackground);
    }

    // ================== 游戏事件处理 ==================

    /**
     * 游戏开始事件
     */
    private _onGameStart(data: any): void {
        console.log("[UIModeSelect] Game started:", data);
        
        // 隐藏模式选择界面
        this.hide();
    }

    /**
     * 游戏结束事件
     */
    private _onGameEnd(data: any): void {
        console.log("[UIModeSelect] Game ended:", data);
        
        // 通过事件系统请求显示模式选择界面，而不是直接调用show()
        EventBus.emitEvent(EventTypes.UI.ShowMainMenu, {
            source: "game_end"
        });
    }

    /**
     * 网络连接事件
     */
    private _onNetworkConnected(): void {
        console.log("[UIModeSelect] Network connected");
        this._updateMultiPlayerButton();
    }

    /**
     * 网络断开事件
     */
    private _onNetworkDisconnected(): void {
        console.log("[UIModeSelect] Network disconnected");
        this._updateMultiPlayerButton();
    }

    // ================== 数据监听处理 ==================

    /**
     * 玩家名称变化
     */
    private _onPlayerNameChange(playerName: string): void {
        if (playerName && this._titleText) {
            this._titleText.text = `欢迎回来, ${playerName}`;
        }
    }

    /**
     * 网络状态变化
     */
    private _onNetworkStateChange(isAvailable: boolean): void {
        this._updateMultiPlayerButton();
    }

    // ================== 私有方法 ==================

    /**
     * 检查玩家数据
     */
    private _checkPlayerData(): void {
        // 获取玩家名称
        const playerName = Blackboard.instance.get<string>("playerName");
        if (playerName) {
            this._onPlayerNameChange(playerName);
        }

        // 获取上次游戏时间
        const lastPlayTime = Blackboard.instance.get<number>("lastPlayTime");
        if (lastPlayTime) {
            const now = Date.now();
            const diff = now - lastPlayTime;
            const hours = Math.floor(diff / (1000 * 60 * 60));
            
            if (hours > 24) {
                console.log(`[UIModeSelect] Welcome back after ${hours} hours`);
            }
        }

        // 更新最后游戏时间
        Blackboard.instance.set("lastPlayTime", Date.now(), true);
    }

    /**
     * 更新多人游戏按钮状态
     */
    private _updateMultiPlayerButton(): void {
        if (!this._multiPlayerBtn) return;

        const isNetworkAvailable = Blackboard.instance.get<boolean>("isNetworkAvailable", false);
        
        // 设置按钮可用性
        this._multiPlayerBtn.enabled = isNetworkAvailable;
        
        // 设置按钮透明度表示状态
        this._multiPlayerBtn.alpha = isNetworkAvailable ? 1.0 : 0.5;
    }

    /**
     * 显示网络错误对话框
     */
    private _showNetworkErrorDialog(): void {
        // 这里可以显示一个错误对话框
        // 由于我们移除了UIDialog，可以通过事件让其他系统处理
        EventBus.emitEvent(EventTypes.UI.ShowSettings, {
            type: "network_error",
            title: "网络错误",
            message: "多人游戏需要网络连接，请检查网络设置。",
            source: "mode_select"
        });
    }

    /**
     * 播放显示动画
     */
    private _playShowAnimation(): void {
        // 可以使用FairyGUI的Transition播放动画
        const showTransition = this.getTransition("showAnim");
        if (showTransition) {
            showTransition.play();
        }

        console.log("[UIModeSelect] Playing show animation");
    }
}