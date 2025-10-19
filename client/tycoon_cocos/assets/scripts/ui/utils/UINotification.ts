import { _decorator, Color } from 'cc';
import { UIBase } from "../core/UIBase";
import * as fgui from "fairygui-cc";

const { ccclass } = _decorator;

// ==================== 类型定义 ====================

/**
 * Anchor位置类型
 */
export type AnchorPosition = "lefttop" | "righttop" | "center" | "leftbottom" | "rightbottom";

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
    private _isBottomToTop: boolean;

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
     * @param isBottomToTop 是否从下往上堆叠（决定退出动画方向）
     * @param onDestroy 销毁回调
     */
    constructor(options: NotificationOptions, isBottomToTop: boolean, onDestroy?: () => void) {
        this._isBottomToTop = isBottomToTop;
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

        // 调试：打印组件类型
        if (msg) {
            console.log('[NotificationToast] Message component type:', msg.constructor.name, {
                isGRichTextField: msg instanceof fgui.GRichTextField,
                isGTextField: msg instanceof fgui.GTextField
            });
        }

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

        // BBCode 链接会自动调用节点上的 onOpenTx 方法，无需手动绑定事件
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
     * 销毁Toast（快速滑动淡出）
     */
    public destroy(): void {
        // 根据堆叠方向决定滑动方向
        const targetY = this._isBottomToTop
            ? this._gObject.y + 50   // 从下往上堆叠：向下滑出
            : this._gObject.y - 50;  // 从上往下堆叠：向上滑出

        // 同时滑动和淡出（0.25秒，快速）
        fgui.GTween.to2(this._gObject.y, this._gObject.alpha, targetY, 0, 0.25)
            .setTarget(this._gObject)
            .setEase(fgui.EaseType.QuadIn)
            .onUpdate((tweener: fgui.GTweener) => {
                this._gObject.y = tweener.value.x;
                this._gObject.alpha = tweener.value.y;
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

// ==================== NotificationQueue类（单个位置的队列）====================

/**
 * 单个位置的通知队列
 * 封装Toast的添加、布局、自动消失等逻辑
 */
class NotificationQueue {
    private _toasts: NotificationToast[] = [];
    private _autoHideCancels: Map<NotificationToast, () => void> = new Map();
    private _anchor: fgui.GObject;
    private _anchorName: string;
    private _container: fgui.GComponent;
    private _scheduler: UIBase; // 用于scheduleOnce

    private static readonly MAX_NOTIFICATIONS = 3;
    private static readonly SPACING = 0;

    constructor(anchor: fgui.GObject, anchorName: string, container: fgui.GComponent, scheduler: UIBase) {
        this._anchor = anchor;
        this._anchorName = anchorName;
        this._container = container;
        this._scheduler = scheduler;
    }

    /**
     * 添加新通知
     */
    public addNotification(options: NotificationOptions): void {
        // 检查数量限制，移除最旧的
        if (this._toasts.length >= NotificationQueue.MAX_NOTIFICATIONS) {
            const oldest = this._toasts.shift();
            if (oldest) {
                this._cancelAutoHide(oldest);
                oldest.destroy();
            }
        }

        // 创建Toast实例
        const toast = new NotificationToast(options, this._isBottomToTop(), () => {
            const index = this._toasts.indexOf(toast);
            if (index !== -1) {
                this._toasts.splice(index, 1);
                this._relayout(true);
            }
        });

        // 添加到容器
        this._container.addChild(toast.gObject);
        this._toasts.push(toast);

        // 设置初始位置
        if (this._isBottomToTop()) {
            toast.gObject.x = this._anchor.x;
            toast.gObject.y = this._anchor.y - toast.gObject.height;
        } else {
            toast.gObject.x = this._anchor.x;
            toast.gObject.y = this._anchor.y;
        }

        // 播放淡入动画
        toast.playEnterAnimation();

        // 延迟触发布局动画
        setTimeout(() => {
            this._relayout(true);
        }, 50);

        // 调度自动消失
        const defaultDuration = UINotification.DEFAULT_DURATIONS[options.type || NotifyType.DEFAULT];
        const durationMs = options.duration ?? defaultDuration;
        const seconds = Math.max(0, durationMs) / 1000;
        const cb = () => {
            this._autoHideCancels.delete(toast);
            toast.destroy();
        };
        this._scheduler.scheduleOnce(cb, seconds);
        this._autoHideCancels.set(toast, () => this._scheduler.unschedule(cb));
    }

    /**
     * 判断当前anchor是否需要从下往上堆叠
     */
    private _isBottomToTop(): boolean {
        return this._anchorName.includes("bottom") || this._anchorName === "center";
    }

    /**
     * 重新布局所有通知
     */
    private _relayout(animated: boolean = false): void {
        const isBottomToTop = this._isBottomToTop();

        if (isBottomToTop) {
            let offsetY = 0;
            for (let i = this._toasts.length - 1; i >= 0; i--) {
                const toast = this._toasts[i];
                const targetX = this._anchor.x;
                const targetY = this._anchor.y - offsetY - toast.gObject.height;

                if (animated) {
                    this._tweenToPosition(toast.gObject, targetX, targetY, 0.2);
                } else {
                    toast.gObject.x = targetX;
                    toast.gObject.y = targetY;
                }

                offsetY += toast.gObject.height + NotificationQueue.SPACING;
            }
        } else {
            let offsetY = 0;
            this._toasts.forEach(toast => {
                const targetX = this._anchor.x;
                const targetY = this._anchor.y + offsetY;

                if (animated) {
                    this._tweenToPosition(toast.gObject, targetX, targetY, 0.2);
                } else {
                    toast.gObject.x = targetX;
                    toast.gObject.y = targetY;
                }

                offsetY += toast.gObject.height + NotificationQueue.SPACING;
            });
        }
    }

    private _tweenToPosition(obj: fgui.GObject, targetX: number, targetY: number, duration: number): void {
        fgui.GTween.to2(obj.x, obj.y, targetX, targetY, duration)
            .setTarget(obj)
            .setEase(fgui.EaseType.QuadOut)
            .onUpdate((tweener: fgui.GTweener) => {
                obj.x = tweener.value.x;
                obj.y = tweener.value.y;
            });
    }

    private _cancelAutoHide(toast: NotificationToast): void {
        const cancel = this._autoHideCancels.get(toast);
        if (cancel) {
            try { cancel(); } catch {}
            this._autoHideCancels.delete(toast);
        }
    }

    /**
     * 清除所有通知
     */
    public clearAll(): void {
        this._toasts.forEach(toast => {
            this._cancelAutoHide(toast);
            toast.destroy();
        });
        this._toasts = [];
    }
}

// ==================== UINotification主类 ====================

/**
 * 通知组件
 * 管理多个位置的NotificationQueue
 */
@ccclass('UINotification')
export class UINotification extends UIBase {
    // 多个位置的队列
    private _queues: Map<AnchorPosition, NotificationQueue> = new Map();

    // 容器组件
    private _container: fgui.GComponent | null = null;

    // 不同类型通知的默认显示时长（毫秒）
    private static readonly DEFAULT_DURATIONS: Record<NotifyType, number> = {
        [NotifyType.INFO]: 2000,
        [NotifyType.SUCCESS]: 2000,
        [NotifyType.WARNING]: 3000,
        [NotifyType.ERROR]: 5000,
        [NotifyType.DEFAULT]: 2000
    };

    // 静态单例实例
    private static _instance: UINotification | null = null;

    // 消息缓存队列（UI 未 ready 时缓存）
    private static _pendingMessages: Array<{ options: NotificationOptions; anchor: AnchorPosition }> = [];
    private static _isReady: boolean = false;

    // ==================== 生命周期 ====================

    protected onInit(): void {
        // 使用panel作为容器
        this._container = this.panel;

        if (!this._container) {
            console.error("[UINotification] Panel not found");
            return;
        }

        // 设置panel不拦截点击
        this._container.touchable = false;
        this._container.opaque = false;

        // 为每个anchor位置创建队列
        const anchorNames: AnchorPosition[] = ["lefttop", "righttop", "center", "leftbottom", "rightbottom"];

        anchorNames.forEach(name => {
            const anchor = this.panel?.getChild(name);
            if (anchor) {
                // 设置anchor不拦截点击
                anchor.touchable = false;
                anchor.opaque = false;

                // 创建该位置的队列
                const queue = new NotificationQueue(anchor, name, this._container!, this);
                this._queues.set(name, queue);
                console.log(`[UINotification] 创建队列: ${name}`);
            }
        });

        // 设置静态实例
        UINotification._instance = this;

        // 标记为 ready
        UINotification._isReady = true;

        console.log(`[UINotification] 初始化完成，创建了 ${this._queues.size} 个队列`);

        // 播放缓存的消息
        this._playPendingMessages();
    }

    /**
     * 播放缓存的待处理消息
     */
    private _playPendingMessages(): void {
        if (UINotification._pendingMessages.length === 0) {
            return;
        }

        console.log(`[UINotification] Playing ${UINotification._pendingMessages.length} pending messages`);

        // 延迟一点播放，确保 UI 完全 ready
        setTimeout(() => {
            UINotification._pendingMessages.forEach(({ options, anchor }) => {
                this.addNotification(options, anchor);
            });
            UINotification._pendingMessages = [];
        }, 100);
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
     * 添加新通知到指定位置
     */
    public addNotification(options: NotificationOptions, anchor: AnchorPosition = 'rightbottom'): void {
        const queue = this._queues.get(anchor);
        if (!queue) {
            console.error(`[UINotification] Queue not found for anchor: ${anchor}`);
            return;
        }

        queue.addNotification(options);
        console.log(`[UINotification] Added notification to ${anchor}: ${options.message}`);
    }

    /**
     * 清除所有通知
     */
    public clearAll(): void {
        this._queues.forEach(queue => queue.clearAll());
    }

    // ==================== 静态便捷方法 ====================

    /**
     * 获取实例
     */
    private static _getInstance(): UINotification | null {
        return UINotification._instance;
    }

    /**
     * 添加消息（支持缓存和降级）
     */
    private static _addMessage(options: NotificationOptions, anchor: AnchorPosition = 'rightbottom'): void {
        const instance = this._getInstance();

        if (instance && this._isReady) {
            // UI 已 ready，直接显示
            instance.addNotification(options, anchor);
        } else {
            // UI 未 ready，缓存消息
            this._pendingMessages.push({ options, anchor });

            // 降级到 console（开发阶段可见）
            const prefix = options.type?.toUpperCase() || 'INFO';
            const title = options.title ? `[${options.title}] ` : '';
            console.log(`[${prefix}] ${title}${options.message}`);
        }
    }

    /**
     * 信息通知（蓝色）
     */
    public static info(message: string, title?: string, duration?: number, anchor?: AnchorPosition): void {
        this._addMessage({
            title,
            message,
            type: NotifyType.INFO,
            duration
        }, anchor || 'rightbottom');
    }

    /**
     * 成功通知（绿色）
     */
    public static success(message: string, title?: string, duration?: number, anchor?: AnchorPosition): void {
        this._addMessage({
            title,
            message,
            type: NotifyType.SUCCESS,
            duration
        }, anchor || 'rightbottom');
    }

    /**
     * 警告通知（黄色）
     */
    public static warning(message: string, title?: string, duration?: number, anchor?: AnchorPosition): void {
        this._addMessage({
            title,
            message,
            type: NotifyType.WARNING,
            duration
        }, anchor || 'rightbottom');
    }

    /**
     * 错误通知（红色）
     */
    public static error(message: string, title?: string, duration?: number, anchor?: AnchorPosition): void {
        this._addMessage({
            title,
            message,
            type: NotifyType.ERROR,
            duration
        }, anchor || 'rightbottom');
    }

    /**
     * 自定义通知
     */
    public static show(options: NotificationOptions, anchor?: AnchorPosition): void {
        this._addMessage(options, anchor || 'rightbottom');
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
     * 交易通知工具方法
     * @param success 是否成功
     * @param message 消息内容
     * @param txHash 交易哈希
     * @param gasInfo Gas 信息（可选）
     * @param explorerUrl 区块浏览器链接（可选）
     */
    public static txNotification(
        success: boolean,
        message: string,
        txHash: string,
        gasInfo?: { gasSui: string },
        explorerUrl?: string
    ): void {
        const shortHash = txHash.slice(0, 8) + '...' + txHash.slice(-6);
        const gasText = gasInfo ? `\nGas: ${gasInfo.gasSui}` : '';

        // TODO: 链接点击功能暂时不可用（Cocos Creator RichText 不支持 <a> 标签点击）
        // 等以后有时间再实现链接点击功能（可能需要使用 BBCode <on click> 或自定义按钮）
        // const linkText = explorerUrl
        //     ? `\n<a href='${explorerUrl}'>[查看交易]</a>`
        //     : `\nTX: ${shortHash}`;
        const linkText = ''; // 暂时不显示链接

        const richMessage = message + gasText + linkText;

        if (success) {
            this.success(richMessage, undefined, 6000);
        } else {
            this.error(richMessage, undefined, 6000);
        }
    }
}
