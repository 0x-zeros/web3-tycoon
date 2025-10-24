/**
 * PathExtender - 路径延伸工具
 *
 * 用于净化卡：从选中tile继续单向延伸到指定步数
 *
 * @author Web3 Tycoon Team
 */

import { MapGraph } from './MapGraph';
import { BFSPathfinder, PathInfo } from './BFSPathfinder';

/**
 * 路径延伸结果
 */
export interface PathExtensionResult {
    /** 完整路径（包含起点和终点） */
    fullPath: number[];
    /** 是否成功 */
    success: boolean;
    /** 错误信息 */
    error?: string;
}

/**
 * 路径延伸工具
 * 用于净化卡：从选中tile继续单向延伸到指定步数
 */
export class PathExtender {
    private graph: MapGraph;

    constructor(graph: MapGraph) {
        this.graph = graph;
    }

    /**
     * 计算从起点到目标点，再单向延伸到totalSteps的完整路径
     *
     * @param startTile 起始tile
     * @param targetTile 目标tile
     * @param totalSteps 总步数（默认10）
     * @returns 路径延伸结果
     */
    extendPath(
        startTile: number,
        targetTile: number,
        totalSteps: number = 10
    ): PathExtensionResult {
        // 1. 使用BFS计算起点到目标点的路径
        const pathfinder = new BFSPathfinder(this.graph);
        const bfsResult = pathfinder.search(BigInt(startTile), totalSteps);

        // 找到目标点的路径
        const pathInfo = pathfinder.getPathTo(bfsResult, BigInt(targetTile));
        if (!pathInfo) {
            return {
                fullPath: [],
                success: false,
                error: '无法到达目标位置'
            };
        }

        // 转换为number数组
        const pathToTarget = pathInfo.path.map(t => Number(t));
        const distanceToTarget = pathInfo.distance;

        // 2. 检查是否还需要延伸
        if (distanceToTarget >= totalSteps) {
            // 目标点已经达到或超过总步数，直接返回路径
            return {
                fullPath: pathToTarget.slice(0, totalSteps + 1),
                success: true
            };
        }

        // 3. 从目标点继续单向延伸
        const remainingSteps = totalSteps - distanceToTarget;
        const direction = this.calculateDirection(
            pathToTarget[pathToTarget.length - 2],
            targetTile
        );

        const extendedPath = this.extendInDirection(
            targetTile,
            direction,
            remainingSteps,
            new Set(pathToTarget) // 避免回头
        );

        if (!extendedPath.success) {
            return extendedPath;
        }

        // 4. 合并路径（去重目标点）
        const fullPath = [
            ...pathToTarget,
            ...extendedPath.fullPath.slice(1) // 跳过第一个（重复的目标点）
        ];

        return {
            fullPath,
            success: true
        };
    }

    /**
     * 计算从prevTile到currentTile的方向
     */
    private calculateDirection(prevTile: number, currentTile: number): string {
        const neighbors = this.graph.getNeighbors(BigInt(prevTile));
        const currentBigInt = BigInt(currentTile);

        for (const [dir, neighborId] of neighbors) {
            if (neighborId === currentBigInt) {
                return dir;
            }
        }

        return 'unknown';
    }

    /**
     * 沿指定方向延伸路径
     */
    private extendInDirection(
        startTile: number,
        direction: string,
        steps: number,
        visited: Set<number>
    ): PathExtensionResult {
        const path: number[] = [startTile];
        let currentTile = startTile;

        for (let i = 0; i < steps; i++) {
            const neighbors = this.graph.getNeighbors(BigInt(currentTile));

            // 尝试沿相同方向前进
            let nextTile: bigint | null = null;

            if (neighbors.has(direction)) {
                nextTile = neighbors.get(direction)!;
            } else {
                // 如果原方向不可达，检查是否只有唯一的其他方向
                const availableDirections = Array.from(neighbors.entries())
                    .filter(([_, tileId]) => !visited.has(Number(tileId)));

                if (availableDirections.length === 1) {
                    // 唯一方向，继续前进
                    nextTile = availableDirections[0][1];
                    direction = availableDirections[0][0]; // 更新方向
                } else if (availableDirections.length === 0) {
                    return {
                        fullPath: path,
                        success: false,
                        error: '路径已到尽头'
                    };
                } else {
                    return {
                        fullPath: path,
                        success: false,
                        error: '遇到分叉路口，无法确定方向'
                    };
                }
            }

            const nextTileNum = Number(nextTile);

            // 检查是否已访问
            if (visited.has(nextTileNum)) {
                return {
                    fullPath: path,
                    success: false,
                    error: '路径出现循环'
                };
            }

            path.push(nextTileNum);
            visited.add(nextTileNum);
            currentTile = nextTileNum;
        }

        return {
            fullPath: path,
            success: true
        };
    }

    /**
     * 检查从某个tile延伸指定步数是否可行（用于过滤可选tiles）
     *
     * @param startTile 起始tile
     * @param currentTile 当前检查的tile
     * @param totalSteps 总步数
     * @returns 是否可行
     */
    canExtend(startTile: number, currentTile: number, totalSteps: number): boolean {
        const result = this.extendPath(startTile, currentTile, totalSteps);
        return result.success;
    }
}
