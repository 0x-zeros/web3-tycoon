/**
 * UI事件类型枚举
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
    uiName: string;
    /** UI组件实例 */
    uiComponent?: any;
    /** 事件类型 */
    eventType: UIEventType;
    /** 额外数据 */
    data?: any;
}

/**
 * UI显示选项
 */
export interface UIShowOptions {
    /** 传递给UI的数据 */
    data?: any;
    /** 是否立即显示 */
    immediate?: boolean;
    /** 显示完成回调 */
    onComplete?: () => void;
}

/**
 * UI隐藏选项
 */
export interface UIHideOptions {
    /** 是否立即隐藏 */
    immediate?: boolean;
    /** 隐藏完成回调 */
    onComplete?: () => void;
    /** 是否销毁 */
    destroy?: boolean;
}

/**
 * FairyGUI包加载结果
 */
export interface PackageLoadResult {
    /** 是否成功 */
    success: boolean;
    /** 包名 */
    packageName: string;
    /** 错误信息 */
    error?: string;
}

/**
 * FairyGUI资源类型
 */
export enum FGUIResourceType {
    /** 图片 */
    Image = "image",
    /** 音频 */
    Audio = "audio", 
    /** 字体 */
    Font = "font",
    /** 组件 */
    Component = "component",
    /** 包 */
    Package = "package"
}