/**
 * 地图图结构
 * 用于构建和维护地图的图表示，支持寻路算法
 */

import { MapTemplate, TileInfo, getTileNeighbors } from '../types/MapTemplate';

/**
 * 图节点
 */
export interface GraphNode {
    id: bigint;
    neighbors: bigint[];
    tileInfo: TileInfo;
}

/**
 * 地图图结构
 * 将MapTemplate转换为图表示，便于执行寻路算法
 */
export class MapGraph {
    private nodes: Map<bigint, GraphNode>;
    private template: MapTemplate;

    constructor(template: MapTemplate) {
        this.template = template;
        this.nodes = new Map();
        this.buildGraph();
    }

    /**
     * 构建图结构
     */
    private buildGraph(): void {
        for (const [tileId, tileInfo] of this.template.tiles) {
            const neighbors = getTileNeighbors(this.template, tileId);

            const node: GraphNode = {
                id: tileId,
                neighbors,
                tileInfo
            };

            this.nodes.set(tileId, node);
        }

        console.log(`[MapGraph] Built graph with ${this.nodes.size} nodes`);
    }

    /**
     * 获取节点
     */
    public getNode(tileId: bigint): GraphNode | undefined {
        return this.nodes.get(tileId);
    }

    /**
     * 获取节点的邻居
     */
    public getNeighbors(tileId: bigint): bigint[] {
        const node = this.nodes.get(tileId);
        return node ? node.neighbors : [];
    }

    /**
     * 获取所有节点
     */
    public getAllNodes(): GraphNode[] {
        return Array.from(this.nodes.values());
    }

    /**
     * 判断两个节点是否直接相连
     */
    public areNeighbors(tile1: bigint, tile2: bigint): boolean {
        const node = this.nodes.get(tile1);
        if (!node) return false;
        return node.neighbors.includes(tile2);
    }

    /**
     * 获取从一个节点到另一个节点的移动类型
     * @returns 'cw' | 'ccw' | 'adj' | null
     */
    public getMoveType(from: bigint, to: bigint): 'cw' | 'ccw' | 'adj' | null {
        const tile = this.template.tiles.get(from);
        if (!tile) return null;

        if (tile.cw_next === to) return 'cw';
        if (tile.ccw_next === to) return 'ccw';
        if (tile.adj.includes(to)) return 'adj';

        return null;
    }

    /**
     * 获取图的大小（节点数）
     */
    public get size(): number {
        return this.nodes.size;
    }

    /**
     * 获取模板
     */
    public getTemplate(): MapTemplate {
        return this.template;
    }

    /**
     * 调试：打印图结构
     */
    public debugPrint(): void {
        console.log('[MapGraph] Graph structure:');
        for (const [id, node] of this.nodes) {
            console.log(`  Node ${id}: neighbors = [${node.neighbors.join(', ')}]`);
        }
    }
}