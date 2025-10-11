/**
 * PathCalculator - 统一路径计算器
 *
 * 门面模式（Facade Pattern）
 * 整合多种行走偏好算法，提供统一的路径计算接口
 *
 * 支持的算法：
 * - Rotor-Router（探索模式）
 * - Right-hand Rule（右手法则）
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import type { MapTemplate } from '../types/map';
import {
    WalkingPreference,
    PathResult,
    PathCalculationConfig,
    RotorRouterHistory,
    INVALID_TILE_ID,
    createRotorRouterHistory
} from './WalkingPreference';
import { RotorRouter } from './RotorRouter';
import { RightHandRule } from './RightHandRule';

/**
 * PathCalculator 类
 */
export class PathCalculator {
    /** 地图模板 */
    private template: MapTemplate;

    /** Rotor-Router 算法实例 */
    private rotorRouter: RotorRouter;

    /** Right-hand Rule 算法实例 */
    private rightHandRule: RightHandRule;

    /** Rotor-Router 历史记录（用于保持状态） */
    private rotorHistory: RotorRouterHistory;

    constructor(template: MapTemplate, rotorHistory?: RotorRouterHistory) {
        this.template = template;
        this.rotorHistory = rotorHistory || createRotorRouterHistory();

        // 初始化算法实例
        this.rotorRouter = new RotorRouter(template, this.rotorHistory);
        this.rightHandRule = new RightHandRule(template);
    }

    /**
     * 计算路径（统一接口）
     *
     * @param config 路径计算配置
     * @returns 路径计算结果
     */
    public calculatePath(config: PathCalculationConfig): PathResult {
        const {
            startTile,
            steps,
            preference,
            lastTile = INVALID_TILE_ID,
            rotorHistory
        } = config;

        // 验证参数
        if (steps <= 0) {
            return {
                path: [],
                success: false,
                actualSteps: 0,
                error: 'Invalid steps: must be > 0'
            };
        }

        if (!this.template.tiles_static.has(startTile)) {
            return {
                path: [],
                success: false,
                actualSteps: 0,
                error: `Start tile ${startTile} not found in template`
            };
        }

        // 如果提供了新的 Rotor-Router 历史记录，更新实例
        if (rotorHistory) {
            this.rotorHistory = rotorHistory;
            this.rotorRouter = new RotorRouter(this.template, this.rotorHistory);
        }

        // 根据偏好选择算法
        let path: number[];

        switch (preference) {
            case WalkingPreference.ROTOR_ROUTER:
                path = this.rotorRouter.calculatePath(startTile, steps, lastTile);
                break;

            case WalkingPreference.RIGHT_HAND_RULE:
                path = this.rightHandRule.calculatePath(startTile, steps, lastTile);
                break;

            default:
                return {
                    path: [],
                    success: false,
                    actualSteps: 0,
                    error: `Unknown walking preference: ${preference}`
                };
        }

        // 检查路径是否完整
        const actualSteps = path.length;
        const success = actualSteps === steps;

        if (!success) {
            console.warn(
                `[PathCalculator] Path incomplete: expected ${steps} steps, got ${actualSteps}`
            );
        }

        return {
            path,
            success,
            actualSteps,
            error: success ? undefined : `Path blocked after ${actualSteps} steps`
        };
    }

    /**
     * 快速计算路径（不使用配置对象）
     *
     * @param startTile 起始 tile_id
     * @param steps 需要走的步数
     * @param preference 行走偏好
     * @param lastTile 上一步的 tile_id（可选）
     * @returns 路径数组
     */
    public quickCalculate(
        startTile: number,
        steps: number,
        preference: WalkingPreference,
        lastTile?: number
    ): number[] {
        const result = this.calculatePath({
            startTile,
            steps,
            preference,
            lastTile
        });

        return result.path;
    }

    /**
     * 获取 Rotor-Router 历史记录
     *
     * 用于保存状态（如存储到 localStorage）
     */
    public getRotorHistory(): RotorRouterHistory {
        return this.rotorHistory;
    }

    /**
     * 设置 Rotor-Router 历史记录
     *
     * 用于恢复状态（如从 localStorage 加载）
     */
    public setRotorHistory(history: RotorRouterHistory): void {
        this.rotorHistory = history;
        this.rotorRouter = new RotorRouter(this.template, this.rotorHistory);
    }

    /**
     * 重置 Rotor-Router 历史记录
     */
    public resetRotorHistory(): void {
        this.rotorRouter.resetHistory();
    }

    /**
     * 验证路径是否有效
     *
     * 检查路径中的每一步是否是有效的邻居关系
     *
     * @param startTile 起始 tile_id
     * @param path 路径数组
     * @returns 是否有效
     */
    public validatePath(startTile: number, path: number[]): boolean {
        if (path.length === 0) return true;

        let currentTile = startTile;

        for (let i = 0; i < path.length; i++) {
            const nextTile = path[i];
            const tileStatic = this.template.tiles_static.get(currentTile);

            if (!tileStatic) {
                console.error(`[PathCalculator] Tile ${currentTile} not found`);
                return false;
            }

            // 检查 nextTile 是否是 currentTile 的邻居
            const isNeighbor =
                tileStatic.w === nextTile ||
                tileStatic.n === nextTile ||
                tileStatic.e === nextTile ||
                tileStatic.s === nextTile;

            if (!isNeighbor) {
                console.error(
                    `[PathCalculator] Invalid path at step ${i}: ${currentTile} -> ${nextTile} (not neighbors)`
                );
                return false;
            }

            currentTile = nextTile;
        }

        return true;
    }

    /**
     * 调试：打印路径详情
     */
    public debugPath(startTile: number, path: number[]): void {
        console.log('[PathCalculator] Path Details:', {
            start: startTile,
            steps: path.length,
            tiles: [startTile, ...path],
            valid: this.validatePath(startTile, path)
        });

        // 打印每一步的转向信息
        let currentTile = startTile;
        for (let i = 0; i < path.length; i++) {
            const nextTile = path[i];
            const tileStatic = this.template.tiles_static.get(currentTile);

            if (tileStatic) {
                let direction = '?';
                if (tileStatic.w === nextTile) direction = 'W';
                else if (tileStatic.n === nextTile) direction = 'N';
                else if (tileStatic.e === nextTile) direction = 'E';
                else if (tileStatic.s === nextTile) direction = 'S';

                console.log(`  Step ${i}: ${currentTile} -> ${nextTile} (${direction})`);
            }

            currentTile = nextTile;
        }
    }

    /**
     * 调试：打印 Rotor-Router 历史记录
     */
    public debugRotorHistory(): void {
        this.rotorRouter.debugHistory();
    }
}

// ===== 导出便捷函数 =====

/**
 * 创建 PathCalculator 实例
 *
 * @param template 地图模板
 * @param rotorHistory Rotor-Router 历史记录（可选）
 * @returns PathCalculator 实例
 */
export function createPathCalculator(
    template: MapTemplate,
    rotorHistory?: RotorRouterHistory
): PathCalculator {
    return new PathCalculator(template, rotorHistory);
}
