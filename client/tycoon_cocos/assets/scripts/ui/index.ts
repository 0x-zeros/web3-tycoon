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

