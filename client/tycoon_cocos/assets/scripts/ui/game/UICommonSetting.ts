/**
 * UICommonSetting - 通用设置按钮
 *
 * 功能：
 * - 打开游戏配置界面（GameConfig）
 * - 预留调试功能入口
 *
 * 位置：固定显示在 Wallet 右侧
 */

import { _decorator } from 'cc';
import * as fgui from 'fairygui-cc';
import { UIBase } from '../core/UIBase';
import { UILayer } from '../core/UITypes';
import { UIManager } from '../core/UIManager';

const { ccclass } = _decorator;

@ccclass('UICommonSetting')
export class UICommonSetting extends UIBase {
    // FairyGUI 组件引用
    private btn_gameConfig!: fgui.GButton;
    private btn_debug!: fgui.GButton;

    /**
     * UI 包名和组件名
     */
    protected static override getPackageName(): string {
        return 'Common';
    }

    protected static override getComponentName(): string {
        return 'CommonSetting';
    }

    /**
     * 初始化（绑定组件）
     */
    protected onInit(): void {
        // 绑定 FairyGUI 组件（使用 UIBase 提供的辅助方法）
        this.btn_gameConfig = this.getButton('btn_gameConfig')!;
        this.btn_debug = this.getButton('btn_debug')!;

        // 绑定事件
        this.btn_gameConfig.onClick(this, this.onGameConfigClick);
        this.btn_debug.onClick(this, this.onDebugClick);

        console.log('[UICommonSetting] Initialized');
    }

    /**
     * 游戏配置按钮点击
     */
    private onGameConfigClick(): void {
        console.log('[UICommonSetting] Game Config button clicked');

        // 切换 GameConfig 界面显示/隐藏
        UIManager.instance.toggle(UILayer.POPUP, 'GameConfig');
    }

    /**
     * 调试按钮点击（预留）
     */
    private onDebugClick(): void {
        console.log('[UICommonSetting] Debug button clicked');
        // 预留：打开调试界面
    }
}
