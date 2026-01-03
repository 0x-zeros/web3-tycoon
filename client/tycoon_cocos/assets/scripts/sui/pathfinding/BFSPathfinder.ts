/**
 * BFS寻路算法实现
 * 用于查找从起点出发k步内的所有可达地块
 */

import { MapGraph } from './MapGraph';
import { INVALID_TILE_ID } from '../types/constants';

/**
 * BFS搜索结果
 */
export interface BFSResult {
    /** 可达地块集合 (距离 -> 地块ID列表) */
    reachableTiles: Map<number, number[]>;
    /** 每个地块的父节点 (用于回溯路径) */
    parents: Map<number, number>;
    /** 每个地块的距离 */
    distances: Map<number, number>;
    /** 最短路径树 */
    pathTree: Map<number, number[]>;
}

/**
 * 路径信息
 */
export interface PathInfo {
    /** 目标地块 */
    target: number;
    /** 路径上的地块序列 (包含起点和终点) */
    path: number[];
    /** 路径长度 */
    distance: number;
}

/**
 * 路径约束（用于遥控骰子）
 */
export interface PathConstraints {
    /** 上一步tile（用于避免回头） */
    lastTileId?: number;
    /** 强制第一步（转向卡等） */
    nextTileId?: number;
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
    public search(start: number, maxSteps: number): BFSResult {
        const reachableTiles = new Map<number, number[]>();
        const parents = new Map<number, number>();
        const distances = new Map<number, number>();
        const pathTree = new Map<number, number[]>();

        // 初始化
        const queue: { tile: number; distance: number }[] = [];
        const visited = new Set<number>();

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
     * 从BFS结果中提取到目标tile的路径信息
     * 供CardUsageManager使用
     * @param result BFS搜索结果
     * @param target 目标地块ID
     * @returns 路径信息，如果无法到达则返回null
     */
    public getPathTo(result: BFSResult, target: number): PathInfo | null {
        const distance = result.distances.get(target);
        if (distance === undefined) {
            return null;
        }

        const path = result.pathTree.get(target);
        if (!path) {
            return null;
        }

        return {
            target,
            path,
            distance
        };
    }

    /**
     * 查找从起点到目标的最短路径
     * @param start 起始地块ID
     * @param target 目标地块ID
     * @param maxSteps 最大步数限制
     * @returns 路径信息，如果无法到达则返回null
     */
    public findPath(start: number, target: number, maxSteps: number): PathInfo | null {
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
    public getReachableTiles(start: number, steps: number): number[] {
        const result = this.search(start, steps);
        const tiles: number[] = [];

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
    public getTilesAtExactDistance(start: number, steps: number): number[] {
        const result = this.search(start, steps);
        return result.reachableTiles.get(steps) || [];
    }

    /**
     * 查找满足约束的路径（避免回头、强制第一步）
     * 主要用于遥控骰子
     */
    public findPathWithConstraints(
        start: number,
        target: number,
        maxSteps: number,
        constraints: PathConstraints = {}
    ): PathInfo | null {
        if (maxSteps <= 0) return null;
        if (start === target) {
            return { target, path: [start], distance: 0 };
        }

        const lastTileId = constraints.lastTileId ?? INVALID_TILE_ID;
        const nextTileId = constraints.nextTileId ?? INVALID_TILE_ID;

        const queue: Array<{ tile: number; prev: number; path: number[] }> = [];
        const visited = new Set<string>();

        const enqueue = (tile: number, prev: number, path: number[]) => {
            const key = `${tile}|${prev}`;
            if (visited.has(key)) return;
            visited.add(key);
            queue.push({ tile, prev, path });
        };

        if (nextTileId !== INVALID_TILE_ID) {
            if (!this.graph.areNeighbors(start, nextTileId)) {
                console.warn(
                    `[BFSPathfinder] next_tile_id ${nextTileId} is not a neighbor of ${start}`
                );
                return null;
            }
            const initialPath = [start, nextTileId];
            if (nextTileId === target) {
                return { target, path: initialPath, distance: 1 };
            }
            enqueue(nextTileId, start, initialPath);
        } else {
            enqueue(start, lastTileId, [start]);
        }

        while (queue.length > 0) {
            const { tile: current, prev, path } = queue.shift()!;
            const stepsUsed = path.length - 1;
            if (stepsUsed >= maxSteps) continue;

            const neighbors = this.graph.getNeighbors(current);
            for (const next of neighbors) {
                if (!this.isValidStep(current, next, prev, neighbors)) {
                    continue;
                }

                const nextPath = [...path, next];
                const nextSteps = stepsUsed + 1;
                if (nextSteps > maxSteps) continue;

                if (next === target) {
                    return { target, path: nextPath, distance: nextSteps };
                }

                enqueue(next, current, nextPath);
            }
        }

        return null;
    }

    /**
     * 获取满足约束的可达tiles（用于遥控骰子可选范围）
     */
    public getReachableTilesWithConstraints(
        start: number,
        maxSteps: number,
        constraints: PathConstraints = {}
    ): number[] {
        if (maxSteps <= 0) return [];

        const lastTileId = constraints.lastTileId ?? INVALID_TILE_ID;
        const nextTileId = constraints.nextTileId ?? INVALID_TILE_ID;

        const queue: Array<{ tile: number; prev: number; steps: number }> = [];
        const visited = new Set<string>();
        const reachable = new Set<number>();

        const enqueue = (tile: number, prev: number, steps: number) => {
            const key = `${tile}|${prev}`;
            if (visited.has(key)) return;
            visited.add(key);
            queue.push({ tile, prev, steps });
        };

        if (nextTileId !== INVALID_TILE_ID) {
            if (!this.graph.areNeighbors(start, nextTileId)) {
                console.warn(
                    `[BFSPathfinder] next_tile_id ${nextTileId} is not a neighbor of ${start}`
                );
                return [];
            }
            if (maxSteps < 1) return [];
            reachable.add(nextTileId);
            enqueue(nextTileId, start, 1);
        } else {
            enqueue(start, lastTileId, 0);
        }

        while (queue.length > 0) {
            const { tile: current, prev, steps } = queue.shift()!;
            if (steps >= maxSteps) continue;

            const neighbors = this.graph.getNeighbors(current);
            for (const next of neighbors) {
                if (!this.isValidStep(current, next, prev, neighbors)) {
                    continue;
                }

                const nextSteps = steps + 1;
                if (nextSteps > maxSteps) continue;

                reachable.add(next);
                enqueue(next, current, nextSteps);
            }
        }

        return Array.from(reachable);
    }

    /**
     * 回溯路径
     * @param start 起始地块
     * @param target 目标地块
     * @param parents 父节点映射
     * @returns 路径数组，从起点到终点
     */
    private reconstructPath(
        start: number,
        target: number,
        parents: Map<number, number>
    ): number[] {
        const path: number[] = [];
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

    /**
     * 判断下一步是否合法（避免回头路）
     */
    private isValidStep(
        current: number,
        next: number,
        prev: number,
        neighbors: number[]
    ): boolean {
        if (next === current) return false;
        if (next !== prev) return true;
        return neighbors.length === 1 && neighbors[0] === prev;
    }
}
