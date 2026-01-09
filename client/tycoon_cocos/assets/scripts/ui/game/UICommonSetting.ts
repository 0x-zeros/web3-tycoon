/**
 * UICommonSetting - 通用设置按钮
 *
 * 功能：
 * - 打开游戏配置界面（GameConfig）
 * - 控制游戏内 PlaySetting 面板
 * - 控制游戏内 Debug 面板
 *
 * 位置：固定显示在 Wallet 右侧
 */

import { _decorator } from 'cc';
import * as fgui from 'fairygui-cc';
import { UIBase } from '../core/UIBase';
import { UILayer } from '../core/UITypes';
import { UIManager } from '../core/UIManager';
import { EventBus } from '../../events/EventBus';
import { EventTypes } from '../../events/EventTypes';

const { ccclass } = _decorator;

@ccclass('UICommonSetting')
export class UICommonSetting extends UIBase {
    // FairyGUI 组件引用
    private btn_gameConfig!: fgui.GButton;
    private btn_env!: fgui.GButton;
    private btn_playSetting!: fgui.GButton;
    private btn_debug!: fgui.GButton;
    private btn_minimap!: fgui.GButton;

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
        this.btn_env = this.getButton('btn_env')!;
        this.btn_playSetting = this.getButton('btn_playSetting')!;
        this.btn_debug = this.getButton('btn_debug')!;
        this.btn_minimap = this.getButton('btn_minimap')!;

        // 绑定事件
        this.btn_gameConfig.onClick(this.onGameConfigClick, this);
        this.btn_env.onClick(this.onEnvClick, this);
        this.btn_playSetting.onClick(this.onPlaySettingClick, this);
        this.btn_debug.onClick(this.onDebugClick, this);
        this.btn_minimap.onClick(this.onMinimapClick, this);

        // 默认隐藏特殊按钮
        this.btn_env.visible = false;        // 只在 ModeSelect 显示
        this.hideInGameButtons();             // InGame 按钮默认隐藏

        // 监听事件
        EventBus.on(EventTypes.UI.PlaySettingClosed, this.onPlaySettingClosed, this);
        EventBus.on(EventTypes.UI.SuiConfigClosed, this.onSuiConfigClosed, this);
        EventBus.on(EventTypes.UI.MinimapClosed, this.onMinimapClosed, this);

        console.log('[UICommonSetting] Initialized');
    }

    /**
     * 游戏配置按钮点击（Toggle 按钮）
     */
    private onGameConfigClick(): void {
        console.log('[UICommonSetting] Game Config button clicked');

        // 切换 GameConfig 显示/隐藏
        UIManager.instance.toggleGameConfig();

        // 同步按钮状态
        this.btn_gameConfig.selected = UIManager.instance.isGameConfigVisible();
    }

    /**
     * 环境配置按钮点击（Toggle 按钮）
     * 控制 SuiConfig 显示/隐藏
     */
    private onEnvClick(): void {
        console.log('[UICommonSetting] Env button clicked');

        // 切换 SuiConfig 显示/隐藏
        UIManager.instance.toggleSuiConfig();

        // 同步按钮状态
        this.btn_env.selected = UIManager.instance.isSuiConfigVisible();
    }

    /**
     * PlaySetting 按钮点击（Toggle 按钮）
     * 控制 UIInGame.playSetting 显示/隐藏
     */
    private onPlaySettingClick(): void {
        console.log('[UICommonSetting] PlaySetting button clicked');

        // 获取 UIInGame 实例并切换 playSetting
        const uiInGame = UIManager.instance.getActiveUI('InGame');
        if (uiInGame && 'togglePlaySetting' in uiInGame) {
            const newVisible = (uiInGame as any).togglePlaySetting();

            // 同步按钮状态
            this.btn_playSetting.selected = newVisible;
        } else {
            console.warn('[UICommonSetting] UIInGame not found or togglePlaySetting not available');
        }
    }

    /**
     * Debug 按钮点击（Toggle 按钮）
     * 控制 UIInGame.debug 显示/隐藏
     */
    private onDebugClick(): void {
        console.log('[UICommonSetting] Debug button clicked');

        // 获取 UIInGame 实例并切换 debug
        const uiInGame = UIManager.instance.getActiveUI('InGame');
        if (uiInGame && 'toggleDebug' in uiInGame) {
            const newVisible = (uiInGame as any).toggleDebug();

            // 同步按钮状态
            this.btn_debug.selected = newVisible;
        } else {
            console.warn('[UICommonSetting] UIInGame not found or toggleDebug not available');
        }
    }

    /**
     * PlaySetting 关闭事件（用于同步按钮状态）
     */
    private onPlaySettingClosed(): void {
        console.log('[UICommonSetting] PlaySetting closed event received');
        this.btn_playSetting.selected = false;
    }

    /**
     * SuiConfig 关闭事件（用于同步按钮状态）
     */
    private onSuiConfigClosed(): void {
        console.log('[UICommonSetting] SuiConfig closed event received');
        this.btn_env.selected = false;
    }

    /**
     * 小地图按钮点击（Toggle 按钮）
     * 控制 UIInGame.minimap 显示/隐藏
     */
    private onMinimapClick(): void {
        console.log('[UICommonSetting] Minimap button clicked');

        // 获取 UIInGame 实例并切换 minimap
        const uiInGame = UIManager.instance.getActiveUI('InGame');
        if (uiInGame && 'toggleMinimap' in uiInGame) {
            const newVisible = (uiInGame as any).toggleMinimap();

            // 同步按钮状态
            this.btn_minimap.selected = newVisible;
        } else {
            console.warn('[UICommonSetting] UIInGame not found or toggleMinimap not available');
        }
    }

    /**
     * 小地图关闭事件（用于同步按钮状态）
     */
    private onMinimapClosed(): void {
        console.log('[UICommonSetting] Minimap closed event received');
        this.btn_minimap.selected = false;
    }

    // ================== 显示/隐藏游戏内按钮 ==================

    /**
     * 显示游戏内按钮（在 UIInGame 显示时调用）
     */
    public showInGameButtons(): void {
        console.log('[UICommonSetting] Showing in-game buttons');

        if (this.btn_playSetting) {
            this.btn_playSetting.visible = true;
            this.btn_playSetting.selected = false;
        }

        if (this.btn_debug) {
            this.btn_debug.visible = true;
            this.btn_debug.selected = false;
        }

        if (this.btn_minimap) {
            this.btn_minimap.visible = true;
            this.btn_minimap.selected = false;
        }
    }

    /**
     * 隐藏游戏内按钮（在 UIInGame 隐藏时调用）
     */
    public hideInGameButtons(): void {
        console.log('[UICommonSetting] Hiding in-game buttons');

        if (this.btn_playSetting) {
            this.btn_playSetting.visible = false;
            this.btn_playSetting.selected = false;
        }

        if (this.btn_debug) {
            this.btn_debug.visible = false;
            this.btn_debug.selected = false;
        }

        if (this.btn_minimap) {
            this.btn_minimap.visible = false;
            this.btn_minimap.selected = false;
        }
    }

    // ================== 显示/隐藏环境按钮 ==================

    /**
     * 显示环境按钮（在 UIModeSelect 显示时调用）
     */
    public showEnvButton(): void {
        console.log('[UICommonSetting] Showing env button');

        if (this.btn_env) {
            this.btn_env.visible = true;
            this.btn_env.selected = false;
        }
    }

    /**
     * 隐藏环境按钮（在 UIModeSelect 隐藏时调用）
     */
    public hideEnvButton(): void {
        console.log('[UICommonSetting] Hiding env button');

        if (this.btn_env) {
            this.btn_env.visible = false;
            this.btn_env.selected = false;
        }
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        if (this.btn_gameConfig) {
            this.btn_gameConfig.offClick(this.onGameConfigClick, this);
        }

        if (this.btn_env) {
            this.btn_env.offClick(this.onEnvClick, this);
        }

        if (this.btn_playSetting) {
            this.btn_playSetting.offClick(this.onPlaySettingClick, this);
        }

        if (this.btn_debug) {
            this.btn_debug.offClick(this.onDebugClick, this);
        }

        if (this.btn_minimap) {
            this.btn_minimap.offClick(this.onMinimapClick, this);
        }

        // 移除事件监听
        EventBus.off(EventTypes.UI.PlaySettingClosed, this.onPlaySettingClosed, this);
        EventBus.off(EventTypes.UI.SuiConfigClosed, this.onSuiConfigClosed, this);
        EventBus.off(EventTypes.UI.MinimapClosed, this.onMinimapClosed, this);

        super.unbindEvents();
    }
}
