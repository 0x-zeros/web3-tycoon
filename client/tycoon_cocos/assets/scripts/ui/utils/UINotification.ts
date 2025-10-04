import { _decorator, Color } from 'cc';
import { UIBase } from "../core/UIBase";
import * as fgui from "fairygui-cc";

const { ccclass } = _decorator;

// ==================== 类型定义 ====================

/**
 * 通知图标类型
 */
export enum NotifyIcon {
    NONE = "none",
    INFO = "info",
    SUCCESS = "success",
    WARNING = "warning",
    ERROR = "error",
    CUSTOM = "custom"
}

/**
 * 通知类型（决定背景色）
 */
export enum NotifyType {
    INFO = "info",
    SUCCESS = "success",
    WARNING = "warning",
    ERROR = "error",
    DEFAULT = "default"
}

/**
 * 通知配置选项
 */
export interface NotificationOptions {
    /** 标题（可选） */
    title?: string;
    /** 消息内容（支持富文本） */
    message: string;
    /** 图标类型或自定义URL */
    icon?: NotifyIcon | string;
    /** 显示时长（毫秒，默认2000） */
    duration?: number;
    /** 通知类型（决定背景色） */
    type?: NotifyType;
}

// ==================== Toast封装类 ====================

/**
 * 单个Toast通知的封装类
 * 管理单个通知的完整生命周期：创建、显示、动画、自动消失、销毁
 */
class NotificationToast {
    private _gObject: fgui.GComponent;
    private _timerId: number | null = null;
    private _onDestroy?: () => void;

    // 通知类型颜色映射（0xAARRGGBB格式）
    private static readonly COLOR_MAP: Record<NotifyType, number> = {
        [NotifyType.INFO]: 0xCC4A90E2,      // 蓝色 (80%透明度)
        [NotifyType.SUCCESS]: 0xCC7ED321,   // 绿色
        [NotifyType.WARNING]: 0xCCF5A623,   // 黄色
        [NotifyType.ERROR]: 0xCCD0021B,     // 红色
        [NotifyType.DEFAULT]: 0xCC6699CC    // 紫蓝色
    };

    /**
     * 构造函数
     * @param options 通知配置
     * @param onDestroy 销毁回调
     */
    constructor(options: NotificationOptions, onDestroy?: () => void) {
        this._onDestroy = onDestroy;

        // 创建GObject（不使用对象池，每次创建新对象）
        this._gObject = fgui.UIPackage.createObject("Common", "NotifyToast").asCom;

        // 设置内容
        this._setupContent(options);

        // 启动自动消失定时器
        const duration = options.duration ?? 2000;
        this._startAutoHide(duration);
    }

    /**
     * 设置Toast内容
     */
    private _setupContent(options: NotificationOptions): void {
        const bg = this._gObject.getChild("bg") as fgui.GGraph;
        const msg = this._gObject.getChild("message") as fgui.GRichTextField;

        // 设置背景颜色
        if (bg && options.type) {
            const colorHex = NotificationToast.COLOR_MAP[options.type] || NotificationToast.COLOR_MAP[NotifyType.DEFAULT];
            const color = this._hexToColor(colorHex);
            bg.drawRect(0, new Color(0, 0, 0, 0), color);
        }

        // 设置消息文本（如果有title，合并显示）
        if (msg) {
            const text = options.title
                ? `【${options.title}】 ${options.message}`
                : options.message;
            msg.text = text;
        }
    }

    /**
     * 16进制颜色转Color对象
     */
    private _hexToColor(hex: number): Color {
        const a = ((hex >> 24) & 0xFF);
        const r = ((hex >> 16) & 0xFF);
        const g = ((hex >> 8) & 0xFF);
        const b = (hex & 0xFF);
        return new Color(r, g, b, a);
    }

    /**
     * 播放进入动画（淡入）
     */
    public playEnterAnimation(): void {
        this._gObject.alpha = 0;
        fgui.GTween.to(0, 1, 0.3)
            .setTarget(this._gObject, this._gObject)
            .setEase(fgui.EaseType.QuadOut);
    }

    /**
     * 启动自动消失定时器
     */
    private _startAutoHide(duration: number): void {
        this._timerId = window.setTimeout(() => {
            this._timerId = null;
            this.destroy();
        }, duration);
    }

    /**
     * 销毁Toast
     */
    public destroy(): void {
        // 清除定时器
        if (this._timerId !== null) {
            clearTimeout(this._timerId);
            this._timerId = null;
        }

        // 播放退出动画后销毁
        fgui.GTween.to(this._gObject.alpha, 0, 0.3)
            .setTarget(this._gObject)
            .setEase(fgui.EaseType.QuadIn)
            .onComplete(() => {
                // 完全销毁（不回收到对象池）
                this._gObject.dispose();

                // 通知父容器
                if (this._onDestroy) {
                    this._onDestroy();
                }
            });
    }

    /**
     * 获取GObject
     */
    public get gObject(): fgui.GComponent {
        return this._gObject;
    }
}

// ==================== UINotification主类 ====================

/**
 * 通知组件
 * 管理Toast通知的容器和布局
 */
@ccclass('UINotification')
export class UINotification extends UIBase {
    // Toast实例数组
    private _toasts: NotificationToast[] = [];

    // 容器组件（使用NotifyCenter的messages容器）
    private _container: fgui.GComponent | null = null;

    // 最大同时显示数量
    private static readonly MAX_NOTIFICATIONS = 5;

    // 通知间距（像素）
    private static readonly SPACING = 10;

    // 静态单例实例
    private static _instance: UINotification | null = null;

    // ==================== 生命周期 ====================

    protected onInit(): void {
        // 获取容器（NotifyCenter组件的messages节点）
        this._container = this.panel?.getChild("messages")?.asCom || this.panel;

        if (!this._container) {
            console.error("[UINotification] Container not found");
            return;
        }

        // 设置容器属性：不拦截点击，允许透传
        if (this.panel) {
            this.panel.touchable = false;
            this.panel.opaque = false;
        }

        console.log("[UINotification] Initialized");

        // 设置静态实例
        UINotification._instance = this;
    }

    protected onShow(_data?: any): void {
        // 通知中心始终显示，不需要特殊处理
    }

    protected onHide(): void {
        this.clearAll();
    }

    protected onDestroy(): void {
        this.clearAll();
        UINotification._instance = null;
        super.onDestroy();
    }

    // ==================== 通知管理 ====================

    /**
     * 添加新通知
     */
    public addNotification(options: NotificationOptions): void {
        if (!this._container) {
            console.error("[UINotification] Container not available");
            return;
        }

        // 检查数量限制，移除最旧的
        if (this._toasts.length >= UINotification.MAX_NOTIFICATIONS) {
            const oldest = this._toasts.shift();
            if (oldest) {
                oldest.destroy();
            }
        }

        // 创建Toast实例（封装了所有生命周期管理）
        const toast = new NotificationToast(options, () => {
            // Toast自己销毁时，从数组移除
            const index = this._toasts.indexOf(toast);
            if (index !== -1) {
                this._toasts.splice(index, 1);
                // 重新布局剩余的通知
                this._relayout();
            }
        });

        // 添加到容器
        this._container.addChild(toast.gObject);

        // 记录到数组
        this._toasts.push(toast);

        // 重新布局所有通知
        this._relayout();

        // 播放进入动画
        toast.playEnterAnimation();

        console.log(`[UINotification] Added notification: ${options.message}`);
    }

    /**
     * 重新布局所有通知（垂直堆叠）
     */
    private _relayout(): void {
        let y = 0;
        this._toasts.forEach(toast => {
            toast.gObject.x = 0;
            toast.gObject.y = y;
            y += toast.gObject.height + UINotification.SPACING;
        });
    }

    /**
     * 清除所有通知
     */
    public clearAll(): void {
        // 销毁所有Toast
        this._toasts.forEach(toast => toast.destroy());
        this._toasts = [];
    }

    // ==================== 静态便捷方法 ====================

    /**
     * 获取实例
     */
    private static _getInstance(): UINotification | null {
        if (!UINotification._instance) {
            console.error("[UINotification] Not initialized. Register Notification UI first.");
        }
        return UINotification._instance;
    }

    /**
     * 信息通知（蓝色）
     */
    public static info(message: string, title?: string, duration?: number): void {
        const instance = this._getInstance();
        if (instance) {
            instance.addNotification({
                title,
                message,
                type: NotifyType.INFO,
                duration
            });
        }
    }

    /**
     * 成功通知（绿色）
     */
    public static success(message: string, title?: string, duration?: number): void {
        const instance = this._getInstance();
        if (instance) {
            instance.addNotification({
                title,
                message,
                type: NotifyType.SUCCESS,
                duration
            });
        }
    }

    /**
     * 警告通知（黄色）
     */
    public static warning(message: string, title?: string, duration?: number): void {
        const instance = this._getInstance();
        if (instance) {
            instance.addNotification({
                title,
                message,
                type: NotifyType.WARNING,
                duration
            });
        }
    }

    /**
     * 错误通知（红色）
     */
    public static error(message: string, title?: string, duration?: number): void {
        const instance = this._getInstance();
        if (instance) {
            instance.addNotification({
                title,
                message,
                type: NotifyType.ERROR,
                duration
            });
        }
    }

    /**
     * 自定义通知
     */
    public static show(options: NotificationOptions): void {
        const instance = this._getInstance();
        if (instance) {
            instance.addNotification(options);
        }
    }

    /**
     * 清除所有通知
     */
    public static clearAll(): void {
        const instance = this._getInstance();
        if (instance) {
            instance.clearAll();
        }
    }
}
