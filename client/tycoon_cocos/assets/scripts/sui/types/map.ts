/**
 * 地图相关类型定义
 * 对应Move端的map.move文件中的struct定义
 *
 * Move源文件: move/tycoon/sources/map.move
 */

import { NO_BUILDING } from './constants';

/**
 * 建筑静态数据（新的Tile/Building分离架构）
 * 对应Move: struct BuildingStatic
 * 注意：这是建筑的经济属性，与地块分离
 */
export interface BuildingStatic {
    /** X坐标（客户端展示用） */
    x: number;
    /** Y坐标（客户端展示用） */
    y: number;
    /** 建筑大小（1=1x1小建筑，2=2x2大建筑） */
    size: number;
    /** 基础价格 */
    price: bigint;
    /** 前一个连街建筑ID（65535表示无效，只对1x1有效） */
    chain_prev_id: number;
    /** 后一个连街建筑ID（65535表示无效，只对1x1有效） */
    chain_next_id: number;
}

/**
 * 地块静态数据（新的Tile/Building分离架构）
 * 对应Move: struct TileStatic
 * 注意：这是导航节点，包含路径信息
 */
export interface TileStatic {
    /** X坐标（客户端展示用） */
    x: number;
    /** Y坐标（客户端展示用） */
    y: number;
    /** 地块类型（EMPTY/LOTTERY/HOSPITAL等功能型） */
    kind: number;
    /**
     * 关联的建筑ID
     * NO_BUILDING (65535) 表示无建筑
     * 多个地块可以有相同的building_id（如大建筑的多个入口）
     */
    building_id: number;
    /** 特殊数值（如奖金、罚款金额） */
    special: bigint;

    // 四方向邻居导航字段
    /** West邻居tile_id (x-1方向，65535表示无效) */
    w: number;
    /** North邻居tile_id (z-1方向，65535表示无效) */
    n: number;
    /** East邻居tile_id (x+1方向，65535表示无效) */
    e: number;
    /** South邻居tile_id (z+1方向，65535表示无效) */
    s: number;
}

/**
 * 地图模板
 * 对应Move: struct MapTemplate
 * 注：name/description等元数据存储在链外（Walrus等），链上只存储核心数据
 */
export interface MapTemplate {
    /** 模板ID */
    id: string;
    /** 地块静态数据表 */
    tiles_static: Map<number, TileStatic>;
    /** 建筑静态数据表 */
    buildings_static: Map<number, BuildingStatic>;
    /** 医院地块ID列表（用于送医院功能） */
    hospital_ids: number[];
}

/**
 * 地图注册表
 * 对应Move: struct MapRegistry
 */
export interface MapRegistry {
    /** 注册表ID */
    id: string;
    /** 已注册的模板（key: template_id, value: MapTemplate） */
    templates: Map<number, MapTemplate>;
    /** 已注册的模板总数 */
    template_count: number;
}

/**
 * 路径选择结果
 * 用于处理分叉路径
 */
export interface PathChoice {
    /** 当前位置 */
    from_tile: number;
    /** 可选的下一个地块列表 */
    choices: number[];
    /** 玩家选择的索引 */
    selected?: number;
}

/**
 * 地图布局信息（客户端用）
 */
export interface MapLayout {
    /** 地图宽度（格子数） */
    width: number;
    /** 地图高度（格子数） */
    height: number;
    /** 总地块数 */
    tile_count: number;
    /** 是否为环形地图 */
    is_circular: boolean;
}

/**
 * 地块可视化信息（客户端用）
 */
export interface TileVisual {
    /** 地块ID */
    id: number;
    /** 屏幕坐标 */
    screen_x: number;
    screen_y: number;
    /** 旋转角度（度） */
    rotation: number;
    /** 地块方向（用于显示箭头） */
    direction: 'up' | 'down' | 'left' | 'right';
}

/**
 * 辅助函数
 */

/**
 * 判断地块是否关联建筑
 */
export function hasBuilding(tile: TileStatic): boolean {
    return tile.building_id !== NO_BUILDING;
}

// 辅助函数：isStartingTile 和 getTileId 已删除
// 起始地块由游戏逻辑或客户端管理，不在MapTemplate中存储

/**
 * 获取地块的所有邻接地块（四方向）
 */
export function getAdjacentTiles(tileId: number, template: MapTemplate): number[] {
    const tile = template.tiles_static.get(tileId);
    if (!tile) return [];

    const adjacent: number[] = [];

    // 添加四方向邻居
    if (tile.w !== 65535) adjacent.push(tile.w);
    if (tile.n !== 65535) adjacent.push(tile.n);
    if (tile.e !== 65535) adjacent.push(tile.e);
    if (tile.s !== 65535) adjacent.push(tile.s);

    return adjacent;
}

/**
 * 判断两个地块是否相邻
 */
export function areAdjacent(tile1Id: number, tile2Id: number, template: MapTemplate): boolean {
    const adjacent = getAdjacentTiles(tile1Id, template);
    return adjacent.includes(tile2Id);
}

/**
 * 获取建筑的所有入口地块
 */
export function getBuildingTiles(buildingId: number, template: MapTemplate): number[] {
    const tiles: number[] = [];
    template.tiles_static.forEach((tile, tileId) => {
        if (tile.building_id === buildingId) {
            tiles.push(tileId);
        }
    });
    return tiles;
}

/**
 * 计算两个地块之间的最短距离（步数）
 * 使用BFS在四方向邻接网格中寻路
 * @param lastTileId 上一步tile（避免第一步回头），65535表示无限制
 */
export function getDistance(from: number, to: number, template: MapTemplate, lastTileId: number = 65535): number {
    if (from === to) return 0;

    const queue: Array<{tile: number; dist: number; prev: number}> = [{tile: from, dist: 0, prev: lastTileId}];
    const visited = new Set<number>([from]);

    while (queue.length > 0) {
        const {tile: current, dist, prev} = queue.shift()!;
        const currentTile = template.tiles_static.get(current);
        if (!currentTile) continue;

        // 检查四个方向的邻居
        const neighbors = [currentTile.w, currentTile.n, currentTile.e, currentTile.s];

        for (const next of neighbors) {
            if (next === 65535) continue;  // 无效邻居
            if (visited.has(next)) continue;
            if (next === prev && dist === 0) continue;  // 第一步不能回头

            if (next === to) return dist + 1;

            visited.add(next);
            queue.push({tile: next, dist: dist + 1, prev: current});
        }
    }

    return -1;  // 无法到达
}
