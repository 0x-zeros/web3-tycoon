import { Component, _decorator } from 'cc';
import { EventBus } from "../../events/EventBus";
import { Blackboard } from "../../events/Blackboard";
import * as fgui from "fairygui-cc";
import GameSettings from '../../config/GameSettings';

const { ccclass, property } = _decorator;

/**
 * UI基类 - 继承Component，可挂载到FairyGUI节点上
 * 所有游戏UI逻辑类都应该继承此类
 */
@ccclass('UIBase')
export abstract class UIBase extends Component {
    /** FairyGUI组件引用 */
    protected _panel: fgui.GComponent | null = null;
    /** UI名称 */
    protected _uiName: string = '';
    /** 是否已初始化 */
    protected _inited: boolean = false;
    /** 是否已显示 */
    protected _isShowing: boolean = false;
    /** UI数据 */
    protected _data: any = null;

    /**
     * Cocos组件生命周期 - 加载
     */
    protected onLoad(): void {
        // 在我们的架构中，panel引用是通过UIManager的setPanel方法设置的
        // 初始化逻辑在setPanel中执行，这里不需要做任何事情
    }

    /**
     * Cocos组件生命周期 - 启用
     */
    protected onEnable(): void {
        if (!this._inited) return;
        
        this.bindEvents();
        this._isShowing = true;
        this.onShow(this._data);
    }

    /**
     * Cocos组件生命周期 - 禁用  
     */
    protected onDisable(): void {
        // console.log("[UIBase] onDisable", this.node.name);
        
        if (!this._inited) return;
        
        this.unbindEvents();
        this._isShowing = false;
        this.onHide();
    }

    /**
     * Cocos组件生命周期 - 销毁
     */
    protected onDestroy(): void {
        // console.log("[UIBase] onDestroy", this.node.name);

        if (this._inited) {
            this._inited = false;
        }
    }

    /**
     * 设置UI名称（由UIManager调用）
     */
    public setUIName(uiName: string): void {
        this._uiName = uiName;
    }

    /**
     * 设置FairyGUI面板引用（由UIManager调用）
     */
    public setPanel(panel: fgui.GComponent): void {
        this._panel = panel;
        
        // 设置面板后立即初始化UI
        if (!this._inited) {
            this._initComponent();
        }
    }

    /**
     * 初始化组件
     */
    private _initComponent(): void {
        if (this._inited || !this._panel) {
            return;
        }

        try {
            this.onInit();
            this._inited = true;
        } catch (e) {
            console.error(`[UIBase] Error initializing UI ${this._uiName}:`, e);
        }
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
    get panel(): fgui.GComponent | null {
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
     * 显示UI（通过激活节点）
     */
    public show(data?: any, isFullScreen: boolean = true): void {
        this._data = data;

        //设置组件全屏，即大小和逻辑屏幕大小一致。
        if (isFullScreen) {
            const width = fgui?.GRoot?.inst.width || GameSettings.designWidth;
            const height = fgui?.GRoot?.inst.height || GameSettings.designHeight;
            this._panel?.setSize(width, height);
            console.log(`[UIBase] show, adjust size to ${width}x${height}`);
        }

        // 如果节点已经激活，手动调用onShow（缓存复用时）
        const wasActive = this.node.active;

        // 激活节点（会触发onEnable生命周期）
        this.node.active = true;

        // 如果节点之前就是激活状态，onEnable不会触发，需要手动调用onShow
        if (wasActive && this._inited) {
            this._isShowing = true;
            this.onShow(this._data);
        }
    }

    /**
     * 隐藏UI（通过停用节点）
     */
    public hide(): void {
        // 防御性检查：节点可能已被销毁
        if (!this.node) {
            return;
        }
        // 停用节点（会触发onDisable生命周期）
        this.node.active = false;
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
    protected getFGuiComponent(name: string): fgui.GComponent | null {
        const child = this.getChild(name);
        return child ? child.asCom : null;
    }

    /**
     * 获取按钮
     */
    protected getButton(name: string): fgui.GButton | null {
        const child = this.getChild(name);
        return child ? child as fgui.GButton : null;
    }

    /**
     * 获取文本
     */
    protected getText(name: string): fgui.GTextField | null {
        const child = this.getChild(name);
        return child ? child as fgui.GTextField : null;
    }

    /**
     * 获取图片
     */
    protected getImage(name: string): fgui.GImage | null {
        const child = this.getChild(name);
        return child ? child as fgui.GImage : null;
    }

    /**
     * 获取列表
     */
    protected getList(name: string): fgui.GList | null {
        const child = this.getChild(name);
        return child ? child as fgui.GList : null;
    }


    /**
     * 获取加载器
     */
    protected getLoader(name: string): fgui.GLoader | null {
        const child = this.getChild(name);
        return child ? child as fgui.GLoader : null;
    }

    /**
     * 获取进度条
     */
    protected getProgressBar(name: string): fgui.GProgressBar | null {
        const child = this.getChild(name);
        return child ? child as fgui.GProgressBar : null;
    }

    /**
     * 获取滑动条
     */
    protected getSlider(name: string): fgui.GSlider | null {
        const child = this.getChild(name);
        return child ? child as fgui.GSlider : null;
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
    protected onShow(_data?: any): void {
        // 子类重写
    }

    /**
     * 隐藏回调 - 子类重写
     */
    protected onHide(): void {
        // 子类重写
    }

    /**
     * 刷新回调 - 子类重写
     */
    protected onRefresh(_data?: any): void {
        // 子类重写
    }
}