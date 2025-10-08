/**
 * 地图组件
 * 
 * 负责单个地图的加载、渲染、保存等核心功能
 * 使用新的组件化架构管理MapTile和MapObject
 * 
 * @author Web3 Tycoon Team
 * @version 2.0.0
 */

import { _decorator, Component, Node, Camera, resources, JsonAsset, find, Color, MeshRenderer, Vec3, Label, Canvas, UITransform, director, BoxCollider, Texture2D } from 'cc';
import { MapTile } from './MapTile';
import { MapObject } from './MapObject';
import { MapSaveData, MapLoadOptions, MapSaveOptions, TileData, ObjectData, PropertyData, BuildingData, NpcData, DecorationData } from '../data/MapDataTypes';
import { CameraController } from '../../camera/CameraController';
import { MapConfig } from '../MapManager';
import { VoxelSystem } from '../../voxel/VoxelSystem';
import { EventBus } from '../../events/EventBus';
import { EventTypes } from '../../events/EventTypes';
import { Blackboard } from '../../events/Blackboard';
import { GridGround } from '../GridGround';
import { GridBoundary } from '../GridBoundary';
import { MapInteractionManager, MapInteractionData, MapInteractionEvent } from '../interaction/MapInteractionManager';
import { getWeb3BlockByBlockId, isWeb3Object, isWeb3Tile, isWeb3Building, getBuildingSize, Web3TileType } from '../../voxel/Web3BlockTypes';
import { Vec2 } from 'cc';
import { sys } from 'cc';
import { PaperActorFactory } from '../../role/PaperActorFactory';
import { PaperActor } from '../../role/PaperActor';
import { ActorConfigManager } from '../../role/ActorConfig';
import { BlockOverlayManager } from '../../voxel/overlay/BlockOverlayManager';
import { OverlayConfig, OverlayFace } from '../../voxel/overlay/OverlayTypes';
import { UINotification } from '../../ui/utils/UINotification';
import { NumberTextureGenerator } from '../../voxel/overlay/NumberTextureGenerator';

// Building信息接口
interface BuildingInfo {
    blockId: string;
    position: { x: number; z: number };  // 左下角位置
    size: 1 | 2;
    direction?: number;  // 方向(0-3)，对应Y轴旋转 0°, 90°, 180°, 270°
    buildingId?: number;  // Building编号（u16最大值65535表示无效）
    entranceTileIds?: [number, number];  // 入口tile的ID（最多2个，1x1建筑第二个为65535）

    // 连街关系（只对1x1建筑有效）
    chainPrevId?: number;  // 前一个连街建筑（默认65535=无效）
    chainNextId?: number;  // 后一个连街建筑（默认65535=无效）

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

    // Move 端坐标限制（u8 范围）
    private static readonly MIN_GRID_COORD = 0;
    private static readonly MAX_GRID_COORD = 255;

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
    private _decorationsRoot: Node | null = null;           // 装饰物的根节点
    
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

    /** Overlay管理 (key: "x_z", value: Map<layerIndex, Node>) */
    private _tileOverlays: Map<string, Map<number, Node>> = new Map();

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

        // 创建装饰物容器
        if (!this._decorationsRoot) {
            this._decorationsRoot = new Node('DecorationsRoot');
            this.node.addChild(this._decorationsRoot);
            console.log('[GameMap] Created DecorationsRoot');
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

        // 配置网格参数（使用 0-50 范围）
        gridGround.step = 1;
        gridGround.minCoord = 0;
        gridGround.maxCoord = 50;  // 51x51 网格，足够编辑使用
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
                halfSize: 50,  // 保留兼容（不再使用）
                color: new Color(130, 130, 130, 255),
                y: 0,
                camera: this.mainCamera
            });
        }

        console.log('[GameMap] Edit mode grid created with GridGround component');

        // 创建边界可视化节点（标识 u8 坐标范围 0-255）
        const boundaryNode = new Node('GridBoundary');
        boundaryNode.setParent(this.node);

        // 添加 GridBoundary 组件
        const boundary = boundaryNode.addComponent(GridBoundary);
        boundary.cam = this.mainCamera;
        boundary.minCoord = 0;
        boundary.maxCoord = 255;
        boundary.y = 0.05;  // 稍高于 grid，低于 tile
        boundary.showOriginMarker = true;
        boundary.enabled = true;

        console.log('[GameMap] Grid boundary (0-255) created for u8 coordinate validation');
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
    private async onElementClicked(data: MapInteractionData): Promise<void> {
        if (!this._isEditMode) return;

        console.log(`[GameMap] Element clicked: ${data.hitNode?.name} at grid (${data.gridPosition.x}, ${data.gridPosition.y}), button: ${data.button}`);

        const gridPos = data.gridPosition;

        // 鼠标中键：显示tile-building关联
        if (data.button === 1) {  // 1 = 中键（滚轮按下）
            await this.handleShowAssociation(gridPos);
            return;
        }

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
        // 验证坐标范围（u8 限制）
        if (!this.validateGridPosition(gridPos)) {
            return;  // 坐标超出范围，阻止放置
        }

        const key = `${gridPos.x}_${gridPos.y}`;

        // 如果该位置已有地块，先移除
        const existingTile = this._tileIndex.get(key);
        if (existingTile) {
            this.removeTile(existingTile);
        }

        // 创建新地块节点
        const tileNode = new Node(`T_${gridPos.x}_${gridPos.y}`);
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

        // 装饰使用体素渲染，创建体素节点（添加到DecorationsRoot）
        const worldPos = new Vec3(gridPos.x, 1, gridPos.y);
        const decorationNode = await this._voxelSystem.createBlockNode(this._decorationsRoot, blockId, worldPos);

        if (decorationNode) {
            // 添加BoxCollider用于编辑器点击
            const collider = decorationNode.addComponent(BoxCollider);
            if (collider) {
                collider.size = new Vec3(1, 0.1, 1);
                collider.center = new Vec3(0, 0, 0);
            }

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

            // 添加BoxCollider用于编辑器点击
            const collider = actorNode.addComponent(BoxCollider);
            if (collider) {
                collider.size = new Vec3(1, 0.1, 1);
                collider.center = new Vec3(0, 0, 0);
            }

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

            // 收集NPC数据
            const npcsData: NpcData[] = [];
            this._actors.forEach((actorNode, key) => {
                const [x, z] = key.split('_').map(Number);
                const actor = actorNode.getComponent(PaperActor);
                if (actor) {
                    const blockId = actor.actorId;  // PaperActor的actorId就是blockId
                    const blockInfo = getWeb3BlockByBlockId(blockId);
                    npcsData.push({
                        blockId: blockId,
                        typeId: blockInfo?.typeId || 0,
                        position: { x, z }
                    });
                }
            });

            // 收集装饰物数据
            const decorationsData: DecorationData[] = [];
            this._decorations.forEach((decoNode, key) => {
                const [x, z] = key.split('_').map(Number);
                // 从节点名称解析blockId: "Block_web3:deco_poppy" -> "web3:deco_poppy"
                let blockId = decoNode.name.replace('Block_', '');
                // 如果没有命名空间，添加web3前缀
                if (!blockId.includes(':')) {
                    blockId = 'web3:' + blockId;
                }
                const blockInfo = getWeb3BlockByBlockId(blockId);
                decorationsData.push({
                    blockId: blockId,
                    typeId: blockInfo?.typeId || 0,
                    position: { x, z }
                });
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
                buildings: buildingsData.length > 0 ? buildingsData : undefined,
                npcs: npcsData.length > 0 ? npcsData : undefined,
                decorations: decorationsData.length > 0 ? decorationsData : undefined
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
                const tileNode = new Node(`T_${tileData.position.x}_${tileData.position.z}`);
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

            // 加载NPC数据
            if (mapData.npcs) {
                for (const npcData of mapData.npcs) {
                    const gridPos = new Vec2(npcData.position.x, npcData.position.z);
                    await this.placeObjectAt(npcData.blockId, gridPos);
                }
                console.log(`[GameMap] Loaded ${mapData.npcs.length} NPCs`);
            }

            // 加载装饰物数据
            if (mapData.decorations) {
                for (const decoData of mapData.decorations) {
                    const gridPos = new Vec2(decoData.position.x, decoData.position.z);
                    await this.placeDecorationAt(decoData.blockId, gridPos);
                }
                console.log(`[GameMap] Loaded ${mapData.decorations.length} decorations`);
            }

            // 保存地图数据
            this._mapSaveData = mapData;
            this.mapId = mapData.mapId;

            // 加载完成后可选重建2x2父容器
            if (this.rebuildPropertyContainersAfterLoad) {
                this.rebuildPropertyContainers();
            }

            console.log(`[GameMap] Map loaded successfully: ${loadedTiles} tiles, ${loadedObjects} objects`);

            // 设置相机看向地图中心
            this.focusCameraOnMapCenter();

            return true;
            
        } catch (error) {
            console.error('[GameMap] Failed to load map:', error);
            return false;
        }
    }

    /**
     * 从链上数据加载地图（用于游戏模式）
     * @param template 链上 MapTemplate 数据
     * @param game 链上 Game 数据
     * @returns 是否加载成功
     */
    public async loadFromChainData(template: any, game: any): Promise<boolean> {
        try {
            console.log('[GameMap] Loading map from chain data...');
            console.log('  Template tiles:', template?.tiles_static?.size);
            console.log('  Template buildings:', template?.buildings_static?.size);
            console.log('  Game ID:', game?.id);

            // 动态导入转换工具（避免循环依赖）
            const { convertMapTemplateToSaveData } = await import('../../sui/utils/MapTemplateConverter');

            // 1. 转换为 MapSaveData 格式
            const mapData = convertMapTemplateToSaveData(
                template,
                game,
                `chain_${game.id}`
            );

            // 2. 使用转换后的数据加载场景
            return await this._loadMapFromData(mapData);

        } catch (error) {
            console.error('[GameMap] Failed to load from chain data:', error);
            return false;
        }
    }

    /**
     * 从内存中的 MapSaveData 加载（内部方法）
     * 复用 loadMap 的核心逻辑，但数据来自内存而非文件
     */
    private async _loadMapFromData(mapData: MapSaveData): Promise<boolean> {
        try {
            // 清空现有地图
            this.clearMap();

            console.log('[GameMap] Loading from MapSaveData...');
            console.log('  Tiles:', mapData.tiles.length);
            console.log('  Buildings:', mapData.buildings?.length || 0);

            // 加载地块
            for (const tileData of mapData.tiles) {
                const tileNode = new Node(`T_${tileData.position.x}_${tileData.position.z}`);
                tileNode.setParent(this.tilesContainer!);

                const tile = tileNode.addComponent(MapTile);
                await tile.loadData(tileData);

                const key = `${tileData.position.x}_${tileData.position.z}`;
                this._tiles.push(tile);
                this._tileIndex.set(key, tile);
            }

            // 加载建筑
            if (mapData.buildings) {
                for (const buildingData of mapData.buildings) {
                    const buildingKey = `${buildingData.position.x}_${buildingData.position.z}`;
                    const buildingInfo: BuildingInfo = {
                        blockId: buildingData.blockId,
                        position: buildingData.position,
                        size: buildingData.size,
                        direction: buildingData.direction || 0,
                        buildingId: buildingData.buildingId,
                        entranceTileIds: buildingData.entranceTileIds,
                        chainPrevId: buildingData.chainPrevId,
                        chainNextId: buildingData.chainNextId,
                        owner: buildingData.owner,
                        level: buildingData.level,
                        price: buildingData.price,
                        rent: buildingData.rent,
                        mortgaged: buildingData.mortgaged
                    };
                    this._buildingRegistry.set(buildingKey, buildingInfo);

                    // 创建 Building 的 PaperActor
                    const gridPos = new Vec2(buildingData.position.x, buildingData.position.z);
                    this.createBuildingPaperActor(
                        buildingData.blockId,
                        gridPos,
                        buildingData.size,
                        buildingData.level || 0,
                        buildingInfo.direction
                    );
                }
                console.log(`[GameMap] Loaded ${mapData.buildings.length} buildings`);
            }

            // 加载 NPCs
            if (mapData.npcs) {
                for (const npcData of mapData.npcs) {
                    const gridPos = new Vec2(npcData.position.x, npcData.position.z);
                    await this.placeObjectAt(npcData.blockId, gridPos);
                }
                console.log(`[GameMap] Loaded ${mapData.npcs.length} NPCs`);
            }

            // 加载装饰物
            if (mapData.decorations) {
                for (const decoData of mapData.decorations) {
                    const gridPos = new Vec2(decoData.position.x, decoData.position.z);
                    await this.placeDecorationAt(decoData.blockId, gridPos);
                }
                console.log(`[GameMap] Loaded ${mapData.decorations.length} decorations`);
            }

            // 保存地图数据
            this._mapSaveData = mapData;
            this.mapId = mapData.mapId;

            console.log('[GameMap] Map data loaded successfully');
            console.log('  Total tiles:', this._tiles.length);
            console.log('  Total buildings:', this._buildingRegistry.size);

            // 设置相机看向地图中心
            this.focusCameraOnMapCenter();

            return true;

        } catch (error) {
            console.error('[GameMap] Failed to load map from data:', error);
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

        // 清理装饰物容器
        if (this._decorationsRoot && this._decorationsRoot.isValid) {
            this._decorationsRoot.removeAllChildren();
        }

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

        // 清理所有overlay
        this.clearAllOverlays();

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
     *
     * Cocos坐标系特性：
     * - 左手坐标系，Y轴旋转从上方俯视是逆时针CCW
     * - 旋转角度: direction * 90° (0°→90°→180°→270°为CCW)
     * - 方向定义: 0=南→1=东→2=北→3=西 (CCW逆时针)
     *
     * @param gridPos 地产位置
     * @param size 地产大小
     * @returns 朝向（0-3），默认返回0
     */
    private findBestDirection(gridPos: Vec2, size: 1 | 2): number {
        // 四个方向CCW逆时针：南→东→北→西
        const directions = [
            { dx: 0, dz: 1, dir: 0 },   // 0=南(+z) - 0°
            { dx: 1, dz: 0, dir: 1 },   // 1=东(+x) - 90°
            { dx: 0, dz: -1, dir: 2 },  // 2=北(-z) - 180°
            { dx: -1, dz: 0, dir: 3 }   // 3=西(-x) - 270°
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

        // 0. 验证建筑位置是否在 u8 范围内
        if (!this.validateBuildingPosition(gridPos, size)) {
            return;  // 坐标超出范围，阻止放置
        }

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

            // 重命名为简洁格式: B_size_x_z
            buildingNode.name = `B_${size}x${size}_${gridPos.x}_${gridPos.y}`;

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

        // 计算tile邻居关系（包含一致性校验）
        this.calculateTileNeighbors();

        // 计算建筑连街关系（在building id和朝向确定后）
        this.calculateBuildingChains();

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
     * 计算每个tile的4方向邻居关系
     *
     * 方向定义（Cocos坐标系）:
     * w (west):  x-1, z不变
     * e (east):  x+1, z不变
     * n (north): x不变, z-1
     * s (south): x不变, z+1
     */
    private calculateTileNeighbors(): void {
        console.log('[GameMap] Calculating tile neighbors...');

        let isolatedCount = 0;
        let endpointCount = 0;

        for (const tile of this._tiles) {
            const tileId = tile.getTileId();
            if (tileId === 65535) continue;

            const pos = tile.getGridPosition();

            // 查找4个方向的邻居tile
            const wTile = this.getTileAt(pos.x - 1, pos.y);
            const nTile = this.getTileAt(pos.x, pos.y - 1);
            const eTile = this.getTileAt(pos.x + 1, pos.y);
            const sTile = this.getTileAt(pos.x, pos.y + 1);

            // 获取邻居ID（如果存在且有效）
            const wId = wTile?.getTileId();
            const nId = nTile?.getTileId();
            const eId = eTile?.getTileId();
            const sId = sTile?.getTileId();

            // 设置邻居ID（不存在或无效则设为65535）
            tile.setW(wId !== undefined && wId !== 65535 ? wId : 65535);
            tile.setN(nId !== undefined && nId !== 65535 ? nId : 65535);
            tile.setE(eId !== undefined && eId !== 65535 ? eId : 65535);
            tile.setS(sId !== undefined && sId !== 65535 ? sId : 65535);

            // 拓扑检查
            const validCount = [tile.getW(), tile.getN(), tile.getE(), tile.getS()]
                .filter(id => id !== 65535).length;

            if (validCount === 0) {
                // 孤立tile
                isolatedCount++;
                console.warn(`[GameMap] Isolated tile: T${tileId} at (${pos.x}, ${pos.y}) - no neighbors`);
            } else if (validCount === 1) {
                // 端点tile
                endpointCount++;
                const neighborInfo =
                    tile.getW() !== 65535 ? `w=T${tile.getW()}` :
                    tile.getN() !== 65535 ? `n=T${tile.getN()}` :
                    tile.getE() !== 65535 ? `e=T${tile.getE()}` :
                    `s=T${tile.getS()}`;
                console.log(`[GameMap] Endpoint tile: T${tileId} at (${pos.x}, ${pos.y}), ${neighborInfo}`);
            }
        }

        console.log(`[GameMap] Tile neighbors calculated: ${isolatedCount} isolated, ${endpointCount} endpoints`);

        // 一致性校验
        this.validateTileNeighborConsistency();
    }

    /**
     * 校验tile邻居关系的一致性
     *
     * 校验规则：
     * 1. 双向一致性：A.e=B ⇔ B.w=A
     * 2. 坐标一致性：A.e=B ⇒ B.x=A.x+1 且 B.z=A.z
     */
    private validateTileNeighborConsistency(): void {
        console.log('[GameMap] Validating neighbor consistency...');

        let errorCount = 0;

        for (const tile of this._tiles) {
            const tileId = tile.getTileId();
            if (tileId === 65535) continue;

            const pos = tile.getGridPosition();

            // 校验east/west对称性
            const eId = tile.getE();
            if (eId !== 65535) {
                const eTile = this.findTileById(eId);
                if (eTile) {
                    const ePos = eTile.getGridPosition();

                    // 坐标一致性
                    if (ePos.x !== pos.x + 1 || ePos.y !== pos.y) {
                        console.warn(`[GameMap] T${tileId}(${pos.x},${pos.y}).e=T${eId}: position error, T${eId} at (${ePos.x},${ePos.y}) expected (${pos.x + 1},${pos.y})`);
                        errorCount++;
                    }

                    // 双向一致性
                    if (eTile.getW() !== tileId) {
                        console.warn(`[GameMap] T${tileId}(${pos.x},${pos.y}).e=T${eId}, but T${eId}.w=T${eTile.getW()} (expected T${tileId})`);
                        errorCount++;
                    }
                }
            }

            // 校验west/east对称性
            const wId = tile.getW();
            if (wId !== 65535) {
                const wTile = this.findTileById(wId);
                if (wTile) {
                    const wPos = wTile.getGridPosition();

                    if (wPos.x !== pos.x - 1 || wPos.y !== pos.y) {
                        console.warn(`[GameMap] T${tileId}(${pos.x},${pos.y}).w=T${wId}: position error, T${wId} at (${wPos.x},${wPos.y}) expected (${pos.x - 1},${pos.y})`);
                        errorCount++;
                    }

                    if (wTile.getE() !== tileId) {
                        console.warn(`[GameMap] T${tileId}(${pos.x},${pos.y}).w=T${wId}, but T${wId}.e=T${wTile.getE()} (expected T${tileId})`);
                        errorCount++;
                    }
                }
            }

            // 校验south/north对称性
            const sId = tile.getS();
            if (sId !== 65535) {
                const sTile = this.findTileById(sId);
                if (sTile) {
                    const sPos = sTile.getGridPosition();

                    if (sPos.x !== pos.x || sPos.y !== pos.y + 1) {
                        console.warn(`[GameMap] T${tileId}(${pos.x},${pos.y}).s=T${sId}: position error, T${sId} at (${sPos.x},${sPos.y}) expected (${pos.x},${pos.y + 1})`);
                        errorCount++;
                    }

                    if (sTile.getN() !== tileId) {
                        console.warn(`[GameMap] T${tileId}(${pos.x},${pos.y}).s=T${sId}, but T${sId}.n=T${sTile.getN()} (expected T${tileId})`);
                        errorCount++;
                    }
                }
            }

            // 校验north/south对称性
            const nId = tile.getN();
            if (nId !== 65535) {
                const nTile = this.findTileById(nId);
                if (nTile) {
                    const nPos = nTile.getGridPosition();

                    if (nPos.x !== pos.x || nPos.y !== pos.y - 1) {
                        console.warn(`[GameMap] T${tileId}(${pos.x},${pos.y}).n=T${nId}: position error, T${nId} at (${nPos.x},${nPos.y}) expected (${pos.x},${pos.y - 1})`);
                        errorCount++;
                    }

                    if (nTile.getS() !== tileId) {
                        console.warn(`[GameMap] T${tileId}(${pos.x},${pos.y}).n=T${nId}, but T${nId}.s=T${nTile.getS()} (expected T${tileId})`);
                        errorCount++;
                    }
                }
            }
        }

        if (errorCount === 0) {
            console.log('[GameMap] ✓ Tile neighbor consistency validation passed');
        } else {
            console.error(`[GameMap] ✗ Tile neighbor consistency validation failed: ${errorCount} errors`);
        }
    }

    /**
     * 根据tileId查找MapTile
     */
    private findTileById(tileId: number): MapTile | null {
        for (const tile of this._tiles) {
            if (tile.getTileId() === tileId) {
                return tile;
            }
        }
        return null;
    }

    /**
     * 计算建筑入口关联（用于导出Move数据）
     *
     * 功能：
     * 1. 先执行编号（assignIds）
     * 2. 找到每个建筑朝向上的相邻tiles（入口tiles）
     * 3. 验证：1x1建筑需要1个tile，2x2建筑需要2个tile
     * 4. 验证：tile类型只能是EMPTY_LAND
     * 5. 建立关联：建筑保存entranceTileIds，tile保存buildingId
     * 6. 保存地图
     *
     * @returns 是否成功
     */
    public calculateBuildingEntrances(): boolean {
        console.log('[GameMap] Calculating building entrances...');

        // 1. 调用完整的编号流程（包含邻居和连街计算）
        this.assignIds();

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
                if (typeId !== Web3TileType.EMPTY_LAND) {
                    console.warn(`[GameMap] Building #${buildingInfo.buildingId} at (${pos.x}, ${pos.z}): Entrance tile at (${tilePos.x}, ${tilePos.y}) has invalid type ${typeId} (must be EMPTY_LAND)`);
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
     *
     * Cocos坐标系特性：左手坐标系，Y轴旋转CCW逆时针
     * direction定义：0=南(+z), 1=东(+x), 2=北(-z), 3=西(-x)
     */
    private getAdjacentTilesInDirection(buildingInfo: BuildingInfo): MapTile[] {
        const { position, size, direction = 0 } = buildingInfo;
        const tiles: MapTile[] = [];

        if (size === 1) {
            // 1x1建筑：1个相邻tile
            let checkPos: Vec2;
            switch (direction) {
                case 0: checkPos = new Vec2(position.x, position.z + 1); break;  // 南(+z)
                case 1: checkPos = new Vec2(position.x + 1, position.z); break;  // 东(+x)
                case 2: checkPos = new Vec2(position.x, position.z - 1); break;  // 北(-z)
                case 3: checkPos = new Vec2(position.x - 1, position.z); break;  // 西(-x)
                default: checkPos = new Vec2(position.x, position.z + 1);
            }

            const tile = this.getTileAt(checkPos.x, checkPos.y);
            if (tile) tiles.push(tile);

        } else {
            // 2x2建筑：2个相邻tile
            let positions: Vec2[] = [];
            switch (direction) {
                case 0: // 南(+z) - 0°
                    positions = [
                        new Vec2(position.x, position.z + 2),
                        new Vec2(position.x + 1, position.z + 2)
                    ];
                    break;
                case 1: // 东(+x) - 90°
                    positions = [
                        new Vec2(position.x + 2, position.z),
                        new Vec2(position.x + 2, position.z + 1)
                    ];
                    break;
                case 2: // 北(-z) - 180°
                    positions = [
                        new Vec2(position.x, position.z - 1),
                        new Vec2(position.x + 1, position.z - 1)
                    ];
                    break;
                case 3: // 西(-x) - 270°
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
     * 使用Overlay方式显示ID（3D贴图，用于对比测试）
     */
    public async showIdsWithOverlay(): Promise<void> {
        console.log('[GameMap] Showing IDs with overlay...');

        // 清除旧的overlay
        this.clearAllOverlays();

        // 为tile添加编号overlay
        for (const tile of this._tiles) {
            const tileId = tile.getTileId();
            if (tileId !== 65535) {
                const pos = tile.getGridPosition();

                // 生成tile编号纹理（白色背景）
                const numTexture = NumberTextureGenerator.getNumberTexture(tileId, {
                    size: 64,
                    fontSize: 28,
                    bgColor: 'rgba(255, 255, 255, 0.85)',
                    textColor: '#000',
                    withBorder: true
                });

                await this.addTileOverlay(new Vec2(pos.x, pos.y), {
                    texture: numTexture,
                    faces: [OverlayFace.UP],
                    inflate: 0.002,
                    layerIndex: 0,
                    techniqueIndex: 1 // tile 编号：透明
                });
            }
        }

        // 为building添加编号overlay（在所在位置的tile上）
        for (const [key, buildingInfo] of this._buildingRegistry) {
            if (buildingInfo.buildingId !== undefined && buildingInfo.buildingId !== 65535) {
                const pos = buildingInfo.position;

                // 生成building编号纹理（金色背景）
                const numTexture = NumberTextureGenerator.getNumberTexture(
                    buildingInfo.buildingId,
                    {
                        size: 64,
                        fontSize: 28,
                        bgColor: 'rgba(255, 200, 100, 0.9)',
                        textColor: '#000',
                        withBorder: true
                    }
                );

                // 在building左下角位置的tile上显示（1x1和2x2都用同一个位置）
                const tile = this.getTileAt(pos.x, pos.z);
                if (tile) {
                    await this.addTileOverlay(new Vec2(pos.x, pos.z), {
                        texture: numTexture,
                        faces: [OverlayFace.UP],
                        inflate: 0.003,  // 比tile编号稍高
                        layerIndex: 1,   // 使用layer 1，避免与tile编号冲突
                        techniqueIndex: 0 // building 编号：不透明
                    });
                }
            }
        }

        console.log('[GameMap] IDs overlay created');
    }

    /**
     * 隐藏Overlay方式的ID显示
     */
    public hideIdsWithOverlay(): void {
        console.log('[GameMap] Hiding IDs overlay...');
        this.clearAllOverlays();
    }

    /**
     * 隐藏ID标签（2D UI Label方式）
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

    // ========================= Overlay管理方法 =========================

    /**
     * 为tile添加overlay层
     *
     * @param gridPos Tile网格位置
     * @param config Overlay配置
     * @returns 是否成功
     */
    public async addTileOverlay(
        gridPos: Vec2,
        config: OverlayConfig
    ): Promise<boolean> {
        const tile = this.getTileAt(gridPos.x, gridPos.y);
        if (!tile) {
            console.warn(`[GameMap] Tile not found at (${gridPos.x}, ${gridPos.y})`);
            return false;
        }

        const overlayNode = await BlockOverlayManager.createOverlay(
            tile.node,
            config
        );

        if (overlayNode) {
            const key = `${gridPos.x}_${gridPos.y}`;
            if (!this._tileOverlays.has(key)) {
                this._tileOverlays.set(key, new Map());
            }
            this._tileOverlays.get(key)!.set(config.layerIndex || 0, overlayNode);

            console.log(`[GameMap] Added overlay to tile at (${gridPos.x}, ${gridPos.y}), layer ${config.layerIndex || 0}`);
            return true;
        }

        return false;
    }

    /**
     * 移除tile的overlay层
     *
     * @param gridPos Tile网格位置
     * @param layerIndex 层级索引（默认0）
     */
    public removeTileOverlay(gridPos: Vec2, layerIndex: number = 0): void {
        const key = `${gridPos.x}_${gridPos.y}`;
        const overlays = this._tileOverlays.get(key);

        if (overlays) {
            const overlayNode = overlays.get(layerIndex);
            if (overlayNode && overlayNode.isValid) {
                overlayNode.destroy();
                overlays.delete(layerIndex);

                console.log(`[GameMap] Removed overlay from tile at (${gridPos.x}, ${gridPos.y}), layer ${layerIndex}`);

                // 如果该tile没有任何overlay了，清理map entry
                if (overlays.size === 0) {
                    this._tileOverlays.delete(key);
                }
            }
        }
    }

    /**
     * 移除tile的所有overlay层
     */
    public removeAllTileOverlays(gridPos: Vec2): void {
        const key = `${gridPos.x}_${gridPos.y}`;
        const overlays = this._tileOverlays.get(key);

        if (overlays) {
            overlays.forEach((overlayNode, layerIndex) => {
                if (overlayNode && overlayNode.isValid) {
                    overlayNode.destroy();
                }
            });
            this._tileOverlays.delete(key);

            console.log(`[GameMap] Removed all overlays from tile at (${gridPos.x}, ${gridPos.y})`);
        }
    }

    /**
     * 更新overlay纹理
     *
     * @param gridPos Tile网格位置
     * @param layerIndex 层级索引
     * @param newTexture 新纹理
     */
    public updateTileOverlayTexture(
        gridPos: Vec2,
        layerIndex: number,
        newTexture: Texture2D
    ): void {
        const key = `${gridPos.x}_${gridPos.y}`;
        const overlayNode = this._tileOverlays.get(key)?.get(layerIndex);

        if (overlayNode) {
            BlockOverlayManager.updateOverlayTexture(overlayNode, newTexture);
            console.log(`[GameMap] Updated overlay texture at (${gridPos.x}, ${gridPos.y}), layer ${layerIndex}`);
        } else {
            console.warn(`[GameMap] Overlay not found at (${gridPos.x}, ${gridPos.y}), layer ${layerIndex}`);
        }
    }

    /**
     * 更新overlay颜色
     */
    public updateTileOverlayColor(
        gridPos: Vec2,
        layerIndex: number,
        color: Color
    ): void {
        const key = `${gridPos.x}_${gridPos.y}`;
        const overlayNode = this._tileOverlays.get(key)?.get(layerIndex);

        if (overlayNode) {
            BlockOverlayManager.updateOverlayColor(overlayNode, color);
        }
    }

    /**
     * 检查tile是否有overlay
     */
    public hasTileOverlay(gridPos: Vec2, layerIndex: number = 0): boolean {
        const key = `${gridPos.x}_${gridPos.y}`;
        return this._tileOverlays.get(key)?.has(layerIndex) || false;
    }

    /**
     * 显示tile的4方向邻居（使用字母overlay）
     *
     * 在邻居tile上显示方向字母：W/N/E/S
     * 使用layer 20
     */
    private async showTileNeighbors(tile: MapTile): Promise<void> {
        const tileId = tile.getTileId();
        if (tileId === 65535) return;

        // 检查是否有邻居数据
        const wId = tile.getW();
        const nId = tile.getN();
        const eId = tile.getE();
        const sId = tile.getS();

        if (wId === 65535 && nId === 65535 && eId === 65535 && sId === 65535) {
            console.log(`[GameMap] T${tileId} has no neighbor data`);
            return;
        }

        const pos = tile.getGridPosition();
        console.log(`[GameMap] Showing neighbors for T${tileId}: w=${wId}, n=${nId}, e=${eId}, s=${sId}`);

        // 为每个有效邻居显示方向字母
        const neighbors = [
            { dir: 'W', id: wId },
            { dir: 'N', id: nId },
            { dir: 'E', id: eId },
            { dir: 'S', id: sId }
        ];

        for (const { dir, id } of neighbors) {
            if (id === 65535) continue;

            const neighborTile = this.findTileById(id);
            if (!neighborTile) continue;

            const neighborPos = neighborTile.getGridPosition();

            // 生成方向字母纹理（蓝色背景）
            const letterTexture = NumberTextureGenerator.getLetterTexture(dir);

            // 在邻居tile上显示字母
            await this.addTileOverlay(new Vec2(neighborPos.x, neighborPos.y), {
                texture: letterTexture,
                faces: [OverlayFace.UP],
                inflate: 0.006,
                layerIndex: 20,
                techniqueIndex: 1
            });
        }
    }

    /**
     * 清除所有tile邻居显示（layer 20）
     */
    private clearTileNeighborOverlays(): void {
        for (const tile of this._tiles) {
            const pos = tile.getGridPosition();
            this.removeTileOverlay(new Vec2(pos.x, pos.y), 20);
        }
    }

    /**
     * 显示tile-building关联（鼠标中键点击）
     */
    private async handleShowAssociation(gridPos: Vec2): Promise<void> {
        console.log(`[GameMap] Show association at (${gridPos.x}, ${gridPos.y})`);

        // 清除之前的所有关联显示
        this.clearAssociationOverlays();     // 清除layer 10/11（building关联）
        this.clearTileNeighborOverlays();    // 清除layer 20（tile邻居）
        this.clearBuildingChainOverlay();    // 清除layer 30（连街）

        const tile = this.getTileAt(gridPos.x, gridPos.y);
        const buildingInfo = this.findBuilding2x2Info(gridPos);

        // 情况1: 点击的是tile（非building位置）
        if (tile && !buildingInfo) {
            // 显示关联的building（如果有，layer 10）
            const buildingId = tile.getBuildingId();
            if (buildingId !== 65535) {
                const building = this.findBuildingById(buildingId);
                if (building) {
                    await this.showBuildingAssociation(building);
                }
            }

            // 显示tile的4方向邻居（layer 20）
            await this.showTileNeighbors(tile);
        }

        // 情况2: 点击的是building，显示entrance tiles（layer 10/11）
        if (buildingInfo) {
            await this.showEntranceTilesAssociation(buildingInfo);

            // 如果是1x1建筑，显示连街高亮（layer 30）
            if (buildingInfo.size === 1 && buildingInfo.buildingId !== undefined) {
                await this.showBuildingChainOverlay(buildingInfo.buildingId);
            }
        }
    }

    /**
     * 显示building关联（在building顶部显示图标）
     */
    private async showBuildingAssociation(buildingInfo: BuildingInfo): Promise<void> {
        const pos = buildingInfo.position;

        // 加载tileBuilding.png纹理（注意添加/texture后缀）
        const texture = await new Promise<Texture2D>((resolve, reject) => {
            resources.load('textures/tileBuilding/texture', Texture2D, (err, tex) => {
                if (err) {
                    console.error('[GameMap] Failed to load tileBuilding texture:', err);
                    reject(err);
                } else {
                    resolve(tex);
                }
            });
        });

        // 在building位置的tile上显示（2x2只显示一个）
        const tile = this.getTileAt(pos.x, pos.z);
        if (tile) {
            await this.addTileOverlay(new Vec2(pos.x, pos.z), {
                texture: texture,
                faces: [OverlayFace.UP],
                inflate: 0.004,
                layerIndex: 10,  // 使用特殊layer避免与编号冲突
                techniqueIndex: 0 // building 标记：不透明
            });
            console.log(`[GameMap] Showed building association at (${pos.x}, ${pos.z})`);
        }
    }

    /**
     * 显示entrance tiles关联（顶部+侧面边框）
     */
    private async showEntranceTilesAssociation(buildingInfo: BuildingInfo): Promise<void> {
        const entranceTileIds = buildingInfo.entranceTileIds;
        if (!entranceTileIds) {
            console.warn('[GameMap] Building has no entrance tiles');
            return;
        }

        // 加载纹理（注意添加/texture后缀）
        const entranceTexture = await new Promise<Texture2D>((resolve, reject) => {
            resources.load('textures/buildingEntrance/texture', Texture2D, (err, tex) => {
                if (err) reject(err);
                else resolve(tex);
            });
        });

        const borderTexture = await new Promise<Texture2D>((resolve, reject) => {
            resources.load('textures/highlightBorder/texture', Texture2D, (err, tex) => {
                if (err) reject(err);
                else resolve(tex);
            });
        });

        // 过滤掉无效的入口ID（65535 表示无效/未分配）
        const validEntranceIds = entranceTileIds.filter(id => id !== 65535);

        // 找到entrance tiles并添加overlay（仅对有效ID）
        for (const tile of this._tiles) {
            const tileId = tile.getTileId();
            if (tileId !== 65535 && validEntranceIds.includes(tileId)) {
                const pos = tile.getGridPosition();

                // Layer 10: 顶部entrance图标
                await this.addTileOverlay(new Vec2(pos.x, pos.y), {
                    texture: entranceTexture,
                    faces: [OverlayFace.UP],
                    inflate: 0.004,
                    layerIndex: 10,
                    techniqueIndex: 1 // tile 高亮：透明
                });

                // Layer 11: 侧面边框高亮
                await this.addTileOverlay(new Vec2(pos.x, pos.y), {
                    texture: borderTexture,
                    faces: [
                        OverlayFace.NORTH,
                        OverlayFace.SOUTH,
                        OverlayFace.EAST,
                        OverlayFace.WEST
                    ],
                    color: new Color(255, 200, 0, 255),  // 金色
                    alpha: 0.6,
                    inflate: 0.005,
                    layerIndex: 11,
                    techniqueIndex: 1 // tile 边框：透明
                });

                console.log(`[GameMap] Showed entrance tile overlay at (${pos.x}, ${pos.y})`);
            }
        }
    }

    /**
     * 清除关联overlay（layer 10-20）
     */
    private clearAssociationOverlays(): void {
        this._tileOverlays.forEach((overlays, key) => {
            for (let layer = 10; layer <= 20; layer++) {
                const overlayNode = overlays.get(layer);
                if (overlayNode && overlayNode.isValid) {
                    overlayNode.destroy();
                    overlays.delete(layer);
                }
            }
        });
        console.log('[GameMap] Cleared association overlays');
    }

    /**
     * 根据buildingId查找building
     */
    private findBuildingById(buildingId: number): BuildingInfo | null {
        for (const [key, info] of this._buildingRegistry) {
            if (info.buildingId === buildingId) {
                return info;
            }
        }
        return null;
    }

    /**
     * 清理所有overlay
     */
    private clearAllOverlays(): void {
        this._tileOverlays.forEach((overlays, key) => {
            overlays.forEach((overlayNode) => {
                if (overlayNode && overlayNode.isValid) {
                    overlayNode.destroy();
                }
            });
        });
        this._tileOverlays.clear();
    }

    // ===== 连街机制（1x1建筑） =====

    /**
     * 计算1x1建筑的连街关系
     * 在 assignBuildingIds() 和建筑朝向确定后调用
     */
    public calculateBuildingChains(): void {
        console.log('[GameMap] ===== Calculating building chains =====');

        // 1. 只处理 1x1 建筑
        const smallBuildings = Array.from(this._buildingRegistry.values())
            .filter(b => b.size === 1 && b.buildingId !== undefined);

        console.log(`[GameMap] Found ${smallBuildings.length} 1x1 buildings`);

        // 2. 清除旧关系
        for (const building of smallBuildings) {
            building.chainPrevId = 65535;
            building.chainNextId = 65535;
        }

        // 3. 按朝向分组
        const byDirection = new Map<number, BuildingInfo[]>();
        for (const building of smallBuildings) {
            const dir = building.direction ?? 0;
            if (!byDirection.has(dir)) {
                byDirection.set(dir, []);
            }
            byDirection.get(dir)!.push(building);
        }

        // 日志：每个朝向的建筑数量
        byDirection.forEach((buildings, dir) => {
            console.log(`[GameMap] Direction ${dir}: ${buildings.length} buildings`);
            buildings.forEach(b => {
                console.log(`  Building ${b.buildingId} at (${b.position.x}, ${b.position.z})`);
            });
        });

        // 4. 对每组计算连街
        byDirection.forEach((buildings, dir) => {
            this.calculateChainsForDirection(buildings, dir);
        });

        // 5. 输出最终连街结果
        console.log('[GameMap] ----- Chain results -----');
        for (const building of smallBuildings) {
            if (building.chainPrevId !== 65535 || building.chainNextId !== 65535) {
                console.log(`Building ${building.buildingId}: prev=${building.chainPrevId}, next=${building.chainNextId}`);
            }
        }

        console.log('[GameMap] ===== Building chains calculated =====');
    }

    /**
     * 计算同朝向建筑的连街关系
     */
    private calculateChainsForDirection(buildings: BuildingInfo[], direction: number): void {
        console.log(`[GameMap] --- Calculating chains for direction ${direction} ---`);

        // 朝向：0=南(+z), 1=东(+x), 2=北(-z), 3=西(-x)
        // 入口在朝向一侧，建筑沿垂直方向排列
        const isEastWest = direction === 1 || direction === 3;  // 东西朝向 → 南北排列（z轴变化）

        // 1. 按"不变轴"分组成列/行
        const lines = new Map<number, BuildingInfo[]>();
        for (const building of buildings) {
            // 获取列/行的key（不变的轴坐标）
            const lineKey = isEastWest ? building.position.x : building.position.z;

            if (!lines.has(lineKey)) {
                lines.set(lineKey, []);
            }
            lines.get(lineKey)!.push(building);
        }

        console.log(`[GameMap] Grouped into ${lines.size} ${isEastWest ? 'columns(x)' : 'rows(z)'}`);

        // 2. 对每列/行独立处理
        lines.forEach((lineBuildings, lineKey) => {
            const axis = isEastWest ? 'x' : 'z';
            console.log(`  ${axis}=${lineKey}: ${lineBuildings.length} buildings`);

            if (lineBuildings.length < 2) {
                console.log(`    Only 1 building, no chain`);
                return;
            }

            // 按"变化轴"排序
            lineBuildings.sort((a, b) =>
                isEastWest ? (a.position.z - b.position.z) : (a.position.x - b.position.x)
            );

            // 检查相邻
            for (let i = 0; i < lineBuildings.length - 1; i++) {
                const curr = lineBuildings[i];
                const next = lineBuildings[i + 1];

                // 计算"变化轴"的距离
                const dist = isEastWest
                    ? Math.abs(next.position.z - curr.position.z)
                    : Math.abs(next.position.x - curr.position.x);

                if (dist === 1) {
                    curr.chainNextId = next.buildingId!;
                    next.chainPrevId = curr.buildingId!;
                    console.log(`    ✓ ${curr.buildingId} ↔ ${next.buildingId}`);
                }
            }
        });

        console.log(`[GameMap] --- Direction ${direction} done ---`);
    }

    /**
     * 获取连街的所有建筑ID
     * @param buildingId 起始建筑ID
     * @returns 街道上所有建筑ID（包括自己）
     */
    public getChainBuildings(buildingId: number): number[] {
        const building = this.getBuildingById(buildingId);
        if (!building || building.size !== 1) {
            return [buildingId];
        }

        const chain = new Set<number>([buildingId]);

        // 向 next 遍历
        let current = buildingId;
        while (true) {
            const b = this.getBuildingById(current);
            if (!b || b.chainNextId === undefined || b.chainNextId === 65535) break;  // 显式判断，避免0被当作falsy
            if (chain.has(b.chainNextId)) break;  // 防止循环
            chain.add(b.chainNextId);
            current = b.chainNextId;
        }

        // 向 prev 遍历
        current = buildingId;
        while (true) {
            const b = this.getBuildingById(current);
            if (!b || b.chainPrevId === undefined || b.chainPrevId === 65535) break;  // 显式判断，避免0被当作falsy
            if (chain.has(b.chainPrevId)) break;
            chain.add(b.chainPrevId);
            current = b.chainPrevId;
        }

        return Array.from(chain).sort((a, b) => a - b);
    }

    /**
     * 根据ID获取建筑信息
     */
    private getBuildingById(id: number): BuildingInfo | undefined {
        for (const b of this._buildingRegistry.values()) {
            if (b.buildingId === id) return b;
        }
    }

    /**
     * 根据ID获取tile
     */
    private getTileById(tileId: number): MapTile | undefined {
        for (const tile of this._tiles) {
            if (tile.getTileId() === tileId) return tile;
        }
    }

    /**
     * 显示连街高亮（中键点击建筑时）
     * 使用 street.png 纹理，Layer 30
     */
    public async showBuildingChainOverlay(buildingId: number): Promise<void> {
        console.log(`[GameMap] ===== Showing chain overlay for building ${buildingId} =====`);

        // 1. 清除旧的连街高亮
        this.clearBuildingChainOverlay();

        // 2. 获取连街的所有建筑
        const chainBuildingIds = this.getChainBuildings(buildingId);

        // 详细日志
        console.log(`[GameMap] Chain building IDs: [${chainBuildingIds.join(', ')}]`);
        for (const id of chainBuildingIds) {
            const b = this.getBuildingById(id);
            if (b) {
                console.log(`  Building ${id}: pos=(${b.position.x},${b.position.z}), ` +
                    `prev=${b.chainPrevId ?? 65535}, next=${b.chainNextId ?? 65535}`);
            }
        }

        // 3. 加载 street 纹理（与其他纹理加载方式一致）
        const streetTexture = await new Promise<Texture2D>((resolve, reject) => {
            resources.load('textures/street/texture', Texture2D, (err, tex) => {
                if (err) {
                    console.error('[GameMap] Failed to load street texture:', err);
                    reject(err);
                } else {
                    resolve(tex);
                }
            });
        });

        if (!streetTexture) {
            console.error('[GameMap] Street texture not loaded');
            return;
        }

        // 4. 为每个连街建筑添加overlay（在building位置，不是tile）
        for (const bId of chainBuildingIds) {
            const building = this.getBuildingById(bId);
            if (!building) {
                console.warn(`[GameMap] Building ${bId} not found in registry`);
                continue;
            }

            const pos = building.position;
            console.log(`[GameMap] Adding overlay to building ${bId} at (${pos.x}, ${pos.z})`);

            // Layer 30: 连街标记（在building位置的tile上）
            await this.addTileOverlay(new Vec2(pos.x, pos.z), {
                texture: streetTexture,
                faces: [OverlayFace.UP],
                color: new Color(100, 200, 255, 255),  // 蓝色调
                alpha: 0.8,
                inflate: 0.006,  // 比entrance层高一点
                layerIndex: 30,
                techniqueIndex: 1  // 透明渲染
            });
        }

        console.log(`[GameMap] ===== Chain overlay shown for ${chainBuildingIds.length} buildings =====`);
        console.log(`[GameMap] Chain building IDs: [${chainBuildingIds.join(', ')}]`);
    }

    /**
     * 清除连街高亮
     */
    public clearBuildingChainOverlay(): void {
        // 清除 layer 30 的所有overlay
        this._tileOverlays.forEach((overlays, key) => {
            const overlayNode = overlays.get(30);
            if (overlayNode && overlayNode.isValid) {
                overlayNode.destroy();
                overlays.delete(30);
            }
        });

        console.log('[GameMap] Chain overlay cleared');
    }

    // ========================= 统计方法（用于UI反馈） =========================

    /**
     * 获取已分配ID的tile数量
     */
    public getTileCount(): number {
        return this._tiles.filter(t => t.getTileId() !== 65535).length;
    }

    /**
     * 获取已分配ID的building数量
     */
    public getBuildingCount(): number {
        return Array.from(this._buildingRegistry.values())
            .filter(b => b.buildingId !== undefined && b.buildingId !== 65535).length;
    }

    /**
     * 获取总tile数量（包括未分配ID的）
     */
    public getTotalTileCount(): number {
        return this._tiles.length;
    }

    /**
     * 获取总building数量（包括未分配ID的）
     */
    public getTotalBuildingCount(): number {
        return this._buildingRegistry.size;
    }

    /**
     * 获取所有 tiles（用于导出）
     */
    public getTiles(): MapTile[] {
        return this._tiles;
    }

    /**
     * 获取 building registry（用于导出）
     */
    public getBuildingRegistry(): Map<string, BuildingInfo> {
        return this._buildingRegistry;
    }

    /**
     * 验证网格坐标是否在 u8 范围内 (0-255)
     * @param gridPos 网格坐标
     * @returns true=有效, false=无效
     */
    private validateGridPosition(gridPos: Vec2): boolean {
        const x = gridPos.x;
        const z = gridPos.y;

        // 检查范围和整数
        const inRange =
            x >= GameMap.MIN_GRID_COORD && x <= GameMap.MAX_GRID_COORD &&
            z >= GameMap.MIN_GRID_COORD && z <= GameMap.MAX_GRID_COORD &&
            Number.isInteger(x) && Number.isInteger(z);

        if (!inRange) {
            UINotification.warning(
                `坐标超出范围！\n\n` +
                `位置: (${x}, ${z})\n` +
                `有效范围: 0-255\n\n` +
                `Move 链使用 u8 存储坐标，\n` +
                `只支持 0-255 范围内的整数坐标`
            );

            console.warn(
                `[GameMap] Grid position out of range: (${x}, ${z}), ` +
                `valid range: [${GameMap.MIN_GRID_COORD}, ${GameMap.MAX_GRID_COORD}]`
            );
        }

        return inRange;
    }

    /**
     * 验证建筑位置是否在 u8 范围内
     * @param position 建筑左下角坐标
     * @param size 建筑大小（1 或 2）
     * @returns true=有效, false=无效
     */
    private validateBuildingPosition(position: Vec2, size: number): boolean {
        // 1x1: 只检查 position
        if (!this.validateGridPosition(position)) {
            return false;
        }

        // 2x2: 检查占用的 4 个格子
        if (size === 2) {
            const positions = [
                new Vec2(position.x + 1, position.y),
                new Vec2(position.x, position.y + 1),
                new Vec2(position.x + 1, position.y + 1)
            ];

            for (const pos of positions) {
                if (!this.validateGridPosition(pos)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * 计算地图中心（基于所有 tiles 的 gridPos）
     * @returns 地图中心的世界坐标
     */
    private calculateMapCenter(): Vec3 {
        // 默认中心（没有 tiles 时）
        const defaultGridX = 15;
        const defaultGridZ = 15;

        if (this._tiles.length === 0) {
            console.log('[GameMap] No tiles, using default center (15, 15)');
            const defaultPos = new Vec2(defaultGridX, defaultGridZ);
            return new Vec3(defaultPos.x + 0.5, 0, defaultPos.y + 0.5);
        }

        // 计算所有 tiles 的 gridPos 平均值
        let sumX = 0;
        let sumZ = 0;

        this._tiles.forEach(tile => {
            const gridPos = tile.getGridPosition();
            sumX += gridPos.x;
            sumZ += gridPos.y;  // Vec2.y 是 z 坐标
        });

        const avgX = Math.floor(sumX / this._tiles.length);
        const avgZ = Math.floor(sumZ / this._tiles.length);

        console.log(`[GameMap] Map center calculated: grid(${avgX}, ${avgZ}) from ${this._tiles.length} tiles`);

        // 转换为世界坐标（格子中心）
        return new Vec3(avgX + 0.5, 0, avgZ + 0.5);
    }

    /**
     * 设置相机看向地图中心
     */
    private focusCameraOnMapCenter(): void {
        // 计算地图中心
        const center = this.calculateMapCenter();

        // 获取 CameraController
        const cameraNode = find('Main Camera');
        if (!cameraNode) {
            console.warn('[GameMap] No Main Camera found');
            return;
        }

        const cameraController = cameraNode.getComponent(CameraController);
        if (!cameraController) {
            console.warn('[GameMap] No CameraController found');
            return;
        }

        // 设置相机看向中心（平滑过渡）
        cameraController.lookAt(center, false);
        console.log(`[GameMap] Camera focused on map center: world(${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)})`);
    }
}
