/**
 * 地图相关类型定义
 * 对应Move端的map.move文件中的struct定义
 *
 * Move源文件: move/tycoon/sources/map.move
 */

import { NO_PROPERTY } from './constants';

/**
 * 地产静态数据（新的Tile/Property分离架构）
 * 对应Move: struct PropertyStatic
 * 注意：这是地产的经济属性，与地块分离
 */
export interface PropertyStatic {
    /** 地产类型（TILE_PROPERTY、TILE_TEMPLE等） */
    kind: number;
    /** 地产大小（1=1x1小地产，2=2x2大地产） */
    size: number;
    /** 基础价格 */
    price: bigint;
    /** 基础过路费 */
    base_toll: bigint;
}

/**
 * 地块静态数据（新的Tile/Property分离架构）
 * 对应Move: struct TileStatic
 * 注意：这是导航节点，包含路径信息
 */
export interface TileStatic {
    /** X坐标（客户端展示用） */
    x: number;
    /** Y坐标（客户端展示用） */
    y: number;
    /** 地块类型（用于触发事件） */
    kind: number;
    /**
     * 关联的地产ID
     * NO_PROPERTY (65535) 表示非地产地块
     * 多个地块可以有相同的property_id（如大地产的多个入口）
     */
    property_id: number;
    /** 特殊数值（如奖金、罚款金额） */
    special: bigint;

    // 导航字段
    /** 顺时针下一个地块 */
    cw_next: number;
    /** 逆时针下一个地块 */
    ccw_next: number;
    /** 邻接地块列表（用于复杂地图） */
    adj?: number[];
}

/**
 * 地图模板
 * 对应Move: struct MapTemplate
 */
export interface MapTemplate {
    /** 模板ID */
    id: number;
    /** 模板名称 */
    name: string;
    /** 描述 */
    description: string;
    /** 创建者 */
    creator: string;
    /** 起始地块ID */
    starting_tile: number;
    /** 地块静态数据表 */
    tiles_static: Map<number, TileStatic>;
    /** 地产静态数据表 */
    properties_static: Map<number, PropertyStatic>;
    /** 支持的玩家数量 */
    min_players: number;
    max_players: number;
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
    /** 下一个模板ID */
    next_template_id: number;
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
 * 判断地块是否关联地产
 */
export function hasProperty(tile: TileStatic): boolean {
    return tile.property_id !== NO_PROPERTY;
}

/**
 * 判断是否为起始地块
 */
export function isStartingTile(tile: TileStatic, template: MapTemplate): boolean {
    return template.starting_tile === getTileId(tile);
}

/**
 * 获取地块ID（从TileStatic推算，实际应该有ID字段）
 */
function getTileId(tile: TileStatic): number {
    // 这里需要根据实际实现调整
    // 可能需要在TileStatic中添加id字段
    return 0;
}

/**
 * 获取地块的所有邻接地块
 */
export function getAdjacentTiles(tileId: number, template: MapTemplate): number[] {
    const tile = template.tiles_static.get(tileId);
    if (!tile) return [];

    const adjacent: number[] = [];

    // 添加环形连接
    if (tile.cw_next !== undefined) adjacent.push(tile.cw_next);
    if (tile.ccw_next !== undefined) adjacent.push(tile.ccw_next);

    // 添加邻接连接
    if (tile.adj) {
        adjacent.push(...tile.adj);
    }

    // 去重
    return [...new Set(adjacent)];
}

/**
 * 判断两个地块是否相邻
 */
export function areAdjacent(tile1Id: number, tile2Id: number, template: MapTemplate): boolean {
    const adjacent = getAdjacentTiles(tile1Id, template);
    return adjacent.includes(tile2Id);
}

/**
 * 获取地产的所有入口地块
 */
export function getPropertyTiles(propertyId: number, template: MapTemplate): number[] {
    const tiles: number[] = [];
    template.tiles_static.forEach((tile, tileId) => {
        if (tile.property_id === propertyId) {
            tiles.push(tileId);
        }
    });
    return tiles;
}

/**
 * 计算两个地块之间的最短距离（步数）
 */
export function getDistance(from: number, to: number, template: MapTemplate, direction: 'cw' | 'ccw' = 'cw'): number {
    let current = from;
    let steps = 0;
    const visited = new Set<number>();

    while (current !== to && !visited.has(current)) {
        visited.add(current);
        const tile = template.tiles_static.get(current);
        if (!tile) break;

        current = direction === 'cw' ? tile.cw_next : tile.ccw_next;
        steps++;

        if (steps > template.tiles_static.size) {
            // 防止无限循环
            return -1;
        }
    }

    return current === to ? steps : -1;
}