/**
 * PathExtender - 路径延伸工具
 *
 * 用于净化卡：从选中tile继续单向延伸到指定步数
 * 新架构：使用四方向邻居系统（w/n/e/s）
 *
 * @author Web3 Tycoon Team
 */

import { MapGraph } from './MapGraph';
import { BFSPathfinder } from './BFSPathfinder';
import { MapTemplate, TileStatic } from '../types/map';

/**
 * 四个方向
 */
type Direction = 'w' | 'n' | 'e' | 's';

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
    private template: MapTemplate;

    constructor(graph: MapGraph) {
        this.graph = graph;
        this.template = graph.getTemplate();
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

        console.log(`[PathExtender] 到目标点距离: ${distanceToTarget}, 总步数: ${totalSteps}`);
        console.log(`[PathExtender] 到目标点路径: [${pathToTarget.join(' -> ')}]`);

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

        // 推导延伸方向
        if (pathToTarget.length < 2) {
            return {
                fullPath: pathToTarget,
                success: false,
                error: '路径太短，无法推导延伸方向'
            };
        }

        const prevTile = pathToTarget[pathToTarget.length - 2];
        const direction = this.inferDirection(prevTile, targetTile);

        if (!direction) {
            return {
                fullPath: pathToTarget,
                success: false,
                error: '无法推导延伸方向（两个tile不相邻）'
            };
        }

        console.log(`[PathExtender] 推导方向: ${direction}, 剩余步数: ${remainingSteps}`);

        // 延伸路径
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

        console.log(`[PathExtender] 完整路径: [${fullPath.join(' -> ')}]`);

        return {
            fullPath,
            success: true
        };
    }

    /**
     * 推导从prevTile到currentTile的移动方向
     *
     * 逻辑：检查currentTile的哪个邻居是prevTile
     * - 如果current.w == prev，说明从西边来，应该继续向东（e）
     * - 如果current.n == prev，说明从北边来，应该继续向南（s）
     * - 如果current.e == prev，说明从东边来，应该继续向西（w）
     * - 如果current.s == prev，说明从南边来，应该继续向北（n）
     *
     * @param prevTile 前一个tile
     * @param currentTile 当前tile
     * @returns 继续前进的方向，如果不相邻返回null
     */
    private inferDirection(prevTile: number, currentTile: number): Direction | null {
        const current = this.template.tiles_static.get(currentTile);
        if (!current) {
            console.error(`[PathExtender] Tile ${currentTile} 不存在`);
            return null;
        }

        // 检查prev从哪个方向进入current
        if (current.w === prevTile) {
            // 从西边来，继续向东
            return 'e';
        } else if (current.n === prevTile) {
            // 从北边来，继续向南
            return 's';
        } else if (current.e === prevTile) {
            // 从东边来，继续向西
            return 'w';
        } else if (current.s === prevTile) {
            // 从南边来，继续向北
            return 'n';
        }

        // 不是直接邻居
        return null;
    }

    /**
     * 沿指定方向延伸路径
     *
     * @param startTile 起始tile
     * @param direction 延伸方向
     * @param steps 延伸步数
     * @param visited 已访问的tile集合（避免循环）
     * @returns 延伸结果
     */
    private extendInDirection(
        startTile: number,
        direction: Direction,
        steps: number,
        visited: Set<number>
    ): PathExtensionResult {
        const path: number[] = [startTile];
        let currentTile = startTile;
        let currentDirection = direction;

        for (let i = 0; i < steps; i++) {
            const current = this.template.tiles_static.get(currentTile);
            if (!current) {
                return {
                    fullPath: path,
                    success: false,
                    error: `Tile ${currentTile} 不存在`
                };
            }

            // 获取当前方向的下一个tile
            const nextTile = this.getNextTileInDirection(current, currentDirection);

            if (nextTile === null) {
                return {
                    fullPath: path,
                    success: false,
                    error: `方向 ${currentDirection} 已到尽头（无效邻居）`
                };
            }

            // 检查是否已访问
            if (visited.has(nextTile)) {
                return {
                    fullPath: path,
                    success: false,
                    error: '路径出现循环'
                };
            }

            path.push(nextTile);
            visited.add(nextTile);

            // 更新当前tile，方向保持不变（单向延伸）
            currentTile = nextTile;
        }

        return {
            fullPath: path,
            success: true
        };
    }

    /**
     * 获取指定方向的下一个tile
     *
     * @param tile 当前tile数据
     * @param direction 方向
     * @returns 下一个tile ID，如果无效返回null
     */
    private getNextTileInDirection(tile: TileStatic, direction: Direction): number | null {
        let nextId: number;

        switch (direction) {
            case 'w':
                nextId = tile.w;
                break;
            case 'n':
                nextId = tile.n;
                break;
            case 'e':
                nextId = tile.e;
                break;
            case 's':
                nextId = tile.s;
                break;
            default:
                return null;
        }

        // 检查是否有效（65535表示无效邻居）
        if (nextId === 65535) {
            return null;
        }

        return nextId;
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
