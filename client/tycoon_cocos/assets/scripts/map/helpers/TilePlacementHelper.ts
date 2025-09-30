/**
 * 地块放置辅助类
 *
 * 负责管理地块的放置、删除、查询等操作
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Node, Vec2, Vec3 } from 'cc';
import { MapTile } from '../core/MapTile';
import { VoxelSystem } from '../../voxel/VoxelSystem';
import { getWeb3BlockByBlockId, isWeb3Tile } from '../../voxel/Web3BlockTypes';

/**
 * 地块放置辅助类
 * 管理所有地块相关的操作
 */
export class TilePlacementHelper {

    // 地块容器
    private _tilesContainer: Node | null = null;

    // 地块数据
    private _tiles: MapTile[] = [];
    private _tileIndex: Map<string, MapTile> = new Map();

    // 体素系统引用
    private _voxelSystem: VoxelSystem | null = null;

    /**
     * 初始化辅助器
     */
    public initialize(tilesContainer: Node, voxelSystem: VoxelSystem | null): void {
        this._tilesContainer = tilesContainer;
        this._voxelSystem = voxelSystem;
    }

    /**
     * 在指定网格位置放置地块
     * @param blockId 方块ID
     * @param gridPos 网格位置
     */
    public async placeTileAt(blockId: string, gridPos: Vec2): Promise<void> {
        const key = `${gridPos.x}_${gridPos.y}`;

        // 检查位置是否已有地块
        if (this._tileIndex.has(key)) {
            console.warn(`[TilePlacementHelper] Tile already exists at ${key}`);
            return;
        }

        // 验证是否为有效的tile类型
        const blockInfo = getWeb3BlockByBlockId(blockId);
        if (!blockInfo || !isWeb3Tile(blockId)) {
            console.error(`[TilePlacementHelper] Invalid tile block: ${blockId}`);
            return;
        }

        // 创建地块节点
        const tileNode = new Node(`Tile_${gridPos.x}_${gridPos.y}`);
        tileNode.setParent(this._tilesContainer!);

        // 设置位置
        const worldPos = new Vec3(gridPos.x, 0, gridPos.y);
        tileNode.setPosition(worldPos);

        // 添加MapTile组件
        const mapTile = tileNode.addComponent(MapTile);
        mapTile.init(blockId, gridPos, blockInfo.typeId || 0);

        // 放置体素
        if (this._voxelSystem) {
            const chunkPos = this._voxelSystem.worldToChunk(worldPos);
            this._voxelSystem.setBlock(chunkPos.chunkX, chunkPos.chunkZ,
                chunkPos.localX, 0, chunkPos.localZ, blockInfo.typeId);
        }

        // 添加到索引
        this._tiles.push(mapTile);
        this._tileIndex.set(key, mapTile);

        console.log(`[TilePlacementHelper] Placed tile ${blockId} at (${gridPos.x}, ${gridPos.y})`);
    }

    /**
     * 删除指定地块
     * @param tile 要删除的地块
     */
    public removeTile(tile: MapTile): void {
        const pos = tile.getGridPosition();
        const key = `${pos.x}_${pos.y}`;

        // 从索引中删除
        this._tileIndex.delete(key);
        const index = this._tiles.indexOf(tile);
        if (index !== -1) {
            this._tiles.splice(index, 1);
        }

        // 删除体素
        if (this._voxelSystem) {
            const worldPos = new Vec3(pos.x, 0, pos.y);
            const chunkPos = this._voxelSystem.worldToChunk(worldPos);
            this._voxelSystem.setBlock(chunkPos.chunkX, chunkPos.chunkZ,
                chunkPos.localX, 0, chunkPos.localZ, 0);  // 0表示空气方块
        }

        // 销毁节点
        if (tile.node) {
            tile.node.destroy();
        }

        console.log(`[TilePlacementHelper] Removed tile at (${pos.x}, ${pos.y})`);
    }

    /**
     * 获取指定位置的地块
     * @param x X坐标
     * @param z Z坐标
     */
    public getTileAt(x: number, z: number): MapTile | null {
        const key = `${x}_${z}`;
        return this._tileIndex.get(key) || null;
    }

    /**
     * 获取所有地块
     */
    public getAllTiles(): MapTile[] {
        return [...this._tiles];
    }

    /**
     * 清空所有地块
     */
    public clearAllTiles(): void {
        // 销毁所有地块节点
        for (const tile of this._tiles) {
            if (tile.node && tile.node.isValid) {
                tile.node.destroy();
            }
        }

        // 清空索引
        this._tiles = [];
        this._tileIndex.clear();

        console.log('[TilePlacementHelper] All tiles cleared');
    }

    /**
     * 获取地块统计信息
     */
    public getTileStats(): { total: number; byType: Map<string, number> } {
        const stats = {
            total: this._tiles.length,
            byType: new Map<string, number>()
        };

        for (const tile of this._tiles) {
            const blockId = tile.getBlockId();
            const count = stats.byType.get(blockId) || 0;
            stats.byType.set(blockId, count + 1);
        }

        return stats;
    }

    /**
     * 检查指定位置是否有地块
     * @param gridPos 网格位置
     */
    public hasTileAt(gridPos: Vec2): boolean {
        const key = `${gridPos.x}_${gridPos.y}`;
        return this._tileIndex.has(key);
    }

    /**
     * 获取地块索引（供其他模块使用）
     */
    public getTileIndex(): Map<string, MapTile> {
        return this._tileIndex;
    }

    /**
     * 获取地块数组（供其他模块使用）
     */
    public getTilesArray(): MapTile[] {
        return this._tiles;
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        this.clearAllTiles();
        this._tilesContainer = null;
        this._voxelSystem = null;
    }
}