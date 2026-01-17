/**
 * UICardBuildingSelector - 建筑选择器
 *
 * 用于建造卡/改建卡使用时的建筑选择功能
 * 高亮可选建筑的入口tiles并等待用户点击选择
 *
 * @author Web3 Tycoon Team
 */

import { Node, Texture2D, Color, resources } from 'cc';
import { Card } from '../../card/Card';
import { BlockOverlayManager } from '../../voxel/overlay/BlockOverlayManager';
import { OverlayFace } from '../../voxel/overlay/OverlayTypes';
import { GameInitializer } from '../../core/GameInitializer';
import { MapManager } from '../../map/MapManager';
import { EventBus } from '../../events/EventBus';
import { EventTypes } from '../../events/EventTypes';
import { UIMessage } from '../utils/UIMessage';
import { GameBuilding } from '../../game/models/GameBuilding';
import { INVALID_TILE_ID, CardKind } from '../../sui/types/constants';

/**
 * 建筑选择器 - 用于建造卡/改建卡的建筑选择
 */
export class UICardBuildingSelector {
    /** 静态实例引用 */
    private static _instance: UICardBuildingSelector | null = null;

    private overlayNodes: Map<number, Node> = new Map();
    private isActive: boolean = false;

    /** Promise的resolve引用，用于取消时调用 */
    private cancelResolve: ((value: number | null) => void) | null = null;

    /** ESC键监听器引用，用于清理 */
    private escKeyHandler: ((event: KeyboardEvent) => void) | null = null;

    /** 地面点击事件监听器引用 */
    private groundClickHandler: ((event: any) => void) | null = null;

    /** 入口tile到建筑ID的映射 */
    private entranceToBuilding: Map<number, number> = new Map();

    constructor() {
        UICardBuildingSelector._instance = this;
    }

    /**
     * 取消当前选择（供外部调用）
     */
    public static cancelSelection(): void {
        UICardBuildingSelector._instance?.cancel();
    }

    /**
     * 检查是否正在选择
     */
    public static isSelecting(): boolean {
        return UICardBuildingSelector._instance?.isActive ?? false;
    }

    /**
     * 取消选择
     */
    public cancel(): void {
        if (!this.isActive) return;

        console.log('[UICardBuildingSelector] 取消选择');

        this.removeEventListeners();
        this.cleanup();

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
     * 显示建筑选择界面
     * @param card 卡片实例
     * @returns 选中的建筑ID，取消返回null
     */
    async showBuildingSelection(card: Card): Promise<number | null> {
        if (this.isActive) {
            console.warn('[UICardBuildingSelector] 选择器已激活，忽略重复调用');
            return null;
        }

        this.isActive = true;

        // 获取可选建筑列表
        const selectableBuildings = this.getSelectableBuildings(card);

        if (selectableBuildings.length === 0) {
            this.isActive = false;
            await UIMessage.warning('没有可选择的建筑');
            return null;
        }

        console.log(`[UICardBuildingSelector] ${card.name} 可选建筑数量:`, selectableBuildings.length);

        // 创建overlays
        await this.createOverlaysForBuildings(selectableBuildings);

        // 等待用户选择
        const result = await new Promise<number | null>((resolve) => {
            this.cancelResolve = resolve;
            this.setupClickHandlers(resolve);
        });

        this.cancelResolve = null;
        this.isActive = false;
        return result;
    }

    /**
     * 获取可选建筑列表
     */
    private getSelectableBuildings(card: Card): GameBuilding[] {
        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            console.error('[UICardBuildingSelector] GameSession未初始化');
            return [];
        }

        const buildings = session.getBuildings();

        // 建造卡（GM卡）：所有未满级建筑（不限制所有权）
        if (card.isConstructionCard()) {
            return buildings.filter(b => b.level < 5);
        }

        // 改建卡：所有2x2建筑（可以更换类型）
        if (card.isRenovationCard()) {
            return buildings.filter(b => b.size === 2);
        }

        // 其他情况：返回所有建筑
        return buildings;
    }

    /**
     * 为建筑创建overlay高亮（高亮入口tiles）
     */
    private async createOverlaysForBuildings(buildings: GameBuilding[]): Promise<void> {
        const gameMap = MapManager.getInstance()?.getCurrentGameMap();
        if (!gameMap) {
            console.error('[UICardBuildingSelector] 无法获取GameMap实例');
            return;
        }

        // 加载贴图
        const texture = await this.loadBuildingTexture();
        if (!texture) {
            console.warn('[UICardBuildingSelector] 无法加载贴图，使用纯色');
        }

        console.log(`[UICardBuildingSelector] 为 ${buildings.length} 个建筑创建overlay`);

        // 清空映射
        this.entranceToBuilding.clear();

        const allTiles = gameMap.getTiles();

        for (const building of buildings) {
            // 获取入口tiles
            const entranceTileIds = building.entranceTileIds;

            for (const entranceTileId of entranceTileIds) {
                if (entranceTileId === INVALID_TILE_ID) continue;

                // 记录入口tile到建筑ID的映射
                this.entranceToBuilding.set(entranceTileId, building.buildingId);

                // 获取MapTile
                const mapTile = allTiles[entranceTileId];
                if (!mapTile) {
                    console.warn(`[UICardBuildingSelector] Tile ${entranceTileId} 未找到`);
                    continue;
                }

                const tileNode = mapTile.node;
                if (!tileNode) {
                    console.warn(`[UICardBuildingSelector] Tile ${entranceTileId} 节点未找到`);
                    continue;
                }

                try {
                    const overlayNode = await BlockOverlayManager.createOverlay(tileNode, {
                        texture: texture,
                        faces: [OverlayFace.UP],
                        layerIndex: 99,
                        inflate: 0.01,
                        color: new Color(0, 255, 128, 200) // 绿色半透明
                    });

                    if (overlayNode) {
                        this.overlayNodes.set(entranceTileId, overlayNode);
                    }
                } catch (error) {
                    console.error(`[UICardBuildingSelector] 创建overlay失败 tile=${entranceTileId}:`, error);
                }
            }
        }

        console.log(`[UICardBuildingSelector] 成功创建 ${this.overlayNodes.size} 个overlay`);
    }

    /**
     * 加载建筑选择贴图
     */
    private loadBuildingTexture(): Promise<Texture2D | null> {
        return new Promise((resolve) => {
            resources.load('textures/buildingSelector', Texture2D, (err, texture) => {
                if (err) {
                    console.warn('[UICardBuildingSelector] 加载buildingSelector贴图失败:', err);
                    resolve(null);
                } else {
                    console.log('[UICardBuildingSelector] buildingSelector贴图加载成功');
                    resolve(texture);
                }
            });
        });
    }

    /**
     * 设置点击处理
     */
    private setupClickHandlers(
        resolve: (buildingId: number | null) => void
    ): void {
        // 地面点击handler
        this.groundClickHandler = (event: any) => {
            const gridIndex = event.gridIndex as { x?: number; y?: number; z?: number } | undefined;
            const gridX = gridIndex?.x;
            const gridZ = gridIndex?.z ?? gridIndex?.y;

            if (gridX == null || gridZ == null) {
                console.warn('[UICardBuildingSelector] GroundClicked缺少gridIndex');
                return;
            }

            // 从 grid 坐标转换到 tileId
            const gameMap = MapManager.getInstance()?.getCurrentGameMap();
            if (!gameMap) {
                console.warn('[UICardBuildingSelector] 无法获取GameMap');
                return;
            }

            const mapTile = gameMap.getTileAt(gridX, gridZ);
            if (!mapTile) {
                console.log(`[UICardBuildingSelector] Grid (${gridX}, ${gridZ}) 没有tile`);
                return;
            }

            const tileId = mapTile.getTileId();

            // 检查是否是可选的入口tile
            const buildingId = this.entranceToBuilding.get(tileId);
            if (buildingId === undefined) {
                console.log(`[UICardBuildingSelector] 点击了不可选的tile: ${tileId}`);
                return;
            }

            console.log(`[UICardBuildingSelector] 选中建筑: ${buildingId} (通过入口tile ${tileId})`);

            // 清理并返回结果
            this.removeEventListeners();
            this.cleanup();
            resolve(buildingId);
        };

        EventBus.on(EventTypes.Game.GroundClicked, this.groundClickHandler);

        // ESC键取消监听
        this.escKeyHandler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                console.log('[UICardBuildingSelector] 用户取消选择（ESC）');
                this.removeEventListeners();
                this.cleanup();
                resolve(null);
            }
        };
        window.addEventListener('keydown', this.escKeyHandler);

        console.log('[UICardBuildingSelector] 等待用户选择建筑（ESC取消）');
    }

    /**
     * 清理overlays
     */
    private cleanup(): void {
        console.log(`[UICardBuildingSelector] 清理 ${this.overlayNodes.size} 个overlay`);
        this.overlayNodes.forEach(node => node.destroy());
        this.overlayNodes.clear();
        this.entranceToBuilding.clear();
    }
}
