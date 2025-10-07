import { _decorator } from 'cc';
import { UIBase } from "../core/UIBase";
import * as fgui from "fairygui-cc";

const { ccclass } = _decorator;

// ==================== 类型定义 ====================

/**
 * MessageBox图标类型
 */
export enum MessageBoxIcon {
    NONE = "none",
    INFO = "info",
    SUCCESS = "success",
    WARNING = "warning",
    ERROR = "error",
    CUSTOM = "custom"
}

/**
 * MessageBox结果
 */
export enum MessageBoxResult {
    PRIMARY = "primary",
    SECONDARY = "secondary",
    CLOSE = "close",
    TIMEOUT = "timeout"
}

/**
 * 按钮配置
 */
export interface MessageBoxButtonConfig {
    /** 按钮文本 */
    text?: string;
    /** 是否显示（默认true） */
    visible?: boolean;
    /** 点击回调 */
    callback?: () => void | Promise<void>;
}

/**
 * 皮肤配置
 */
export interface MessageBoxSkin {
    /** 背景颜色 */
    bgColor?: string;
    /** 背景图片URL（FairyGUI资源路径） */
    bgImage?: string;
    /** 标题文本颜色 */
    titleColor?: string;
    /** 消息文本颜色 */
    messageColor?: string;
}

/**
 * MessageBox配置选项
 */
export interface MessageBoxOptions {
    /** 标题 */
    title?: string;
    /** 消息内容（支持富文本） */
    message: string;
    /** 图标类型或自定义URL */
    icon?: MessageBoxIcon | string;

    /** 按钮配置 */
    buttons?: {
        primary?: MessageBoxButtonConfig;
        secondary?: MessageBoxButtonConfig;
        close?: MessageBoxButtonConfig;
    };

    /** 皮肤配置 */
    skin?: MessageBoxSkin;

    /** 关闭回调 */
    onClose?: (result: MessageBoxResult) => void;
}

/**
 * 确认对话框配置
 */
export interface ConfirmOptions {
    /** 消息内容 */
    message: string;
    /** 标题（可选） */
    title?: string;
    /** 确认按钮文本（默认"确定"） */
    confirmText?: string;
    /** 取消按钮文本（默认"取消"） */
    cancelText?: string;
    /** 图标类型（默认WARNING） */
    icon?: MessageBoxIcon;
}

// ==================== 队列管理 ====================

/**
 * MessageBox队列项
 */
interface QueueItem {
    options: MessageBoxOptions;
    resolve: (result: MessageBoxResult) => void;
}

/**
 * MessageBox队列管理器
 */
class MessageBoxQueue {
    private _queue: QueueItem[] = [];
    private _currentBox: UIMessage | null = null;
    private _isProcessing: boolean = false;
    private _uiManagerGetter: (() => any) | null = null;

    /**
     * 设置UIManager获取器（避免循环依赖）
     */
    public setUIManagerGetter(getter: () => any): void {
        this._uiManagerGetter = getter;
    }

    /**
     * 入队
     */
    public enqueue(options: MessageBoxOptions): Promise<MessageBoxResult> {
        return new Promise<MessageBoxResult>((resolve) => {
            this._queue.push({ options, resolve });
            this._processNext();
        });
    }

    /**
     * 处理下一个
     */
    private async _processNext(): Promise<void> {
        // 如果正在处理或队列为空，直接返回
        if (this._isProcessing || this._queue.length === 0) {
            return;
        }

        this._isProcessing = true;

        const item = this._queue.shift();
        if (!item) {
            this._isProcessing = false;
            return;
        }

        try {
            // 显示MessageBox
            const result = await this._showMessageBox(item.options);
            item.resolve(result);
        } catch (error) {
            console.error("[MessageBoxQueue] Error showing message box:", error);
            item.resolve(MessageBoxResult.CLOSE);
        } finally {
            this._currentBox = null;
            this._isProcessing = false;
            // 继续处理下一个
            this._processNext();
        }
    }

    /**
     * 显示MessageBox实例
     */
    private async _showMessageBox(options: MessageBoxOptions): Promise<MessageBoxResult> {
        return new Promise<MessageBoxResult>((resolve) => {
            if (!this._uiManagerGetter) {
                console.error("[MessageBoxQueue] UIManager getter not set");
                resolve(MessageBoxResult.CLOSE);
                return;
            }

            const UIManager = this._uiManagerGetter();
            if (!UIManager || !UIManager.instance) {
                console.error("[MessageBoxQueue] UIManager not available");
                resolve(MessageBoxResult.CLOSE);
                return;
            }

            UIManager.instance.showUI("MessageBox", options).then((ui: any) => {
                if (!ui) {
                    console.error("[MessageBoxQueue] Failed to show MessageBox");
                    resolve(MessageBoxResult.CLOSE);
                    return;
                }

                this._currentBox = ui;

                // 设置关闭回调
                const originalOnClose = options.onClose;
                ui.setCloseCallback((result: MessageBoxResult) => {
                    if (originalOnClose) {
                        originalOnClose(result);
                    }
                    resolve(result);
                });
            }).catch((error: any) => {
                console.error("[MessageBoxQueue] Error showing UI:", error);
                resolve(MessageBoxResult.CLOSE);
            });
        });
    }

    /**
     * 清空队列
     */
    public clear(): void {
        this._queue.forEach(item => item.resolve(MessageBoxResult.CLOSE));
        this._queue = [];

        if (this._currentBox) {
            this._currentBox.close(MessageBoxResult.CLOSE);
            this._currentBox = null;
        }

        this._isProcessing = false;
    }

    /**
     * 获取队列长度
     */
    public get length(): number {
        return this._queue.length + (this._isProcessing ? 1 : 0);
    }
}

// ==================== UIMessage主类 ====================

/**
 * 通用MessageBox组件
 * 支持Modal/Modeless双模式、可复用、可皮肤化、可排队
 */
@ccclass('UIMessage')
export class UIMessage extends UIBase {
    // UI元素引用
    private _bg: fgui.GGraph | null = null;
    private _bgImage: fgui.GLoader | null = null;
    private _icon: fgui.GLoader | null = null;
    private _title: fgui.GTextField | null = null;
    private _message: fgui.GRichTextField | null = null;
    private _btnPrimary: fgui.GButton | null = null;
    private _btnSecondary: fgui.GButton | null = null;
    private _btnClose: fgui.GButton | null = null;

    // 当前配置
    private _currentOptions: MessageBoxOptions | null = null;
    private _closeCallback: ((result: MessageBoxResult) => void) | null = null;

    // 静态队列实例
    private static _queue: MessageBoxQueue = new MessageBoxQueue();
    // 默认皮肤
    private static _defaultSkin: MessageBoxSkin = {};

    // ==================== 生命周期 ====================

    protected onInit(): void {
        // 获取UI元素引用
        this._bg = this.getChild("bg") as fgui.GGraph;
        this._bgImage = this.getLoader("bgImage");
        this._icon = this.getLoader("icon");
        this._title = this.getText("title");
        this._message = this.getChild("message") as fgui.GRichTextField;
        this._btnPrimary = this.getButton("btn_primary");
        this._btnSecondary = this.getButton("btn_secondary");
        this._btnClose = this.getButton("btn_close");

        // 确保 panel 可触摸
        if (this._panel) {
            this._panel.touchable = true;
        }

        // 调试输出
        console.log('[UIMessage] Initialized');
        console.log('  btn_primary:', !!this._btnPrimary);
        console.log('  btn_secondary:', !!this._btnSecondary);
        console.log('  btn_close:', !!this._btnClose);

        // 绑定按钮事件
        this._bindButtonEvents();
    }

    protected onShow(data?: any): void {
        if (!data) {
            console.warn("[UIMessage] No options provided");
            return;
        }

        this._currentOptions = data as MessageBoxOptions;
        this._applyOptions(this._currentOptions);
    }

    protected onHide(): void {
        this._currentOptions = null;
        this._closeCallback = null;
    }

    // ==================== 私有方法 ====================

    /**
     * 绑定按钮事件
     */
    private _bindButtonEvents(): void {
        if (this._btnPrimary) {
            this._btnPrimary.on(fgui.Event.CLICK, this._onPrimaryClick, this);
        }
        if (this._btnSecondary) {
            this._btnSecondary.on(fgui.Event.CLICK, this._onSecondaryClick, this);
        }
        if (this._btnClose) {
            this._btnClose.on(fgui.Event.CLICK, this._onCloseClick, this);
        }
    }

    /**
     * Primary按钮点击
     */
    private _onPrimaryClick(): void {
        this._onButtonClick(MessageBoxResult.PRIMARY);
    }

    /**
     * Secondary按钮点击
     */
    private _onSecondaryClick(): void {
        this._onButtonClick(MessageBoxResult.SECONDARY);
    }

    /**
     * Close按钮点击
     */
    private _onCloseClick(): void {
        this._onButtonClick(MessageBoxResult.CLOSE);
    }

    /**
     * 应用配置选项
     */
    private _applyOptions(options: MessageBoxOptions): void {
        // 设置标题
        if (this._title) {
            this._title.text = options.title || "";
        }

        // 设置消息
        if (this._message) {
            this._message.text = options.message || "";
        }

        // 设置Icon
        this._setIcon(options.icon);

        // 设置按钮
        this._setupButtons(options.buttons);

        // 应用皮肤
        const finalSkin = { ...UIMessage._defaultSkin, ...options.skin };
        this._applySkin(finalSkin);
    }

    /**
     * 设置Icon
     */
    private _setIcon(icon?: MessageBoxIcon | string): void {
        if (!this._icon) return;

        if (!icon || icon === MessageBoxIcon.NONE) {
            // 隐藏icon
            this._icon.visible = false;
            return;
        }

        this._icon.visible = true;

        // 预设图标映射（如果有资源的话）
        const iconMap: { [key: string]: string } = {
            [MessageBoxIcon.NONE]: "",
            [MessageBoxIcon.INFO]: "ui://Common/icon_info",
            [MessageBoxIcon.SUCCESS]: "ui://Common/icon_success",
            [MessageBoxIcon.WARNING]: "ui://Common/icon_warning",
            [MessageBoxIcon.ERROR]: "ui://Common/icon_error",
            [MessageBoxIcon.CUSTOM]: ""
        };

        // 判断是否是预设类型
        const iconKeys = [
            MessageBoxIcon.NONE,
            MessageBoxIcon.INFO,
            MessageBoxIcon.SUCCESS,
            MessageBoxIcon.WARNING,
            MessageBoxIcon.ERROR,
            MessageBoxIcon.CUSTOM
        ];

        if (iconKeys.indexOf(icon as MessageBoxIcon) !== -1) {
            const iconUrl = iconMap[icon as string];
            if (iconUrl) {
                this._icon.url = iconUrl;
            } else {
                // 暂无资源，隐藏
                this._icon.visible = false;
            }
        } else {
            // 自定义URL
            this._icon.url = icon as string;
        }
    }

    /**
     * 设置按钮配置
     */
    private _setupButtons(buttons?: MessageBoxOptions["buttons"]): void {
        // 默认配置
        const defaultButtons = {
            primary: { text: "确定", visible: true },
            secondary: { text: "取消", visible: false },
            close: { text: "关闭", visible: true }
        };

        const finalButtons = {
            primary: { ...defaultButtons.primary, ...buttons?.primary },
            secondary: { ...defaultButtons.secondary, ...buttons?.secondary },
            close: { ...defaultButtons.close, ...buttons?.close }
        };

        this._configButton(this._btnPrimary, finalButtons.primary);
        this._configButton(this._btnSecondary, finalButtons.secondary);
        this._configButton(this._btnClose, finalButtons.close);
    }

    /**
     * 配置单个按钮
     */
    private _configButton(button: fgui.GButton | null, config: MessageBoxButtonConfig): void {
        if (!button) return;

        // 设置可见性
        button.visible = config.visible !== false;

        // 设置文本
        if (config.text !== undefined) {
            button.title = config.text;
        }
    }

    /**
     * 应用皮肤
     */
    private _applySkin(skin: MessageBoxSkin): void {
        // 背景颜色
        if (skin.bgColor && this._bg) {
            // FairyGUI的GGraph颜色，暂时跳过设置
            // 需要查看FairyGUI文档确定正确的设置方法
        }

        // 背景图片
        if (skin.bgImage && this._bgImage) {
            this._bgImage.url = skin.bgImage;
            this._bgImage.visible = true;
        }

        // 标题颜色
        if (skin.titleColor && this._title) {
            // GTextField的color属性需要使用Cocos的Color类
            // 暂时跳过，需要转换颜色格式
        }

        // 消息颜色
        if (skin.messageColor && this._message) {
            // 同上
        }
    }

    /**
     * 按钮点击处理
     */
    private async _onButtonClick(result: MessageBoxResult): Promise<void> {
        // 执行按钮回调
        const callback = this._getButtonCallback(result);
        if (callback) {
            try {
                await callback();
            } catch (error) {
                console.error("[UIMessage] Button callback error:", error);
            }
        }

        // 关闭MessageBox
        this.close(result);
    }

    /**
     * 获取按钮回调
     */
    private _getButtonCallback(result: MessageBoxResult): (() => void | Promise<void>) | undefined {
        if (!this._currentOptions?.buttons) {
            return undefined;
        }

        switch (result) {
            case MessageBoxResult.PRIMARY:
                return this._currentOptions.buttons.primary?.callback;
            case MessageBoxResult.SECONDARY:
                return this._currentOptions.buttons.secondary?.callback;
            case MessageBoxResult.CLOSE:
                return this._currentOptions.buttons.close?.callback;
            default:
                return undefined;
        }
    }

    // ==================== 公共方法 ====================

    /**
     * 设置关闭回调
     */
    public setCloseCallback(callback: (result: MessageBoxResult) => void): void {
        this._closeCallback = callback;
    }

    /**
     * 关闭MessageBox
     */
    public close(result: MessageBoxResult = MessageBoxResult.CLOSE): void {
        // 触发关闭回调
        if (this._closeCallback) {
            this._closeCallback(result);
        }

        // 隐藏UI
        this.hide();

        // 通知UIManager隐藏（延迟执行避免循环依赖）
        setTimeout(() => {
            const uiManagerGetter = UIMessage._queue['_uiManagerGetter'];
            if (uiManagerGetter) {
                const UIManager = uiManagerGetter();
                if (UIManager && UIManager.instance) {
                    UIManager.instance.hideUI("MessageBox");
                }
            }
        }, 0);
    }

    // ==================== 静态方法 ====================

    /**
     * 初始化UIMessage（由UIManager调用）
     * @param uiManagerGetter UIManager获取器函数
     */
    public static initialize(uiManagerGetter: () => any): void {
        UIMessage._queue.setUIManagerGetter(uiManagerGetter);
        console.log("[UIMessage] Initialized with UIManager getter");
    }

    /**
     * 设置默认皮肤
     */
    public static setDefaultSkin(skin: MessageBoxSkin): void {
        UIMessage._defaultSkin = { ...skin };
    }

    /**
     * 清空队列
     */
    public static clearQueue(): void {
        UIMessage._queue.clear();
    }

    /**
     * 获取队列长度
     */
    public static getQueueLength(): number {
        return UIMessage._queue.length;
    }

    /**
     * 通用显示方法
     */
    public static show(options: MessageBoxOptions): Promise<MessageBoxResult> {
        return UIMessage._queue.enqueue(options);
    }

    /**
     * 信息提示
     */
    public static info(message: string, title: string = ""): Promise<MessageBoxResult> {
        return UIMessage.show({
            title,
            message,
            icon: MessageBoxIcon.INFO,
            buttons: {
                primary: { text: "知道了" },
                secondary: { visible: false },
                close: { visible: false }
            }
        });
    }

    /**
     * 成功提示
     */
    public static success(message: string, title: string = ""): Promise<MessageBoxResult> {
        return UIMessage.show({
            title,
            message,
            icon: MessageBoxIcon.SUCCESS,
            buttons: {
                primary: { text: "好的" },
                secondary: { visible: false },
                close: { visible: false }
            }
        });
    }

    /**
     * 警告提示
     */
    public static warning(message: string, title: string = ""): Promise<MessageBoxResult> {
        return UIMessage.show({
            title,
            message,
            icon: MessageBoxIcon.WARNING,
            buttons: {
                primary: { text: "我知道了" },
                secondary: { visible: false },
                close: { visible: false }
            }
        });
    }

    /**
     * 错误提示
     */
    public static error(message: string, title: string = ""): Promise<MessageBoxResult> {
        return UIMessage.show({
            title,
            message,
            icon: MessageBoxIcon.ERROR,
            buttons: {
                primary: { text: "确定" },
                secondary: { visible: false },
                close: { visible: false }
            }
        });
    }

    /**
     * 确认对话框
     */
    public static confirm(options: ConfirmOptions): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            UIMessage.show({
                title: options.title || "确认",
                message: options.message,
                icon: options.icon || MessageBoxIcon.WARNING,
                buttons: {
                    primary: {
                        text: options.confirmText || "确定",
                        callback: () => resolve(true)
                    },
                    secondary: {
                        text: options.cancelText || "取消",
                        visible: true,
                        callback: () => resolve(false)
                    },
                    close: {
                        visible: false
                    }
                },
                onClose: (result) => {
                    // 只有点击primary才算确认
                    if (result !== MessageBoxResult.PRIMARY) {
                        resolve(false);
                    }
                }
            });
        });
    }
}
