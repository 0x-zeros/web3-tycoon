/**
 * 地图图结构
 * 用于构建和维护地图的图表示，支持寻路算法
 */

import { MapTemplate, TileStatic, getAdjacentTiles } from '../types/map';

/**
 * 图节点
 */
export interface GraphNode {
    id: number;
    neighbors: number[];
    tileInfo: TileStatic;
}

/**
 * 地图图结构
 * 将MapTemplate转换为图表示，便于执行寻路算法
 */
export class MapGraph {
    private nodes: Map<number, GraphNode>;
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
        for (const [tileId, tileInfo] of this.template.tiles_static) {
            const neighbors = getAdjacentTiles(tileId, this.template);

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
    public getNode(tileId: number): GraphNode | undefined {
        return this.nodes.get(tileId);
    }

    /**
     * 获取节点的邻居
     */
    public getNeighbors(tileId: number): number[] {
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
    public areNeighbors(tile1: number, tile2: number): boolean {
        const node = this.nodes.get(tile1);
        if (!node) return false;
        return node.neighbors.includes(tile2);
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
