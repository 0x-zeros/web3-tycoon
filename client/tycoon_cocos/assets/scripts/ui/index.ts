/**
 * FairyGUI UI系统入口文件
 * 统一导出所有UI相关的类和接口
 */

// 核心系统
export { UIManager } from "./core/UIManager";
export { UIBase } from "./core/UIBase";
export * from "./core/UITypes";

// 事件系统
export { EventBus } from "./events/EventBus";
export { EventTypes } from "./events/EventTypes";
export { Blackboard } from "./events/Blackboard";

// 游戏界面
export { UIModeSelect } from "./game/UIModeSelect";
export { UIInGame } from "./game/UIInGame";

// 工具类
export { UIHelper } from "./utils/UIHelper";

// 导出FairyGUI类型
import * as fgui from "fairygui-cc";
export { fgui };

// 导入核心类以便在函数中使用
import { UIManager } from "./core/UIManager";
import { EventBus } from "./events/EventBus";
import { EventTypes } from "./events/EventTypes";
import { Blackboard } from "./events/Blackboard";
import { UIModeSelect } from "./game/UIModeSelect";
import { UIInGame } from "./game/UIInGame";


const PRELOAD_PACKAGES = ["Common", "ModeSelect", "InGame"];

// 防止重复注册全局事件监听
let _globalListenersSetup = false;

/**
 * FairyGUI UI系统初始化函数
 * 在游戏启动时调用此函数来初始化UI系统
 */
export async function initUISystem(config?: any): Promise<boolean> {
    console.log("[UISystem] Initializing FairyGUI UI system...");
    
    try {
        // 初始化UI管理器
        UIManager.instance.init(config);
        
        // 预加载公共依赖包
        const loaded = await UIManager.instance.loadCommonPackages();
        if (!loaded) {
            console.error("[UISystem] Failed to load common packages");
            return false;
        }
        
        // 设置事件总线调试模式
        if (config?.debug) {
            EventBus.setDebug(true);
            Blackboard.instance.setDebug(true);
        }

        // 提前注册全局事件监听（去重保护）
        if (!_globalListenersSetup) {
            _setupGlobalUIEventListeners();
            _globalListenersSetup = true;
        }
        
        console.log("[UISystem] FairyGUI UI system initialized successfully");
        return true;
    } catch (error) {
        console.error("[UISystem] Failed to initialize UI system:", error);
        return false;
    }
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
    
    console.log("[UISystem] FairyGUI UI system cleaned up successfully");
}

/**
 * 便捷注册方法 - 注册模式选择UI
 */
export function registerModeSelectUI(packageName: string, componentName: string="Main"): void {
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
export function registerInGameUI(packageName: string, componentName: string="Main"): void {
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
    
    // 过滤掉已经在初始化时加载的公共包
    const packagesToLoad = packageNames.filter(name => !UIManager.instance.isPackageLoaded(name));
    
    for (const packageName of packagesToLoad) {
        const loaded = await UIManager.instance.loadPackage(packageName);
        if (!loaded) {
            console.warn(`[UISystem] Failed to load package: ${packageName}`);
        }
    }
    
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
        const initialized = await initUISystem({
            debug: true,
            enableCache: true,
            designResolution: { width: 1920, height: 1080 }
        });
        
        if (!initialized) {
            throw new Error("UI system initialization failed");
        }

        // 2. 预加载UI包
        await preloadUIPackages(PRELOAD_PACKAGES);

        // 3. 注册UI界面
        registerModeSelectUI(PRELOAD_PACKAGES[1]);
        registerInGameUI(PRELOAD_PACKAGES[2]);

        // 4. 显示初始界面
        await showModeSelect();

        console.log("[UISystem] Game UI system initialized completely");

    } catch (error) {
        console.error("[UISystem] Failed to initialize game UI system:", error);
        throw error;
    }
}

/**
 * 设置全局UI事件监听器
 */
function _setupGlobalUIEventListeners(): void {
    // 监听显示主菜单事件
    EventBus.onEvent(EventTypes.UI.ShowMainMenu, async (data) => {
        console.log("[UISystem] ShowMainMenu event received:", data);
        await showModeSelect();
    });

    EventBus.onEvent(EventTypes.Game.GameStart, async (data) => {
        console.log("[UISystem] Game.GameStart event received:", data);

        //todo 开始选地图等
        await showInGame();
    });

    // 监听其他全局UI事件
    // TODO: 添加更多UI事件监听器
}