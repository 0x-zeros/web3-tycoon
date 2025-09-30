/**
 * 地图编辑网格系统
 *
 * 负责编辑模式下的网格显示和配置
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Node, Color, Camera } from 'cc';
import { GridGround } from '../GridGround';

/**
 * 网格配置接口
 */
export interface GridConfig {
    step?: number;
    halfSize?: number;
    color?: Color;
    y?: number;
    enableClickDetection?: boolean;
    enableSnapping?: boolean;
    debugMode?: boolean;
}

/**
 * 地图编辑网格系统
 * 管理编辑模式下的网格地面
 */
export class MapEditorGrid {

    private _gridNode: Node | null = null;
    private _gridGround: GridGround | null = null;
    private _parentNode: Node | null = null;
    private _mainCamera: Camera | null = null;

    /**
     * 初始化网格系统
     */
    public initialize(parentNode: Node, mainCamera: Camera | null): void {
        this._parentNode = parentNode;
        this._mainCamera = mainCamera;
    }

    /**
     * 创建编辑模式网格
     */
    public createEditModeGrid(config?: GridConfig): Node | null {
        if (!this._parentNode) {
            console.error('[MapEditorGrid] Parent node not set');
            return null;
        }

        // 创建网格地面节点
        this._gridNode = new Node('GridGround');
        this._gridNode.setParent(this._parentNode);

        // 添加GridGround组件
        this._gridGround = this._gridNode.addComponent(GridGround);

        // 应用默认配置
        const defaultConfig: GridConfig = {
            step: 1,
            halfSize: 50,
            color: new Color(130, 130, 130, 255),
            y: 0,
            enableClickDetection: true,
            enableSnapping: true,
            debugMode: false
        };

        // 合并用户配置
        const finalConfig = { ...defaultConfig, ...config };

        // 配置网格参数
        this._gridGround.step = finalConfig.step!;
        this._gridGround.halfSize = finalConfig.halfSize!;
        this._gridGround.color = finalConfig.color!;
        this._gridGround.y = finalConfig.y!;
        this._gridGround.enableClickDetection = finalConfig.enableClickDetection!;
        this._gridGround.enableSnapping = finalConfig.enableSnapping!;
        this._gridGround.debugMode = finalConfig.debugMode!;
        this._gridGround.cam = this._mainCamera;

        // 手动调用初始化（如果组件还没有start）
        if (this._mainCamera) {
            this._gridGround.createWithConfig({
                step: finalConfig.step!,
                halfSize: finalConfig.halfSize!,
                color: finalConfig.color!,
                y: finalConfig.y!,
                camera: this._mainCamera
            });
        }

        console.log('[MapEditorGrid] Edit mode grid created');
        return this._gridNode;
    }

    /**
     * 更新网格大小
     */
    public updateGridSize(halfSize: number): void {
        if (!this._gridGround) {
            console.warn('[MapEditorGrid] Grid not created yet');
            return;
        }

        this._gridGround.halfSize = halfSize;
        // 重新创建网格
        if (this._mainCamera) {
            this._gridGround.createWithConfig({
                step: this._gridGround.step,
                halfSize: halfSize,
                color: this._gridGround.color,
                y: this._gridGround.y,
                camera: this._mainCamera
            });
        }

        console.log(`[MapEditorGrid] Grid size updated to ${halfSize}`);
    }

    /**
     * 设置网格可见性
     */
    public setGridVisibility(visible: boolean): void {
        if (!this._gridNode) {
            console.warn('[MapEditorGrid] Grid not created yet');
            return;
        }

        this._gridNode.active = visible;
        console.log(`[MapEditorGrid] Grid visibility set to ${visible}`);
    }

    /**
     * 配置网格吸附
     */
    public configureGridSnapping(enabled: boolean, snapSize?: number): void {
        if (!this._gridGround) {
            console.warn('[MapEditorGrid] Grid not created yet');
            return;
        }

        this._gridGround.enableSnapping = enabled;
        if (snapSize !== undefined) {
            this._gridGround.step = snapSize;
        }

        console.log(`[MapEditorGrid] Grid snapping ${enabled ? 'enabled' : 'disabled'}, snap size: ${this._gridGround.step}`);
    }

    /**
     * 更新网格颜色
     */
    public updateGridColor(color: Color): void {
        if (!this._gridGround) {
            console.warn('[MapEditorGrid] Grid not created yet');
            return;
        }

        this._gridGround.color = color;
        // 重新创建网格以应用新颜色
        if (this._mainCamera) {
            this._gridGround.createWithConfig({
                step: this._gridGround.step,
                halfSize: this._gridGround.halfSize,
                color: color,
                y: this._gridGround.y,
                camera: this._mainCamera
            });
        }
    }

    /**
     * 获取网格组件
     */
    public getGridGround(): GridGround | null {
        return this._gridGround;
    }

    /**
     * 获取网格节点
     */
    public getGridNode(): Node | null {
        return this._gridNode;
    }

    /**
     * 销毁网格
     */
    public destroyGrid(): void {
        if (this._gridNode && this._gridNode.isValid) {
            this._gridNode.destroy();
            this._gridNode = null;
            this._gridGround = null;
            console.log('[MapEditorGrid] Grid destroyed');
        }
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        this.destroyGrid();
        this._parentNode = null;
        this._mainCamera = null;
    }
}