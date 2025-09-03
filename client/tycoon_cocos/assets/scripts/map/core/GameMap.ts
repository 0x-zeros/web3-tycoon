/**
 * 地图组件
 * 
 * 负责单个地图的加载、渲染、玩家移动路径计算等核心功能
 * 作为单个地图的控制器，协调该地图内各个地块和玩家的交互
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component, Node, Vec3, Camera, geometry, PhysicsSystem, resources, JsonAsset, instantiate, Prefab, tween, find } from 'cc';
import { MapData, MapTileData, TileType, PathResult } from '../types/MapTypes';
import { PlayerData } from '../types/GameTypes';
import { MapTile, TileInteractionResult } from './MapTile';
import { CameraController } from '../../camera/CameraController';
import { input } from 'cc';
import { Input } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 地图加载配置接口
 */
interface MapLoadConfig {
    /** 地图数据文件路径 */
    mapDataPath: string;
    /** 地块预制件路径映射 */
    tilePrefabPaths: { [key in TileType]: string };
    /** 是否启用动画加载 */
    enableLoadAnimation: boolean;
    /** 加载动画持续时间 */
    loadAnimationDuration: number;
}

/**
 * 玩家移动配置接口
 */
interface PlayerMovementConfig {
    /** 移动速度（单位/秒） */
    moveSpeed: number;
    /** 移动动画类型 */
    animationType: 'linear' | 'smooth' | 'bounce';
    /** 是否显示移动路径 */
    showMovePath: boolean;
    /** 路径高亮颜色 */
    pathHighlightColor: string;
}

/**
 * 摄像机控制配置接口
 */
interface CameraControlConfig {
    /** 是否启用摄像机控制 */
    enableCameraControl: boolean;
    /** 缩放范围 */
    zoomRange: { min: number; max: number };
    /** 旋转范围 */
    rotationRange: { min: number; max: number };
    /** 移动边界 */
    moveBounds: { x: number; z: number };
    /** 控制敏感度 */
    sensitivity: number;
}

/**
 * 地图组件主类
 * 继承自Cocos Creator Component，可挂载到场景节点
 */
@ccclass('GameMap')
export class GameMap extends Component {
    
    // ========================= 编辑器属性 =========================
    
    @property({ displayName: "地图数据文件", tooltip: "JSON格式的地图数据文件路径" })
    public mapDataPath: string = 'data/maps/test_map';
    
    @property({ displayName: "地块容器节点", type: Node, tooltip: "用于放置所有地块的父节点" })
    public tilesContainer: Node | null = null;
    
    @property({ displayName: "主摄像机", type: Camera, tooltip: "场景主摄像机" })
    public mainCamera: Camera | null = null;
    
    @property({ displayName: "启用鼠标控制", tooltip: "是否启用鼠标点击和拖拽控制" })
    public enableMouseControl: boolean = true;
    
    @property({ displayName: "移动速度", tooltip: "玩家移动动画速度" })
    public playerMoveSpeed: number = 3.0;
    
    @property({ displayName: "启用调试模式", tooltip: "显示调试信息和辅助线" })
    public debugMode: boolean = false;
    
    // ========================= 地块预制件引用 =========================
    
    @property({ displayName: "起点地块预制件", type: Prefab })
    public startTilePrefab: Prefab | null = null;
    
    @property({ displayName: "地产地块预制件", type: Prefab })
    public propertyTilePrefab: Prefab | null = null;
    
    @property({ displayName: "机会地块预制件", type: Prefab })
    public chanceTilePrefab: Prefab | null = null;
    
    @property({ displayName: "空白地块预制件", type: Prefab })
    public emptyTilePrefab: Prefab | null = null;
    
    @property({ displayName: "监狱地块预制件", type: Prefab })
    public jailTilePrefab: Prefab | null = null;
    
    @property({ displayName: "费用地块预制件", type: Prefab })
    public feeTilePrefab: Prefab | null = null;
    
    @property({ displayName: "奖励地块预制件", type: Prefab })
    public bonusTilePrefab: Prefab | null = null;
    
    @property({ displayName: "卡片站预制件", type: Prefab })
    public cardStationTilePrefab: Prefab | null = null;
    
    // ========================= 私有属性 =========================
    
    /** 当前地图数据 */
    private _mapData: MapData | null = null;
    
    /** 地块实例映射表 */
    private _tileInstances: Map<number, MapTile> = new Map();
    
    /** 地块节点映射表 */
    private _tileNodes: Map<number, Node> = new Map();
    
    /** 路径缓存 */
    private _pathCache: Map<string, PathResult> = new Map();
    
    /** 是否已初始化 */
    private _isInitialized: boolean = false;
    
    /** 当前选中的地块 */
    private _selectedTile: MapTile | null = null;
    
    /** 移动配置 */
    private _moveConfig: PlayerMovementConfig = {
        moveSpeed: 3.0,
        animationType: 'smooth',
        showMovePath: true,
        pathHighlightColor: '#ffff00'
    };
    
    /** 摄像机控制配置 */
    private _cameraConfig: CameraControlConfig = {
        enableCameraControl: true,
        zoomRange: { min: 2, max: 10 },
        rotationRange: { min: 0, max: 360 },
        moveBounds: { x: 20, z: 20 },
        sensitivity: 1.0
    };
    
    /** 鼠标控制状态 */
    private _mouseControlState = {
        isDragging: false,
        lastMousePos: Vec3.ZERO.clone(),
        dragStartPos: Vec3.ZERO.clone()
    };
    
    // ========================= 生命周期方法 =========================
    
    protected onLoad(): void {
        this.initializeComponents();
        this.setupMouseEvents();
    }
    
    protected start(): void {
        // 延迟一帧确保所有组件准备就绪
        this.scheduleOnce(() => {
            this.initializeMap();
        }, 0);
    }
    
    protected onDestroy(): void {
        this.cleanup();
    }
    
    // ========================= 初始化方法 =========================
    
    /**
     * 初始化组件
     */
    private initializeComponents(): void {
        // 创建地块容器（如果不存在）
        if (!this.tilesContainer) {
            this.tilesContainer = new Node('TilesContainer');
            this.tilesContainer.setParent(this.node);
        }
        
        // 获取主摄像机（通过CameraController统一管理）
        if (!this.mainCamera) {
            this.mainCamera = CameraController.getMainCamera();
      
            if (!this.mainCamera) {
                console.error('[GameMap] 无法通过CameraController获取主摄像机，请确保CameraController已正确初始化');
            }
        }
        
        // 更新移动配置
        this._moveConfig.moveSpeed = this.playerMoveSpeed;
        
        console.log('[Map] 组件初始化完成');
    }
    
    /**
     * 设置鼠标事件
     */
    private setupMouseEvents(): void {
        if (!this.enableMouseControl) {
            return;
        }
        

        // TODO: 根据Cocos Creator版本调整事件处理方式
        // 这里需要在Canvas或者其他合适的节点上监听全局鼠标事件
        
        //bug
        // this.node.on(Node.EventType.MOUSE_DOWN, this.onMouseDown, this);
        // this.node.on(Node.EventType.MOUSE_MOVE, this.onMouseMove, this);
        // this.node.on(Node.EventType.MOUSE_UP, this.onMouseUp, this);
        // this.node.on(Node.EventType.MOUSE_WHEEL, this.onMouseWheel, this);

        //如果你要在 3D Node 上做点击交互，要走 射线检测（Raycast），而不是直接监听 Node 的鼠标事件。
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    }
    
    /**
     * 初始化地图
     */
    private async initializeMap(): Promise<void> {
        try {
            console.log('[Map] 开始加载地图...');
            
            // 加载地图数据
            await this.loadMapData();
            
            // 创建地块
            await this.createTiles();
            
            // 设置摄像机位置
            this.setupCamera();
            
            // 缓存路径
            this.buildPathCache();
            
            this._isInitialized = true;
            
            console.log('[Map] 地图初始化完成');
            
            // 触发地图加载完成事件
            this.node.emit('map-loaded', { mapData: this._mapData });
            
        } catch (error) {
            console.error('[Map] 地图初始化失败:', error);
            this.node.emit('map-load-error', { error });
        }
    }
    
    /**
     * 加载地图数据
     */
    private async loadMapData(): Promise<void> {
        return new Promise((resolve, reject) => {

            //resources.load 只能加载在resources目录下的资源，所以需要把data/maps/test_map.json 放到resources目录下
            resources.load(this.mapDataPath, JsonAsset, (err, jsonAsset) => {
                if (err) {
                    console.error('[Map] 加载地图数据失败:', err);
                    reject(err);
                    return;
                }
                
                try {
                    this._mapData = jsonAsset.json as MapData;
                    console.log('[Map] 地图数据加载成功:', this._mapData.mapName);
                    resolve();
                } catch (parseError) {
                    console.error('[Map] 解析地图数据失败:', parseError);
                    reject(parseError);
                }
            });
        });
    }
    
    /**
     * 创建所有地块
     */
    private async createTiles(): Promise<void> {
        if (!this._mapData || !this.tilesContainer) {
            throw new Error('地图数据或容器节点不存在');
        }
        
        const promises: Promise<void>[] = [];
        
        for (const tileData of this._mapData.tiles) {
            promises.push(this.createSingleTile(tileData));
        }
        
        await Promise.all(promises);
        
        console.log(`[Map] 创建了 ${this._tileInstances.size} 个地块`);
    }
    
    /**
     * 创建单个地块
     */
    private async createSingleTile(tileData: MapTileData): Promise<void> {
        const prefab = this.getTilePrefab(tileData.type);
        if (!prefab) {
            console.error(`[Map] 找不到地块类型 ${tileData.type} 的预制件`);
            return;
        }
        
        // 实例化预制件
        const tileNode = instantiate(prefab);
        tileNode.name = `Tile_${tileData.id}_${tileData.name}`;
        tileNode.setParent(this.tilesContainer!);
        
        // 获取MapTile组件
        const tileComponent = tileNode.getComponent(MapTile);
        if (!tileComponent) {
            console.error(`[Map] 地块预制件 ${tileData.type} 缺少MapTile组件`);
            tileNode.destroy();
            return;
        }
        
        // 初始化地块数据
        tileComponent.initializeTile(tileData);
        
        // 监听地块事件
        tileNode.on('game-event', this.onTileEvent, this);
        
        // 保存引用
        this._tileInstances.set(tileData.id, tileComponent);
        this._tileNodes.set(tileData.id, tileNode);
        
        if (this.debugMode) {
            console.log(`[Map] 创建地块: ${tileData.name} (${tileData.type})`);
        }
    }
    
    /**
     * 获取地块类型对应的预制件
     */
    private getTilePrefab(tileType: TileType): Prefab | null {
        switch (tileType) {
            case TileType.START:
                return this.startTilePrefab;
            case TileType.PROPERTY:
                return this.propertyTilePrefab;
            case TileType.CHANCE:
                return this.chanceTilePrefab;
            case TileType.EMPTY:
                return this.emptyTilePrefab;
            case TileType.JAIL:
                return this.jailTilePrefab;
            case TileType.TAX:
                return this.feeTilePrefab;
            case TileType.FREE_PARKING:
                return this.bonusTilePrefab;
            case TileType.CARD_STATION:
                return this.cardStationTilePrefab;
            default:
                console.warn(`[Map] 未支持的地块类型: ${tileType}`);
                return this.emptyTilePrefab; // 默认使用空白地块
        }
    }
    
    /**
     * 设置摄像机
     */
    private setupCamera(): void {
        if (!this.mainCamera || !this._mapData) {
            return;
        }
        
        // 如果地图数据中有摄像机配置，使用配置的位置
        if (this._mapData.cameraConfig?.defaultPosition) {
            // this.mainCamera.node.setPosition(this._mapData.cameraConfig.defaultPosition);

            //defaultRotation
            // this.mainCamera.node.setRotationFromEuler(45, 0, 0);
        } else {
            // 否则计算地图中心位置
            const center = this.calculateMapCenter();
            // this.mainCamera.node.setPosition(center.x, 8, center.z + 5); // 45度俯视角度
            // this.mainCamera.node.setRotationFromEuler(45, 0, 0);
        }
        
        console.log('[Map] 摄像机设置完成');
    }
    
    /**
     * 计算地图中心位置
     */
    private calculateMapCenter(): Vec3 {
        if (!this._mapData || this._mapData.tiles.length === 0) {
            return Vec3.ZERO;
        }
        
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        for (const tile of this._mapData.tiles) {
            minX = Math.min(minX, tile.position.x);
            maxX = Math.max(maxX, tile.position.x);
            minZ = Math.min(minZ, tile.position.z);
            maxZ = Math.max(maxZ, tile.position.z);
        }
        
        return new Vec3(
            (minX + maxX) / 2,
            0,
            (minZ + maxZ) / 2
        );
    }
    
    /**
     * 构建路径缓存
     */
    private buildPathCache(): void {
        if (!this._mapData) {
            return;
        }
        
        console.log('[Map] 开始构建路径缓存...');
        
        // 为常用路径组合建立缓存
        // 这里可以预计算一些常用的路径，提高运行时性能
        const tileIds = this._mapData.tiles.map(t => t.id);
        
        // 缓存相邻地块的路径（距离为1-6步的路径）
        for (let i = 0; i < tileIds.length; i++) {
            const fromId = tileIds[i];
            for (let steps = 1; steps <= 6; steps++) {
                const path = this.calculateMovePath(fromId, steps);
                const cacheKey = `${fromId}-${steps}`;
                this._pathCache.set(cacheKey, path);
            }
        }
        
        console.log(`[Map] 路径缓存构建完成，缓存了 ${this._pathCache.size} 条路径`);
    }
    
    // ========================= 公共接口方法 =========================
    
    /**
     * 获取地块实例
     * @param tileId 地块ID
     */
    public getTile(tileId: number): MapTile | null {
        return this._tileInstances.get(tileId) || null;
    }
    
    /**
     * 获取地块节点
     * @param tileId 地块ID
     */
    public getTileNode(tileId: number): Node | null {
        return this._tileNodes.get(tileId) || null;
    }
    
    /**
     * 获取起点地块
     */
    public getStartTile(): MapTile | null {
        if (!this._mapData) {
            return null;
        }
        
        return this.getTile(0); // 假设起点地块ID为0
    }
    
    /**
     * 计算玩家移动路径
     * @param fromTileId 起始地块ID
     * @param steps 移动步数
     */
    public calculateMovePath(fromTileId: number, steps: number): PathResult {
        const cacheKey = `${fromTileId}-${steps}`;
        
        // 检查缓存
        if (this._pathCache.has(cacheKey)) {
            return this._pathCache.get(cacheKey)!;
        }
        
        // 计算路径
        const path = this.computeMovePath(fromTileId, steps);
        
        // 缓存结果
        this._pathCache.set(cacheKey, path);
        
        return path;
    }
    
    /**
     * 实际计算移动路径的逻辑
     */
    private computeMovePath(fromTileId: number, steps: number): PathResult {
        if (!this._mapData) {
            return { tileIds: [], totalDistance: 0, isValid: false };
        }
        
        const tileIds: number[] = [fromTileId];
        let currentTileId = fromTileId;
        let remainingSteps = steps;
        
        while (remainingSteps > 0) {
            // 简单的循环路径计算（假设是20个地块的环形地图）
            const nextTileId = (currentTileId + 1) % this._mapData.tiles.length;
            tileIds.push(nextTileId);
            currentTileId = nextTileId;
            remainingSteps--;
        }
        
        return {
            tileIds: tileIds.slice(1), // 移除起点
            totalDistance: steps,
            isValid: true
        };
    }
    
    /**
     * 玩家移动到指定地块
     * @param player 玩家数据
     * @param targetTileId 目标地块ID
     * @param animated 是否播放移动动画
     */
    public async movePlayerToTile(player: PlayerData, targetTileId: number, animated: boolean = true): Promise<TileInteractionResult> {
        const targetTile = this.getTile(targetTileId);
        if (!targetTile) {
            console.error(`[Map] 目标地块不存在: ${targetTileId}`);
            return {
                success: false,
                message: '目标地块不存在',
                events: []
            };
        }
        
        // 从当前地块离开
        const currentTile = this.getTile(player.currentTile);
        if (currentTile) {
            currentTile.playerLeave(player);
        }
        
        // 播放移动动画（如果启用）
        if (animated && player.pieceNode) {
            await this.playMoveAnimation(player.pieceNode, targetTile.getWorldPosition());
        }
        
        // 到达新地块
        const result = await targetTile.playerLandOn(player);
        
        console.log(`[Map] 玩家 ${player.nickname} 移动到地块 ${targetTile.getTileInfo().name}`);
        
        return result;
    }
    
    /**
     * 沿路径移动玩家
     * @param player 玩家数据
     * @param path 移动路径
     */
    public async movePlayerAlongPath(player: PlayerData, path: PathResult): Promise<TileInteractionResult[]> {
        if (!path.isValid || path.tileIds.length === 0) {
            return [];
        }
        
        const results: TileInteractionResult[] = [];
        
        // 依次经过路径上的每个地块
        for (let i = 0; i < path.tileIds.length; i++) {
            const tileId = path.tileIds[i];
            const tile = this.getTile(tileId);
            
            if (!tile) {
                console.error(`[Map] 路径上的地块不存在: ${tileId}`);
                continue;
            }
            
            const isLastTile = i === path.tileIds.length - 1;
            
            if (isLastTile) {
                // 最后一个地块：停留
                const result = await this.movePlayerToTile(player, tileId, true);
                results.push(result);
            } else {
                // 中间地块：经过
                const result = await tile.playerPassThrough(player);
                results.push(result);
                
                // 播放经过动画
                if (player.pieceNode) {
                    await this.playMoveAnimation(player.pieceNode, tile.getWorldPosition(), 0.3);
                }
            }
        }
        
        return results;
    }
    
    /**
     * 播放移动动画
     * @param pieceNode 棋子节点
     * @param targetPosition 目标位置
     * @param duration 动画时长
     */
    private async playMoveAnimation(pieceNode: Node, targetPosition: Vec3, duration?: number): Promise<void> {
        return new Promise((resolve) => {
            const animDuration = duration || (1.0 / this._moveConfig.moveSpeed);
            
            tween(pieceNode)
                .to(animDuration, { position: targetPosition })
                .call(() => {
                    resolve();
                })
                .start();
        });
    }
    
    /**
     * 高亮显示路径
     * @param path 要高亮的路径
     */
    public highlightPath(path: PathResult): void {
        // 清除之前的高亮
        this.clearPathHighlight();
        
        if (!path.isValid) {
            return;
        }
        
        // 高亮路径上的地块
        for (const tileId of path.tileIds) {
            const tile = this.getTile(tileId);
            if (tile) {
                tile.setHighlighted(true);
            }
        }
    }
    
    /**
     * 清除路径高亮
     */
    public clearPathHighlight(): void {
        this._tileInstances.forEach(tile => {
            tile.setHighlighted(false);
        });
    }
    
    /**
     * 设置选中的地块
     * @param tile 地块ID
     */
    public setSelectedTile(tile: number | MapTile | null): void {

        let newTile: MapTile | null = null;
        if (tile !== null) {
            if (tile instanceof MapTile) {
                newTile = tile;
            } else {
                newTile = this.getTile(tile);
            }
        }

        // 清除之前的选中状态
        if (this._selectedTile && this._selectedTile !== newTile) {
            this._selectedTile.setSelected(false);
        }
        
        // 设置新的选中状态
        if (newTile !== null) {
            this._selectedTile = newTile;
            this._selectedTile.setSelected(true);
        } else {
            this._selectedTile = null;
        }
    }
    
    // ========================= 鼠标事件处理 =========================
    
    private onMouseDown(event: any): void {
        if (!this.enableMouseControl) {
            return;
        }
        
        this._mouseControlState.isDragging = true;
        this._mouseControlState.lastMousePos = event.getLocation();
        this._mouseControlState.dragStartPos = event.getLocation();
        
        // 尝试射线检测选中地块
        this.performRaycast(event);
    }
    
    private onMouseMove(event: any): void {
        if (!this.enableMouseControl || !this.mainCamera) {
            return;
        }
        
        const currentPos = event.getLocation();
        
        if (this._mouseControlState.isDragging) {
            // 计算鼠标移动距离
            const deltaX = currentPos.x - this._mouseControlState.lastMousePos.x;
            const deltaY = currentPos.y - this._mouseControlState.lastMousePos.y;
            
            // 旋转摄像机
            this.rotateCameraByDelta(deltaX, deltaY);
            
            this._mouseControlState.lastMousePos = currentPos;
        }
    }
    
    private onMouseUp(event: any): void {
        this._mouseControlState.isDragging = false;
    }
    
    private onMouseWheel(event: any): void {
        if (!this.enableMouseControl || !this.mainCamera) {
            return;
        }
        
        // 缩放摄像机
        const scrollY = event.getScrollY();
        this.zoomCameraByDelta(scrollY);
    }
    
    /**
     * 执行射线检测
     */
    private performRaycast(event: any): void {
        if (!this.mainCamera) {
            return;
        }
        
        // TODO: 实现射线检测逻辑
        // 这里需要根据Cocos Creator的物理系统API来实现
        // 基本流程是：鼠标位置 -> 世界坐标射线 -> 与地块碰撞检测
        
        // console.log('[Map] 射线检测功能待实现');

        // 将屏幕坐标转成射线
        const ray = this.mainCamera.screenPointToRay(event.getLocationX(), event.getLocationY());

        // 用物理系统射线检测
        if (PhysicsSystem.instance.raycastClosest(ray)) {
            const result = PhysicsSystem.instance.raycastClosestResult;
            // console.log('点击到了:', result.collider.node.name);

            //如果点击到了map tile
            const mapTile = result.collider.node.parent?.getComponent(MapTile)
            if (mapTile) {
                this.setSelectedTile(mapTile);
            }
        }
    }
    
    /**
     * 根据鼠标移动旋转摄像机
     */
    private rotateCameraByDelta(deltaX: number, deltaY: number): void {
        if (!this.mainCamera) {
            return;
        }
        
        const rotationSpeed = this._cameraConfig.sensitivity * 0.5;
        const currentRotation = this.mainCamera.node.eulerAngles;
        
        // 水平旋转（绕Y轴）
        let newRotationY = currentRotation.y + deltaX * rotationSpeed;
        
        // 垂直旋转（绕X轴）
        let newRotationX = currentRotation.x - deltaY * rotationSpeed;
        newRotationX = Math.max(10, Math.min(80, newRotationX)); // 限制俯仰角度
        
        this.mainCamera.node.setRotationFromEuler(newRotationX, newRotationY, 0);
    }
    
    /**
     * 根据鼠标滚轮缩放摄像机
     */
    private zoomCameraByDelta(scrollDelta: number): void {
        if (!this.mainCamera) {
            return;
        }
        
        const zoomSpeed = this._cameraConfig.sensitivity * 0.5;
        const currentPos = this.mainCamera.node.position;
        const zoomDirection = currentPos.clone().normalize();
        
        // 计算新位置
        const zoomAmount = scrollDelta * zoomSpeed;
        const newPos = currentPos.clone().add(zoomDirection.multiplyScalar(zoomAmount));
        
        // 限制缩放范围
        const distance = newPos.length();
        if (distance >= this._cameraConfig.zoomRange.min && distance <= this._cameraConfig.zoomRange.max) {
            this.mainCamera.node.setPosition(newPos);
        }
    }
    
    // ========================= 事件处理 =========================
    
    /**
     * 处理来自地块的事件
     */
    private onTileEvent(event: any): void {
        const { type, data, source } = event.detail || event;
        
        console.log(`[Map] 收到地块事件: ${type}`, data);
        
        // 转发给游戏管理器或其他系统
        this.node.emit('tile-event', { type, data, source });
    }
    
    // ========================= 工具方法 =========================
    
    /**
     * 获取地图数据
     */
    public getMapData(): MapData | null {
        return this._mapData;
    }
    
    /**
     * 检查是否已初始化
     */
    public isInitialized(): boolean {
        return this._isInitialized;
    }
    
    /**
     * 获取所有地块
     */
    public getAllTiles(): MapTile[] {
        return Array.from(this._tileInstances.values());
    }
    
    /**
     * 清理资源
     */
    private cleanup(): void {
        // 清理缓存
        this._pathCache.clear();
        this._tileInstances.clear();
        this._tileNodes.clear();
        
        // 移除事件监听
        // if (this.node.isValid) {
        //     this.node.off(Node.EventType.MOUSE_DOWN, this.onMouseDown, this);
        //     this.node.off(Node.EventType.MOUSE_MOVE, this.onMouseMove, this);
        //     this.node.off(Node.EventType.MOUSE_UP, this.onMouseUp, this);
        //     this.node.off(Node.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
        // }

        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        
        console.log('[Map] 资源清理完成');
    }
    
    /**
     * 重新加载地图
     */
    public async reloadMap(): Promise<void> {
        this.cleanup();
        this._isInitialized = false;
        await this.initializeMap();
    }
}