import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { SuiManager } from "../../sui/managers/SuiManager";
import { UINotification } from "../utils/UINotification";
import { KeystoreConfig } from "../../sui/utils/KeystoreConfig";
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

    /** Keypair 配置组件 */
    private m_keyPairInfo: fgui.GComponent | null = null;
    private m_input_storageKey: fgui.GTextInput | null = null;
    private m_input_password: fgui.GTextInput | null = null;
    private m_btn_use: fgui.GButton | null = null;

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

        // 获取 keypair 配置组件
        this.m_keyPairInfo = this.getChild("keyPairInfo")?.asCom || null;
        if (this.m_keyPairInfo) {
            this.m_input_storageKey = this.m_keyPairInfo.getChild("storageKey") as fgui.GTextInput;
            this.m_input_password = this.m_keyPairInfo.getChild("password") as fgui.GTextInput;
            this.m_btn_use = this.m_keyPairInfo.getChild("btn_use") as fgui.GButton;
            console.log('[UIModeSelect] KeyPair config components found');
        } else {
            console.warn('[UIModeSelect] keyPairInfo component not found');
        }
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        // 绑定开始游戏按钮
        this.m_btn_start?.onClick(this._onStartClick, this);

        // 监听游戏开始事件
        EventBus.on(EventTypes.Game.GameStart, this._onGameStart, this);

        // 绑定 keypair 配置按钮事件（不再实时更新，改为点击按钮时应用）
        if (this.m_btn_use) {
            this.m_btn_use.onClick(this._onUseKeypairClick, this);
        }
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        // 解绑按钮事件
        this.m_btn_start?.offClick(this._onStartClick, this);

        // 解绑 keypair 配置按钮事件
        if (this.m_btn_use) {
            this.m_btn_use.offClick(this._onUseKeypairClick, this);
        }

        // 调用父类解绑
        super.unbindEvents();
    }

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        console.log("[UIModeSelect] Showing mode select UI");

        // 根据 signerType 控制 keyPairInfo 显示
        this._updateKeypairInfoVisibility();

        // 加载并显示 keypair 配置
        this._loadKeypairConfig();

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

    // ================== Keypair 配置管理 ==================

    /**
     * 更新 keyPairInfo 组件的显示状态
     */
    private _updateKeypairInfoVisibility(): void {
        if (!this.m_keyPairInfo) return;

        // 只在 keypair 模式下显示
        const config = SuiManager.instance.config;
        const isKeypairMode = config?.signerType === 'keypair';

        this.m_keyPairInfo.visible = isKeypairMode;

        console.log('[UIModeSelect] KeyPairInfo visibility updated');
        console.log('  Signer type:', config?.signerType);
        console.log('  Visible:', isKeypairMode);
    }

    /**
     * 加载 keypair 配置到输入框
     */
    private _loadKeypairConfig(): void {
        if (!this.m_input_storageKey || !this.m_input_password) {
            return;
        }

        const config = KeystoreConfig.instance;
        this.m_input_storageKey.text = config.getStorageKey();
        this.m_input_password.text = config.getPassword();

        console.log('[UIModeSelect] Keypair config loaded to UI');
        console.log('  Storage key:', config.getStorageKey());
        console.log('  Full key:', config.getFullStorageKey());
    }

    /**
     * "使用"按钮点击 - 应用配置并重新加载 keypair
     */
    private async _onUseKeypairClick(): Promise<void> {
        if (!this.m_input_storageKey || !this.m_input_password) {
            console.warn('[UIModeSelect] Input fields not ready');
            return;
        }

        const newStorageKey = this.m_input_storageKey.text.trim();
        const newPassword = this.m_input_password.text;

        console.log('[UIModeSelect] Apply keypair config clicked');
        console.log('  Storage key:', newStorageKey);

        // 禁用按钮（防止重复点击）
        if (this.m_btn_use) {
            this.m_btn_use.enabled = false;
        }

        try {
            // 1. 应用配置
            KeystoreConfig.instance.applyConfig(newStorageKey, newPassword);

            // 2. 重新加载 keypair
            UINotification.info("正在加载密钥...");
            const addressChanged = await SuiManager.instance.reloadKeypair();

            // 3. 根据结果提示
            if (addressChanged) {
                const newAddress = SuiManager.instance.currentAddress;
                UINotification.success(`已切换到新账号\n${newAddress}`);
            } else {
                UINotification.info("配置已更新（账号未变）");
            }

        } catch (error) {
            console.error('[UIModeSelect] Failed to apply keypair config:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            UINotification.error(`配置应用失败：${errorMsg}`);
        } finally {
            // 重新启用按钮
            if (this.m_btn_use) {
                this.m_btn_use.enabled = true;
            }
        }
    }
}