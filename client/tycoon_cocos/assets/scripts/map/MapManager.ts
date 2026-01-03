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
import { Blackboard } from '../events/Blackboard';
import { GameMap } from './core/GameMap';
import { VoxelSystem } from '../voxel/VoxelSystem';
import { GridGround, GridGroundConfig } from './GridGround';
import { UINotification } from '../ui/utils/UINotification';
import { GameSession } from '../core/GameSession';
import { IdFormatter } from '../ui/utils/IdFormatter';
import * as fgui from "fairygui-cc";

const { ccclass, property } = _decorator;

/**
 * 地图配置信息接口
 */
export interface MapConfig {
    /** 地图ID */
    id: string;
    /** 地图名称 */
    name: string;
    /** 预制体路径 */
    prefabPath: string;
    /** 预览图路径 */
    previewImagePath: string;
    /** 地图类型 */
    type: 'classic' | 'brawl';
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
    public debugMode: boolean = true;

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
        try {
            // 加载地图配置
            await this.loadMapConfigs();
        } catch (err) {
            console.error('[MapManager] 地图配置加载失败，继续以降级模式运行:', err);
        }
        
        // 注册事件监听器
        this.registerEventListeners();
        
        // voxelSystem //resourcePackPath
        VoxelSystem.getInstance().initialize();
        
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
        return new Promise<void>((resolve, reject) => {
            resources.load(this.mapConfigPath, (err, asset) => {
                if (err) {
                    console.error('[MapManager] 加载地图配置失败:', err);
                    reject(err);
                    return;
                }

                try {
                    const configData = (asset as any).json;
                    if (configData && configData.maps) {
                        configData.maps.forEach((config: MapConfig) => {
                            this._mapConfigs.set(config.id, config);
                        });
                        this.log(`已加载 ${this._mapConfigs.size} 个地图配置`);
                    }
                    resolve();
                } catch (error) {
                    console.error('[MapManager] 解析地图配置失败:', error);
                    reject(error);
                }
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
     * 根据ID获取地图配置
     */
    public getMapConfig(mapId: string): MapConfig | null {
        return this._mapConfigs.get(mapId) || null;
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
     * 让渲染线程有机会刷新一帧（用于显示Loading更新）
     */
    private waitOneFrame(): Promise<void> {
        return new Promise(resolve => {
            director.once((director.constructor as any).EVENT_AFTER_UPDATE, resolve);
        });
    }

    /**
     * 加载并切换到指定地图
     */
    public async loadMap(mapId: string, isEdit: boolean): Promise<MapLoadResult> {
        this.log(`准备加载地图: ${mapId}`);

        // 检查地图配置
        const config = this.getMapConfig(mapId);
        if (!config) {
            return { success: false, error: '地图配置不存在' };
        }

        // 动态导入UI模块
        const { UIManager } = await import("../ui/core/UIManager");

        try {
            // 显示Loading UI
            await UIManager.instance.showUI("Loading");

            // 步骤1: 卸载当前地图 (0-10%)
            Blackboard.instance.set("loading.description", "准备中...");
            Blackboard.instance.set("loading.progress", 0);
            await this.waitOneFrame();
            this.unloadCurrentMap();
            Blackboard.instance.set("loading.progress", 10);
            await this.waitOneFrame();

            // 步骤2: 加载预制体 (10-40%)
            Blackboard.instance.set("loading.description", "加载资源中...");
            await this.waitOneFrame();

            let prefab = this._preloadedMaps.get(mapId);
            let mapInstance: Node;

            if (!prefab && config.prefabPath) {
                // 动态加载预制体（主要耗时点）
                prefab = await this.loadMapPrefab(config.prefabPath);
            }

            Blackboard.instance.set("loading.progress", 40);
            await this.waitOneFrame();

            // 步骤3: 实例化地图 (40-60%)
            Blackboard.instance.set("loading.description", "初始化中...");
            await this.waitOneFrame();

            if (prefab) {
                mapInstance = instantiate(prefab);
            } else {
                mapInstance = new Node(config.id);
                this.log(`地图 ${mapId} 没有预制体，创建空节点`);
            }

            Blackboard.instance.set("loading.progress", 60);
            await this.waitOneFrame();

            // 步骤4: 初始化地图组件 (60-80%)
            Blackboard.instance.set("loading.description", "初始化中...");
            await this.waitOneFrame();

            const mapComponent = mapInstance.addComponent(GameMap);
            await mapComponent.init(config, isEdit);

            Blackboard.instance.set("loading.progress", 80);
            await this.waitOneFrame();

            // 步骤5: 添加到场景 (80-90%)
            Blackboard.instance.set("loading.description", "处理中...");
            await this.waitOneFrame();

            const container = this.mapContainer || director.getScene();
            if (container) {
                container.addChild(mapInstance);
            }

            // 更新当前地图状态
            this._currentMapInstance = mapInstance;
            this._currentMapComponent = mapComponent;
            this._currentMapId = mapId;

            this.log(`地图 ${mapId} 加载成功`);

            Blackboard.instance.set("loading.progress", 90);
            await this.waitOneFrame();

            // 步骤6: 编辑模式特殊处理 (90-100%)
            if (isEdit) {
                console.log('[MapManager] Editor mode: showing tile type overlays...');
                await mapComponent.showTileTypeOverlays(async (progress, desc) => {
                    // 将80-100%的进度映射到90-100%
                    const mappedProgress = 90 + ((progress - 80) / 20) * 10;
                    Blackboard.instance.set("loading.progress", mappedProgress);
                    Blackboard.instance.set("loading.description", desc);
                    await this.waitOneFrame();
                });
                console.log('[MapManager] Tile type overlays shown');
            }

            Blackboard.instance.set("loading.progress", 100);
            Blackboard.instance.set("loading.description", "加载完成！");
            await this.waitOneFrame();

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

            // 显示错误信息
            Blackboard.instance.set("loading.description", `加载失败: ${error}`);
            Blackboard.instance.set("loading.tip", "请返回重试");
            Blackboard.instance.set("loading.progress", 0);

            // 3秒后自动隐藏Loading
            setTimeout(async () => {
                await UIManager.instance.hideUI("Loading").catch(console.error);
            }, 3000);

            return { success: false, error: error.toString() };

        } finally {
            // 防御性保护：确保Loading一定会被隐藏（延迟100ms执行）
            setTimeout(async () => {
                await UIManager.instance.hideUI("Loading").catch(console.error);
            }, 100);
        }
    }

    /**
     * 从 GameSession 加载游戏地图（游戏模式）
     * 创建 GameMap 节点和组件，从 GameSession 的逻辑数据加载场景
     *
     * @param session GameSession 实例
     * @returns GameMap 组件实例
     */
    public async loadGameMapFromSession(session: GameSession): Promise<any> {
        console.log('[MapManager] 从 GameSession 加载游戏地图');

        // 动态导入UI模块
        const { UIManager } = await import("../ui/core/UIManager");

        try {
            // 显示Loading UI
            await UIManager.instance.showUI("Loading");

            // 步骤1: 卸载当前地图 (0-10%)
            Blackboard.instance.set("loading.description", "准备中...");
            Blackboard.instance.set("loading.progress", 0);
            await this.waitOneFrame();
            this.unloadCurrentMap();
            Blackboard.instance.set("loading.progress", 10);
            await this.waitOneFrame();

            // 步骤2-4: 创建节点和组件 (10-30%)
            Blackboard.instance.set("loading.description", "初始化中...");
            await this.waitOneFrame();

            const gameId = session.getGameId();
            const shortId = IdFormatter.shortenAddress(gameId).replace(/\.\.\./g, '___');
            const mapNode = new Node(`ChainGame_${shortId}`);
            const gameMap = mapNode.addComponent(GameMap);

            const tempConfig: MapConfig = {
                id: `chain_${gameId}`,
                name: `Chain Game`,
                prefabPath: '',
                previewImagePath: '',
                type: 'classic'
            };

            console.log('[MapManager] Initializing GameMap (play mode)...');
            await gameMap.init(tempConfig, false);
            Blackboard.instance.set("loading.progress", 30);
            await this.waitOneFrame();

            // 步骤5: 从GameSession加载场景 (30-70%) - 主要耗时
            console.log('[MapManager] Loading scene from GameSession...');

            const loaded = await gameMap.loadFromGameSession(session, async (progress, desc) => {
                Blackboard.instance.set("loading.progress", progress);
                Blackboard.instance.set("loading.description", desc);
                await this.waitOneFrame();
            });

            if (!loaded) {
                throw new Error('Failed to load game map from session');
            }

            console.log('[MapManager] Game map loaded successfully');
            Blackboard.instance.set("loading.progress", 70);
            await this.waitOneFrame();

            // 步骤6-7: 添加到容器 (70-80%)
            Blackboard.instance.set("loading.description", "处理中...");
            await this.waitOneFrame();

            const container = this.mapContainer || director.getScene();
            if (container) {
                container.addChild(mapNode);
            }

            this._currentMapInstance = mapNode;
            this._currentMapComponent = gameMap;
            this._currentMapId = tempConfig.id;

            this.log(`链上游戏地图加载成功: ${tempConfig.id}`);
            Blackboard.instance.set("loading.progress", 80);
            await this.waitOneFrame();

            // 步骤8: 显示tile type overlays (80-100%) - 耗时
            console.log('[MapManager] Showing tile type overlays...');
            await gameMap.showTileTypeOverlays(async (progress, desc) => {
                Blackboard.instance.set("loading.progress", progress);
                Blackboard.instance.set("loading.description", desc);
                await this.waitOneFrame();
            });
            console.log('[MapManager] Tile type overlays shown');
            Blackboard.instance.set("loading.progress", 100);
            Blackboard.instance.set("loading.description", "加载完成！");
            await this.waitOneFrame();

            // 发送地图加载完成事件
            EventBus.emit(EventTypes.Game.MapLoaded, {
                gameId: gameId,
                mapId: tempConfig.id,
                mapComponent: gameMap
            });

            return gameMap;

        } catch (error) {
            console.error('[MapManager] 从GameSession加载地图失败:', error);

            // 错误处理：显示错误信息
            Blackboard.instance.set("loading.description", `加载失败: ${error}`);
            Blackboard.instance.set("loading.tip", "请重试");
            Blackboard.instance.set("loading.progress", 0);

            // 3秒后自动隐藏Loading
            setTimeout(async () => {
                await UIManager.instance.hideUI("Loading").catch(console.error);
            }, 3000);

            throw error;

        } finally {
            // 防御性保护：确保Loading一定会被隐藏（延迟100ms执行）
            setTimeout(async () => {
                await UIManager.instance.hideUI("Loading").catch(console.error);
            }, 100);
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
     * 获取当前 GameMap 组件（直接访问器）
     */
    public getCurrentGameMap(): GameMap | null {
        return this._currentMapComponent;
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
                    console.warn('[MapManager] 加载地图预制体失败:', err);
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
        // 监听地图选择事件（editor 模式）
        EventBus.on(EventTypes.Game.MapSelected, this.onMapSelected, this);

        // 监听地图切换请求
        EventBus.on(EventTypes.Game.RequestMapChange, this.onMapChangeRequest, this);

        // ❌ 移除：游戏模式现在由 GameSession 直接调用 loadGameMapFromSession
        // EventBus.on(EventTypes.Game.GameStart, this._onGameStart, this);
    }

    /**
     * 处理地图选择事件
     */
    private async onMapSelected(data: { mapId: string, isEdit: boolean }): Promise<void> {
        this.log(`收到地图选择事件: mapId=${data.mapId}, isEdit=${data.isEdit}`);

        const result = await this.loadMap(data.mapId, data.isEdit);
        if (result.success) {
            // 显示 UIInGame（编辑器和游戏都用这个界面）
            console.log("[MapManager] loadMap成功, 显示 UIInGame");
            const { UIManager } = await import('../ui/core/UIManager');
            await UIManager.instance?.showUI("InGame");

            // 发送游戏开始事件
            console.log("[MapManager] 发送 GameStart 事件");
            EventBus.emit(EventTypes.Game.GameStart, {
                mode: data.isEdit ? "edit" : "play",  // ✅ 根据 isEdit 设置
                source: "map_select"
            });
        } else {
            // 发送加载失败事件
            console.error('[MapManager] loadMap失败:', result.error);
            EventBus.emit(EventTypes.Game.MapLoadFailed, {
                mapId: data.mapId,
                isEdit: data.isEdit,
                error: result.error
            });
        }
    }

    // /**
    //  * 游戏开始事件处理（从链上数据加载场景）
    //  * 事件数据：{ game, template, gameData }
    //  *
    //  * 参考 loadMap() 的实现，统一创建新的 GameMap 实例
    //  */
    // private async _onGameStart(data: any): Promise<void> {
    //     console.log('[MapManager] Game.GameStart event received');
    //     console.log('  Game ID:', data.game?.id);
    //     console.log('  Template tiles:', data.template?.tiles_static?.size);
    //     console.log('  GameData:', !!data.gameData);

    //     // 区分链上游戏 vs 本地编辑（通过是否有 template 判断）
    //     if (!data.template || !data.game) {
    //         // 本地编辑模式（旧的 GameStart 事件，来自 MapSelected）
    //         console.log('[MapManager] Local map event, ignoring (handled by MapSelected)');
    //         return;
    //     }

    //     try {
    //         // 1. 卸载当前地图（如果有）
    //         this.unloadCurrentMap();

    //         // 2. 创建新的地图节点
    //         const shortId = IdFormatter.shortenAddress(data.game.id).replace(/\.\.\./g, '___');
    //         const mapInstance = new Node(`ChainGame_${shortId}`);

    //         // 3. 添加 GameMap 组件
    //         const mapComponent = mapInstance.addComponent(GameMap);

    //         // 4. 创建临时 MapConfig（链上游戏不需要预制体）
    //         const tempConfig: MapConfig = {
    //             id: `chain_${data.game.id}`,
    //             name: `Chain Game`,
    //             prefabPath: '',  // 链上游戏不需要预制体
    //             previewImagePath: '',
    //             type: 'classic'
    //         };

    //         // 5. 初始化 GameMap（非编辑模式）
    //         console.log('[MapManager] Initializing GameMap (play mode)...');
    //         await mapComponent.init(tempConfig, false);  // isEdit = false

    //         // 6. 从链上数据加载场景
    //         console.log('[MapManager] Loading scene from chain data...');
    //         UINotification.info("正在加载游戏地图...");

    //         const loaded = await mapComponent.loadFromChainData(data.template, data.game);

    //         if (!loaded) {
    //             throw new Error('Failed to load game scene');
    //         }

    //         console.log('[MapManager] Game scene loaded successfully');

    //         // 7. 添加到容器
    //         const container = this.mapContainer || director.getScene();
    //         if (container) {
    //             container.addChild(mapInstance);
    //         }

    //         // 8. 更新当前地图状态
    //         this._currentMapInstance = mapInstance;
    //         this._currentMapComponent = mapComponent;
    //         this._currentMapId = tempConfig.id;

    //         this.log(`链上游戏场景加载成功: ${tempConfig.id}`);

    //         // 9. 初始化游戏状态到 Blackboard
    //         this._initializeGameState(data.game, data.gameData);

    //         // 10. 发送场景加载完成事件
    //         EventBus.emit(EventTypes.Game.MapLoaded, {
    //             gameId: data.game.id,
    //             mapId: tempConfig.id,
    //             success: true
    //         });

    //         UINotification.success("游戏地图加载完成");

    //     } catch (error) {
    //         console.error('[MapManager] Failed to load game scene:', error);
    //         UINotification.error("游戏地图加载失败");

    //         // 发送加载失败事件
    //         EventBus.emit(EventTypes.Game.MapLoadFailed, {
    //             error: error
    //         });
    //     }
    // }

    /**
     * 初始化游戏状态到 Blackboard
     */
    private _initializeGameState(game: any, gameData: any): void {
        console.log('[MapManager] Initializing game state to Blackboard');

        // 设置游戏基础信息
        Blackboard.instance.set('currentGameId', game.id);
        Blackboard.instance.set('currentRound', game.round);
        Blackboard.instance.set('currentTurn', game.turn);
        Blackboard.instance.set('currentGame', game);

        // 设置当前玩家信息
        // TODO: 根据当前地址找到玩家的 index
        if (game.players && game.players.length > 0) {
            const player = game.players[0];  // 临时用第一个玩家
            Blackboard.instance.set('playerName', `玩家 #1`);
            Blackboard.instance.set('playerMoney', Number(player.cash));
            Blackboard.instance.set('playerLevel', 1);
            Blackboard.instance.set('playerHp', 100);
            Blackboard.instance.set('playerMaxHp', 100);
            Blackboard.instance.set('playerExp', 0);
            Blackboard.instance.set('playerMaxExp', 1000);
        }

        // 设置游戏配置
        Blackboard.instance.set('gameData', gameData);

        // 初始化游戏时间
        Blackboard.instance.set('gameTime', 0);

        console.log('[MapManager] Game state initialized');
    }

    /**
     * 处理地图切换请求
     */
    private async onMapChangeRequest(data: { fromMapId: string; toMapId: string, isEdit?: boolean }): Promise<void> {
        this.log(`地图切换请求: ${data.fromMapId} -> ${data.toMapId}`);
        
        //如果toMapId为null，则卸载当前地图
        if (data.toMapId === null) {
            this.unloadCurrentMap();
            return;
        }

        //加载目标地图
        const result = await this.loadMap(data.toMapId, data.isEdit || false);
        if (!result.success) {
            console.error('[MapManager] 地图切换失败:', result.error);
        }
    }

    /**
     * 创建网格地面
     * 使用 GeometryRenderer 绘制网格线，支持鼠标点击检测
     * @param config 可选的网格地面配置
     */
    public createGridGround(config?: GridGroundConfig): Node {
        // 创建地面节点
        const groundNode = new Node('GridGround');
        
        // 添加 GridGround 组件
        const gridGroundComponent = groundNode.addComponent(GridGround);
        
        // 如果提供了配置，应用配置
        if (config) {
            gridGroundComponent.createWithConfig(config);
        }
        
        // 设置位置（以原点为中心）
        groundNode.setPosition(0, 0, 0);
        
        this.log('Grid ground created successfully with GridGround component');
        return groundNode;
    }

    /**
     * 获取当前地图的编辑模式
     */
    public getCurrentMapEditMode(): boolean {
        if (!this._currentMapComponent) {
            return false;
        }
        return this._currentMapComponent.isEditMode;
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
