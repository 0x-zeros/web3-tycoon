/**
 * 网格边界可视化组件
 *
 * 绘制 u8 坐标的有效范围（0-255）
 * 用于提示编辑器中可放置 tile/building 的安全区域
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import {
    _decorator,
    Component,
    Camera,
    Color,
    Vec3,
    find
} from 'cc';

const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('GridBoundary')
@executeInEditMode(true)
export class GridBoundary extends Component {

    @property({ tooltip: '目标相机' })
    public cam: Camera | null = null;

    @property({ tooltip: '边界颜色（橙黄色）' })
    public boundaryColor: Color = new Color(255, 200, 0, 255);

    @property({ tooltip: '最小坐标（u8 最小值）' })
    public minCoord: number = 0;

    @property({ tooltip: '最大坐标（u8 最大值）' })
    public maxCoord: number = 255;

    @property({ tooltip: 'Y 高度（稍高于 grid）' })
    public y: number = 0.05;

    @property({ tooltip: '是否显示原点标记' })
    public showOriginMarker: boolean = true;

    @property({ tooltip: '原点标记颜色（红色）' })
    public originColor: Color = new Color(255, 0, 0, 255);

    @property({ tooltip: '是否启用' })
    public enabled: boolean = true;

    private _isInitialized: boolean = false;

    protected start(): void {
        this.initializeCamera();
    }

    protected update(): void {
        if (!this.enabled) return;
        this.drawBoundary();
    }

    /**
     * 初始化相机
     */
    private initializeCamera(): void {
        if (!this.cam) {
            const mainCameraNode = find('Main Camera');
            if (mainCameraNode) {
                this.cam = mainCameraNode.getComponent(Camera);
            }
        }

        if (!this.cam) {
            console.error('[GridBoundary] No camera found');
            return;
        }

        // 初始化 GeometryRenderer
        this.cam.camera?.initGeometryRenderer();
        this._isInitialized = true;
        console.log('[GridBoundary] Initialized');
    }

    /**
     * 绘制边界框
     */
    private drawBoundary(): void {
        if (!this._isInitialized) return;

        const gr = this.cam?.camera?.geometryRenderer;
        if (!gr) return;

        const min = this.minCoord + 0.5;  // 格子中心偏移
        const max = this.maxCoord + 0.5;
        const y = this.y;

        // 绘制 4 条边界线（矩形边框）
        // 底边（z=min, x: min→max）
        gr.addLine(
            new Vec3(min, y, min),
            new Vec3(max, y, min),
            this.boundaryColor
        );

        // 右边（x=max, z: min→max）
        gr.addLine(
            new Vec3(max, y, min),
            new Vec3(max, y, max),
            this.boundaryColor
        );

        // 顶边（z=max, x: max→min）
        gr.addLine(
            new Vec3(max, y, max),
            new Vec3(min, y, max),
            this.boundaryColor
        );

        // 左边（x=min, z: max→min）
        gr.addLine(
            new Vec3(min, y, max),
            new Vec3(min, y, min),
            this.boundaryColor
        );

        // 绘制原点标记（如果在范围内）
        if (this.showOriginMarker) {
            const originX = 0;
            const originZ = 0;

            if (originX >= this.minCoord && originX <= this.maxCoord &&
                originZ >= this.minCoord && originZ <= this.maxCoord) {

                // 绘制十字标记原点 (0, 0)
                const crossSize = 0.5;

                // 横线
                gr.addLine(
                    new Vec3(originX + 0.5 - crossSize, y, originZ + 0.5),
                    new Vec3(originX + 0.5 + crossSize, y, originZ + 0.5),
                    this.originColor
                );

                // 竖线
                gr.addLine(
                    new Vec3(originX + 0.5, y, originZ + 0.5 - crossSize),
                    new Vec3(originX + 0.5, y, originZ + 0.5 + crossSize),
                    this.originColor
                );
            }
        }
    }

    /**
     * 检查坐标是否在边界内
     * @param x 网格 X 坐标
     * @param z 网格 Z 坐标
     * @returns true=在范围内, false=超出范围
     */
    public isInBounds(x: number, z: number): boolean {
        return x >= this.minCoord && x <= this.maxCoord &&
               z >= this.minCoord && z <= this.maxCoord;
    }

    /**
     * 启用/禁用边界显示
     */
    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
}
