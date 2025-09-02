/**
 * FairyGUI UI系统入口文件
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

// 游戏界面
export { UIModeSelect } from "./game/UIModeSelect";
export { UIInGame } from "./game/UIInGame";

// 工具类
export { UIHelper } from "./utils/UIHelper";
export { UILoader } from "./utils/UILoader";

// 导出FairyGUI类型
import * as fgui from "fairygui-cc";
export { fgui };

/**
 * FairyGUI UI系统初始化函数
 * 在游戏启动时调用此函数来初始化UI系统
 */
export function initUISystem(config?: any): void {
    console.log("[UISystem] Initializing FairyGUI UI system...");
    
    // 初始化UI管理器
    UIManager.instance.init(config);
    
    // 设置事件总线调试模式
    if (config?.debug) {
        EventBus.setDebug(true);
        Blackboard.instance.setDebug(true);
        UILoader.setDebug(true);
    }
    
    console.log("[UISystem] FairyGUI UI system initialized successfully");
}

/**
 * UI系统清理函数
 * 在游戏退出时调用此函数来清理UI系统
 */
export function cleanupUISystem(): void {
    console.log("[UISystem] Cleaning up FairyGUI UI system...");
    
    // 清理UI管理器
    UIManager.instance.destroy();
    
    // 清理事件总线
    EventBus.destroy();
    
    // 清理黑板
    Blackboard.instance.destroy();
    
    // 清理资源加载器
    UILoader.unloadAllPackages();
    
    console.log("[UISystem] FairyGUI UI system cleaned up successfully");
}

/**
 * 便捷注册方法 - 注册模式选择UI
 */
export function registerModeSelectUI(packageName: string = "Common", componentName: string = "ModeSelect"): void {
    UIManager.instance.registerUI("ModeSelect", {
        packageName,
        componentName,
        cache: true,
        isWindow: false
    }, UIModeSelect);
}

/**
 * 便捷注册方法 - 注册游戏内UI
 */
export function registerInGameUI(packageName: string = "Game", componentName: string = "InGame"): void {
    UIManager.instance.registerUI("InGame", {
        packageName,
        componentName,
        cache: true,
        isWindow: false
    }, UIInGame);
}

/**
 * 便捷方法 - 预加载UI包
 */
export async function preloadUIPackages(packageNames: string[]): Promise<void> {
    console.log("[UISystem] Preloading UI packages:", packageNames);
    
    await UILoader.preloadPackages(packageNames, (finished, total, packageName) => {
        const progress = (finished / total) * 100;
        console.log(`[UISystem] Loading progress: ${progress.toFixed(1)}% (${packageName})`);
    });
    
    console.log("[UISystem] UI packages preloaded successfully");
}

/**
 * 便捷方法 - 显示模式选择界面
 */
export async function showModeSelect(): Promise<UIModeSelect | null> {
    return UIManager.instance.showUI<UIModeSelect>("ModeSelect");
}

/**
 * 便捷方法 - 显示游戏内界面
 */
export async function showInGame(): Promise<UIInGame | null> {
    return UIManager.instance.showUI<UIInGame>("InGame");
}

/**
 * 便捷方法 - 隐藏所有UI
 */
export async function hideAllUI(): Promise<void> {
    await UIManager.instance.hideAllUI();
}

/**
 * 完整的UI系统初始化示例
 */
export async function initializeGameUI(): Promise<void> {
    console.log("[UISystem] Initializing complete game UI system...");
    
    try {
        // 1. 初始化UI系统
        initUISystem({
            debug: true,
            enableCache: true,
            designResolution: { width: 1136, height: 640 }
        });

        // 2. 预加载UI包
        await preloadUIPackages(["Common", "Game"]);

        // 3. 注册UI界面
        registerModeSelectUI();
        registerInGameUI();

        // 4. 显示初始界面
        await showModeSelect();

        console.log("[UISystem] Game UI system initialized completely");

    } catch (error) {
        console.error("[UISystem] Failed to initialize game UI system:", error);
        throw error;
    }
}