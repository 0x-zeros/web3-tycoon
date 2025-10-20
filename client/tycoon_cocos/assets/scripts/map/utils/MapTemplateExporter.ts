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
    DEFAULT_HOSPITAL_TURNS
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
export function exportGameMapToMapTemplate(gameMap: GameMap, templateId: string = '0'): MapTemplate {
    console.log('[MapExporter] Exporting GameMap to MapTemplate...');

    // ===== 前置条件检查 =====
    checkPrerequisites(gameMap);

    // 1. 收集所有 Tiles
    const tilesMap = new Map<number, TileStatic>();
    const tiles = gameMap.getTiles();  // 使用公共 getter

    tiles.forEach(tile => {
        const tileId = tile.getTileId();
        if (tileId === INVALID_TILE_ID) {
            console.warn(`[MapExporter] Skipping tile without ID`);
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
    const buildingRegistry = gameMap.getBuildingRegistry();  // 使用公共 getter

    if (buildingRegistry) {
        buildingRegistry.forEach((info, key) => {
            // buildingId 必须存在（assignIds 应已分配）
            if (info.buildingId === undefined) {
                throw new Error(
                    `❌ Building at (${info.position.x}, ${info.position.z}) missing buildingId!\n\n` +
                    '请先点击 "分配编号" 按钮（或内部会自动调用）。'
                );
            }
            const buildingId = info.buildingId;

            // size 直接使用（已是数字类型 1 | 2）
            const size = info.size;

            buildingsMap.set(buildingId, {
                x: info.position.x,
                y: info.position.z,  // Cocos z 对应 Move y
                size,
                price: info.price ?? getDefaultBuildingPrice(size),
                chain_prev_id: info.chainPrevId ?? NO_BUILDING,
                chain_next_id: info.chainNextId ?? NO_BUILDING
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
 * 信任 calculateBuildingEntrances() 已完成所有计算和验证
 * 这里只做最小的结果检查
 */
function checkPrerequisites(gameMap: GameMap): void {
    // 1. 检查是否有tiles
    const tiles = gameMap.getTiles();
    if (!tiles || tiles.length === 0) {
        throw new Error('❌ 地图没有tiles！请先放置地块。');
    }

    // 2. 检查tiles已编号（抽查第一个）
    const firstTile = tiles[0];
    if (!firstTile || firstTile.getTileId() === INVALID_TILE_ID) {
        throw new Error(
            '❌ Tiles尚未编号！\n\n' +
            '导出前应先调用 calculateBuildingEntrances()，\n' +
            '该函数会自动执行所有必要的计算和验证。'
        );
    }

    // 3. 检查buildings已编号且有入口关联
    const buildingRegistry = gameMap.getBuildingRegistry();
    const buildings = Array.from(buildingRegistry.values());
    for (const building of buildings) {
        if (building.buildingId === undefined) {
            throw new Error('❌ Building未编号！请先执行计算流程。');
        }
        if (!building.entranceTileIds || building.entranceTileIds.length === 0) {
            throw new Error(`❌ Building #${building.buildingId} 未关联入口tiles！`);
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
