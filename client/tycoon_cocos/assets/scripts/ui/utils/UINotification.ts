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
    private static readonly MAX_NOTIFICATIONS = 3;

    // 通知间距（像素）——按需改为无间隔
    private static readonly SPACING = 0;

    // 不同类型通知的默认显示时长（毫秒）
    private static readonly DEFAULT_DURATIONS: Record<NotifyType, number> = {
        [NotifyType.INFO]: 2000,      // 2秒
        [NotifyType.SUCCESS]: 2000,   // 2秒
        [NotifyType.WARNING]: 3000,   // 3秒
        [NotifyType.ERROR]: 5000,     // 5秒
        [NotifyType.DEFAULT]: 2000    // 2秒
    };

    // 静态单例实例
    private static _instance: UINotification | null = null;

    // 消息缓存队列（UI 未 ready 时缓存）
    private static _pendingMessages: NotificationOptions[] = [];
    private static _isReady: boolean = false;

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

        // 标记为 ready
        UINotification._isReady = true;

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
            UINotification._pendingMessages.forEach(options => {
                this.addNotification(options);
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

        // 创建Toast实例（传入堆叠方向，决定退出动画方向）
        const toast = new NotificationToast(options, this._isBottomToTop(), () => {
            // Toast自己销毁时，从数组移除
            const index = this._toasts.indexOf(toast);
            if (index !== -1) {
                this._toasts.splice(index, 1);
                // 重新布局剩余的通知（带动画）
                this._relayout(true);
            }
        });

        // 添加到容器
        this._container.addChild(toast.gObject);

        // 记录到数组
        this._toasts.push(toast);

        // 设置初始位置（在第一条消息的位置）
        const anchor = this.panel?.getChild(this._currentAnchor);
        if (anchor) {
            if (this._isBottomToTop()) {
                // 从下往上：初始位置在anchor底部（最新消息的最终位置）
                toast.gObject.x = anchor.x;
                toast.gObject.y = anchor.y - toast.gObject.height;
            } else {
                // 从上往下：初始位置在anchor顶部
                toast.gObject.x = anchor.x;
                toast.gObject.y = anchor.y;
            }
        }

        // 播放淡入动画
        toast.playEnterAnimation();

        // 延迟触发布局动画（让所有toast滑动到新位置，产生挤入效果）
        setTimeout(() => {
            this._relayout(true);  // animated = true
        }, 50);

        // 调度自动消失 - 根据通知类型获取默认时长
        const defaultDuration = UINotification.DEFAULT_DURATIONS[options.type || NotifyType.DEFAULT];
        const durationMs = options.duration ?? defaultDuration;
        const seconds = Math.max(0, durationMs) / 1000;
        const cb = () => {
            this._autoHideCancels.delete(toast);
            toast.destroy();
        };
        this.scheduleOnce(cb, seconds);
        this._autoHideCancels.set(toast, () => this.unschedule(cb));

        console.log(`[UINotification] Added notification: ${options.message}`);
    }

    /**
     * 判断当前anchor是否需要从下往上堆叠
     */
    private _isBottomToTop(): boolean {
        return this._currentAnchor.includes("bottom") || this._currentAnchor === "center";
    }

    /**
     * Tween移动到目标位置
     */
    private _tweenToPosition(obj: fgui.GObject, targetX: number, targetY: number, duration: number): void {
        fgui.GTween.to2(obj.x, obj.y, targetX, targetY, duration)
            .setTarget(obj)
            .setEase(fgui.EaseType.QuadOut)
            .onUpdate((tweener: fgui.GTweener) => {
                obj.x = tweener.value.x;
                obj.y = tweener.value.y;
            });
    }

    /**
     * 重新布局所有通知（垂直堆叠）
     * @param animated 是否使用动画过渡
     */
    private _relayout(animated: boolean = false): void {
        // 获取当前anchor的位置作为起点
        const anchor = this.panel?.getChild(this._currentAnchor);
        if (!anchor) {
            console.warn("[UINotification] Anchor not found:", this._currentAnchor);
            return;
        }

        const isBottomToTop = this._isBottomToTop();

        if (isBottomToTop) {
            // 从下往上堆叠：最新的在底部（anchor位置），旧的向上
            let offsetY = 0;
            // 从最新到最旧遍历（倒序）
            for (let i = this._toasts.length - 1; i >= 0; i--) {
                const toast = this._toasts[i];
                const targetX = anchor.x;
                const targetY = anchor.y - offsetY - toast.gObject.height;

                if (animated) {
                    this._tweenToPosition(toast.gObject, targetX, targetY, 0.2);
                } else {
                    toast.gObject.x = targetX;
                    toast.gObject.y = targetY;
                }

                offsetY += toast.gObject.height + UINotification.SPACING;
            }
        } else {
            // 从上往下堆叠：最新的在顶部（anchor位置），旧的向下
            let offsetY = 0;
            this._toasts.forEach(toast => {
                const targetX = anchor.x;
                const targetY = anchor.y + offsetY;

                if (animated) {
                    this._tweenToPosition(toast.gObject, targetX, targetY, 0.2);
                } else {
                    toast.gObject.x = targetX;
                    toast.gObject.y = targetY;
                }

                offsetY += toast.gObject.height + UINotification.SPACING;
            });
        }
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
        return UINotification._instance;
    }

    /**
     * 添加消息（支持缓存和降级）
     */
    private static _addMessage(options: NotificationOptions): void {
        const instance = this._getInstance();

        if (instance && this._isReady) {
            // UI 已 ready，直接显示
            instance.addNotification(options);
        } else {
            // UI 未 ready，缓存消息
            this._pendingMessages.push(options);

            // 降级到 console（开发阶段可见）
            const prefix = options.type?.toUpperCase() || 'INFO';
            const title = options.title ? `[${options.title}] ` : '';
            console.log(`[${prefix}] ${title}${options.message}`);
        }
    }

    /**
     * 信息通知（蓝色）
     */
    public static info(message: string, title?: string, duration?: number): void {
        this._addMessage({
            title,
            message,
            type: NotifyType.INFO,
            duration
        });
    }

    /**
     * 成功通知（绿色）
     */
    public static success(message: string, title?: string, duration?: number): void {
        this._addMessage({
            title,
            message,
            type: NotifyType.SUCCESS,
            duration
        });
    }

    /**
     * 警告通知（黄色）
     */
    public static warning(message: string, title?: string, duration?: number): void {
        this._addMessage({
            title,
            message,
            type: NotifyType.WARNING,
            duration
        });
    }

    /**
     * 错误通知（红色）
     */
    public static error(message: string, title?: string, duration?: number): void {
        this._addMessage({
            title,
            message,
            type: NotifyType.ERROR,
            duration
        });
    }

    /**
     * 自定义通知
     */
    public static show(options: NotificationOptions): void {
        this._addMessage(options);
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
