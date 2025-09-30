/**
 * 地图ID分配与显示系统
 *
 * 负责为地图元素（tile和building）分配编号
 * 管理编号的显示和隐藏
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import {
    Vec2, Vec3, Node, Color, Label, UITransform,
    Canvas, director
} from 'cc';
import { MapTile } from '../core/MapTile';
import { getWeb3BlockByBlockId } from '../../voxel/Web3BlockTypes';

/**
 * Building信息接口
 */
export interface BuildingInfo {
    blockId: string;
    position: { x: number; z: number };
    size: 1 | 2;
    direction?: number;
    buildingId?: number;
    owner?: string;
    level?: number;
    price?: number;
    rent?: number[];
    mortgaged?: boolean;
}

/**
 * 地图ID系统
 * 管理tile和building的编号分配与显示
 */
export class MapIdSystem {

    // ID标签相关
    private _idLabels: Map<string, Node> = new Map();
    private _idLabelWorldPos: Map<string, Vec3> = new Map();
    private _idLabelsRootUI: Node | null = null;
    private _uiCanvas: Canvas | null = null;

    // 地图引用
    private _tiles: MapTile[] = [];
    private _tileIndex: Map<string, MapTile> = new Map();
    private _buildingRegistry: Map<string, BuildingInfo> = new Map();
    private _mainCamera: any = null;

    /**
     * 初始化ID系统
     */
    public initialize(
        tiles: MapTile[],
        tileIndex: Map<string, MapTile>,
        buildingRegistry: Map<string, BuildingInfo>,
        mainCamera: any
    ): void {
        this._tiles = tiles;
        this._tileIndex = tileIndex;
        this._buildingRegistry = buildingRegistry;
        this._mainCamera = mainCamera;
    }

    /**
     * 为tile和building分配编号
     */
    public assignIds(): void {
        console.log('[MapIdSystem] Starting ID assignment...');

        // 清除旧的编号
        this.clearAllIds();

        // 分配tile编号
        this.assignTileIds();

        // 分配building编号
        this.assignBuildingIds();

        console.log('[MapIdSystem] ID assignment completed');
    }

    /**
     * 清除所有编号
     */
    private clearAllIds(): void {
        // 清除tile编号
        for (const tile of this._tiles) {
            tile.setTileId(65535);  // u16最大值表示无效
        }

        // 清除building编号
        for (const buildingInfo of this._buildingRegistry.values()) {
            buildingInfo.buildingId = 65535;
        }

        console.log('[MapIdSystem] All IDs cleared');
    }

    /**
     * 为tile分配编号（使用DFS算法）
     */
    private assignTileIds(): void {
        // 找到所有医院tile
        const hospitalTiles = this.findHospitalTiles();
        if (hospitalTiles.length === 0) {
            console.warn('[MapIdSystem] No hospital tiles found');
            return;
        }

        // 选择最左边的医院tile作为起点
        let startTile = hospitalTiles[0];
        for (const tile of hospitalTiles) {
            const pos = tile.getGridPosition();
            const startPos = startTile.getGridPosition();
            if (pos.x < startPos.x) {
                startTile = tile;
            }
        }

        // 使用DFS分配编号
        let currentId = 0;
        const visited = new Set<string>();
        this.dfsAssignTileId(startTile, currentId, visited);

        console.log(`[MapIdSystem] Assigned IDs to ${visited.size} tiles`);
    }

    /**
     * 查找所有医院tile
     */
    private findHospitalTiles(): MapTile[] {
        const hospitalTiles: MapTile[] = [];
        for (const tile of this._tiles) {
            if (tile.getBlockId() === 'web3:hospital') {
                hospitalTiles.push(tile);
            }
        }
        return hospitalTiles;
    }

    /**
     * DFS递归分配tile编号
     */
    private dfsAssignTileId(tile: MapTile, currentId: number, visited: Set<string>): number {
        const pos = tile.getGridPosition();
        const key = `${pos.x}_${pos.y}`;

        // 已访问过，跳过
        if (visited.has(key)) {
            return currentId;
        }

        // 检查是否为建筑block，建筑不应该有tile_id
        const blockId = tile.getBlockId();
        if (blockId === 'web3:building_1x1' || blockId === 'web3:building_2x2') {
            // 建筑不分配tile_id，但仍标记为已访问避免重复遍历
            visited.add(key);
            // 清除可能已经错误设置的tile_id
            tile.setTileId(65535);
            return currentId;
        }

        // 标记为已访问并分配编号
        visited.add(key);
        tile.setTileId(currentId);
        currentId++;

        // 获取四个方向的相邻tile
        const directions = [
            { x: 0, y: 1 },   // 北
            { x: 1, y: 0 },   // 东
            { x: 0, y: -1 },  // 南
            { x: -1, y: 0 }   // 西
        ];

        for (const dir of directions) {
            const neighborPos = new Vec2(pos.x + dir.x, pos.y + dir.y);
            const neighborKey = `${neighborPos.x}_${neighborPos.y}`;
            const neighborTile = this._tileIndex.get(neighborKey);

            if (neighborTile && !visited.has(neighborKey)) {
                // 只对非建筑的tile进行递归
                const neighborBlockId = neighborTile.getBlockId();
                if (neighborBlockId !== 'web3:building_1x1' && neighborBlockId !== 'web3:building_2x2') {
                    currentId = this.dfsAssignTileId(neighborTile, currentId, visited);
                } else {
                    // 建筑标记为已访问但不分配编号
                    visited.add(neighborKey);
                    neighborTile.setTileId(65535);
                }
            }
        }

        return currentId;
    }

    /**
     * 为building分配编号
     */
    private assignBuildingIds(): void {
        // 获取所有building并按坐标排序
        const buildings = Array.from(this._buildingRegistry.values());

        // 按z坐标优先，x坐标次之排序（先行后列）
        buildings.sort((a, b) => {
            if (a.position.z !== b.position.z) {
                return a.position.z - b.position.z;
            }
            return a.position.x - b.position.x;
        });

        // 分配编号
        for (let i = 0; i < buildings.length; i++) {
            buildings[i].buildingId = i;
        }

        console.log(`[MapIdSystem] Assigned IDs to ${buildings.length} buildings`);
    }

    /**
     * 显示ID标签
     */
    public showIds(): void {
        console.log('[MapIdSystem] Showing ID labels...');

        // 确保UI容器存在
        if (!this.ensureIdLabelUIRoot()) {
            console.warn('[MapIdSystem] Canvas not found, cannot show ID labels');
            return;
        }

        // 清除旧的标签与位置缓存
        this.clearIdLabels();

        // 为tile创建标签（排除建筑）
        for (const tile of this._tiles) {
            const blockId = tile.getBlockId();
            // 跳过建筑block
            if (blockId === 'web3:building_1x1' || blockId === 'web3:building_2x2') {
                continue;
            }

            const tileId = tile.getTileId();
            if (tileId !== 65535) {  // 有效ID
                const pos = tile.getGridPosition();
                // 放在格子中心稍微抬高
                const worldPos = new Vec3(pos.x + 0.5, 1.5, pos.y + 0.5);
                const key = `tile_${pos.x}_${pos.y}`;
                const label = this.createIdLabel(`T${tileId}`, worldPos, new Color(255, 255, 255), key);  // 白色
                this._idLabels.set(key, label);
                this._idLabelWorldPos.set(key, worldPos);
            }
        }

        // 为building创建标签
        for (const buildingInfo of this._buildingRegistry.values()) {
            if (buildingInfo.buildingId !== undefined && buildingInfo.buildingId !== 65535) {
                // 计算中心位置
                let centerX = buildingInfo.position.x;
                let centerZ = buildingInfo.position.z;
                if (buildingInfo.size === 2) {
                    // 2x2中心应加1
                    centerX += 1;
                    centerZ += 1;
                } else {
                    // 1x1中心应加0.5
                    centerX += 0.5;
                    centerZ += 0.5;
                }

                const worldPos = new Vec3(centerX, 2, centerZ);  // Y抬高2，比tile更高
                const key = `building_${buildingInfo.position.x}_${buildingInfo.position.z}`;
                const label = this.createIdLabel(`B${buildingInfo.buildingId}`, worldPos, new Color(255, 255, 0), key);  // 黄色
                this._idLabels.set(key, label);
                this._idLabelWorldPos.set(key, worldPos);
            }
        }

        console.log(`[MapIdSystem] Created ${this._idLabels.size} ID labels`);
    }

    /**
     * 隐藏ID标签
     */
    public hideIds(): void {
        console.log('[MapIdSystem] Hiding ID labels...');
        this.clearIdLabels();

        // 清理UI容器
        if (this._idLabelsRootUI) {
            this._idLabelsRootUI.destroy();
            this._idLabelsRootUI = null;
        }
    }

    /**
     * 创建ID标签
     */
    private createIdLabel(text: string, worldPos: Vec3, color: Color, key: string): Node {
        // 确保UI容器存在
        if (!this._idLabelsRootUI || !this._uiCanvas) {
            this.ensureIdLabelUIRoot();
        }

        const labelNode = new Node('IDLabel_' + text);
        labelNode.addComponent(UITransform);
        labelNode.parent = this._idLabelsRootUI!;
        labelNode.layer = this._idLabelsRootUI!.layer;

        // 添加Label组件（UI）
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 18;
        label.lineHeight = 20;
        label.color = color;
        label.useSystemFont = true;
        label.fontFamily = 'Arial';
        label.overflow = Label.Overflow.NONE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        // 记录世界坐标，便于每帧更新投影到UI
        (labelNode as any)['worldPos'] = worldPos.clone();
        this._idLabelWorldPos.set(key, worldPos.clone());

        // 初始化一次位置
        this.updateSingleIdLabelPosition(key, labelNode);

        return labelNode;
    }

    /**
     * 清除所有ID标签
     */
    private clearIdLabels(): void {
        for (const label of this._idLabels.values()) {
            if (label && label.isValid) {
                label.destroy();
            }
        }
        this._idLabels.clear();
        this._idLabelWorldPos.clear();
        if (this._idLabelsRootUI && this._idLabelsRootUI.isValid) {
            this._idLabelsRootUI.removeAllChildren();
        }
    }

    /**
     * 确保ID标签的UI根节点存在
     */
    private ensureIdLabelUIRoot(): boolean {
        if (this._uiCanvas && this._idLabelsRootUI && this._idLabelsRootUI.isValid) {
            return true;
        }

        const scene = director.getScene();
        if (!scene) return false;

        const canvasNode = scene.getChildByName('Canvas');
        if (!canvasNode) {
            console.warn('[MapIdSystem] Canvas node not found in scene');
            return false;
        }

        const canvas = canvasNode.getComponent(Canvas);
        if (!canvas) {
            console.warn('[MapIdSystem] Canvas component not found on Canvas node');
            return false;
        }

        this._uiCanvas = canvas;

        // 创建/复用UI容器
        let root = canvasNode.getChildByName('IDLabelsRootUI');
        if (!root) {
            root = new Node('IDLabelsRootUI');
            root.addComponent(UITransform);
            canvasNode.addChild(root);
        }
        root.layer = canvasNode.layer;
        this._idLabelsRootUI = root;
        return true;
    }

    /**
     * 更新所有ID标签的UI位置（每帧调用）
     */
    public updateIdLabels(deltaTime: number): void {
        if (!this._uiCanvas || !this._idLabelsRootUI || this._idLabels.size === 0) {
            return;
        }
        this._idLabels.forEach((node, key) => {
            this.updateSingleIdLabelPosition(key, node);
        });
    }

    /**
     * 更新单个ID标签位置
     */
    private updateSingleIdLabelPosition(key: string, node: Node): void {
        if (!this._uiCanvas || !this._mainCamera) return;

        const worldPos = this._idLabelWorldPos.get(key) || (node as any)['worldPos'];
        if (!worldPos) return;

        // 如果在相机背后，可以选择隐藏
        const screenPos = this._mainCamera.worldToScreen(worldPos);
        const isBehind = screenPos.z <= 0;
        node.active = !isBehind;
        if (isBehind) return;

        // 投影到UI空间：使用主3D相机做世界->屏幕，再将屏幕->UI
        const uiTransform = this._uiCanvas.node.getComponent(UITransform);
        if (!uiTransform) return;
        const uiPos = uiTransform.convertToNodeSpaceAR(new Vec3(screenPos.x, screenPos.y, 0));
        node.setPosition(uiPos);
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        this.hideIds();
        this._tiles = [];
        this._tileIndex.clear();
        this._buildingRegistry.clear();
        this._mainCamera = null;
    }
}