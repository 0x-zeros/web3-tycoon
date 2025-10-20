/**
 * CompositeBlockRenderer - 简化的 Block 渲染器
 *
 * 为 CompositeVoxelActor 提供 block 渲染能力
 * 简化版：只支持 cube，不需要复杂的 model 解析
 *
 * @author Web3 Tycoon Team
 */

import { Node, Mesh, MeshRenderer, Material, Texture2D, resources, gfx, utils, EffectAsset } from 'cc';
import { getWeb3BlockByBlockId } from '../Web3BlockTypes';

/**
 * 简化的 Block 渲染器
 */
export class CompositeBlockRenderer {
    private static _cachedEffect: EffectAsset | null = null;
    private static _cachedTextures: Map<string, Texture2D> = new Map();

    /**
     * 渲染 block 到节点
     *
     * @param node 目标节点
     * @param blockId Block ID（如 "web3:hospital"）
     * @returns 是否成功
     */
    public static async renderBlock(node: Node, blockId: string): Promise<boolean> {
        try {
            // 1. 获取 block 信息
            const blockInfo = getWeb3BlockByBlockId(blockId);
            if (!blockInfo) {
                console.warn(`[CompositeBlockRenderer] Block not found: ${blockId}`);
                return false;
            }

            // 2. 创建 cube mesh（1x1x1）
            const mesh = this.createCubeMesh();

            // 3. 添加 MeshRenderer
            const renderer = node.addComponent(MeshRenderer);
            renderer.mesh = mesh;

            // 4. 加载并设置材质
            const material = await this.createBlockMaterial(blockId);
            if (material) {
                renderer.material = material;
            }

            return true;
        } catch (error) {
            console.error(`[CompositeBlockRenderer] Failed to render block ${blockId}:`, error);
            return false;
        }
    }

    /**
     * 创建简单的 cube mesh（1x1x1，中心在 0.5,0.5,0.5）
     */
    private static createCubeMesh(): Mesh {
        // 创建一个简单的 cube（使用 Cocos 内置的 primitive）
        const mesh = utils.createMesh({
            primitiveMode: gfx.PrimitiveMode.TRIANGLE_LIST,
            positions: this.getCubePositions(),
            normals: this.getCubeNormals(),
            uvs: this.getCubeUVs(),
            indices: this.getCubeIndices()
        });

        return mesh;
    }

    /**
     * 获取 cube 顶点位置（24个顶点，每面4个）
     */
    private static getCubePositions(): number[] {
        // Cube 尺寸 1x1x1，中心在 (0.5, 0.5, 0.5)
        return [
            // Front face (Z+)
            0, 0, 1,  1, 0, 1,  1, 1, 1,  0, 1, 1,
            // Back face (Z-)
            1, 0, 0,  0, 0, 0,  0, 1, 0,  1, 1, 0,
            // Top face (Y+)
            0, 1, 1,  1, 1, 1,  1, 1, 0,  0, 1, 0,
            // Bottom face (Y-)
            0, 0, 0,  1, 0, 0,  1, 0, 1,  0, 0, 1,
            // Right face (X+)
            1, 0, 1,  1, 0, 0,  1, 1, 0,  1, 1, 1,
            // Left face (X-)
            0, 0, 0,  0, 0, 1,  0, 1, 1,  0, 1, 0
        ];
    }

    /**
     * 获取 cube 法线（24个法线，每面4个相同）
     */
    private static getCubeNormals(): number[] {
        return [
            // Front
            0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
            // Back
            0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1,
            // Top
            0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
            // Bottom
            0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0,
            // Right
            1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
            // Left
            -1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0
        ];
    }

    /**
     * 获取 cube UV 坐标（使用相同贴图覆盖所有面）
     */
    private static getCubeUVs(): number[] {
        // 每个面使用完整贴图 (0,0) -> (1,1)
        const faceUV = [
            0, 0,  1, 0,  1, 1,  0, 1
        ];

        // 6个面，每面4个UV
        return [
            ...faceUV,  // Front
            ...faceUV,  // Back
            ...faceUV,  // Top
            ...faceUV,  // Bottom
            ...faceUV,  // Right
            ...faceUV   // Left
        ];
    }

    /**
     * 获取 cube 索引（36个索引，6个面 × 6个索引）
     */
    private static getCubeIndices(): number[] {
        const indices: number[] = [];

        // 6个面，每面2个三角形
        for (let i = 0; i < 6; i++) {
            const offset = i * 4;
            // Triangle 1
            indices.push(offset + 0, offset + 1, offset + 2);
            // Triangle 2
            indices.push(offset + 0, offset + 2, offset + 3);
        }

        return indices;
    }

    /**
     * 创建 block 材质
     *
     * @param blockId Block ID
     * @returns Material
     */
    private static async createBlockMaterial(blockId: string): Promise<Material | null> {
        try {
            // 1. 加载 shader effect（带缓存）
            const effect = await this.getVoxelEffect();
            if (!effect) {
                console.error('[CompositeBlockRenderer] Failed to load voxel shader');
                return null;
            }

            // 2. 加载 block 纹理（带缓存）
            const texture = await this.loadBlockTexture(blockId);
            if (!texture) {
                console.error(`[CompositeBlockRenderer] Failed to load texture for ${blockId}`);
                return null;
            }

            // 3. 创建材质
            const material = new Material();
            material.initialize({
                effectAsset: effect,
                technique: 0  // 0=opaque（不透明）
            });

            // 4. 设置纹理
            material.setProperty('mainTexture', texture);

            return material;
        } catch (error) {
            console.error(`[CompositeBlockRenderer] Failed to create material for ${blockId}:`, error);
            return null;
        }
    }

    /**
     * 加载 voxel shader effect（带缓存）
     */
    private static async getVoxelEffect(): Promise<EffectAsset | null> {
        if (this._cachedEffect) {
            return this._cachedEffect;
        }

        return new Promise((resolve) => {
            resources.load('voxel/shaders/voxel-block', EffectAsset, (err, asset) => {
                if (err) {
                    console.error('[CompositeBlockRenderer] Failed to load voxel shader:', err);
                    resolve(null);
                    return;
                }

                this._cachedEffect = asset;
                resolve(asset);
            });
        });
    }

    /**
     * 加载 block 纹理（带缓存）
     *
     * @param blockId Block ID（如 "web3:hospital"）
     * @returns Texture2D
     */
    private static async loadBlockTexture(blockId: string): Promise<Texture2D | null> {
        // 检查缓存
        if (this._cachedTextures.has(blockId)) {
            return this._cachedTextures.get(blockId)!;
        }

        return new Promise((resolve) => {
            // 从 block ID 提取纹理路径
            // "web3:hospital" -> "web3/blocks/hospital/texture"
            const parts = blockId.split(':');
            const namespace = parts[0] || 'web3';
            const name = parts[1] || 'empty_land';
            const texturePath = `${namespace}/blocks/${name}/texture`;

            resources.load(texturePath, Texture2D, (err, texture) => {
                if (err) {
                    console.error(`[CompositeBlockRenderer] Failed to load texture ${texturePath}:`, err);
                    resolve(null);
                    return;
                }

                // 缓存纹理
                this._cachedTextures.set(blockId, texture);
                resolve(texture);
            });
        });
    }

    /**
     * 清除缓存
     */
    public static clearCache(): void {
        this._cachedTextures.clear();
        this._cachedEffect = null;
        console.log('[CompositeBlockRenderer] Cache cleared');
    }
}
