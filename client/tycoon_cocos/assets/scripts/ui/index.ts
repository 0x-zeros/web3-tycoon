/**
 * UI系统入口文件
 * 统一导出所有UI相关的类和接口
 */

// 核心系统
export { UIManager } from "./core/UIManager";
export { UIBase } from "./core/UIBase";
export * from "./core/UITypes";

// 事件系统
export { EventBus, EventBusHelpers } from "./events/EventBus";
export { EventTypes } from "./events/EventTypes";
export { Blackboard } from "./events/Blackboard";

// 基础组件
export { UIButton } from "./components/UIButton";
export { UIPanel, PanelState } from "./components/UIPanel";
export { UIDialog, DialogType, DialogResult } from "./components/UIDialog";

// 游戏界面
export { MainMenuUI } from "./game/MainMenuUI";
export { GameHUD } from "./game/GameHUD";

// 工具类
export { UIHelper } from "./utils/UIHelper";
export { UILoader } from "./utils/UILoader";

/**
 * UI系统初始化函数
 * 在游戏启动时调用此函数来初始化UI系统
 */
export function initUISystem(config?: any): void {
    console.log("[UISystem] Initializing UI system...");
    
    // 初始化UI管理器
    UIManager.instance.init(config);
    
    // 设置事件总线调试模式
    if (config?.debug) {
        EventBus.setDebug(true);
        Blackboard.instance.setDebug(true);
    }
    
    // 注册默认UI界面
    // 这里可以注册常用的UI界面配置
    // UIManager.instance.registerUI("MainMenu", {
    //     prefabPath: "prefabs/ui/MainMenuUI",
    //     layer: UILayer.Normal,
    //     cache: true
    // }, MainMenuUI);
    
    console.log("[UISystem] UI system initialized successfully");
}

/**
 * UI系统清理函数
 * 在游戏退出时调用此函数来清理UI系统
 */
export function cleanupUISystem(): void {
    console.log("[UISystem] Cleaning up UI system...");
    
    // 清理UI管理器
    UIManager.instance.destroy();
    
    // 清理事件总线
    EventBus.destroy();
    
    // 清理黑板
    Blackboard.instance.destroy();
    
    // 清理资源加载器
    UILoader.releaseAll();
    
    console.log("[UISystem] UI system cleaned up successfully");
}