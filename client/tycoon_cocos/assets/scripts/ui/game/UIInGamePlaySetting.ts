/**
 * UIInGamePlaySetting - 游戏内设置面板
 *
 * 功能:
 * - 退出游戏
 * - 关闭设置面板
 *
 * 位置: UIInGame.playSetting 子组件
 * 控制: 由 CommonSetting.btn_playSetting toggle 按钮控制显示/隐藏
 */

import { _decorator } from 'cc';
import * as fgui from 'fairygui-cc';
import { UIBase } from '../core/UIBase';
import { EventBus } from '../../events/EventBus';
import { EventTypes } from '../../events/EventTypes';

const { ccclass } = _decorator;

@ccclass('UIInGamePlaySetting')
export class UIInGamePlaySetting extends UIBase {
    // FairyGUI 组件引用
    private btn_exitGame!: fgui.GButton;
    private btn_close!: fgui.GButton;

    // 事件绑定状态标记
    private _eventsBound: boolean = false;

    /**
     * 初始化（只绑定组件引用，不绑定事件）
     */
    protected onInit(): void {
        // 绑定 FairyGUI 组件
        this.btn_exitGame = this.getButton('btn_exitGame')!;
        this.btn_close = this.getButton('btn_close')!;

        if (!this.btn_exitGame || !this.btn_close) {
            console.error('[UIInGamePlaySetting] Failed to get buttons');
            return;
        }

        console.log('[UIInGamePlaySetting] Initialized');
    }

    /**
     * 绑定事件（每次显示时调用）
     */
    protected bindEvents(): void {
        // 防止重复绑定
        if (this._eventsBound) {
            console.log('[UIInGamePlaySetting] Events already bound, skipping');
            return;
        }

        // 绑定按钮事件
        if (this.btn_exitGame) {
            this.btn_exitGame.onClick(this.onExitGameClick, this);
        }

        if (this.btn_close) {
            this.btn_close.onClick(this.onCloseClick, this);
        }

        this._eventsBound = true;
        console.log('[UIInGamePlaySetting] Events bound');
    }

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        console.log('[UIInGamePlaySetting] Showing play setting panel');

        // ✅ 手动绑定事件（因为 visible 切换不触发 onEnable）
        this.bindEvents();
    }

    /**
     * 隐藏回调
     */
    protected onHide(): void {
        console.log('[UIInGamePlaySetting] Hiding play setting panel');

        // ✅ 手动解绑事件（防止内存泄漏）
        this.unbindEvents();
    }

    /**
     * 退出游戏按钮点击
     * 调用 UIManager.exitGame() 统一处理退出逻辑
     */
    private async onExitGameClick(): Promise<void> {
        console.log('[UIInGamePlaySetting] Exit game button clicked');

        // 1. 先关闭 PlaySetting 面板
        if (this.panel) {
            this.panel.visible = false;
            console.log('[UIInGamePlaySetting] Panel closed before exit');
        }

        // 通知 CommonSetting 更新按钮状态
        EventBus.emit(EventTypes.UI.PlaySettingClosed);

        // 2. 退出游戏
        const { UIManager } = await import('../core/UIManager');
        UIManager.instance?.exitGame();
    }

    /**
     * 关闭按钮点击
     */
    private onCloseClick(): void {
        console.log('[UIInGamePlaySetting] Close button clicked');

        // 直接设置 FairyGUI panel 的 visible（而不是调用 hide()）
        // 参考 UICommonLayout.toggleGameConfig() 的实现
        if (this.panel) {
            this.panel.visible = false;
            console.log('[UIInGamePlaySetting] Panel hidden');
        }

        // 通知 CommonSetting 更新按钮状态
        EventBus.emit(EventTypes.UI.PlaySettingClosed);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        if (!this._eventsBound) {
            return;
        }

        if (this.btn_exitGame) {
            this.btn_exitGame.offClick(this.onExitGameClick, this);
        }

        if (this.btn_close) {
            this.btn_close.offClick(this.onCloseClick, this);
        }

        this._eventsBound = false;
        console.log('[UIInGamePlaySetting] Events unbound');

        super.unbindEvents();
    }
}
