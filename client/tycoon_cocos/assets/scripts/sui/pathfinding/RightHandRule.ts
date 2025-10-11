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
     * 计算完整路径
     *
     * @param startTile 起始 tile_id
     * @param steps 需要走的步数
     * @param lastTile 上一步的 tile_id（用于推导第一步方向）
     * @returns 路径数组（包含 steps 个 tile_id）
     */
    public calculatePath(
        startTile: number,
        steps: number,
        lastTile: number = INVALID_TILE_ID
    ): number[] {
        const path: number[] = [];
        let currentTile = startTile;
        let prevTile = lastTile;

        for (let i = 0; i < steps; i++) {
            // 第一步特殊处理：如果没有 lastTile，选择任意方向
            let nextTile: number;

            if (i === 0 && prevTile === INVALID_TILE_ID) {
                // 第一步且没有历史，随机选择一个有效邻居
                nextTile = this.getAnyValidNeighbor(currentTile, INVALID_TILE_ID);
            } else {
                // 正常情况：使用右手法则
                nextTile = this.getNextTile(currentTile, prevTile);
            }

            if (nextTile === INVALID_TILE_ID) {
                // 无法继续前进，路径计算提前结束
                console.warn(`[RightHandRule] Path blocked at step ${i}, tile ${currentTile}`);
                break;
            }

            // 添加到路径
            path.push(nextTile);

            // 更新状态
            prevTile = currentTile;
            currentTile = nextTile;
        }

        return path;
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
