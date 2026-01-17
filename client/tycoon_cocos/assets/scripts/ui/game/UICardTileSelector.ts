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
import type { MapTemplate } from '../../sui/types/map';
import { GameInitializer } from '../../core/GameInitializer';
import { MapManager } from '../../map/MapManager';
import { EventBus } from '../../events/EventBus';
import { EventTypes } from '../../events/EventTypes';
import { UIMessage } from '../utils/UIMessage';
import { INVALID_TILE_ID } from '../../sui/types/constants';

/**
 * Tile选择器 - 用于卡片使用时的tile选择
 */
export class UICardTileSelector {
    /** 静态实例引用 */
    private static _instance: UICardTileSelector | null = null;

    private overlayNodes: Map<number, Node> = new Map();
    private selectedTile: number | null = null;
    private isActive: boolean = false;

    /** Promise的resolve引用，用于取消时调用 */
    private cancelResolve: ((value: number | null) => void) | null = null;

    /** ESC键监听器引用，用于清理 */
    private escKeyHandler: ((event: KeyboardEvent) => void) | null = null;

    /** 地面点击事件监听器引用 */
    private groundClickHandler: ((event: any) => void) | null = null;

    constructor() {
        UICardTileSelector._instance = this;
    }

    /**
     * 取消当前选择（供外部调用）
     */
    public static cancelSelection(): void {
        UICardTileSelector._instance?.cancel();
    }

    /**
     * 检查是否正在选择
     */
    public static isSelecting(): boolean {
        return UICardTileSelector._instance?.isActive ?? false;
    }

    /**
     * 取消选择
     */
    public cancel(): void {
        if (!this.isActive) return;

        console.log('[UICardTileSelector] 取消选择');

        // 移除事件监听
        this.removeEventListeners();

        // 清理overlays
        this.cleanup();

        // resolve null表示取消
        if (this.cancelResolve) {
            this.cancelResolve(null);
            this.cancelResolve = null;
        }

        this.isActive = false;
    }

    /**
     * 移除事件监听器
     */
    private removeEventListeners(): void {
        if (this.escKeyHandler) {
            window.removeEventListener('keydown', this.escKeyHandler);
            this.escKeyHandler = null;
        }
        if (this.groundClickHandler) {
            EventBus.off(EventTypes.Game.GroundClicked, this.groundClickHandler);
            this.groundClickHandler = null;
        }
    }

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
            this.cancelResolve = resolve;  // 保存引用供取消使用
            this.setupTileClickHandlers(reachableTiles, resolve);
        });

        this.cancelResolve = null;
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

        // 全地图选择（如瞬移卡）
        if (card.isFullMapSelection()) {
            const allTiles = this.getAllValidTiles(mapTemplate);
            console.log(`[UICardTileSelector] 全地图选择，可选tiles数量: ${allTiles.length}`);
            return allTiles;
        }

        const maxRange = card.getMaxRange();
        const graph = new MapGraph(mapTemplate);
        const pathfinder = new BFSPathfinder(graph);

        if (card.isRemoteControlCard()) {
            const myPlayer = session.getMyPlayer();
            const lastTileId = myPlayer?.getLastTileId() ?? INVALID_TILE_ID;

            const tiles = pathfinder.getReachableTilesWithConstraints(
                startPos,
                maxRange,
                { lastTileId, allowBacktrackFirstStep: true }
            );

            // 过滤掉端点tile（医院等特殊tile）
            const filteredTiles = this.filterTerminalTiles(tiles, mapTemplate);
            console.log(`[UICardTileSelector] 遥控骰子可选tiles数量: ${filteredTiles.length} (过滤前: ${tiles.length})`);
            return filteredTiles;
        }

        // 使用BFS计算可达范围
        const bfsResult = pathfinder.search(startPos, maxRange);
        const allReachableTiles: number[] = [];

        // 收集所有距离的可达tiles
        for (let dist = 1; dist <= maxRange; dist++) {
            const tiles = bfsResult.reachableTiles.get(dist) || [];
            allReachableTiles.push(...tiles);
        }

        console.log(`[UICardTileSelector] BFS找到 ${allReachableTiles.length} 个可达tiles`);

        // 特殊处理：净化卡不过滤端点tile（可以清除医院门口的东西）
        if (card.isCleanseCard()) {
            return this.filterTilesForCleanse(
                startPos,
                allReachableTiles,
                graph,
                maxRange
            );
        }

        // 其他tile卡牌：过滤掉端点tile（医院等特殊tile）
        const filteredTiles = this.filterTerminalTiles(allReachableTiles, mapTemplate);
        console.log(`[UICardTileSelector] 过滤端点tile后: ${filteredTiles.length} (过滤前: ${allReachableTiles.length})`);
        return filteredTiles;
    }

    /**
     * 获取所有有效的tile（用于全地图选择）
     * 排除医院等特殊tile
     */
    private getAllValidTiles(template: MapTemplate): number[] {
        const validTiles: number[] = [];

        for (let tileId = 0; tileId < template.tiles_static.size; tileId++) {
            const tileStatic = template.tiles_static.get(tileId);
            if (!tileStatic) continue;

            // 检查邻居数量，排除端点tile（如医院，只有一个邻居）
            const validNeighbors = [
                tileStatic.w,
                tileStatic.n,
                tileStatic.e,
                tileStatic.s
            ].filter(n => n !== INVALID_TILE_ID);

            if (validNeighbors.length > 1) {
                validTiles.push(tileId);
            }
        }

        return validTiles;
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
     * 过滤掉端点tile（只有一个邻居的tile，如医院）
     */
    private filterTerminalTiles(tiles: number[], template: MapTemplate): number[] {
        return tiles.filter(tileId => {
            const tileStatic = template.tiles_static.get(tileId);
            if (!tileStatic) return false;

            const validNeighbors = [
                tileStatic.w,
                tileStatic.n,
                tileStatic.e,
                tileStatic.s
            ].filter(n => n !== INVALID_TILE_ID);

            return validNeighbors.length > 1; // 保留非端点tile
        });
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
        // 地面点击handler
        this.groundClickHandler = (event: any) => {
            // 从 GroundClicked 事件获取 gridIndex（兼容旧版 y / 新版 z）
            const gridIndex = event.gridIndex as { x?: number; y?: number; z?: number } | undefined;
            const gridX = gridIndex?.x;
            const gridZ = gridIndex?.z ?? gridIndex?.y;

            if (gridX == null || gridZ == null) {
                console.warn('[UICardTileSelector] GroundClicked缺少gridIndex');
                return;
            }

            // 从 grid 坐标转换到 tileId
            const gameMap = MapManager.getInstance()?.getCurrentGameMap();
            if (!gameMap) {
                console.warn('[UICardTileSelector] 无法获取GameMap');
                return;
            }

            const mapTile = gameMap.getTileAt(gridX, gridZ);
            if (!mapTile) {
                console.log(`[UICardTileSelector] Grid (${gridX}, ${gridZ}) 没有tile`);
                return;
            }

            const tileId = mapTile.getTileId();

            if (!tileIds.includes(tileId)) {
                console.log(`[UICardTileSelector] 点击了不可选的tile: ${tileId}`);
                return;
            }

            console.log(`[UICardTileSelector] 选中tile: ${tileId}`);

            // 单选模式：清理并返回结果
            this.removeEventListeners();
            this.cleanup();
            resolve(tileId);
        };

        EventBus.on(EventTypes.Game.GroundClicked, this.groundClickHandler);

        // ESC键取消监听
        this.escKeyHandler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                console.log('[UICardTileSelector] 用户取消选择（ESC）');
                this.removeEventListeners();
                this.cleanup();
                resolve(null);
            }
        };
        window.addEventListener('keydown', this.escKeyHandler);

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
