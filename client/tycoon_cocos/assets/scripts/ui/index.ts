/**
 * FairyGUI UI系统入口文件
 * 统一导出所有UI相关的类和接口
 */

// 核心系统
export { UIManager } from "./core/UIManager";
export { UIBase } from "./core/UIBase";
export * from "./core/UITypes";

// 事件系统
export { EventBus } from "../events/EventBus";
export { EventTypes } from "../events/EventTypes";
export { Blackboard } from "../events/Blackboard";

// 游戏界面
export { UIModeSelect } from "./game/UIModeSelect";
export { UIInGame } from "./game/UIInGame";

// 工具类
export { UIHelper } from "./utils/UIHelper";

// 导出FairyGUI类型
import * as fgui from "fairygui-cc";
export { fgui };

// 导入UIManager用于向后兼容的函数
import { UIManager } from "./core/UIManager";

/**
 * @deprecated 请使用 UIManager.initUISystem() 代替
 */
export const initUISystem = UIManager.initUISystem;

/**
 * @deprecated 请使用 UIManager.cleanupUISystem() 代替
 */
export const cleanupUISystem = UIManager.cleanupUISystem;

/**
 * @deprecated 请使用 UIManager.preloadUIPackages() 代替
 */
export const preloadUIPackages = UIManager.preloadUIPackages;

/**
 * @deprecated 请使用 UIManager.initializeGameUI() 代替
 */
export const initializeGameUI = UIManager.initializeGameUI;

/**
 * @deprecated 请使用 UIManager.instance.registerModeSelectUI() 代替
 */
export function registerModeSelectUI(packageName: string, componentName: string = "Main"): void {
    UIManager.instance.registerModeSelectUI(packageName, componentName);
}

/**
 * @deprecated 请使用 UIManager.instance.registerInGameUI() 代替
 */
export function registerInGameUI(packageName: string, componentName: string = "Main"): void {
    UIManager.instance.registerInGameUI(packageName, componentName);
}

/**
 * @deprecated 请使用 UIManager.instance.showModeSelect() 代替
 */
export async function showModeSelect() {
    return UIManager.instance.showModeSelect();
}

/**
 * @deprecated 请使用 UIManager.instance.showInGame() 代替
 */
export async function showInGame() {
    return UIManager.instance.showInGame();
}

/**
 * @deprecated 请使用 UIManager.instance.hideAllUI() 代替
 */
export async function hideAllUI(): Promise<void> {
    await UIManager.instance.hideAllUI();
}