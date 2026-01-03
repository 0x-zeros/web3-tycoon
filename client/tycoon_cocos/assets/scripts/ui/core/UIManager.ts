import { warn, error, director, Canvas, Node } from "cc";
import { UIBase } from "./UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { Blackboard } from "../../events/Blackboard";
import { UI3DInteractionManager } from "../../events/UI3DInteractionManager";
import { MapManager } from "../../map/MapManager";
import * as fgui from "fairygui-cc";

// 从 UITypes 导入 UILayer（避免循环依赖）
import { UILayer } from "./UITypes";

// 重新导出 UILayer（保持向后兼容）
export { UILayer };

// 导入UI类以便在静态方法中使用
import { UIModeSelect } from "../game/UIModeSelect";
import { UIInGame } from "../game/UIInGame";
import { UIMapElement } from "../game/UIMapElement";
import { UIMapSelect } from "../game/UIMapSelect";
import { UIWallet } from "../game/UIWallet";
import { UIGameConfig } from "../game/UIGameConfig";
import { UICommonSetting } from "../game/UICommonSetting";
import { UICommonLayout } from "../game/UICommonLayout";
import { UIGameEnd } from "../game/UIGameEnd";
import { UIBankruptcy } from "../game/UIBankruptcy";
import { UIFairyGUIAdapter } from "../utils/UIFairyGUIAdapter";
import { UIMessage, MessageBoxType } from "../utils/UIMessage";
import { UINotification } from "../utils/UINotification";

/**
 * UI构造函数接口 - Component类构造函数
 */
export interface UIConstructor<T extends UIBase = UIBase> {
    new (): T;
}

/**
 * UI配置接口
 */
export interface UIConfig {
    /** 包名 */
    packageName: string;
    /** 组件名 */
    componentName: string;
    /** 是否缓存 */
    cache?: boolean;
    /** 是否作为弹窗显示 */
    isWindow?: boolean;
    /** 弹窗是否模态 */
    modal?: boolean;
    /** UI所在层级（默认NORMAL） */
    layer?: UILayer;
}

/**
 * UI管理器配置
 */
export interface UIManagerConfig {
    /** 是否启用调试模式 */
    debug?: boolean;
    /** 是否启用UI缓存 */
    enableCache?: boolean;
    /** 设计分辨率 */
    designResolution?: { width: number; height: number };
}

/**
 * UI管理器 - FairyGUI版本
 * 负责FairyGUI的初始化、UI包管理和UI生命周期管理
 */
export class UIManager {
    private static _instance: UIManager | null = null;

    /** FairyGUI根节点 */
    private _groot: fgui.GRoot | null = null;
    /** UI层级容器 */
    private _layers: Map<UILayer, fgui.GComponent> = new Map();
    /** 在resources目录下的UI目录 */
    private static readonly UI_DIR = 'ui/';
    /** 公共依赖包列表 */
    private static readonly COMMON_PACKAGES = ["Common"];
    /** 预加载包列表 */
    private static readonly PRELOAD_PACKAGES = ["Common", "ModeSelect", "MapSelect", "InGame"];
    /** 已注册的UI配置 */
    private _uiConfigs: Map<string, UIConfig> = new Map();
    /** UI构造函数 */
    private _uiConstructors: Map<string, UIConstructor> = new Map();
    /** 当前显示的UI实例 */
    private _activeUIs: Map<string, UIBase> = new Map();
    /** 全局持久化的 CommonLayout UI 实例（包含 Wallet 和 CommonSetting） */
    private _commonLayoutUI: UICommonLayout | null = null;
    /** UI缓存池 */
    private _uiCache: Map<string, UIBase> = new Map();
    /** 已加载的包 */
    private _loadedPackages: Set<string> = new Set();
    /** 管理器配置 */
    private _config: UIManagerConfig = {};
    /** 是否已初始化 */
    private _inited: boolean = false;
    /** 防止重复注册全局事件监听 */
    private _globalListenersSetup: boolean = false;

    /**
     * 获取单例实例
     */
    public static get instance(): UIManager {
        if (!this._instance) {
            this._instance = new UIManager();
        }
        return this._instance;
    }

    /**
     * 私有构造函数
     */
    private constructor() {}

    /**
     * 初始化UI管理器
     */
    public init(config: UIManagerConfig = {}): void {
        if (this._inited) {
            warn("[UIManager] Already initialized!");
            return;
        }

        try {
            this._config = {
                debug: false,
                enableCache: true,
                designResolution: { width: 1136, height: 640 },
                ...config
            };

            this._initFairyGUI();
            this._inited = true;

            if (this._config.debug) {
                console.log("[UIManager] Initialized with FairyGUI");
            }
        } catch (error) {
            console.error("[UIManager] Failed to initialize UI system:", error);
            // 重新抛出错误，让调用者能够正确处理
            throw error;
        }
    }

    /**
     * 初始化FairyGUI
     */
    private _initFairyGUI(): void {
        try {
            // 检查场景和Canvas是否准备好
            const scene = director.getScene();
            if (!scene) {
                throw new Error("场景未准备好，无法初始化FairyGUI");
            }
            
            const canvas = scene.getComponentInChildren(Canvas);
            if (!canvas) {
                throw new Error("场景中找不到Canvas组件，FairyGUI需要Canvas才能工作");
            }
            
            console.log("[UIManager] Scene and Canvas ready, initializing FairyGUI");
            
            // 检查是否已经初始化过
            // if (fgui.GRoot.inst) {
            //     this._groot = fgui.GRoot.inst;
            //     console.log("[UIManager] FairyGUI already initialized, reusing existing instance");
            // }
            // else
            {
                // 先创建GRoot实例
                //注意 FairyGUI 的 GRoot.create 内部硬编码查找场景根节点下名为 “Canvas” 的节点
                //所以场景里的UIRoot要命名为Canvas
                fgui.GRoot.create();

                // 然后获取实例
                this._groot = fgui.GRoot.inst;
            }
            
            if (!this._groot) {
                throw new Error("FairyGUI GRoot创建失败");
            }

            //添加UIFairyGUIAdapter脚本
            this._groot.node.addComponent(UIFairyGUIAdapter);

            
            // FairyGUI会自动处理设计分辨率
            // 不需要手动调用setContentScaleFactor

            if (this._config.debug) {
                console.log("[UIManager] FairyGUI initialized", {
                    groot: this._groot,
                    designResolution: this._config.designResolution
                });
            }

            // 检查节点是否有效再添加组件
            if (this._groot.node) {
                // 检查是否已经有UI3DInteractionManager组件
                let interactionManager = this._groot.node.getComponent(UI3DInteractionManager);
                if (!interactionManager) {
                    this._groot.node.addComponent(UI3DInteractionManager);
                }
            } else {
                console.warn("[UIManager] FairyGUI根节点无效，跳过UI3DInteractionManager添加");
            }

            // 初始化UI分层容器
            this._initLayers();

        } catch (error) {
            console.error("[UIManager] FairyGUI初始化失败:", error);
            throw error;
        }

        // 设置事件总线调试模式
        if (this._config.debug) {
            EventBus.setDebug(true);
            Blackboard.instance.setDebug(true);
        }
    }

    /**
     * 初始化UI分层容器
     */
    private _initLayers(): void {
        if (!this._groot) {
            console.error("[UIManager] GRoot not initialized");
            return;
        }

        const layerConfigs = [
            { name: "BackgroundLayer", layer: UILayer.BACKGROUND, touchable: false },
            { name: "SceneLayer", layer: UILayer.SCENE, touchable: true },
            { name: "NormalLayer", layer: UILayer.NORMAL, touchable: true },
            { name: "PersistentLayer", layer: UILayer.PERSISTENT, touchable: true },
            { name: "PopupLayer", layer: UILayer.POPUP, touchable: true },
            { name: "ModalLayer", layer: UILayer.MODAL, touchable: true },  // 改为 true，让 MessageBox 可以接收点击
            { name: "NotificationLayer", layer: UILayer.NOTIFICATION, touchable: false },
            { name: "SystemLayer", layer: UILayer.SYSTEM, touchable: false },
            { name: "TopLayer", layer: UILayer.TOP, touchable: true }
        ];

        layerConfigs.forEach(config => {
            const layer = new fgui.GComponent();
            layer.name = config.name;
            layer.sortingOrder = config.layer;
            layer.setSize(this._groot!.width, this._groot!.height);
            layer.addRelation(this._groot!, fgui.RelationType.Size);
            layer.touchable = config.touchable;
            layer.opaque = false;  // 允许点击穿透到下层

            this._groot!.addChild(layer);
            this._layers.set(config.layer, layer);
        });

        if (this._config.debug) {
            console.log("[UIManager] UI layers initialized:", this._layers.size);
        }
    }

    /**
     * 获取指定层级的容器
     */
    public getLayer(layer: UILayer): fgui.GComponent | null {
        return this._layers.get(layer) || null;
    }

    /**
     * 加载UI包 - 使用FairyGUI第一种方式（从resources加载）
     */
    public async loadPackage(packageName: string): Promise<boolean> {
        if (this._loadedPackages.has(packageName)) {
            if (this._config.debug) {
                console.log(`[UIManager] Package ${packageName} already loaded`);
            }
            return true;
        }

        // 先确保公共依赖包已加载
        await this._ensureCommonPackagesLoaded();

        return this._loadSinglePackage(packageName);
    }

    /**
     * 确保公共依赖包已加载
     */
    private async _ensureCommonPackagesLoaded(): Promise<void> {
        for (const commonPackage of UIManager.COMMON_PACKAGES) {
            if (!this._loadedPackages.has(commonPackage)) {
                if (this._config.debug) {
                    console.log(`[UIManager] Loading required common package: ${commonPackage}`);
                }
                const loaded = await this._loadSinglePackage(commonPackage);
                if (!loaded) {
                    throw new Error(`Failed to load required common package: ${commonPackage}`);
                }
            }
        }
    }

    /**
     * 加载单个包的内部实现
     */
    private _loadSinglePackage(packageName: string): Promise<boolean> {
        if (this._loadedPackages.has(packageName)) {
            return Promise.resolve(true);
        }

        return new Promise<boolean>((resolve) => {
            if (this._config.debug) {
                console.log(`[UIManager] Loading package: ${packageName}`);
            }

            // import { resources } from "cc";
            // import * as fgui from "fairygui-cc";

            // resources.load("ui/MainUI", fgui.AssetType, (err, pkg) => {
            //     if (err) {
            //         console.error(err);
            //         return;
            //     }
            //     fgui.UIPackage.addPackage(pkg);
            //     console.log("手动加载成功:", pkg);

            //     const view = fgui.UIPackage.createObject("MainUI", "MainPanel").asCom;
            //     fgui.GRoot.inst.addChild(view);
            // });
            
            // 从resources目录加载
            fgui.UIPackage.loadPackage(UIManager.UI_DIR + packageName, (err: any) => {
                if (err) {
                    error(`[UIManager] Failed to load package ${packageName}:`, err);
                    resolve(false);
                } else {
                    this._loadedPackages.add(packageName);
                    
                    if (this._config.debug) {
                        console.log(`[UIManager] Package ${packageName} loaded successfully`);
                    }
                    
                    resolve(true);
                }
            });
        });
    }

    /**
     * 预加载公共依赖包
     */
    public async loadCommonPackages(): Promise<boolean> {
        try {
            await this._ensureCommonPackagesLoaded();
            return true;
        } catch (e) {
            error(`[UIManager] Failed to load common packages:`, e);
            return false;
        }
    }

    /**
     * 卸载UI包
     */
    public unloadPackage(packageName: string): boolean {
        if (!this._loadedPackages.has(packageName)) {
            if (this._config.debug) {
                console.log(`[UIManager] Package ${packageName} not loaded`);
            }
            return false;
        }

        try {
            fgui.UIPackage.removePackage(packageName);
            this._loadedPackages.delete(packageName);
            
            if (this._config.debug) {
                console.log(`[UIManager] Package ${packageName} unloaded`);
            }
            
            return true;
        } catch (e) {
            error(`[UIManager] Error unloading package ${packageName}:`, e);
            return false;
        }
    }

    /**
     * 卸载所有UI包
     */
    public unloadAllPackages(): void {
        const packageNames = Array.from(this._loadedPackages);
        
        for (const packageName of packageNames) {
            this.unloadPackage(packageName);
        }

        if (this._config.debug) {
            console.log(`[UIManager] Unloaded ${packageNames.length} packages`);
        }
    }

    /**
     * 检查包是否已加载
     */
    public isPackageLoaded(packageName: string): boolean {
        return this._loadedPackages.has(packageName);
    }

    /**
     * 获取已加载的包列表
     */
    public getLoadedPackages(): string[] {
        return Array.from(this._loadedPackages);
    }

    /**
     * 注册UI配置
     */
    public registerUI<T extends UIBase>(
        uiName: string, 
        config: UIConfig, 
        uiClass: UIConstructor<T>
    ): void {
        if (this._uiConfigs.has(uiName)) {
            warn(`[UIManager] UI ${uiName} already registered!`);
            return;
        }

        this._uiConfigs.set(uiName, config);
        this._uiConstructors.set(uiName, uiClass);

        if (this._config.debug) {
            console.log(`[UIManager] Registered UI: ${uiName}`, config);
        }
    }

    /**
     * 显示UI
     */
    public async showUI<T extends UIBase>(uiName: string, data?: any): Promise<T | null> {
        console.log(`[UIManager] Show UI: ${uiName}, data: ${data}`);

        if (!this._inited) {
            error("[UIManager] Not initialized!");
            return null;
        }

        const config = this._uiConfigs.get(uiName);
        const constructor = this._uiConstructors.get(uiName);

        if (!config || !constructor) {
            error(`[UIManager] UI ${uiName} not registered!`);
            return null;
        }

        // 检查UI是否已经激活
        const existingUI = this._activeUIs.get(uiName);
        if (existingUI && existingUI.node && existingUI.node.isValid) {
            if (this._config.debug) {
                console.log(`[UIManager] UI ${uiName} already exists and is valid, returning existing instance`);
            }
            // 刷新现有UI的数据
            existingUI.refresh(data);
            existingUI.show(data);
            return existingUI as T;
        } else if (existingUI) {
            if (this._config.debug) {
                console.log(`[UIManager] UI ${uiName} exists but node is invalid, removing from active list`);
            }
            this._activeUIs.delete(uiName);
        }

        try {
            // 确保包已加载
            if (!this._loadedPackages.has(config.packageName)) {
                const loaded = await this.loadPackage(config.packageName);
                if (!loaded) {
                    error(`[UIManager] Failed to load package for UI ${uiName}`);
                    return null;
                }
            }

            // 尝试从缓存获取
            let uiInstance = this._tryGetFromCache<T>(uiName);

            // 如果没有缓存，创建新实例
            if (!uiInstance) {
                uiInstance = await this._createUIInstance<T>(uiName, config, constructor);
                if (!uiInstance) {
                    return null;
                }
            }

            // 显示UI
            if (config.isWindow) {
                this._showAsWindow(uiInstance, config);
            } else {
                this._showAsComponent(uiInstance, config);
            }

            uiInstance.show(data);
            this._activeUIs.set(uiName, uiInstance);

            // 发送显示事件
            EventBus.emit(EventTypes.UI.ManagerStateChange, {
                action: "show",
                uiName: uiName,
                ui: uiInstance
            });

            if (this._config.debug) {
                console.log(`[UIManager] Showed UI: ${uiName}`);
            }

            return uiInstance;

        } catch (e) {
            error(`[UIManager] Error showing UI ${uiName}:`, e);
            return null;
        }
    }

    /**
     * 隐藏UI
     */
    public hideUI(uiName: string): void {
        const uiInstance = this._activeUIs.get(uiName);
        if (!uiInstance) {
            warn(`[UIManager] UI ${uiName} not active!`);
            return;
        }

        const config = this._uiConfigs.get(uiName);
        if (!config) {
            error(`[UIManager] UI config ${uiName} not found!`);
            return;
        }

        try {
            // 隐藏UI
            uiInstance.hide();

            // 从激活列表移除
            this._activeUIs.delete(uiName);

            // 处理FairyGUI显示
            if (config.isWindow && uiInstance.panel.parent) {
                // 如果是窗口，从GRoot移除
                const window = uiInstance.panel.parent as fgui.Window;
                if (window && window.hide) {
                    window.hide();
                }
            }

            // 缓存或销毁
            if (config.cache && this._config.enableCache) {
                this._uiCache.set(uiName, uiInstance);
            } else {
                uiInstance.destroy();
            }

            // 发送隐藏事件
            EventBus.emit(EventTypes.UI.ManagerStateChange, {
                action: "hide",
                uiName: uiName,
                ui: uiInstance
            });

            if (this._config.debug) {
                console.log(`[UIManager] Hidden UI: ${uiName}`);
            }

        } catch (e) {
            error(`[UIManager] Error hiding UI ${uiName}:`, e);
        }
    }

    /**
     * 切换UI显示/隐藏
     */
    public async toggle(layer: UILayer, uiName: string, data?: any): Promise<void> {
        if (this.isUIShowing(uiName)) {
            this.hideUI(uiName);
        } else {
            await this.showUI(uiName, data);
        }
    }

    /**
     * 获取UI实例（需要 layer 参数）
     */
    public getUI<T extends UIBase>(layer: UILayer, uiName: string): T | null {
        return (this._activeUIs.get(uiName) as T) || null;
    }

    /**
     * 获取活动的 UI 实例（不需要 layer 参数）
     * @param uiName UI 名称
     * @returns UI 实例或 null
     */
    public getActiveUI<T extends UIBase = UIBase>(uiName: string): T | null {
        return (this._activeUIs.get(uiName) as T) || null;
    }

    /**
     * 检查UI是否显示
     */
    public isUIShowing(uiName: string): boolean {
        const ui = this._activeUIs.get(uiName);
        return ui ? ui.isShowing : false;
    }

    /**
     * 隐藏所有UI
     */
    public hideAllUI(except?: string[]): void {
        for (const uiName of Array.from(this._activeUIs.keys())) {
            if (except && except.indexOf(uiName) !== -1) {
                continue;
            }
            this.hideUI(uiName);
        }
    }

    /**
     * 清理缓存
     */
    public clearCache(uiName?: string): void {
        if (uiName) {
            const cached = this._uiCache.get(uiName);
            if (cached) {
                cached.destroy();
                this._uiCache.delete(uiName);
            }
        } else {
            for (const [, ui] of this._uiCache) {
                ui.destroy();
            }
            this._uiCache.clear();
        }
    }

    /**
     * 获取当前活动的UI列表
     */
    public getActiveUIs(): string[] {
        return Array.from(this._activeUIs.keys());
    }

    /**
     * 创建UI对象（便捷方法）
     */
    public createObject(packageName: string, componentName: string): fgui.GObject | null {
        if (!this.isPackageLoaded(packageName)) {
            error(`[UIManager] Package ${packageName} not loaded, cannot create object ${componentName}`);
            return null;
        }

        try {
            return fgui.UIPackage.createObject(packageName, componentName);
        } catch (e) {
            error(`[UIManager] Error creating object ${packageName}.${componentName}:`, e);
            return null;
        }
    }

    /**
     * 异步创建UI对象
     */
    public async createObjectAsync(
        packageName: string, 
        componentName: string
    ): Promise<fgui.GObject | null> {
        // 确保包已加载
        if (!this.isPackageLoaded(packageName)) {
            const loaded = await this.loadPackage(packageName);
            if (!loaded) {
                return null;
            }
        }

        return this.createObject(packageName, componentName);
    }

    /**
     * 获取包中的资源
     */
    public getPackageItem(packageName: string, itemName: string): fgui.PackageItem | null {
        if (!this.isPackageLoaded(packageName)) {
            warn(`[UIManager] Package ${packageName} not loaded`);
            return null;
        }

        try {
            const pkg = fgui.UIPackage.getByName(packageName);
            return pkg ? pkg.getItemByName(itemName) : null;
        } catch (e) {
            error(`[UIManager] Error getting package item ${packageName}.${itemName}:`, e);
            return null;
        }
    }

    /**
     * 检查资源是否存在
     */
    public hasResource(packageName: string, resourceName: string): boolean {
        return this.getPackageItem(packageName, resourceName) !== null;
    }

    /**
     * 获取加载统计信息
     */
    public getStats(): {
        loadedCount: number;
        loadedPackages: string[];
        activeUIs: string[];
        cachedUIs: number;
    } {
        return {
            loadedCount: this._loadedPackages.size,
            loadedPackages: Array.from(this._loadedPackages),
            activeUIs: Array.from(this._activeUIs.keys()),
            cachedUIs: this._uiCache.size
        };
    }

    /**
     * 销毁管理器
     */
    public destroy(): void {
        // 隐藏所有UI
        this.hideAllUI();
        
        // 清理缓存
        this.clearCache();
        
        // 清理数据
        this._uiConfigs.clear();
        this._uiConstructors.clear();
        this._activeUIs.clear();
        this._loadedPackages.clear();
        
        this._groot = null;
        this._inited = false;
        this._globalListenersSetup = false;
        UIManager._instance = null;
    }

    // ================== 静态便捷方法（系统级操作） ==================

    /**
     * FairyGUI UI系统初始化函数
     * 在游戏启动时调用此函数来初始化UI系统
     */
    public static async initUISystem(config?: UIManagerConfig): Promise<boolean> {
        console.log("[UISystem] Initializing FairyGUI UI system...");
        
        try {
            // 初始化UI管理器
            UIManager.instance.init(config);
            
            // 检查初始化是否成功
            if (!UIManager.instance._inited) {
                console.error("[UISystem] UI Manager initialization failed");
                return false;
            }
            
            // 预加载公共依赖包
            const loaded = await UIManager.instance.loadCommonPackages();
            if (!loaded) {
                console.error("[UISystem] Failed to load common packages");
                return false;
            }
            
            // 提前注册全局事件监听（去重保护）
            if (!UIManager.instance._globalListenersSetup) {
                UIManager.instance._setupGlobalUIEventListeners();
                UIManager.instance._globalListenersSetup = true;
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
    public static cleanupUISystem(): void {
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
     * 便捷方法 - 预加载UI包
     */
    public static async preloadUIPackages(packageNames: string[]): Promise<void> {
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
     * 完整的UI系统初始化示例
     */
    public static async initializeGameUI(): Promise<void> {
        console.log("[UISystem] Initializing complete game UI system...");
        
        try {
            // 1. 初始化UI系统
            const initialized = await UIManager.initUISystem({
                debug: false,
                enableCache: true,
                designResolution: { width: 1920, height: 1080 }
            });
            
            if (!initialized) {
                throw new Error("UI system initialization failed");
            }

            // 2. 预加载UI包
            await UIManager.preloadUIPackages(UIManager.PRELOAD_PACKAGES);

            // 3. 注册UI界面
            UIManager.instance.registerModeSelectUI(UIManager.PRELOAD_PACKAGES[1]);
            UIManager.instance.registerMapSelectUI(UIManager.PRELOAD_PACKAGES[2]);
            UIManager.instance.registerInGameUI(UIManager.PRELOAD_PACKAGES[3]);
            UIManager.instance.registerMessageBoxUI(); // 注册MessageBox
            UIManager.instance.registerNotificationUI(); // 注册Notification
            UIManager.instance.registerGameEndUI(); // 注册GameEnd
            UIManager.instance.registerBankruptcyUI(); // 注册Bankruptcy
            UIManager.instance.registerLoadingUI(UIManager.PRELOAD_PACKAGES[1]); // 注册Loading（ModeSelect包）
            // GameConfig 不再单独注册，作为 CommonLayout 的子组件管理

            // 4. 显示Notification（全局通知中心，始终显示）
            await UIManager.instance.showUI("Notification");

            // 4.5. 初始化全局 CommonLayout UI（持久化显示，包含 Wallet 和 CommonSetting）
            await UIManager.instance.initCommonLayoutUI();

            // 5. 显示初始界面
            await UIManager.instance.showModeSelect();

            console.log("[UISystem] Game UI system initialized completely");

        } catch (error) {
            console.error("[UISystem] Failed to initialize game UI system:", error);
            throw error;
        }
    }

    // ================== 实例便捷方法 ==================

    /**
     * 便捷注册方法 - 注册模式选择UI
     */
    public registerModeSelectUI(packageName: string, componentName: string = "Main"): void {
        this.registerUI<UIModeSelect>("ModeSelect", {
            packageName,
            componentName,
            cache: true,
            isWindow: false,
            layer: UILayer.SCENE
        }, UIModeSelect);
    }

    /**
     * 便捷注册方法 - 注册游戏内UI
     */
    public registerInGameUI(packageName: string, componentName: string = "Main"): void {
        this.registerUI<UIInGame>("InGame", {
            packageName,
            componentName,
            cache: true,
            isWindow: false,
            layer: UILayer.SCENE
        }, UIInGame);
    }


    public registerMapSelectUI(packageName: string, componentName: string = "Main"): void {
        this.registerUI<UIMapSelect>("MapSelect", {
            packageName,
            componentName,
            cache: true,
            isWindow: false,
            layer: UILayer.SCENE
        }, UIMapSelect);
    }

    /**
     * 便捷注册方法 - 注册MessageBox UI
     * @param packageName 包名（默认"Common"）
     * @param componentType 组件类型或组件名（默认MessageBoxType.DEFAULT）
     */
    public registerMessageBoxUI(
        packageName: string = "Common",
        componentType: MessageBoxType | string = MessageBoxType.DEFAULT
    ): void {
        // 如果传入的是MessageBoxType枚举，取其值；否则直接使用字符串
        const componentName = typeof componentType === 'string' && componentType.startsWith("MessageBox")
            ? componentType
            : (componentType as MessageBoxType);

        this.registerUI<UIMessage>("MessageBox", {
            packageName,
            componentName,
            cache: true,
            isWindow: false,
            layer: UILayer.MODAL
        }, UIMessage);

        // 初始化UIMessage，传入UIManager获取器和组件类型
        const messageBoxType = typeof componentType === 'string' && componentType.startsWith("MessageBox")
            ? (componentType as MessageBoxType)
            : componentType;

        UIMessage.initialize(() => {
            // 返回UIManager类，避免循环依赖
            return { instance: UIManager.instance };
        }, messageBoxType as MessageBoxType);
    }

    /**
     * 便捷注册方法 - 注册Notification UI
     */
    public registerNotificationUI(packageName: string = "Common", componentName: string = "NotifyCenter"): void {
        this.registerUI<UINotification>("Notification", {
            packageName,
            componentName,
            cache: true,
            isWindow: false,
            layer: UILayer.NOTIFICATION
        }, UINotification);
    }

    /**
     * 便捷注册方法 - 注册游戏结束UI
     */
    public registerGameEndUI(packageName: string = "InGame", componentName: string = "GameEnd"): void {
        this.registerUI<UIGameEnd>("GameEnd", {
            packageName,
            componentName,
            cache: false,
            isWindow: false,
            layer: UILayer.MODAL
        }, UIGameEnd);
    }

    /**
     * 便捷注册方法 - 注册破产通知UI
     */
    public registerBankruptcyUI(packageName: string = "InGame", componentName: string = "Bankruptcy"): void {
        this.registerUI<UIBankruptcy>("Bankruptcy", {
            packageName,
            componentName,
            cache: false,
            isWindow: false,
            layer: UILayer.NOTIFICATION
        }, UIBankruptcy);
    }

    /**
     * 便捷注册方法 - 注册Loading UI
     */
    public registerLoadingUI(packageName: string = "ModeSelect", componentName: string = "Loading"): void {
        // 动态导入UILoading类
        import("../game/UILoading").then(({ UILoading }) => {
            this.registerUI<UILoading>("Loading", {
                packageName,
                componentName,
                cache: false,  // 不缓存，每次显示时重新创建
                isWindow: false,
                layer: UILayer.SYSTEM  // 最高优先级层
            }, UILoading);
        });
    }

    /**
     * 初始化全局 CommonLayout UI（持久化显示，包含 Wallet 和 CommonSetting）
     */
    public async initCommonLayoutUI(packageName: string = "Common", componentName: string = "CommonLayout"): Promise<void> {
        if (this._commonLayoutUI) {
            console.warn("[UIManager] CommonLayout UI already initialized");
            return;
        }

        try {
            // 加载 Common package（如果未加载）
            const loaded = await this.loadPackage(packageName);
            if (!loaded) {
                console.error(`[UIManager] Failed to load package: ${packageName}`);
                return;
            }

            // 创建 CommonLayout UI
            const layoutComponent = fgui.UIPackage.createObject(packageName, componentName);
            if (!layoutComponent) {
                console.error(`[UIManager] Failed to create ${packageName}.${componentName}`);
                return;
            }

            const layoutCom = layoutComponent.asCom;
            this._commonLayoutUI = layoutCom.node.addComponent(UICommonLayout);
            this._commonLayoutUI.setUIName("CommonLayout");
            this._commonLayoutUI.setPanel(layoutCom);
            this._commonLayoutUI.init();

            // 添加到 PERSISTENT Layer
            const persistentLayer = this.getLayer(UILayer.PERSISTENT);
            if (!persistentLayer) {
                console.error("[UIManager] PERSISTENT layer not found");
                return;
            }

            persistentLayer.addChild(layoutCom);

            console.log("[UIManager] CommonLayout UI initialized successfully");

        } catch (error) {
            console.error("[UIManager] Failed to initialize CommonLayout UI:", error);
        }
    }

    /**
     * 切换 GameConfig 显示/隐藏
     */
    public toggleGameConfig(): void {
        if (this._commonLayoutUI) {
            this._commonLayoutUI.toggleGameConfig();
        } else {
            console.warn('[UIManager] CommonLayout not initialized');
        }
    }

    /**
     * 获取 GameConfig 可见性
     */
    public isGameConfigVisible(): boolean {
        return this._commonLayoutUI?.isGameConfigVisible() || false;
    }

    /**
     * 切换 SuiConfig 显示/隐藏
     */
    public toggleSuiConfig(): void {
        if (this._commonLayoutUI) {
            this._commonLayoutUI.toggleSuiConfig();
        } else {
            console.warn('[UIManager] CommonLayout not initialized');
        }
    }

    /**
     * 获取 SuiConfig 可见性
     */
    public isSuiConfigVisible(): boolean {
        return this._commonLayoutUI?.isSuiConfigVisible() || false;
    }

    /**
     * 显示游戏内按钮（btn_playSetting, btn_debug）
     * 由 UIInGame.onShow() 调用
     */
    public showInGameButtons(): void {
        if (this._commonLayoutUI) {
            this._commonLayoutUI.showInGameButtons();
        } else {
            console.warn('[UIManager] CommonLayout not initialized');
        }
    }

    /**
     * 隐藏游戏内按钮（btn_playSetting, btn_debug）
     * 由 UIInGame.onHide() 调用
     */
    public hideInGameButtons(): void {
        if (this._commonLayoutUI) {
            this._commonLayoutUI.hideInGameButtons();
        } else {
            console.warn('[UIManager] CommonLayout not initialized');
        }
    }

    /**
     * 显示环境按钮（btn_env）
     * 由 UIModeSelect.onShow() 调用
     */
    public showEnvButton(): void {
        if (this._commonLayoutUI) {
            this._commonLayoutUI.showEnvButton();
        } else {
            console.warn('[UIManager] CommonLayout not initialized');
        }
    }

    /**
     * 隐藏环境按钮（btn_env）
     * 由 UIModeSelect.onHide() 调用
     */
    public hideEnvButton(): void {
        if (this._commonLayoutUI) {
            this._commonLayoutUI.hideEnvButton();
        } else {
            console.warn('[UIManager] CommonLayout not initialized');
        }
    }

    /**
     * 便捷方法 - 显示模式选择界面
     */
    public async showModeSelect(): Promise<UIModeSelect | null> {
        return this.showUI<UIModeSelect>("ModeSelect");
    }

    /**
     * 便捷方法 - 显示游戏内界面
     */
    public async showInGame(): Promise<UIInGame | null> {
        return this.showUI<UIInGame>("InGame");
    }

    /**
     * 便捷方法 - 显示地图选择界面
     */
    public async showMapSelect(): Promise<UIMapSelect | null> {
        return this.showUI<UIMapSelect>("MapSelect");
    }

    /**
     * 退出游戏（全局方法）
     *
     * 职责：
     * - 调用 GameSession.exitGameCleanup() 清理游戏状态
     * - 隐藏 UIInGame
     * - 显示地图选择界面
     *
     * 被以下位置调用：
     * - UIInGame._onExitGameClick() - 退出按钮
     * - UIGameEnd._onEndClick() - 游戏结束确认
     */
    public exitGame(): void {
        console.log('[UIManager] 退出游戏');

        // 1. 调用 GameSession 清理游戏状态（游戏模式）
        const session = Blackboard.instance.get<any>('currentGameSession');
        if (session && session.exitGameCleanup) {
            session.exitGameCleanup();
            console.log('[UIManager] GameSession 已清理');
        } else {
            console.warn('[UIManager] GameSession not found or exitGameCleanup not available');
        }

        // 2. 卸载当前地图场景（游戏模式和编辑器模式都需要）
        const mapManager = MapManager.getInstance();
        if (mapManager) {
            mapManager.unloadCurrentMap();
            console.log('[UIManager] 地图场景已卸载');
        }

        // 3. 隐藏游戏内界面
        if (this.isUIShowing("InGame")) {
            this.hideUI("InGame");
            console.log('[UIManager] UIInGame 已隐藏');
        }

        // 4. 显示地图选择界面
        this.showUI("MapSelect");
        console.log('[UIManager] 显示地图选择界面');

        console.log('[UIManager] 游戏退出完成');
    }

    /**
     * 设置全局UI事件监听器
     */
    private _setupGlobalUIEventListeners(): void {
        // 监听显示主菜单事件
        EventBus.on(EventTypes.UI.ShowMainMenu, async (data) => {
            console.log("[UISystem] UI.ShowMainMenu event received:", data);
            await this.showUI("ModeSelect", data);  // ✅ 注意：注册名是 "ModeSelect"
        }, this);

        // 监听显示地图选择事件
        EventBus.on(EventTypes.UI.ShowMapSelect, async (data) => {
            console.log("[UISystem] UI.ShowMapSelect event received:", data);
            await this.showUI("MapSelect", data);  // ✅ 注意：注册名是 "MapSelect"
        }, this);

        // 监听游戏开始事件
        EventBus.on(EventTypes.Game.GameStart, async (data) => {
            console.log("[UISystem] Game.GameStart event received:", data);
            await this.showUI("InGame", data);  // ✅ 注意：注册名是 "InGame"
        }, this);

        // 监听其他全局UI事件
        // TODO: 添加更多UI事件监听器
    }

    // ================== 私有方法 ==================

    /**
     * 尝试从缓存获取UI
     */
    private _tryGetFromCache<T extends UIBase>(uiName: string): T | null {
        if (!this._config.enableCache) {
            return null;
        }

        const cached = this._uiCache.get(uiName) as T;
        if (cached) {
            this._uiCache.delete(uiName);
            return cached;
        }

        return null;
    }

    /**
     * 创建UI实例
     */
    private async _createUIInstance<T extends UIBase>(
        uiName: string, 
        config: UIConfig, 
        constructor: UIConstructor
    ): Promise<T | null> {
        try {
            // 使用FairyGUI创建组件
            const fguiComponent = fgui.UIPackage.createObject(
                config.packageName, 
                config.componentName
            );

            if (!fguiComponent) {
                error(`[UIManager] Failed to create FGUI component: ${config.packageName}.${config.componentName}`);
                return null;
            }

            //修改node的name为uiName
            fguiComponent.node.name = uiName;

            // 创建UI逻辑实例，添加到FairyGUI节点上
            const uiInstance = fguiComponent.node.addComponent(constructor) as unknown as T;
            
            // 设置UI名称和面板引用
            uiInstance.setUIName(uiName);
            uiInstance.setPanel(fguiComponent.asCom);

            // 关键：设置触摸穿透，让空白区域不拦截鼠标事件
            // 不需要了，各个panel单独在编辑器里设置，不要在这儿修改。
            // const panel = fguiComponent.asCom;
            // if (panel) {
            //     //true表示不可穿透，false表示可穿透。
            //     panel.opaque = false;
            // }
            
            return uiInstance;

        } catch (e) {
            error(`[UIManager] Error creating UI instance ${uiName}:`, e);
            return null;
        }
    }

    /**
     * 作为窗口显示
     */
    private _showAsWindow(uiInstance: UIBase, config: UIConfig): void {
        if (!this._groot) {
            throw new Error("GRoot not initialized");
        }

        // 创建窗口
        const window = new fgui.Window();
        window.contentPane = uiInstance.panel;
        
        if (config.modal) {
            window.modal = true;
        }

        // 显示窗口
        this._groot.showWindow(window);
    }

    /**
     * 作为组件显示
     */
    private _showAsComponent(uiInstance: UIBase, config: UIConfig): void {
        if (!this._groot) {
            throw new Error("GRoot not initialized");
        }

        // 获取目标layer（默认NORMAL层）
        const targetLayer = config.layer !== undefined ? config.layer : UILayer.NORMAL;
        const layerContainer = this._layers.get(targetLayer);

        if (layerContainer) {
            // 添加到指定layer
            layerContainer.addChild(uiInstance.panel);

            if (this._config.debug) {
                console.log(`[UIManager] Added UI to layer ${targetLayer} (${UILayer[targetLayer]})`);
            }
        } else {
            // 降级：直接添加到GRoot
            console.warn(`[UIManager] Layer ${targetLayer} not found, adding to GRoot`);
            this._groot.addChild(uiInstance.panel);
        }
    }

    /**
     * 获取预加载包列表（静态访问）
     */
    public static get PRELOAD_PACKAGES_LIST(): string[] {
        return [...UIManager.PRELOAD_PACKAGES];
    }
}