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
            typeId: getTileTypeId(tileStatic.kind),  // ✅ 必须字段
            
            //todo tileStatic.x, tileStatic.y 为gridpos，需要转换为cocos坐标；需要参数之前的转换的地方
            position: {
                x: tileStatic.x,
                z: tileStatic.y  // 注意：Move 的 y 对应 Cocos 的 z
            },
            data: {  // ✅ 嵌套在 data 对象中
                tileId: tileId,
                buildingId: tileStatic.building_id,
                custom: tileStatic.special, //todo TileData.custom 根据 tileStatic.special 改名和类型吧（u64 -> number）
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
        const size = buildingStatic.size as (1 | 2); //todo as (1 | 2) 需要吗？
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
            typeId: getBuildingTypeId(buildingStatic.size),  // ✅ 必须字段
            size: size,
            position: {
                x: gridPos.x, //todo 需要转换为cocos坐标；需要参数之前的转换的地方
                z: gridPos.y, //todo 需要转换为cocos坐标；需要参数之前的转换的地方
            },
            direction: 0,  // todo 需要从 building的gridPos和 entranceTiles[0]的gridPos 的相对位置计算得到（使用 position的相对位置也一样， 参考地图编辑的时候的direction规则 ）
            buildingId: buildingId,
            entranceTileIds: entranceTileIds as [number, number],
            // chainPrevId/chainNextId 在 BuildingData 中不存在，存储在 BuildingInfo 中
            owner: gameBuildingData?.owner, //todo 修改 BuildingData.owner 的类型为 number
            level: gameBuildingData?.level,
            price: Number(price),  // BigInt → number
            rent: 0,  // todo 不需要的值？ 是不是应该从BuildingData里删掉，需要查找了看看
            mortgaged: false,  // todo 不需要的值？ 是不是应该从BuildingData里删掉，需要查找了看看
        });
    });

    console.log('[MapTemplateConverter] Conversion completed');
    console.log('  Tiles:', tiles.length);
    console.log('  Buildings:', buildings.length);

    const result = {
        // ✅ MapMetadata 必须字段
        mapId,
        mapName: `Chain Game ${game.id.slice(0, 8)}...`,
        version: '1.0.0',
        createTime: Date.now(),
        updateTime: Date.now(),

        // MapSaveData 字段
        gameMode: 'play',  // 游戏模式（非编辑）
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
        case TileKind.EMPTY: return Web3TileType.EMPTY_LAND;
        case TileKind.LOTTERY: return Web3TileType.LOTTERY;
        case TileKind.HOSPITAL: return Web3TileType.HOSPITAL;
        case TileKind.CHANCE: return Web3TileType.CHANCE;
        case TileKind.BONUS: return Web3TileType.BONUS;
        case TileKind.FEE: return Web3TileType.FEE;
        case TileKind.CARD: return Web3TileType.CARD;
        case TileKind.NEWS: return Web3TileType.NEWS;
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
        case TileKind.EMPTY: return 'web3:empty_land';
        case TileKind.LOTTERY: return 'web3:lottery';
        case TileKind.HOSPITAL: return 'web3:hospital';
        case TileKind.PRISON: return 'web3:hospital';  // PRISON 暂用 hospital 模型
        case TileKind.CHANCE: return 'web3:chance';
        case TileKind.BONUS: return 'web3:bonus';
        case TileKind.FEE: return 'web3:fee';
        case TileKind.CARD: return 'web3:card';
        case TileKind.NEWS: return 'web3:news';
        case TileKind.SHOP: return 'web3:card';  // SHOP 暂用 card 模型
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
        // TODO: 根据 buildingType 映射不同的 2x2 建筑模型
        // 目前先使用通用的 2x2 建筑
        return 'web3:building_2x2';
    }

    console.warn(`[Converter] Unknown building size: ${size}, using 1x1`);
    return 'web3:building_1x1';
}
