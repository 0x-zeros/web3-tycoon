/**
 * 地图生成器类型定义
 *
 * 定义地图生成所需的所有数据结构和接口
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Vec2 } from 'cc';

/**
 * 地图生成模式
 */
export enum MapGenerationMode {
    CLASSIC = 'classic'  // 经典模式：环形主干道 + 放射状支路
}

/**
 * 地图生成参数
 */
export interface MapGeneratorParams {
    // 基础参数
    mode: MapGenerationMode;           // 生成模式
    mapWidth: number;                  // 地图宽度（格子数）
    mapHeight: number;                 // 地图高度（格子数）
    seed?: number;                     // 随机种子（可选）

    // 道路参数
    roadDensity: number;               // 道路密度 (0.1-0.3)
    mainRoadWidth?: number;            // 主干道宽度（Classic模式）

    // 地产参数
    propertyRatio: number;             // 地产占比 (0.2-0.4)
    property2x2Ratio: number;          // 2x2地产占比 (0.1-0.3)
    minPropertySpacing: number;        // 地产最小间距（格子数）

    // 特殊地块参数
    specialTileTypes: string[];       // 特殊地块类型列表
    specialTileRatio: number;         // 特殊地块占比 (0.05-0.15)

    // 交通分析参数
    trafficSimulationRounds: number;  // 蒙特卡洛模拟轮数
    startPositions: Vec2[];            // 起始点位置（用于交通模拟）
}

/**
 * 地块数据
 */
export interface TileData {
    gridPos: Vec2;                     // 网格坐标
    blockId: string;                   // 方块ID (如 "web3:empty_land")
    typeId: number;                    // 类型ID
    isRoad?: boolean;                  // 是否为道路
    trafficHotness?: number;           // 交通热度值 (0-1)
}

/**
 * 地产数据
 */
export interface PropertyData {
    gridPos: Vec2;                     // 网格坐标（左下角）
    blockId: string;                   // 方块ID (如 "web3:property_small")
    size: 1 | 2;                       // 地产尺寸
    priceCoefficient: number;          // 价格系数 (0.5-2.0)
    streetId?: number;                 // 所属街区ID
    colorGroup?: string;               // 颜色组（用于垄断判定）
}

/**
 * 特殊地块数据
 */
export interface SpecialTileData {
    gridPos: Vec2;                     // 网格坐标
    blockId: string;                   // 方块ID (如 "web3:bonus")
    typeId: number;                    // 类型ID
}

/**
 * 街区数据
 */
export interface StreetData {
    id: number;                        // 街区ID
    tiles: Vec2[];                     // 街区内的地块坐标
    properties: PropertyData[];        // 街区内的地产
    colorGroup: string;                // 颜色组
    centerPos: Vec2;                   // 街区中心位置
}

/**
 * 道路网络数据
 */
export interface RoadNetworkData {
    roads: Vec2[];                     // 道路地块坐标列表
    mainRoads: Vec2[];                 // 主干道坐标
    sideRoads: Vec2[];                 // 支路坐标
    intersections: Vec2[];             // 交叉路口坐标
    connectivity: Map<string, Vec2[]>; // 连通性图（邻接表）
}

/**
 * 交通分析结果
 */
export interface TrafficAnalysisResult {
    hotnessMap: Map<string, number>;   // 热度图（坐标key -> 热度值）
    percentileMap: Map<string, number>; // 百分位图（坐标key -> 百分位）
    priceCoefficients: Map<string, number>; // 价格系数图
    hotSpots: Vec2[];                   // 热点位置（前10%）
    coldSpots: Vec2[];                  // 冷点位置（后10%）
}

/**
 * 地图生成结果
 */
export interface MapGenerationResult {
    // 基础数据
    width: number;
    height: number;
    seed: number;
    mode: MapGenerationMode;

    // 地块数据
    tiles: TileData[];                 // 所有地块
    properties: PropertyData[];         // 地产列表
    specialTiles: SpecialTileData[];   // 特殊地块

    // 分析数据
    roadNetwork: RoadNetworkData;      // 道路网络
    streets: StreetData[];              // 街区划分
    trafficAnalysis: TrafficAnalysisResult; // 交通分析

    // 统计信息
    statistics: {
        totalTiles: number;
        roadCount: number;
        propertyCount: number;
        property1x1Count: number;
        property2x2Count: number;
        specialTileCount: number;
        averageTrafficHotness: number;
    };
}

/**
 * 默认生成参数
 */
export const DEFAULT_GENERATOR_PARAMS: MapGeneratorParams = {
    mode: MapGenerationMode.CLASSIC,
    mapWidth: 40,
    mapHeight: 40,
    roadDensity: 0.2,
    mainRoadWidth: 2,
    propertyRatio: 0.3,
    property2x2Ratio: 0.15,
    minPropertySpacing: 1,
    specialTileTypes: ['web3:bonus', 'web3:hospital', 'web3:chance', 'web3:card'],
    specialTileRatio: 0.1,
    trafficSimulationRounds: 1000,
    startPositions: [new Vec2(0, 0)]
};

/**
 * Classic模式参数
 */
export const CLASSIC_MODE_PARAMS: Partial<MapGeneratorParams> = {
    mode: MapGenerationMode.CLASSIC,
    roadDensity: 0.25,
    mainRoadWidth: 2,
    propertyRatio: 0.35,
    property2x2Ratio: 0.2,
    minPropertySpacing: 2
};


/**
 * 坐标转换工具
 */
export class CoordUtils {
    /**
     * Vec2坐标转字符串key
     */
    static posToKey(pos: Vec2): string {
        return `${Math.floor(pos.x)}_${Math.floor(pos.y)}`;
    }

    /**
     * 字符串key转Vec2坐标
     */
    static keyToPos(key: string): Vec2 {
        const [x, y] = key.split('_').map(Number);
        return new Vec2(x, y);
    }

    /**
     * 获取相邻坐标
     */
    static getNeighbors(pos: Vec2, includeDiagonal: boolean = false): Vec2[] {
        const neighbors: Vec2[] = [
            new Vec2(pos.x + 1, pos.y),
            new Vec2(pos.x - 1, pos.y),
            new Vec2(pos.x, pos.y + 1),
            new Vec2(pos.x, pos.y - 1)
        ];

        if (includeDiagonal) {
            neighbors.push(
                new Vec2(pos.x + 1, pos.y + 1),
                new Vec2(pos.x + 1, pos.y - 1),
                new Vec2(pos.x - 1, pos.y + 1),
                new Vec2(pos.x - 1, pos.y - 1)
            );
        }

        return neighbors;
    }

    /**
     * 检查坐标是否在边界内
     */
    static isInBounds(pos: Vec2, width: number, height: number): boolean {
        return pos.x >= 0 && pos.x < width && pos.y >= 0 && pos.y < height;
    }

    /**
     * 计算曼哈顿距离
     */
    static manhattanDistance(pos1: Vec2, pos2: Vec2): number {
        return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
    }
}