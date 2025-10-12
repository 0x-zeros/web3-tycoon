/**
 * Right-hand Rule 算法实现（右手法则）
 *
 * 核心思想：
 * - 遇到分叉总是优先右转
 * - 优先级：右转 > 直行 > 左转 > 回头
 * - 路线有规律，形成固定环路
 * - 适合喜欢确定路径的玩家
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import type { MapTemplate } from '../types/map';
import {
    Direction,
    OppositeDirection,
    RightTurnDirection,
    LeftTurnDirection,
    INVALID_TILE_ID
} from './WalkingPreference';

/**
 * Right-hand Rule 算法类
 */
export class RightHandRule {
    /** 地图模板 */
    private template: MapTemplate;

    constructor(template: MapTemplate) {
        this.template = template;
    }

    /**
     * 推导当前前进方向
     *
     * 通过检查 currentTile 的邻居，找到 prevTile 的位置
     * 然后返回相反方向作为前进方向
     *
     * @param currentTile 当前 tile_id
     * @param prevTile 上一步的 tile_id
     * @returns 当前前进方向，如果无法推导返回 null
     */
    private inferMovingDirection(currentTile: number, prevTile: number): Direction | null {
        const tileStatic = this.template.tiles_static.get(currentTile);
        if (!tileStatic) return null;

        // 检查四个方向，找到 prevTile 的位置
        if (tileStatic.w === prevTile) return Direction.EAST;   // 从西边来，向东走
        if (tileStatic.n === prevTile) return Direction.SOUTH;  // 从北边来，向南走
        if (tileStatic.e === prevTile) return Direction.WEST;   // 从东边来，向西走
        if (tileStatic.s === prevTile) return Direction.NORTH;  // 从南边来，向北走

        return null;
    }

    /**
     * 计算相对方向的优先级列表
     *
     * 基于当前前进方向，返回 [右, 直, 左, 回头] 的方向列表
     *
     * @param movingDirection 当前前进方向
     * @returns 按优先级排序的方向数组
     */
    private getDirectionPriority(movingDirection: Direction): Direction[] {
        const right = RightTurnDirection[movingDirection];    // 右转
        const straight = movingDirection;                     // 直行
        const left = LeftTurnDirection[movingDirection];      // 左转
        const back = OppositeDirection[movingDirection];      // 回头

        return [right, straight, left, back];
    }

    /**
     * 计算下一个 tile（有前进方向）
     *
     * @param currentTile 当前所在的 tile_id
     * @param prevTile 上一步的 tile_id（用于推导方向）
     * @returns 下一个 tile_id，如果无路可走返回 INVALID_TILE_ID
     */
    public getNextTile(currentTile: number, prevTile: number): number {
        // 获取当前 tile 的静态数据
        const tileStatic = this.template.tiles_static.get(currentTile);
        if (!tileStatic) {
            console.warn(`[RightHandRule] Tile ${currentTile} not found in template`);
            return INVALID_TILE_ID;
        }

        // 获取所有四个方向的邻居
        const neighbors = {
            [Direction.WEST]: tileStatic.w,
            [Direction.NORTH]: tileStatic.n,
            [Direction.EAST]: tileStatic.e,
            [Direction.SOUTH]: tileStatic.s
        };

        // 推导当前前进方向
        const movingDirection = this.inferMovingDirection(currentTile, prevTile);
        if (movingDirection === null) {
            console.warn(`[RightHandRule] Cannot infer moving direction from ${prevTile} to ${currentTile}`);
            // 无法推导方向，尝试任意有效邻居（但排除回头）
            return this.getAnyValidNeighbor(currentTile, prevTile);
        }

        // 获取方向优先级：右 > 直 > 左 > 回头
        const priorities = this.getDirectionPriority(movingDirection);

        // 按优先级尝试每个方向
        for (const direction of priorities) {
            const nextTile = neighbors[direction];
            if (nextTile !== INVALID_TILE_ID) {
                return nextTile;
            }
        }

        // 所有方向都无效
        console.warn(`[RightHandRule] No valid neighbor found for tile ${currentTile}`);
        return INVALID_TILE_ID;
    }

    /**
     * 获取任意有效邻居（fallback 方法）
     *
     * 当无法推导方向时使用，排除回头方向
     */
    private getAnyValidNeighbor(currentTile: number, prevTile: number): number {
        const tileStatic = this.template.tiles_static.get(currentTile);
        if (!tileStatic) return INVALID_TILE_ID;

        const neighbors = [tileStatic.w, tileStatic.n, tileStatic.e, tileStatic.s];

        for (const neighbor of neighbors) {
            if (neighbor !== INVALID_TILE_ID && neighbor !== prevTile) {
                return neighbor;
            }
        }

        return INVALID_TILE_ID;
    }

    /**
     * 计算完整路径（带回溯）
     *
     * @param startTile 起始 tile_id
     * @param steps 需要走的步数
     * @param lastTile 上一步的 tile_id（用于推导第一步方向）
     * @returns 路径数组（尽可能达到 steps 个 tile_id）
     */
    public calculatePath(
        startTile: number,
        steps: number,
        lastTile: number = INVALID_TILE_ID
    ): number[] {
        const path: number[] = [];
        const visitCount = new Map<number, number>();
        const junctions: Array<{tile: number; prevTile: number; pathLength: number}> = [];

        let currentTile = startTile;
        let prevTile = lastTile;

        // 标记起始点访问
        visitCount.set(startTile, 1);

        // 使用 while 循环，明确控制路径长度
        while (path.length < steps) {
            // 获取所有有效邻居
            const neighbors = this.getValidNeighbors(currentTile, prevTile);

            if (neighbors.length === 0) {
                // 死胡同：尝试回溯
                if (junctions.length > 0) {
                    const junction = junctions.pop()!;

                    // 回退路径
                    path.splice(junction.pathLength);

                    // 恢复状态
                    currentTile = junction.tile;
                    prevTile = junction.prevTile;

                    console.log(`[RightHandRule] 回溯到分叉点: tile ${currentTile}, path length ${path.length}`);
                    continue;
                } else {
                    // 无法回溯，返回当前路径
                    console.warn(`[RightHandRule] 无法继续，返回 ${path.length} 步`);
                    break;
                }
            }

            // 记录分叉点（有多个选择时）
            if (neighbors.length > 1) {
                junctions.push({
                    tile: currentTile,
                    prevTile: prevTile,
                    pathLength: path.length
                });
            }

            // 选择下一个节点（使用右手法则优先级，但在同优先级时选访问少的）
            const nextTile = this.selectBestNeighbor(currentTile, prevTile, neighbors, visitCount);

            // 添加到路径
            path.push(nextTile);

            // 更新访问计数
            visitCount.set(nextTile, (visitCount.get(nextTile) || 0) + 1);

            // 更新状态
            prevTile = currentTile;
            currentTile = nextTile;
        }

        return path;
    }

    /**
     * 获取所有有效邻居（排除上一个 tile）
     */
    private getValidNeighbors(currentTile: number, lastTile: number): number[] {
        const tileStatic = this.template.tiles_static.get(currentTile);
        if (!tileStatic) return [];

        const neighbors: number[] = [];
        const allNeighbors = [
            tileStatic.w,
            tileStatic.n,
            tileStatic.e,
            tileStatic.s
        ];

        for (const neighbor of allNeighbors) {
            if (neighbor !== INVALID_TILE_ID && neighbor !== lastTile) {
                neighbors.push(neighbor);
            }
        }

        return neighbors;
    }

    /**
     * 选择最佳邻居（结合右手法则和访问次数）
     */
    private selectBestNeighbor(
        currentTile: number,
        prevTile: number,
        neighbors: number[],
        visitCount: Map<number, number>
    ): number {
        // 如果只有一个选择，直接返回
        if (neighbors.length === 1) {
            return neighbors[0];
        }

        // 尝试使用右手法则（如果能推导方向）
        const movingDirection = this.inferMovingDirection(currentTile, prevTile);
        if (movingDirection !== null) {
            const tileStatic = this.template.tiles_static.get(currentTile)!;
            const neighborMap = {
                [Direction.WEST]: tileStatic.w,
                [Direction.NORTH]: tileStatic.n,
                [Direction.EAST]: tileStatic.e,
                [Direction.SOUTH]: tileStatic.s
            };

            // 按右手法则优先级尝试
            const priorities = this.getDirectionPriority(movingDirection);
            for (const direction of priorities) {
                const candidate = neighborMap[direction];
                if (neighbors.includes(candidate)) {
                    return candidate;
                }
            }
        }

        // 无法使用右手法则，按访问次数选择
        neighbors.sort((a, b) => {
            const countA = visitCount.get(a) || 0;
            const countB = visitCount.get(b) || 0;
            return countA - countB;
        });

        return neighbors[0];
    }

    /**
     * 调试：打印路径信息
     */
    public debugPath(path: number[]): void {
        console.log('[RightHandRule] Path:', {
            length: path.length,
            tiles: path
        });
    }
}
