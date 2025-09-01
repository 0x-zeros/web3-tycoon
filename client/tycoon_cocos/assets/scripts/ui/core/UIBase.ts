import { Component, Node, _decorator, tween, Vec3 } from "cc";
import { UIState, UIAnimationType, UIShowOptions, UIHideOptions } from "./UITypes";

const { ccclass } = _decorator;

/**
 * UI基类 - 所有UI界面都应该继承此类
 * 提供完整的UI生命周期管理和动画支持
 */
@ccclass('UIBase')
export abstract class UIBase extends Component {
    /** UI唯一标识 */
    protected _uiId: string = "";
    /** 当前UI状态 */
    protected _state: UIState = UIState.Hidden;
    /** UI显示数据 */
    protected _showData: any = null;
    /** 是否已经初始化 */
    protected _inited: boolean = false;

    /**
     * 获取UI标识
     */
    get uiId(): string {
        return this._uiId;
    }

    /**
     * 设置UI标识
     */
    set uiId(value: string) {
        this._uiId = value;
    }

    /**
     * 获取当前状态
     */
    get state(): UIState {
        return this._state;
    }

    /**
     * 获取显示数据
     */
    get showData(): any {
        return this._showData;
    }

    /**
     * 是否处于显示状态
     */
    get isVisible(): boolean {
        return this._state === UIState.Shown || this._state === UIState.Showing;
    }

    /**
     * 是否已初始化
     */
    get isInited(): boolean {
        return this._inited;
    }

    /**
     * 组件加载时调用
     */
    protected onLoad(): void {
        if (!this._inited) {
            this.onInit();
            this._inited = true;
        }
    }

    /**
     * 初始化UI - 子类重写此方法进行UI初始化
     * 只会调用一次
     */
    protected onInit(): void {
        // 子类实现
    }

    /**
     * 绑定UI事件 - 子类重写此方法绑定UI交互事件
     */
    protected bindEvents(): void {
        // 子类实现
    }

    /**
     * 解绑UI事件 - 子类重写此方法解绑UI交互事件
     */
    protected unbindEvents(): void {
        // 子类实现
    }

    /**
     * 显示UI
     */
    public show(options: UIShowOptions = {}): Promise<void> {
        return new Promise((resolve) => {
            if (this._state === UIState.Shown || this._state === UIState.Showing) {
                resolve();
                return;
            }

            this._state = UIState.Showing;
            this._showData = options.data;

            // 确保节点激活
            if (!this.node.active) {
                this.node.active = true;
            }

            // 调用显示前回调
            this.onBeforeShow(this._showData);

            // 绑定事件
            this.bindEvents();

            const animation = options.animation || UIAnimationType.None;
            const duration = options.animationDuration || 0.3;

            if (options.immediate || animation === UIAnimationType.None) {
                this._onShowComplete();
                options.onComplete?.();
                resolve();
            } else {
                this._playShowAnimation(animation, duration, () => {
                    this._onShowComplete();
                    options.onComplete?.();
                    resolve();
                });
            }
        });
    }

    /**
     * 隐藏UI
     */
    public hide(options: UIHideOptions = {}): Promise<void> {
        return new Promise((resolve) => {
            if (this._state === UIState.Hidden || this._state === UIState.Hiding) {
                resolve();
                return;
            }

            this._state = UIState.Hiding;

            // 调用隐藏前回调
            this.onBeforeHide();

            // 解绑事件
            this.unbindEvents();

            const animation = options.animation || UIAnimationType.None;
            const duration = options.animationDuration || 0.3;

            if (options.immediate || animation === UIAnimationType.None) {
                this._onHideComplete();
                options.onComplete?.();
                resolve();
            } else {
                this._playHideAnimation(animation, duration, () => {
                    this._onHideComplete();
                    options.onComplete?.();
                    resolve();
                });
            }
        });
    }

    /**
     * 刷新UI显示 - 子类重写此方法
     */
    public refresh(data?: any): void {
        if (data !== undefined) {
            this._showData = data;
        }
        this.onRefresh(this._showData);
    }

    /**
     * 显示前回调 - 子类重写
     */
    protected onBeforeShow(data: any): void {
        // 子类实现
    }

    /**
     * 显示后回调 - 子类重写  
     */
    protected onAfterShow(data: any): void {
        // 子类实现
    }

    /**
     * 隐藏前回调 - 子类重写
     */
    protected onBeforeHide(): void {
        // 子类实现
    }

    /**
     * 隐藏后回调 - 子类重写
     */
    protected onAfterHide(): void {
        // 子类实现
    }

    /**
     * 刷新UI回调 - 子类重写
     */
    protected onRefresh(data: any): void {
        // 子类实现
    }

    /**
     * 播放显示动画
     */
    private _playShowAnimation(animation: UIAnimationType, duration: number, callback: () => void): void {
        this.node.stopAllActions();

        switch (animation) {
            case UIAnimationType.Fade:
                this.node.opacity = 0;
                tween(this.node)
                    .to(duration, { opacity: 255 })
                    .call(callback)
                    .start();
                break;

            case UIAnimationType.Scale:
                this.node.scale = Vec3.ZERO;
                tween(this.node)
                    .to(duration, { scale: Vec3.ONE }, { easing: "backOut" })
                    .call(callback)
                    .start();
                break;

            case UIAnimationType.SlideUp:
                const originalY = this.node.position.y;
                this.node.setPosition(this.node.position.x, originalY - 500, this.node.position.z);
                tween(this.node)
                    .to(duration, { position: new Vec3(this.node.position.x, originalY, this.node.position.z) }, { easing: "quartOut" })
                    .call(callback)
                    .start();
                break;

            case UIAnimationType.SlideDown:
                const originalY2 = this.node.position.y;
                this.node.setPosition(this.node.position.x, originalY2 + 500, this.node.position.z);
                tween(this.node)
                    .to(duration, { position: new Vec3(this.node.position.x, originalY2, this.node.position.z) }, { easing: "quartOut" })
                    .call(callback)
                    .start();
                break;

            default:
                callback();
                break;
        }
    }

    /**
     * 播放隐藏动画
     */
    private _playHideAnimation(animation: UIAnimationType, duration: number, callback: () => void): void {
        this.node.stopAllActions();

        switch (animation) {
            case UIAnimationType.Fade:
                tween(this.node)
                    .to(duration, { opacity: 0 })
                    .call(callback)
                    .start();
                break;

            case UIAnimationType.Scale:
                tween(this.node)
                    .to(duration, { scale: Vec3.ZERO }, { easing: "backIn" })
                    .call(callback)
                    .start();
                break;

            case UIAnimationType.SlideUp:
                tween(this.node)
                    .to(duration, { position: new Vec3(this.node.position.x, this.node.position.y + 500, this.node.position.z) }, { easing: "quartIn" })
                    .call(callback)
                    .start();
                break;

            case UIAnimationType.SlideDown:
                tween(this.node)
                    .to(duration, { position: new Vec3(this.node.position.x, this.node.position.y - 500, this.node.position.z) }, { easing: "quartIn" })
                    .call(callback)
                    .start();
                break;

            default:
                callback();
                break;
        }
    }

    /**
     * 显示完成
     */
    private _onShowComplete(): void {
        this._state = UIState.Shown;
        this.onAfterShow(this._showData);
    }

    /**
     * 隐藏完成
     */
    private _onHideComplete(): void {
        this._state = UIState.Hidden;
        this.node.active = false;
        this.onAfterHide();
    }

    /**
     * 组件销毁时调用
     */
    protected onDestroy(): void {
        this.unbindEvents();
        this._showData = null;
    }
}