/**
 * 道路网络生成器
 *
 * 负责生成地图的道路网络，支持Classic和Brawl两种模式
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Vec2 } from 'cc';
import {
    MapGeneratorParams,
    MapGenerationMode,
    RoadNetworkData,
    CoordUtils
} from './MapGeneratorTypes';

/**
 * 道路网络生成器
 */
export class RoadNetwork {
    private params: MapGeneratorParams;
    private random: () => number;
    private roadSet: Set<string> = new Set();
    private mainRoadSet: Set<string> = new Set();
    private sideRoadSet: Set<string> = new Set();
    private intersectionSet: Set<string> = new Set();

    constructor(params: MapGeneratorParams) {
        this.params = params;
        // 设置随机数生成器
        this.random = this.createRandomGenerator(params.seed);
    }

    /**
     * 创建随机数生成器
     */
    private createRandomGenerator(seed?: number): () => number {
        if (!seed) {
            return Math.random;
        }

        // 简单的LCG随机数生成器
        let s = seed;
        return () => {
            s = (s * 1664525 + 1013904223) % 2147483647;
            return s / 2147483647;
        };
    }

    /**
     * 生成道路网络
     */
    generate(): RoadNetworkData {
        this.roadSet.clear();
        this.mainRoadSet.clear();
        this.sideRoadSet.clear();
        this.intersectionSet.clear();

        if (this.params.mode === MapGenerationMode.CLASSIC) {
            this.generateClassicRoads();
        } else {
            this.generateBrawlRoads();
        }

        // 确保道路连通性
        this.ensureConnectivity();

        // 识别交叉路口
        this.identifyIntersections();

        // 构建连通性图
        const connectivity = this.buildConnectivityGraph();

        return {
            roads: Array.from(this.roadSet).map(k => CoordUtils.keyToPos(k)),
            mainRoads: Array.from(this.mainRoadSet).map(k => CoordUtils.keyToPos(k)),
            sideRoads: Array.from(this.sideRoadSet).map(k => CoordUtils.keyToPos(k)),
            intersections: Array.from(this.intersectionSet).map(k => CoordUtils.keyToPos(k)),
            connectivity
        };
    }

    /**
     * 生成Classic模式道路（环形主干道 + 放射状支路）
     */
    private generateClassicRoads(): void {
        const { mapWidth, mapHeight } = this.params;
        const centerX = Math.floor(mapWidth / 2);
        const centerY = Math.floor(mapHeight / 2);

        // 生成环形主干道
        this.generateRingRoad(centerX, centerY);

        // 生成放射状支路
        this.generateRadialRoads(centerX, centerY);

        // 生成额外的连接道路
        this.generateAdditionalRoads();
    }

    /**
     * 生成环形主干道
     */
    private generateRingRoad(centerX: number, centerY: number): void {
        const { mapWidth, mapHeight } = this.params;
        const ringRadius = Math.min(mapWidth, mapHeight) * 0.35;

        // 使用参数化方程生成环形道路
        const steps = 60;
        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const x = Math.floor(centerX + Math.cos(angle) * ringRadius);
            const y = Math.floor(centerY + Math.sin(angle) * ringRadius);

            if (this.isValidPosition(x, y)) {
                const key = CoordUtils.posToKey(new Vec2(x, y));
                this.roadSet.add(key);
                this.mainRoadSet.add(key);

                // 增加道路宽度
                if (this.params.mainRoadWidth && this.params.mainRoadWidth > 1) {
                    this.widenRoad(x, y, this.params.mainRoadWidth, true);
                }
            }
        }
    }

    /**
     * 生成放射状支路
     */
    private generateRadialRoads(centerX: number, centerY: number): void {
        const { mapWidth, mapHeight } = this.params;
        const numRadialRoads = 8; // 8个方向

        for (let i = 0; i < numRadialRoads; i++) {
            const angle = (i / numRadialRoads) * Math.PI * 2;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);

            // 从中心向外延伸
            const maxLength = Math.min(mapWidth, mapHeight) * 0.45;
            for (let dist = 0; dist < maxLength; dist++) {
                const x = Math.floor(centerX + dx * dist);
                const y = Math.floor(centerY + dy * dist);

                if (this.isValidPosition(x, y)) {
                    const key = CoordUtils.posToKey(new Vec2(x, y));
                    this.roadSet.add(key);
                    // 靠近中心的为主干道
                    if (dist < maxLength * 0.6) {
                        this.mainRoadSet.add(key);
                    } else {
                        this.sideRoadSet.add(key);
                    }
                }
            }
        }
    }

    /**
     * 生成Brawl模式道路（随机网络）
     */
    private generateBrawlRoads(): void {
        const { mapWidth, mapHeight, roadDensity } = this.params;
        const totalTiles = mapWidth * mapHeight;
        const targetRoadCount = Math.floor(totalTiles * roadDensity);

        // 生成随机起始点
        const numSeeds = Math.floor(5 + this.random() * 5);
        const seeds: Vec2[] = [];

        for (let i = 0; i < numSeeds; i++) {
            seeds.push(new Vec2(
                Math.floor(this.random() * mapWidth),
                Math.floor(this.random() * mapHeight)
            ));
        }

        // 从种子点开始生长道路
        for (const seed of seeds) {
            this.growRoadFromSeed(seed, targetRoadCount / numSeeds);
        }

        // 连接孤立的道路段
        this.connectIsolatedSegments();
    }

    /**
     * 从种子点生长道路
     */
    private growRoadFromSeed(seed: Vec2, maxLength: number): void {
        const queue: Vec2[] = [seed];
        let length = 0;

        while (queue.length > 0 && length < maxLength) {
            const current = queue.shift()!;
            const key = CoordUtils.posToKey(current);

            if (this.roadSet.has(key)) continue;
            if (!this.isValidPosition(current.x, current.y)) continue;

            this.roadSet.add(key);
            this.sideRoadSet.add(key);
            length++;

            // 随机选择扩展方向
            const neighbors = CoordUtils.getNeighbors(current);
            const validNeighbors = neighbors.filter(n =>
                this.isValidPosition(n.x, n.y) &&
                !this.roadSet.has(CoordUtils.posToKey(n))
            );

            if (validNeighbors.length > 0) {
                // 随机选择1-2个方向扩展
                const numExpand = this.random() < 0.7 ? 1 : 2;
                for (let i = 0; i < Math.min(numExpand, validNeighbors.length); i++) {
                    const idx = Math.floor(this.random() * validNeighbors.length);
                    queue.push(validNeighbors.splice(idx, 1)[0]);
                }
            }
        }
    }

    /**
     * 生成额外的连接道路
     */
    private generateAdditionalRoads(): void {
        const { mapWidth, mapHeight, roadDensity } = this.params;
        const currentDensity = this.roadSet.size / (mapWidth * mapHeight);

        if (currentDensity < roadDensity) {
            const additionalRoads = Math.floor((roadDensity - currentDensity) * mapWidth * mapHeight);

            for (let i = 0; i < additionalRoads; i++) {
                const x = Math.floor(this.random() * mapWidth);
                const y = Math.floor(this.random() * mapHeight);
                const pos = new Vec2(x, y);

                // 检查是否邻近现有道路
                if (this.isNearRoad(pos)) {
                    const key = CoordUtils.posToKey(pos);
                    this.roadSet.add(key);
                    this.sideRoadSet.add(key);
                }
            }
        }
    }

    /**
     * 加宽道路
     */
    private widenRoad(x: number, y: number, width: number, isMainRoad: boolean): void {
        const offset = Math.floor(width / 2);

        for (let dx = -offset; dx <= offset; dx++) {
            for (let dy = -offset; dy <= offset; dy++) {
                if (dx === 0 && dy === 0) continue;

                const nx = x + dx;
                const ny = y + dy;

                if (this.isValidPosition(nx, ny)) {
                    const key = CoordUtils.posToKey(new Vec2(nx, ny));
                    this.roadSet.add(key);
                    if (isMainRoad) {
                        this.mainRoadSet.add(key);
                    } else {
                        this.sideRoadSet.add(key);
                    }
                }
            }
        }
    }

    /**
     * 连接孤立的道路段
     */
    private connectIsolatedSegments(): void {
        const segments = this.findConnectedComponents();

        if (segments.length <= 1) return;

        // 连接所有段到最大的段
        const largestSegment = segments.reduce((a, b) => a.length > b.length ? a : b);

        for (const segment of segments) {
            if (segment === largestSegment) continue;

            // 找到两个段之间最近的点
            let minDist = Infinity;
            let bestPair: [Vec2, Vec2] | null = null;

            for (const pos1Str of segment) {
                const pos1 = CoordUtils.keyToPos(pos1Str);
                for (const pos2Str of largestSegment) {
                    const pos2 = CoordUtils.keyToPos(pos2Str);
                    const dist = CoordUtils.manhattanDistance(pos1, pos2);
                    if (dist < minDist) {
                        minDist = dist;
                        bestPair = [pos1, pos2];
                    }
                }
            }

            // 连接两点
            if (bestPair) {
                this.connectPoints(bestPair[0], bestPair[1]);
            }
        }
    }

    /**
     * 找到所有连通组件
     */
    private findConnectedComponents(): string[][] {
        const visited = new Set<string>();
        const components: string[][] = [];

        for (const roadKey of this.roadSet) {
            if (!visited.has(roadKey)) {
                const component = this.dfs(roadKey, visited);
                components.push(component);
            }
        }

        return components;
    }

    /**
     * 深度优先搜索
     */
    private dfs(startKey: string, visited: Set<string>): string[] {
        const stack = [startKey];
        const component: string[] = [];

        while (stack.length > 0) {
            const key = stack.pop()!;
            if (visited.has(key)) continue;

            visited.add(key);
            component.push(key);

            const pos = CoordUtils.keyToPos(key);
            const neighbors = CoordUtils.getNeighbors(pos);

            for (const neighbor of neighbors) {
                const neighborKey = CoordUtils.posToKey(neighbor);
                if (this.roadSet.has(neighborKey) && !visited.has(neighborKey)) {
                    stack.push(neighborKey);
                }
            }
        }

        return component;
    }

    /**
     * 连接两个点
     */
    private connectPoints(pos1: Vec2, pos2: Vec2): void {
        // 使用简单的直线连接（曼哈顿路径）
        let current = pos1.clone();

        while (!current.equals(pos2)) {
            const key = CoordUtils.posToKey(current);
            this.roadSet.add(key);
            this.sideRoadSet.add(key);

            // 先水平移动，再垂直移动
            if (current.x !== pos2.x) {
                current.x += current.x < pos2.x ? 1 : -1;
            } else if (current.y !== pos2.y) {
                current.y += current.y < pos2.y ? 1 : -1;
            }
        }
    }

    /**
     * 确保连通性
     */
    private ensureConnectivity(): void {
        const components = this.findConnectedComponents();

        if (components.length > 1) {
            console.log(`发现 ${components.length} 个孤立道路段，正在连接...`);
            this.connectIsolatedSegments();
        }
    }

    /**
     * 识别交叉路口
     */
    private identifyIntersections(): void {
        for (const roadKey of this.roadSet) {
            const pos = CoordUtils.keyToPos(roadKey);
            const neighbors = CoordUtils.getNeighbors(pos);

            // 计算道路邻居数量
            let roadNeighborCount = 0;
            for (const neighbor of neighbors) {
                if (this.roadSet.has(CoordUtils.posToKey(neighbor))) {
                    roadNeighborCount++;
                }
            }

            // 3个或以上道路邻居视为交叉路口
            if (roadNeighborCount >= 3) {
                this.intersectionSet.add(roadKey);
            }
        }
    }

    /**
     * 构建连通性图
     */
    private buildConnectivityGraph(): Map<string, Vec2[]> {
        const graph = new Map<string, Vec2[]>();

        for (const roadKey of this.roadSet) {
            const pos = CoordUtils.keyToPos(roadKey);
            const neighbors = CoordUtils.getNeighbors(pos);
            const roadNeighbors: Vec2[] = [];

            for (const neighbor of neighbors) {
                if (this.roadSet.has(CoordUtils.posToKey(neighbor))) {
                    roadNeighbors.push(neighbor);
                }
            }

            graph.set(roadKey, roadNeighbors);
        }

        return graph;
    }

    /**
     * 检查位置是否有效
     */
    private isValidPosition(x: number, y: number): boolean {
        return x >= 0 && x < this.params.mapWidth &&
               y >= 0 && y < this.params.mapHeight;
    }

    /**
     * 检查是否邻近道路
     */
    private isNearRoad(pos: Vec2): boolean {
        const neighbors = CoordUtils.getNeighbors(pos);
        return neighbors.some(n => this.roadSet.has(CoordUtils.posToKey(n)));
    }
}