/**
 * 地图模板类型定义
 * 与Move合约中的MapTemplate结构对齐
 */

/**
 * 地块信息
 */
export interface TileInfo {
    /** 地块ID */
    id: bigint;
    /** 地块类型 (对应types.move中的常量) */
    kind: number;
    /** 顺时针下一个地块ID */
    cw_next: bigint;
    /** 逆时针下一个地块ID */
    ccw_next: bigint;
    /** 邻接地块ID列表 (非环形连接) */
    adj: bigint[];
}

/**
 * 地图模板
 * 对应Move中的MapTemplate结构
 */
export interface MapTemplate {
    /** 模板ID */
    id: bigint;
    /** 模板名称 */
    name: string;
    /** 描述 */
    description: string;
    /** 地块列表 (key: tile_id, value: TileInfo) */
    tiles: Map<bigint, TileInfo>;
    /** 支持的玩家数量范围 */
    player_count_range: {
        min: number;
        max: number;
    };
    /** 起始地块ID */
    starting_tile: bigint;
}

/**
 * 地块类型常量 (对应types.move)
 */
export enum TileType {
    EMPTY = 0,           // 空地
    PROPERTY = 1,        // 可购买地产
    JAIL = 2,            // 监狱
    HOSPITAL = 3,        // 医院
    LOTTERY = 4,         // 彩票站
    CHANCE = 5,          // 机会
    NEWS = 6,            // 新闻事件
    BONUS = 7,           // 奖金
    FEE = 8,             // 罚款
    TELEPORT = 9,        // 传送
    START = 10,          // 起点
    PARK = 11,           // 公园
    GOD_LAND = 12,       // 土地神
    GOD_POOR = 13,       // 穷神
}

/**
 * 移动方向
 */
export enum MoveDirection {
    CLOCKWISE = 0,         // 顺时针
    COUNTER_CLOCKWISE = 1, // 逆时针
    ADJACENT = 2,          // 邻接跳转
}

/**
 * 辅助函数：从JSON创建MapTemplate
 */
export function createMapTemplateFromJSON(data: any): MapTemplate {
    const tiles = new Map<bigint, TileInfo>();

    // 转换tiles数组为Map
    if (data.tiles && Array.isArray(data.tiles)) {
        data.tiles.forEach((tile: any) => {
            const tileInfo: TileInfo = {
                id: BigInt(tile.id),
                kind: tile.kind,
                cw_next: BigInt(tile.cw_next),
                ccw_next: BigInt(tile.ccw_next),
                adj: tile.adj ? tile.adj.map((id: any) => BigInt(id)) : []
            };
            tiles.set(tileInfo.id, tileInfo);
        });
    }

    return {
        id: BigInt(data.id || 0),
        name: data.name || '',
        description: data.description || '',
        tiles,
        player_count_range: {
            min: data.player_count_range?.min || 2,
            max: data.player_count_range?.max || 4
        },
        starting_tile: BigInt(data.starting_tile || 0)
    };
}

/**
 * 辅助函数：验证地块连接是否有效
 */
export function isValidNeighbor(
    template: MapTemplate,
    fromTile: bigint,
    toTile: bigint
): boolean {
    const tile = template.tiles.get(fromTile);
    if (!tile) return false;

    // 检查是否是顺时针邻居
    if (tile.cw_next === toTile) return true;
    // 检查是否是逆时针邻居
    if (tile.ccw_next === toTile) return true;
    // 检查是否在邻接列表中
    if (tile.adj.includes(toTile)) return true;

    return false;
}

/**
 * 辅助函数：添加有效且唯一的邻居
 */
function pushIfValid(template: MapTemplate, neighbors: bigint[], id: bigint): void {
    if (template.tiles.has(id) && !neighbors.includes(id)) {
        neighbors.push(id);
    }
}

/**
 * 辅助函数：获取地块的所有邻居
 */
export function getTileNeighbors(
    template: MapTemplate,
    tileId: bigint
): bigint[] {
    const tile = template.tiles.get(tileId);
    if (!tile) return [];

    const neighbors: bigint[] = [];

    // 按优先级添加：cw → ccw → adj
    // 不再使用0作为"无邻居"的标记值
    pushIfValid(template, neighbors, tile.cw_next);
    pushIfValid(template, neighbors, tile.ccw_next);

    // 添加所有邻接地块
    for (const adjId of tile.adj) {
        pushIfValid(template, neighbors, adjId);
    }

    return neighbors;
}