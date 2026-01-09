/**
 * MinimapCameraController - 小地图相机控制器
 *
 * 独立控制Minimap Camera的位置和投影参数，
 * 根据地图范围自动调整视野，保持固定的等距视角。
 */

import { _decorator, Component, Camera, Vec3 } from 'cc';
import { MapManager } from '../map/MapManager';
import { MapTile } from '../map/core/MapTile';

const { ccclass, property } = _decorator;

// 角度转弧度
const DEG2RAD = Math.PI / 180;

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
        // 计算正交相机的orthoHeight（视野半高）
        const maxRange = Math.max(bounds.width, bounds.depth) + this.PADDING * 2;
        const orthoHeight = maxRange / 2;

        // 计算相机位置（45度等距视角）
        const pitchRad = this.PITCH_ANGLE * DEG2RAD;
        const yawRad = this.YAW_ANGLE * DEG2RAD;

        // 相机距离（正交投影下距离不影响缩放，但影响近远裁面）
        const distance = orthoHeight * 2;

        // 计算相机位置
        // 在等距视角下，相机应该在目标点的"右上方"（从上方看）
        const cameraX = bounds.centerX - distance * Math.sin(yawRad);
        const cameraY = distance * Math.sin(-pitchRad);
        const cameraZ = bounds.centerZ + distance * Math.cos(yawRad);

        // 应用位置和旋转
        this.node.setPosition(new Vec3(cameraX, cameraY, cameraZ));
        this.node.setRotationFromEuler(this.PITCH_ANGLE, this.YAW_ANGLE, 0);

        // 设置正交高度
        if (this.camera) {
            this.camera.orthoHeight = orthoHeight;
        }

        console.log(`[MinimapCamera] Position: (${cameraX.toFixed(1)}, ${cameraY.toFixed(1)}, ${cameraZ.toFixed(1)})`);
        console.log(`[MinimapCamera] OrthoHeight: ${orthoHeight.toFixed(1)}, MapCenter: (${bounds.centerX.toFixed(1)}, ${bounds.centerZ.toFixed(1)})`);
    }
}
