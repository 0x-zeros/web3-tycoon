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
        // ⚠️ 新架构暂不支持路径延伸（需要重新设计方向推导逻辑）
        // 原因：新架构使用四方向邻居（w/n/e/s），无cw_next/ccw_next字段
        console.error('[PathExtender] 当前架构暂不支持PathExtender，净化卡功能暂时禁用');
        return {
            fullPath: [startTile],
            success: false,
            error: '新架构暂不支持路径延伸功能，净化卡暂时不可用'
        };

        // 原有代码保留但不会执行（后续重构时参考）
        // TODO: 重新设计方向推导逻辑，使用四方向邻居系统

        /*
        // 1. 使用BFS计算起点到目标点的路径
        const pathfinder = new BFSPathfinder(this.graph);
        const bfsResult = pathfinder.search(startTile, totalSteps);

        // 找到目标点的路径
        const pathInfo = pathfinder.getPathTo(bfsResult, targetTile);
        if (!pathInfo) {
            return {
                fullPath: [],
                success: false,
                error: '无法到达目标位置'
            };
        }

        const pathToTarget = pathInfo.path;
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
        const directionType = this.calculateDirectionType(
            pathToTarget[pathToTarget.length - 2],
            targetTile
        );

        const extendedPath = this.extendInDirection(
            targetTile,
            directionType,
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
        */
    }

    /**
     * 计算从prevTile到currentTile的方向类型
     * ⚠️ 暂时禁用：依赖旧架构的getMoveType方法
     */
    private calculateDirectionType(prevTile: number, currentTile: number): 'cw' | 'ccw' | 'adj' | null {
        // return this.graph.getMoveType(prevTile, currentTile);
        return null;
    }

    /**
     * 沿指定方向延伸路径
     */
    private extendInDirection(
        startTile: number,
        directionType: 'cw' | 'ccw' | 'adj' | null,
        steps: number,
        visited: Set<number>
    ): PathExtensionResult {
        const path: number[] = [startTile];
        let currentTile = startTile;
        let currentDirType = directionType;

        for (let i = 0; i < steps; i++) {
            // 获取当前tile的信息（从MapGraph的template）
            const tileInfo = (this.graph as any).template.tiles.get(BigInt(currentTile));
            if (!tileInfo) {
                return {
                    fullPath: path,
                    success: false,
                    error: `Tile ${currentTile} 不存在`
                };
            }

            let nextTile: bigint | null = null;

            // 根据方向类型选择下一个tile
            if (currentDirType === 'cw') {
                // 顺时针方向
                nextTile = tileInfo.cw_next;
                if (nextTile === BigInt(0xFFFFFFFF) || nextTile === BigInt(65535)) {
                    return {
                        fullPath: path,
                        success: false,
                        error: '顺时针方向已到尽头'
                    };
                }
            } else if (currentDirType === 'ccw') {
                // 逆时针方向
                nextTile = tileInfo.ccw_next;
                if (nextTile === BigInt(0xFFFFFFFF) || nextTile === BigInt(65535)) {
                    return {
                        fullPath: path,
                        success: false,
                        error: '逆时针方向已到尽头'
                    };
                }
            } else if (currentDirType === 'adj') {
                // 邻接方向：只有一个未访问邻居时才继续
                const unvisitedAdj = tileInfo.adj.filter(
                    (adjId: bigint) => !visited.has(Number(adjId))
                );

                if (unvisitedAdj.length === 1) {
                    nextTile = unvisitedAdj[0];
                } else if (unvisitedAdj.length === 0) {
                    return {
                        fullPath: path,
                        success: false,
                        error: '路径已到尽头（adj无可达邻居）'
                    };
                } else {
                    return {
                        fullPath: path,
                        success: false,
                        error: '遇到分叉路口（多个adj邻居），无法确定方向'
                    };
                }
            } else {
                return {
                    fullPath: path,
                    success: false,
                    error: '无法确定移动方向'
                };
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

            // 更新当前tile（方向类型保持不变，沿同一方向延伸）
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
