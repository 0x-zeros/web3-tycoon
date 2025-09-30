/**
 * 地图存储系统
 *
 * 负责地图的保存、加载、自动保存和导出功能
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { sys } from 'cc';
import { MapTile } from '../core/MapTile';
import { MapObject } from '../core/MapObject';
import { MapSaveData, MapSaveOptions, TileData, ObjectData, BuildingData } from '../data/MapDataTypes';
import { getWeb3BlockByBlockId } from '../../voxel/Web3BlockTypes';
import { BuildingInfo } from './MapIdSystem';

/**
 * 地图存储系统
 * 管理地图的保存、自动保存和导出功能
 */
export class MapSaveSystem {

    // 自动保存相关
    private readonly AUTO_SAVE_DELAY = 1000;  // 自动保存延迟（毫秒）
    private _autoSaveTimer: any = null;
    private _hasUnsavedChanges: boolean = false;

    // 地图数据
    private _mapId: string = '';
    private _mapName: string = '';
    private _mapSaveData: MapSaveData | null = null;
    private _isEditMode: boolean = false;

    // 数据引用
    private _tiles: MapTile[] = [];
    private _objects: MapObject[] = [];
    private _buildingRegistry: Map<string, BuildingInfo> = new Map();

    /**
     * 初始化存储系统
     */
    public initialize(
        mapId: string,
        mapName: string,
        isEditMode: boolean,
        tiles: MapTile[],
        objects: MapObject[],
        buildingRegistry: Map<string, BuildingInfo>
    ): void {
        this._mapId = mapId;
        this._mapName = mapName;
        this._isEditMode = isEditMode;
        this._tiles = tiles;
        this._objects = objects;
        this._buildingRegistry = buildingRegistry;
    }

    /**
     * 设置地图保存数据
     */
    public setMapSaveData(data: MapSaveData | null): void {
        this._mapSaveData = data;
    }

    /**
     * 调度自动保存
     * 使用防抖策略，避免频繁保存
     */
    public scheduleAutoSave(): void {
        if (!this._isEditMode) return;

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

        console.log('[MapSaveSystem] Auto-saving map...');

        const success = await this.saveMap({
            compress: false,
            includeGameRules: true
        });

        if (success) {
            this._hasUnsavedChanges = false;
            console.log('[MapSaveSystem] Auto-save completed');
            console.log(`[MapSaveSystem] Saved to: map_${this._mapId}`);
        } else {
            console.error('[MapSaveSystem] Auto-save failed');
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

    /**
     * 保存地图
     */
    public async saveMap(options?: MapSaveOptions): Promise<boolean> {
        try {
            // 收集地图数据
            const saveData = this.collectMapData(options);

            // 保存到本地存储（Web平台）或文件系统（原生平台）
            const saveKey = `map_${this._mapId}`;
            const jsonStr = JSON.stringify(saveData, null, options?.compress ? 0 : 2);

            if (sys.isBrowser) {
                // Web平台：保存到localStorage
                localStorage.setItem(saveKey, jsonStr);
                console.log(`[MapSaveSystem] Map saved to localStorage: ${saveKey}`);
            } else {
                // 原生平台：保存到文件
                // TODO: 实现文件保存
                console.log(`[MapSaveSystem] Map save to file not implemented yet`);
            }

            // 更新内部数据
            this._mapSaveData = saveData;

            // 输出保存信息
            const saveInfo = {
                mapId: this._mapId,
                tiles: saveData.tiles.length,
                objects: saveData.objects.length,
                buildings: saveData.buildings?.length || 0,
                storage: sys.isBrowser ? 'localStorage' : 'file',
                key: saveKey,
                size: `${(jsonStr.length / 1024).toFixed(2)} KB`
            };
            console.log('[MapSaveSystem] Map saved successfully:', saveInfo);

            return true;

        } catch (error) {
            console.error('[MapSaveSystem] Failed to save map:', error);
            return false;
        }
    }

    /**
     * 收集地图数据
     */
    private collectMapData(options?: MapSaveOptions): MapSaveData {
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
                owner: info.owner,
                level: info.level,
                price: info.price,
                rent: info.rent,
                mortgaged: info.mortgaged
            } as BuildingData);
        });

        // 构建保存数据
        const saveData: MapSaveData = {
            mapId: this._mapId,
            mapName: this._mapName,
            version: '1.0.0',
            createTime: this._mapSaveData?.createTime || Date.now(),
            updateTime: Date.now(),
            gameMode: this._isEditMode ? 'edit' : 'play',
            tiles: tilesData,
            objects: objectsData,
            buildings: buildingsData.length > 0 ? buildingsData : undefined
        };

        // 添加游戏规则（如果需要）
        if (options?.includeGameRules) {
            saveData.gameRules = {
                startingMoney: 10000,
                passingBonus: 200,
                landingBonus: 400,
                maxPlayers: 4,
                minPlayers: 2
            };
        }

        return saveData;
    }

    /**
     * 导出地图为JSON文件（用于下载）
     */
    public downloadMapAsJSON(): void {
        try {
            const saveData = this.collectMapData({ compress: false, includeGameRules: true });
            const jsonStr = JSON.stringify(saveData, null, 2);

            if (sys.isBrowser) {
                // 创建Blob对象
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);

                // 创建下载链接
                const link = document.createElement('a');
                link.href = url;
                link.download = `${this._mapId}_${Date.now()}.json`;

                // 触发下载
                document.body.appendChild(link);
                link.click();

                // 清理
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 0);

                console.log(`[MapSaveSystem] Map exported as ${link.download}`);
            } else {
                console.warn('[MapSaveSystem] Download is only supported in web platform');
            }
        } catch (error) {
            console.error('[MapSaveSystem] Failed to export map:', error);
        }
    }

    /**
     * 检查是否有未保存的修改
     */
    public hasUnsavedChanges(): boolean {
        return this._hasUnsavedChanges;
    }

    /**
     * 标记有修改
     */
    public markAsModified(): void {
        this._hasUnsavedChanges = true;
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        // 保存未保存的修改
        if (this._isEditMode && this._hasUnsavedChanges) {
            console.log('[MapSaveSystem] Saving unsaved changes before cleanup...');
            this.saveImmediate();
        }

        // 清除自动保存定时器
        if (this._autoSaveTimer) {
            clearTimeout(this._autoSaveTimer);
            this._autoSaveTimer = null;
        }

        // 清理引用
        this._tiles = [];
        this._objects = [];
        this._buildingRegistry.clear();
        this._mapSaveData = null;
    }
}