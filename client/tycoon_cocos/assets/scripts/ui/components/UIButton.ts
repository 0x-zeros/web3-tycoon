import { Button, Component, Node, _decorator, Sprite, Label, tween, Vec3, AudioSource } from "cc";
import { EventBus } from "../events/EventBus";
import { EventTypes } from "../events/EventTypes";

const { ccclass, property } = _decorator;

/**
 * 按钮点击回调类型
 */
export type ButtonClickCallback = (button: UIButton) => void;

/**
 * 扩展按钮组件 - 提供防重复点击、音效、动画等功能
 */
@ccclass('UIButton')
export class UIButton extends Component {
    @property(Button)
    button: Button | null = null;

    @property(Node)
    iconNode: Node | null = null;

    @property(Label)
    textLabel: Label | null = null;

    @property({
        tooltip: "是否启用防重复点击"
    })
    preventMultiClick: boolean = true;

    @property({
        tooltip: "防重复点击间隔时间(秒)"
    })
    clickInterval: number = 0.5;

    @property({
        tooltip: "是否启用点击音效"
    })
    enableClickSound: boolean = true;

    @property({
        tooltip: "点击音效资源路径"
    })
    clickSoundPath: string = "audio/ui/button_click";

    @property({
        tooltip: "是否启用点击动画"
    })
    enableClickAnimation: boolean = true;

    @property({
        tooltip: "点击缩放比例"
    })
    clickScaleRatio: number = 0.95;

    @property({
        tooltip: "动画持续时间(秒)"
    })
    animationDuration: number = 0.1;

    /** 按钮唯一标识 */
    private _buttonId: string = "";
    /** 最后点击时间 */
    private _lastClickTime: number = 0;
    /** 是否已初始化 */
    private _inited: boolean = false;
    /** 点击回调函数 */
    private _clickCallback: ButtonClickCallback | null = null;
    /** 原始缩放值 */
    private _originalScale: Vec3 = Vec3.ONE.clone();
    /** 是否交互中 */
    private _interacting: boolean = false;

    /**
     * 设置按钮标识
     */
    public set buttonId(value: string) {
        this._buttonId = value;
    }

    /**
     * 获取按钮标识
     */
    public get buttonId(): string {
        return this._buttonId;
    }

    /**
     * 设置按钮文本
     */
    public set text(value: string) {
        if (this.textLabel) {
            this.textLabel.string = value;
        }
    }

    /**
     * 获取按钮文本
     */
    public get text(): string {
        return this.textLabel ? this.textLabel.string : "";
    }

    /**
     * 设置按钮是否可交互
     */
    public set interactable(value: boolean) {
        if (this.button) {
            this.button.interactable = value;
        }
    }

    /**
     * 获取按钮是否可交互
     */
    public get interactable(): boolean {
        return this.button ? this.button.interactable : false;
    }

    /**
     * 组件加载时调用
     */
    protected onLoad(): void {
        this.init();
    }

    /**
     * 初始化按钮
     */
    public init(): void {
        if (this._inited) {
            return;
        }

        // 自动获取组件
        if (!this.button) {
            this.button = this.getComponent(Button) || this.getComponentInChildren(Button);
        }

        if (!this.textLabel) {
            this.textLabel = this.getComponentInChildren(Label);
        }

        if (!this.iconNode) {
            this.iconNode = this.node.getChildByName("Icon") || this.node.getChildByName("icon");
        }

        // 保存原始缩放
        this._originalScale = this.node.scale.clone();

        // 绑定事件
        this.bindEvents();

        this._inited = true;
    }

    /**
     * 绑定事件
     */
    private bindEvents(): void {
        if (this.button) {
            this.button.node.on(Button.EventType.CLICK, this.onButtonClick, this);
        }

        // 绑定触摸事件用于动画
        if (this.enableClickAnimation) {
            this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
            this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        }
    }

    /**
     * 解绑事件
     */
    private unbindEvents(): void {
        if (this.button) {
            this.button.node.off(Button.EventType.CLICK, this.onButtonClick, this);
        }

        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    /**
     * 设置点击回调
     */
    public setClickCallback(callback: ButtonClickCallback): void {
        this._clickCallback = callback;
    }

    /**
     * 按钮点击事件
     */
    private onButtonClick(): void {
        // 防重复点击检查
        if (this.preventMultiClick) {
            const now = Date.now();
            if (now - this._lastClickTime < this.clickInterval * 1000) {
                return;
            }
            this._lastClickTime = now;
        }

        // 播放音效
        if (this.enableClickSound) {
            this.playClickSound();
        }

        // 发送全局事件
        EventBus.emitEvent(EventTypes.UI.ButtonClick, {
            buttonId: this._buttonId,
            button: this
        });

        // 执行回调
        if (this._clickCallback) {
            try {
                this._clickCallback(this);
            } catch (e) {
                console.error("[UIButton] Error in click callback:", e);
            }
        }
    }

    /**
     * 触摸开始
     */
    private onTouchStart(): void {
        if (!this.interactable || this._interacting) {
            return;
        }

        this._interacting = true;
        this.playPressAnimation();
    }

    /**
     * 触摸结束
     */
    private onTouchEnd(): void {
        if (this._interacting) {
            this._interacting = false;
            this.playReleaseAnimation();
        }
    }

    /**
     * 触摸取消
     */
    private onTouchCancel(): void {
        if (this._interacting) {
            this._interacting = false;
            this.playReleaseAnimation();
        }
    }

    /**
     * 播放按下动画
     */
    private playPressAnimation(): void {
        if (!this.enableClickAnimation) return;

        this.node.stopAllActions();
        const targetScale = this._originalScale.clone().multiplyScalar(this.clickScaleRatio);
        
        tween(this.node)
            .to(this.animationDuration, { scale: targetScale }, { easing: "quartOut" })
            .start();
    }

    /**
     * 播放释放动画
     */
    private playReleaseAnimation(): void {
        if (!this.enableClickAnimation) return;

        this.node.stopAllActions();
        
        tween(this.node)
            .to(this.animationDuration, { scale: this._originalScale }, { easing: "backOut" })
            .start();
    }

    /**
     * 播放点击音效
     */
    private playClickSound(): void {
        // 这里可以通过AudioManager或直接播放音效
        // 暂时使用console输出代替
        console.log(`[UIButton] Play click sound: ${this.clickSoundPath}`);
        
        // 如果有AudioSource组件，可以直接播放
        const audioSource = this.getComponent(AudioSource);
        if (audioSource && audioSource.clip) {
            audioSource.playOneShot(audioSource.clip);
        }
    }

    /**
     * 设置按钮状态
     */
    public setState(enabled: boolean, text?: string): void {
        this.interactable = enabled;
        
        if (text !== undefined) {
            this.text = text;
        }

        // 可以添加视觉状态变化
        const sprite = this.getComponent(Sprite);
        if (sprite) {
            sprite.grayscale = !enabled;
        }
    }

    /**
     * 显示加载状态
     */
    public showLoading(loadingText: string = "Loading..."): void {
        this.setState(false, loadingText);
        // 这里可以添加加载动画
    }

    /**
     * 隐藏加载状态
     */
    public hideLoading(normalText?: string): void {
        this.setState(true, normalText);
    }

    /**
     * 模拟点击
     */
    public simulateClick(): void {
        if (this.interactable) {
            this.onButtonClick();
        }
    }

    /**
     * 组件销毁时调用
     */
    protected onDestroy(): void {
        this.unbindEvents();
        this._clickCallback = null;
    }
}