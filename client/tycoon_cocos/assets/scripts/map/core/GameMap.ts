/**
 * 游戏地图核心类（重构版）
 *
 * 协调和管理所有地图相关的模块
 * 委托具体实现给各个辅助模块
 *
 * @author Web3 Tycoon Team
 * @version 2.0.0
 */

import { _decorator, Component, Node, Camera, find, Vec2, director } from 'cc';
import { MapConfig } from '../MapManager';
import { VoxelSystem } from '../../voxel/VoxelSystem';
import { EventBus } from '../../events/EventBus';
import { EventTypes } from '../../events/EventTypes';
import { MapInteractionManager, MapInteractionData, MapInteractionEvent } from '../interaction/MapInteractionManager';
import { isWeb3Object, isWeb3Tile, isWeb3Building, getBuildingSize } from '../../voxel/Web3BlockTypes';

// 编辑器模块
import { MapEditorManager } from '../editor/MapEditorManager';

// 辅助模块
import { TilePlacementHelper } from '../helpers/TilePlacementHelper';
import { BuildingManager } from '../helpers/BuildingManager';
import { ObjectPlacementHelper } from '../helpers/ObjectPlacementHelper';
import { MapDataLoader } from '../helpers/MapDataLoader';
import { MapPathfinding } from '../helpers/MapPathfinding';

const { ccclass, property } = _decorator;

/**
 * 游戏地图类
 * 核心协调器，管理和委托所有地图操作
 */
@ccclass('GameMap')
export class GameMap extends Component {

    // ========================= 编辑器属性 =========================

    @property({ displayName: "地图ID" })
    public mapId: string = 'default_map';

    @property({ type: Node, displayName: "地块容器" })
    public tilesContainer: Node | null = null;

    @property({ type: Node, displayName: "物体容器" })
    public objectsContainer: Node | null = null;

    @property({ type: Camera, displayName: "主相机" })
    public mainCamera: Camera | null = null;

    @property({ displayName: "启用编辑模式" })
    public enableEditMode: boolean = false;

    @property({ displayName: "调试模式" })
    public debugMode: boolean = false;

    // ========================= 私有属性 =========================

    // 辅助模块
    private _tileHelper: TilePlacementHelper;
    private _buildingManager: BuildingManager;
    private _objectHelper: ObjectPlacementHelper;
    private _dataLoader: MapDataLoader;
    private _pathfinding: MapPathfinding;

    // 编辑器模块
    private _editorManager: MapEditorManager | null = null;

    // 系统引用
    private _mapConfig: MapConfig | null = null;
    private _voxelSystem: VoxelSystem | null = null;
    private _interactionManager: MapInteractionManager | null = null;

    // 状态
    private _isEditMode: boolean = false;
    private _isInitialized: boolean = false;
    private _currentSelectedBlockId: string | null = null;

    // 容器节点
    private _actorsRoot: Node | null = null;
    private _buildingsRoot: Node | null = null;

    // ========================= 生命周期方法 =========================

    protected onLoad(): void {
        console.log('[GameMap] onLoad');

        // 初始化辅助模块
        this._tileHelper = new TilePlacementHelper();
        this._buildingManager = new BuildingManager();
        this._objectHelper = new ObjectPlacementHelper();
        this._dataLoader = new MapDataLoader();
        this._pathfinding = new MapPathfinding();
    }

    protected onDestroy(): void {
        console.log('[GameMap] onDestroy');
        this.cleanup();
    }

    /**
     * 初始化地图组件
     */
    public async init(config: MapConfig, isEdit: boolean, interactionManager?: MapInteractionManager | null): Promise<void> {
        console.log(`[GameMap] Initializing map: ${config.id}, editMode: ${isEdit}`);

        this._mapConfig = config;
        this._isEditMode = isEdit;
        this.mapId = config.id;

        // 确保容器存在
        this.ensureContainers();

        // 查找主相机
        this.findMainCamera();

        // 获取体素系统
        this._voxelSystem = VoxelSystem.getInstance();

        // 保障辅助模块已创建（避免 onLoad 尚未触发时为 undefined）
        if (!this._tileHelper) this._tileHelper = new TilePlacementHelper();
        if (!this._buildingManager) this._buildingManager = new BuildingManager();
        if (!this._objectHelper) this._objectHelper = new ObjectPlacementHelper();
        if (!this._dataLoader) this._dataLoader = new MapDataLoader();
        if (!this._pathfinding) this._pathfinding = new MapPathfinding();

        // 初始化辅助模块
        this.initializeHelpers();

        // 设置交互管理器
        this._interactionManager = interactionManager || null;

        // 编辑模式初始化
        if (isEdit) {
            await this.initializeEditor();
            this.registerEditModeEvents();
        }

        // 尝试加载地图数据
        const loadSuccess = await this._dataLoader.loadMap(this.mapId);
        if (!loadSuccess && isEdit) {
            // 编辑模式下如果没有数据，创建空地图
            console.log('[GameMap] No map data found, creating empty map for edit mode');
        }

        this._isInitialized = true;
        console.log('[GameMap] Map initialized successfully');
    }

    /**
     * 初始化辅助模块
     */
    private initializeHelpers(): void {
        // 初始化地块辅助器
        this._tileHelper.initialize(this.tilesContainer!, this._voxelSystem);

        // 初始化建筑管理器
        this._buildingManager.initialize(
            this._buildingsRoot!,
            this.tilesContainer!,
            this._voxelSystem,
            this._tileHelper
        );

        // 初始化物体辅助器
        this._objectHelper.initialize(
            this.objectsContainer!,
            this._actorsRoot!,
            this._voxelSystem
        );

        // 初始化数据加载器
        this._dataLoader.initialize(
            this._tileHelper,
            this._buildingManager,
            this._objectHelper
        );

        // 初始化路径查找器
        this._pathfinding.initialize(this._tileHelper);
    }

    /**
     * 初始化编辑器
     */
    private async initializeEditor(): Promise<void> {
        if (!this._isEditMode) return;

        // 创建编辑器管理器
        this._editorManager = new MapEditorManager();
        this._editorManager.initialize(
            this.node,
            this.mainCamera,
            this.mapId,
            this._mapConfig?.name || `Map ${this.mapId}`,
            this._tileHelper.getTilesArray(),
            this._tileHelper.getTileIndex(),
            this._objectHelper.getAllObjects(),
            this._buildingManager.getBuildingRegistry()
        );

        // 创建编辑网格
        this._editorManager.createEditGrid({ debugMode: this.debugMode });

        console.log('[GameMap] Editor initialized');
    }

    /**
     * 注册编辑模式事件
     */
    private registerEditModeEvents(): void {
        // 监听方块选中事件
        EventBus.on(EventTypes.UI.MapElementSelected, this.onMapElementSelected, this);

        // 监听交互事件
        if (this._interactionManager) {
            EventBus.on(MapInteractionEvent.REQUEST_PLACE, this.onRequestPlace, this);
            EventBus.on(MapInteractionEvent.REQUEST_REMOVE, this.onRequestRemove, this);
            EventBus.on(MapInteractionEvent.ELEMENT_CLICKED, this.onElementClicked, this);
        }
    }

    // ========================= 事件处理 =========================

    /**
     * 处理地图元素选中事件
     */
    private onMapElementSelected(data: any): void {
        console.log('[GameMap] Map element selected:', data);
        this._currentSelectedBlockId = data.blockId;
    }

    /**
     * 处理放置请求
     */
    private async onRequestPlace(data: MapInteractionData): Promise<void> {
        if (!this._currentSelectedBlockId || !this._isEditMode) return;

        const gridPos = data.gridPosition;
        const blockId = this._currentSelectedBlockId;

        console.log(`[GameMap] Request place: ${blockId} at (${gridPos.x}, ${gridPos.y})`);

        // 判断方块类型并委托给相应模块
        if (isWeb3Tile(blockId)) {
            await this._tileHelper.placeTileAt(blockId, gridPos);
        } else if (isWeb3Building(blockId)) {
            const size = getBuildingSize(blockId) as 1 | 2;
            await this._buildingManager.placeBuildingAt(blockId, gridPos, size);
        } else if (isWeb3Object(blockId)) {
            await this._objectHelper.placeObjectAt(blockId, gridPos);
        } else {
            // 装饰物
            await this._objectHelper.placeDecorationAt(blockId, gridPos);
        }

        // 标记有修改
        if (this._editorManager) {
            this._editorManager.markAsModified();
        }
    }

    /**
     * 处理删除请求
     */
    private onRequestRemove(data: MapInteractionData): void {
        if (!this._isEditMode) return;

        const gridPos = data.gridPosition;
        console.log(`[GameMap] Request remove at (${gridPos.x}, ${gridPos.y})`);

        // 尝试删除各类元素
        const tile = this._tileHelper.getTileAt(gridPos.x, gridPos.y);
        if (tile) {
            this._tileHelper.removeTile(tile);
        }

        const object = this._objectHelper.getObjectAt(gridPos.x, gridPos.y);
        if (object) {
            this._objectHelper.removeObject(object);
        }

        const buildingInfo = this._buildingManager.findBuildingInfo(gridPos);
        if (buildingInfo) {
            this._buildingManager.removeBuilding(gridPos);
        }

        // 尝试删除装饰物
        const decoration = this._objectHelper.getDecorationAt(gridPos.x, gridPos.y);
        if (decoration) {
            this._objectHelper.removeDecorationAt(gridPos.x, gridPos.y);
        }

        // 标记有修改
        if (this._editorManager) {
            this._editorManager.markAsModified();
        }
    }

    /**
     * 处理元素点击事件
     */
    private onElementClicked(data: MapInteractionData): void {
        const gridPos = data.gridPosition;
        console.log(`[GameMap] Element clicked at (${gridPos.x}, ${gridPos.y})`);

        // 尝试切换建筑朝向
        const buildingInfo = this._buildingManager.findBuildingInfo(gridPos);
        if (buildingInfo) {
            this._buildingManager.cycleBuildingDirection(gridPos);

            // 标记有修改
            if (this._editorManager) {
                this._editorManager.markAsModified();
            }
        }
    }

    // ========================= 公开API（委托给各模块） =========================

    // 地块操作
    public getTileAt(x: number, z: number): any {
        return this._tileHelper.getTileAt(x, z);
    }

    public getAllTiles(): any[] {
        return this._tileHelper.getAllTiles();
    }

    // 物体操作
    public getObjectAt(x: number, z: number): any {
        return this._objectHelper.getObjectAt(x, z);
    }

    public getAllObjects(): any[] {
        return this._objectHelper.getAllObjects();
    }

    // 建筑操作
    public upgradeBuilding(gridPos: Vec2, newLevel: number): boolean {
        return this._buildingManager.upgradeBuilding(gridPos, newLevel);
    }

    // 地图操作
    public async loadMap(mapId: string): Promise<boolean> {
        return await this._dataLoader.loadMap(mapId);
    }

    public clearMap(): void {
        this._dataLoader.clearMap();
    }

    public clearAllPlacedBlocks(): void {
        this._tileHelper.clearAllTiles();
        this._objectHelper.clearAllObjects();
        // 清理建筑
        const registry = this._buildingManager.getBuildingRegistry();
        const positions: Vec2[] = [];
        registry.forEach((info) => {
            positions.push(new Vec2(info.position.x, info.position.z));
        });
        for (const pos of positions) {
            this._buildingManager.removeBuilding(pos);
        }
    }

    // 路径查找
    public findPath(start: Vec2, end: Vec2): Vec2[] | null {
        return this._pathfinding.findPath(start, end);
    }

    public isPathTile(x: number, z: number): boolean {
        const tile = this._tileHelper.getTileAt(x, z);
        return tile ? this._pathfinding.isPathTile(tile) : false;
    }

    // 统计信息
    public getMapStats(): any {
        return {
            tiles: this._tileHelper.getTileStats(),
            objects: this._objectHelper.getObjectStats(),
            buildings: this._buildingManager.getBuildingStats()
        };
    }

    // 编辑器功能代理
    public assignIds(): void {
        if (this._editorManager) {
            this._editorManager.assignIds();
        }
    }

    public showIds(): void {
        if (this._editorManager) {
            this._editorManager.showIds();
        }
    }

    public hideIds(): void {
        if (this._editorManager) {
            this._editorManager.hideIds();
        }
    }

    public async saveImmediate(): Promise<boolean> {
        if (this._editorManager) {
            return await this._editorManager.saveImmediate();
        }
        return false;
    }

    // ========================= 辅助方法 =========================

    /**
     * 确保容器节点存在
     */
    private ensureContainers(): void {
        if (!this.tilesContainer) {
            this.tilesContainer = new Node('TilesContainer');
            this.tilesContainer.setParent(this.node);
        }

        if (!this.objectsContainer) {
            this.objectsContainer = new Node('ObjectsContainer');
            this.objectsContainer.setParent(this.node);
        }

        // 创建Actor容器
        this._actorsRoot = this.node.getChildByName('Actors');
        if (!this._actorsRoot) {
            this._actorsRoot = new Node('Actors');
            this._actorsRoot.setParent(this.node);
        }

        // 创建建筑容器
        this._buildingsRoot = this.node.getChildByName('Buildings');
        if (!this._buildingsRoot) {
            this._buildingsRoot = new Node('Buildings');
            this._buildingsRoot.setParent(this.node);
        }
    }

    /**
     * 查找主相机
     */
    private findMainCamera(): void {
        if (!this.mainCamera) {
            // 尝试按名称查找
            const cameraNode = find('Main Camera');
            if (cameraNode) {
                this.mainCamera = cameraNode.getComponent(Camera);
            }

            // 如果找不到，查找场景中的第一个 Camera 组件
            if (!this.mainCamera) {
                const scene = director.getScene();
                if (scene) {
                    const cameras = scene.getComponentsInChildren(Camera);
                    if (cameras && cameras.length > 0) {
                        this.mainCamera = cameras[0];
                        console.log('[GameMap] Using first camera found in scene');
                    }
                }
            }

            if (!this.mainCamera) {
                console.warn('[GameMap] No camera found in scene');
            }
        }
    }

    /**
     * 更新（每帧调用）
     */
    protected update(deltaTime: number): void {
        // 更新编辑器ID标签
        if (this._editorManager) {
            this._editorManager.updateIdLabels(deltaTime);
        }
    }

    /**
     * 清理资源
     */
    private cleanup(): void {
        // 清理编辑器
        if (this._editorManager) {
            this._editorManager.cleanup();
            this._editorManager = null;
        }

        // 清理辅助模块
        this._tileHelper.cleanup();
        this._buildingManager.cleanup();
        this._objectHelper.cleanup();
        this._dataLoader.cleanup();
        this._pathfinding.cleanup();

        // 取消事件监听
        EventBus.off(EventTypes.UI.MapElementSelected, this.onMapElementSelected, this);
        EventBus.off(MapInteractionEvent.REQUEST_PLACE, this.onRequestPlace, this);
        EventBus.off(MapInteractionEvent.REQUEST_REMOVE, this.onRequestRemove, this);
        EventBus.off(MapInteractionEvent.ELEMENT_CLICKED, this.onElementClicked, this);
    }

    // ========================= 属性访问器 =========================

    public get isEditMode(): boolean {
        return this._isEditMode;
    }

    public get isInitialized(): boolean {
        return this._isInitialized;
    }

    public get currentMapId(): string {
        return this.mapId;
    }
}
