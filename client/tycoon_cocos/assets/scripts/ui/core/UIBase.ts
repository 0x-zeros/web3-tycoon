import { EventBus } from "../events/EventBus";
import { Blackboard } from "../events/Blackboard";
import * as fgui from "fairygui-cc";

/**
 * UI基类 - 采用组合模式，持有FairyGUI组件引用
 * 所有游戏UI逻辑类都应该继承此类
 */
export abstract class UIBase {
    /** FairyGUI组件引用 */
    protected _panel: fgui.GComponent;
    /** UI名称 */
    protected _uiName: string;
    /** 是否已初始化 */
    protected _inited: boolean = false;
    /** 是否已显示 */
    protected _isShowing: boolean = false;
    /** UI数据 */
    protected _data: any = null;

    /**
     * 构造函数
     */
    constructor(panel: fgui.GComponent, uiName: string) {
        this._panel = panel;
        this._uiName = uiName;
    }

    /**
     * 获取UI名称
     */
    get uiName(): string {
        return this._uiName;
    }

    /**
     * 获取FairyGUI面板引用
     */
    get panel(): fgui.GComponent {
        return this._panel;
    }

    /**
     * 是否已显示
     */
    get isShowing(): boolean {
        return this._isShowing;
    }

    /**
     * 获取显示数据
     */
    get data(): any {
        return this._data;
    }

    /**
     * 初始化UI
     * 只会调用一次，用于设置UI的默认状态
     */
    public init(): void {
        if (this._inited) {
            return;
        }

        this.onInit();
        this.bindEvents();
        this._inited = true;
    }

    /**
     * 显示UI
     */
    public show(data?: any): void {
        this._data = data;
        this._isShowing = true;

        // 确保已初始化
        if (!this._inited) {
            this.init();
        }

        // 显示面板
        if (this._panel && !this._panel.visible) {
            this._panel.visible = true;
        }

        this.onShow(data);
    }

    /**
     * 隐藏UI
     */
    public hide(): void {
        this._isShowing = false;

        // 隐藏面板
        if (this._panel) {
            this._panel.visible = false;
        }

        this.onHide();
    }

    /**
     * 销毁UI
     */
    public destroy(): void {
        this.unbindEvents();
        this.onDestroy();

        // 清理FairyGUI组件
        if (this._panel) {
            this._panel.dispose();
            this._panel = null as any;
        }

        this._data = null;
        this._inited = false;
        this._isShowing = false;
    }

    /**
     * 刷新UI显示
     */
    public refresh(data?: any): void {
        if (data !== undefined) {
            this._data = data;
        }
        this.onRefresh(this._data);
    }

    // ================== 便捷方法 ==================

    /**
     * 获取子对象
     */
    protected getChild(name: string): fgui.GObject | null {
        return this._panel ? this._panel.getChild(name) : null;
    }

    /**
     * 获取子组件
     */
    protected getComponent(name: string): fgui.GComponent | null {
        const child = this.getChild(name);
        return child ? child.asCom : null;
    }

    /**
     * 获取按钮
     */
    protected getButton(name: string): fgui.GButton | null {
        const child = this.getChild(name);
        return child ? child.asButton : null;
    }

    /**
     * 获取文本
     */
    protected getText(name: string): fgui.GTextField | null {
        const child = this.getChild(name);
        return child ? child.asTextField : null;
    }

    /**
     * 获取图片
     */
    protected getImage(name: string): fgui.GImage | null {
        const child = this.getChild(name);
        return child ? child.asImage : null;
    }

    /**
     * 获取列表
     */
    protected getList(name: string): fgui.GList | null {
        const child = this.getChild(name);
        return child ? child.asList : null;
    }

    /**
     * 获取进度条
     */
    protected getProgressBar(name: string): fgui.GProgressBar | null {
        const child = this.getChild(name);
        return child ? child.asProgress : null;
    }

    /**
     * 获取滑动条
     */
    protected getSlider(name: string): fgui.GSlider | null {
        const child = this.getChild(name);
        return child ? child.asSlider : null;
    }

    /**
     * 获取控制器
     */
    protected getController(name: string): fgui.Controller | null {
        return this._panel ? this._panel.getController(name) : null;
    }

    /**
     * 获取过渡动画
     */
    protected getTransition(name: string): fgui.Transition | null {
        return this._panel ? this._panel.getTransition(name) : null;
    }

    // ================== 生命周期回调（子类重写） ==================

    /**
     * 初始化回调 - 子类重写
     * 只调用一次，用于初始化UI元素
     */
    protected onInit(): void {
        // 子类重写
    }

    /**
     * 绑定事件 - 子类重写
     */
    protected bindEvents(): void {
        // 子类重写
    }

    /**
     * 解绑事件 - 子类重写
     */
    protected unbindEvents(): void {
        // 清理EventBus和Blackboard的监听
        EventBus.offTarget(this);
        Blackboard.instance.unwatchTarget(this);
    }

    /**
     * 显示回调 - 子类重写
     */
    protected onShow(data?: any): void {
        // 子类重写
    }

    /**
     * 隐藏回调 - 子类重写
     */
    protected onHide(): void {
        // 子类重写
    }

    /**
     * 销毁回调 - 子类重写
     */
    protected onDestroy(): void {
        // 子类重写
    }

    /**
     * 刷新回调 - 子类重写
     */
    protected onRefresh(data?: any): void {
        // 子类重写
    }
}