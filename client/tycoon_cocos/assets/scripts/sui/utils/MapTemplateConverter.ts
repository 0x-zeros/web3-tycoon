/**
 * MapTemplate 数据转换工具
 * 将链上的 MapTemplate + Game 数据转换为客户端的 MapSaveData 格式
 * 用于从 Sui 链上数据重建 3D 游戏场景
 */

import type { MapTemplate, TileStatic, BuildingStatic } from '../types/map';
import type { MapSaveData, TileData, BuildingData } from '../../map/data/MapDataTypes';
import type { Game } from '../types/game';
import { TileKind, BuildingSize, NO_BUILDING, INVALID_TILE_ID } from '../types/constants';
import { Web3TileType, Web3BuildingType } from '../../voxel/Web3BlockTypes';
import { IdFormatter } from '../../ui/utils/IdFormatter';

/**
 * 根据建筑和入口tile的相对位置计算朝向
 *
 * Cocos坐标系：
 * - direction定义：0=南(+z), 1=东(+x), 2=北(-z), 3=西(-x)
 * - 左手坐标系，Y轴旋转CCW逆时针
 *
 * @param buildingPos Building的gridPos {x, y}
 * @param entranceTileId 第一个entrance tile的ID
 * @param template MapTemplate数据
 * @returns direction (0-3)，默认0（朝南）
 */
function calculateBuildingDirection(
    buildingPos: {x: number, y: number},
    entranceTileId: number,
    template: MapTemplate
): number {
    if (entranceTileId === 65535) return 0;

    const entranceTile = template.tiles_static.get(entranceTileId);
    if (!entranceTile) return 0;

    // 计算entrance相对building的方向
    const dx = entranceTile.x - buildingPos.x;
    const dz = entranceTile.y - buildingPos.y;

    // 根据相对位置判断朝向
    // 优先判断主方向（绝对值更大的轴）
    if (Math.abs(dz) > Math.abs(dx)) {
        return dz > 0 ? 0 : 2;  // 南(+z) 或 北(-z)
    } else {
        return dx > 0 ? 1 : 3;  // 东(+x) 或 西(-x)
    }
}

/**
 * 将 Move MapTemplate + Game 数据转换为 MapSaveData
 *
 * @param template 链上 MapTemplate 数据
 * @param game 链上 Game 数据（包含动态状态：owner, level等）
 * @param mapId 地图ID（客户端使用）
 * @returns MapSaveData 格式，可直接用于 GameMap.loadMap()
 */
export function convertMapTemplateToSaveData(
    template: MapTemplate,
    game: Game,
    mapId: string
): MapSaveData {
    const tiles: TileData[] = [];
    const buildings: BuildingData[] = [];

    console.log('[MapTemplateConverter] Converting template to save data');
    console.log('  Template tiles:', template.tiles_static.size, template.tiles_static);
    console.log('  Template buildings:', template.buildings_static.size, template.buildings_static);
    console.log('  Game buildings:', game.buildings.length, game.buildings);

    // 1. 转换 Tiles
    template.tiles_static.forEach((tileStatic, tileId) => {
        tiles.push({
            blockId: getTileBlockId(tileStatic.kind),
            typeId: getTileTypeId(tileStatic.kind),

            position: {
                x: tileStatic.x,
                z: tileStatic.y  // 注意：Move 的 y 对应 Cocos 的 z
            },
            data: {
                tileId: tileId,
                buildingId: tileStatic.building_id,
                special: Number(tileStatic.special),  // bigint → number
                w: tileStatic.w,
                n: tileStatic.n,
                e: tileStatic.e,
                s: tileStatic.s
            }
        });
    });

    // 2. 转换 Buildings
    template.buildings_static.forEach((buildingStatic, buildingId) => {

        //直接从move里获取的值
        const size = buildingStatic.size as (1 | 2); // TypeScript类型窄化
        const price = buildingStatic.price;
        const chainPrevId = buildingStatic.chain_prev_id;
        const chainNextId = buildingStatic.chain_next_id;

        //其他需要根据move里的值计算的值

        // 找到该 building 的入口 tiles
        const entranceTiles: number[] = [];
        template.tiles_static.forEach((tile, tileId) => {
            if (tile.building_id === buildingId) {
                entranceTiles.push(tileId);
            }
        });


        let entranceTileIds: number[] = entranceTiles; // 最多2个入口
        if (entranceTiles.length === 0) {
            entranceTileIds = [65535, 65535];
            console.warn(`[Converter] Building ${buildingId} has no entrance tiles`);
        }
        else if (entranceTiles.length === 1) {
            entranceTileIds.push(65535);
        }
        else if (entranceTiles.length > 2) {
            entranceTileIds = entranceTiles.slice(0, 2); // 最多2个入口
            console.warn(`[Converter] Building ${buildingId} has more than 2 entrance tiles`);
        }


        // 使用 BuildingStatic 中的坐标（已在Move端添加）
        const gridPos = {x: buildingStatic.x, y: buildingStatic.y};

        // 从 Game.buildings 获取动态数据（owner, level, building_type）
        const gameBuildingData = game.buildings[buildingId];
        if (!gameBuildingData) {
            console.warn(`[Converter] Building ${buildingId} not found in Game.buildings.`);
        }

        buildings.push({
            blockId: getBuildingBlockId(buildingStatic.size, gameBuildingData?.building_type),
            typeId: getBuildingTypeId(buildingStatic.size),
            size: size,
            position: {
                x: gridPos.x,
                z: gridPos.y
            },
            direction: calculateBuildingDirection(gridPos, entranceTileIds[0], template),
            buildingId: buildingId,
            entranceTileIds: entranceTileIds as [number, number],
            // chainPrevId/chainNextId 在 BuildingData 中不存在，存储在 BuildingInfo 中
            owner: gameBuildingData?.owner,
            level: gameBuildingData?.level,
            price: Number(price)  // BigInt → number
        });
    });

    console.log('[MapTemplateConverter] Conversion completed');
    console.log('  Tiles:', tiles.length);
    console.log('  Buildings:', buildings.length);

    const result = {
        // ✅ MapMetadata 必须字段
        mapId,
        mapName: `Chain Game ${IdFormatter.shortenAddress(game.id)}`,
        version: '1.0.0',
        createTime: Date.now(),
        updateTime: Date.now(),

        // MapSaveData 字段
        gameMode: 'play' as 'play',  // 游戏模式（非编辑）
        tiles,
        objects: [],  // 游戏中不使用旧的 objects 系统
        buildings,
        npcs: [],  // NPC 数据需要从 Game events 或额外查询获取
        decorations: []  // 装饰物暂不支持
    };

    // ✅ 打印完整的 MapSaveData 对象（不 stringify）
    console.log('='.repeat(80));
    console.log('[MapTemplateConverter] 转换后的 MapSaveData 对象（用于对比 publish 前）：');
    console.log('  完整对象:', result);
    console.log('  tiles 数组:', result.tiles);
    console.log('  buildings 数组:', result.buildings);
    if (result.tiles.length > 0) {
        console.log('  第一个 tile:', result.tiles[0]);
    }
    if (result.buildings && result.buildings.length > 0) {
        console.log('  第一个 building:', result.buildings[0]);
    }
    console.log('='.repeat(80));

    return result;
}

/**
 * Move TileKind → Web3TileType 映射
 */
function getTileTypeId(kind: number): number {
    switch (kind) {
        case TileKind.EMPTY: return Web3TileType.EMPTY_LAND;   // 0
        case TileKind.LOTTERY: return Web3TileType.LOTTERY;     // 1
        case TileKind.HOSPITAL: return Web3TileType.HOSPITAL;   // 2
        case TileKind.CHANCE: return Web3TileType.CHANCE;       // 3
        case TileKind.BONUS: return Web3TileType.BONUS;         // 4
        case TileKind.FEE: return Web3TileType.FEE;             // 5
        case TileKind.CARD: return Web3TileType.CARD;           // 6
        case TileKind.NEWS: return Web3TileType.NEWS;           // 7
        default:
            console.warn(`[Converter] Unknown tile kind: ${kind}, using EMPTY_LAND`);
            return Web3TileType.EMPTY_LAND;
    }
}

/**
 * 根据 TileKind 映射到客户端 blockId
 */
function getTileBlockId(kind: number): string {
    switch (kind) {
        case TileKind.EMPTY: return 'web3:empty_land';     // 0
        case TileKind.LOTTERY: return 'web3:lottery';       // 1
        case TileKind.HOSPITAL: return 'web3:hospital';     // 2
        case TileKind.CHANCE: return 'web3:chance';         // 3
        case TileKind.BONUS: return 'web3:bonus';           // 4
        case TileKind.FEE: return 'web3:fee';               // 5
        case TileKind.CARD: return 'web3:card';             // 6
        case TileKind.NEWS: return 'web3:news';             // 7
        default:
            console.warn(`[Converter] Unknown tile kind: ${kind}, using empty_land`);
            return 'web3:empty_land';
    }
}

/**
 * BuildingSize → Web3BuildingType 映射
 */
function getBuildingTypeId(size: number): number {
    return size === BuildingSize.SIZE_1X1
        ? Web3BuildingType.BUILDING_1X1
        : Web3BuildingType.BUILDING_2X2;
}

/**
 * 根据 building size 映射到客户端 blockId
 */
function getBuildingBlockId(size: number, _buildingType?: number): string {
    // 1x1 建筑：普通地产
    if (size === BuildingSize.SIZE_1X1) {
        return 'web3:building_1x1';
    }

    // 2x2 建筑：根据 building_type 区分
    if (size === BuildingSize.SIZE_2X2) {
        // 目前使用通用的 2x2 建筑（未来可根据 buildingType 区分不同模型）
        return 'web3:building_2x2';
    }

    console.warn(`[Converter] Unknown building size: ${size}, using 1x1`);
    return 'web3:building_1x1';
}
