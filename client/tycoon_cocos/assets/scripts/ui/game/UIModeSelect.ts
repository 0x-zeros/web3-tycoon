import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { SuiManager } from "../../sui/managers/SuiManager";
import { UINotification } from "../utils/UINotification";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';

const { ccclass } = _decorator;

/**
 * 模式选择界面 - 玩家选择游戏模式
 */
@ccclass('UIModeSelect')
export class UIModeSelect extends UIBase {
    /** 开始游戏按钮 */
    private m_btn_start: fgui.GButton;

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
        this.m_btn_start = this.getButton("btn_start");
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        // 绑定开始游戏按钮
        this.m_btn_start?.onClick(this._onStartClick, this);

        // 监听游戏开始事件
        EventBus.on(EventTypes.Game.GameStart, this._onGameStart, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        // 解绑按钮事件
        this.m_btn_start?.offClick(this._onStartClick, this);

        // 调用父类解绑
        super.unbindEvents();
    }

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        console.log("[UIModeSelect] Showing mode select UI");

        // 播放背景音乐
        EventBus.emit(EventTypes.Audio.PlayBGM, {
            musicPath: "audio/bgm/main_menu",
            loop: true
        });

        // 播放显示动画
        this._playShowAnimation();
    }

    /**
     * 隐藏回调
     */
    protected onHide(): void {
        console.log("[UIModeSelect] Hiding mode select UI");

        // 停止背景音乐
        EventBus.emit(EventTypes.Audio.StopBGM);
    }

    // ================== 事件处理 ==================

    /**
     * 开始游戏按钮点击
     */
    private _onStartClick(): void {
        console.log("[UIModeSelect] Start clicked");

        // // 检查钱包连接
        // if (!SuiManager.instance.isConnected) {
        //     UINotification.warning("请先连接钱包");
        //     return;
        // }

        // 显示地图选择界面（不传递数据，MapSelect 会自己从 SuiManager 获取缓存）
        EventBus.emit(EventTypes.UI.ShowMapSelect, {
            source: "mode_select"
        });

        this.hide();
    }

    /**
     * 游戏开始事件
     */
    private _onGameStart(data: any): void {
        this.hide();
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