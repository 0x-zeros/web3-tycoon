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
    /** 自动消失取消器（schedule/timeout通用） */
    cancel?: (() => void) | null;
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
    private static readonly DEFAULT_DURATION = 2000;

    // 静态单例实例（用于全局访问）
    private static _instance: UINotification | null = null;

    // 通知类型颜色映射
    // 使用半透明的淡色（AA为透明度）
    private static readonly TYPE_COLOR_MAP: Record<NotifyType, number> = {
        [NotifyType.INFO]: 0x334A90E2,      // 淡蓝色 (~20% 透明)
        [NotifyType.SUCCESS]: 0x337ED321,   // 淡绿色
        [NotifyType.WARNING]: 0x33F5A623,   // 淡黄色
        [NotifyType.ERROR]: 0x33D0021B,     // 淡红色
        [NotifyType.DEFAULT]: 0x336699CC    // 淡紫蓝色
    };

    // ==================== 生命周期 ====================

    protected onInit(): void {
        // 获取GList容器
        this._messagesList = this.getList("messages");

        if (!this._messagesList) {
            console.error("[UINotification] Messages list not found");
            return;
        }

        // 面板不拦截点击，允许透传到底层UI
        if (this.panel) {
            this.panel.touchable = false;
            this.panel.opaque = false;
        }

        // 设置列表属性
        this._messagesList.scrollPane.touchEffect = false; // 禁用触摸效果，让通知不可交互
        // 使用实体列表，便于直接 addItemFromPool 管理条目
        // this._messagesList.setVirtual();

        // 确保通知层在较高的排序层级，避免被其他全屏UI遮挡
        if (this.panel) {
            this.panel.sortingOrder = 1000;
        }

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

        // 确保通知层始终位于最顶层
        if (this.panel && this.panel.parent) {
            const parent = this.panel.parent;
            parent.setChildIndex(this.panel, parent.numChildren - 1);
        }

        // 检查数量限制，移除最旧的通知
        if (this._notifications.length >= UINotification.MAX_NOTIFICATIONS) {
            this._removeOldestNotification();
        }

        // 创建NotifyToast对象并添加到列表
        const toast = this._messagesList.addItemFromPool() as fgui.GComponent;
        if (!toast) {
            console.error("[UINotification] Failed to create toast");
            return;
        }

        // 设置通知内容
        this._setupToast(toast, options);

        // 移动到列表顶部（最新的通知在上方）
        this._messagesList.setChildIndex(toast, 0);

        // 播放进入动画
        this._playEnterAnimation(toast);

        // 启动自动消失定时器
        const cancel = this._startAutoHideTimer(toast, options);

        // 记录通知项
        this._notifications.push({
            gObject: toast,
            cancel: cancel,
            options: options
        });

        console.log(`[UINotification] Added notification: ${options.message}`);
    }

    /**
     * 将16进制颜色值转换为Color对象
     * @param hex 16进制颜色值（0xAARRGGBB格式）
     */
    private _hexToColor(hex: number): Color {
        const a = ((hex >> 24) & 0xFF) / 255;
        const r = ((hex >> 16) & 0xFF) / 255;
        const g = ((hex >> 8) & 0xFF) / 255;
        const b = (hex & 0xFF) / 255;
        return new Color(r * 255, g * 255, b * 255, a * 255);
    }

    /**
     * 设置Toast内容
     * 注意：NotifyToast模板只包含bg和message两个节点
     */
    private _setupToast(toast: fgui.GComponent, options: NotificationOptions): void {
        // 获取子元素
        const bgGraph = toast.getChild("bg") as fgui.GGraph;
        const messageRichText = toast.getChild("message") as fgui.GRichTextField;

        // 设置背景颜色
        if (bgGraph && options.type) {
            const colorHex = UINotification.TYPE_COLOR_MAP[options.type] || UINotification.TYPE_COLOR_MAP[NotifyType.DEFAULT];
            const color = this._hexToColor(colorHex);
            // 参数：lineSize=0(无边框), lineColor=透明色, fillColor=color
            bgGraph.drawRect(0, new Color(0, 0, 0, 0), color);
        }

        // 设置消息（如果有title，合并到消息中显示）
        if (messageRichText) {
            const text = options.title
                ? `【${options.title}】 ${options.message}`
                : options.message;
            messageRichText.text = text;
        }
    }

    /**
     * 播放进入动画（从右侧滑入 + 淡入）
     */
    private _playEnterAnimation(toast: fgui.GObject): void {
        // 设置初始状态
        const targetX = toast.x;
        toast.x = targetX + 100;
        toast.alpha = 0;

        // 动画到目标位置（x 与 alpha 同步）
        fgui.GTween
            .to2(toast.x, toast.alpha, targetX, 1, 0.3)
            .setEase(fgui.EaseType.QuadOut)
            .setTarget(toast)
            .onUpdate((tweener: fgui.GTweener) => {
                toast.x = tweener.value.x;
                toast.alpha = tweener.value.y;
            });
    }

    /**
     * 播放退出动画（向上滑动 + 淡出）
     */
    private _playExitAnimation(toast: fgui.GObject, onComplete: () => void): void {
        const startY = toast.y;
        const targetY = startY - 50;

        fgui.GTween
            .to2(startY, toast.alpha, targetY, 0, 0.3)
            .setEase(fgui.EaseType.QuadIn)
            .setTarget(toast)
            .onUpdate((tweener: fgui.GTweener) => {
                toast.y = tweener.value.x;
                toast.alpha = tweener.value.y;
            })
            .onComplete(() => {
                onComplete();
            });
    }

    /**
     * 启动自动消失定时器
     */
    private _startAutoHideTimer(toast: fgui.GObject, options: NotificationOptions): () => void {
        const durationMs = options.duration ?? UINotification.DEFAULT_DURATION;
        const seconds = Math.max(0, durationMs) / 1000; // 使用引擎时钟，单位秒

        // 使用 Cocos 的调度器，避免浏览器 setTimeout 在某些平台/失焦时不精准
        const cb = () => {
            this.removeNotification(toast);
        };
        this.scheduleOnce(cb, seconds);

        // 返回取消方法
        return () => {
            this.unschedule(cb);
        };
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
        if (item.cancel) {
            try { item.cancel(); } catch { /* ignore */ }
            item.cancel = null;
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
            if (item.cancel) {
                try { item.cancel(); } catch { /* ignore */ }
                item.cancel = null;
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
