/**
 * 地图模板导出工具
 * 将 GameMap 编辑器数据转换为链上 MapTemplate 格式
 *
 * ⚠️ 前置条件：
 * 1. 必须先调用 gameMap.assignIds() - 分配编号和计算邻居
 * 2. 必须先调用 gameMap.calculateBuildingEntrances() - 验证建筑入口
 */

import type { MapTemplate, TileStatic, BuildingStatic } from '../../sui/types/map';
import {
    TileKind,
    INVALID_TILE_ID,
    NO_BUILDING,
    DEFAULT_BUILDING_PRICE_1X1,
    DEFAULT_BUILDING_PRICE_2X2,
    DEFAULT_TILE_BONUS_AMOUNT,
    DEFAULT_TILE_FEE_AMOUNT,
    DEFAULT_HOSPITAL_TURNS,
    DEFAULT_PRISON_TURNS
} from '../../sui/types/constants';
import type { GameMap } from '../core/GameMap';
import type { MapTile } from '../core/MapTile';
import type { MapBuilding } from '../core/MapBuilding';

/**
 * 从 GameMap 导出为 MapTemplate
 *
 * ⚠️ 此函数假设以下操作已完成：
 * - gameMap.assignIds() 已执行（编号和邻居已计算）
 * - gameMap.calculateBuildingEntrances() 已执行且返回true（验证通过）
 *
 * @param gameMap 游戏地图实例
 * @param templateId 模板ID（0表示临时，上传时会指定）
 * @returns MapTemplate 数据
 * @throws 如果前置条件未满足
 */
export function exportGameMapToMapTemplate(gameMap: GameMap, templateId: number = 0): MapTemplate {
    console.log('[MapExporter] Exporting GameMap to MapTemplate...');

    // ===== 前置条件检查 =====
    checkPrerequisites(gameMap);

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

        const tileKind = tile.getTypeId();

        tilesMap.set(tileId, {
            x: gridPos.x,
            y: gridPos.y,
            kind: tileKind,
            building_id: tile.getBuildingId(),
            special: tile.getSpecial?.() ?? getDefaultTileSpecial(tileKind),  // 编辑器值优先，否则用默认
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
            const size = info.size === '1x1' ? 1 : 2;

            buildingsMap.set(buildingId, {
                size,
                price: info.price ?? getDefaultBuildingPrice(size as 1 | 2)  // 编辑器值优先，否则用默认
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

    // 4. 最小验证（防御性检查）
    validateExportedData(tilesMap, buildingsMap);

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
 * 前置条件检查
 * 确保 GameMap 已完成编号和验证
 */
function checkPrerequisites(gameMap: GameMap): void {
    // 1. 检查是否有tiles
    const tilesContainer = gameMap['_tilesContainer'];
    if (!tilesContainer || tilesContainer.children.length === 0) {
        throw new Error(
            '❌ 地图没有tiles！\n' +
            '请先放置地块。'
        );
    }

    // 2. 检查tiles是否已编号
    let hasNumberedTile = false;
    for (const node of tilesContainer.children) {
        const tile = node.getComponent('MapTile') as MapTile;
        if (tile && tile.getTileId() !== INVALID_TILE_ID) {
            hasNumberedTile = true;
            break;
        }
    }

    if (!hasNumberedTile) {
        throw new Error(
            '❌ Tiles尚未编号！\n\n' +
            '请先点击 "分配编号" 按钮。\n' +
            '该按钮会：\n' +
            '• DFS算法分配tile编号\n' +
            '• 分配building编号\n' +
            '• 计算邻居关系（w/n/e/s）\n' +
            '• 验证邻居一致性'
        );
    }

    // 3. 检查buildings是否已关联入口tiles
    const buildings = Array.from(gameMap['_buildingRegistry'].values());
    for (const building of buildings) {
        if (!building.entranceTileIds || building.entranceTileIds.length === 0) {
            throw new Error(
                `❌ Building #${building.buildingId} 尚未关联入口tiles！\n\n` +
                '请先点击 "计算建筑入口" 按钮。\n' +
                '该按钮会：\n' +
                '• 验证建筑周围的空地tile\n' +
                '• 建立building↔tile双向关联\n' +
                '• 检查入口数量和类型'
            );
        }

        // 4. 验证入口tile数量
        const expectedCount = building.size === '1x1' ? 1 : 2;
        const actualCount = building.entranceTileIds.filter(id => id !== INVALID_TILE_ID).length;
        if (actualCount !== expectedCount) {
            throw new Error(
                `❌ Building #${building.buildingId} 入口数量错误！\n` +
                `期望 ${expectedCount} 个，实际 ${actualCount} 个。\n\n` +
                '请重新点击 "计算建筑入口" 按钮。'
            );
        }
    }

    console.log('[MapExporter] ✓ Prerequisites check passed');
}

/**
 * 最小验证（防御性检查）
 * GameMap 已经做了完整验证，这里只做基本检查
 */
function validateExportedData(
    tilesMap: Map<number, TileStatic>,
    buildingsMap: Map<number, BuildingStatic>
): void {
    // 基本检查：数据不为空
    if (tilesMap.size === 0) {
        throw new Error('Exported map has no tiles');
    }

    // 检查ID连续性（GameMap.assignIds已保证，但再次确认）
    const tileIds = Array.from(tilesMap.keys()).sort((a, b) => a - b);
    for (let i = 0; i < tileIds.length; i++) {
        if (tileIds[i] !== i) {
            throw new Error(`Tile IDs not sequential at index ${i}`);
        }
    }

    if (buildingsMap.size > 0) {
        const buildingIds = Array.from(buildingsMap.keys()).sort((a, b) => a - b);
        for (let i = 0; i < buildingIds.length; i++) {
            if (buildingIds[i] !== i) {
                throw new Error(`Building IDs not sequential at index ${i}`);
            }
        }
    }

    console.log('[MapExporter] ✓ Exported data validation passed');
}

// ===== 默认值计算函数 =====

/**
 * 获取 tile.special 的默认值
 * 根据 tile 类型返回对应的默认数值
 * 编辑器可为每个tile单独设置，此函数提供默认值
 */
function getDefaultTileSpecial(tileKind: number): bigint {
    switch (tileKind) {
        case TileKind.BONUS:
            return DEFAULT_TILE_BONUS_AMOUNT;
        case TileKind.FEE:
            return DEFAULT_TILE_FEE_AMOUNT;
        case TileKind.HOSPITAL:
            return DEFAULT_HOSPITAL_TURNS;
        case TileKind.PRISON:
            return DEFAULT_PRISON_TURNS;
        default:
            return 0n;
    }
}

/**
 * 获取 building.price 的默认值
 * 根据建筑尺寸返回对应的默认价格
 * 编辑器可为每个building单独设置，此函数提供默认值
 */
function getDefaultBuildingPrice(size: 1 | 2): bigint {
    return size === 1 ? DEFAULT_BUILDING_PRICE_1X1 : DEFAULT_BUILDING_PRICE_2X2;
}

