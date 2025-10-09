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
    find,
    Node,
    MeshRenderer,
    Material,
    utils,
    primitives
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
    private _useGeometryRenderer: boolean = true;
    private _fallbackLineContainer: Node | null = null;
    
    @property({ tooltip: '备用边界线厚度（用于无GeometryRenderer环境）' })
    public fallbackLineThickness: number = 0.03;

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

        // 初始化 GeometryRenderer（若存在）
        if (this.cam.camera && (this.cam.camera as any).initGeometryRenderer) {
            try {
                (this.cam.camera as any).initGeometryRenderer();
            } catch (e) {
                this._useGeometryRenderer = false;
                console.warn('[GridBoundary] GeometryRenderer init failed, using fallback');
            }
        } else {
            this._useGeometryRenderer = false;
        }
        this._isInitialized = true;
        console.log('[GridBoundary] Initialized');
    }

    /**
     * 绘制边界框
     */
    private drawBoundary(): void {
        if (!this._isInitialized) return;

        const gr = this._useGeometryRenderer ? (this.cam?.camera as any)?.geometryRenderer : null;
        if (!gr) {
            // 使用备用Mesh线
            this.ensureFallbackLines();
            return;
        }

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
     * 构建备用边界线（使用细长盒子Mesh）
     */
    private ensureFallbackLines(): void {
        if (this._fallbackLineContainer) return;

        const container = new Node('GridBoundaryFallback');
        container.setParent(this.node);
        this._fallbackLineContainer = container;

        const material = new Material();
        material.initialize({ effectName: 'builtin-unlit' });
        material.setProperty('mainColor', this.boundaryColor.clone());

        const min = this.minCoord + 0.5;
        const max = this.maxCoord + 0.5;
        const y = this.y;
        const t = Math.max(0.001, this.fallbackLineThickness);
        const length = (max - min);

        // 四条边
        const edges: Array<{ pos: Vec3; size: { w: number; l: number } }> = [
            // 底边（沿X）
            { pos: new Vec3((min + max) / 2, y, min), size: { w: length, l: t } },
            // 顶边（沿X）
            { pos: new Vec3((min + max) / 2, y, max), size: { w: length, l: t } },
            // 左边（沿Z）
            { pos: new Vec3(min, y, (min + max) / 2), size: { w: t, l: length } },
            // 右边（沿Z）
            { pos: new Vec3(max, y, (min + max) / 2), size: { w: t, l: length } },
        ];

        for (let i = 0; i < edges.length; i++) {
            const n = new Node(`Boundary_${i}`);
            n.setParent(container);
            const geom = primitives.box({ width: edges[i].size.w, height: t, length: edges[i].size.l });
            const mesh = utils.MeshUtils.createMesh(geom);
            const mr = n.addComponent(MeshRenderer);
            mr.mesh = mesh;
            mr.material = material;
            n.setPosition(edges[i].pos);
        }

        // 原点十字
        if (this.showOriginMarker) {
            const oc = new Material();
            oc.initialize({ effectName: 'builtin-unlit' });
            oc.setProperty('mainColor', this.originColor.clone());

            const crossSize = 0.5;
            const ox = 0 + 0.5;
            const oz = 0 + 0.5;

            const horiz = new Node('Origin_H');
            horiz.setParent(container);
            const hGeom = primitives.box({ width: crossSize * 2, height: t, length: t });
            const hMesh = utils.MeshUtils.createMesh(hGeom);
            const hMr = horiz.addComponent(MeshRenderer);
            hMr.mesh = hMesh;
            hMr.material = oc;
            horiz.setPosition(ox, y, oz);

            const vert = new Node('Origin_V');
            vert.setParent(container);
            const vGeom = primitives.box({ width: t, height: t, length: crossSize * 2 });
            const vMesh = utils.MeshUtils.createMesh(vGeom);
            const vMr = vert.addComponent(MeshRenderer);
            vMr.mesh = vMesh;
            vMr.material = oc;
            vert.setPosition(ox, y, oz);
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
