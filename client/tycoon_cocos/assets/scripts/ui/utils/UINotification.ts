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
    private _onDestroy?: () => void;

    // 通知类型颜色映射（0xAARRGGBB格式）- 约45%不透明度
    private static readonly COLOR_MAP: Record<NotifyType, number> = {
        [NotifyType.INFO]: 0x734A90E2,      // 蓝色 (~45% 不透明)
        [NotifyType.SUCCESS]: 0x737ED321,   // 绿色
        [NotifyType.WARNING]: 0x73F5A623,   // 黄色
        [NotifyType.ERROR]: 0x73D0021B,     // 红色
        [NotifyType.DEFAULT]: 0x736699CC    // 紫蓝色
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

        // 定时由 UINotification 统一调度（scheduleOnce），此处不再启动计时
    }

    /**
     * 设置Toast内容
     */
    private _setupContent(options: NotificationOptions): void {
        const bg = (this._gObject.getChild("bg") as fgui.GGraph) || this._findFirstGraph(this._gObject);
        const msg = this._findFirstText(this._gObject);

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
            (msg as any).text = text;
        }
    }

    /** 递归查找第一个文本控件（Rich 或普通） */
    private _findFirstText(root: fgui.GComponent): fgui.GTextField | fgui.GRichTextField | null {
        const stack: fgui.GObject[] = [root];
        while (stack.length) {
            const cur = stack.pop()!;
            if (cur instanceof fgui.GRichTextField) return cur;
            if (cur instanceof fgui.GTextField) return cur;
            const com = (cur as fgui.GComponent).asCom;
            if (com) {
                for (let i = 0; i < com.numChildren; i++) {
                    stack.push(com.getChildAt(i));
                }
            }
        }
        return null;
    }

    /** 递归查找第一个 GGraph */
    private _findFirstGraph(root: fgui.GComponent): fgui.GGraph | null {
        const stack: fgui.GObject[] = [root];
        while (stack.length) {
            const cur = stack.pop()!;
            if (cur instanceof fgui.GGraph) return cur;
            const com = (cur as fgui.GComponent).asCom;
            if (com) {
                for (let i = 0; i < com.numChildren; i++) {
                    stack.push(com.getChildAt(i));
                }
            }
        }
        return null;
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
        fgui.GTween
            .to(0, 1, 0.3)
            .setEase(fgui.EaseType.QuadOut)
            .setTarget(this._gObject)
            .onUpdate((tweener: fgui.GTweener) => {
                this._gObject.alpha = tweener.value.x;
            });
    }

    /**
     * 销毁Toast
     */
    public destroy(): void {
        // 播放退出动画后销毁
        fgui.GTween
            .to(this._gObject.alpha, 0, 0.3)
            .setEase(fgui.EaseType.QuadIn)
            .setTarget(this._gObject)
            .onUpdate((tweener: fgui.GTweener) => {
                this._gObject.alpha = tweener.value.x;
            })
            .onComplete(() => {
                // 完全销毁（不回收到对象池）
                this._gObject.dispose();

                // 通知父容器
                if (this._onDestroy) {
                    this._onDestroy();
                }
            });
    }

    /** 主动关闭 */
    public close(): void {
        this.destroy();
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
    // 自动消失取消器
    private _autoHideCancels: Map<NotificationToast, () => void> = new Map();

    // 容器组件（使用NotifyCenter的messages容器）
    private _container: fgui.GComponent | null = null;

    // 最大同时显示数量
    private static readonly MAX_NOTIFICATIONS = 5;

    // 通知间距（像素）——按需改为无间隔
    private static readonly SPACING = 0;

    // 静态单例实例
    private static _instance: UINotification | null = null;

    // 默认使用的anchor名称
    private static readonly DEFAULT_ANCHOR = "rightbottom";
    private _currentAnchor = UINotification.DEFAULT_ANCHOR;

    // ==================== 生命周期 ====================

    protected onInit(): void {
        // 所有anchor名称
        const anchorNames = ["lefttop", "righttop", "center", "leftbottom", "rightbottom"];

        // 设置所有anchor为不拦截点击
        anchorNames.forEach(name => {
            const anchor = this.panel?.getChild(name);
            if (anchor) {
                anchor.touchable = false;
                anchor.opaque = false;
            }
        });

        // 使用panel作为容器（anchor只是位置标记）
        this._container = this.panel;

        if (!this._container) {
            console.error("[UINotification] Panel not found");
            return;
        }

        // 设置panel不拦截点击
        this._container.touchable = false;
        this._container.opaque = false;

        console.log("[UINotification] Initialized with anchor:", this._currentAnchor);

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
                this._cancelAutoHide(oldest);
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

        // 调度自动消失
        const durationMs = options.duration ?? 2000;
        const seconds = Math.max(0, durationMs) / 1000;
        const cb = () => {
            this._autoHideCancels.delete(toast);
            toast.destroy();
        };
        this.scheduleOnce(cb, seconds);
        this._autoHideCancels.set(toast, () => this.unschedule(cb));

        // 重新布局所有通知
        this._relayout();

        // 播放进入动画
        toast.playEnterAnimation();

        console.log(`[UINotification] Added notification: ${options.message}`);
    }

    /**
     * 重新布局所有通知（垂直堆叠）
     * 基于当前anchor的位置计算toast坐标
     */
    private _relayout(): void {
        // 获取当前anchor的位置作为起点
        const anchor = this.panel?.getChild(this._currentAnchor);
        if (!anchor) {
            console.warn("[UINotification] Anchor not found:", this._currentAnchor);
            return;
        }

        let offsetY = 0;
        this._toasts.forEach(toast => {
            // Toast位置 = anchor位置 + 偏移
            toast.gObject.x = anchor.x;
            toast.gObject.y = anchor.y + offsetY;
            offsetY += toast.gObject.height + UINotification.SPACING;
        });
    }

    /**
     * 清除所有通知
     */
    public clearAll(): void {
        // 销毁所有Toast
        this._toasts.forEach(toast => {
            this._cancelAutoHide(toast);
            toast.destroy();
        });
        this._toasts = [];
    }

    /** 取消某个 toast 的自动隐藏调度 */
    private _cancelAutoHide(toast: NotificationToast): void {
        const cancel = this._autoHideCancels.get(toast);
        if (cancel) {
            try { cancel(); } catch {}
            this._autoHideCancels.delete(toast);
        }
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

    /**
     * 设置通知显示位置
     * @param anchorName anchor节点名称
     */
    public static setAnchor(anchorName: "lefttop" | "righttop" | "center" | "leftbottom" | "rightbottom"): void {
        const instance = this._getInstance();
        if (instance && instance.panel) {
            const anchor = instance.panel.getChild(anchorName);
            if (anchor) {
                // 切换anchor
                instance._currentAnchor = anchorName;

                // 重新布局现有通知（移动到新位置）
                instance._relayout();

                console.log("[UINotification] Switched to anchor:", anchorName);
            } else {
                console.error("[UINotification] Anchor not found:", anchorName);
            }
        }
    }
}
