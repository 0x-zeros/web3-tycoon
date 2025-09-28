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
     * 生成Classic模式道路（单一闭环路径，适配大富翁）
     *
     * 在地图边界内按给定边距生成一个矩形闭环路径，确保100%连通，
     * 便于在环路外侧或内侧布置地产。
     */
    private generateClassicRoads(): void {
        const { mapWidth, mapHeight } = this.params;

        // 边距（避免贴边，留出一圈给地产/装饰），最小为1
        const margin = Math.max(2, Math.floor(Math.min(mapWidth, mapHeight) * 0.08));

        // 1) 先构建基础矩形闭环
        this.generatePerimeterLoop(margin);

        // 2) 在四条边上添加随机“凸起/凹陷”模块，营造大富翁风格的折线与弯折
        this.addVarietyBulges(margin);

        // 3) 可选：添加1-2条跨越连接，形成捷径与多环结构（仍保持整体连通）
        const addShortcutProb = 0.6;
        if (this.random() < addShortcutProb) {
            this.addShortcuts(1 + (this.random() < 0.4 ? 1 : 0));
        }
    }

    /**
     * 生成矩形外沿闭环（顺时针围一圈）
     */
    private generatePerimeterLoop(margin: number): void {
        const { mapWidth, mapHeight } = this.params;
        const left = margin;
        const right = mapWidth - 1 - margin;
        const top = margin;
        const bottom = mapHeight - 1 - margin;

        if (right - left < 2 || bottom - top < 2) {
            // 地图太小，退化为全边框
            for (let x = 0; x < mapWidth; x++) {
                this.addRoad(new Vec2(x, 0), true);
                this.addRoad(new Vec2(x, mapHeight - 1), true);
            }
            for (let y = 0; y < mapHeight; y++) {
                this.addRoad(new Vec2(0, y), true);
                this.addRoad(new Vec2(mapWidth - 1, y), true);
            }
            return;
        }

        // 上边（left -> right, y=top）
        for (let x = left; x <= right; x++) {
            this.addRoad(new Vec2(x, top), true);
        }
        // 右边（top+1 -> bottom-1, x=right）
        for (let y = top + 1; y <= bottom - 1; y++) {
            this.addRoad(new Vec2(right, y), true);
        }
        // 下边（right -> left, y=bottom）
        for (let x = right; x >= left; x--) {
            this.addRoad(new Vec2(x, bottom), true);
        }
        // 左边（bottom-1 -> top+1, x=left）
        for (let y = bottom - 1; y >= top + 1; y--) {
            this.addRoad(new Vec2(left, y), true);
        }
    }

    /** 在集合中添加一格道路 */
    private addRoad(pos: Vec2, isMain: boolean): void {
        const key = CoordUtils.posToKey(pos);
        this.roadSet.add(key);
        if (isMain) this.mainRoadSet.add(key);
        else this.sideRoadSet.add(key);
    }

    /**
     * 在四条边上添加随机“凸起/凹陷”
     * 不破坏连通性，只在原有闭环上做局部矩形绕行
     */
    private addVarietyBulges(margin: number): void {
        const { mapWidth, mapHeight } = this.params;
        const left = margin;
        const right = mapWidth - 1 - margin;
        const top = margin;
        const bottom = mapHeight - 1 - margin;

        // 定义四条边的走向与法线（优先从矩形内外随机偏移）
        const edges: Array<{ start: Vec2; end: Vec2; axis: Vec2; normals: Vec2[] }>= [
            // 顶边：从左到右，法线朝上/下
            { start: new Vec2(left, top), end: new Vec2(right, top), axis: new Vec2(1, 0), normals: [new Vec2(0, -1), new Vec2(0, 1)] },
            // 右边：从上到下，法线朝右/左
            { start: new Vec2(right, top), end: new Vec2(right, bottom), axis: new Vec2(0, 1), normals: [new Vec2(1, 0), new Vec2(-1, 0)] },
            // 底边：从右到左，法线朝下/上
            { start: new Vec2(right, bottom), end: new Vec2(left, bottom), axis: new Vec2(-1, 0), normals: [new Vec2(0, 1), new Vec2(0, -1)] },
            // 左边：从下到上，法线朝左/右
            { start: new Vec2(left, bottom), end: new Vec2(left, top), axis: new Vec2(0, -1), normals: [new Vec2(-1, 0), new Vec2(1, 0)] },
        ];

        for (const edge of edges) {
            this.addBulgesAlong(edge.start, edge.end, edge.axis, edge.normals);
        }
    }

    /**
     * 沿着一条边按随机间距添加凸起矩形绕行
     */
    private addBulgesAlong(start: Vec2, end: Vec2, axis: Vec2, normals: Vec2[]): void {
        // 基础参数可调：最大凸起数量、长度与深度范围、最小间距
        const maxBulges = 3 + Math.floor(this.random() * 3); // 3~5 个
        const minLen = 3, maxLen = 6;
        const minDepth = 1, maxDepth = Math.max(1, Math.min(3, Math.floor(Math.min(this.params.mapWidth, this.params.mapHeight) * 0.06)));
        const minGap = 4; // 凸起之间最小间距

        const axisLength = Math.abs(start.x - end.x) + Math.abs(start.y - end.y);
        if (axisLength < 8) return;

        // 在 [1, axisLength-2] 中采样锚点（避免贴近拐角）
        const anchors: number[] = [];
        let tries = 0;
        while (anchors.length < maxBulges && tries < 20) {
            const a = 1 + Math.floor(this.random() * (axisLength - 2));
            const ok = anchors.every(other => Math.abs(other - a) >= minGap);
            if (ok) anchors.push(a);
            tries++;
        }

        // 对每个锚点添加一个 L 形绕行：出轴 -> 沿轴 -> 回轴
        for (const a of anchors) {
            const len = minLen + Math.floor(this.random() * (maxLen - minLen + 1));
            const depth = minDepth + Math.floor(this.random() * (maxDepth - minDepth + 1));
            const normal = normals[Math.floor(this.random() * normals.length)];

            const anchor = this.advance(start, axis, a);
            const p1 = this.advance(anchor, normal, depth);          // 出轴
            const p2 = this.advance(p1, axis, len);                  // 沿轴
            const p3 = this.advance(p2, new Vec2(-normal.x, -normal.y), depth); // 回轴

            // 边界校验后绘制三段
            if (this.segmentValid(anchor, p1) && this.segmentValid(p1, p2) && this.segmentValid(p2, p3)) {
                this.drawLine(anchor, p1, false);
                this.drawLine(p1, p2, false);
                this.drawLine(p2, p3, false);
            }
        }
    }

    /** 沿方向前进 n 步 */
    private advance(from: Vec2, dir: Vec2, steps: number): Vec2 {
        return new Vec2(from.x + dir.x * steps, from.y + dir.y * steps);
    }

    /** 检查线段上所有格是否在边界内 */
    private segmentValid(a: Vec2, b: Vec2): boolean {
        const dx = Math.sign(b.x - a.x);
        const dy = Math.sign(b.y - a.y);
        let x = a.x, y = a.y;
        while (true) {
            if (!this.isValidPosition(x, y)) return false;
            if (x === b.x && y === b.y) break;
            if (dx !== 0) x += dx; else y += dy;
        }
        return true;
    }

    /**
     * 添加若干条跨越连接，将环路的远端点用曼哈顿路径连接，形成“捷径/桥”。
     */
    private addShortcuts(count: number): void {
        const roadKeys = Array.from(this.roadSet);
        if (roadKeys.length < 12) return;

        for (let i = 0; i < count; i++) {
            const k1 = roadKeys[Math.floor(this.random() * roadKeys.length)];
            const p1 = CoordUtils.keyToPos(k1);

            // 寻找与 p1 距离较远的另一个点
            let bestKey = k1;
            let bestDist = 0;
            for (let j = 0; j < 30; j++) {
                const k2 = roadKeys[Math.floor(this.random() * roadKeys.length)];
                if (k2 === k1) continue;
                const p2 = CoordUtils.keyToPos(k2);
                const d = CoordUtils.manhattanDistance(p1, p2);
                if (d > bestDist) { bestDist = d; bestKey = k2; }
            }

            if (bestKey !== k1 && bestDist > 6) {
                const p2 = CoordUtils.keyToPos(bestKey);
                this.connectPoints(p1, p2);
            }
        }
    }

    // Classic模式不再生成放射状支路，保留方法以兼容历史调用但不执行
    private generateRadialRoads(_centerX: number, _centerY: number): void { /* noop for classic loop */ }

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
