/**
 * MinimapCameraController - 小地图相机控制器
 *
 * 独立控制Minimap Camera的位置和投影参数，
 * 根据地图范围自动调整视野，保持固定的等距视角。
 */

import { _decorator, Component, Camera, Vec3, view } from 'cc';
import { MapManager } from '../map/MapManager';
import { MapTile } from '../map/core/MapTile';

const { ccclass, property } = _decorator;

// 地图边界信息
interface MapBounds {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    centerX: number;
    centerZ: number;
    width: number;
    depth: number;
}

@ccclass('MinimapCameraController')
export class MinimapCameraController extends Component {

    @property({ type: Camera })
    camera: Camera | null = null;

    // 固定的等距视角参数（与主相机一致）
    private readonly PITCH_ANGLE = -45;  // 俯视角度
    private readonly YAW_ANGLE = -45;    // 水平旋转
    private readonly PADDING = 2;        // 边缘留白
    private readonly HEIGHT_PADDING = 2; // 建筑高度留白

    protected onLoad(): void {
        console.log('[MinimapCamera] onLoad called');

        if (!this.camera) {
            this.camera = this.getComponent(Camera);
            console.log(`[MinimapCamera] Got camera from getComponent: ${this.camera ? 'success' : 'failed'}`);
        }

        // 设置为正交投影
        if (this.camera) {
            this.camera.projection = Camera.ProjectionType.ORTHO;
            console.log('[MinimapCamera] Set to orthographic projection');
        } else {
            console.error('[MinimapCamera] Camera is null in onLoad!');
        }
    }

    /**
     * 激活相机
     */
    public activate(): void {
        console.log('[MinimapCamera] activate() called');

        // 先激活节点
        this.node.active = true;

        // 确保 camera 引用（因为 onLoad 可能还没执行）
        if (!this.camera) {
            this.camera = this.getComponent(Camera);
            console.log(`[MinimapCamera] Got camera in activate: ${this.camera ? 'success' : 'failed'}`);
        }

        // 设置正交投影
        if (this.camera) {
            this.camera.projection = Camera.ProjectionType.ORTHO;
            this.camera.enabled = true;
            console.log('[MinimapCamera] Camera enabled and set to orthographic');
        }

        console.log('[MinimapCamera] Activated');
    }

    /**
     * 停用相机
     */
    public deactivate(): void {
        if (this.camera) {
            this.camera.enabled = false;
        }
        console.log('[MinimapCamera] Deactivated');
    }

    /**
     * 更新相机位置以覆盖整个地图
     */
    public updatePosition(): void {
        console.log('[MinimapCamera] updatePosition called');

        const mapManager = MapManager.getInstance();
        console.log(`[MinimapCamera] MapManager: ${mapManager ? 'found' : 'null'}`);

        const gameMap = mapManager?.getCurrentGameMap();
        console.log(`[MinimapCamera] GameMap: ${gameMap ? 'found' : 'null'}`);
        console.log(`[MinimapCamera] Camera: ${this.camera ? 'found' : 'null'}`);

        if (!gameMap || !this.camera) {
            console.warn('[MinimapCamera] GameMap or Camera not available');
            return;
        }

        // 计算地图范围
        const tiles = gameMap.getAllTiles();
        console.log(`[MinimapCamera] Found ${tiles.length} tiles`);

        const bounds = this._calculateBounds(tiles);
        console.log(`[MinimapCamera] Bounds: minX=${bounds.minX}, maxX=${bounds.maxX}, minZ=${bounds.minZ}, maxZ=${bounds.maxZ}`);

        // 应用相机设置
        this._applyCameraSettings(bounds);
    }

    /**
     * 计算地图边界
     */
    private _calculateBounds(tiles: MapTile[]): MapBounds {
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (const tile of tiles) {
            const pos = tile.getGridPosition();
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x + 1);  // +1 因为格子占一格
            minZ = Math.min(minZ, pos.y);      // Vec2.y 是 z 坐标
            maxZ = Math.max(maxZ, pos.y + 1);
        }

        // 如果没有tiles，使用默认范围
        if (tiles.length === 0) {
            minX = 0; maxX = 30;
            minZ = 0; maxZ = 30;
        }

        const width = maxX - minX;
        const depth = maxZ - minZ;

        return {
            minX,
            maxX,
            minZ,
            maxZ,
            centerX: (minX + maxX) / 2,
            centerZ: (minZ + maxZ) / 2,
            width,
            depth
        };
    }

    /**
     * 应用相机设置
     */
    private _applyCameraSettings(bounds: MapBounds): void {
        const heightPad = this.HEIGHT_PADDING;
        const center = new Vec3(bounds.centerX, heightPad * 0.5, bounds.centerZ);

        // 固定等距视角
        this.node.setRotationFromEuler(this.PITCH_ANGLE, this.YAW_ANGLE, 0);

        const minX = bounds.minX - this.PADDING;
        const maxX = bounds.maxX + this.PADDING;
        const minZ = bounds.minZ - this.PADDING;
        const maxZ = bounds.maxZ + this.PADDING;
        const minY = 0;
        const maxY = heightPad;

        // 计算相机空间下的边界尺寸，确保45度视角下能完整覆盖地图
        const corners = [
            new Vec3(minX, minY, minZ),
            new Vec3(minX, minY, maxZ),
            new Vec3(maxX, minY, minZ),
            new Vec3(maxX, minY, maxZ),
            new Vec3(minX, maxY, minZ),
            new Vec3(minX, maxY, maxZ),
            new Vec3(maxX, maxY, minZ),
            new Vec3(maxX, maxY, maxZ)
        ];

        const right = this.node.right;
        const up = this.node.up;

        let minLocalX = Infinity;
        let maxLocalX = -Infinity;
        let minLocalY = Infinity;
        let maxLocalY = -Infinity;
        const offset = new Vec3();

        for (const corner of corners) {
            Vec3.subtract(offset, corner, center);
            const localX = Vec3.dot(offset, right);
            const localY = Vec3.dot(offset, up);
            minLocalX = Math.min(minLocalX, localX);
            maxLocalX = Math.max(maxLocalX, localX);
            minLocalY = Math.min(minLocalY, localY);
            maxLocalY = Math.max(maxLocalY, localY);
        }

        const halfWidth = (maxLocalX - minLocalX) * 0.5;
        const halfHeight = (maxLocalY - minLocalY) * 0.5;
        const aspect = this._getViewAspect();
        let orthoHeight = Math.max(halfHeight, halfWidth / aspect);

        if (!isFinite(orthoHeight) || orthoHeight <= 0) {
            orthoHeight = Math.max(bounds.width, bounds.depth) * 0.5 + this.PADDING;
        }

        if (this.camera) {
            this.camera.orthoHeight = orthoHeight;
        }

        const distance = orthoHeight * 2;
        const forward = this.node.forward;
        this.node.setPosition(
            center.x - forward.x * distance,
            center.y - forward.y * distance,
            center.z - forward.z * distance
        );

        console.log(`[MinimapCamera] Position: (${this.node.position.x.toFixed(1)}, ${this.node.position.y.toFixed(1)}, ${this.node.position.z.toFixed(1)})`);
        console.log(`[MinimapCamera] OrthoHeight: ${orthoHeight.toFixed(1)}, MapCenter: (${bounds.centerX.toFixed(1)}, ${bounds.centerZ.toFixed(1)})`);
    }

    private _getViewAspect(): number {
        const size = view.getVisibleSize();
        return size.height > 0 ? size.width / size.height : 1;
    }
}
