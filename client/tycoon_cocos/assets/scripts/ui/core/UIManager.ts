import { director, Node, warn, error } from "cc";
import { UIBase } from "./UIBase";
import { EventBus } from "../events/EventBus";
import { EventTypes } from "../events/EventTypes";
import * as fgui from "fairygui-cc";

/**
 * UI构造函数接口
 */
export interface UIConstructor<T extends UIBase = UIBase> {
    new (panel: fgui.GComponent, uiName: string): T;
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
    /** 已注册的UI配置 */
    private _uiConfigs: Map<string, UIConfig> = new Map();
    /** UI构造函数 */
    private _uiConstructors: Map<string, UIConstructor> = new Map();
    /** 当前显示的UI实例 */
    private _activeUIs: Map<string, UIBase> = new Map();
    /** UI缓存池 */
    private _uiCache: Map<string, UIBase> = new Map();
    /** 已加载的包 */
    private _loadedPackages: Set<string> = new Set();
    /** 管理器配置 */
    private _config: UIManagerConfig = {};
    /** 是否已初始化 */
    private _inited: boolean = false;

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
    }

    /**
     * 初始化FairyGUI
     */
    private _initFairyGUI(): void {
        // 获取或创建GRoot实例
        this._groot = fgui.GRoot.inst;
        
        // 设置设计分辨率
        if (this._config.designResolution) {
            const { width, height } = this._config.designResolution;
            this._groot.setContentScaleFactor(width, height);
        }

        if (this._config.debug) {
            console.log("[UIManager] FairyGUI initialized", {
                groot: this._groot,
                designResolution: this._config.designResolution
            });
        }
    }

    /**
     * 加载UI包
     */
    public async loadPackage(packageName: string): Promise<boolean> {
        if (this._loadedPackages.has(packageName)) {
            if (this._config.debug) {
                console.log(`[UIManager] Package ${packageName} already loaded`);
            }
            return true;
        }

        try {
            // 使用FairyGUI加载包
            await new Promise<void>((resolve, reject) => {
                fgui.UIPackage.loadPackage(packageName, (err: any) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            this._loadedPackages.add(packageName);
            
            if (this._config.debug) {
                console.log(`[UIManager] Package ${packageName} loaded successfully`);
            }
            
            return true;

        } catch (e) {
            error(`[UIManager] Failed to load package ${packageName}:`, e);
            return false;
        }
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
                await this._showAsWindow(uiInstance, config);
            } else {
                await this._showAsComponent(uiInstance);
            }

            uiInstance.show(data);
            this._activeUIs.set(uiName, uiInstance);

            // 发送显示事件
            EventBus.emitEvent(EventTypes.UI.ManagerStateChange, {
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
    public async hideUI(uiName: string): Promise<void> {
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
            EventBus.emitEvent(EventTypes.UI.ManagerStateChange, {
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
     * 获取UI实例
     */
    public getUI<T extends UIBase>(uiName: string): T | null {
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
    public async hideAllUI(except?: string[]): Promise<void> {
        const promises: Promise<void>[] = [];
        
        for (const uiName of this._activeUIs.keys()) {
            if (except && except.includes(uiName)) {
                continue;
            }
            promises.push(this.hideUI(uiName));
        }

        await Promise.all(promises);
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
            for (const [name, ui] of this._uiCache) {
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
        UIManager._instance = null;
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
        constructor: UIConstructor<T>
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

            // 创建UI逻辑实例
            const uiInstance = new constructor(fguiComponent.asCom, uiName);
            
            return uiInstance;

        } catch (e) {
            error(`[UIManager] Error creating UI instance ${uiName}:`, e);
            return null;
        }
    }

    /**
     * 作为窗口显示
     */
    private async _showAsWindow(uiInstance: UIBase, config: UIConfig): Promise<void> {
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
    private async _showAsComponent(uiInstance: UIBase): Promise<void> {
        if (!this._groot) {
            throw new Error("GRoot not initialized");
        }

        // 直接添加到GRoot
        this._groot.addChild(uiInstance.panel);
    }
}