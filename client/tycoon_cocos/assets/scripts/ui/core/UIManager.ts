import { Node, instantiate, resources, Prefab, director, Canvas, warn, error } from "cc";
import { UIBase } from "./UIBase";
import { UIConfig, UILayer, UIShowOptions, UIHideOptions, UIConstructor, UIManagerConfig, UIEventType, UIEventData } from "./UITypes";

/**
 * UI管理器 - 单例模式
 * 负责UI的注册、显示、隐藏、层级管理和对象池管理
 */
export class UIManager {
    private static _instance: UIManager | null = null;
    
    /** UI根节点 */
    private _uiRoot: Node | null = null;
    /** 各层级节点 */
    private _layerNodes: Map<UILayer, Node> = new Map();
    /** 已注册的UI配置 */
    private _uiConfigs: Map<string, UIConfig> = new Map();
    /** 当前显示的UI实例 */
    private _activeUIs: Map<string, UIBase> = new Map();
    /** UI对象池 */
    private _uiPool: Map<string, UIBase[]> = new Map();
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
            warn("UIManager already initialized!");
            return;
        }

        this._config = {
            defaultAnimationDuration: 0.3,
            enablePool: true,
            poolMaxSize: 3,
            debug: false,
            ...config
        };

        this._setupUIRoot();
        this._createLayerNodes();
        this._inited = true;

        if (this._config.debug) {
            console.log("[UIManager] Initialized with config:", this._config);
        }
    }

    /**
     * 注册UI配置
     */
    public registerUI<T extends UIBase>(uiId: string, config: UIConfig, uiClass: UIConstructor<T>): void {
        if (this._uiConfigs.has(uiId)) {
            warn(`UI [${uiId}] already registered!`);
            return;
        }

        // 添加UI类到配置中
        (config as any).uiClass = uiClass;
        this._uiConfigs.set(uiId, config);

        if (this._config.debug) {
            console.log(`[UIManager] Registered UI: ${uiId}`, config);
        }
    }

    /**
     * 显示UI
     */
    public async showUI(uiId: string, options: UIShowOptions = {}): Promise<UIBase | null> {
        if (!this._inited) {
            error("[UIManager] Not initialized!");
            return null;
        }

        const config = this._uiConfigs.get(uiId);
        if (!config) {
            error(`[UIManager] UI [${uiId}] not registered!`);
            return null;
        }

        // 检查是否已经显示
        let uiInstance = this._activeUIs.get(uiId);
        if (uiInstance && uiInstance.isVisible) {
            warn(`[UIManager] UI [${uiId}] already visible!`);
            return uiInstance;
        }

        try {
            // 获取UI实例（从池中或新创建）
            uiInstance = await this._getUIInstance(uiId, config);
            if (!uiInstance) {
                error(`[UIManager] Failed to create UI instance: ${uiId}`);
                return null;
            }

            // 设置UI属性
            uiInstance.uiId = uiId;

            // 添加到对应层级
            const layerNode = this._layerNodes.get(config.layer);
            if (layerNode) {
                layerNode.addChild(uiInstance.node);
            }

            // 如果是独占显示，隐藏同层其他UI
            if (config.exclusive) {
                await this._hideUIsByLayer(config.layer, uiId);
            }

            // 发送显示前事件
            this._emitUIEvent(UIEventType.BeforeShow, uiId, uiInstance, options.data);

            // 显示UI
            const showOptions: UIShowOptions = {
                animation: options.animation || config.showAnimation,
                animationDuration: options.animationDuration || config.animationDuration || this._config.defaultAnimationDuration,
                data: options.data,
                immediate: options.immediate,
                onComplete: () => {
                    this._emitUIEvent(UIEventType.AfterShow, uiId, uiInstance!, options.data);
                    options.onComplete?.();
                }
            };

            await uiInstance.show(showOptions);
            this._activeUIs.set(uiId, uiInstance);

            if (this._config.debug) {
                console.log(`[UIManager] Showed UI: ${uiId}`);
            }

            return uiInstance;

        } catch (e) {
            error(`[UIManager] Error showing UI [${uiId}]:`, e);
            return null;
        }
    }

    /**
     * 隐藏UI
     */
    public async hideUI(uiId: string, options: UIHideOptions = {}): Promise<void> {
        const uiInstance = this._activeUIs.get(uiId);
        if (!uiInstance) {
            warn(`[UIManager] UI [${uiId}] not found or not active!`);
            return;
        }

        const config = this._uiConfigs.get(uiId);
        if (!config) {
            error(`[UIManager] UI config [${uiId}] not found!`);
            return;
        }

        try {
            // 发送隐藏前事件
            this._emitUIEvent(UIEventType.BeforeHide, uiId, uiInstance);

            // 隐藏UI
            const hideOptions: UIHideOptions = {
                animation: options.animation || config.hideAnimation,
                animationDuration: options.animationDuration || config.animationDuration || this._config.defaultAnimationDuration,
                immediate: options.immediate,
                destroy: options.destroy || !config.cache,
                onComplete: () => {
                    this._emitUIEvent(UIEventType.AfterHide, uiId, uiInstance);
                    options.onComplete?.();
                }
            };

            await uiInstance.hide(hideOptions);

            // 从激活列表中移除
            this._activeUIs.delete(uiId);

            // 从父节点移除
            if (uiInstance.node.parent) {
                uiInstance.node.removeFromParent();
            }

            // 根据配置决定销毁还是回收到池中
            if (hideOptions.destroy || !config.cache) {
                this._destroyUIInstance(uiId, uiInstance);
            } else {
                this._recycleUIInstance(uiId, uiInstance);
            }

            if (this._config.debug) {
                console.log(`[UIManager] Hidden UI: ${uiId}`);
            }

        } catch (e) {
            error(`[UIManager] Error hiding UI [${uiId}]:`, e);
        }
    }

    /**
     * 获取UI实例
     */
    public getUI(uiId: string): UIBase | null {
        return this._activeUIs.get(uiId) || null;
    }

    /**
     * 检查UI是否显示
     */
    public isUIVisible(uiId: string): boolean {
        const ui = this._activeUIs.get(uiId);
        return ui ? ui.isVisible : false;
    }

    /**
     * 隐藏所有UI
     */
    public async hideAllUI(layer?: UILayer, except?: string[]): Promise<void> {
        const promises: Promise<void>[] = [];
        
        for (const [uiId, uiInstance] of this._activeUIs) {
            if (except?.includes(uiId)) continue;
            
            if (layer !== undefined) {
                const config = this._uiConfigs.get(uiId);
                if (config && config.layer !== layer) continue;
            }
            
            promises.push(this.hideUI(uiId));
        }

        await Promise.all(promises);
    }

    /**
     * 清理UI池
     */
    public clearPool(uiId?: string): void {
        if (uiId) {
            const pool = this._uiPool.get(uiId);
            if (pool) {
                pool.forEach(ui => {
                    if (ui.node && ui.node.isValid) {
                        ui.node.destroy();
                    }
                });
                this._uiPool.delete(uiId);
            }
        } else {
            for (const [id, pool] of this._uiPool) {
                pool.forEach(ui => {
                    if (ui.node && ui.node.isValid) {
                        ui.node.destroy();
                    }
                });
            }
            this._uiPool.clear();
        }
    }

    /**
     * 获取当前显示的UI列表
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
        
        // 清理池
        this.clearPool();
        
        // 清理数据
        this._uiConfigs.clear();
        this._activeUIs.clear();
        this._layerNodes.clear();
        
        this._uiRoot = null;
        this._inited = false;
        UIManager._instance = null;
    }

    /**
     * 设置UI根节点
     */
    private _setupUIRoot(): void {
        if (this._config.uiRoot) {
            this._uiRoot = this._config.uiRoot;
        } else {
            // 查找Canvas节点
            const scene = director.getScene();
            const canvas = scene?.getComponentInChildren(Canvas);
            if (canvas) {
                this._uiRoot = canvas.node;
            } else {
                error("[UIManager] No Canvas found in scene!");
            }
        }
    }

    /**
     * 创建层级节点
     */
    private _createLayerNodes(): void {
        if (!this._uiRoot) return;

        const layers = [
            UILayer.Background,
            UILayer.Normal, 
            UILayer.Popup,
            UILayer.Top,
            UILayer.System
        ];

        for (const layer of layers) {
            const layerNode = new Node(`UILayer_${UILayer[layer]}`);
            layerNode.setSiblingIndex(layer);
            this._uiRoot.addChild(layerNode);
            this._layerNodes.set(layer, layerNode);
        }
    }

    /**
     * 获取UI实例（从池中或新创建）
     */
    private async _getUIInstance(uiId: string, config: UIConfig): Promise<UIBase | null> {
        // 尝试从池中获取
        if (this._config.enablePool && config.cache) {
            const pool = this._uiPool.get(uiId);
            if (pool && pool.length > 0) {
                return pool.pop()!;
            }
        }

        // 创建新实例
        return this._createUIInstance(uiId, config);
    }

    /**
     * 创建UI实例
     */
    private async _createUIInstance(uiId: string, config: UIConfig): Promise<UIBase | null> {
        try {
            // 加载预制体
            const prefab = await this._loadPrefab(config.prefabPath);
            if (!prefab) {
                error(`[UIManager] Failed to load prefab: ${config.prefabPath}`);
                return null;
            }

            // 实例化节点
            const node = instantiate(prefab);
            
            // 添加UI组件
            const uiClass = (config as any).uiClass;
            let uiComponent = node.getComponent(uiClass);
            if (!uiComponent) {
                uiComponent = node.addComponent(uiClass);
            }

            return uiComponent as UIBase;

        } catch (e) {
            error(`[UIManager] Error creating UI instance [${uiId}]:`, e);
            return null;
        }
    }

    /**
     * 加载预制体
     */
    private _loadPrefab(path: string): Promise<Prefab | null> {
        return new Promise((resolve) => {
            resources.load(path, Prefab, (err, prefab) => {
                if (err) {
                    error(`[UIManager] Failed to load prefab: ${path}`, err);
                    resolve(null);
                } else {
                    resolve(prefab);
                }
            });
        });
    }

    /**
     * 回收UI实例到池中
     */
    private _recycleUIInstance(uiId: string, uiInstance: UIBase): void {
        if (!this._config.enablePool) {
            this._destroyUIInstance(uiId, uiInstance);
            return;
        }

        let pool = this._uiPool.get(uiId);
        if (!pool) {
            pool = [];
            this._uiPool.set(uiId, pool);
        }

        // 检查池大小限制
        if (pool.length >= (this._config.poolMaxSize || 3)) {
            this._destroyUIInstance(uiId, pool.shift()!);
        }

        pool.push(uiInstance);
    }

    /**
     * 销毁UI实例
     */
    private _destroyUIInstance(uiId: string, uiInstance: UIBase): void {
        this._emitUIEvent(UIEventType.BeforeDestroy, uiId, uiInstance);
        
        if (uiInstance.node && uiInstance.node.isValid) {
            uiInstance.node.destroy();
        }
    }

    /**
     * 隐藏指定层级的UI
     */
    private async _hideUIsByLayer(layer: UILayer, except: string): Promise<void> {
        const promises: Promise<void>[] = [];
        
        for (const [uiId, uiInstance] of this._activeUIs) {
            if (uiId === except) continue;
            
            const config = this._uiConfigs.get(uiId);
            if (config && config.layer === layer) {
                promises.push(this.hideUI(uiId));
            }
        }

        await Promise.all(promises);
    }

    /**
     * 发送UI事件
     */
    private _emitUIEvent(eventType: UIEventType, uiId: string, uiComponent?: UIBase, data?: any): void {
        const eventData: UIEventData = {
            uiId,
            uiComponent,
            eventType,
            data
        };

        // 这里可以通过EventBus发送事件，暂时使用console输出
        if (this._config.debug) {
            console.log(`[UIManager] Event: ${eventType}`, eventData);
        }
    }
}