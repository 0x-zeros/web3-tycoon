/**
 * 交通分析器
 *
 * 使用蒙特卡洛模拟分析地图的交通流量，计算地块热度和价格系数
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Vec2 } from 'cc';
import {
    MapGeneratorParams,
    RoadNetworkData,
    TrafficAnalysisResult,
    CoordUtils
} from './MapGeneratorTypes';

/**
 * 交通分析器
 */
export class TrafficAnalyzer {
    private params: MapGeneratorParams;
    private random: () => number;
    private roadNetwork: RoadNetworkData;
    private visitCountMap: Map<string, number> = new Map();

    constructor(params: MapGeneratorParams) {
        this.params = params;
        this.random = this.createRandomGenerator(params.seed);
        this.roadNetwork = {
            roads: [],
            mainRoads: [],
            sideRoads: [],
            intersections: [],
            connectivity: new Map()
        };
    }

    /**
     * 创建随机数生成器
     */
    private createRandomGenerator(seed?: number): () => number {
        if (!seed) {
            return Math.random;
        }

        let s = seed ? seed + 2000 : 2000; // 偏移种子
        return () => {
            s = (s * 1664525 + 1013904223) % 2147483647;
            return s / 2147483647;
        };
    }

    /**
     * 分析交通流量
     */
    analyze(roadNetwork: RoadNetworkData): TrafficAnalysisResult {
        this.roadNetwork = roadNetwork;
        this.visitCountMap.clear();

        // 运行蒙特卡洛模拟
        this.runMonteCarloSimulation();

        // 计算热度值
        const hotnessMap = this.calculateHotnessMap();

        // 计算百分位
        const percentileMap = this.calculatePercentileMap(hotnessMap);

        // 计算价格系数
        const priceCoefficients = this.calculatePriceCoefficients(percentileMap);

        // 识别热点和冷点
        const { hotSpots, coldSpots } = this.identifyHotAndColdSpots(percentileMap);

        return {
            hotnessMap,
            percentileMap,
            priceCoefficients,
            hotSpots,
            coldSpots
        };
    }

    /**
     * 运行蒙特卡洛模拟
     */
    private runMonteCarloSimulation(): void {
        const rounds = this.params.trafficSimulationRounds;
        const startPositions = this.params.startPositions;

        for (let round = 0; round < rounds; round++) {
            // 随机选择起点
            const startIdx = Math.floor(this.random() * startPositions.length);
            const startPos = startPositions[startIdx];

            // 随机选择终点（从道路中随机选）
            if (this.roadNetwork.roads.length === 0) continue;

            const endIdx = Math.floor(this.random() * this.roadNetwork.roads.length);
            const endPos = this.roadNetwork.roads[endIdx];

            // 模拟路径
            this.simulatePath(startPos, endPos);
        }
    }

    /**
     * 模拟路径（简化的随机游走）
     */
    private simulatePath(start: Vec2, end: Vec2): void {
        const maxSteps = 100; // 最大步数，避免无限循环
        let current = this.findNearestRoad(start);
        const target = end;
        const visited = new Set<string>();

        for (let step = 0; step < maxSteps; step++) {
            const currentKey = CoordUtils.posToKey(current);

            // 记录访问
            this.visitCountMap.set(currentKey, (this.visitCountMap.get(currentKey) || 0) + 1);
            visited.add(currentKey);

            // 到达目标
            if (current.equals(target)) {
                break;
            }

            // 获取可能的下一步
            const neighbors = this.roadNetwork.connectivity.get(currentKey) || [];
            const validNeighbors = neighbors.filter(n => !visited.has(CoordUtils.posToKey(n)));

            if (validNeighbors.length === 0) {
                // 没有未访问的邻居，允许回溯
                const allNeighbors = neighbors;
                if (allNeighbors.length === 0) break;

                // 选择最接近目标的邻居
                current = this.selectNextStep(allNeighbors, target);
            } else {
                // 有未访问的邻居，选择最接近目标的
                current = this.selectNextStep(validNeighbors, target);
            }
        }
    }

    /**
     * 选择下一步（偏向目标方向，但有随机性）
     */
    private selectNextStep(neighbors: Vec2[], target: Vec2): Vec2 {
        if (neighbors.length === 0) {
            return target; // 不应该发生，但防御性编程
        }

        // 计算每个邻居到目标的距离
        const distances = neighbors.map(n => ({
            pos: n,
            dist: CoordUtils.manhattanDistance(n, target)
        }));

        // 根据距离分配概率（距离越近，概率越高）
        const maxDist = Math.max(...distances.map(d => d.dist));
        const weights = distances.map(d => maxDist - d.dist + 1); // +1避免0权重

        // 加入随机因素
        const randomizedWeights = weights.map(w => w * (0.5 + this.random() * 1.0));

        // 根据权重选择
        const totalWeight = randomizedWeights.reduce((a, b) => a + b, 0);
        let randomValue = this.random() * totalWeight;

        for (let i = 0; i < distances.length; i++) {
            randomValue -= randomizedWeights[i];
            if (randomValue <= 0) {
                return distances[i].pos;
            }
        }

        return distances[0].pos; // 默认返回第一个
    }

    /**
     * 找到最近的道路
     */
    private findNearestRoad(pos: Vec2): Vec2 {
        if (this.roadNetwork.roads.length === 0) {
            return pos;
        }

        let nearestRoad = this.roadNetwork.roads[0];
        let minDist = CoordUtils.manhattanDistance(pos, nearestRoad);

        for (const road of this.roadNetwork.roads) {
            const dist = CoordUtils.manhattanDistance(pos, road);
            if (dist < minDist) {
                minDist = dist;
                nearestRoad = road;
            }
        }

        return nearestRoad;
    }

    /**
     * 计算热度图
     */
    private calculateHotnessMap(): Map<string, number> {
        const hotnessMap = new Map<string, number>();

        // 找到最大访问次数
        let maxVisitCount = 0;
        for (const count of this.visitCountMap.values()) {
            maxVisitCount = Math.max(maxVisitCount, count);
        }

        if (maxVisitCount === 0) {
            // 没有访问记录，所有位置热度为0
            for (let x = 0; x < this.params.mapWidth; x++) {
                for (let y = 0; y < this.params.mapHeight; y++) {
                    const key = CoordUtils.posToKey(new Vec2(x, y));
                    hotnessMap.set(key, 0);
                }
            }
            return hotnessMap;
        }

        // 归一化访问次数到0-1
        for (let x = 0; x < this.params.mapWidth; x++) {
            for (let y = 0; y < this.params.mapHeight; y++) {
                const pos = new Vec2(x, y);
                const key = CoordUtils.posToKey(pos);
                const visitCount = this.visitCountMap.get(key) || 0;

                // 基础热度来自访问次数
                let hotness = visitCount / maxVisitCount;

                // 如果是道路，热度直接使用访问频率
                const isRoad = this.roadNetwork.roads.some(r => r.equals(pos));
                if (!isRoad) {
                    // 非道路地块，热度受邻近道路影响
                    hotness = this.calculateNearbyRoadHotness(pos);
                }

                // 主干道加成
                const isMainRoad = this.roadNetwork.mainRoads.some(r => r.equals(pos));
                if (isMainRoad) {
                    hotness = Math.min(1.0, hotness * 1.2);
                }

                // 交叉路口加成
                const isIntersection = this.roadNetwork.intersections.some(r => r.equals(pos));
                if (isIntersection) {
                    hotness = Math.min(1.0, hotness * 1.3);
                }

                hotnessMap.set(key, hotness);
            }
        }

        return hotnessMap;
    }

    /**
     * 计算邻近道路的热度
     */
    private calculateNearbyRoadHotness(pos: Vec2): number {
        let totalHotness = 0;
        let count = 0;
        const searchRadius = 3; // 搜索半径

        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            for (let dy = -searchRadius; dy <= searchRadius; dy++) {
                const checkPos = new Vec2(pos.x + dx, pos.y + dy);
                const key = CoordUtils.posToKey(checkPos);

                // 检查是否为道路
                const isRoad = this.roadNetwork.roads.some(r => r.equals(checkPos));
                if (isRoad) {
                    const visitCount = this.visitCountMap.get(key) || 0;
                    const distance = Math.max(Math.abs(dx), Math.abs(dy));
                    const weight = 1 / (distance + 1); // 距离越远，权重越小
                    totalHotness += visitCount * weight;
                    count += weight;
                }
            }
        }

        if (count === 0) return 0;

        // 找到最大访问次数用于归一化
        let maxVisitCount = 1;
        for (const visitCount of this.visitCountMap.values()) {
            maxVisitCount = Math.max(maxVisitCount, visitCount);
        }

        return Math.min(1.0, (totalHotness / count) / maxVisitCount);
    }

    /**
     * 计算百分位图
     */
    private calculatePercentileMap(hotnessMap: Map<string, number>): Map<string, number> {
        const percentileMap = new Map<string, number>();

        // 收集所有热度值
        const hotnessValues = Array.from(hotnessMap.values()).filter(h => h > 0);
        hotnessValues.sort((a, b) => a - b);

        if (hotnessValues.length === 0) {
            // 没有热度值，所有位置百分位为0
            for (const key of hotnessMap.keys()) {
                percentileMap.set(key, 0);
            }
            return percentileMap;
        }

        // 计算每个位置的百分位
        for (const [key, hotness] of hotnessMap.entries()) {
            if (hotness === 0) {
                percentileMap.set(key, 0);
            } else {
                // 找到在排序数组中的位置
                let percentile = 0;
                for (let i = 0; i < hotnessValues.length; i++) {
                    if (hotnessValues[i] >= hotness) {
                        percentile = i / hotnessValues.length;
                        break;
                    }
                }
                percentileMap.set(key, percentile);
            }
        }

        return percentileMap;
    }

    /**
     * 计算价格系数
     */
    private calculatePriceCoefficients(percentileMap: Map<string, number>): Map<string, number> {
        const coefficientMap = new Map<string, number>();

        for (const [key, percentile] of percentileMap.entries()) {
            // 将百分位映射到价格系数 (0.5 - 2.0)
            // 0百分位 -> 0.5x
            // 100百分位 -> 2.0x
            const coefficient = 0.5 + percentile * 1.5;
            coefficientMap.set(key, coefficient);
        }

        return coefficientMap;
    }

    /**
     * 识别热点和冷点
     */
    private identifyHotAndColdSpots(percentileMap: Map<string, number>): {
        hotSpots: Vec2[];
        coldSpots: Vec2[];
    } {
        const hotSpots: Vec2[] = [];
        const coldSpots: Vec2[] = [];

        for (const [key, percentile] of percentileMap.entries()) {
            const pos = CoordUtils.keyToPos(key);

            // 前10%为热点
            if (percentile >= 0.9) {
                hotSpots.push(pos);
            }
            // 后10%为冷点
            else if (percentile <= 0.1) {
                coldSpots.push(pos);
            }
        }

        return { hotSpots, coldSpots };
    }
}