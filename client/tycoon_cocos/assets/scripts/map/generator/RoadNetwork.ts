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

        console.log(`[RoadNetwork] 开始生成 ${this.params.mode} 模式道路网络`);

        if (this.params.mode === MapGenerationMode.CLASSIC) {
            this.generateClassicRoads();
        } else {
            this.generateBrawlRoads();
        }

        console.log(`[RoadNetwork] 道路生成完成，共 ${this.roadSet.size} 个道路格子`);

        // 确保道路连通性
        this.ensureConnectivity();

        // 识别交叉路口
        this.identifyIntersections();

        // 构建连通性图
        const connectivity = this.buildConnectivityGraph();

        // 验证连通性
        const components = this.findConnectedComponents();
        console.log(`[RoadNetwork] 道路网络连通性检查：发现 ${components.length} 个连通分量`);
        if (components.length > 1) {
            console.warn(`[RoadNetwork] 警告：道路网络不完全连通！最大分量包含 ${Math.max(...components.map(c => c.length))} 个节点`);
        }

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

        // 根据周长计算采样点数量，确保足够密集
        const circumference = 2 * Math.PI * ringRadius;
        const steps = Math.max(Math.floor(circumference * 2), 120); // 至少120个点，或周长的2倍

        const ringPoints: Vec2[] = [];
        const uniquePoints = new Set<string>();

        // 收集环形上的所有采样点，避免重复
        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const x = Math.floor(centerX + Math.cos(angle) * ringRadius);
            const y = Math.floor(centerY + Math.sin(angle) * ringRadius);

            if (this.isValidPosition(x, y)) {
                const key = `${x},${y}`;
                if (!uniquePoints.has(key)) {
                    uniquePoints.add(key);
                    ringPoints.push(new Vec2(x, y));
                }
            }
        }

        console.log(`[RoadNetwork] 环形道路采样点数：${ringPoints.length}`);

        // 连接相邻的点形成完整的环形
        if (ringPoints.length > 2) {
            for (let i = 0; i < ringPoints.length; i++) {
                const currentPoint = ringPoints[i];
                const nextPoint = ringPoints[(i + 1) % ringPoints.length]; // 使用模运算确保环形闭合

                // 连接当前点和下一个点
                this.drawLine(currentPoint, nextPoint, true);
            }

            // 确保最后一个点连接到第一个点，形成闭合环
            if (ringPoints.length > 0) {
                this.drawLine(ringPoints[ringPoints.length - 1], ringPoints[0], true);
            }
        }
    }

    /**
     * 生成放射状支路
     */
    private generateRadialRoads(centerX: number, centerY: number): void {
        const { mapWidth, mapHeight } = this.params;
        const numRadialRoads = 8; // 8个方向
        const maxLength = Math.min(mapWidth, mapHeight) * 0.45;

        for (let i = 0; i < numRadialRoads; i++) {
            const angle = (i / numRadialRoads) * Math.PI * 2;

            // 计算终点坐标
            const endX = Math.floor(centerX + Math.cos(angle) * maxLength);
            const endY = Math.floor(centerY + Math.sin(angle) * maxLength);

            // 使用drawLine从中心连接到边缘，确保连续性
            const startPos = new Vec2(centerX, centerY);
            const endPos = new Vec2(endX, endY);

            // 前60%为主干道
            const mainRoadLength = maxLength * 0.6;
            const midX = Math.floor(centerX + Math.cos(angle) * mainRoadLength);
            const midY = Math.floor(centerY + Math.sin(angle) * mainRoadLength);
            const midPos = new Vec2(midX, midY);

            // 画主干道部分
            this.drawLine(startPos, midPos, true);
            // 画支路部分
            this.drawLine(midPos, endPos, false);
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
     * 使用Bresenham算法画线连接两点
     * @param pos1 起始点
     * @param pos2 结束点
     * @param isMainRoad 是否为主干道
     */
    private drawLine(pos1: Vec2, pos2: Vec2, isMainRoad: boolean = false): void {
        const x0 = Math.floor(pos1.x);
        const y0 = Math.floor(pos1.y);
        const x1 = Math.floor(pos2.x);
        const y1 = Math.floor(pos2.y);

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        let x = x0;
        let y = y0;

        while (true) {
            // 添加当前点到道路
            if (this.isValidPosition(x, y)) {
                const key = CoordUtils.posToKey(new Vec2(x, y));
                this.roadSet.add(key);

                if (isMainRoad) {
                    this.mainRoadSet.add(key);
                } else {
                    this.sideRoadSet.add(key);
                }

                // 增加道路宽度
                if (isMainRoad && this.params.mainRoadWidth && this.params.mainRoadWidth > 1) {
                    this.widenRoad(x, y, this.params.mainRoadWidth, true);
                }
            }

            // 到达终点
            if (x === x1 && y === y1) break;

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
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