import { Node, Label, _decorator } from "cc";
import { UIPanel } from "./UIPanel";
import { UIButton } from "./UIButton";

const { ccclass, property } = _decorator;

/**
 * 对话框类型枚举
 */
export enum DialogType {
    /** 信息提示 */
    Info = "info",
    /** 警告提示 */
    Warning = "warning", 
    /** 错误提示 */
    Error = "error",
    /** 确认对话框 */
    Confirm = "confirm",
    /** 输入对话框 */
    Input = "input"
}

/**
 * 对话框结果枚举
 */
export enum DialogResult {
    /** 确认 */
    Ok = "ok",
    /** 取消 */
    Cancel = "cancel",
    /** 是 */
    Yes = "yes",
    /** 否 */
    No = "no"
}

/**
 * 对话框配置接口
 */
export interface DialogConfig {
    /** 对话框标题 */
    title?: string;
    /** 对话框内容 */
    message?: string;
    /** 对话框类型 */
    type?: DialogType;
    /** 确认按钮文本 */
    confirmText?: string;
    /** 取消按钮文本 */
    cancelText?: string;
    /** 是否显示取消按钮 */
    showCancel?: boolean;
    /** 确认回调 */
    onConfirm?: () => void;
    /** 取消回调 */
    onCancel?: () => void;
    /** 关闭回调 */
    onClose?: (result: DialogResult) => void;
}

/**
 * 对话框组件 - 基于UIPanel扩展
 */
@ccclass('UIDialog')
export class UIDialog extends UIPanel {
    @property(Label)
    titleLabel: Label | null = null;

    @property(Label)
    messageLabel: Label | null = null;

    @property(Node)
    iconNode: Node | null = null;

    @property(UIButton)
    confirmButton: UIButton | null = null;

    @property(UIButton)
    cancelButton: UIButton | null = null;

    /** 对话框配置 */
    private _config: DialogConfig | null = null;
    /** 对话框类型 */
    private _dialogType: DialogType = DialogType.Info;

    /**
     * 获取对话框类型
     */
    public get dialogType(): DialogType {
        return this._dialogType;
    }

    /**
     * 初始化UI
     */
    protected onInit(): void {
        super.onInit();
        this._setupDialogComponents();
    }

    /**
     * 设置对话框组件
     */
    private _setupDialogComponents(): void {
        // 自动获取组件
        if (!this.titleLabel) {
            const titleNode = this.node.getChildByPath("Background/Title") ||
                             this.node.getChildByPath("Title") ||
                             this.node.getChildByPath("TitleBar/Title");
            if (titleNode) {
                this.titleLabel = titleNode.getComponent(Label);
            }
        }

        if (!this.messageLabel) {
            const messageNode = this.node.getChildByPath("Background/Content/Message") ||
                               this.node.getChildByPath("Content/Message") ||
                               this.node.getChildByPath("Message");
            if (messageNode) {
                this.messageLabel = messageNode.getComponent(Label);
            }
        }

        if (!this.iconNode) {
            this.iconNode = this.node.getChildByPath("Background/Content/Icon") ||
                           this.node.getChildByPath("Content/Icon") ||
                           this.node.getChildByPath("Icon");
        }

        if (!this.confirmButton) {
            const confirmNode = this.node.getChildByPath("Background/Buttons/ConfirmButton") ||
                               this.node.getChildByPath("Buttons/ConfirmButton") ||
                               this.node.getChildByPath("ConfirmButton");
            if (confirmNode) {
                this.confirmButton = confirmNode.getComponent(UIButton);
            }
        }

        if (!this.cancelButton) {
            const cancelNode = this.node.getChildByPath("Background/Buttons/CancelButton") ||
                              this.node.getChildByPath("Buttons/CancelButton") ||
                              this.node.getChildByPath("CancelButton");
            if (cancelNode) {
                this.cancelButton = cancelNode.getComponent(UIButton);
            }
        }

        // 绑定按钮事件
        this._bindDialogEvents();
    }

    /**
     * 绑定对话框事件
     */
    private _bindDialogEvents(): void {
        if (this.confirmButton) {
            this.confirmButton.setClickCallback(() => this.onConfirmClick());
        }

        if (this.cancelButton) {
            this.cancelButton.setClickCallback(() => this.onCancelClick());
        }
    }

    /**
     * 配置对话框
     */
    public configure(config: DialogConfig): void {
        this._config = config;
        this._dialogType = config.type || DialogType.Info;

        // 设置标题
        if (this.titleLabel && config.title) {
            this.titleLabel.string = config.title;
        }

        // 设置消息内容
        if (this.messageLabel && config.message) {
            this.messageLabel.string = config.message;
        }

        // 设置按钮文本
        if (this.confirmButton && config.confirmText) {
            this.confirmButton.text = config.confirmText;
        }

        if (this.cancelButton && config.cancelText) {
            this.cancelButton.text = config.cancelText;
        }

        // 控制取消按钮显示
        if (this.cancelButton) {
            this.cancelButton.node.active = config.showCancel !== false;
        }

        // 设置图标
        this._updateIcon();

        // 默认按钮文本
        this._setDefaultButtonTexts();
    }

    /**
     * 更新图标
     */
    private _updateIcon(): void {
        if (!this.iconNode) return;

        // 根据对话框类型设置图标
        // 这里可以根据类型加载不同的图标资源
        switch (this._dialogType) {
            case DialogType.Info:
                // 设置信息图标
                break;
            case DialogType.Warning:
                // 设置警告图标
                break;
            case DialogType.Error:
                // 设置错误图标
                break;
            case DialogType.Confirm:
                // 设置确认图标
                break;
        }
    }

    /**
     * 设置默认按钮文本
     */
    private _setDefaultButtonTexts(): void {
        if (!this._config) return;

        if (this.confirmButton && !this._config.confirmText) {
            switch (this._dialogType) {
                case DialogType.Confirm:
                    this.confirmButton.text = "确认";
                    break;
                default:
                    this.confirmButton.text = "确定";
                    break;
            }
        }

        if (this.cancelButton && !this._config.cancelText) {
            this.cancelButton.text = "取消";
        }
    }

    /**
     * 确认按钮点击
     */
    private onConfirmClick(): void {
        const result = this._dialogType === DialogType.Confirm ? DialogResult.Yes : DialogResult.Ok;
        
        // 执行确认回调
        if (this._config?.onConfirm) {
            try {
                this._config.onConfirm();
            } catch (e) {
                console.error("[UIDialog] Error in confirm callback:", e);
            }
        }

        // 执行关闭回调
        this._executeCloseCallback(result);

        // 关闭对话框
        this.close();
    }

    /**
     * 取消按钮点击
     */
    private onCancelClick(): void {
        const result = this._dialogType === DialogType.Confirm ? DialogResult.No : DialogResult.Cancel;
        
        // 执行取消回调
        if (this._config?.onCancel) {
            try {
                this._config.onCancel();
            } catch (e) {
                console.error("[UIDialog] Error in cancel callback:", e);
            }
        }

        // 执行关闭回调
        this._executeCloseCallback(result);

        // 关闭对话框
        this.close();
    }

    /**
     * 执行关闭回调
     */
    private _executeCloseCallback(result: DialogResult): void {
        if (this._config?.onClose) {
            try {
                this._config.onClose(result);
            } catch (e) {
                console.error("[UIDialog] Error in close callback:", e);
            }
        }
    }

    /**
     * 隐藏后回调
     */
    protected onAfterHide(): void {
        super.onAfterHide();
        
        // 清理配置
        this._config = null;
    }

    /**
     * 静态方法：显示信息对话框
     */
    public static showInfo(message: string, title?: string, onClose?: () => void): Promise<DialogResult> {
        return this._showDialog({
            type: DialogType.Info,
            title: title || "提示",
            message: message,
            showCancel: false,
            onClose: onClose ? () => onClose() : undefined
        });
    }

    /**
     * 静态方法：显示警告对话框
     */
    public static showWarning(message: string, title?: string, onClose?: () => void): Promise<DialogResult> {
        return this._showDialog({
            type: DialogType.Warning,
            title: title || "警告",
            message: message,
            showCancel: false,
            onClose: onClose ? () => onClose() : undefined
        });
    }

    /**
     * 静态方法：显示错误对话框
     */
    public static showError(message: string, title?: string, onClose?: () => void): Promise<DialogResult> {
        return this._showDialog({
            type: DialogType.Error,
            title: title || "错误",
            message: message,
            showCancel: false,
            onClose: onClose ? () => onClose() : undefined
        });
    }

    /**
     * 静态方法：显示确认对话框
     */
    public static showConfirm(
        message: string, 
        title?: string,
        confirmText?: string,
        cancelText?: string
    ): Promise<DialogResult> {
        return this._showDialog({
            type: DialogType.Confirm,
            title: title || "确认",
            message: message,
            confirmText: confirmText,
            cancelText: cancelText,
            showCancel: true
        });
    }

    /**
     * 内部方法：显示对话框
     */
    private static _showDialog(config: DialogConfig): Promise<DialogResult> {
        return new Promise((resolve) => {
            // 这里需要通过UIManager创建对话框实例
            // 由于是静态方法，需要与UIManager集成
            // 暂时返回Promise，实际实现需要UIManager支持
            
            const originalOnClose = config.onClose;
            config.onClose = (result: DialogResult) => {
                if (originalOnClose) {
                    originalOnClose(result);
                }
                resolve(result);
            };

            // 通过UIManager显示对话框
            // UIManager.instance.showUI("Dialog", { config });
            
            // 临时实现
            console.log("[UIDialog] Show dialog:", config);
            setTimeout(() => resolve(DialogResult.Ok), 100);
        });
    }
}