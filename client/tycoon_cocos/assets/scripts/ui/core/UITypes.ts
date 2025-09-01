import { Component, Node } from "cc";

/**
 * UI层级枚举
 */
export enum UILayer {
    /** 底层UI - 如背景、地图等 */
    Background = 0,
    /** 普通UI层 - 游戏主界面 */
    Normal = 100,
    /** 弹窗层 - 对话框、设置等 */
    Popup = 200,
    /** 顶层UI - 引导、loading等 */
    Top = 300,
    /** 系统层 - 错误提示、网络断开等 */
    System = 400
}

/**
 * UI状态枚举
 */
export enum UIState {
    /** 隐藏状态 */
    Hidden = "hidden",
    /** 显示中 */
    Showing = "showing", 
    /** 已显示 */
    Shown = "shown",
    /** 隐藏中 */
    Hiding = "hiding"
}

/**
 * UI动画类型
 */
export enum UIAnimationType {
    /** 无动画 */
    None = "none",
    /** 淡入淡出 */
    Fade = "fade",
    /** 缩放 */
    Scale = "scale",
    /** 从左滑入 */
    SlideLeft = "slide_left",
    /** 从右滑入 */
    SlideRight = "slide_right",
    /** 从上滑入 */
    SlideUp = "slide_up",
    /** 从下滑入 */
    SlideDown = "slide_down",
    /** 自定义动画 */
    Custom = "custom"
}

/**
 * UI配置接口
 */
export interface UIConfig {
    /** 预制体路径 */
    prefabPath: string;
    /** UI层级 */
    layer: UILayer;
    /** 是否缓存 */
    cache?: boolean;
    /** 进入动画 */
    showAnimation?: UIAnimationType;
    /** 退出动画 */
    hideAnimation?: UIAnimationType;
    /** 动画持续时间(秒) */
    animationDuration?: number;
    /** 是否独占显示(显示时隐藏同层其他UI) */
    exclusive?: boolean;
    /** 是否阻挡点击 */
    blockInput?: boolean;
    /** 自定义数据 */
    customData?: any;
}

/**
 * UI显示参数
 */
export interface UIShowOptions {
    /** 传递给UI的数据 */
    data?: any;
    /** 显示动画类型 */
    animation?: UIAnimationType;
    /** 动画持续时间 */
    animationDuration?: number;
    /** 显示完成回调 */
    onComplete?: () => void;
    /** 是否立即显示(跳过动画) */
    immediate?: boolean;
}

/**
 * UI隐藏参数
 */
export interface UIHideOptions {
    /** 隐藏动画类型 */
    animation?: UIAnimationType;
    /** 动画持续时间 */
    animationDuration?: number;
    /** 隐藏完成回调 */
    onComplete?: () => void;
    /** 是否立即隐藏(跳过动画) */
    immediate?: boolean;
    /** 是否销毁(非缓存UI) */
    destroy?: boolean;
}

/**
 * UI构造函数接口
 */
export interface UIConstructor<T extends Component = Component> {
    new (): T;
}

/**
 * UI管理器配置
 */
export interface UIManagerConfig {
    /** UI根节点 */
    uiRoot?: Node;
    /** 默认动画持续时间 */
    defaultAnimationDuration?: number;
    /** 是否启用对象池 */
    enablePool?: boolean;
    /** 对象池最大数量 */
    poolMaxSize?: number;
    /** 是否启用调试模式 */
    debug?: boolean;
}

/**
 * UI事件类型
 */
export enum UIEventType {
    /** UI显示前 */
    BeforeShow = "before_show",
    /** UI显示后 */
    AfterShow = "after_show", 
    /** UI隐藏前 */
    BeforeHide = "before_hide",
    /** UI隐藏后 */
    AfterHide = "after_hide",
    /** UI销毁前 */
    BeforeDestroy = "before_destroy",
    /** UI管理器状态变化 */
    ManagerStateChange = "manager_state_change"
}

/**
 * UI事件数据
 */
export interface UIEventData {
    /** UI标识 */
    uiId: string;
    /** UI组件实例 */
    uiComponent?: Component;
    /** 事件类型 */
    eventType: UIEventType;
    /** 额外数据 */
    data?: any;
}