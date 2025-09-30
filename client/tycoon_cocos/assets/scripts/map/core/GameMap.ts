/**
 * 地图组件
 * 
 * 负责单个地图的加载、渲染、保存等核心功能
 * 使用新的组件化架构管理MapTile和MapObject
 * 
 * @author Web3 Tycoon Team
 * @version 2.0.0
 */

import { _decorator, Component, Node, Camera, resources, JsonAsset, find, Color, MeshRenderer, Vec3, Label, Canvas, UITransform, director } from 'cc';
import { MapTile } from './MapTile';
import { MapObject } from './MapObject';
import { MapSaveData, MapLoadOptions, MapSaveOptions, TileData, ObjectData, PropertyData, BuildingData } from '../data/MapDataTypes';
import { CameraController } from '../../camera/CameraController';
import { MapConfig } from '../MapManager';
import { VoxelSystem } from '../../voxel/VoxelSystem';
import { EventBus } from '../../events/EventBus';
import { EventTypes } from '../../events/EventTypes';
import { Blackboard } from '../../events/Blackboard';
import { GridGround } from '../GridGround';
import { MapInteractionManager, MapInteractionData, MapInteractionEvent } from '../interaction/MapInteractionManager';
import { getWeb3BlockByBlockId, isWeb3Object, isWeb3Tile, isWeb3Building, getBuildingSize, Web3TileType } from '../../voxel/Web3BlockTypes';
import { Vec2 } from 'cc';
import { sys } from 'cc';
import { PaperActorFactory } from '../../role/PaperActorFactory';
import { PaperActor } from '../../role/PaperActor';
import { ActorConfigManager } from '../../role/ActorConfig';

// Building信息接口
interface BuildingInfo {
    blockId: string;
    position: { x: number; z: number };  // 左下角位置
    size: 1 | 2;
    direction?: number;  // 方向(0-3)，对应Y轴旋转 0°, 90°, 180°, 270°
    buildingId?: number;  // Building编号（u16最大值65535表示无效）
    entranceTileIds?: [number, number];  // 入口tile的ID（最多2个，1x1建筑第二个为65535）
    owner?: string;
    level?: number;
    price?: number;
    rent?: number[];
    mortgaged?: boolean;
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

    /** ID标签节点容器 */
    private _idLabelsRoot: Node | null = null; // 旧3D方式的占位（不再使用）
    private _idLabelsRootUI: Node | null = null; // 新的UI容器
    private _uiCanvas: Canvas | null = null; // Canvas引用

    /** ID标签映射（key -> UI Label节点） */
    private _idLabels: Map<string, Node> = new Map();
    /** 每个Label的世界坐标（用于投射到UI） */
    private _idLabelWorldPos: Map<string, Vec3> = new Map();
    
    /** 是否有未保存的修改 */
    private _hasUnsavedChanges: boolean = false;

    /** Building信息注册表 (key: "x_z") */
    private _buildingRegistry: Map<string, BuildingInfo> = new Map();

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
        // 从Blackboard获取loadFromLocalStorage选项，默认为true
        const loadFromLocalStorage = (Blackboard.instance.get("loadFromLocalStorage") as boolean | undefined) ?? true;
        const loaded = await this.loadMap(this.mapId, { loadFromLocalStorage });
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
        const isProperty = isWeb3Building(typeId);

        // 检查当前位置是否有地产或tile
        const existingProperty = this.findBuilding2x2Info(gridPos);
        const existingTileKey = `${gridPos.x}_${gridPos.y}`;
        const existingTile = this._tileIndex.get(existingTileKey);

        // 如果要放置的是地产
        if (isProperty) {
            // 检查是否是相同类型的地产
            if (existingProperty && existingProperty.blockId === this._currentSelectedBlockId) {
                // 相同类型的地产，循环切换朝向
                const propertyPos = new Vec2(existingProperty.position.x, existingProperty.position.z);
                this.cycleBuildingDirection(propertyPos);
                return;  // 不需要重新放置，只切换朝向
            }

            // 不同类型的地产或没有地产，执行替换逻辑
            if (existingProperty && existingProperty.size === 2) {
                const newSize = getBuildingSize(this._currentSelectedBlockId);
                if (newSize === 2) {
                    // 如果新地产的左下角与现有地产相同，可以替换
                    if (gridPos.x === existingProperty.position.x && gridPos.y === existingProperty.position.z) {
                        console.log(`[GameMap] Replacing 2x2 property at (${gridPos.x}, ${gridPos.y})`);
                    } else {
                        // 否则需要先删除现有的2x2地产
                        console.log(`[GameMap] Removing existing 2x2 property to place new one`);
                        const propertyPos = new Vec2(existingProperty.position.x, existingProperty.position.z);
                        this.removeBuilding(propertyPos);
                    }
                }
            }

            // Property类型，放置在y=0，并处理相邻Tile
            const size = getBuildingSize(this._currentSelectedBlockId);
            await this.placeBuildingAt(this._currentSelectedBlockId, gridPos, size as 1 | 2);
        }
        // 如果要放置的是普通tile
        else if (isWeb3Tile(typeId)) {
            // 检查是否是相同类型的tile
            if (existingTile) {
                const existingBlockId = existingTile.getBlockId();
                if (existingBlockId === this._currentSelectedBlockId) {
                    // 相同类型的tile，不做处理
                    console.log(`[GameMap] Same tile type at (${gridPos.x}, ${gridPos.y}), skipping`);
                    return;
                }
            }

            // 如果当前位置有2x2地产，需要先删除
            if (existingProperty && existingProperty.size === 2) {
                console.log(`[GameMap] Removing existing 2x2 property to place new tile`);
                const propertyPos = new Vec2(existingProperty.position.x, existingProperty.position.z);
                this.removeBuilding(propertyPos);
            }

            // 地块类型，放置在y=0
            await this.placeTileAt(this._currentSelectedBlockId, gridPos);
        }
        // 其他类型（NPC、装饰等）
        else {
            // 如果当前位置有2x2地产，需要先删除
            if (existingProperty && existingProperty.size === 2) {
                console.log(`[GameMap] Removing existing 2x2 property to place new element`);
                const propertyPos = new Vec2(existingProperty.position.x, existingProperty.position.z);
                this.removeBuilding(propertyPos);
            }

            if (isWeb3Object(typeId)) {
                // NPC/物体类型，使用PaperActor
                await this.placeObjectAt(this._currentSelectedBlockId, gridPos);
            } else if (blockInfo.category === 'decoration') {
                // 装饰类型，保留体素渲染
                await this.placeDecorationAt(this._currentSelectedBlockId, gridPos);
            }
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

        const gridPos = data.gridPosition;
        const key = `${gridPos.x}_${gridPos.y}`;

        // 获取点击位置的tile和property信息
        const tile = this._tileIndex.get(key);
        const buildingInfo = this.findBuilding2x2Info(gridPos);

        let eventData: any = {
            gridPos: { x: gridPos.x, y: gridPos.y }
        };

        // 添加tile ID信息
        if (tile) {
            const tileId = tile.getTileId();
            const blockId = tile.getBlockId();
            const blockInfo = getWeb3BlockByBlockId(blockId);

            eventData.tileId = tileId;
            eventData.blockId = blockId;
            eventData.blockName = blockInfo?.name || blockId;
        }

        // 添加property ID信息
        if (buildingInfo) {
            eventData.buildingId = buildingInfo.buildingId;
            eventData.buildingBlockId = buildingInfo.blockId;
            const propertyBlockInfo = getWeb3BlockByBlockId(buildingInfo.blockId);
            eventData.blockName = propertyBlockInfo?.name || buildingInfo.blockId;
            eventData.blockId = buildingInfo.blockId;
        }

        // 发送事件以更新UI
        if (tile || buildingInfo) {
            EventBus.emit(EventTypes.UI.MapElementSelected, eventData);
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

        // 3. 检查是否是Property（包括2x2）
        const buildingInfo = this.findBuilding2x2Info(gridPos);
        if (buildingInfo) {
            // 使用Property的左下角位置进行删除
            const propertyPos = new Vec2(buildingInfo.position.x, buildingInfo.position.z);
            this.removeBuilding(propertyPos);
            console.log(`[GameMap] Removed ${buildingInfo.size}x${buildingInfo.size} property at base position (${propertyPos.x}, ${propertyPos.y})`);
            if (this._isEditMode) {
                this.scheduleAutoSave();
            }
            return;
        }

        // 4. 最后检查普通地块（y=0层）
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
        
        // 复用 clearMap 的清理逻辑，避免重复代码
        this.clearMap();

        // 编辑模式下触发自动保存
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
            const buildingInfo = this._buildingRegistry.get(propertyKey);
            if (buildingInfo) {
                buildingInfo.level = newLevel;
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

            // 收集Building数据
            const buildingsData: BuildingData[] = [];

            this._buildingRegistry.forEach((info, key) => {
                const buildingTypeId = getWeb3BlockByBlockId(info.blockId)?.typeId || 0;
                buildingsData.push({
                    blockId: info.blockId,
                    typeId: buildingTypeId,
                    size: info.size,
                    position: info.position,
                    direction: info.direction,  // 保存朝向
                    buildingId: info.buildingId,
                    entranceTileIds: info.entranceTileIds,  // 保存入口tile IDs
                    owner: info.owner,
                    level: info.level,
                    price: info.price,
                    rent: info.rent,
                    mortgaged: info.mortgaged
                } as BuildingData);
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
                buildings: buildingsData.length > 0 ? buildingsData : undefined
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

            // 尝试从本地存储加载（Web平台）- 仅在options.loadFromLocalStorage不为false时执行
            if (sys.isBrowser && options?.loadFromLocalStorage !== false) {
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

            // 加载Building数据并重建建筑PaperActor
            const buildingsToLoad = mapData.buildings;
            if (buildingsToLoad) {
                for (const buildingData of buildingsToLoad) {
                    const buildingKey = `${buildingData.position.x}_${buildingData.position.z}`;
                    const buildingInfo: BuildingInfo = {
                        blockId: buildingData.blockId,
                        position: buildingData.position,
                        size: buildingData.size,
                        direction: buildingData.direction || 0,  // 保存朝向
                        buildingId: buildingData.buildingId,
                        entranceTileIds: buildingData.entranceTileIds,  // 加载入口tile IDs
                        owner: buildingData.owner,
                        level: buildingData.level,
                        price: buildingData.price,
                        rent: buildingData.rent,
                        mortgaged: buildingData.mortgaged
                    };
                    this._buildingRegistry.set(buildingKey, buildingInfo);

                    // 使用统一的方法重新创建Building的PaperActor
                    const gridPos = new Vec2(buildingData.position.x, buildingData.position.z);
                    const buildingNode = this.createBuildingPaperActor(
                        buildingData.blockId,
                        gridPos,
                        buildingData.size,
                        buildingData.level || 0,
                        buildingInfo.direction
                    );

                    if (!buildingNode) {
                        console.warn(`[GameMap] Failed to recreate building ${buildingData.blockId}`);
                    }
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

        // 清空建筑注册表
        this._buildingRegistry.clear();

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

        // 先清理ID标签
        this.hideIds();

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

    // ========================= Property相关方法 =========================

    /**
     * 找到最佳朝向（朝向有路径tile的方向）
     * @param gridPos 地产位置
     * @param size 地产大小
     * @returns 朝向（0-3），默认返回0
     */
    private findBestDirection(gridPos: Vec2, size: 1 | 2): number {
        // 四个方向：0=南(+z), 1=西(-x), 2=北(-z), 3=东(+x)
        const directions = [
            { dx: 0, dz: 1, dir: 0 },   // 南 (+z)
            { dx: 1, dz: 0, dir: 1 },   // 西 (+x) - 修正：朝向+x实际是西
            { dx: 0, dz: -1, dir: 2 },  // 北 (-z)
            { dx: -1, dz: 0, dir: 3 }   // 东 (-x) - 修正：朝向-x实际是东
        ];

        // 检查每个方向是否有路径tile
        for (const { dx, dz, dir } of directions) {
            let hasPath = false;

            if (size === 1) {
                // 1x1地产：检查相邻的一个格子
                const checkPos = new Vec2(gridPos.x + dx, gridPos.y + dz);
                const key = `${checkPos.x}_${checkPos.y}`;
                const tile = this._tileIndex.get(key);
                if (tile && this.isPathTile(tile)) {
                    hasPath = true;
                }
            } else {
                // 2x2地产：检查该方向的两个格子
                for (let i = 0; i < 2; i++) {
                    let checkX = gridPos.x;
                    let checkZ = gridPos.y;

                    if (dx !== 0) {
                        // 东西方向：检查两个纵向格子
                        checkX = gridPos.x + (dx > 0 ? 2 : -1);
                        checkZ = gridPos.y + i;
                    } else {
                        // 南北方向：检查两个横向格子
                        checkX = gridPos.x + i;
                        checkZ = gridPos.y + (dz > 0 ? 2 : -1);
                    }

                    const key = `${checkX}_${checkZ}`;
                    const tile = this._tileIndex.get(key);
                    if (tile && this.isPathTile(tile)) {
                        hasPath = true;
                        break;
                    }
                }
            }

            if (hasPath) {
                return dir;
            }
        }

        return 0; // 默认朝向南
    }

    /**
     * 检查tile是否是路径类型
     */
    private isPathTile(tile: MapTile): boolean {
        if (!tile) return false;

        const blockId = tile.getBlockId();

        // 排除建筑block（building_1x1 和 building_2x2）
        if (blockId === 'web3:building_1x1' || blockId === 'web3:building_2x2') {
            return false;
        }

        // 所有其他类型的tile都算作路径（包括property tile）
        return true;
    }

    /**
     * 放置Property
     * @param blockId Property的blockId
     * @param gridPos 网格位置（左下角）
     * @param size Property尺寸（1或2）
     */
    private async placeBuildingAt(blockId: string, gridPos: Vec2, size: 1 | 2): Promise<void> {
        console.log(`[GameMap] Placing building ${blockId} at (${gridPos.x}, ${gridPos.y}) with size ${size}`);

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
            // 1x1建筑：直接放置 + 重命名节点便于调试
            await this.placeTileAt(blockId, gridPos);
            const renamedKey = `${gridPos.x}_${gridPos.y}`;
            const placedTile = this._tileIndex.get(renamedKey);
            if (placedTile && placedTile.node && placedTile.node.isValid) {
                placedTile.node.name = `Building1x1Tile_${renamedKey}`;
            }
        } else {
            // 2x2建筑：使用体素系统放置
            await this.place2x2Building(blockId, gridPos);
        }

        // 3. 在建筑中心添加PaperActor（用于显示建筑精灵/动画）
        // 清除已存在的PaperActor
        const existingBuilding = this._buildings.get(key);
        if (existingBuilding) {
            existingBuilding.destroy();
            this._buildings.delete(key);
        }

        // 使用统一的方法创建PaperActor
        const direction = this.findBestDirection(gridPos, size);
        const buildingNode = this.createBuildingPaperActor(blockId, gridPos, size, 0, direction);
        if (!buildingNode) {
            console.warn(`[GameMap] Failed to create PaperActor for ${blockId}`);
        }

        // 4. 注册Property信息
        const propertyKey = `${gridPos.x}_${gridPos.y}`;
        const buildingInfo: BuildingInfo = {
            blockId,
            position: { x: gridPos.x, z: gridPos.y },
            size,
            direction
        };
        this._buildingRegistry.set(propertyKey, buildingInfo);

        // 标记有未保存的修改
        this._hasUnsavedChanges = true;
        this.scheduleAutoSave();
    }

    /**
     * 循环切换地产朝向
     * @param gridPos 网格位置
     */
    private cycleBuildingDirection(gridPos: Vec2): void {
        const key = `${gridPos.x}_${gridPos.y}`;
        const buildingInfo = this._buildingRegistry.get(key);

        if (!buildingInfo) {
            console.warn(`[GameMap] No property found at (${gridPos.x}, ${gridPos.y})`);
            return;
        }

        // 循环切换朝向: 0 -> 1 -> 2 -> 3 -> 0
        const newDirection = ((buildingInfo.direction || 0) + 1) % 4;
        buildingInfo.direction = newDirection;

        // 更新PaperActor的朝向
        const buildingNode = this._buildings.get(key);
        if (buildingNode && buildingNode.isValid) {
            const actor = buildingNode.getComponent(PaperActor);
            if (actor) {
                actor.setDirection(newDirection);
                console.log(`[GameMap] Property direction cycled to ${newDirection} at (${gridPos.x}, ${gridPos.y})`);
            }
        }

        // 标记有未保存的修改
        this._hasUnsavedChanges = true;
        this.scheduleAutoSave();
    }

    /**
     * 创建Property的PaperActor（统一的创建逻辑）
     * @param blockId Property的blockId
     * @param gridPos 网格位置（左下角）
     * @param size Property尺寸（1或2）
     * @param level 建筑等级
     * @param direction 建筑朝向（可选，不提供则自动计算）
     * @returns 创建的建筑节点
     */
    private createBuildingPaperActor(
        blockId: string,
        gridPos: Vec2,
        size: 1 | 2,
        level: number = 0,
        direction?: number
    ): Node | null {
        // 1. 计算PaperActor的位置（统一标准）
        // PaperActor原点在底部中心，Y坐标统一为0.5
        let actorPos: Vec3;
        if (size === 1) {
            // 1x1地产：位置在格子中心
            actorPos = new Vec3(gridPos.x + 0.5, 0.5, gridPos.y + 0.5);
        } else {
            // 2x2地产：位置在4个格子的中心
            actorPos = new Vec3(
                gridPos.x + 1,
                0.5,
                gridPos.y + 1
            );
        }

        // 2. 如果没有提供朝向，自动计算最佳朝向
        if (direction === undefined) {
            direction = this.findBestDirection(gridPos, size);
        }

        // 3. 创建PaperActor
        const buildingNode = PaperActorFactory.createBuilding(blockId, level, actorPos);
        if (buildingNode) {
            buildingNode.parent = this._buildingsRoot;

            // 4. 设置建筑朝向
            const actor = buildingNode.getComponent(PaperActor);
            if (actor) {
                actor.setDirection(direction);
            }

            // 5. 记录所有占用的格子都指向同一个PaperActor
            const key = `${gridPos.x}_${gridPos.y}`;
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

            console.log(`[GameMap] Created PaperActor for ${blockId} at (${actorPos.x}, ${actorPos.y}, ${actorPos.z}) with direction ${direction}`);
        }

        return buildingNode;
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
    private async place2x2Building(blockId: string, gridPos: Vec2): Promise<void> {
        console.log(`[GameMap] Placing 2x2 building ${blockId} at (${gridPos.x}, ${gridPos.y})`);

        // 2x2 建筑：创建父容器，清理占位，并生成4个可见的体素块（MapTile）
        // 这样可以与删除/重建逻辑复用统一流程

        // 1) 创建/获取父容器
        const containerName = `Property2x2_${gridPos.x}_${gridPos.y}`;
        let containerNode = this.tilesContainer?.getChildByName(containerName);
        if (!containerNode) {
            containerNode = new Node(containerName);
            containerNode.setParent(this.tilesContainer!);
        }

        // 2) 清理区域内任何已有tile
        for (let dx = 0; dx < 2; dx++) {
            for (let dz = 0; dz < 2; dz++) {
                const pos = new Vec2(gridPos.x + dx, gridPos.y + dz);
                const key = `${pos.x}_${pos.y}`;

                const existingTile = this._tileIndex.get(key);
                if (existingTile) {
                    this.removeTile(existingTile);
                }
            }
        }

        // 3) 创建4个MapTile作为可见基座块
        for (let dx = 0; dx < 2; dx++) {
            for (let dz = 0; dz < 2; dz++) {
                const pos = new Vec2(gridPos.x + dx, gridPos.y + dz);
                const key = `${pos.x}_${pos.y}`;

                // 新建子节点并放到容器下，命名更语义化
                const tileNode = new Node(`Building2x2Tile_${pos.x}_${pos.y}`);
                tileNode.setParent(containerNode);

                // 添加MapTile并初始化为对应building方块
                const tile = tileNode.addComponent(MapTile);
                await tile.initialize(blockId, pos);

                // 注册到索引与数组，便于统一删除与查询
                this._tiles.push(tile);
                this._tileIndex.set(key, tile);
            }
        }

        // 标记容器属性（供后续重建使用）
        (containerNode as any)['isProperty2x2'] = true;
        (containerNode as any)['propertyBlockId'] = blockId;
        (containerNode as any)['propertyPosition'] = gridPos.clone();

        console.log(`[GameMap] Created 2x2 building base tiles for ${blockId} at (${gridPos.x}, ${gridPos.y})`);
    }

    /**
     * 删除Property
     * @param propertyPos Property位置
     */
    private removeBuilding(propertyPos: Vec2): void {
        const propertyKey = `${propertyPos.x}_${propertyPos.y}`;
        const buildingInfo = this._buildingRegistry.get(propertyKey);

        if (!buildingInfo) {
            return;
        }

        // 0. 先移除与该Property关联的建筑PaperActor（包括2x2情况下的重复键）
        const buildingNode = this._buildings.get(propertyKey);
        if (buildingNode && buildingNode.isValid) {
            // 删除一次节点
            buildingNode.destroy();
        }
        // 无论是否存在节点，都清理所有占用格子的_buildings映射
        if (buildingInfo.size === 2) {
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
        if (buildingInfo.size === 2) {
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
        this._buildingRegistry.delete(propertyKey);

        // 标记有未保存的修改
        this._hasUnsavedChanges = true;
        this.scheduleAutoSave();
    }

    /**
     * 加载后重建2x2 Property的父容器，并恢复缩放
     */
    private rebuildPropertyContainers(): void {
        this._buildingRegistry.forEach((info, propertyKey) => {
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

    /**
     * 根据网格位置查找其所属的Property信息（支持2x2）
     * @param gridPos 网格位置
     * @returns Property信息，如果不是Property则返回null
     */
    private findBuilding2x2Info(gridPos: Vec2): BuildingInfo | null {
        // 先检查是否是2x2地产的一部分
        for (const [key, info] of this._buildingRegistry) {
            if (info.size === 2) {
                const basePos = info.position;
                // 检查是否在2x2范围内
                if (gridPos.x >= basePos.x && gridPos.x < basePos.x + 2 &&
                    gridPos.y >= basePos.z && gridPos.y < basePos.z + 2) {
                    return info;
                }
            }
        }

        // 如果不是2x2的一部分，检查是否是1x1地产
        const key = `${gridPos.x}_${gridPos.y}`;
        return this._buildingRegistry.get(key) || null;
    }

    /**
     * 检查某个位置是否属于2x2地产的一部分
     * @param gridPos 网格位置
     * @returns 是否属于2x2地产
     */
    private isPartOfBuilding2x2(gridPos: Vec2): boolean {
        const buildingInfo = this.findBuilding2x2Info(gridPos);
        return buildingInfo !== null && buildingInfo.size === 2;
    }

    // ========================= 编号分配功能 =========================

    /**
     * 为tile和property分配编号
     */
    public assignIds(): void {
        console.log('[GameMap] Starting ID assignment...');

        // 清除旧的编号
        this.clearAllIds();

        // 分配tile编号
        this.assignTileIds();

        // 分配building编号
        this.assignBuildingIds();

        console.log('[GameMap] ID assignment completed');

        // 立即保存地图数据
        this.scheduleAutoSave();
    }

    /**
     * 清除所有编号
     */
    private clearAllIds(): void {
        // 清除tile编号
        for (const tile of this._tiles) {
            tile.setTileId(65535);  // u16最大值表示无效
        }

        // 清除property编号
        for (const buildingInfo of this._buildingRegistry.values()) {
            buildingInfo.buildingId = 65535;
        }

        console.log('[GameMap] All IDs cleared');
    }

    /**
     * 为tile分配编号（使用DFS算法）
     */
    private assignTileIds(): void {
        // 找到所有医院tile
        const hospitalTiles = this.findHospitalTiles();
        if (hospitalTiles.length === 0) {
            console.warn('[GameMap] No hospital tiles found');
            return;
        }

        // 选择最左边的医院tile作为起点
        let startTile = hospitalTiles[0];
        for (const tile of hospitalTiles) {
            const pos = tile.getGridPosition();
            const startPos = startTile.getGridPosition();
            if (pos.x < startPos.x) {
                startTile = tile;
            }
        }

        // 使用DFS分配编号
        let currentId = 0;
        const visited = new Set<string>();
        this.dfsAssignTileId(startTile, currentId, visited);

        console.log(`[GameMap] Assigned IDs to ${visited.size} tiles`);
    }

    /**
     * 查找所有医院tile
     */
    private findHospitalTiles(): MapTile[] {
        const hospitalTiles: MapTile[] = [];
        for (const tile of this._tiles) {
            if (tile.getBlockId() === 'web3:hospital') {
                hospitalTiles.push(tile);
            }
        }
        return hospitalTiles;
    }

    /**
     * DFS递归分配tile编号
     */
    private dfsAssignTileId(tile: MapTile, currentId: number, visited: Set<string>): number {
        const pos = tile.getGridPosition();
        const key = `${pos.x}_${pos.y}`;

        // 已访问过，跳过
        if (visited.has(key)) {
            return currentId;
        }

        // 检查是否为建筑block，建筑不应该有tile_id
        const blockId = tile.getBlockId();
        if (blockId === 'web3:building_1x1' || blockId === 'web3:building_2x2') {
            // 建筑不分配tile_id，但仍标记为已访问避免重复遍历
            visited.add(key);
            // 清除可能已经错误设置的tile_id
            tile.setTileId(65535);
            return currentId;
        }

        // 标记为已访问并分配编号
        visited.add(key);
        tile.setTileId(currentId);
        currentId++;

        // 获取四个方向的相邻tile
        const directions = [
            { x: 0, y: 1 },   // 北
            { x: 1, y: 0 },   // 东
            { x: 0, y: -1 },  // 南
            { x: -1, y: 0 }   // 西
        ];

        for (const dir of directions) {
            const neighborPos = new Vec2(pos.x + dir.x, pos.y + dir.y);
            const neighborKey = `${neighborPos.x}_${neighborPos.y}`;
            const neighborTile = this._tileIndex.get(neighborKey);

            if (neighborTile && !visited.has(neighborKey)) {
                // 只对非建筑的tile进行递归
                const neighborBlockId = neighborTile.getBlockId();
                if (neighborBlockId !== 'web3:building_1x1' && neighborBlockId !== 'web3:building_2x2') {
                    currentId = this.dfsAssignTileId(neighborTile, currentId, visited);
                } else {
                    // 建筑标记为已访问但不分配编号
                    visited.add(neighborKey);
                    neighborTile.setTileId(65535);
                }
            }
        }

        return currentId;
    }

    /**
     * 为building分配编号
     */
    private assignBuildingIds(): void {
        // 获取所有building并按坐标排序
        const buildings = Array.from(this._buildingRegistry.values());

        // 按z坐标优先，x坐标次之排序（先行后列）
        buildings.sort((a, b) => {
            if (a.position.z !== b.position.z) {
                return a.position.z - b.position.z;
            }
            return a.position.x - b.position.x;
        });

        // 分配编号
        for (let i = 0; i < buildings.length; i++) {
            buildings[i].buildingId = i;
        }

        console.log(`[GameMap] Assigned IDs to ${buildings.length} buildings`);
    }

    /**
     * 计算建筑入口关联（用于导出Move数据）
     *
     * 功能：
     * 1. 先执行编号（assignIds）
     * 2. 找到每个建筑朝向上的相邻tiles（入口tiles）
     * 3. 验证：1x1建筑需要1个tile，2x2建筑需要2个tile
     * 4. 验证：tile类型只能是EMPTY_LAND或PROPERTY_TILE
     * 5. 建立关联：建筑保存entranceTileIds，tile保存buildingId
     * 6. 保存地图
     *
     * @returns 是否成功
     */
    public calculateBuildingEntrances(): boolean {
        console.log('[GameMap] Calculating building entrances...');

        // 1. 先分配ID（内存中）
        this.clearAllIds();
        this.assignTileIds();
        this.assignBuildingIds();

        // 2. 遍历所有建筑，收集入口tiles
        const buildingEntranceMap = new Map<BuildingInfo, MapTile[]>();
        for (const buildingInfo of this._buildingRegistry.values()) {
            const entranceTiles = this.getAdjacentTilesInDirection(buildingInfo);
            buildingEntranceMap.set(buildingInfo, entranceTiles);
        }

        // 3. 验证阶段
        let hasError = false;
        for (const [buildingInfo, tiles] of buildingEntranceMap) {
            const expectedCount = buildingInfo.size === 1 ? 1 : 2;
            const pos = buildingInfo.position;

            // 检查数量
            if (tiles.length !== expectedCount) {
                console.warn(`[GameMap] Building #${buildingInfo.buildingId} at (${pos.x}, ${pos.z}): Expected ${expectedCount} entrance tiles, found ${tiles.length}`);
                hasError = true;
                continue;
            }

            // 检查tile类型
            for (const tile of tiles) {
                const typeId = tile.getTypeId();
                const tilePos = tile.getGridPosition();
                if (typeId !== Web3TileType.EMPTY_LAND && typeId !== Web3TileType.PROPERTY_TILE) {
                    console.warn(`[GameMap] Building #${buildingInfo.buildingId} at (${pos.x}, ${pos.z}): Entrance tile at (${tilePos.x}, ${tilePos.y}) has invalid type ${typeId} (must be EMPTY_LAND or PROPERTY_TILE)`);
                    hasError = true;
                }
            }
        }

        // 4. 如果有错误，停止处理
        if (hasError) {
            console.error('[GameMap] Validation failed, calculation aborted');
            return false;
        }

        // 5. 建立关联
        for (const [buildingInfo, tiles] of buildingEntranceMap) {
            // 建筑保存入口tile IDs
            buildingInfo.entranceTileIds = [
                tiles[0].getTileId(),
                tiles[1]?.getTileId() || 65535
            ];

            // tile保存建筑ID
            for (const tile of tiles) {
                tile.setBuildingId(buildingInfo.buildingId!);
            }
        }

        // 6. 保存地图
        this.scheduleAutoSave();

        console.log('[GameMap] Building entrance calculation completed successfully');
        return true;
    }

    /**
     * 获取建筑朝向上的入口tiles
     */
    private getAdjacentTilesInDirection(buildingInfo: BuildingInfo): MapTile[] {
        const { position, size, direction = 0 } = buildingInfo;
        const tiles: MapTile[] = [];

        // direction: 0=南(+z), 1=西(+x), 2=北(-z), 3=东(-x)

        if (size === 1) {
            // 1x1建筑：1个相邻tile
            let checkPos: Vec2;
            switch (direction) {
                case 0: checkPos = new Vec2(position.x, position.z + 1); break;  // 南
                case 1: checkPos = new Vec2(position.x + 1, position.z); break;  // 西
                case 2: checkPos = new Vec2(position.x, position.z - 1); break;  // 北
                case 3: checkPos = new Vec2(position.x - 1, position.z); break;  // 东
                default: checkPos = new Vec2(position.x, position.z + 1);
            }

            const tile = this.getTileAt(checkPos.x, checkPos.y);
            if (tile) tiles.push(tile);

        } else {
            // 2x2建筑：2个相邻tile
            let positions: Vec2[] = [];
            switch (direction) {
                case 0: // 南 (+z)
                    positions = [
                        new Vec2(position.x, position.z + 2),
                        new Vec2(position.x + 1, position.z + 2)
                    ];
                    break;
                case 1: // 西 (+x)
                    positions = [
                        new Vec2(position.x + 2, position.z),
                        new Vec2(position.x + 2, position.z + 1)
                    ];
                    break;
                case 2: // 北 (-z)
                    positions = [
                        new Vec2(position.x, position.z - 1),
                        new Vec2(position.x + 1, position.z - 1)
                    ];
                    break;
                case 3: // 东 (-x)
                    positions = [
                        new Vec2(position.x - 1, position.z),
                        new Vec2(position.x - 1, position.z + 1)
                    ];
                    break;
            }

            for (const pos of positions) {
                const tile = this.getTileAt(pos.x, pos.y);
                if (tile) tiles.push(tile);
            }
        }

        return tiles;
    }

    /**
     * 显示ID标签
     */
    public showIds(): void {
        console.log('[GameMap] Showing ID labels...');
        // 确保UI容器存在
        if (!this.ensureIdLabelUIRoot()) {
            console.warn('[GameMap] Canvas not found, cannot show ID labels');
            return;
        }

        // 清除旧的标签与位置缓存
        this.clearIdLabels();

        // 为tile创建标签（排除地产）
        for (const tile of this._tiles) {
            const blockId = tile.getBlockId();
            // 跳过建筑block
            if (blockId === 'web3:building_1x1' || blockId === 'web3:building_2x2') {
                continue;
            }

            const tileId = tile.getTileId();
            if (tileId !== 65535) {  // 有效ID
                const pos = tile.getGridPosition();
                // 放在格子中心稍微抬高
                const worldPos = new Vec3(pos.x + 0.5, 1.5, pos.y + 0.5);
                const key = `tile_${pos.x}_${pos.y}`;
                const label = this.createIdLabel(`T${tileId}`, worldPos, new Color(255, 255, 255), key);  // 白色
                this._idLabels.set(key, label);
                this._idLabelWorldPos.set(key, worldPos);
            }
        }

        // 为building创建标签
        for (const buildingInfo of this._buildingRegistry.values()) {
            if (buildingInfo.buildingId !== undefined && buildingInfo.buildingId !== 65535) {
                // 计算中心位置
                let centerX = buildingInfo.position.x;
                let centerZ = buildingInfo.position.z;
                if (buildingInfo.size === 2) {
                    // 2x2中心应加1
                    centerX += 1;
                    centerZ += 1;
                } else {
                    // 1x1中心应加0.5
                    centerX += 0.5;
                    centerZ += 0.5;
                }

                const worldPos = new Vec3(centerX, 2, centerZ);  // Y抬高2，比tile更高
                const key = `building_${buildingInfo.position.x}_${buildingInfo.position.z}`;
                const label = this.createIdLabel(`B${buildingInfo.buildingId}`, worldPos, new Color(255, 255, 0), key);  // 黄色
                this._idLabels.set(key, label);
                this._idLabelWorldPos.set(key, worldPos);
            }
        }

        console.log(`[GameMap] Created ${this._idLabels.size} ID labels`);
    }

    /**
     * 隐藏ID标签
     */
    public hideIds(): void {
        console.log('[GameMap] Hiding ID labels...');
        this.clearIdLabels();

        // 清理旧3D容器（兼容）
        if (this._idLabelsRoot) {
            this._idLabelsRoot.destroy();
            this._idLabelsRoot = null;
        }
        // 清理UI容器
        if (this._idLabelsRootUI) {
            this._idLabelsRootUI.destroy();
            this._idLabelsRootUI = null;
        }
    }

    /**
     * 创建ID标签
     */
    private createIdLabel(text: string, worldPos: Vec3, color: Color, key: string): Node {
        // 确保UI容器存在
        if (!this._idLabelsRootUI || !this._uiCanvas) {
            this.ensureIdLabelUIRoot();
        }

        const labelNode = new Node('IDLabel_' + text);
        labelNode.addComponent(UITransform);
        labelNode.parent = this._idLabelsRootUI!;
        labelNode.layer = this._idLabelsRootUI!.layer;

        // 添加Label组件（UI）
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 18;
        label.lineHeight = 20;
        label.color = color;
        label.useSystemFont = true;
        label.fontFamily = 'Arial';
        label.overflow = Label.Overflow.NONE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        // 记录世界坐标，便于每帧更新投影到UI
        (labelNode as any)['worldPos'] = worldPos.clone();
        this._idLabelWorldPos.set(key, worldPos.clone());

        // 初始化一次位置
        this.updateSingleIdLabelPosition(key, labelNode);

        return labelNode;
    }

    /**
     * 清除所有ID标签
     */
    private clearIdLabels(): void {
        for (const label of this._idLabels.values()) {
            if (label && label.isValid) {
                label.destroy();
            }
        }
        this._idLabels.clear();
        this._idLabelWorldPos.clear();
        if (this._idLabelsRootUI && this._idLabelsRootUI.isValid) {
            this._idLabelsRootUI.removeAllChildren();
        }
    }

    /**
     * 确保ID标签的UI根节点存在
     */
    private ensureIdLabelUIRoot(): boolean {
        if (this._uiCanvas && this._idLabelsRootUI && this._idLabelsRootUI.isValid) {
            return true;
        }

        const scene = director.getScene();
        if (!scene) return false;

        const canvasNode = scene.getChildByName('Canvas');
        if (!canvasNode) {
            console.warn('[GameMap] Canvas node not found in scene');
            return false;
        }

        const canvas = canvasNode.getComponent(Canvas);
        if (!canvas) {
            console.warn('[GameMap] Canvas component not found on Canvas node');
            return false;
        }

        this._uiCanvas = canvas;

        // 创建/复用UI容器
        let root = canvasNode.getChildByName('IDLabelsRootUI');
        if (!root) {
            root = new Node('IDLabelsRootUI');
            root.addComponent(UITransform);
            canvasNode.addChild(root);
        }
        root.layer = canvasNode.layer;
        this._idLabelsRootUI = root;
        return true;
    }

    /**
     * 更新所有ID标签的UI位置（每帧调用）
     */
    protected update(deltaTime: number): void {
        if (!this._uiCanvas || !this._idLabelsRootUI || this._idLabels.size === 0) {
            return;
        }
        this._idLabels.forEach((node, key) => {
            this.updateSingleIdLabelPosition(key, node);
        });
    }

    /**
     * 更新单个ID标签位置
     */
    private updateSingleIdLabelPosition(key: string, node: Node): void {
        if (!this._uiCanvas || !this.mainCamera) return;

        const worldPos = this._idLabelWorldPos.get(key) || (node as any)['worldPos'];
        if (!worldPos) return;

        // 如果在相机背后，可以选择隐藏
        const screenPos = this.mainCamera.worldToScreen(worldPos);
        const isBehind = screenPos.z <= 0;
        node.active = !isBehind;
        if (isBehind) return;

        // 投影到UI空间：使用主3D相机做世界->屏幕，再将屏幕->UI
        const uiTransform = this._uiCanvas.node.getComponent(UITransform);
        if (!uiTransform) return;
        const uiPos = uiTransform.convertToNodeSpaceAR(new Vec3(screenPos.x, screenPos.y, 0));
        node.setPosition(uiPos);
    }
}
