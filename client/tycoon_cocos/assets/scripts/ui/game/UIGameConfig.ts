/**
 * UIGameConfig - 游戏配置界面
 *
 * 功能：
 * 1. 切换 RPC 限速模式（default / ratelimit）
 * 2. 设置自定义 RPC URL
 */

import { _decorator } from 'cc';
import { UIBase } from '../core/UIBase';
import { UILayer } from '../core/UITypes';
import { UINotification } from '../utils/UINotification';
import { UIMessage } from '../utils/UIMessage';
import { RpcConfigManager } from '../../sui/config/RpcConfigManager';
import { SuiManager } from '../../sui/managers/SuiManager';
import { getNetworkRpcUrl } from '../../sui/config/SuiConfig';

const { ccclass } = _decorator;

@ccclass('UIGameConfig')
export class UIGameConfig extends UIBase {
    // FairyGUI 组件引用
    private btn_rateLimitRPC!: fgui.GButton;
    private btn_useCustomPRC!: fgui.GButton;
    private rpcUrl!: fgui.GTextField;
    private btn_close!: fgui.GButton;

    /**
     * UI 包名和组件名
     */
    protected static override getPackageName(): string {
        return 'Common';
    }

    protected static override getComponentName(): string {
        return 'GameConfig';
    }

    /**
     * 初始化（绑定组件）
     */
    protected onInit(): void {
        // 绑定 FairyGUI 组件（使用 UIBase 提供的辅助方法）
        this.btn_rateLimitRPC = this.getButton('btn_rateLimitRPC')!;
        this.btn_useCustomPRC = this.getButton('btn_useCustomPRC')!;
        this.rpcUrl = this.getText('rpcUrl')!;
        this.btn_close = this.getButton('btn_close')!;

        // 绑定事件
        this.btn_rateLimitRPC.onClick(this.onToggleRateLimit, this);
        this.btn_useCustomPRC.onClick(this.onApplyCustomRpc, this);
        this.btn_close.onClick(this.onClose, this);

        console.log('[UIGameConfig] Initialized');
    }

    /**
     * 显示时加载当前配置
     */
    protected onShow(): void {
        this.loadCurrentConfig();
    }

    /**
     * 加载当前配置到 UI
     */
    private loadCurrentConfig(): void {
        // 加载限速模式
        const mode = RpcConfigManager.getMode();
        this.btn_rateLimitRPC.selected = (mode === 'ratelimit');

        // 只显示自定义 RPC，没有则留空
        const customRpc = RpcConfigManager.getCustomRpcUrl();
        this.rpcUrl.text = customRpc || '';

        console.log('[UIGameConfig] Loaded config:', { mode, customRpc });
    }

    /**
     * 切换 RPC 限速模式
     */
    private onToggleRateLimit(): void {
        const isRateLimit = this.btn_rateLimitRPC.selected;
        const newMode = isRateLimit ? 'ratelimit' : 'default';

        RpcConfigManager.setMode(newMode);

        console.log('[UIGameConfig] Mode changed to:', newMode);

        // 简洁提示
        if (isRateLimit) {
            UINotification.success('限速模式已启用');
        } else {
            UINotification.success('限速模式已取消');
        }
    }

    /**
     * 应用自定义 RPC
     */
    private onApplyCustomRpc(): void {
        const url = this.rpcUrl.text.trim();

        // 验证 URL 格式
        if (url && !url.startsWith('http')) {
            UINotification.error('RPC URL 必须以 http:// 或 https:// 开头');
            return;
        }

        RpcConfigManager.setCustomRpc(url || undefined);

        const message = url
            ? `自定义 RPC 已保存：\n\n${url}\n\n刷新页面后生效`
            : '已清除自定义 RPC，将使用默认 RPC\n\n刷新页面后生效';

        console.log('[UIGameConfig] Custom RPC set to:', url || 'none');
        UIMessage.success(message, '配置已保存');
    }

    /**
     * 关闭界面
     */
    private onClose(): void {
        // 通过 parent 的 visible 控制（因为现在是 CommonLayout 的子组件）
        if (this.panel) {
            this.panel.visible = false;
            console.log('[UIGameConfig] Closed (set visible = false)');
        }
    }
}
