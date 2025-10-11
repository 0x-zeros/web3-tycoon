/**
 * Rotor-Router 算法实现（探索模式）
 *
 * 核心思想：
 * - 每个路口记住上次选择的方向
 * - 下次到达该路口时，从下一个方向开始尝试
 * - 顺时针轮换所有方向，直到找到有效邻居
 * - 保证最终能走遍所有可达地块
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import type { MapTemplate } from '../types/map';
import {
    Direction,
    NextDirectionCW,
    RotorRouterHistory,
    INVALID_TILE_ID,
    createRotorRouterHistory
} from './WalkingPreference';

/**
 * Rotor-Router 算法类
 */
export class RotorRouter {
    /** 历史记录（每个路口的上次方向） */
    private history: RotorRouterHistory;

    /** 地图模板 */
    private template: MapTemplate;

    constructor(template: MapTemplate, history?: RotorRouterHistory) {
        this.template = template;
        this.history = history || createRotorRouterHistory();
    }

    /**
     * 计算下一个 tile
     *
     * @param currentTile 当前所在的 tile_id
     * @param lastTile 上一步的 tile_id（避免回头，65535 表示无限制）
     * @returns 下一个 tile_id，如果无路可走返回 INVALID_TILE_ID
     */
    public getNextTile(currentTile: number, lastTile: number = INVALID_TILE_ID): number {
        // 获取当前 tile 的静态数据
        const tileStatic = this.template.tiles_static.get(currentTile);
        if (!tileStatic) {
            console.warn(`[RotorRouter] Tile ${currentTile} not found in template`);
            return INVALID_TILE_ID;
        }

        // 获取所有四个方向的邻居
        const neighbors = {
            [Direction.WEST]: tileStatic.w,
            [Direction.NORTH]: tileStatic.n,
            [Direction.EAST]: tileStatic.e,
            [Direction.SOUTH]: tileStatic.s
        };

        // 获取上次选择的方向（如果没有记录，从 West 开始）
        const lastDirection = this.history.lastDirection.get(currentTile) ?? Direction.WEST;

        // 从下一个方向开始尝试（顺时针轮换）
        let direction = NextDirectionCW[lastDirection];
        let attempts = 0;

        // 最多尝试4个方向
        while (attempts < 4) {
            const nextTile = neighbors[direction];

            // 检查该方向是否有效
            if (nextTile !== INVALID_TILE_ID) {
                // 如果是第一步，不能回头
                if (lastTile === INVALID_TILE_ID || nextTile !== lastTile) {
                    // 找到有效邻居，更新历史记录并返回
                    this.history.lastDirection.set(currentTile, direction);
                    return nextTile;
                }
            }

            // 尝试下一个方向
            direction = NextDirectionCW[direction];
            attempts++;
        }

        // 所有方向都无法走，返回无效值
        console.warn(`[RotorRouter] No valid neighbor found for tile ${currentTile}`);
        return INVALID_TILE_ID;
    }

    /**
     * 计算完整路径
     *
     * @param startTile 起始 tile_id
     * @param steps 需要走的步数
     * @param lastTile 上一步的 tile_id（避免第一步回头）
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
            // 计算下一个 tile
            const nextTile = this.getNextTile(currentTile, prevTile);

            if (nextTile === INVALID_TILE_ID) {
                // 无法继续前进，路径计算提前结束
                console.warn(`[RotorRouter] Path blocked at step ${i}, tile ${currentTile}`);
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
     * 获取历史记录（用于保存状态）
     */
    public getHistory(): RotorRouterHistory {
        return this.history;
    }

    /**
     * 重置历史记录
     */
    public resetHistory(): void {
        this.history.lastDirection.clear();
    }

    /**
     * 调试：打印当前历史记录
     */
    public debugHistory(): void {
        console.log('[RotorRouter] History:', {
            recordCount: this.history.lastDirection.size,
            records: Array.from(this.history.lastDirection.entries()).map(([tile, dir]) => ({
                tile,
                direction: Direction[dir]
            }))
        });
    }
}
