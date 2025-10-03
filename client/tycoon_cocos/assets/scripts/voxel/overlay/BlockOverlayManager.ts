/**
 * Block Overlay管理器
 *
 * 在block上叠加额外的视觉效果层（箭头、装饰、文字等）
 * 支持多层overlay，每层可独立控制渲染的面
 *
 * @author Web3 Tycoon Team
 */

import { Node, Mesh, MeshRenderer, Vec3, Vec2, Texture2D, Color, gfx, utils, Material, EffectAsset, resources } from 'cc';
import { OverlayConfig, OverlayFace } from './OverlayTypes';

export class BlockOverlayManager {
    private static _cachedEffect: EffectAsset | null = null;
    private static _loadingEffectPromise: Promise<EffectAsset | null> | null = null;
    // 调试：不绑定材质以观察默认渲染（粉色）
    public static DEBUG_NO_MATERIAL: boolean = false;
    public static DEBUG_LOG: boolean = true;

    private static async getOverlayEffect(): Promise<EffectAsset | null> {
        if (this._cachedEffect) return this._cachedEffect;
        if (this._loadingEffectPromise) return this._loadingEffectPromise;

        // 使用专用 overlay effect，支持 u_BiomeColor.w 控制整体透明度
        this._loadingEffectPromise = this.loadAsset<EffectAsset>('voxel/shaders/voxel-overlay-tile', EffectAsset);
        const effect = await this._loadingEffectPromise;
        this._cachedEffect = effect;
        this._loadingEffectPromise = null;
        return effect;
    }

    /**
     * 为block节点创建overlay层
     *
     * @param blockNode 目标block节点
     * @param config Overlay配置
     * @returns 创建的overlay节点，失败返回null
     */
    static async createOverlay(
        blockNode: Node,
        config: OverlayConfig
    ): Promise<Node | null> {
        const layerIndex = config.layerIndex || 0;
        const overlayNode = new Node(`Overlay_${layerIndex}`);
        overlayNode.setParent(blockNode);
        overlayNode.setPosition(0, 0, 0);

        // 创建只包含指定faces的mesh（网格侧做膨胀，shader不再膨胀）
        const faces = config.faces || [OverlayFace.UP];  // 默认只渲染顶面
        const inflate = config.inflate || 0.001;
        const mesh = this.createOverlayMesh(faces, inflate);

        if (!mesh) {
            overlayNode.destroy();
            console.error('[BlockOverlayManager] Failed to create overlay mesh');
            return null;
        }

        // 添加MeshRenderer
        const renderer = overlayNode.addComponent(MeshRenderer);
        renderer.mesh = mesh;
        // 自定义overlay网格与体素坐标系对齐，无需额外偏移
        overlayNode.setPosition(0, 0, 0);

        // 如果开启了调试不绑定材质，直接返回（应出现粉色/默认材质）
        if (this.DEBUG_NO_MATERIAL) {
            console.warn('[BlockOverlayManager] DEBUG_NO_MATERIAL 开启：不绑定材质用于可见性测试');
            console.log(`[BlockOverlayManager] Created overlay layer ${layerIndex} (debug no material)`);
            return overlayNode;
        }

        // 创建overlay材质（直接创建，不通过MaterialFactory）
        try {
            // 加载/获取voxel-overlay shader（带缓存）
            const effectAsset = await this.getOverlayEffect();

            if (!effectAsset) {
                console.error('[BlockOverlayManager] Failed to load voxel-overlay shader');
                overlayNode.destroy();
                return null;
            }

            // 创建材质
            const material = new Material();
            material.initialize({
                effectAsset: effectAsset,
                technique: (config as any).techniqueIndex ?? 1  // 0=opaque, 1=transparent（默认透明）
            });

            // 调试：输出贴图信息
            // if (this.DEBUG_LOG) {
            //     const tex = config.texture;
            //     const img = (tex as any)?.image;
            //     console.log('[BlockOverlayManager] Texture ready:', {
            //         name: (tex as any)?._uuid || tex?.name,
            //         width: tex?.width,
            //         height: tex?.height,
            //         hasImage: !!img,
            //         imageSize: img ? { width: img.width, height: img.height } : null,
            //     });
            // }

            // 设置overlay纹理（使用通用命名 mainTexture）
            material.setProperty('mainTexture', config.texture);

            // 不使用 shader 侧膨胀
            if (config.color) {
                //重点，使用0-255的值，不是0-1的啊，这边设置为1，然后就会全黑或者全透明。
                material.setProperty('mainColor', config.color);
            } else {
                material.setProperty('mainColor', Color.WHITE);
            }

            renderer.setMaterial(material, 0);

            // if (this.DEBUG_LOG) {
            //     console.log('[BlockOverlayManager] Material set with mainTexture & mainColor');
            // }

            console.log(`[BlockOverlayManager] Created overlay layer ${layerIndex} with ${faces.length} faces`);
            return overlayNode;

        } catch (error) {
            console.error('[BlockOverlayManager] Failed to create overlay material:', error);
            overlayNode.destroy();
            return null;
        }
    }

    /**
     * 创建overlay mesh（只包含指定的faces）
     *
     * @param faces 要渲染的面列表
     * @param inflate Z-fight防护膨胀值（沿法线方向）
     * @returns Cocos Mesh
     */
    private static createOverlayMesh(
        faces: OverlayFace[],
        inflate: number
    ): Mesh | null {
        const vertices: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];

        let vertexCount = 0;

        // 标准1x1x1 block的from/to
        // 与体素系统坐标保持一致（-0.5 ~ 0.5）
        const from = new Vec3(-0.5, -0.5, -0.5);
        const to = new Vec3(0.5, 0.5, 0.5);

        // 为每个指定的face生成顶点
        for (const faceDir of faces) {
            const faceVertices = this.getFaceVertices(faceDir, from, to, inflate);
            const faceNormal = this.getFaceNormal(faceDir);
            const faceUVs = this.getFaceUVs(faceDir);

            // 添加4个顶点
            for (let i = 0; i < 4; i++) {
                vertices.push(faceVertices[i].x, faceVertices[i].y, faceVertices[i].z);
                normals.push(faceNormal.x, faceNormal.y, faceNormal.z);
                uvs.push(faceUVs[i].x, faceUVs[i].y);
                colors.push(1, 1, 1, 1);  // 白色，通过shader的u_BiomeColor调色
            }

            // 添加2个三角形的索引（CCW顺序）
            const base = vertexCount;
            indices.push(
                base, base + 1, base + 2,
                base, base + 2, base + 3
            );
            vertexCount += 4;
        }

        // 创建Cocos Mesh
        return this.createCocosMesh(vertices, normals, uvs, colors, indices);
    }

    /**
     * 获取面的顶点（带inflate膨胀）
     *
     * @param dir 面方向
     * @param from Block起始点
     * @param to Block结束点
     * @param inflate 膨胀值（沿法线方向）
     * @returns 4个顶点（左下、右下、右上、左上）
     */
    private static getFaceVertices(
        dir: OverlayFace,
        from: Vec3,
        to: Vec3,
        inflate: number
    ): Vec3[] {
        // 顶点顺序: 左下、右下、右上、左上（匹配Minecraft UV）
        let vertices: Vec3[];

        switch (dir) {
            case OverlayFace.UP: // +Y 顶面（与MeshBuilder顶点顺序保持一致，避免背面剔除）
                vertices = [
                    new Vec3(to.x, to.y, from.z),   // 左下（相对视角）
                    new Vec3(from.x, to.y, from.z), // 右下
                    new Vec3(from.x, to.y, to.z),   // 右上
                    new Vec3(to.x, to.y, to.z)      // 左上
                ];
                break;
            case OverlayFace.DOWN: // -Y 底面
                vertices = [
                    new Vec3(from.x, from.y, to.z),   // 左下
                    new Vec3(from.x, from.y, from.z), // 右下
                    new Vec3(to.x, from.y, from.z),   // 右上
                    new Vec3(to.x, from.y, to.z)      // 左上
                ];
                break;
            case OverlayFace.NORTH: // -Z
                vertices = [
                    new Vec3(to.x, from.y, from.z),   // 左下
                    new Vec3(from.x, from.y, from.z), // 右下
                    new Vec3(from.x, to.y, from.z),   // 右上
                    new Vec3(to.x, to.y, from.z)      // 左上
                ];
                break;
            case OverlayFace.SOUTH: // +Z
                vertices = [
                    new Vec3(from.x, from.y, to.z),  // 左下
                    new Vec3(to.x, from.y, to.z),    // 右下
                    new Vec3(to.x, to.y, to.z),      // 右上
                    new Vec3(from.x, to.y, to.z)     // 左上
                ];
                break;
            case OverlayFace.WEST: // -X
                vertices = [
                    new Vec3(from.x, from.y, from.z),  // 左下
                    new Vec3(from.x, from.y, to.z),    // 右下
                    new Vec3(from.x, to.y, to.z),      // 右上
                    new Vec3(from.x, to.y, from.z)     // 左上
                ];
                break;
            case OverlayFace.EAST: // +X
                vertices = [
                    new Vec3(to.x, from.y, to.z),   // 左下
                    new Vec3(to.x, from.y, from.z), // 右下
                    new Vec3(to.x, to.y, from.z),   // 右上
                    new Vec3(to.x, to.y, to.z)      // 左上
                ];
                break;
            default:
                vertices = [];
        }

        // 应用inflate（沿法线方向膨胀，防止Z-fight）
        const normal = this.getFaceNormal(dir);
        return vertices.map(v =>
            new Vec3(
                v.x + normal.x * inflate,
                v.y + normal.y * inflate,
                v.z + normal.z * inflate
            )
        );
    }

    /**
     * 获取面的法线
     */
    private static getFaceNormal(dir: OverlayFace): Vec3 {
        switch (dir) {
            case OverlayFace.NORTH: return new Vec3(0, 0, -1);
            case OverlayFace.SOUTH: return new Vec3(0, 0, 1);
            case OverlayFace.WEST: return new Vec3(-1, 0, 0);
            case OverlayFace.EAST: return new Vec3(1, 0, 0);
            case OverlayFace.UP: return new Vec3(0, 1, 0);
            case OverlayFace.DOWN: return new Vec3(0, -1, 0);
            default: return new Vec3(0, 1, 0);
        }
    }

    /**
     * 获取面的UV坐标
     * 返回4个UV点：左下、右下、右上、左上
     */
    private static getFaceUVs(dir: OverlayFace): Vec2[] {
        // U轴翻转（修复水平镜像问题）
        return [
            new Vec2(1, 0),  // 左下 - U翻转
            new Vec2(0, 0),  // 右下 - U翻转
            new Vec2(0, 1),  // 右上 - U翻转
            new Vec2(1, 1)   // 左上 - U翻转
        ];
    }

    /**
     * 创建Cocos Mesh
     */
    private static createCocosMesh(
        vertices: number[],
        normals: number[],
        uvs: number[],
        colors: number[],
        indices: number[]
    ): Mesh | null {
        try {
            const mesh = utils.MeshUtils.createMesh({
                positions: vertices,
                normals: normals,
                uvs: uvs,
                colors: colors,
                indices: indices,
                primitiveMode: gfx.PrimitiveMode.TRIANGLE_LIST
            });
            return mesh;
        } catch (error) {
            console.error('[BlockOverlayManager] Failed to create mesh:', error);
            return null;
        }
    }

    /**
     * 更新overlay纹理（动态切换）
     *
     * @param overlayNode Overlay节点
     * @param newTexture 新纹理
     */
    static updateOverlayTexture(
        overlayNode: Node,
        newTexture: Texture2D
    ): void {
        const renderer = overlayNode.getComponent(MeshRenderer);
        if (!renderer) {
            console.warn('[BlockOverlayManager] MeshRenderer not found on overlay node');
            return;
        }

        const material = renderer.getMaterial(0);
        if (material) {
            material.setProperty('mainTexture', newTexture);
            console.log('[BlockOverlayManager] Overlay texture updated');
            if (this.DEBUG_LOG) {
                const img = (newTexture as any)?.image;
                console.log('[BlockOverlayManager] New texture info:', {
                    name: (newTexture as any)?._uuid || newTexture?.name,
                    width: newTexture?.width,
                    height: newTexture?.height,
                    hasImage: !!img,
                    imageSize: img ? { width: img.width, height: img.height } : null,
                });
            }
        }
    }

    /**
     * 更新overlay颜色
     */
    static updateOverlayColor(
        overlayNode: Node,
        color: Color
    ): void {
        const renderer = overlayNode.getComponent(MeshRenderer);
        if (!renderer) return;

        const material = renderer.getMaterial(0);
        if (material) {
            const colorVec = [
                color.r / 255,
                color.g / 255,
                color.b / 255,
                color.a / 255
            ];
            material.setProperty('mainColor', colorVec);
        }
    }

    /**
     * 移除overlay层
     *
     * @param blockNode Block节点
     * @param layerIndex 层级索引
     */
    static removeOverlay(blockNode: Node, layerIndex: number): void {
        const overlayNode = blockNode.getChildByName(`Overlay_${layerIndex}`);
        if (overlayNode && overlayNode.isValid) {
            overlayNode.destroy();
            console.log(`[BlockOverlayManager] Removed overlay layer ${layerIndex}`);
        }
    }

    /**
     * 获取overlay节点
     */
    static getOverlay(blockNode: Node, layerIndex: number): Node | null {
        return blockNode.getChildByName(`Overlay_${layerIndex}`);
    }

    /**
     * 检查overlay是否存在
     */
    static hasOverlay(blockNode: Node, layerIndex: number): boolean {
        return this.getOverlay(blockNode, layerIndex) !== null;
    }

    /**
     * 封装Promise版本的resources.load
     *
     * @param path 资源路径
     * @param type 资源类型
     * @returns Promise<资源对象 | null>
     */
    private static loadAsset<T>(
        path: string,
        type: any
    ): Promise<T | null> {
        return new Promise((resolve) => {
            resources.load(path, type, (err, asset) => {
                if (err) {
                    console.error(`[BlockOverlayManager] Failed to load ${path}:`, err);
                    resolve(null);
                } else {
                    resolve(asset as T);
                }
            });
        });
    }
}
