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
     * 计算完整路径（带回溯）
     *
     * @param startTile 起始 tile_id
     * @param steps 需要走的步数
     * @param lastTile 上一步的 tile_id（避免第一步回头）
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

                    console.log(`[RotorRouter] 回溯到分叉点: tile ${currentTile}, path length ${path.length}`);
                    continue;
                } else {
                    // 无法回溯，返回当前路径
                    console.warn(`[RotorRouter] 无法继续，返回 ${path.length} 步`);
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

            // 选择下一个节点（优先访问少的）
            const nextTile = this.selectBestNeighbor(neighbors, visitCount);

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
     * 获取所有有效邻居（排除上一个 tile，并避开端点 tile）
     */
    private getValidNeighbors(currentTile: number, lastTile: number): number[] {
        const tileStatic = this.template.tiles_static.get(currentTile);
        if (!tileStatic) return [];

        const allNeighbors = [
            tileStatic.w,
            tileStatic.n,
            tileStatic.e,
            tileStatic.s
        ].filter(n => n !== INVALID_TILE_ID);

        // 特殊情况：当前在端点tile，只有一个邻居且是lastTile
        // 必须允许"回头"离开端点
        if (allNeighbors.length === 1 && allNeighbors[0] === lastTile) {
            return [lastTile]; // 允许回头
        }

        const neighbors: number[] = [];
        for (const neighbor of allNeighbors) {
            // 排除lastTile（避免回头）
            if (neighbor === lastTile) continue;

            // 排除端点tile（避免走入死胡同）
            if (this.isTerminalTile(neighbor)) continue;

            neighbors.push(neighbor);
        }

        // Fallback：如果排除端点后没有可选邻居，允许走入端点
        if (neighbors.length === 0) {
            return allNeighbors.filter(n => n !== lastTile);
        }

        return neighbors;
    }

    /**
     * 判断是否是端点 tile（只有一个有效邻居）
     */
    private isTerminalTile(tileId: number): boolean {
        const tileStatic = this.template.tiles_static.get(tileId);
        if (!tileStatic) return false;

        const validNeighbors = [
            tileStatic.w,
            tileStatic.n,
            tileStatic.e,
            tileStatic.s
        ].filter(n => n !== INVALID_TILE_ID);

        return validNeighbors.length === 1;
    }

    /**
     * 选择最佳邻居（优先未访问或访问次数少的）
     */
    private selectBestNeighbor(neighbors: number[], visitCount: Map<number, number>): number {
        // 按访问次数排序
        neighbors.sort((a, b) => {
            const countA = visitCount.get(a) || 0;
            const countB = visitCount.get(b) || 0;
            return countA - countB;
        });

        // 返回访问次数最少的
        return neighbors[0];
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
