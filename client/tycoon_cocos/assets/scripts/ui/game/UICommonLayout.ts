/**
 * UICommonLayout - 通用布局容器
 *
 * 功能：
 * - 统一管理持久化 UI（Wallet、CommonSetting）
 * - 在 FairyGUI 编辑器中设置布局，避免代码计算位置
 * - 提供子组件访问接口
 */

import { _decorator } from 'cc';
import { UIBase } from '../core/UIBase';
import { UIWallet } from './UIWallet';
import { UICommonSetting, SettingMode } from './UICommonSetting';

const { ccclass } = _decorator;

@ccclass('UICommonLayout')
export class UICommonLayout extends UIBase {
    // FairyGUI 子组件引用
    private wallet!: fgui.GComponent;
    private commonSetting!: fgui.GComponent;
    private gameConfig!: fgui.GComponent;
    private suiConfig!: fgui.GComponent;

    // UI 逻辑组件
    private walletUI!: UIWallet;
    private settingUI!: UICommonSetting;
    private gameConfigUI!: any;  // UIGameConfig 类型
    private suiConfigUI!: any;  // UISuiConfig 类型

    /**
     * UI 包名和组件名
     */
    protected static override getPackageName(): string {
        return 'Common';
    }

    protected static override getComponentName(): string {
        return 'CommonLayout';
    }

    /**
     * 初始化（绑定子组件）
     */
    protected onInit(): void {
        console.log('[UICommonLayout] Initializing...');

        // 获取 FairyGUI 子组件
        this.wallet = this.getFGuiComponent('wallet')!;
        this.commonSetting = this.getFGuiComponent('commonSetting')!;
        this.gameConfig = this.getFGuiComponent('gameConfig')!;
        this.suiConfig = this.getFGuiComponent('suiConfig')!;

        if (!this.wallet || !this.commonSetting || !this.gameConfig || !this.suiConfig) {
            console.error('[UICommonLayout] Failed to get child components');
            return;
        }

        // 创建 UIWallet 逻辑组件
        this.walletUI = this.wallet.node.addComponent(UIWallet);
        this.walletUI.setUIName('Wallet');
        this.walletUI.setPanel(this.wallet);
        this.walletUI.init();

        // 创建 UICommonSetting 逻辑组件
        this.settingUI = this.commonSetting.node.addComponent(UICommonSetting);
        this.settingUI.setUIName('CommonSetting');
        this.settingUI.setPanel(this.commonSetting);
        this.settingUI.init();

        // 动态导入 UIGameConfig 避免循环依赖
        import('./UIGameConfig').then(({ UIGameConfig }) => {
            this.gameConfigUI = this.gameConfig.node.addComponent(UIGameConfig);
            this.gameConfigUI.setUIName('GameConfig');
            this.gameConfigUI.setPanel(this.gameConfig);
            this.gameConfigUI.init();

            // 默认隐藏
            this.gameConfig.visible = false;

            console.log('[UICommonLayout] GameConfig initialized (hidden by default)');
        });

        // 动态导入 UISuiConfig 避免循环依赖
        import('./UISuiConfig').then(({ UISuiConfig }) => {
            this.suiConfigUI = this.suiConfig.node.addComponent(UISuiConfig);
            this.suiConfigUI.setUIName('SuiConfig');
            this.suiConfigUI.setPanel(this.suiConfig);
            this.suiConfigUI.init();

            // 默认隐藏
            this.suiConfig.visible = false;

            console.log('[UICommonLayout] SuiConfig initialized (hidden by default)');
        });

        console.log('[UICommonLayout] Initialized with Wallet, CommonSetting, GameConfig, and SuiConfig');
    }

    /**
     * 获取 Wallet UI 实例
     */
    public getWallet(): UIWallet {
        return this.walletUI;
    }

    /**
     * 获取 CommonSetting UI 实例
     */
    public getSetting(): UICommonSetting {
        return this.settingUI;
    }

    /**
     * 获取 GameConfig UI 实例
     */
    public getGameConfig(): any {
        return this.gameConfigUI;
    }

    /**
     * 切换 GameConfig 显示/隐藏
     */
    public toggleGameConfig(): void {
        if (!this.gameConfig) {
            console.warn('[UICommonLayout] gameConfig component not initialized');
            return;
        }

        this.gameConfig.visible = !this.gameConfig.visible;
        console.log('[UICommonLayout] GameConfig visible:', this.gameConfig.visible);
    }

    /**
     * 获取 GameConfig 可见性
     */
    public isGameConfigVisible(): boolean {
        return this.gameConfig?.visible || false;
    }

    // ================== SuiConfig 控制 ==================

    /**
     * 切换 SuiConfig 显示/隐藏
     */
    public toggleSuiConfig(): void {
        if (!this.suiConfig) {
            console.warn('[UICommonLayout] suiConfig component not initialized');
            return;
        }

        this.suiConfig.visible = !this.suiConfig.visible;
        console.log('[UICommonLayout] SuiConfig visible:', this.suiConfig.visible);
    }

    /**
     * 获取 SuiConfig 可见性
     */
    public isSuiConfigVisible(): boolean {
        return this.suiConfig?.visible || false;
    }

    /**
     * 获取 SuiConfig UI 实例
     */
    public getSuiConfig(): any {
        return this.suiConfigUI;
    }

    // ================== 模式控制（转发到 CommonSetting） ==================

    /**
     * 设置 CommonSetting 模式
     */
    public setMode(mode: SettingMode): void {
        if (!this.settingUI) {
            console.warn('[UICommonLayout] settingUI not initialized');
            return;
        }

        this.settingUI.setMode(mode);
    }
}
