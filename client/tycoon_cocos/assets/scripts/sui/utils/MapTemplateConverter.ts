/**
 * MapTemplate 数据转换工具
 * 将链上的 MapTemplate + Game 数据转换为客户端的 MapSaveData 格式
 * 用于从 Sui 链上数据重建 3D 游戏场景
 */

import type { MapTemplate, TileStatic, BuildingStatic } from '../types/map';
import type { MapSaveData, TileData, BuildingData } from '../../map/data/MapDataTypes';
import type { Game } from '../types/game';
import { TileKind, BuildingSize, NO_BUILDING, INVALID_TILE_ID } from '../types/constants';

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
    console.log('  Template tiles:', template.tiles_static.size);
    console.log('  Template buildings:', template.buildings_static.size);
    console.log('  Game buildings:', game.buildings.length);

    // 1. 转换 Tiles
    template.tiles_static.forEach((tileStatic, tileId) => {
        tiles.push({
            blockId: getTileBlockId(tileStatic.kind),  // 根据 kind 映射到 blockId
            position: {
                x: tileStatic.x,
                z: tileStatic.y  // 注意：Move 的 y 对应 Cocos 的 z
            },
            tileId: tileId,
            buildingId: tileStatic.building_id !== NO_BUILDING ? tileStatic.building_id : undefined,
            // 邻居关系
            w: tileStatic.w !== INVALID_TILE_ID ? tileStatic.w : undefined,
            n: tileStatic.n !== INVALID_TILE_ID ? tileStatic.n : undefined,
            e: tileStatic.e !== INVALID_TILE_ID ? tileStatic.e : undefined,
            s: tileStatic.s !== INVALID_TILE_ID ? tileStatic.s : undefined
        });
    });

    // 2. 转换 Buildings
    template.buildings_static.forEach((buildingStatic, buildingId) => {
        // 找到该 building 的入口 tiles
        const entranceTiles: number[] = [];
        template.tiles_static.forEach((tile, tileId) => {
            if (tile.building_id === buildingId) {
                entranceTiles.push(tileId);
            }
        });

        if (entranceTiles.length === 0) {
            console.warn(`[Converter] Building ${buildingId} has no entrance tiles, skipping`);
            return;
        }

        // 使用第一个入口 tile 的坐标作为 building 的坐标
        const firstEntranceTile = template.tiles_static.get(entranceTiles[0])!;

        // 从 Game.buildings 获取动态数据（owner, level, building_type）
        const gameBuildingData = game.buildings[buildingId];

        buildings.push({
            blockId: getBuildingBlockId(buildingStatic.size, gameBuildingData?.building_type),
            position: {
                x: firstEntranceTile.x,
                z: firstEntranceTile.y
            },
            size: buildingStatic.size as (1 | 2),
            direction: 0,  // 默认朝向（MapTemplate 中暂无存储）
            buildingId: buildingId,
            entranceTileIds: entranceTiles.slice(0, 2) as [number, number],  // 最多2个入口
            chainPrevId: buildingStatic.chain_prev_id !== NO_BUILDING ? buildingStatic.chain_prev_id : undefined,
            chainNextId: buildingStatic.chain_next_id !== NO_BUILDING ? buildingStatic.chain_next_id : undefined,
            owner: gameBuildingData?.owner !== 255 ? gameBuildingData.owner.toString() : undefined,  // NO_OWNER
            level: gameBuildingData?.level ?? 0,
            price: buildingStatic.price,
            rent: [buildingStatic.price / 10n],  // 简化：租金 = 价格/10
            mortgaged: false
        });
    });

    console.log('[MapTemplateConverter] Conversion completed');
    console.log('  Tiles:', tiles.length);
    console.log('  Buildings:', buildings.length);

    return {
        mapId,
        gameMode: 'play',  // 游戏模式（非编辑）
        tiles,
        objects: [],  // 游戏中不使用旧的 objects 系统
        buildings,
        npcs: [],  // NPC 数据需要从 Game events 或额外查询获取
        decorations: []  // 装饰物暂不支持
    };
}

/**
 * 根据 TileKind 映射到客户端 blockId
 */
function getTileBlockId(kind: number): string {
    switch (kind) {
        case TileKind.EMPTY: return 'web3:empty_land';
        case TileKind.LOTTERY: return 'web3:lottery';
        case TileKind.HOSPITAL: return 'web3:hospital';
        case TileKind.PRISON: return 'web3:prison';
        case TileKind.CHANCE: return 'web3:chance';
        case TileKind.BONUS: return 'web3:bonus';
        case TileKind.FEE: return 'web3:fee';
        case TileKind.CARD: return 'web3:card';
        case TileKind.NEWS: return 'web3:news';
        case TileKind.SHOP: return 'web3:shop';
        default:
            console.warn(`[Converter] Unknown tile kind: ${kind}, using empty_land`);
            return 'web3:empty_land';
    }
}

/**
 * 根据 building size 和 type 映射到客户端 blockId
 */
function getBuildingBlockId(size: number, buildingType?: number): string {
    // 1x1 建筑：普通地产
    if (size === BuildingSize.SIZE_1X1) {
        return 'web3:building_1x1';
    }

    // 2x2 建筑：根据 building_type 区分
    if (size === BuildingSize.SIZE_2X2) {
        // TODO: 根据 buildingType 映射不同的 2x2 建筑模型
        // 目前先使用通用的 2x2 建筑
        return 'web3:building_2x2';
    }

    console.warn(`[Converter] Unknown building size: ${size}, using 1x1`);
    return 'web3:building_1x1';
}
