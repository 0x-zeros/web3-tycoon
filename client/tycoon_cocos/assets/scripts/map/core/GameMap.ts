/**
 * 地图组件
 * 
 * 负责单个地图的加载、渲染、保存等核心功能
 * 使用新的组件化架构管理MapTile和MapObject
 * 
 * @author Web3 Tycoon Team
 * @version 2.0.0
 */

import { _decorator, Component, Node, Camera, resources, JsonAsset, find, Color, MeshRenderer, Vec3 } from 'cc';
import { MapTile } from './MapTile';
import { MapObject } from './MapObject';
import { MapSaveData, MapLoadOptions, MapSaveOptions, TileData, ObjectData, PropertyData } from '../data/MapDataTypes';
import { CameraController } from '../../camera/CameraController';
import { MapConfig } from '../MapManager';
import { VoxelSystem } from '../../voxel/VoxelSystem';
import { EventBus } from '../../events/EventBus';
import { EventTypes } from '../../events/EventTypes';
import { GridGround } from '../GridGround';
import { MapInteractionManager, MapInteractionData, MapInteractionEvent } from '../interaction/MapInteractionManager';
import { getWeb3BlockByBlockId, isWeb3Object, isWeb3Tile, isWeb3Property, getPropertySize } from '../../voxel/Web3BlockTypes';
import { Vec2 } from 'cc';
import { sys } from 'cc';
import { PaperActorFactory } from '../../role/PaperActorFactory';
import { PaperActor } from '../../role/PaperActor';
import { ActorConfigManager } from '../../role/ActorConfig';
import { MapGenerator } from '../generator/MapGenerator';
import { MapGenerationResult, MapGenerationMode } from '../generator/MapGeneratorTypes';

// Property信息接口
interface PropertyInfo {
    blockId: string;
    position: { x: number; z: number };  // 左下角位置
    size: 1 | 2;
    data?: {
        owner?: string;
        level?: number;
        price?: number;
        rent?: number[];
        functionType?: string; // 建筑功能类型（购买后选择）
    };
}

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
    
    @property({ displayName: "加载后重建2x2父容器", tooltip: "在加载地图数据后自动为2x2地产重建父容器" })
    public rebuildPropertyContainersAfterLoad: boolean = true;
    
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
    
    /** 交互管理器 */
    private _interactionManager: MapInteractionManager | null = null;
    
    /** 是否已初始化 */
    private _isInitialized: boolean = false;

    /** PaperActor管理 */
    private _actors: Map<string, Node> = new Map();         // NPC和物体的PaperActor
    private _buildings: Map<string, Node> = new Map();      // 建筑的PaperActor
    private _decorations: Map<string, Node> = new Map();    // 装饰物的体素节点
    private _actorsRoot: Node | null = null;                // Actor的根节点
    private _buildingsRoot: Node | null = null;             // 建筑的根节点
    
    /** 地图数据（用于保存） */
    private _mapSaveData: MapSaveData | null = null;
    
    /** 自动保存延迟（毫秒） */
    private readonly AUTO_SAVE_DELAY = 1000;
    
    /** 自动保存定时器 */
    private _autoSaveTimer: any = null;
    
    /** 是否有未保存的修改 */
    private _hasUnsavedChanges: boolean = false;

    /** Property信息注册表 (key: "x_z") */
    private _propertyRegistry: Map<string, PropertyInfo> = new Map();

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
            // 创建网格（只用于视觉参考）
            this.createEditModeGrid();
            // 初始化交互管理器
            this.initializeInteractionManager();
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

        // 创建PaperActor容器
        if (!this._actorsRoot) {
            this._actorsRoot = new Node('ActorsRoot');
            this.node.addChild(this._actorsRoot);
            console.log('[GameMap] Created ActorsRoot');
        }

        if (!this._buildingsRoot) {
            this._buildingsRoot = new Node('BuildingsRoot');
            this.node.addChild(this._buildingsRoot);
            console.log('[GameMap] Created BuildingsRoot');
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
     * 初始化交互管理器
     */
    private initializeInteractionManager(): void {
        // 添加MapInteractionManager组件
        this._interactionManager = this.node.addComponent(MapInteractionManager);
        this._interactionManager.targetCamera = this.mainCamera;
        this._interactionManager.debugMode = this.debugMode;
        
        // 监听交互事件
        EventBus.on(MapInteractionEvent.REQUEST_PLACE, this.onRequestPlace, this);
        EventBus.on(MapInteractionEvent.REQUEST_REMOVE, this.onRequestRemove, this);
        EventBus.on(MapInteractionEvent.ELEMENT_CLICKED, this.onElementClicked, this);
        
        console.log('[GameMap] Interaction manager initialized');
    }
    
    /**
     * 处理放置请求
     */
    private async onRequestPlace(data: MapInteractionData): Promise<void> {
        if (!this._isEditMode || !this._voxelSystem) return;
        
        const gridPos = data.gridPosition;
        
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
        } else if (isWeb3Property(typeId)) {
            // Property类型，放置在y=0，并处理相邻Tile
            const size = getPropertySize(this._currentSelectedBlockId);
            await this.placePropertyAt(this._currentSelectedBlockId, gridPos, size as 1 | 2);
        } else if (isWeb3Object(typeId)) {
            // NPC/物体类型，使用PaperActor
            await this.placeObjectAt(this._currentSelectedBlockId, gridPos);
        } else if (blockInfo.category === 'decoration') {
            // 装饰类型，保留体素渲染
            await this.placeDecorationAt(this._currentSelectedBlockId, gridPos);
        }
    }
    
    /**
     * 处理删除请求
     */
    private onRequestRemove(data: MapInteractionData): void {
        if (!this._isEditMode) return;
        
        const gridPos = data.gridPosition;
        
        // 右键：删除方块
        this.removeElementAt(gridPos);
    }
    
    /**
     * 处理元素点击
     */
    private onElementClicked(data: MapInteractionData): void {
        if (!this._isEditMode) return;
        
        console.log(`[GameMap] Element clicked: ${data.hitNode?.name} at grid (${data.gridPosition.x}, ${data.gridPosition.y})`);
        
        // TODO: 可以添加选中高亮等效果
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

        // 编辑模式下触发自动保存
        if (this._isEditMode) {
            this.scheduleAutoSave();
        }
    }
    
    /**
     * 在指定位置放置装饰（使用体素渲染）
     */
    private async placeDecorationAt(blockId: string, gridPos: Vec2): Promise<void> {
        const key = `${gridPos.x}_${gridPos.y}`;

        // 检查并移除已存在的装饰
        if (this._decorations.has(key)) {
            const existingDecoration = this._decorations.get(key);
            if (existingDecoration) {
                existingDecoration.destroy();
            }
            this._decorations.delete(key);
        }

        if (!this._voxelSystem) {
            console.error('[GameMap] VoxelSystem not initialized');
            return;
        }

        // 装饰使用体素渲染，创建体素节点
        const worldPos = new Vec3(gridPos.x, 1, gridPos.y);
        const decorationNode = await this._voxelSystem.createBlockNode(this.node, blockId, worldPos);

        if (decorationNode) {
            this._decorations.set(key, decorationNode);
            console.log(`[GameMap] Placed decoration ${blockId} at (${gridPos.x}, ${gridPos.y})`);
        } else {
            console.error(`[GameMap] Failed to create decoration ${blockId}`);
        }

        // 编辑模式下触发自动保存
        if (this._isEditMode) {
            this.scheduleAutoSave();
        }
    }

    /**
     * 在指定位置放置物体（NPC等，使用PaperActor）
     */
    private async placeObjectAt(blockId: string, gridPos: Vec2): Promise<void> {
        const key = `${gridPos.x}_${gridPos.y}`;

        // 检查是否已有Actor
        const existingActor = this._actors.get(key);
        if (existingActor) {
            existingActor.destroy();
            this._actors.delete(key);
        }

        // 使用PaperActor创建NPC/物体
        const worldPos = new Vec3(gridPos.x, 0.5, gridPos.y);
        const actorNode = PaperActorFactory.createFromBlockType(blockId, worldPos);
        if (actorNode) {
            actorNode.parent = this._actorsRoot;
            this._actors.set(key, actorNode);
            console.log(`[GameMap] Placed PaperActor ${blockId} at (${gridPos.x}, ${gridPos.y})`);
        } else {
            console.error(`[GameMap] Failed to create PaperActor for ${blockId}`);
        }

        // 编辑模式下触发自动保存
        if (this._isEditMode) {
            this.scheduleAutoSave();
        }
    }
    
    /**
     * 移除指定位置的元素（优先移除物体）
     */
    private removeElementAt(gridPos: Vec2): void {
        const key = `${gridPos.x}_${gridPos.y}`;

        // 1. 首先检查是否有PaperActor（NPC/物体）
        const actor = this._actors.get(key);
        if (actor) {
            actor.destroy();
            this._actors.delete(key);
            console.log(`[GameMap] Removed PaperActor at (${gridPos.x}, ${gridPos.y})`);
            if (this._isEditMode) {
                this.scheduleAutoSave();
            }
            return;
        }

        // 2. 检查是否是装饰（体素节点）
        const decoration = this._decorations.get(key);
        if (decoration) {
            decoration.destroy();
            this._decorations.delete(key);
            console.log(`[GameMap] Removed decoration at (${gridPos.x}, ${gridPos.y})`);
            if (this._isEditMode) {
                this.scheduleAutoSave();
            }
            return;
        }
        
        // 然后检查并移除地块（y=0层）
        const tile = this._tileIndex.get(key);
        if (tile) {
            // 删除地块
            this.removeTile(tile);
            console.log(`[GameMap] Removed tile at (${gridPos.x}, ${gridPos.y})`);

            // 编辑模式下触发自动保存
            if (this._isEditMode) {
                this.scheduleAutoSave();
            }
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
    
    /**
     * 清除所有已放置的地块和物体
     * 用于编辑模式下快速清空地图
     */
    public clearAllPlacedBlocks(): void {
        console.log('[GameMap] Clearing all placed blocks...');
        
        // 清除所有地块
        const tilesToRemove = [...this._tiles];
        for (const tile of tilesToRemove) {
            this.removeTile(tile);
        }
        
        // 清除所有物体
        const objectsToRemove = [...this._objects];
        for (const object of objectsToRemove) {
            this.removeObject(object);
        }

        // 清除所有装饰
        this._decorations.forEach((node) => {
            if (node && node.isValid) {
                node.destroy();
            }
        });
        this._decorations.clear();

        // 清除所有PaperActor（NPC/物体层）
        this._actors.forEach((node) => {
            if (node && node.isValid) {
                node.destroy();
            }
        });
        this._actors.clear();

        // 清除所有建筑PaperActor（去重后销毁）
        const uniqueBuildings = new Set(this._buildings.values());
        uniqueBuildings.forEach((node) => {
            if (node && node.isValid) {
                node.destroy();
            }
        });
        this._buildings.clear();

        // 清除Property容器残留（例如 2x2 父节点）
        if (this.tilesContainer) {
            const children = [...this.tilesContainer.children];
            for (const child of children) {
                if (child.name.startsWith('Property2x2_')) {
                    child.destroy();
                }
            }
        }
        
        // 清空索引
        this._tileIndex.clear();
        this._objectIndex.clear();

        // 清空Property注册
        this._propertyRegistry.clear();

        // 标记需要保存
        if (this._isEditMode) {
            this.scheduleAutoSave();
        }
        
        console.log('[GameMap] All blocks cleared');
    }
    
    /**
     * 升级建筑
     */
    public upgradeBuilding(gridPos: Vec2, newLevel: number): boolean {
        const key = `${gridPos.x}_${gridPos.y}`;
        const buildingNode = this._buildings.get(key);

        if (!buildingNode) {
            console.warn(`[GameMap] No building found at (${gridPos.x}, ${gridPos.y})`);
            return false;
        }

        const success = PaperActorFactory.upgradeBuilding(buildingNode, newLevel);
        if (success) {
            console.log(`[GameMap] Upgraded building at (${gridPos.x}, ${gridPos.y}) to level ${newLevel}`);

            // 更新Property注册信息
            const propertyKey = `${gridPos.x}_${gridPos.y}`;
            const propertyInfo = this._propertyRegistry.get(propertyKey);
            if (propertyInfo && propertyInfo.data) {
                propertyInfo.data.level = newLevel;
            }

            // 触发自动保存
            if (this._isEditMode) {
                this.scheduleAutoSave();
            }
        }

        return success;
    }

    // ========================= 自动保存 =========================
    
    /**
     * 调度自动保存
     * 使用防抖策略，避免频繁保存
     */
    private scheduleAutoSave(): void {
        // 标记有未保存的修改
        this._hasUnsavedChanges = true;
        
        // 清除之前的定时器
        if (this._autoSaveTimer) {
            clearTimeout(this._autoSaveTimer);
        }
        
        // 设置新的定时器
        this._autoSaveTimer = setTimeout(() => {
            this.executeAutoSave();
        }, this.AUTO_SAVE_DELAY);
    }
    
    /**
     * 执行自动保存
     */
    private async executeAutoSave(): Promise<void> {
        if (!this._hasUnsavedChanges) {
            return;
        }
        
        console.log('[GameMap] Auto-saving map...');
        
        const success = await this.saveMap({
            compress: false,
            includeGameRules: true
        });
        
        if (success) {
            this._hasUnsavedChanges = false;
            console.log('[GameMap] Auto-save completed');
            console.log(`[GameMap] Saved to: map_${this.mapId}`);
        } else {
            console.error('[GameMap] Auto-save failed');
        }
    }
    
    /**
     * 立即保存（不使用防抖）
     */
    public async saveImmediate(): Promise<boolean> {
        // 清除定时器
        if (this._autoSaveTimer) {
            clearTimeout(this._autoSaveTimer);
            this._autoSaveTimer = null;
        }
        
        // 执行保存
        const success = await this.saveMap({
            compress: false,
            includeGameRules: true
        });
        
        if (success) {
            this._hasUnsavedChanges = false;
        }
        
        return success;
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

            // 收集Property数据
            const propertiesData: PropertyData[] = [];

            this._propertyRegistry.forEach((info, key) => {
                const propertyTypeId = getWeb3BlockByBlockId(info.blockId)?.typeId || 0;
                propertiesData.push({
                    blockId: info.blockId,
                    typeId: propertyTypeId,
                    size: info.size,
                    position: info.position,
                    data: info.data
                } as PropertyData);
            });

            // 构建保存数据
            const saveData: MapSaveData = {
                mapId: this.mapId,
                mapName: this._mapConfig?.name || `Map ${this.mapId}`,
                version: '1.0.0',
                createTime: this._mapSaveData?.createTime || Date.now(),
                updateTime: Date.now(),
                gameMode: this._isEditMode ? 'edit' : 'play',
                tiles: tilesData,
                objects: objectsData,
                properties: propertiesData.length > 0 ? propertiesData : undefined
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
            
            // 输出保存信息
            const saveInfo = {
                mapId: this.mapId,
                tiles: tilesData.length,
                objects: objectsData.length,
                storage: sys.isBrowser ? 'localStorage' : 'file',
                key: saveKey,
                size: `${(jsonStr.length / 1024).toFixed(2)} KB`
            };
            console.log('[GameMap] Map saved successfully:', saveInfo);
            
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

            // 加载Property数据
            if (mapData.properties) {
                for (const propertyData of mapData.properties) {
                    const propertyKey = `${propertyData.position.x}_${propertyData.position.z}`;
                    const propertyInfo: PropertyInfo = {
                        blockId: propertyData.blockId,
                        position: propertyData.position,
                        size: propertyData.size,
                        data: propertyData.data
                    };
                    this._propertyRegistry.set(propertyKey, propertyInfo);
                }
            }
            
            // 保存地图数据
            this._mapSaveData = mapData;
            this.mapId = mapData.mapId;

            // 加载完成后可选重建2x2父容器
            if (this.rebuildPropertyContainersAfterLoad) {
                this.rebuildPropertyContainers();
            }

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

        // 清空装饰
        this._decorations.forEach((node) => {
            if (node && node.isValid) node.destroy();
        });
        this._decorations.clear();

        // 清空PaperActor（NPC）
        this._actors.forEach((node) => {
            if (node && node.isValid) node.destroy();
        });
        this._actors.clear();

        // 清空建筑PaperActor
        const uniq = new Set(this._buildings.values());
        uniq.forEach((node) => {
            if (node && node.isValid) node.destroy();
        });
        this._buildings.clear();

        // 清空Property容器与注册
        if (this.tilesContainer) {
            const children = [...this.tilesContainer.children];
            for (const child of children) {
                if (child.name.startsWith('Property2x2_')) {
                    child.destroy();
                }
            }
        }
        this._propertyRegistry.clear();

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
        // 保存未保存的修改
        if (this._isEditMode && this._hasUnsavedChanges) {
            console.log('[GameMap] Saving unsaved changes before cleanup...');
            this.saveImmediate();
        }
        
        // 清除自动保存定时器
        if (this._autoSaveTimer) {
            clearTimeout(this._autoSaveTimer);
            this._autoSaveTimer = null;
        }
        
        // 清空地图
        this.clearMap();
        
        // 取消事件监听
        if (this._isEditMode) {
            EventBus.off(EventTypes.UI.MapElementSelected, this.onMapElementSelected, this);
            EventBus.off(MapInteractionEvent.REQUEST_PLACE, this.onRequestPlace, this);
            EventBus.off(MapInteractionEvent.REQUEST_REMOVE, this.onRequestRemove, this);
            EventBus.off(MapInteractionEvent.ELEMENT_CLICKED, this.onElementClicked, this);
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

    // ========================= 地图生成器集成 =========================

    /**
     * 加载生成的地图数据
     * @param generatedMap 生成的地图数据
     */
    public async loadGeneratedMap(generatedMap: MapGenerationResult): Promise<void> {
        console.log('[GameMap] Loading generated map...');
        console.log(`[GameMap] Map size: ${generatedMap.width}x${generatedMap.height}`);
        console.log(`[GameMap] Mode: ${generatedMap.mode}`);
        console.log(`[GameMap] Seed: ${generatedMap.seed}`);

        // 清空现有地图
        this.clearMap();

        // 加载地块（包括 empty_land，作为可行走路径）
        for (const tile of generatedMap.tiles) {
            if (tile.blockId) {
                await this.placeTileAt(tile.blockId, tile.gridPos);
            }
        }

        // 加载地产
        for (const property of generatedMap.properties) {
            await this.placePropertyAt(property.blockId, property.gridPos, property.size);
        }

        // 加载特殊地块
        for (const specialTile of generatedMap.specialTiles) {
            await this.placeTileAt(specialTile.blockId, specialTile.gridPos);
        }

        console.log('[GameMap] Generated map loaded successfully');
        console.log(`[GameMap] Statistics:`, generatedMap.statistics);
    }

    /**
     * 生成新地图
     * @param mode 生成模式
     * @param params 生成参数
     */
    public async generateNewMap(mode: MapGenerationMode = MapGenerationMode.CLASSIC, params?: any): Promise<void> {
        console.log(`[GameMap] Generating new ${mode} map...`);

        // 创建地图生成器
        const generator = new MapGenerator({
            mode,
            mapWidth: 40,
            mapHeight: 40,
            ...params
        });

        // 生成地图
        const generatedMap = await generator.generateMap();

        // 加载生成的地图
        await this.loadGeneratedMap(generatedMap);
    }

    // ========================= Property相关方法 =========================

    /**
     * 放置Property
     * @param blockId Property的blockId
     * @param gridPos 网格位置（左下角）
     * @param size Property尺寸（1或2）
     */
    private async placePropertyAt(blockId: string, gridPos: Vec2, size: 1 | 2): Promise<void> {
        console.log(`[GameMap] Placing property ${blockId} at (${gridPos.x}, ${gridPos.y}) with size ${size}`);

        // 1. 检查所有占用格子是否可用
        const key = `${gridPos.x}_${gridPos.y}`;
        if (size === 2) {
            // 2x2建筑需要检查4个格子
            for (let dx = 0; dx < size; dx++) {
                for (let dz = 0; dz < size; dz++) {
                    const pos = new Vec2(gridPos.x + dx, gridPos.y + dz);
                    const checkKey = `${pos.x}_${pos.y}`;
                    if (this._tileIndex.has(checkKey)) {
                        console.warn(`[GameMap] Position (${pos.x}, ${pos.y}) is occupied, cannot place 2x2 property`);
                        return;
                    }
                }
            }
        }

        // 2. 先使用体素系统放置建筑方块
        if (size === 1) {
            // 1x1建筑：直接放置
            await this.placeTileAt(blockId, gridPos);
        } else {
            // 2x2建筑：使用体素系统放置
            await this.place2x2Property(blockId, gridPos);
        }

        // 3. 在建筑中心添加PaperActor（用于显示建筑精灵/动画）
        // 清除已存在的PaperActor
        const existingBuilding = this._buildings.get(key);
        if (existingBuilding) {
            existingBuilding.destroy();
            this._buildings.delete(key);
        }

        // 计算PaperActor的位置（建筑中心）
        const actorPos = new Vec3(gridPos.x, 0.1, gridPos.y);  // 稍微抬高避免Z-fighting
        if (size === 1) {
            // 1x1建筑：中心在格子中间
            actorPos.x += 0.5;
            actorPos.z += 0.5;
        } else if (size === 2) {
            // 2x2建筑：中心在4个格子的中间
            actorPos.x += 1.0;
            actorPos.z += 1.0;
        }

        // 创建PaperActor
        const buildingNode = PaperActorFactory.createBuilding(blockId, 0, actorPos);
        if (buildingNode) {
            buildingNode.parent = this._buildingsRoot;

            // 记录所有占用的格子都指向同一个PaperActor
            if (size === 2) {
                for (let dx = 0; dx < size; dx++) {
                    for (let dz = 0; dz < size; dz++) {
                        const occupiedKey = `${gridPos.x + dx}_${gridPos.y + dz}`;
                        this._buildings.set(occupiedKey, buildingNode);
                    }
                }
            } else {
                this._buildings.set(key, buildingNode);
            }

            console.log(`[GameMap] Added PaperActor for building ${blockId} at center (${actorPos.x}, ${actorPos.z})`);
        }

        // 3. 注册Property信息
        const propertyKey = `${gridPos.x}_${gridPos.y}`;
        const propertyInfo: PropertyInfo = {
            blockId,
            position: { x: gridPos.x, z: gridPos.y },
            size
        };
        this._propertyRegistry.set(propertyKey, propertyInfo);

        // 标记有未保存的修改
        this._hasUnsavedChanges = true;
        this.scheduleAutoSave();
    }

    /**
     * 检查网格位置是否有效
     */
    private isValidGridPosition(pos: Vec2): boolean {
        // TODO: 根据地图大小检查边界
        // 暂时使用简单的范围检查
        return pos.x >= -50 && pos.x <= 50 && pos.y >= -50 && pos.y <= 50;
    }

    /**
     * 放置2x2的Property
     * @param blockId Property的blockId
     * @param gridPos 网格位置（左下角）
     */
    private async place2x2Property(blockId: string, gridPos: Vec2): Promise<void> {
        console.log(`[GameMap] Placing 2x2 property ${blockId} at (${gridPos.x}, ${gridPos.y})`);

        // 创建一个主节点作为2x2 Property的容器
        const propertyNode = new Node(`Property2x2_${gridPos.x}_${gridPos.y}`);
        propertyNode.setParent(this.tilesContainer!);
        const propertyKey = `${gridPos.x}_${gridPos.y}`;

        // 为2x2 Property创建4个块，每个块占一个格子
        // 但它们都作为propertyNode的子节点，形成一个整体
        for (let dx = 0; dx < 2; dx++) {
            for (let dz = 0; dz < 2; dz++) {
                const pos = new Vec2(gridPos.x + dx, gridPos.y + dz);
                const key = `${pos.x}_${pos.y}`;

                // 创建tile节点
                const tileNode = new Node(`PropertyTile_${pos.x}_${pos.y}`);
                tileNode.setParent(propertyNode);  // 作为property容器的子节点

                // 添加MapTile组件
                const tile = tileNode.addComponent(MapTile);
                await tile.initialize(blockId, pos);

                // 2x2 Property默认缩放为1
                tileNode.setScale(1, 1, 1);

                // 添加到索引
                this._tiles.push(tile);
                this._tileIndex.set(key, tile);
            }
        }

        // 可选：给2x2 Property添加一个特殊标记，以便后续识别
        propertyNode['isProperty2x2'] = true;
        propertyNode['propertyBlockId'] = blockId;
        propertyNode['propertyPosition'] = gridPos;

        console.log(`[GameMap] Successfully placed 2x2 property at (${gridPos.x}, ${gridPos.y})`);
    }

    /**
     * 删除Property
     * @param propertyPos Property位置
     */
    private removeProperty(propertyPos: Vec2): void {
        const propertyKey = `${propertyPos.x}_${propertyPos.y}`;
        const propertyInfo = this._propertyRegistry.get(propertyKey);

        if (!propertyInfo) {
            return;
        }

        // 0. 先移除与该Property关联的建筑PaperActor（包括2x2情况下的重复键）
        const buildingNode = this._buildings.get(propertyKey);
        if (buildingNode && buildingNode.isValid) {
            // 删除一次节点
            buildingNode.destroy();
        }
        // 无论是否存在节点，都清理所有占用格子的_buildings映射
        if (propertyInfo.size === 2) {
            for (let dx = 0; dx < 2; dx++) {
                for (let dz = 0; dz < 2; dz++) {
                    const occupiedKey = `${propertyPos.x + dx}_${propertyPos.y + dz}`;
                    this._buildings.delete(occupiedKey);
                }
            }
        } else {
            this._buildings.delete(propertyKey);
        }

        // 1. 对于2x2 Property，先找到父容器节点
        if (propertyInfo.size === 2) {
            const containerName = `Property2x2_${propertyPos.x}_${propertyPos.y}`;
            const containerNode = this.tilesContainer?.getChildByName(containerName);
            if (containerNode) {
                // 删除整个容器节点（包括所有子节点）
                containerNode.destroy();
            }
            // 无论容器是否存在，都确保从索引与场景中移除4个格子
            for (let dx = 0; dx < 2; dx++) {
                for (let dz = 0; dz < 2; dz++) {
                    const pos = new Vec2(propertyPos.x + dx, propertyPos.y + dz);
                    const key = `${pos.x}_${pos.y}`;
                    const tile = this._tileIndex.get(key);
                    if (tile) {
                        this.removeTile(tile);
                    }
                }
            }
        } else {
            // 1x1 Property，使用原来的删除逻辑
            const pos = new Vec2(propertyPos.x, propertyPos.y);
            const key = `${pos.x}_${pos.y}`;
            const tile = this._tileIndex.get(key);
            if (tile) {
                this.removeTile(tile);
            }
        }

        // 2. 从注册表中删除
        this._propertyRegistry.delete(propertyKey);

        // 标记有未保存的修改
        this._hasUnsavedChanges = true;
        this.scheduleAutoSave();
    }

    /**
     * 加载后重建2x2 Property的父容器，并恢复缩放
     */
    private rebuildPropertyContainers(): void {
        this._propertyRegistry.forEach((info, propertyKey) => {
            if (info.size !== 2) return;
            const containerName = `Property2x2_${info.position.x}_${info.position.z}`;
            let containerNode = this.tilesContainer?.getChildByName(containerName);
            if (!containerNode) {
                containerNode = new Node(containerName);
                containerNode.setParent(this.tilesContainer!);
            }
            // 重新挂载四个子块并设置缩放
            for (let dx = 0; dx < 2; dx++) {
                for (let dz = 0; dz < 2; dz++) {
                    const x = info.position.x + dx;
                    const z = info.position.z + dz;
                    const key = `${x}_${z}`;
                    const tile = this._tileIndex.get(key);
                    if (tile && tile.node && tile.node.isValid) {
                        tile.node.setParent(containerNode);
                        tile.node.setScale(1, 1, 1);
                    }
                }
            }
            // 标记容器属性
            (containerNode as any)['isProperty2x2'] = true;
            (containerNode as any)['propertyBlockId'] = info.blockId;
            (containerNode as any)['propertyPosition'] = new Vec2(info.position.x, info.position.z);
        });
    }
}
