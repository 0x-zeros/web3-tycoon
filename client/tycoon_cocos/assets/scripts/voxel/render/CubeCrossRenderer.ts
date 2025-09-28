/**
 * 横十字立方体渲染器组件
 *
 * 使用方法：
 * 1. 创建节点，添加 MeshRenderer 组件
 * 2. 挂载此组件
 * 3. 指定横十字贴图和effect
 * 4. 运行即可看到立方体6面贴图
 *
 * @author Web3 Tycoon Team
 */

import {
    _decorator,
    Component,
    MeshRenderer,
    Material,
    Texture2D,
    EffectAsset,
    CCFloat,
    resources,
    Mesh
} from 'cc';

import { buildCubeMeshWithCrossUV, CrossLayout } from './CubeCrossMesh';

const { ccclass, property } = _decorator;

@ccclass('CubeCrossRenderer')
export class CubeCrossRenderer extends Component {
    @property({
        type: Texture2D,
        displayName: '横十字贴图',
        tooltip: '4x3格式的横十字布局贴图'
    })
    atlas: Texture2D | null = null;

    @property({
        type: EffectAsset,
        displayName: 'Shader效果',
        tooltip: '指向 unlit-cross.effect'
    })
    effect: EffectAsset | null = null;

    @property({
        type: CCFloat,
        displayName: '立方体边长',
        tooltip: '立方体的尺寸',
        min: 0.1,
        max: 10.0
    })
    size: number = 1.0;

    @property({
        type: CCFloat,
        displayName: 'UV收缩',
        tooltip: 'UV收缩防止贴图边缘采样溢出(0~0.01)',
        min: 0,
        max: 0.01,
        step: 0.001
    })
    uvEpsilon: number = 0.0;

    @property({
        displayName: '透明模式',
        tooltip: '是否使用透明渲染'
    })
    transparent: boolean = false;

    @property({
        displayName: '自动加载资源',
        tooltip: '如果没有指定资源，自动从默认路径加载'
    })
    autoLoadResources: boolean = true;

    private meshRenderer: MeshRenderer | null = null;
    private generatedMesh: Mesh | null = null;
    private material: Material | null = null;

    /**
     * 组件启动
     */
    async start() {
        // 获取或添加 MeshRenderer 组件
        this.meshRenderer = this.getComponent(MeshRenderer);
        if (!this.meshRenderer) {
            this.meshRenderer = this.addComponent(MeshRenderer);
            console.log('[CubeCrossRenderer] 自动添加 MeshRenderer 组件');
        }

        // 自动加载资源（如果需要）
        if (this.autoLoadResources) {
            await this.tryLoadDefaultResources();
        }

        // 生成网格和应用材质
        this.generateCubeMesh();
        this.applyMaterial();
    }

    /**
     * 尝试加载默认资源
     */
    private async tryLoadDefaultResources(): Promise<void> {
        // 如果没有指定 effect，尝试加载默认的
        if (!this.effect) {
            try {
                const effectPath = 'voxel/shaders/unlit-cross/unlit-cross';
                this.effect = await this.loadResource<EffectAsset>(effectPath, EffectAsset);
                console.log('[CubeCrossRenderer] 自动加载 effect 成功:', effectPath);
            } catch (err) {
                console.warn('[CubeCrossRenderer] 自动加载 effect 失败:', err);
            }
        }

        // 如果没有指定贴图，可以尝试加载默认测试贴图
        if (!this.atlas && this.autoLoadResources) {
            try {
                // 这里可以指定默认的测试贴图路径
                // 例如：'textures/test_cross/texture'
                // 暂时跳过，等用户提供贴图
            } catch (err) {
                // 忽略，使用白色默认贴图
            }
        }
    }

    /**
     * 加载资源辅助方法
     */
    private loadResource<T>(path: string, type: any): Promise<T> {
        return new Promise((resolve, reject) => {
            resources.load(path, type, (err, asset) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(asset as T);
                }
            });
        });
    }

    /**
     * 生成立方体网格
     */
    private generateCubeMesh(): void {
        if (!this.meshRenderer) return;

        // 生成横十字UV的立方体网格
        this.generatedMesh = buildCubeMeshWithCrossUV({
            size: this.size,
            uvEpsilon: this.uvEpsilon,
            // 可以在这里传入自定义布局
            // layout: customLayout
        });

        // 应用到 MeshRenderer
        this.meshRenderer.mesh = this.generatedMesh;
        console.log('[CubeCrossRenderer] 立方体网格生成完成');
    }

    /**
     * 应用材质
     */
    private applyMaterial(): void {
        if (!this.meshRenderer || !this.effect) {
            console.warn('[CubeCrossRenderer] 缺少必要组件或资源');
            return;
        }

        // 创建材质
        this.material = new Material();
        this.material.initialize({
            effectAsset: this.effect,
            technique: this.transparent ? 1 : 0  // 0=opaque, 1=transparent
        });

        // 设置贴图
        if (this.atlas) {
            // 建议的贴图设置：
            // - Mipmaps: 开启
            // - Wrap: Clamp to Edge
            // - Filter: Linear/Trilinear
            this.material.setProperty('mainTexture', this.atlas);
            console.log('[CubeCrossRenderer] 贴图已应用');
        } else {
            console.warn('[CubeCrossRenderer] 未指定贴图，使用默认白色贴图');
        }

        // 应用材质到渲染器
        this.meshRenderer.setMaterial(this.material, 0);
        console.log('[CubeCrossRenderer] 材质应用完成');
    }

    /**
     * 刷新渲染（编辑器中修改属性时调用）
     */
    public refresh(): void {
        if (!this.meshRenderer) return;

        this.generateCubeMesh();
        this.applyMaterial();
    }

    /**
     * 设置贴图（运行时）
     */
    public setTexture(texture: Texture2D): void {
        this.atlas = texture;
        if (this.material) {
            this.material.setProperty('mainTexture', texture);
        }
    }

    /**
     * 设置立方体尺寸（运行时）
     */
    public setSize(size: number): void {
        this.size = size;
        this.generateCubeMesh();
    }

    /**
     * 设置UV收缩（运行时）
     */
    public setUVEpsilon(epsilon: number): void {
        this.uvEpsilon = epsilon;
        this.generateCubeMesh();
    }

    /**
     * 设置自定义布局（高级用法）
     */
    public setCustomLayout(layout: CrossLayout): void {
        if (!this.meshRenderer) return;

        this.generatedMesh = buildCubeMeshWithCrossUV({
            size: this.size,
            uvEpsilon: this.uvEpsilon,
            layout: layout
        });

        this.meshRenderer.mesh = this.generatedMesh;
    }

    /**
     * 组件销毁时清理
     */
    protected onDestroy(): void {
        // 清理生成的资源
        if (this.generatedMesh) {
            this.generatedMesh.destroy();
            this.generatedMesh = null;
        }

        if (this.material) {
            this.material.destroy();
            this.material = null;
        }
    }
}