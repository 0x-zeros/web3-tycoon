/**
 * 地图组件
 * 
 * 负责单个地图的加载、渲染、保存等核心功能
 * 使用新的组件化架构管理MapTile和MapObject
 * 
 * @author Web3 Tycoon Team
 * @version 2.0.0
 */

import { _decorator, Component, Node, Camera, resources, JsonAsset, find, Color } from 'cc';
import { MapTile } from './MapTile';
import { MapObject } from './MapObject';
import { MapSaveData, MapLoadOptions, MapSaveOptions, TileData, ObjectData } from '../data/MapDataTypes';
import { CameraController } from '../../camera/CameraController';
import { MapConfig } from '../MapManager';
import { VoxelSystem } from '../../voxel/VoxelSystem';
import { EventBus } from '../../events/EventBus';
import { EventTypes } from '../../events/EventTypes';
import { GridGround, GridClickData } from '../GridGround';
import { getWeb3BlockByBlockId, isWeb3Object, isWeb3Tile } from '../../voxel/Web3BlockTypes';
import { Vec2 } from 'cc';
import { sys } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 地图组件主类
 * 使用组件化架构管理地块和物体
 */
@ccclass('GameMap')
export class GameMap extends Component {

    // 常量定义
    private readonly MAP_DATA_DIR = 'data/maps/';
    private readonly DEFAULT_MAP_ID = 'default_map';
    
    // ========================= 编辑器属性 =========================
    
    @property({ displayName: "地图ID", tooltip: "地图的唯一标识符" })
    public mapId: string = 'default_map';
    
    @property({ displayName: "地块容器节点", type: Node, tooltip: "用于放置所有地块的父节点" })
    public tilesContainer: Node | null = null;
    
    @property({ displayName: "物体容器节点", type: Node, tooltip: "用于放置所有物体的父节点" })
    public objectsContainer: Node | null = null;
    
    @property({ displayName: "主摄像机", type: Camera, tooltip: "场景主摄像机" })
    public mainCamera: Camera | null = null;
    
    @property({ displayName: "启用编辑模式", tooltip: "是否启用编辑模式" })
    public enableEditMode: boolean = false;
    
    @property({ displayName: "启用调试模式", tooltip: "显示调试信息" })
    public debugMode: boolean = false;
    
    // ========================= 私有属性 =========================
    
    /** 地块数组 (y=0层) */
    private _tiles: MapTile[] = [];
    
    /** 物体数组 (y=1层) */
    private _objects: MapObject[] = [];
    
    /** 地块索引 (格式: "x_z") */
    private _tileIndex: Map<string, MapTile> = new Map();
    
    /** 物体索引 (格式: "x_z") */
    private _objectIndex: Map<string, MapObject> = new Map();
    
    /** 地图配置 */
    private _mapConfig: MapConfig | null = null;
    
    /** 是否为编辑模式 */
    private _isEditMode: boolean = false;
    
    /** 体素系统 */
    private _voxelSystem: VoxelSystem | null = null;
    
    /** 当前选中的方块ID */
    private _currentSelectedBlockId: string | null = null;
    
    /** 是否已初始化 */
    private _isInitialized: boolean = false;
    
    /** 地图数据（用于保存） */
    private _mapSaveData: MapSaveData | null = null;
    
    // ========================= 生命周期方法 =========================
    
    protected onLoad(): void {
        console.log('[GameMap] Component loaded, waiting for init()');
    }
    
    protected onDestroy(): void {
        this.cleanup();
    }
    
    // ========================= 公共初始化方法 =========================
    
    /**
     * 初始化地图组件
     * @param config 地图配置
     * @param isEdit 是否为编辑模式
     */
    public async init(config: MapConfig, isEdit: boolean): Promise<void> {
        console.log('[GameMap] Initializing with config:', config.id, 'isEdit:', isEdit);
        
        // 保存配置
        this._mapConfig = config;
        this._isEditMode = isEdit;
        this.enableEditMode = isEdit;
        this.mapId = config.id || this.DEFAULT_MAP_ID;
        
        // 创建容器节点
        this.ensureContainers();
        
        // 获取摄像机（必须在创建网格之前）
        this.findMainCamera();
        
        // 编辑模式初始化
        if (isEdit) {
            // 先初始化体素系统
            await this.initializeVoxelSystem();
            // 再创建网格（需要相机已经初始化）
            this.createEditModeGrid();
        }
        
        // 尝试加载已保存的地图数据
        const loaded = await this.loadMap(this.mapId);
        if (!loaded && isEdit) {
            // 如果没有保存的地图，创建空地图
            this.createEmptyMap();
        }
        
        this._isInitialized = true;
        console.log('[GameMap] Initialization completed');
    }
    
    /**
     * 确保容器节点存在
     */
    private ensureContainers(): void {
        // 创建地块容器
        if (!this.tilesContainer) {
            this.tilesContainer = new Node('TilesContainer');
            this.node.addChild(this.tilesContainer);
            console.log('[GameMap] Created TilesContainer');
        }
        
        // 创建物体容器
        if (!this.objectsContainer) {
            this.objectsContainer = new Node('ObjectsContainer');
            this.node.addChild(this.objectsContainer);
            console.log('[GameMap] Created ObjectsContainer');
        }
    }
    
    /**
     * 查找主摄像机
     */
    private findMainCamera(): void {
        if (!this.mainCamera) {
            const cameraNode = find('Main Camera');
            if (cameraNode) {
                this.mainCamera = cameraNode.getComponent(Camera);
                console.log('[GameMap] Found Main Camera');
            } else {
                this.mainCamera = CameraController.getMainCamera();
                if (this.mainCamera) {
                    console.log('[GameMap] Got camera from CameraController');
                } else {
                    console.warn('[GameMap] No camera found');
                }
            }
        }
    }
    
    /**
     * 初始化体素系统
     */
    private async initializeVoxelSystem(): Promise<void> {
        try {
            this._voxelSystem = VoxelSystem.getInstance();
            if (!this._voxelSystem) {
                this._voxelSystem = await VoxelSystem.quickInitialize();
            }
            
            // 监听地面点击事件
            EventBus.on(EventTypes.Game.GroundClicked, this.onGroundClicked, this);
            
            // 监听方块选中事件
            EventBus.on(EventTypes.UI.MapElementSelected, this.onMapElementSelected, this);
            
            console.log('[GameMap] Voxel system initialized for edit mode');
        } catch (error) {
            console.error('[GameMap] Failed to initialize voxel system:', error);
        }
    }
    
    /**
     * 创建编辑模式网格
     */
    private createEditModeGrid(): void {
        // 创建网格地面节点
        const gridNode = new Node('GridGround');
        gridNode.setParent(this.node);
        
        // 添加GridGround组件
        const gridGround = gridNode.addComponent(GridGround);
        
        // 配置网格参数
        gridGround.step = 1;
        gridGround.halfSize = 50;
        gridGround.color = new Color(130, 130, 130, 255);
        gridGround.y = 0;
        gridGround.enableClickDetection = true;
        gridGround.enableSnapping = true;
        gridGround.debugMode = this.debugMode;
        gridGround.cam = this.mainCamera;
        
        // 手动调用初始化（如果组件还没有start）
        if (this.mainCamera) {
            gridGround.createWithConfig({
                step: 1,
                halfSize: 50,
                color: new Color(130, 130, 130, 255),
                y: 0,
                enableClickDetection: true,
                camera: this.mainCamera
            });
        }
        
        console.log('[GameMap] Edit mode grid created with GridGround component');
    }
    
    /**
     * 创建空地图
     */
    private createEmptyMap(): void {
        this._mapSaveData = {
            mapId: this.mapId,
            mapName: `Map ${this.mapId}`,
            version: '1.0.0',
            createTime: Date.now(),
            updateTime: Date.now(),
            gameMode: 'edit',
            tiles: [],
            objects: []
        };
        console.log('[GameMap] Created empty map');
    }
    
    // ========================= 地块/物体管理 =========================
    
    /**
     * 处理方块选中事件
     */
    private onMapElementSelected(data: any): void {
        this._currentSelectedBlockId = data.blockId || null;
        console.log(`[GameMap] Selected block: ${this._currentSelectedBlockId}`);
    }
    
    /**
     * 处理地面点击事件
     */
    private async onGroundClicked(data: GridClickData): Promise<void> {
        if (!this._isEditMode || !this._voxelSystem) return;
        
        const position = data.snappedPosition.clone();
        const gridPos = new Vec2(Math.floor(position.x), Math.floor(position.z));
        
        if (data.button === 0) {
            // 左键：放置方块
            if (!this._currentSelectedBlockId) {
                console.warn('[GameMap] No block selected');
                return;
            }
            
            // 根据方块类型决定放置高度
            const blockInfo = getWeb3BlockByBlockId(this._currentSelectedBlockId);
            if (!blockInfo) {
                console.warn(`[GameMap] Unknown block: ${this._currentSelectedBlockId}`);
                return;
            }
            
            const typeId = blockInfo.typeId as number;
            if (isWeb3Tile(typeId)) {
                // 地块类型，放置在y=0
                await this.placeTileAt(this._currentSelectedBlockId, gridPos);
            } else if (isWeb3Object(typeId)) {
                // 物体类型，放置在y=1
                await this.placeObjectAt(this._currentSelectedBlockId, gridPos);
            }
            
        } else if (data.button === 2) {
            // 右键：删除方块
            this.removeElementAt(gridPos);
        }
    }
    
    /**
     * 在指定位置放置地块
     */
    private async placeTileAt(blockId: string, gridPos: Vec2): Promise<void> {
        const key = `${gridPos.x}_${gridPos.y}`;
        
        // 如果该位置已有地块，先移除
        const existingTile = this._tileIndex.get(key);
        if (existingTile) {
            this.removeTile(existingTile);
        }
        
        // 创建新地块节点
        const tileNode = new Node(`Tile_${gridPos.x}_${gridPos.y}`);
        tileNode.setParent(this.tilesContainer!);
        
        // 添加MapTile组件
        const tile = tileNode.addComponent(MapTile);
        await tile.initialize(blockId, gridPos);
        
        // 添加到管理数组和索引
        this._tiles.push(tile);
        this._tileIndex.set(key, tile);
        
        console.log(`[GameMap] Placed tile ${blockId} at (${gridPos.x}, ${gridPos.y})`);
    }
    
    /**
     * 在指定位置放置物体
     */
    private async placeObjectAt(blockId: string, gridPos: Vec2): Promise<void> {
        const key = `${gridPos.x}_${gridPos.y}`;
        
        // 如果该位置已有物体，先移除
        const existingObject = this._objectIndex.get(key);
        if (existingObject) {
            this.removeObject(existingObject);
        }
        
        // 创建新物体节点
        const objectNode = new Node(`Object_${gridPos.x}_${gridPos.y}`);
        objectNode.setParent(this.objectsContainer!);
        
        // 添加MapObject组件
        const object = objectNode.addComponent('MapObject') as MapObject;
        await object.initialize(blockId, gridPos);
        
        // 添加到管理数组和索引
        this._objects.push(object);
        this._objectIndex.set(key, object);
        
        console.log(`[GameMap] Placed object ${blockId} at (${gridPos.x}, ${gridPos.y})`);
    }
    
    /**
     * 移除指定位置的元素（优先移除物体）
     */
    private removeElementAt(gridPos: Vec2): void {
        const key = `${gridPos.x}_${gridPos.y}`;
        
        // 优先检查并移除物体（y=1层）
        const object = this._objectIndex.get(key);
        if (object) {
            this.removeObject(object);
            console.log(`[GameMap] Removed object at (${gridPos.x}, ${gridPos.y})`);
            return;
        }
        
        // 然后检查并移除地块（y=0层）
        const tile = this._tileIndex.get(key);
        if (tile) {
            this.removeTile(tile);
            console.log(`[GameMap] Removed tile at (${gridPos.x}, ${gridPos.y})`);
            return;
        }
        
        console.log(`[GameMap] No element found at (${gridPos.x}, ${gridPos.y})`);
    }
    
    /**
     * 移除地块
     */
    private removeTile(tile: MapTile): void {
        const gridPos = tile.getGridPosition();
        const key = `${gridPos.x}_${gridPos.y}`;
        
        // 从索引中移除
        this._tileIndex.delete(key);
        
        // 从数组中移除
        const index = this._tiles.indexOf(tile);
        if (index >= 0) {
            this._tiles.splice(index, 1);
        }
        
        // 销毁节点
        if (tile.node && tile.node.isValid) {
            tile.node.destroy();
        }
    }
    
    /**
     * 移除物体
     */
    private removeObject(object: MapObject): void {
        const gridPos = object.getGridPosition();
        const key = `${gridPos.x}_${gridPos.y}`;
        
        // 从索引中移除
        this._objectIndex.delete(key);
        
        // 从数组中移除
        const index = this._objects.indexOf(object);
        if (index >= 0) {
            this._objects.splice(index, 1);
        }
        
        // 销毁节点
        object.destroyObject();
    }
    
    // ========================= 保存/加载 =========================
    
    /**
     * 保存地图
     */
    public async saveMap(options?: MapSaveOptions): Promise<boolean> {
        try {
            // 收集地块数据
            const tilesData: TileData[] = this._tiles.map(tile => tile.getData());
            
            // 收集物体数据
            const objectsData: ObjectData[] = this._objects.map(obj => obj.getData());
            
            // 构建保存数据
            const saveData: MapSaveData = {
                mapId: this.mapId,
                mapName: this._mapConfig?.name || `Map ${this.mapId}`,
                version: '1.0.0',
                createTime: this._mapSaveData?.createTime || Date.now(),
                updateTime: Date.now(),
                gameMode: this._isEditMode ? 'edit' : 'play',
                tiles: tilesData,
                objects: objectsData
            };
            
            // 添加游戏规则（如果需要）
            if (options?.includeGameRules && this._mapConfig) {
                saveData.gameRules = {
                    startingMoney: 10000,
                    passingBonus: 200,
                    landingBonus: 400,
                    maxPlayers: 4,
                    minPlayers: 2
                };
            }
            
            // 保存到本地存储（Web平台）或文件系统（原生平台）
            const saveKey = `map_${this.mapId}`;
            const jsonStr = JSON.stringify(saveData, null, options?.compress ? 0 : 2);
            
            if (sys.isBrowser) {
                // Web平台：保存到localStorage
                localStorage.setItem(saveKey, jsonStr);
                console.log(`[GameMap] Map saved to localStorage: ${saveKey}`);
            } else {
                // 原生平台：保存到文件
                // TODO: 实现文件保存
                console.log(`[GameMap] Map save to file not implemented yet`);
            }
            
            // 更新内部数据
            this._mapSaveData = saveData;
            
            console.log(`[GameMap] Map saved successfully with ${tilesData.length} tiles and ${objectsData.length} objects`);
            return true;
            
        } catch (error) {
            console.error('[GameMap] Failed to save map:', error);
            return false;
        }
    }
    
    /**
     * 加载地图
     */
    public async loadMap(mapId: string, options?: MapLoadOptions): Promise<boolean> {
        try {
            let mapData: MapSaveData | null = null;
            
            // 尝试从本地存储加载（Web平台）
            if (sys.isBrowser) {
                const saveKey = `map_${mapId}`;
                const jsonStr = localStorage.getItem(saveKey);
                if (jsonStr) {
                    mapData = JSON.parse(jsonStr);
                    console.log(`[GameMap] Map loaded from localStorage: ${saveKey}`);
                }
            }
            
            // 如果本地没有，尝试从资源加载
            if (!mapData) {
                const resourcePath = `${this.MAP_DATA_DIR}${mapId}`;
                try {
                    const jsonAsset = await new Promise<JsonAsset>((resolve, reject) => {
                        resources.load(resourcePath, JsonAsset, (err, asset) => {
                            if (err) reject(err);
                            else resolve(asset);
                        });
                    });
                    mapData = jsonAsset.json as MapSaveData;
                    console.log(`[GameMap] Map loaded from resources: ${resourcePath}`);
                } catch (err) {
                    console.log(`[GameMap] No saved map found for: ${mapId}`);
                    return false;
                }
            }
            
            if (!mapData) {
                return false;
            }
            
            // 清空现有地图（如果需要）
            if (options?.clearExisting !== false) {
                this.clearMap();
            }
            
            // 加载地块
            let loadedTiles = 0;
            for (const tileData of mapData.tiles) {
                const tileNode = new Node(`Tile_${tileData.position.x}_${tileData.position.z}`);
                tileNode.setParent(this.tilesContainer!);
                
                const tile = tileNode.addComponent(MapTile);
                await tile.loadData(tileData);
                
                const key = `${tileData.position.x}_${tileData.position.z}`;
                this._tiles.push(tile);
                this._tileIndex.set(key, tile);
                loadedTiles++;
                
                // 进度回调
                if (options?.onProgress) {
                    const progress = loadedTiles / (mapData.tiles.length + mapData.objects.length);
                    options.onProgress(progress);
                }
            }
            
            // 加载物体
            let loadedObjects = 0;
            for (const objectData of mapData.objects) {
                const objectNode = new Node(`Object_${objectData.position.x}_${objectData.position.z}`);
                objectNode.setParent(this.objectsContainer!);
                
                const object = objectNode.addComponent('MapObject') as MapObject;
                await object.loadData(objectData);
                
                const key = `${objectData.position.x}_${objectData.position.z}`;
                this._objects.push(object);
                this._objectIndex.set(key, object);
                loadedObjects++;
                
                // 进度回调
                if (options?.onProgress) {
                    const progress = (loadedTiles + loadedObjects) / (mapData.tiles.length + mapData.objects.length);
                    options.onProgress(progress);
                }
            }
            
            // 保存地图数据
            this._mapSaveData = mapData;
            this.mapId = mapData.mapId;
            
            console.log(`[GameMap] Map loaded successfully: ${loadedTiles} tiles, ${loadedObjects} objects`);
            return true;
            
        } catch (error) {
            console.error('[GameMap] Failed to load map:', error);
            return false;
        }
    }
    
    /**
     * 清空地图
     */
    public clearMap(): void {
        // 清空地块
        for (const tile of this._tiles) {
            if (tile.node && tile.node.isValid) {
                tile.node.destroy();
            }
        }
        this._tiles = [];
        this._tileIndex.clear();
        
        // 清空物体
        for (const object of this._objects) {
            object.destroyObject();
        }
        this._objects = [];
        this._objectIndex.clear();
        
        console.log('[GameMap] Map cleared');
    }
    
    // ========================= 查询方法 =========================
    
    /**
     * 获取指定位置的地块
     */
    public getTileAt(x: number, z: number): MapTile | null {
        const key = `${x}_${z}`;
        return this._tileIndex.get(key) || null;
    }
    
    /**
     * 获取指定位置的物体
     */
    public getObjectAt(x: number, z: number): MapObject | null {
        const key = `${x}_${z}`;
        return this._objectIndex.get(key) || null;
    }
    
    /**
     * 获取所有地块
     */
    public getAllTiles(): MapTile[] {
        return [...this._tiles];
    }
    
    /**
     * 获取所有物体
     */
    public getAllObjects(): MapObject[] {
        return [...this._objects];
    }
    
    /**
     * 获取地图统计信息
     */
    public getMapStats(): any {
        return {
            tileCount: this._tiles.length,
            objectCount: this._objects.length,
            mapId: this.mapId,
            isEditMode: this._isEditMode,
            hasVoxelSystem: this._voxelSystem !== null
        };
    }
    
    // ========================= 清理 =========================
    
    /**
     * 清理资源
     */
    private cleanup(): void {
        // 清空地图
        this.clearMap();
        
        // 取消事件监听
        if (this._isEditMode) {
            EventBus.off(EventTypes.Game.GroundClicked, this.onGroundClicked, this);
            EventBus.off(EventTypes.UI.MapElementSelected, this.onMapElementSelected, this);
        }
        
        // 清理引用
        this._voxelSystem = null;
        this._mapConfig = null;
        this._mapSaveData = null;
        this._currentSelectedBlockId = null;
        
        console.log('[GameMap] Cleanup completed');
    }
    
    // ========================= Getters =========================
    
    /**
     * 是否为编辑模式
     */
    public get isEditMode(): boolean {
        return this._isEditMode;
    }
    
    /**
     * 是否已初始化
     */
    public get isInitialized(): boolean {
        return this._isInitialized;
    }
    
    /**
     * 获取地图ID
     */
    public get currentMapId(): string {
        return this.mapId;
    }
}