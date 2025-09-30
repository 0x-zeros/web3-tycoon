/**
 * 地图编辑算法模块
 *
 * 提供地图编辑相关的算法支持
 * 包括路径查找、地图生成、地图分析等
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Vec2 } from 'cc';
import { MapTile } from '../core/MapTile';

/**
 * 路径节点
 */
interface PathNode {
    position: Vec2;
    cost: number;
    heuristic: number;
    parent?: PathNode;
}

/**
 * 地图分析结果
 */
export interface MapAnalysisResult {
    isComplete: boolean;
    hasDeadEnds: boolean;
    propertyBalance: number;
    tileDistribution: Map<string, number>;
    warnings: string[];
}

/**
 * 地图编辑算法
 * 提供各种地图相关的算法实现
 */
export class MapEditorAlgorithm {

    private _tiles: Map<string, MapTile> = new Map();

    /**
     * 初始化算法模块
     */
    public initialize(tileIndex: Map<string, MapTile>): void {
        this._tiles = tileIndex;
    }

    // ========================= 路径查找算法 =========================

    /**
     * 使用A*算法查找路径
     * @param start 起始位置
     * @param end 目标位置
     * @returns 路径点数组，如果找不到路径返回null
     */
    public findPath(start: Vec2, end: Vec2): Vec2[] | null {
        // TODO: 实现A*路径查找算法
        console.log('[MapEditorAlgorithm] Path finding not implemented yet');
        return null;
    }

    /**
     * 验证路径是否有效
     * @param path 路径点数组
     * @returns 是否有效
     */
    public validatePath(path: Vec2[]): boolean {
        if (path.length < 2) return false;

        for (let i = 0; i < path.length - 1; i++) {
            const current = path[i];
            const next = path[i + 1];

            // 检查相邻性
            const dx = Math.abs(next.x - current.x);
            const dy = Math.abs(next.y - current.y);

            if (dx + dy !== 1) {
                return false;  // 不相邻
            }

            // 检查tile是否存在
            const key = `${next.x}_${next.y}`;
            if (!this._tiles.has(key)) {
                return false;  // tile不存在
            }
        }

        return true;
    }

    // ========================= 地图生成算法 =========================

    /**
     * 生成随机地图布局
     * @param width 地图宽度
     * @param height 地图高度
     * @param density 密度(0-1)
     * @returns 生成的地图布局
     */
    public generateRandomMap(width: number, height: number, density: number = 0.7): Vec2[] {
        const positions: Vec2[] = [];

        // TODO: 实现随机地图生成算法
        console.log('[MapEditorAlgorithm] Random map generation not implemented yet');

        return positions;
    }

    /**
     * 生成对称地图布局
     * @param width 地图宽度
     * @param height 地图高度
     * @param symmetryType 对称类型: 'horizontal' | 'vertical' | 'diagonal' | 'radial'
     * @returns 生成的地图布局
     */
    public generateSymmetricMap(
        width: number,
        height: number,
        symmetryType: 'horizontal' | 'vertical' | 'diagonal' | 'radial'
    ): Vec2[] {
        const positions: Vec2[] = [];

        // TODO: 实现对称地图生成算法
        console.log('[MapEditorAlgorithm] Symmetric map generation not implemented yet');

        return positions;
    }

    // ========================= 地图分析算法 =========================

    /**
     * 分析地图平衡性
     * @returns 分析结果
     */
    public analyzeBalance(): MapAnalysisResult {
        const result: MapAnalysisResult = {
            isComplete: false,
            hasDeadEnds: false,
            propertyBalance: 0,
            tileDistribution: new Map(),
            warnings: []
        };

        // TODO: 实现地图平衡性分析
        console.log('[MapEditorAlgorithm] Map balance analysis not implemented yet');

        return result;
    }

    /**
     * 查找死胡同
     * @returns 死胡同位置数组
     */
    public findDeadEnds(): Vec2[] {
        const deadEnds: Vec2[] = [];

        this._tiles.forEach((tile, key) => {
            const [x, z] = key.split('_').map(Number);
            const pos = new Vec2(x, z);

            // 计算相邻tile数量
            let neighborCount = 0;
            const directions = [
                { x: 0, y: 1 },   // 北
                { x: 1, y: 0 },   // 东
                { x: 0, y: -1 },  // 南
                { x: -1, y: 0 }   // 西
            ];

            for (const dir of directions) {
                const neighborKey = `${x + dir.x}_${z + dir.y}`;
                if (this._tiles.has(neighborKey)) {
                    neighborCount++;
                }
            }

            // 只有一个邻居的tile是死胡同
            if (neighborCount === 1) {
                deadEnds.push(pos);
            }
        });

        return deadEnds;
    }

    /**
     * 计算地产分布
     * @returns 各类地产的数量分布
     */
    public calculatePropertyDistribution(): Map<string, number> {
        const distribution = new Map<string, number>();

        this._tiles.forEach((tile) => {
            const blockId = tile.getBlockId();
            const count = distribution.get(blockId) || 0;
            distribution.set(blockId, count + 1);
        });

        return distribution;
    }

    /**
     * 查找连通区域
     * @returns 连通区域数组，每个区域包含其所有tile位置
     */
    public findConnectedRegions(): Vec2[][] {
        const visited = new Set<string>();
        const regions: Vec2[][] = [];

        this._tiles.forEach((tile, key) => {
            if (!visited.has(key)) {
                const region = this.dfsRegion(key, visited);
                if (region.length > 0) {
                    regions.push(region);
                }
            }
        });

        return regions;
    }

    /**
     * DFS遍历连通区域
     */
    private dfsRegion(startKey: string, visited: Set<string>): Vec2[] {
        const region: Vec2[] = [];
        const stack = [startKey];

        while (stack.length > 0) {
            const key = stack.pop()!;
            if (visited.has(key)) continue;

            visited.add(key);
            const [x, z] = key.split('_').map(Number);
            region.push(new Vec2(x, z));

            // 添加相邻tile到栈
            const directions = [
                { x: 0, y: 1 },   // 北
                { x: 1, y: 0 },   // 东
                { x: 0, y: -1 },  // 南
                { x: -1, y: 0 }   // 西
            ];

            for (const dir of directions) {
                const neighborKey = `${x + dir.x}_${z + dir.y}`;
                if (this._tiles.has(neighborKey) && !visited.has(neighborKey)) {
                    stack.push(neighborKey);
                }
            }
        }

        return region;
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        this._tiles.clear();
    }
}