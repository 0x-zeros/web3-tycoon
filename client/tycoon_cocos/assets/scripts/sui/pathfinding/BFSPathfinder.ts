/**
 * BFS寻路算法实现
 * 用于查找从起点出发k步内的所有可达地块
 */

import { MapGraph } from './MapGraph';

/**
 * BFS搜索结果
 */
export interface BFSResult {
    /** 可达地块集合 (距离 -> 地块ID列表) */
    reachableTiles: Map<number, bigint[]>;
    /** 每个地块的父节点 (用于回溯路径) */
    parents: Map<bigint, bigint>;
    /** 每个地块的距离 */
    distances: Map<bigint, number>;
    /** 最短路径树 */
    pathTree: Map<bigint, bigint[]>;
}

/**
 * 路径信息
 */
export interface PathInfo {
    /** 目标地块 */
    target: bigint;
    /** 路径上的地块序列 (包含起点和终点) */
    path: bigint[];
    /** 路径长度 */
    distance: number;
}

/**
 * BFS寻路器
 * 实现广度优先搜索算法，查找k步内可达的所有地块
 */
export class BFSPathfinder {
    private graph: MapGraph;

    constructor(graph: MapGraph) {
        this.graph = graph;
    }

    /**
     * 执行BFS搜索
     * @param start 起始地块ID
     * @param maxSteps 最大步数
     * @returns BFS搜索结果
     */
    public search(start: bigint, maxSteps: number): BFSResult {
        const reachableTiles = new Map<number, bigint[]>();
        const parents = new Map<bigint, bigint>();
        const distances = new Map<bigint, number>();
        const pathTree = new Map<bigint, bigint[]>();

        // 初始化
        const queue: { tile: bigint; distance: number }[] = [];
        const visited = new Set<bigint>();

        // 起点
        queue.push({ tile: start, distance: 0 });
        visited.add(start);
        distances.set(start, 0);
        reachableTiles.set(0, [start]);

        // BFS
        while (queue.length > 0) {
            const { tile: current, distance } = queue.shift()!;

            // 达到最大步数，停止扩展
            if (distance >= maxSteps) {
                continue;
            }

            // 获取邻居
            const neighbors = this.graph.getNeighbors(current);

            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    parents.set(neighbor, current);
                    distances.set(neighbor, distance + 1);

                    // 添加到可达地块集合
                    if (!reachableTiles.has(distance + 1)) {
                        reachableTiles.set(distance + 1, []);
                    }
                    reachableTiles.get(distance + 1)!.push(neighbor);

                    // 构建路径树
                    const parentPath = pathTree.get(current) || [current];
                    pathTree.set(neighbor, [...parentPath, neighbor]);

                    // 加入队列
                    queue.push({ tile: neighbor, distance: distance + 1 });
                }
            }
        }

        return {
            reachableTiles,
            parents,
            distances,
            pathTree
        };
    }

    /**
     * 查找从起点到目标的最短路径
     * @param start 起始地块ID
     * @param target 目标地块ID
     * @param maxSteps 最大步数限制
     * @returns 路径信息，如果无法到达则返回null
     */
    public findPath(start: bigint, target: bigint, maxSteps: number): PathInfo | null {
        const result = this.search(start, maxSteps);

        // 检查目标是否可达
        const distance = result.distances.get(target);
        if (distance === undefined || distance > maxSteps) {
            return null;
        }

        // 从路径树中获取路径
        const path = result.pathTree.get(target) || [];
        if (path.length === 0 && target !== start) {
            return null;
        }

        // 如果目标就是起点
        if (target === start) {
            return {
                target,
                path: [start],
                distance: 0
            };
        }

        return {
            target,
            path,
            distance
        };
    }

    /**
     * 获取k步内所有可达的地块
     * @param start 起始地块ID
     * @param steps 步数
     * @returns 可达地块ID列表
     */
    public getReachableTiles(start: bigint, steps: number): bigint[] {
        const result = this.search(start, steps);
        const tiles: bigint[] = [];

        for (let i = 0; i <= steps; i++) {
            const tilesAtDistance = result.reachableTiles.get(i) || [];
            tiles.push(...tilesAtDistance);
        }

        return tiles;
    }

    /**
     * 获取恰好k步可达的地块
     * @param start 起始地块ID
     * @param steps 步数
     * @returns 恰好k步可达的地块ID列表
     */
    public getTilesAtExactDistance(start: bigint, steps: number): bigint[] {
        const result = this.search(start, steps);
        return result.reachableTiles.get(steps) || [];
    }

    /**
     * 回溯路径
     * @param start 起始地块
     * @param target 目标地块
     * @param parents 父节点映射
     * @returns 路径数组，从起点到终点
     */
    private reconstructPath(
        start: bigint,
        target: bigint,
        parents: Map<bigint, bigint>
    ): bigint[] {
        const path: bigint[] = [];
        let current = target;

        // 回溯路径
        while (current !== start) {
            path.unshift(current);
            const parent = parents.get(current);
            if (parent === undefined) {
                // 无法到达
                return [];
            }
            current = parent;
        }

        // 添加起点
        path.unshift(start);
        return path;
    }

    /**
     * 调试：打印搜索结果
     */
    public debugPrintResult(result: BFSResult): void {
        console.log('[BFSPathfinder] Search result:');

        for (const [distance, tiles] of result.reachableTiles) {
            console.log(`  Distance ${distance}: [${tiles.join(', ')}]`);
        }

        console.log('  Path tree:');
        for (const [tile, path] of result.pathTree) {
            console.log(`    To ${tile}: [${path.join(' -> ')}]`);
        }
    }
}