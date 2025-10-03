/**
 * 地图数据 BCS 编码器
 * 使用 @mysten/sui/bcs 进行序列化，与 Move 端结构完全对应
 *
 * Move 源文件: move/tycoon/sources/map.move
 */

import { bcs } from '@mysten/sui/bcs';
import type { MapTemplate, TileStatic, BuildingStatic } from '../types/map';

// ===== BCS Schema 定义 =====

/**
 * TileStatic BCS Schema
 * 必须严格按 Move struct 字段顺序定义
 *
 * Move定义：
 * public struct TileStatic has store, copy, drop {
 *     x: u8,
 *     y: u8,
 *     kind: u8,
 *     building_id: u16,
 *     special: u64,
 *     w: u16,
 *     n: u16,
 *     e: u16,
 *     s: u16
 * }
 */
const TileStaticBCS = bcs.struct('TileStatic', {
    x: bcs.u8(),
    y: bcs.u8(),
    kind: bcs.u8(),
    building_id: bcs.u16(),
    special: bcs.u64(),
    w: bcs.u16(),
    n: bcs.u16(),
    e: bcs.u16(),
    s: bcs.u16()
});

/**
 * BuildingStatic BCS Schema
 *
 * Move定义：
 * public struct BuildingStatic has store, copy, drop {
 *     size: u8,
 *     price: u64
 * }
 */
const BuildingStaticBCS = bcs.struct('BuildingStatic', {
    size: bcs.u8(),
    price: bcs.u64()
});

// ===== 序列化函数 =====

/**
 * 将 MapTemplate 序列化为 BCS 字节数组
 * @param mapTemplate 编辑器生成的地图数据
 * @returns 三个 BCS 序列化的字节数组
 */
export function encodeMapTemplateToBCS(mapTemplate: MapTemplate): {
    tilesBytes: number[];
    buildingsBytes: number[];
    hospitalIdsBytes: number[];
} {
    // 1. 准备 tiles 数组（必须按 tile_id 顺序，从 0 开始连续）
    const tiles: Array<{
        x: number;
        y: number;
        kind: number;
        building_id: number;
        special: bigint;
        w: number;
        n: number;
        e: number;
        s: number;
    }> = [];

    const maxTileId = Math.max(...Array.from(mapTemplate.tiles_static.keys()));

    for (let i = 0; i <= maxTileId; i++) {
        const tile = mapTemplate.tiles_static.get(i);
        if (!tile) {
            throw new Error(
                `Missing tile at index ${i}. ` +
                `Tiles must be sequential from 0 to ${maxTileId}.`
            );
        }

        // 确保类型正确（BCS 要求严格类型）
        tiles.push({
            x: tile.x,
            y: tile.y,
            kind: tile.kind,
            building_id: tile.building_id,
            special: BigInt(tile.special),  // u64 需要 bigint
            w: tile.w,
            n: tile.n,
            e: tile.e,
            s: tile.s
        });
    }

    // 2. 准备 buildings 数组（必须按 building_id 顺序）
    const buildings: Array<{
        size: number;
        price: bigint;
    }> = [];

    if (mapTemplate.buildings_static.size > 0) {
        const maxBuildingId = Math.max(...Array.from(mapTemplate.buildings_static.keys()));

        for (let i = 0; i <= maxBuildingId; i++) {
            const building = mapTemplate.buildings_static.get(i);
            if (!building) {
                throw new Error(
                    `Missing building at index ${i}. ` +
                    `Buildings must be sequential from 0 to ${maxBuildingId}.`
                );
            }

            buildings.push({
                size: building.size,
                price: BigInt(building.price)
            });
        }
    }

    // 3. BCS 序列化
    const tilesSerializer = bcs.vector(TileStaticBCS);
    const buildingsSerializer = bcs.vector(BuildingStaticBCS);
    const hospitalIdsSerializer = bcs.vector(bcs.u16());

    const tilesBytes = tilesSerializer.serialize(tiles).toBytes();
    const buildingsBytes = buildingsSerializer.serialize(buildings).toBytes();
    const hospitalIdsBytes = hospitalIdsSerializer.serialize(mapTemplate.hospital_ids).toBytes();

    // 4. 转换为普通数组（Transaction.pure.vector 需要）
    return {
        tilesBytes: Array.from(tilesBytes),
        buildingsBytes: Array.from(buildingsBytes),
        hospitalIdsBytes: Array.from(hospitalIdsBytes)
    };
}

/**
 * 反序列化（用于验证或调试）
 */
export function decodeMapTemplateFromBCS(
    tilesBytes: Uint8Array,
    buildingsBytes: Uint8Array,
    hospitalIdsBytes: Uint8Array
): {
    tiles: TileStatic[];
    buildings: BuildingStatic[];
    hospital_ids: number[];
} {
    const tilesDeserializer = bcs.vector(TileStaticBCS);
    const buildingsDeserializer = bcs.vector(BuildingStaticBCS);
    const hospitalIdsDeserializer = bcs.vector(bcs.u16());

    const tiles = tilesDeserializer.parse(tilesBytes) as any[];
    const buildings = buildingsDeserializer.parse(buildingsBytes) as any[];
    const hospital_ids = hospitalIdsDeserializer.parse(hospitalIdsBytes) as number[];

    return {
        tiles: tiles.map(t => ({
            x: t.x,
            y: t.y,
            kind: t.kind,
            building_id: t.building_id,
            special: t.special,
            w: t.w,
            n: t.n,
            e: t.e,
            s: t.s
        })),
        buildings: buildings.map(b => ({
            size: b.size,
            price: b.price
        })),
        hospital_ids
    };
}
