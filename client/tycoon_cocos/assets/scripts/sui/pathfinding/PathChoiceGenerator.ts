/**
 * 路径选择序列生成器
 * 将完整路径转换为分叉选择序列（fork choice sequence）
 */

import { MapGraph } from './MapGraph';

/**
 * 路径选择信息
 */
export interface PathChoice {
    /** 在哪个地块做出选择 */
    atTile: bigint;
    /** 选择的下一个地块 */
    choice: bigint;
    /** 该选择在路径中的索引 */
    stepIndex: number;
}

/**
 * 路径选择结果
 */
export interface PathChoiceResult {
    /** 分叉选择序列 (只包含有多个选项时的选择) */
    forkChoices: bigint[];
    /** 完整路径 (所有地块ID) */
    completePath: bigint[];
    /** 详细的选择信息 */
    choiceDetails: PathChoice[];
}

/**
 * 路径选择序列生成器
 * 负责将BFS找到的完整路径转换为Move合约需要的分叉选择序列
 */
export class PathChoiceGenerator {
    private graph: MapGraph;

    constructor(graph: MapGraph) {
        this.graph = graph;
    }

    /**
     * 生成路径选择序列
     * @param path 完整路径（从起点到终点的地块ID序列）
     * @returns 路径选择结果
     */
    public generateChoices(path: bigint[]): PathChoiceResult {
        if (path.length < 2) {
            // 路径太短，没有选择
            return {
                forkChoices: [],
                completePath: path,
                choiceDetails: []
            };
        }

        const forkChoices: bigint[] = [];
        const choiceDetails: PathChoice[] = [];

        // 遍历路径，生成选择序列
        for (let i = 0; i < path.length - 1; i++) {
            const current = path[i];
            const next = path[i + 1];
            const neighbors = this.graph.getNeighbors(current);

            // 只有当存在多个选择时，才需要记录选择
            // 注意：这里需要检查是否真的有分叉
            if (this.hasFork(current, neighbors)) {
                forkChoices.push(next);
                choiceDetails.push({
                    atTile: current,
                    choice: next,
                    stepIndex: i
                });
            }
        }

        return {
            forkChoices,
            completePath: path,
            choiceDetails
        };
    }

    /**
     * 检查在某个地块是否存在分叉（多个可选方向）
     * @param tile 当前地块
     * @param neighbors 邻居列表
     * @returns 是否存在分叉
     */
    private hasFork(tile: bigint, neighbors: bigint[]): boolean {
        // 直接基于邻居数量判断
        // neighbors已经是去重后的有效邻居列表（由graph.getNeighbors提供）
        // 不再使用0作为特殊值判断
        return neighbors.length > 1;
    }

    /**
     * 验证路径选择序列是否有效
     * @param start 起始地块
     * @param choices 选择序列
     * @param maxSteps 最大步数
     * @returns 是否有效
     */
    public validateChoices(
        start: bigint,
        choices: bigint[],
        maxSteps: number
    ): boolean {
        let current = start;
        let steps = 0;
        let choiceIndex = 0;

        // 模拟执行选择序列
        while (steps < maxSteps && choiceIndex < choices.length) {
            const neighbors = this.graph.getNeighbors(current);

            if (neighbors.length === 0) {
                // 死路
                return false;
            }

            let next: bigint;

            if (this.hasFork(current, neighbors)) {
                // 有分叉，使用选择序列
                if (choiceIndex >= choices.length) {
                    // 选择序列不足
                    return false;
                }

                next = choices[choiceIndex];
                choiceIndex++;

                // 验证选择是否有效
                if (!neighbors.includes(next)) {
                    // 无效的选择
                    return false;
                }
            } else {
                // 没有分叉，只有一条路
                next = neighbors[0];
            }

            current = next;
            steps++;
        }

        return true;
    }

    /**
     * 根据选择序列重建路径
     * @param start 起始地块
     * @param choices 选择序列
     * @param steps 步数
     * @returns 重建的路径，如果无效则返回null
     */
    public reconstructPath(
        start: bigint,
        choices: bigint[],
        steps: number
    ): bigint[] | null {
        const path: bigint[] = [start];
        let current = start;
        let choiceIndex = 0;

        for (let i = 0; i < steps; i++) {
            const neighbors = this.graph.getNeighbors(current);

            if (neighbors.length === 0) {
                // 死路
                return null;
            }

            let next: bigint;

            if (this.hasFork(current, neighbors)) {
                // 有分叉，使用选择序列
                if (choiceIndex >= choices.length) {
                    // 选择序列不足
                    return null;
                }

                next = choices[choiceIndex];
                choiceIndex++;

                // 验证选择是否有效
                if (!neighbors.includes(next)) {
                    // 无效的选择
                    return null;
                }
            } else {
                // 没有分叉，默认选择第一个邻居
                // 注意：这里需要根据实际规则选择（顺时针优先？）
                next = this.getDefaultNext(current, neighbors);
            }

            path.push(next);
            current = next;
        }

        return path;
    }

    /**
     * 获取默认的下一步（当没有分叉时）
     * @param current 当前地块
     * @param neighbors 邻居列表
     * @returns 默认的下一个地块
     */
    private getDefaultNext(current: bigint, neighbors: bigint[]): bigint {
        const node = this.graph.getNode(current);
        if (!node) return neighbors[0];

        // 优先级：顺时针 > 逆时针 > 邻接
        // 不再检查是否为0，直接检查是否在neighbors中
        if (neighbors.includes(node.tileInfo.cw_next)) {
            return node.tileInfo.cw_next;
        }

        if (neighbors.includes(node.tileInfo.ccw_next)) {
            return node.tileInfo.ccw_next;
        }

        // 返回第一个邻接地块
        return neighbors[0];
    }

    /**
     * 调试：打印选择序列
     */
    public debugPrintChoices(result: PathChoiceResult): void {
        console.log('[PathChoiceGenerator] Path choice result:');
        console.log(`  Complete path: [${result.completePath.join(' -> ')}]`);
        console.log(`  Fork choices: [${result.forkChoices.join(', ')}]`);
        console.log('  Choice details:');

        for (const choice of result.choiceDetails) {
            console.log(`    At tile ${choice.atTile} (step ${choice.stepIndex}): choose ${choice.choice}`);
        }
    }
}