/**
 * 地图编辑器管理器
 *
 * 协调和管理所有编辑器子模块
 * 提供统一的编辑器操作接口
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Node, Camera } from 'cc';
import { MapIdSystem, BuildingInfo } from './MapIdSystem';
import { MapSaveSystem } from './MapSaveSystem';
import { MapEditorGrid, GridConfig } from './MapEditorGrid';
import { MapTile } from '../core/MapTile';
import { MapObject } from '../core/MapObject';
import { MapSaveData } from '../data/MapDataTypes';
import { EventBus } from '../../events/EventBus';
import { EventTypes } from '../../events/EventTypes';

/**
 * 编辑器状态
 */
export enum EditorState {
    IDLE = 'idle',
    PLACING = 'placing',
    SELECTING = 'selecting',
    EDITING = 'editing'
}

/**
 * 地图编辑器管理器
 * 统一管理所有编辑器功能模块
 */
export class MapEditorManager {

    // 子模块
    private _idSystem: MapIdSystem;
    private _saveSystem: MapSaveSystem;
    private _gridSystem: MapEditorGrid;

    // 状态管理
    private _isActive: boolean = false;
    private _state: EditorState = EditorState.IDLE;

    // 数据引用
    private _parentNode: Node | null = null;
    private _mainCamera: Camera | null = null;
    private _mapId: string = '';
    private _mapName: string = '';

    constructor() {
        this._idSystem = new MapIdSystem();
        this._saveSystem = new MapSaveSystem();
        this._gridSystem = new MapEditorGrid();
    }

    /**
     * 初始化编辑器管理器
     */
    public initialize(
        parentNode: Node,
        mainCamera: Camera | null,
        mapId: string,
        mapName: string,
        tiles: MapTile[],
        tileIndex: Map<string, MapTile>,
        objects: MapObject[],
        buildingRegistry: Map<string, BuildingInfo>
    ): void {
        this._parentNode = parentNode;
        this._mainCamera = mainCamera;
        this._mapId = mapId;
        this._mapName = mapName;

        // 初始化各子模块
        this._idSystem.initialize(tiles, tileIndex, buildingRegistry, mainCamera);
        this._saveSystem.initialize(mapId, mapName, true, tiles, objects, buildingRegistry);
        this._gridSystem.initialize(parentNode, mainCamera);

        // 注册事件监听
        this.registerEventListeners();

        this._isActive = true;
        console.log('[MapEditorManager] Initialized');
    }

    /**
     * 创建编辑模式网格
     */
    public createEditGrid(config?: GridConfig): Node | null {
        return this._gridSystem.createEditModeGrid(config);
    }

    /**
     * 设置初始地图数据
     */
    public setMapSaveData(data: MapSaveData | null): void {
        this._saveSystem.setMapSaveData(data);
    }

    // ========================= ID系统接口 =========================

    /**
     * 分配所有ID
     */
    public assignIds(): void {
        if (!this._isActive) {
            console.warn('[MapEditorManager] Editor not active');
            return;
        }
        this._idSystem.assignIds();
    }

    /**
     * 显示ID标签
     */
    public showIds(): void {
        if (!this._isActive) {
            console.warn('[MapEditorManager] Editor not active');
            return;
        }
        this._idSystem.showIds();
    }

    /**
     * 隐藏ID标签
     */
    public hideIds(): void {
        this._idSystem.hideIds();
    }

    /**
     * 更新ID标签位置（每帧调用）
     */
    public updateIdLabels(deltaTime: number): void {
        if (this._isActive) {
            this._idSystem.updateIdLabels(deltaTime);
        }
    }

    // ========================= 存储系统接口 =========================

    /**
     * 调度自动保存
     */
    public scheduleAutoSave(): void {
        if (!this._isActive) return;
        this._saveSystem.scheduleAutoSave();
    }

    /**
     * 立即保存
     */
    public async saveImmediate(): Promise<boolean> {
        if (!this._isActive) {
            console.warn('[MapEditorManager] Editor not active');
            return false;
        }
        return await this._saveSystem.saveImmediate();
    }

    /**
     * 导出地图为JSON
     */
    public exportMapAsJSON(): void {
        if (!this._isActive) {
            console.warn('[MapEditorManager] Editor not active');
            return;
        }
        this._saveSystem.downloadMapAsJSON();
    }

    /**
     * 检查是否有未保存的修改
     */
    public hasUnsavedChanges(): boolean {
        return this._saveSystem.hasUnsavedChanges();
    }

    /**
     * 标记有修改
     */
    public markAsModified(): void {
        this._saveSystem.markAsModified();
        this._saveSystem.scheduleAutoSave();
    }

    // ========================= 网格系统接口 =========================

    /**
     * 设置网格可见性
     */
    public setGridVisibility(visible: boolean): void {
        this._gridSystem.setGridVisibility(visible);
    }

    /**
     * 更新网格大小
     */
    public updateGridSize(halfSize: number): void {
        this._gridSystem.updateGridSize(halfSize);
    }

    /**
     * 配置网格吸附
     */
    public configureGridSnapping(enabled: boolean, snapSize?: number): void {
        this._gridSystem.configureGridSnapping(enabled, snapSize);
    }

    // ========================= 状态管理 =========================

    /**
     * 获取当前编辑器状态
     */
    public getState(): EditorState {
        return this._state;
    }

    /**
     * 设置编辑器状态
     */
    public setState(state: EditorState): void {
        const oldState = this._state;
        this._state = state;

        // 发送状态改变事件
        EventBus.emit(EventTypes.Editor.StateChanged, {
            oldState,
            newState: state
        });

        console.log(`[MapEditorManager] State changed: ${oldState} -> ${state}`);
    }

    /**
     * 是否处于活动状态
     */
    public isActive(): boolean {
        return this._isActive;
    }

    /**
     * 激活编辑器
     */
    public activate(): void {
        this._isActive = true;
        this._state = EditorState.IDLE;
        console.log('[MapEditorManager] Activated');
    }

    /**
     * 停用编辑器
     */
    public deactivate(): void {
        // 保存未保存的修改
        if (this.hasUnsavedChanges()) {
            this.saveImmediate();
        }

        // 隐藏ID标签
        this.hideIds();

        // 隐藏网格
        this.setGridVisibility(false);

        this._isActive = false;
        this._state = EditorState.IDLE;
        console.log('[MapEditorManager] Deactivated');
    }

    // ========================= 事件处理 =========================

    /**
     * 注册事件监听器
     */
    private registerEventListeners(): void {
        // 监听编辑器相关事件
        EventBus.on(EventTypes.Editor.AssignIds, this.onAssignIdsRequest, this);
        EventBus.on(EventTypes.Editor.ShowIds, this.onShowIdsRequest, this);
        EventBus.on(EventTypes.Editor.HideIds, this.onHideIdsRequest, this);
        EventBus.on(EventTypes.Editor.Save, this.onSaveRequest, this);
        EventBus.on(EventTypes.Editor.Export, this.onExportRequest, this);
    }

    /**
     * 取消事件监听
     */
    private unregisterEventListeners(): void {
        EventBus.off(EventTypes.Editor.AssignIds, this.onAssignIdsRequest, this);
        EventBus.off(EventTypes.Editor.ShowIds, this.onShowIdsRequest, this);
        EventBus.off(EventTypes.Editor.HideIds, this.onHideIdsRequest, this);
        EventBus.off(EventTypes.Editor.Save, this.onSaveRequest, this);
        EventBus.off(EventTypes.Editor.Export, this.onExportRequest, this);
    }

    private onAssignIdsRequest(): void {
        this.assignIds();
    }

    private onShowIdsRequest(): void {
        this.showIds();
    }

    private onHideIdsRequest(): void {
        this.hideIds();
    }

    private async onSaveRequest(): Promise<void> {
        await this.saveImmediate();
    }

    private onExportRequest(): void {
        this.exportMapAsJSON();
    }

    // ========================= 清理 =========================

    /**
     * 清理资源
     */
    public cleanup(): void {
        // 停用编辑器
        if (this._isActive) {
            this.deactivate();
        }

        // 取消事件监听
        this.unregisterEventListeners();

        // 清理各子模块
        this._idSystem.cleanup();
        this._saveSystem.cleanup();
        this._gridSystem.cleanup();

        // 清理引用
        this._parentNode = null;
        this._mainCamera = null;

        console.log('[MapEditorManager] Cleanup completed');
    }
}