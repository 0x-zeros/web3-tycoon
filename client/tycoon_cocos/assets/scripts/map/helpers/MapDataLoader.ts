/**
 * 地图数据加载器
 *
 * 负责地图数据的加载、保存和清理
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { resources, JsonAsset, sys, Vec2 } from 'cc';
import { MapSaveData, MapLoadOptions, TileData, ObjectData, BuildingData } from '../data/MapDataTypes';
import { TilePlacementHelper } from './TilePlacementHelper';
import { BuildingManager } from './BuildingManager';
import { ObjectPlacementHelper } from './ObjectPlacementHelper';
import { getWeb3BlockByBlockId } from '../../voxel/Web3BlockTypes';

/**
 * 地图数据加载器
 * 管理地图数据的加载、保存和序列化
 */
export class MapDataLoader {

    private readonly MAP_DATA_DIR = 'data/maps/';
    private _currentMapData: MapSaveData | null = null;

    // 辅助模块引用
    private _tileHelper: TilePlacementHelper | null = null;
    private _buildingManager: BuildingManager | null = null;
    private _objectHelper: ObjectPlacementHelper | null = null;

    /**
     * 初始化加载器
     */
    public initialize(
        tileHelper: TilePlacementHelper,
        buildingManager: BuildingManager,
        objectHelper: ObjectPlacementHelper
    ): void {
        this._tileHelper = tileHelper;
        this._buildingManager = buildingManager;
        this._objectHelper = objectHelper;
    }

    /**
     * 加载地图
     * @param mapId 地图ID
     * @param options 加载选项
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
                    console.log(`[MapDataLoader] Map loaded from localStorage: ${saveKey}`);
                }
            }

            // 如果本地没有，尝试从资源加载
            if (!mapData) {
                const resourcePath = `${this.MAP_DATA_DIR}${mapId}`;
                try {
                    mapData = await this.loadFromResource(resourcePath);
                    console.log(`[MapDataLoader] Map loaded from resource: ${resourcePath}`);
                } catch (err) {
                    console.error(`[MapDataLoader] Failed to load map from resource: ${resourcePath}`, err);
                }
            }

            // 如果还是没有数据，返回失败
            if (!mapData) {
                console.error(`[MapDataLoader] No map data found for: ${mapId}`);
                return false;
            }

            // 清空现有地图
            await this.clearMap();

            // 应用地图数据
            await this.applyMapData(mapData);

            // 保存当前地图数据
            this._currentMapData = mapData;

            console.log(`[MapDataLoader] Map loaded successfully: ${mapId}`);
            console.log(`[MapDataLoader] Statistics:`, {
                tiles: mapData.tiles?.length || 0,
                objects: mapData.objects?.length || 0,
                buildings: mapData.buildings?.length || 0
            });

            return true;

        } catch (error) {
            console.error('[MapDataLoader] Failed to load map:', error);
            return false;
        }
    }

    /**
     * 从资源加载地图数据
     */
    private async loadFromResource(resourcePath: string): Promise<MapSaveData | null> {
        return new Promise<MapSaveData | null>((resolve, reject) => {
            resources.load(resourcePath, JsonAsset, (err, asset) => {
                if (err) {
                    reject(err);
                    return;
                }

                try {
                    const mapData = (asset as any).json as MapSaveData;
                    resolve(mapData);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * 应用地图数据
     */
    private async applyMapData(mapData: MapSaveData): Promise<void> {
        // 加载地块
        if (mapData.tiles && mapData.tiles.length > 0) {
            console.log(`[MapDataLoader] Loading ${mapData.tiles.length} tiles...`);
            for (const tileData of mapData.tiles) {
                const gridPos = new Vec2(tileData.position.x, tileData.position.z);
                await this._tileHelper?.placeTileAt(tileData.blockId, gridPos);

                // 恢复tile ID（从data字段中读取）
                const tile = this._tileHelper?.getTileAt(tileData.position.x, tileData.position.z);
                if (tile && tileData.data?.tileId !== undefined) {
                    tile.setTileId(tileData.data.tileId);
                }
            }
        }

        // 加载物体
        if (mapData.objects && mapData.objects.length > 0) {
            console.log(`[MapDataLoader] Loading ${mapData.objects.length} objects...`);
            for (const objectData of mapData.objects) {
                const gridPos = new Vec2(objectData.position.x, objectData.position.z);
                await this._objectHelper?.placeObjectAt(objectData.blockId, gridPos);
            }
        }

        // 加载建筑
        if (mapData.buildings && mapData.buildings.length > 0) {
            console.log(`[MapDataLoader] Loading ${mapData.buildings.length} buildings...`);
            for (const buildingData of mapData.buildings) {
                const gridPos = new Vec2(buildingData.position.x, buildingData.position.z);

                // 直接传入完整的建筑数据，包括direction
                await this._buildingManager?.placeBuildingAt(
                    buildingData.blockId,
                    gridPos,
                    buildingData.size,
                    buildingData.direction,
                    {
                        buildingId: buildingData.buildingId,
                        owner: buildingData.owner,
                        level: buildingData.level,
                        price: buildingData.price,
                        rent: buildingData.rent,
                        mortgaged: buildingData.mortgaged
                    }
                );
            }
        }
    }

    /**
     * 保存地图（基础版本）
     */
    public saveMap(mapId: string): MapSaveData | null {
        try {
            const mapData = this.collectMapData(mapId);

            // 保存到localStorage（Web平台）
            if (sys.isBrowser) {
                const saveKey = `map_${mapId}`;
                const jsonStr = JSON.stringify(mapData, null, 2);
                localStorage.setItem(saveKey, jsonStr);
                console.log(`[MapDataLoader] Map saved to localStorage: ${saveKey}`);
            }

            // 更新当前地图数据
            this._currentMapData = mapData;

            return mapData;

        } catch (error) {
            console.error('[MapDataLoader] Failed to save map:', error);
            return null;
        }
    }

    /**
     * 收集当前地图数据
     */
    private collectMapData(mapId: string): MapSaveData {
        // 收集地块数据
        const tilesData: TileData[] = [];
        const tiles = this._tileHelper?.getAllTiles() || [];
        for (const tile of tiles) {
            tilesData.push(tile.getData());
        }

        // 收集物体数据
        const objectsData: ObjectData[] = [];
        const objects = this._objectHelper?.getAllObjects() || [];
        for (const obj of objects) {
            objectsData.push(obj.getData());
        }

        // 收集建筑数据
        const buildingsData: BuildingData[] = [];
        const buildingRegistry = this._buildingManager?.getBuildingRegistry();
        if (buildingRegistry) {
            buildingRegistry.forEach((info) => {
                const buildingTypeId = getWeb3BlockByBlockId(info.blockId)?.typeId || 0;
                buildingsData.push({
                    blockId: info.blockId,
                    typeId: buildingTypeId,
                    size: info.size,
                    position: info.position,
                    direction: info.direction,
                    buildingId: info.buildingId,
                    owner: info.owner,
                    level: info.level,
                    price: info.price,
                    rent: info.rent,
                    mortgaged: info.mortgaged
                } as BuildingData);
            });
        }

        // 构建保存数据
        const saveData: MapSaveData = {
            mapId: mapId,
            mapName: `Map ${mapId}`,
            version: '1.0.0',
            createTime: this._currentMapData?.createTime || Date.now(),
            updateTime: Date.now(),
            gameMode: 'play',
            tiles: tilesData,
            objects: objectsData,
            buildings: buildingsData.length > 0 ? buildingsData : undefined
        };

        return saveData;
    }

    /**
     * 清空地图
     */
    public async clearMap(): Promise<void> {
        console.log('[MapDataLoader] Clearing map...');

        // 清空地块
        this._tileHelper?.clearAllTiles();

        // 清空物体
        this._objectHelper?.clearAllObjects();

        // 清空建筑（需要先清理建筑再清理占位tile）
        const buildingRegistry = this._buildingManager?.getBuildingRegistry();
        if (buildingRegistry) {
            const positions: Vec2[] = [];
            buildingRegistry.forEach((info) => {
                positions.push(new Vec2(info.position.x, info.position.z));
            });

            for (const pos of positions) {
                this._buildingManager?.removeBuilding(pos);
            }
        }

        // 清空当前地图数据
        this._currentMapData = null;

        console.log('[MapDataLoader] Map cleared');
    }

    /**
     * 获取当前地图数据
     */
    public getCurrentMapData(): MapSaveData | null {
        return this._currentMapData;
    }

    /**
     * 导出地图为JSON字符串
     */
    public exportToJSON(mapId: string, pretty: boolean = true): string {
        const mapData = this.collectMapData(mapId);
        return JSON.stringify(mapData, null, pretty ? 2 : 0);
    }

    /**
     * 从JSON字符串导入地图
     */
    public async importFromJSON(jsonStr: string): Promise<boolean> {
        try {
            const mapData = JSON.parse(jsonStr) as MapSaveData;
            await this.clearMap();
            await this.applyMapData(mapData);
            this._currentMapData = mapData;
            return true;
        } catch (error) {
            console.error('[MapDataLoader] Failed to import from JSON:', error);
            return false;
        }
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        this._currentMapData = null;
        this._tileHelper = null;
        this._buildingManager = null;
        this._objectHelper = null;
    }
}