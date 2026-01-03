/**
 * UICardTileSelector - Tile选择器
 *
 * 用于卡片使用时的tile选择功能
 * 显示可选tiles并等待用户点击选择
 *
 * @author Web3 Tycoon Team
 */

import { Node, Texture2D, Color, resources } from 'cc';
import { Card } from '../../card/Card';
import { BlockOverlayManager } from '../../voxel/overlay/BlockOverlayManager';
import { OverlayFace } from '../../voxel/overlay/OverlayTypes';
import { BFSPathfinder } from '../../sui/pathfinding/BFSPathfinder';
import { MapGraph } from '../../sui/pathfinding/MapGraph';
import { PathExtender } from '../../sui/pathfinding/PathExtender';
import { GameInitializer } from '../../core/GameInitializer';
import { MapManager } from '../../map/MapManager';
import { EventBus } from '../../events/EventBus';
import { EventTypes } from '../../events/EventTypes';
import { UIMessage } from '../utils/UIMessage';

/**
 * Tile选择器 - 用于卡片使用时的tile选择
 */
export class UICardTileSelector {
    private overlayNodes: Map<number, Node> = new Map();
    private selectedTile: number | null = null;
    private isActive: boolean = false;

    /**
     * 显示tile选择界面
     * @param card 卡片实例
     * @param currentPlayerPos 玩家当前位置
     * @returns 选中的tile ID，取消返回null
     */
    async showTileSelection(
        card: Card,
        currentPlayerPos: number
    ): Promise<number | null> {
        if (this.isActive) {
            console.warn('[UICardTileSelector] 选择器已激活，忽略重复调用');
            return null;
        }

        this.isActive = true;

        // 计算可选tiles
        const reachableTiles = this.calculateReachableTiles(card, currentPlayerPos);

        if (reachableTiles.length === 0) {
            this.isActive = false;
            await UIMessage.warning('没有可用的目标位置');
            return null;
        }

        console.log(`[UICardTileSelector] ${card.name} 可选tiles数量:`, reachableTiles.length);

        // 创建overlays
        await this.createOverlaysForTiles(reachableTiles);

        // 等待用户选择
        const result = await new Promise<number | null>((resolve) => {
            this.setupTileClickHandlers(reachableTiles, resolve);
        });

        this.isActive = false;
        return result;
    }

    /**
     * 计算可达tiles
     */
    private calculateReachableTiles(card: Card, startPos: number): number[] {
        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            console.error('[UICardTileSelector] GameSession未初始化');
            return [];
        }

        const mapTemplate = session.getMapTemplate();
        if (!mapTemplate) {
            console.error('[UICardTileSelector] MapTemplate未初始化');
            return [];
        }

        const maxRange = card.getMaxRange();
        const graph = new MapGraph(mapTemplate);
        const pathfinder = new BFSPathfinder(graph);

        // 使用BFS计算可达范围
        const bfsResult = pathfinder.search(startPos, maxRange);
        const allReachableTiles: number[] = [];

        // 收集所有距离的可达tiles
        for (let dist = 1; dist <= maxRange; dist++) {
            const tiles = bfsResult.reachableTiles.get(dist) || [];
            allReachableTiles.push(...tiles);
        }

        console.log(`[UICardTileSelector] BFS找到 ${allReachableTiles.length} 个可达tiles`);

        // 特殊处理：净化卡需要过滤
        if (card.isCleanseCard()) {
            return this.filterTilesForCleanse(
                startPos,
                allReachableTiles,
                graph,
                maxRange
            );
        }

        return allReachableTiles;
    }

    /**
     * 过滤净化卡可选tiles（动态判断：距离较近且后续有分叉的不可选）
     */
    private filterTilesForCleanse(
        startPos: number,
        candidateTiles: number[],
        graph: MapGraph,
        totalSteps: number
    ): number[] {
        const extender = new PathExtender(graph);

        console.log(`[UICardTileSelector] 净化卡过滤前: ${candidateTiles.length} tiles`);

        const filteredTiles = candidateTiles.filter(tile => {
            // 使用PathExtender检查是否可以延伸
            const canExtend = extender.canExtend(startPos, tile, totalSteps);
            if (!canExtend) {
                console.log(`[UICardTileSelector] 过滤掉tile ${tile}: 无法单向延伸`);
            }
            return canExtend;
        });

        console.log(`[UICardTileSelector] 净化卡过滤后: ${filteredTiles.length} tiles`);

        return filteredTiles;
    }

    /**
     * 为tiles创建overlay高亮
     */
    private async createOverlaysForTiles(tileIds: number[]): Promise<void> {
        const gameMap = MapManager.getInstance()?.getCurrentGameMap();
        if (!gameMap) {
            console.error('[UICardTileSelector] 无法获取GameMap实例');
            return;
        }

        // 加载moveController贴图
        const texture = await this.loadMoveControllerTexture();
        if (!texture) {
            console.warn('[UICardTileSelector] 无法加载moveController贴图，使用纯色');
        }

        console.log(`[UICardTileSelector] 为 ${tileIds.length} 个tiles创建overlay`);

        const allTiles = gameMap.getTiles();

        for (const tileId of tileIds) {
            // 通过tileId索引获取MapTile
            const mapTile = allTiles[tileId];
            if (!mapTile) {
                console.warn(`[UICardTileSelector] Tile ${tileId} 未找到`);
                continue;
            }

            const tileNode = mapTile.node;
            if (!tileNode) {
                console.warn(`[UICardTileSelector] Tile ${tileId} 节点未找到`);
                continue;
            }

            try {
                const overlayNode = await BlockOverlayManager.createOverlay(tileNode, {
                    texture: texture,
                    faces: [OverlayFace.UP],
                    layerIndex: 99,
                    inflate: 0.01,
                    color: new Color(255, 255, 0, 200) // 黄色半透明
                });

                if (overlayNode) {
                    this.overlayNodes.set(tileId, overlayNode);
                }
            } catch (error) {
                console.error(`[UICardTileSelector] 创建overlay失败 tile=${tileId}:`, error);
            }
        }

        console.log(`[UICardTileSelector] 成功创建 ${this.overlayNodes.size} 个overlay`);
    }

    /**
     * 加载moveController贴图
     */
    private loadMoveControllerTexture(): Promise<Texture2D | null> {
        return new Promise((resolve) => {
            resources.load('textures/moveController', Texture2D, (err, texture) => {
                if (err) {
                    console.error('[UICardTileSelector] 加载moveController贴图失败:', err);
                    resolve(null);
                } else {
                    console.log('[UICardTileSelector] moveController贴图加载成功');
                    resolve(texture);
                }
            });
        });
    }

    /**
     * 设置tile点击处理
     */
    private setupTileClickHandlers(
        tileIds: number[],
        resolve: (tile: number | null) => void
    ): void {
        const handler = (event: any) => {
            // 从 GroundClicked 事件获取 gridIndex
            const gridIndex = event.gridIndex; // { x: number, y: number }

            // 从 grid 坐标转换到 tileId
            const gameMap = MapManager.getInstance()?.getCurrentGameMap();
            if (!gameMap) {
                console.warn('[UICardTileSelector] 无法获取GameMap');
                return;
            }

            const mapTile = gameMap.getTileAt(gridIndex.x, gridIndex.y);
            if (!mapTile) {
                console.log(`[UICardTileSelector] Grid (${gridIndex.x}, ${gridIndex.y}) 没有tile`);
                return;
            }

            const tileId = mapTile.getTileId();

            if (!tileIds.includes(tileId)) {
                console.log(`[UICardTileSelector] 点击了不可选的tile: ${tileId}`);
                return;
            }

            console.log(`[UICardTileSelector] 选中tile: ${tileId}`);

            // 单选模式：直接返回
            this.cleanup();
            EventBus.off(EventTypes.Game.GroundClicked, handler);
            resolve(tileId);
        };

        EventBus.on(EventTypes.Game.GroundClicked, handler);

        // 添加取消按钮监听（ESC键）
        const cancelHandler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                console.log('[UICardTileSelector] 用户取消选择（ESC）');
                window.removeEventListener('keydown', cancelHandler);
                this.cleanup();
                EventBus.off(EventTypes.Game.GroundClicked, handler);
                resolve(null);
            }
        };
        window.addEventListener('keydown', cancelHandler);

        console.log('[UICardTileSelector] 等待用户选择tile（ESC取消）');
    }

    /**
     * 清理overlays
     */
    private cleanup(): void {
        console.log(`[UICardTileSelector] 清理 ${this.overlayNodes.size} 个overlay`);
        this.overlayNodes.forEach(node => node.destroy());
        this.overlayNodes.clear();
        this.selectedTile = null;
    }
}
