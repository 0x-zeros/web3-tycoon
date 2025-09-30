/**
 * 地图路径查找算法
 *
 * 负责路径相关的算法和判断
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Vec2 } from 'cc';
import { MapTile } from '../core/MapTile';
import { TilePlacementHelper } from './TilePlacementHelper';

/**
 * 路径节点（用于A*算法）
 */
interface PathNode {
    position: Vec2;
    g: number;  // 从起点到当前节点的实际代价
    h: number;  // 从当前节点到终点的估计代价
    f: number;  // g + h
    parent?: PathNode;
}

/**
 * 地图路径查找类
 * 提供路径相关的算法和工具方法
 */
export class MapPathfinding {

    private _tileHelper: TilePlacementHelper | null = null;

    /**
     * 初始化路径查找器
     */
    public initialize(tileHelper: TilePlacementHelper): void {
        this._tileHelper = tileHelper;
    }

    /**
     * 判断是否为路径tile（可行走的地块）
     * @param tile 地块
     */
    public isPathTile(tile: MapTile): boolean {
        const blockId = tile.getBlockId();

        // 可行走的地块类型
        const walkableTiles = [
            'web3:empty_land',    // 空地
            'web3:hospital',      // 医院
            'web3:chance',        // 机会
            'web3:bonus',         // 奖励
            'web3:fee',           // 收费
            'web3:card',          // 卡片
            'web3:news',          // 新闻
            'web3:start'          // 起点
        ];

        return walkableTiles.includes(blockId);
    }

    /**
     * 判断指定位置是否为路径
     * @param gridPos 网格位置
     */
    public isPathPosition(gridPos: Vec2): boolean {
        const tile = this._tileHelper?.getTileAt(gridPos.x, gridPos.y);
        return tile ? this.isPathTile(tile) : false;
    }

    /**
     * 验证网格位置是否有效
     * @param pos 网格位置
     * @param minX 最小X坐标
     * @param maxX 最大X坐标
     * @param minZ 最小Z坐标
     * @param maxZ 最大Z坐标
     */
    public isValidGridPosition(
        pos: Vec2,
        minX: number = -50,
        maxX: number = 50,
        minZ: number = -50,
        maxZ: number = 50
    ): boolean {
        return pos.x >= minX && pos.x <= maxX &&
               pos.y >= minZ && pos.y <= maxZ;
    }

    /**
     * 获取指定位置的邻居节点（四方向）
     * @param pos 当前位置
     */
    public getNeighbors(pos: Vec2): Vec2[] {
        const neighbors: Vec2[] = [];
        const directions = [
            new Vec2(0, 1),   // 北
            new Vec2(1, 0),   // 东
            new Vec2(0, -1),  // 南
            new Vec2(-1, 0)   // 西
        ];

        for (const dir of directions) {
            const neighborPos = new Vec2(pos.x + dir.x, pos.y + dir.y);
            if (this.isValidGridPosition(neighborPos)) {
                neighbors.push(neighborPos);
            }
        }

        return neighbors;
    }

    /**
     * 获取可行走的邻居节点
     * @param pos 当前位置
     */
    public getWalkableNeighbors(pos: Vec2): Vec2[] {
        const neighbors = this.getNeighbors(pos);
        return neighbors.filter(n => this.isPathPosition(n));
    }

    /**
     * 计算两点之间的曼哈顿距离
     * @param a 起点
     * @param b 终点
     */
    public getManhattanDistance(a: Vec2, b: Vec2): number {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    /**
     * 计算两点之间的欧几里得距离
     * @param a 起点
     * @param b 终点
     */
    public getEuclideanDistance(a: Vec2, b: Vec2): number {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 使用A*算法查找路径
     * @param start 起点
     * @param goal 终点
     * @returns 路径点数组，如果找不到路径返回null
     */
    public findPath(start: Vec2, goal: Vec2): Vec2[] | null {
        // 验证起点和终点
        if (!this.isPathPosition(start) || !this.isPathPosition(goal)) {
            console.warn('[MapPathfinding] Start or goal position is not walkable');
            return null;
        }

        const openSet: PathNode[] = [];
        const closedSet = new Set<string>();
        const gScore = new Map<string, number>();

        // 创建起始节点
        const startNode: PathNode = {
            position: start,
            g: 0,
            h: this.getManhattanDistance(start, goal),
            f: 0
        };
        startNode.f = startNode.g + startNode.h;

        openSet.push(startNode);
        gScore.set(`${start.x}_${start.y}`, 0);

        while (openSet.length > 0) {
            // 找到f值最小的节点
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift()!;
            const currentKey = `${current.position.x}_${current.position.y}`;

            // 到达目标
            if (current.position.equals(goal)) {
                return this.reconstructPath(current);
            }

            closedSet.add(currentKey);

            // 检查所有邻居
            const neighbors = this.getWalkableNeighbors(current.position);
            for (const neighborPos of neighbors) {
                const neighborKey = `${neighborPos.x}_${neighborPos.y}`;

                // 跳过已访问的节点
                if (closedSet.has(neighborKey)) {
                    continue;
                }

                const tentativeG = current.g + 1;  // 相邻节点的移动代价为1

                // 如果找到更好的路径
                const currentG = gScore.get(neighborKey) || Infinity;
                if (tentativeG < currentG) {
                    gScore.set(neighborKey, tentativeG);

                    // 创建或更新邻居节点
                    let neighborNode = openSet.find(n =>
                        n.position.x === neighborPos.x && n.position.y === neighborPos.y
                    );

                    if (!neighborNode) {
                        neighborNode = {
                            position: neighborPos,
                            g: tentativeG,
                            h: this.getManhattanDistance(neighborPos, goal),
                            f: 0,
                            parent: current
                        };
                        neighborNode.f = neighborNode.g + neighborNode.h;
                        openSet.push(neighborNode);
                    } else {
                        neighborNode.g = tentativeG;
                        neighborNode.f = neighborNode.g + neighborNode.h;
                        neighborNode.parent = current;
                    }
                }
            }
        }

        // 找不到路径
        console.warn('[MapPathfinding] No path found');
        return null;
    }

    /**
     * 重建路径
     * @param node 终点节点
     */
    private reconstructPath(node: PathNode): Vec2[] {
        const path: Vec2[] = [];
        let current: PathNode | undefined = node;

        while (current) {
            path.unshift(current.position.clone());
            current = current.parent;
        }

        return path;
    }

    /**
     * 检查两点之间是否有直接路径（不考虑障碍物）
     * @param start 起点
     * @param end 终点
     */
    public hasDirectPath(start: Vec2, end: Vec2): boolean {
        // 如果在同一行或同一列
        if (start.x === end.x || start.y === end.y) {
            const minX = Math.min(start.x, end.x);
            const maxX = Math.max(start.x, end.x);
            const minY = Math.min(start.y, end.y);
            const maxY = Math.max(start.y, end.y);

            // 检查路径上的所有点
            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    if (!this.isPathPosition(new Vec2(x, y))) {
                        return false;
                    }
                }
            }
            return true;
        }
        return false;
    }

    /**
     * 获取从指定位置可到达的所有位置
     * @param start 起点
     * @param maxDistance 最大距离
     */
    public getReachablePositions(start: Vec2, maxDistance: number): Vec2[] {
        const reachable: Vec2[] = [];
        const visited = new Set<string>();
        const queue: { pos: Vec2; distance: number }[] = [{ pos: start, distance: 0 }];

        while (queue.length > 0) {
            const { pos, distance } = queue.shift()!;
            const key = `${pos.x}_${pos.y}`;

            if (visited.has(key) || distance > maxDistance) {
                continue;
            }

            visited.add(key);
            if (!pos.equals(start)) {
                reachable.push(pos.clone());
            }

            // 添加邻居到队列
            const neighbors = this.getWalkableNeighbors(pos);
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x}_${neighbor.y}`;
                if (!visited.has(neighborKey)) {
                    queue.push({ pos: neighbor, distance: distance + 1 });
                }
            }
        }

        return reachable;
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        this._tileHelper = null;
    }
}