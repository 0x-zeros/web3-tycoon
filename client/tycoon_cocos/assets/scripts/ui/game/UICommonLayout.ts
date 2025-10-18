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
import { UICommonSetting } from './UICommonSetting';

const { ccclass } = _decorator;

@ccclass('UICommonLayout')
export class UICommonLayout extends UIBase {
    // FairyGUI 子组件引用
    private wallet!: fgui.GComponent;
    private commonSetting!: fgui.GComponent;

    // UI 逻辑组件
    private walletUI!: UIWallet;
    private settingUI!: UICommonSetting;

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

        if (!this.wallet || !this.commonSetting) {
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

        console.log('[UICommonLayout] Initialized with Wallet and CommonSetting');
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
}
