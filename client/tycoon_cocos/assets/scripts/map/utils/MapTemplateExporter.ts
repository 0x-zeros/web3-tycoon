/**
 * 地图模板导出工具
 * 将 GameMap 编辑器数据转换为链上 MapTemplate 格式
 */

import type { MapTemplate, TileStatic, BuildingStatic } from '../../sui/types/map';
import { TileKind, INVALID_TILE_ID, NO_BUILDING } from '../../sui/types/constants';
import type { GameMap } from '../core/GameMap';
import type { MapTile } from '../core/MapTile';
import type { MapBuilding } from '../core/MapBuilding';

/**
 * 从 GameMap 导出为 MapTemplate
 * @param gameMap 游戏地图实例
 * @param templateId 模板ID（0表示临时，上传时会指定）
 * @returns MapTemplate 数据
 */
export function exportGameMapToMapTemplate(gameMap: GameMap, templateId: number = 0): MapTemplate {
    console.log('[MapExporter] Exporting GameMap to MapTemplate...');

    // 1. 收集所有 Tiles
    const tilesMap = new Map<number, TileStatic>();
    const tilesContainer = gameMap['_tilesContainer'];  // 访问私有字段

    if (!tilesContainer) {
        throw new Error('TilesContainer not found in GameMap');
    }

    tilesContainer.children.forEach(node => {
        const tile = node.getComponent('MapTile') as MapTile;
        if (!tile) return;

        const tileId = tile.getTileId();
        if (tileId === INVALID_TILE_ID) {
            console.warn(`[MapExporter] Skipping tile without ID at ${node.name}`);
            return;
        }

        const gridPos = tile.getGridPosition();

        tilesMap.set(tileId, {
            x: gridPos.x,
            y: gridPos.y,
            kind: tile.getTypeId(),
            building_id: tile.getBuildingId(),
            special: BigInt(0),  // 根据 tile 类型设置（如 BONUS/FEE 金额）
            w: tile.getW(),
            n: tile.getN(),
            e: tile.getE(),
            s: tile.getS()
        });
    });

    console.log(`[MapExporter] Collected ${tilesMap.size} tiles`);

    // 2. 收集所有 Buildings
    const buildingsMap = new Map<number, BuildingStatic>();
    const buildingRegistry = gameMap['_buildingRegistry'];  // Map<string, BuildingInfo>

    if (buildingRegistry) {
        buildingRegistry.forEach((info, key) => {
            // key 格式可能是 "B_1x1_5_3" 或其他
            // 需要从 BuildingInfo 中提取 buildingId
            const buildingId = info.buildingId || parseInt(key.split('_')[1]);

            buildingsMap.set(buildingId, {
                size: info.size === '1x1' ? 1 : 2,
                price: BigInt(info.price || 1000),       // 默认价格或从 info 获取
                base_toll: BigInt(info.baseToll || 100)  // 默认租金或从 info 获取
            });
        });
    }

    console.log(`[MapExporter] Collected ${buildingsMap.size} buildings`);

    // 3. 收集 Hospital IDs（从 tiles 中筛选）
    const hospitalIds: number[] = [];
    tilesMap.forEach((tile, tileId) => {
        if (tile.kind === TileKind.HOSPITAL) {
            hospitalIds.push(tileId);
        }
    });

    console.log(`[MapExporter] Found ${hospitalIds.length} hospitals`);

    // 4. 验证数据完整性
    validateMapTemplate(tilesMap, buildingsMap);

    // 5. 构建 MapTemplate
    const mapTemplate: MapTemplate = {
        id: templateId,
        tiles_static: tilesMap,
        buildings_static: buildingsMap,
        hospital_ids: hospitalIds
    };

    console.log('[MapExporter] Export complete');
    return mapTemplate;
}

/**
 * 验证地图数据完整性
 */
function validateMapTemplate(
    tilesMap: Map<number, TileStatic>,
    buildingsMap: Map<number, BuildingStatic>
): void {
    // 1. 检查 tiles 是否连续（从0开始）
    const tileIds = Array.from(tilesMap.keys()).sort((a, b) => a - b);
    if (tileIds.length === 0) {
        throw new Error('Map must have at least one tile');
    }

    if (tileIds[0] !== 0) {
        throw new Error(`Tiles must start from ID 0, but found ${tileIds[0]}`);
    }

    for (let i = 0; i < tileIds.length; i++) {
        if (tileIds[i] !== i) {
            throw new Error(
                `Tiles must be sequential from 0. ` +
                `Missing tile at index ${i}.`
            );
        }
    }

    // 2. 检查 buildings 是否连续（如果有的话）
    if (buildingsMap.size > 0) {
        const buildingIds = Array.from(buildingsMap.keys()).sort((a, b) => a - b);

        if (buildingIds[0] !== 0) {
            throw new Error(`Buildings must start from ID 0, but found ${buildingIds[0]}`);
        }

        for (let i = 0; i < buildingIds.length; i++) {
            if (buildingIds[i] !== i) {
                throw new Error(
                    `Buildings must be sequential from 0. ` +
                    `Missing building at index ${i}.`
                );
            }
        }
    }

    // 3. 检查 building_id 引用的有效性
    tilesMap.forEach((tile, tileId) => {
        if (tile.building_id !== NO_BUILDING) {
            if (!buildingsMap.has(tile.building_id)) {
                throw new Error(
                    `Tile ${tileId} references non-existent building ${tile.building_id}`
                );
            }
        }
    });

    // 4. 检查邻居引用的有效性
    tilesMap.forEach((tile, tileId) => {
        const neighbors = [tile.w, tile.n, tile.e, tile.s];
        neighbors.forEach((neighborId, index) => {
            if (neighborId !== INVALID_TILE_ID && !tilesMap.has(neighborId)) {
                const dirs = ['w', 'n', 'e', 's'];
                throw new Error(
                    `Tile ${tileId}.${dirs[index]} references non-existent tile ${neighborId}`
                );
            }
        });
    });

    console.log('[MapExporter] Validation passed ✓');
}
