/**
 * UISuiConfig - Sui 网络配置界面
 *
 * 功能：
 * 1. 切换网络环境（mainnet/testnet/devnet/localnet）
 * 2. 切换钱包类型（wallet/keypair，仅 devnet/localnet）
 * 3. 配置 keypair storageKey 和 password
 * 4. 持久化配置到 localStorage
 *
 * Controller:
 * - env: 网络选择（0=mainnet,1=testnet,2=devnet,3=localnet）
 * - useKeypair: 钱包类型（0=wallet,1=keypair，仅 devnet/localnet 显示）
 *
 * 按钮:
 * - btn_cancel: 关闭不保存
 * - btn_ok: 检测变化→独立处理 env/useKeypair→保存
 */

import { _decorator } from 'cc';
import * as fgui from 'fairygui-cc';
import { UIBase } from '../core/UIBase';
import { EventBus } from '../../events/EventBus';
import { EventTypes } from '../../events/EventTypes';
import { SuiManager } from '../../sui/managers/SuiManager';
import { SuiEnvConfigManager } from '../../config/SuiEnvConfigManager';
import { KeystoreConfig } from '../../sui/utils/KeystoreConfig';
import { UINotification } from '../utils/UINotification';
import { NetworkType } from '../../sui/config/SuiConfig';
import { loadKeypairWithPassword, saveKeypairWithPassword } from '../../sui/utils/KeystoreLoader';

const { ccclass } = _decorator;

@ccclass('UISuiConfig')
export class UISuiConfig extends UIBase {
    // Controller
    private envController!: fgui.Controller;
    private useKeypairController!: fgui.Controller;

    // Keypair 输入框
    private input_storageKey!: fgui.GTextInput;
    private input_password!: fgui.GTextInput;

    // 按钮
    private btn_cancel!: fgui.GButton;
    private btn_ok!: fgui.GButton;

    // Keypair 组件容器（用于控制显示/隐藏）
    private keypairGroup!: fgui.GComponent;

    // 事件绑定状态标记
    private _eventsBound: boolean = false;

    /**
     * 初始化（绑定组件引用）
     */
    protected onInit(): void {
        // 绑定 Controller
        this.envController = this.getController('env')!;
        this.useKeypairController = this.getController('useKeypair')!;

        // 绑定 Keypair 输入框
        const keypairComponent = this.getChild('keypair')?.asCom;
        if (keypairComponent) {
            this.keypairGroup = keypairComponent;
            this.input_storageKey = keypairComponent.getChild('storageKey') as fgui.GTextInput;
            this.input_password = keypairComponent.getChild('password') as fgui.GTextInput;
        }

        // 绑定按钮
        this.btn_cancel = this.getButton('btn_cancel')!;
        this.btn_ok = this.getButton('btn_ok')!;

        // 检查组件是否完整
        if (!this.envController || !this.useKeypairController ||
            !this.btn_cancel || !this.btn_ok) {
            console.error('[UISuiConfig] Failed to get required components');
            return;
        }

        console.log('[UISuiConfig] Components initialized');
    }

    /**
     * 绑定事件（每次显示时调用）
     */
    protected bindEvents(): void {
        // 防止重复绑定
        if (this._eventsBound) {
            console.log('[UISuiConfig] Events already bound, skipping');
            return;
        }

        // 绑定按钮事件
        if (this.btn_cancel) {
            this.btn_cancel.onClick(this.onCancelClick, this);
        }

        if (this.btn_ok) {
            this.btn_ok.onClick(this.onOkClick, this);
        }

        // 监听 env controller 变化
        if (this.envController) {
            this.envController.on(fgui.Event.STATUS_CHANGED, this.onEnvControllerChanged, this);
        }

        this._eventsBound = true;
        console.log('[UISuiConfig] Events bound');
    }

    /**
     * 显示回调 - 加载当前配置
     */
    protected onShow(data?: any): void {
        console.log('[UISuiConfig] Showing Sui config UI');

        // ✅ 手动绑定事件（因为 visible 切换不触发 onEnable）
        this.bindEvents();

        this.loadCurrentConfig();
    }

    /**
     * 隐藏回调
     */
    protected onHide(): void {
        console.log('[UISuiConfig] Hiding Sui config UI');

        // ✅ 手动解绑事件（防止内存泄漏）
        this.unbindEvents();
    }

    // ================== 配置加载 ==================

    /**
     * 加载当前配置到 UI
     */
    private loadCurrentConfig(): void {
        const config = SuiManager.instance.config;

        console.log('[UISuiConfig] Loading current config:', {
            network: config.network,
            signerType: config.signerType
        });

        // 设置 env controller
        this.envController.selectedIndex = this.getEnvIndex(config.network as NetworkType);

        // 设置 useKeypair controller
        this.useKeypairController.selectedIndex = config.signerType === 'keypair' ? 1 : 0;

        // 加载 keypair 配置
        if (this.input_storageKey && this.input_password) {
            this.input_storageKey.text = KeystoreConfig.instance.getStorageKey();
            this.input_password.text = KeystoreConfig.instance.getPassword();
        }
    }

    // ================== Controller 监听 ==================

    /**
     * env controller 变化时触发
     * FairyGUI 自动切换 env controller，触发此回调
     *
     * 约束规则：
     * - mainnet/testnet → 强制 wallet
     * - localnet → 强制 keypair
     * - devnet → 自由选择
     */
    private onEnvControllerChanged(): void {
        const envIndex = this.envController.selectedIndex;
        const env = this.getEnvName(envIndex);

        console.log('[UISuiConfig] Env controller changed to:', env, '(index:', envIndex, ')');

        // mainnet (0) 或 testnet (1) → 强制 wallet (0)
        if (envIndex === 0 || envIndex === 1) {
            this.useKeypairController.selectedIndex = 0;  // wallet
            console.log('[UISuiConfig] → 强制设置为 wallet (mainnet/testnet 不支持 keypair)');
        }
        // localnet (3) → 强制 keypair (1)
        else if (envIndex === 3) {
            this.useKeypairController.selectedIndex = 1;  // keypair
            console.log('[UISuiConfig] → 强制设置为 keypair (localnet 只支持 keypair)');
        }
        // devnet (2) → 保持当前选择（不改变）
        else {
            console.log('[UISuiConfig] → 保持当前选择（devnet 可自由选择）');
            // 不修改 useKeypairController.selectedIndex
        }

        // useKeypair controller 切换 page 后，FairyGUI 会自动显示/隐藏 keypair 组件
        // 不需要手动设置 keypairGroup.visible
    }

    // ================== 按钮事件 ==================

    /**
     * Cancel 按钮点击 - 关闭不保存
     */
    private onCancelClick(): void {
        console.log('[UISuiConfig] Cancel clicked');

        this.panel.visible = false;
        EventBus.emit(EventTypes.UI.SuiConfigClosed);
    }

    /**
     * OK 按钮点击 - 检测变化并应用
     * 独立处理 env 切换、useKeypair 切换、keypair 配置变化
     */
    private async onOkClick(): Promise<void> {
        console.log('[UISuiConfig] OK clicked');

        // 禁用按钮（防止重复点击）
        this.btn_ok.enabled = false;

        try {
            // 读取新配置
            const newEnv = this.getEnvName(this.envController.selectedIndex);
            const newUseKeypair = this.useKeypairController.selectedIndex === 1;
            const newSignerType = newUseKeypair ? 'keypair' : 'wallet';

            // 读取当前配置
            const currentConfig = SuiManager.instance.config;
            const envChanged = newEnv !== currentConfig.network;
            const signerChanged = newSignerType !== currentConfig.signerType;

            // 检测 keypair 配置变化（仅在当前和新配置都是 keypair 模式时）
            let keypairConfigChanged = false;
            if (newUseKeypair && currentConfig.signerType === 'keypair') {
                const newStorageKey = this.input_storageKey?.text.trim() || '';
                const newPassword = this.input_password?.text || '';
                const currentStorageKey = KeystoreConfig.instance.getStorageKey();
                const currentPassword = KeystoreConfig.instance.getPassword();

                keypairConfigChanged = newStorageKey !== currentStorageKey || newPassword !== currentPassword;

                if (keypairConfigChanged) {
                    console.log('[UISuiConfig] Keypair config changed:');
                    console.log('  Storage key:', currentStorageKey, '→', newStorageKey);
                    console.log('  Password changed:', newPassword !== currentPassword);
                }
            }

            // 没有任何变化，直接关闭
            if (!envChanged && !signerChanged && !keypairConfigChanged) {
                console.log('[UISuiConfig] No changes detected');
                this.panel.visible = false;
                return;
            }

            // ✅ 独立处理 1: env 切换（影响大，重新初始化）
            if (envChanged) {
                console.log('[UISuiConfig] Network changed:', currentConfig.network, '→', newEnv);
                await this.handleNetworkChange(newEnv, newSignerType);
            }
            // ✅ 独立处理 2: useKeypair 切换（影响小，只换 signer）
            else if (signerChanged) {
                console.log('[UISuiConfig] Signer changed:', currentConfig.signerType, '→', newSignerType);
                await this.handleSignerChange(newUseKeypair);
            }
            // ✅ 独立处理 3: keypair 配置变化（storageKey 或 password 变化）
            else if (keypairConfigChanged) {
                console.log('[UISuiConfig] Keypair config changed (signer type unchanged)');
                await this.handleSignerChange(newUseKeypair);
            }

            // 保存配置到 localStorage
            SuiEnvConfigManager.instance.save(newEnv as NetworkType, newSignerType);

            // 关闭面板
            this.panel.visible = false;
            EventBus.emit(EventTypes.UI.SuiConfigClosed);

        } catch (error) {
            console.error('[UISuiConfig] Failed to apply config:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            UINotification.error(`配置应用失败：${errorMsg}`);
        } finally {
            // 重新启用按钮
            this.btn_ok.enabled = true;
        }
    }

    // ================== 网络切换（重新初始化）==================

    /**
     * 处理网络切换
     * 影响：RPC、EventListener、AssetPolling、所有缓存数据
     * 方法：完全重新初始化 SuiManager
     */
    private async handleNetworkChange(network: string, signerType: 'wallet' | 'keypair'): Promise<void> {
        UINotification.info(`正在切换到 ${network}...`);

        // 获取新配置
        const newConfig = SuiEnvConfigManager.instance.getConfig(network as NetworkType, signerType);

        // 完全重新初始化 SuiManager
        // - 停止 EventListener 和 AssetPolling
        // - 清空所有缓存（GameData、Games、Templates、Assets）
        // - 重建 SuiClient（新 RPC URL）
        // - 重新启动服务
        await SuiManager.instance.reinit(newConfig);

        // 如果是 keypair 模式，加载 keypair
        if (signerType === 'keypair') {
            const storageKey = this.input_storageKey?.text.trim() || '';
            const password = this.input_password?.text || '';

            if (storageKey && password) {
                KeystoreConfig.instance.applyConfig(storageKey, password);
                await SuiManager.instance.reloadKeypair();
            }
        }

        UINotification.success(`已切换到 ${network}`);
    }

    // ================== 钱包类型切换（轻量操作）==================

    /**
     * 处理钱包类型切换
     * 影响：_signer、player assets
     * 方法：重新设置 signer，重新加载 assets
     */
    private async handleSignerChange(useKeypair: boolean): Promise<void> {
        if (useKeypair) {
            // 切换到 keypair
            const newStorageKey = this.input_storageKey?.text.trim() || '';
            const newPassword = this.input_password?.text || '';

            if (!newStorageKey || !newPassword) {
                UINotification.warning('请填写 Storage Key 和 Password');
                return;
            }

            // 读取当前配置
            const oldStorageKey = KeystoreConfig.instance.getStorageKey();
            const oldPassword = KeystoreConfig.instance.getPassword();
            const network = SuiManager.instance.config.network as NetworkType;

            const storageKeyChanged = newStorageKey !== oldStorageKey;
            const passwordChanged = newPassword !== oldPassword;

            console.log('[UISuiConfig] Keypair change detection:');
            console.log('  Storage key changed:', storageKeyChanged, `(${oldStorageKey} → ${newStorageKey})`);
            console.log('  Password changed:', passwordChanged);

            // ✅ 场景 3: 同时修改 storageKey 和 password
            if (storageKeyChanged && passwordChanged) {
                console.log('[UISuiConfig] Scenario 3: Both storage key and password changed');
                UINotification.info("正在加载密钥...");

                try {
                    // 1. 尝试用旧 password 加载新 storageKey
                    let keypair = await loadKeypairWithPassword(newStorageKey, oldPassword, network);

                    if (keypair) {
                        // 加载成功，用新 password 重新加密保存
                        console.log('[UISuiConfig] Keypair loaded, re-encrypting with new password');
                        await saveKeypairWithPassword(keypair, newStorageKey, newPassword);
                        UINotification.info("已用新密码重新加密");
                    } else {
                        // 不存在，尝试用新 password 加载（可能之前就用新密码保存的）
                        console.log('[UISuiConfig] Keypair not found with old password, trying new password');
                        keypair = await loadKeypairWithPassword(newStorageKey, newPassword, network);

                        if (!keypair) {
                            // 仍不存在，创建新 keypair（会在 reloadKeypair 中自动创建）
                            console.log('[UISuiConfig] Keypair not found, will create new one');
                        }
                    }
                } catch (error) {
                    console.error('[UISuiConfig] Failed to load/re-encrypt keypair:', error);
                    // 继续执行，reloadKeypair 会处理创建新 keypair
                }
            }
            // ✅ 场景 2: 只修改 password
            else if (passwordChanged) {
                console.log('[UISuiConfig] Scenario 2: Only password changed');
                UINotification.info("正在重新加密密钥...");

                try {
                    // 1. 用旧 password 加载当前 storageKey
                    const keypair = await loadKeypairWithPassword(oldStorageKey, oldPassword, network);

                    if (!keypair) {
                        throw new Error('无法加载现有密钥');
                    }

                    // 2. 用新 password 重新加密保存到相同 storageKey
                    await saveKeypairWithPassword(keypair, oldStorageKey, newPassword);
                    console.log('[UISuiConfig] Keypair re-encrypted successfully');
                    UINotification.success("密码已更新");

                } catch (error) {
                    console.error('[UISuiConfig] Failed to re-encrypt keypair:', error);
                    UINotification.error("密码更新失败：无法加载现有密钥");
                    return;
                }
            }
            // ✅ 场景 1: 只修改 storageKey（或首次切换到 keypair）
            else {
                console.log('[UISuiConfig] Scenario 1: Only storage key changed (or first time)');
                UINotification.info("正在加载密钥...");
            }

            // 应用配置到 KeystoreConfig
            KeystoreConfig.instance.applyConfig(newStorageKey, newPassword);

            // 重新加载 keypair（会使用新的 KeystoreConfig）
            const addressChanged = await SuiManager.instance.reloadKeypair();

            if (addressChanged) {
                const newAddress = SuiManager.instance.currentAddress;
                UINotification.success(`已切换到 Keypair 模式\n${newAddress}`);
            } else {
                UINotification.success("已切换到 Keypair 模式");
            }

        } else {
            // 切换到 wallet
            SuiManager.instance.clearSigner();

            UINotification.info("已切换到 Wallet 模式\n请连接钱包");
        }
    }

    // ================== 关闭按钮 ==================

    /**
     * 关闭按钮点击
     */
    private onClose(): void {
        this.onCancelClick();
    }

    // ================== 工具方法 ==================

    /**
     * 根据 controller index 获取网络名称
     */
    private getEnvName(index: number): NetworkType {
        const networks: NetworkType[] = ['mainnet', 'testnet', 'devnet', 'localnet'];
        return networks[index] || 'testnet';
    }

    /**
     * 根据网络名称获取 controller index
     */
    private getEnvIndex(network: string): number {
        const networks = ['mainnet', 'testnet', 'devnet', 'localnet'];
        const index = networks.indexOf(network);
        return index >= 0 ? index : 1; // 默认 testnet
    }

    // ================== 解绑事件（每次隐藏时调用）==================

    protected unbindEvents(): void {
        // 如果没有绑定过，跳过
        if (!this._eventsBound) {
            console.log('[UISuiConfig] Events not bound, skipping unbind');
            return;
        }

        // 解绑按钮事件
        if (this.btn_cancel) {
            this.btn_cancel.offClick(this.onCancelClick, this);
        }

        if (this.btn_ok) {
            this.btn_ok.offClick(this.onOkClick, this);
        }

        // 解绑 controller 监听
        if (this.envController) {
            this.envController.off(fgui.Event.STATUS_CHANGED, this.onEnvControllerChanged, this);
        }

        this._eventsBound = false;
        console.log('[UISuiConfig] Events unbound');

        super.unbindEvents();
    }
}
