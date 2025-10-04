import { _decorator } from 'cc';
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
    /** 显示时长（毫秒，默认3000） */
    duration?: number;
    /** 通知类型（决定背景色） */
    type?: NotifyType;
}

/**
 * 通知项（内部使用）
 */
interface NotificationItem {
    /** FairyGUI对象 */
    gObject: fgui.GObject;
    /** 自动消失定时器 */
    timer: number | null;
    /** 配置选项 */
    options: NotificationOptions;
}

// ==================== UINotification类 ====================

/**
 * 通知组件
 * 管理Toast通知的显示、动画和自动消失
 */
@ccclass('UINotification')
export class UINotification extends UIBase {
    // GList容器引用
    private _messagesList: fgui.GList | null = null;

    // 通知项数组
    private _notifications: NotificationItem[] = [];

    // 最大同时显示数量
    private static readonly MAX_NOTIFICATIONS = 5;

    // 默认显示时长（毫秒）
    private static readonly DEFAULT_DURATION = 3000;

    // 静态单例实例（用于全局访问）
    private static _instance: UINotification | null = null;

    // Icon URL映射
    private static readonly ICON_MAP: Record<NotifyIcon, string> = {
        [NotifyIcon.NONE]: "",
        [NotifyIcon.INFO]: "ui://Common/icon_info",
        [NotifyIcon.SUCCESS]: "ui://Common/icon_success",
        [NotifyIcon.WARNING]: "ui://Common/icon_warning",
        [NotifyIcon.ERROR]: "ui://Common/icon_error",
        [NotifyIcon.CUSTOM]: ""
    };

    // 通知类型颜色映射
    private static readonly TYPE_COLOR_MAP: Record<NotifyType, number> = {
        [NotifyType.INFO]: 0xFF4A90E2,      // 蓝色
        [NotifyType.SUCCESS]: 0xFF7ED321,   // 绿色
        [NotifyType.WARNING]: 0xFFF5A623,   // 黄色
        [NotifyType.ERROR]: 0xFFD0021B,     // 红色
        [NotifyType.DEFAULT]: 0xFF6699CC    // 默认紫蓝色
    };

    // ==================== 生命周期 ====================

    protected onInit(): void {
        // 获取GList容器
        this._messagesList = this.getList("messages");

        if (!this._messagesList) {
            console.error("[UINotification] Messages list not found");
            return;
        }

        // 设置列表属性
        this._messagesList.scrollPane.touchEffect = false; // 禁用触摸效果，让通知不可交互
        this._messagesList.setVirtual(); // 不使用虚拟列表

        console.log("[UINotification] Initialized");

        // 设置静态实例
        UINotification._instance = this;
    }

    protected onShow(data?: any): void {
        console.log("[UINotification] Showing notification center");
    }

    protected onHide(): void {
        // 清除所有通知
        this.clearAll();
    }

    protected onDestroy(): void {
        // 清除所有通知和定时器
        this.clearAll();
        UINotification._instance = null;
        super.onDestroy();
    }

    // ==================== 通知管理 ====================

    /**
     * 添加新通知
     */
    public addNotification(options: NotificationOptions): void {
        if (!this._messagesList) {
            console.error("[UINotification] Messages list not available");
            return;
        }

        // 检查数量限制，移除最旧的通知
        if (this._notifications.length >= UINotification.MAX_NOTIFICATIONS) {
            this._removeOldestNotification();
        }

        // 创建NotifyToast对象
        const toast = this._messagesList.addItemFromPool() as fgui.GComponent;
        if (!toast) {
            console.error("[UINotification] Failed to create toast");
            return;
        }

        // 设置通知内容
        this._setupToast(toast, options);

        // 添加到列表顶部（index 0）
        this._messagesList.addChildAt(toast, 0);

        // 播放进入动画
        this._playEnterAnimation(toast);

        // 启动自动消失定时器
        const timer = this._startAutoHideTimer(toast, options);

        // 记录通知项
        this._notifications.push({
            gObject: toast,
            timer: timer,
            options: options
        });

        console.log(`[UINotification] Added notification: ${options.message}`);
    }

    /**
     * 设置Toast内容
     */
    private _setupToast(toast: fgui.GComponent, options: NotificationOptions): void {
        // 获取子元素
        const bgGraph = toast.getChild("bg") as fgui.GGraph;
        const iconLoader = toast.getChild("icon") as fgui.GLoader;
        const titleText = toast.getChild("title") as fgui.GTextField;
        const messageRichText = toast.getChild("message") as fgui.GRichTextField;

        // 设置背景颜色
        if (bgGraph && options.type) {
            const color = UINotification.TYPE_COLOR_MAP[options.type] || UINotification.TYPE_COLOR_MAP[NotifyType.DEFAULT];
            bgGraph.drawRect(0, color, null);
        }

        // 设置Icon
        if (iconLoader) {
            if (options.icon && options.icon !== NotifyIcon.NONE) {
                // 判断是预设类型还是自定义URL
                const iconKeys = Object.values(NotifyIcon);
                if (iconKeys.includes(options.icon as NotifyIcon)) {
                    const iconUrl = UINotification.ICON_MAP[options.icon as NotifyIcon];
                    if (iconUrl) {
                        iconLoader.url = iconUrl;
                        iconLoader.visible = true;
                    } else {
                        iconLoader.visible = false;
                    }
                } else {
                    // 自定义URL
                    iconLoader.url = options.icon as string;
                    iconLoader.visible = true;
                }
            } else {
                iconLoader.visible = false;
            }
        }

        // 设置标题
        if (titleText) {
            if (options.title) {
                titleText.text = options.title;
                titleText.visible = true;
            } else {
                titleText.visible = false;
            }
        }

        // 设置消息
        if (messageRichText) {
            messageRichText.text = options.message;
        }
    }

    /**
     * 播放进入动画（从右侧滑入 + 淡入）
     */
    private _playEnterAnimation(toast: fgui.GObject): void {
        // 设置初始状态
        const originalX = toast.x;
        toast.x = originalX + 100;
        toast.alpha = 0;

        // 动画到目标位置
        fgui.GTween.to2(originalX, 1)
            .setTarget(toast, toast)
            .setDuration(0.3)
            .setEase(fgui.EaseType.QuadOut);
    }

    /**
     * 播放退出动画（向上滑动 + 淡出）
     */
    private _playExitAnimation(toast: fgui.GObject, onComplete: () => void): void {
        const targetY = toast.y - 50;

        fgui.GTween.to2(targetY, 0)
            .setTarget(toast, toast)
            .setDuration(0.3)
            .setEase(fgui.EaseType.QuadIn)
            .onComplete(() => {
                onComplete();
            });
    }

    /**
     * 启动自动消失定时器
     */
    private _startAutoHideTimer(toast: fgui.GObject, options: NotificationOptions): number {
        const duration = options.duration || UINotification.DEFAULT_DURATION;

        return window.setTimeout(() => {
            this.removeNotification(toast);
        }, duration);
    }

    /**
     * 移除通知
     */
    public removeNotification(toast: fgui.GObject): void {
        // 查找通知项
        const index = this._notifications.findIndex(item => item.gObject === toast);
        if (index === -1) {
            return;
        }

        const item = this._notifications[index];

        // 清除定时器
        if (item.timer !== null) {
            clearTimeout(item.timer);
            item.timer = null;
        }

        // 播放退出动画
        this._playExitAnimation(toast, () => {
            // 从列表移除
            if (this._messagesList) {
                this._messagesList.removeChild(toast, true); // true表示回收到对象池
            }

            // 从数组移除
            this._notifications.splice(index, 1);

            console.log(`[UINotification] Removed notification`);
        });
    }

    /**
     * 移除最旧的通知
     */
    private _removeOldestNotification(): void {
        if (this._notifications.length > 0) {
            const oldest = this._notifications[0];
            this.removeNotification(oldest.gObject);
        }
    }

    /**
     * 清除所有通知
     */
    public clearAll(): void {
        // 复制数组避免迭代时修改
        const items = [...this._notifications];

        items.forEach(item => {
            if (item.timer !== null) {
                clearTimeout(item.timer);
            }
        });

        this._notifications = [];

        if (this._messagesList) {
            this._messagesList.removeChildrenToPool();
        }

        console.log("[UINotification] Cleared all notifications");
    }

    // ==================== 静态便捷方法 ====================

    /**
     * 获取通知中心实例
     */
    private static _getInstance(): UINotification | null {
        if (!UINotification._instance) {
            console.error("[UINotification] Instance not initialized. Make sure to register and show NotificationCenter first.");
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
                icon: NotifyIcon.INFO,
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
                icon: NotifyIcon.SUCCESS,
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
                icon: NotifyIcon.WARNING,
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
                icon: NotifyIcon.ERROR,
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
