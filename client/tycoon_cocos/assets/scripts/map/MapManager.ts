/**
 * 全局地图管理器
 * 
 * 负责管理游戏中所有地图的加载、切换和生命周期
 * 提供地图选择、动态加载等功能
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component, Node, resources, Prefab, instantiate, director } from 'cc';
import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';
import { GameMap } from './core/GameMap';

const { ccclass, property } = _decorator;

/**
 * 地图配置信息接口
 */
export interface MapConfig {
    /** 地图ID */
    id: string;
    /** 地图名称 */
    name: string;
    /** 地图描述 */
    description: string;
    /** 预制体路径 */
    prefabPath: string;
    /** 预览图路径 */
    previewImagePath?: string;
    /** 支持的玩家数量 */
    playerCount: { min: number; max: number };
    /** 地图类型 */
    type: 'standard' | 'custom' | 'special';
    /** 是否已解锁 */
    unlocked: boolean;
    /** 地图标签 */
    tags: string[];
}

/**
 * 地图加载结果接口
 */
export interface MapLoadResult {
    success: boolean;
    mapInstance?: Node;
    mapComponent?: GameMap;
    error?: string;
}

/**
 * 全局地图管理器
 * 单例模式，管理所有地图的生命周期
 */
@ccclass('MapManager')
export class MapManager extends Component {
    
    @property({ displayName: "地图容器节点", type: Node, tooltip: "地图实例将加载到此容器中" })
    public mapContainer: Node | null = null;

    @property({ displayName: "地图配置文件路径", tooltip: "存储所有地图配置的JSON文件路径" })
    public mapConfigPath: string = "data/configs/maps_config";

    @property({ displayName: "启用调试模式", tooltip: "是否输出详细的调试信息" })
    public debugMode: boolean = false;

    // 单例实例
    private static _instance: MapManager | null = null;

    // 地图配置列表
    private _mapConfigs: Map<string, MapConfig> = new Map();

    // 当前加载的地图
    private _currentMapInstance: Node | null = null;
    private _currentMapComponent: GameMap | null = null;
    private _currentMapId: string | null = null;

    // 预加载的地图
    private _preloadedMaps: Map<string, Prefab> = new Map();

    /**
     * 获取单例实例
     */
    public static getInstance(): MapManager | null {
        return MapManager._instance;
    }

    protected onLoad(): void {
        // 设置单例
        if (MapManager._instance === null) {
            MapManager._instance = this;
            director.addPersistRootNode(this.node);
        } else {
            this.destroy();
            return;
        }

        this.log('MapManager initialized');
    }

    protected async start(): Promise<void> {
        // 加载地图配置
        await this.loadMapConfigs();
        
        // 注册事件监听器
        this.registerEventListeners();

        this.log('MapManager ready');
    }

    protected onDestroy(): void {
        if (MapManager._instance === this) {
            MapManager._instance = null;
        }

        // 清理当前地图
        this.unloadCurrentMap();

        // 清理预加载资源
        this._preloadedMaps.clear();
    }

    /**
     * 加载地图配置文件
     */
    private async loadMapConfigs(): Promise<void> {
        return new Promise<void>((resolve) => {
            resources.load(this.mapConfigPath, (err, asset) => {
                if (err) {
                    console.error('[MapManager] 加载地图配置失败:', err);
                    resolve();
                    return;
                }

                try {
                    const configData = asset.json;
                    if (configData && configData.maps) {
                        configData.maps.forEach((config: MapConfig) => {
                            this._mapConfigs.set(config.id, config);
                        });
                        this.log(`已加载 ${this._mapConfigs.size} 个地图配置`);
                    }
                } catch (error) {
                    console.error('[MapManager] 解析地图配置失败:', error);
                }

                resolve();
            });
        });
    }

    /**
     * 获取所有可用地图列表
     */
    public getAvailableMaps(): MapConfig[] {
        return Array.from(this._mapConfigs.values());
    }

    /**
     * 获取已解锁的地图列表
     */
    public getUnlockedMaps(): MapConfig[] {
        return this.getAvailableMaps().filter(map => map.unlocked);
    }

    /**
     * 根据ID获取地图配置
     */
    public getMapConfig(mapId: string): MapConfig | null {
        return this._mapConfigs.get(mapId) || null;
    }

    /**
     * 检查地图是否已解锁
     */
    public isMapUnlocked(mapId: string): boolean {
        const config = this.getMapConfig(mapId);
        return config ? config.unlocked : false;
    }

    /**
     * 预加载地图预制体
     */
    public async preloadMap(mapId: string): Promise<boolean> {
        const config = this.getMapConfig(mapId);
        if (!config) {
            console.error('[MapManager] 地图配置不存在:', mapId);
            return false;
        }

        if (this._preloadedMaps.has(mapId)) {
            this.log(`地图 ${mapId} 已预加载`);
            return true;
        }

        return new Promise<boolean>((resolve) => {
            resources.load(config.prefabPath, Prefab, (err, prefab) => {
                if (err) {
                    console.error(`[MapManager] 预加载地图 ${mapId} 失败:`, err);
                    resolve(false);
                    return;
                }

                this._preloadedMaps.set(mapId, prefab);
                this.log(`地图 ${mapId} 预加载成功`);
                resolve(true);
            });
        });
    }

    /**
     * 加载并切换到指定地图
     */
    public async loadMap(mapId: string): Promise<MapLoadResult> {
        this.log(`准备加载地图: ${mapId}`);

        // 检查地图配置
        const config = this.getMapConfig(mapId);
        if (!config) {
            return { success: false, error: '地图配置不存在' };
        }

        if (!config.unlocked) {
            return { success: false, error: '地图未解锁' };
        }

        try {
            // 卸载当前地图
            this.unloadCurrentMap();

            // 获取预制体（优先使用预加载的）
            let prefab = this._preloadedMaps.get(mapId);
            if (!prefab) {
                // 动态加载
                prefab = await this.loadMapPrefab(config.prefabPath);
                if (!prefab) {
                    return { success: false, error: '地图预制体加载失败' };
                }
            }

            // 实例化地图
            const mapInstance = instantiate(prefab);
            const mapComponent = mapInstance.getComponent(GameMap);

            if (!mapComponent) {
                mapInstance.destroy();
                return { success: false, error: '地图预制体缺少GameMap组件' };
            }

            // 添加到容器
            const container = this.mapContainer || director.getScene();
            if (container) {
                container.addChild(mapInstance);
            }

            // 更新当前地图状态
            this._currentMapInstance = mapInstance;
            this._currentMapComponent = mapComponent;
            this._currentMapId = mapId;

            this.log(`地图 ${mapId} 加载成功`);

            // 发送地图加载完成事件
            EventBus.emit(EventTypes.Game.MapLoaded, {
                mapId: mapId,
                mapName: config.name,
                mapComponent: mapComponent
            });

            return {
                success: true,
                mapInstance: mapInstance,
                mapComponent: mapComponent
            };

        } catch (error) {
            console.error(`[MapManager] 加载地图 ${mapId} 失败:`, error);
            return { success: false, error: error.toString() };
        }
    }

    /**
     * 卸载当前地图
     */
    public unloadCurrentMap(): void {
        if (this._currentMapInstance) {
            this.log(`卸载当前地图: ${this._currentMapId}`);
            
            // 发送地图卸载事件
            if (this._currentMapId) {
                EventBus.emit(EventTypes.Game.MapUnloaded, {
                    mapId: this._currentMapId
                });
            }

            this._currentMapInstance.destroy();
            this._currentMapInstance = null;
            this._currentMapComponent = null;
            this._currentMapId = null;
        }
    }

    /**
     * 获取当前地图信息
     */
    public getCurrentMapInfo(): { mapId: string; config: MapConfig; component: GameMap } | null {
        if (!this._currentMapId || !this._currentMapComponent) {
            return null;
        }

        const config = this.getMapConfig(this._currentMapId);
        if (!config) {
            return null;
        }

        return {
            mapId: this._currentMapId,
            config: config,
            component: this._currentMapComponent
        };
    }

    /**
     * 动态加载地图预制体
     */
    private async loadMapPrefab(prefabPath: string): Promise<Prefab | null> {
        return new Promise<Prefab | null>((resolve) => {
            resources.load(prefabPath, Prefab, (err, prefab) => {
                if (err) {
                    console.error('[MapManager] 加载地图预制体失败:', err);
                    resolve(null);
                    return;
                }
                resolve(prefab);
            });
        });
    }

    /**
     * 注册事件监听器
     */
    private registerEventListeners(): void {
        // 监听地图选择事件
        EventBus.on(EventTypes.Game.MapSelected, this.onMapSelected, this);
        
        // 监听地图切换请求
        EventBus.on(EventTypes.Game.RequestMapChange, this.onMapChangeRequest, this);
    }

    /**
     * 处理地图选择事件
     */
    private async onMapSelected(data: { mapId: string }): Promise<void> {
        this.log(`收到地图选择事件: ${data.mapId}`);
        
        const result = await this.loadMap(data.mapId);
        if (result.success) {
            // 发送游戏开始事件
            console.log("[MapManager] 🚀 Map loaded successfully, emitting GameStart event...");
            EventBus.emit(EventTypes.Game.GameStart, {
                mode: "single_player", // 这里可以根据实际情况调整
                mapId: data.mapId,
                source: "map_select"
            });
        } else {
            // 发送加载失败事件
            EventBus.emit(EventTypes.Game.MapLoadFailed, {
                mapId: data.mapId,
                error: result.error
            });
        }
    }

    /**
     * 处理地图切换请求
     */
    private async onMapChangeRequest(data: { fromMapId: string; toMapId: string }): Promise<void> {
        this.log(`地图切换请求: ${data.fromMapId} -> ${data.toMapId}`);
        
        const result = await this.loadMap(data.toMapId);
        if (!result.success) {
            console.error('[MapManager] 地图切换失败:', result.error);
        }
    }

    /**
     * 调试日志输出
     */
    private log(message: string): void {
        if (this.debugMode) {
            console.log(`[MapManager] ${message}`);
        }
    }
}

/**
 * 全局MapManager访问器
 */
export const mapManager = {
    get instance(): MapManager | null {
        return MapManager.getInstance();
    }
};