import { Vec3, Vec2, Vec4, Color, Mesh, gfx, utils, geometry } from 'cc';
import { ParsedBlockData, ElementDef, ElementFace, TextureInfo } from '../resource_pack';
import { AOCalculator } from '../lighting/AOCalculator';
import { VoxelLightingSystem } from '../lighting/VoxelLightingSystem';
import { BlockRegistry } from '../core/VoxelBlock';

export interface VoxelMeshData {
    vertices: VoxelVertex[];
    indices: number[];
    textureGroups: Map<string, TextureGroup>; // 按纹理分组
    
    // Overlay 双子网格支持
    hasOverlay?: boolean; // 标记是否包含 overlay 子网格
    overlayMeshes?: { base: any; overlay: any }; // 分离的基础层与 overlay 层 Mesh
    overlayInfo?: { // overlay 材质所需的纹理信息
        baseSideTexture: string; // 侧面基础纹理（如 grass_block_side）
        overlaySideTexture: string; // 侧面 overlay 纹理（如 grass_block_side_overlay）
    };
}

export interface VoxelVertex {
    position: Vec3;
    normal: Vec3;
    texCoord: Vec2;  // UV坐标
    color: Color;    // 用于tintindex颜色调制
    ao: number;      // 环境光遮蔽
    light: number;   // 光照等级
}

export interface TextureGroup {
    texture: string;
    vertices: VoxelVertex[];
    indices: number[];
    transparent: boolean;
}

export interface MeshBuildContext {
    blockPosition: Vec3;
    blockRotation?: { x: number; y: number; z: number };
    aoData?: number[][];
    lightData?: number[][];
    // 方块查询函数和光照系统
    getBlockAt?: (x: number, y: number, z: number) => string;
    chunkLights?: any; // VoxelChunk 光照数据
    chunkBaseX?: number;
    chunkBaseZ?: number;
    // 方块ID用于获取光照等级
    blockId?: string;
}

export class MeshBuilder {
    
    /**
     * 从解析的方块数据构建网格
     * @param blockData 解析后的方块数据
     * @param context 构建上下文
     * @returns 网格数据
     */
    static buildMesh(blockData: ParsedBlockData, context: MeshBuildContext): VoxelMeshData {
        console.log(`[MeshBuilder] buildMesh: 开始构建网格, elements数量=${blockData.elements.length}`);
        
        const meshData: VoxelMeshData = {
            vertices: [],
            indices: [],
            textureGroups: new Map()
        };

        // 检查是否有 overlay 纹理
        const hasOverlay = blockData.textures.some(t => 
            t.name.includes('overlay') || t.id.includes('overlay')
        );
        
        if (hasOverlay) {
            meshData.hasOverlay = true;
            // 找出基础纹理和 overlay 纹理
            const baseSide = blockData.textures.find(t => t.key === 'side' && !t.name.includes('overlay'));
            const overlaySide = blockData.textures.find(t => t.name.includes('side_overlay'));
            
            if (baseSide && overlaySide) {
                meshData.overlayInfo = {
                    baseSideTexture: baseSide.rel,
                    overlaySideTexture: overlaySide.rel
                };
            }
        }

        // 构建每个元素的几何体
        for (const element of blockData.elements) {
            this.buildElementMesh(element, blockData, context, meshData);
        }

        // 应用方块级别的旋转
        if (context.blockRotation && context.blockRotation.y !== 0) {
            this.applyBlockRotation(meshData, context.blockRotation);
        }

        console.log(`[MeshBuilder] buildMesh: 网格构建完成, textureGroups数量=${meshData.textureGroups.size}`);
        for (const [texture, group] of meshData.textureGroups) {
            console.log(`[MeshBuilder]   - 纹理组: ${texture}, 顶点数=${group.vertices.length}, 索引数=${group.indices.length}`);
        }

        return meshData;
    }

    /**
     * 构建 overlay 方块网格（两个子网格：基础层 + Overlay 层）
     */
    static buildOverlayBlockMeshes(context: MeshBuildContext): { baseMesh: any; overlayMesh: any } {
        console.log('[MeshBuilder] buildOverlayBlockMesh: 开始构建双层网格');
        
        // 共享的顶点数据
        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const colors: number[] = [];
        
        // 分离的索引数据
        const baseIndices: number[] = [];    // 基础层索引（不透明面）
        const overlayIndices: number[] = [];  // overlay层索引（侧面）
        
        // 构建标准立方体的六个面
        const faces = [
            { dir: 'north', normal: [0, 0, -1], positions: [[0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, -0.5]] },
            { dir: 'south', normal: [0, 0, 1], positions: [[-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5]] },
            { dir: 'west', normal: [-1, 0, 0], positions: [[-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [-0.5, -0.5, 0.5]] },
            { dir: 'east', normal: [1, 0, 0], positions: [[0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [0.5, -0.5, -0.5]] },
            { dir: 'up', normal: [0, 1, 0], positions: [[-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
            { dir: 'down', normal: [0, -1, 0], positions: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [-0.5, -0.5, -0.5]] }
        ];
        
        let vertexIndex = 0;
        
        for (const face of faces) {
            // 添加顶点
            for (const pos of face.positions) {
                positions.push(...pos);
                normals.push(...face.normal);
                uvs.push(0, 0); // UV 由材质处理
                colors.push(1, 1, 1, 1); // 白色
            }
            
            // 添加索引
            const indices = [
                vertexIndex, vertexIndex + 1, vertexIndex + 2,
                vertexIndex, vertexIndex + 2, vertexIndex + 3
            ];
            
            // 根据面的方向分配到不同的索引组
            if (face.dir === 'up' || face.dir === 'down') {
                // 顶部和底部使用基础层
                baseIndices.push(...indices);
            } else {
                // 侧面同时添加到两个层
                baseIndices.push(...indices);
                overlayIndices.push(...indices);
            }
            
            vertexIndex += 4;
        }
        
        // 创建基础层网格
        const baseMesh = utils.MeshUtils.createMesh({
            positions: positions,
            normals: normals,
            uvs: uvs,
            colors: colors,
            indices: baseIndices,
            primitiveMode: gfx.PrimitiveMode.TRIANGLE_LIST
        });
        
        // 创建 overlay 层网格
        const overlayMesh = utils.MeshUtils.createMesh({
            positions: positions,
            normals: normals,
            uvs: uvs,
            colors: colors,
            indices: overlayIndices,
            primitiveMode: gfx.PrimitiveMode.TRIANGLE_LIST
        });
        
        console.log('[MeshBuilder] buildOverlayBlockMesh: 双层网格构建完成');
        return { baseMesh, overlayMesh };
    }

    /**
     * 构建单个元素的网格
     */
    private static buildElementMesh(
        element: ElementDef,
        blockData: ParsedBlockData,
        context: MeshBuildContext,
        meshData: VoxelMeshData
    ): void {
        const [fromX, fromY, fromZ] = element.from;
        const [toX, toY, toZ] = element.to;

        // 将 0-16 坐标系转换为 -0.5 到 0.5 的方块单位
        const from = new Vec3(
            fromX / 16 - 0.5,
            fromY / 16 - 0.5,
            fromZ / 16 - 0.5
        );
        const to = new Vec3(
            toX / 16 - 0.5,
            toY / 16 - 0.5,
            toZ / 16 - 0.5
        );

        // 应用元素旋转（如果有）
        // if (element.rotation) {
        //     this.applyElementRotation(from, to, element.rotation);
        // }

        // 构建每个面
        for (const face of element.faces) {
            this.buildFaceMesh(face, from, to, blockData, context, meshData, element.shade);
        }
    }

    /**
     * 构建单个面的网格
     */
    private static buildFaceMesh(
        face: ElementFace,
        from: Vec3,
        to: Vec3,
        blockData: ParsedBlockData,
        context: MeshBuildContext,
        meshData: VoxelMeshData,
        shade: boolean = true
    ): void {
        // 通过 textureKey 查找纹理信息
        const textureInfo = blockData.textures.find(t => t.key === face.textureKey);
        if (!textureInfo) {
            console.warn(`[MeshBuilder] 纹理未找到: key=${face.textureKey}`);
            return;
        }

        const texture = textureInfo.rel;
        
        // 获取或创建纹理组
        let textureGroup = meshData.textureGroups.get(texture);
        if (!textureGroup) {
            textureGroup = {
                texture,
                vertices: [],
                indices: [],
                transparent: false // 可以根据纹理类型判断
            };
            meshData.textureGroups.set(texture, textureGroup);
        }

        // 获取面的顶点位置
        const vertices = this.getFaceVertices(face.dir, from, to);
        const normal = this.getFaceNormal(face.dir);
        
        // 计算UV坐标
        const uvCoords = this.calculateUV(face.uv || [0, 0, 16, 16], face.rotation);
        
        // 获取tint颜色
        const tintColor = this.getTintColor(face.tintindex);
        
        // 计算AO和光照
        const aoValues = this.calculateFaceAO(face.dir, context);
        const lightLevel = this.calculateFaceLight(face.dir, context);
        
        // 添加顶点
        const baseIndex = textureGroup.vertices.length;
        for (let i = 0; i < 4; i++) {
            textureGroup.vertices.push({
                position: vertices[i],
                normal,
                texCoord: uvCoords[i],
                color: tintColor,
                ao: aoValues[i],
                light: lightLevel
            });
        }
        
        // 添加索引（两个三角形）
        textureGroup.indices.push(
            baseIndex, baseIndex + 1, baseIndex + 2,
            baseIndex, baseIndex + 2, baseIndex + 3
        );
    }

    /**
     * 获取面的顶点位置
     */
    private static getFaceVertices(dir: string, from: Vec3, to: Vec3): Vec3[] {
        
        //ccw
        // 和minecraft的uv匹配的顶点顺序 fix by zeros
        // •	0 → 左下
        // •	1 → 右下
        // •	2 → 右上
        // •	3 → 左上

        switch (dir) {
            case 'north': // -Z
                return [
                    new Vec3(to.x, from.y, from.z),
                    new Vec3(from.x, from.y, from.z), 
                    new Vec3(from.x, to.y, from.z), 
                    new Vec3(to.x, to.y, from.z),
                ];
            case 'south': // +Z
                return [
                    new Vec3(from.x, from.y, to.z), 
                    new Vec3(to.x, from.y, to.z), 
                    new Vec3(to.x, to.y, to.z), 
                    new Vec3(from.x, to.y, to.z), 
                ];
            case 'west': // -X
                return [
                    new Vec3(from.x, from.y, from.z), 
                    new Vec3(from.x, from.y, to.z), 
                    new Vec3(from.x, to.y, to.z), 
                    new Vec3(from.x, to.y, from.z), 
                ];
            case 'east': // +X
                return [
                    new Vec3(to.x, from.y, to.z), 
                    new Vec3(to.x, from.y, from.z), 
                    new Vec3(to.x, to.y, from.z), 
                    new Vec3(to.x, to.y, to.z), 
                ];
            case 'up': // +Y
                return [
                    new Vec3(to.x, to.y, from.z), 
                    new Vec3(from.x, to.y, from.z), 
                    new Vec3(from.x, to.y, to.z), 
                    new Vec3(to.x, to.y, to.z), 
                ];
            case 'down': // -Y
                return [
                    new Vec3(from.x, from.y, to.z),
                    new Vec3(from.x, from.y, from.z),
                    new Vec3(to.x, from.y, from.z),
                    new Vec3(to.x, from.y, to.z), 
                ];
        }
    }

    /**
     * 获取面的法线
     */
    private static getFaceNormal(dir: string): Vec3 {
        switch (dir) {
            case 'north': return new Vec3(0, 0, -1);
            case 'south': return new Vec3(0, 0, 1);
            case 'west': return new Vec3(-1, 0, 0);
            case 'east': return new Vec3(1, 0, 0);
            case 'up': return new Vec3(0, 1, 0);
            case 'down': return new Vec3(0, -1, 0);
            default: return new Vec3(0, 1, 0);
        }
    }

    /**
     * 计算UV坐标
     */
    private static calculateUV(uvRect: number[], rotation?: number): Vec2[] {
        // 将 Minecraft 的 0-16 UV 转换为 0-1
        const u1 = uvRect[0] / 16;
        const v1 = uvRect[1] / 16;
        const u2 = uvRect[2] / 16;
        const v2 = uvRect[3] / 16;
        
        let uvs = [
            // new Vec2(u1, v2),
            // new Vec2(u1, v1),
            // new Vec2(u2, v1),
            // new Vec2(u2, v2)

            new Vec2(u1, v2),
            new Vec2(u2, v2),
            new Vec2(u2, v1),
            new Vec2(u1, v1),
        ];
        
        // 应用旋转
        if (rotation) {
            const rotSteps = Math.floor(rotation / 90);
            for (let i = 0; i < rotSteps; i++) {
                uvs = [uvs[3], uvs[0], uvs[1], uvs[2]];
            }
        }
        
        return uvs;
    }

    /**
     * 获取tint颜色
     */
    private static getTintColor(tintindex?: number): Color {
        if (tintindex === 0) {
            // 草方块绿色
            return new Color(128, 255, 128, 255);
        }
        return Color.WHITE.clone();
    }

    /**
     * 计算面的AO值
     */
    private static calculateFaceAO(dir: string, context: MeshBuildContext): number[] {
        if (!context.getBlockAt) {
            return [1, 1, 1, 1];
        }
        
        // 简化的AO计算
        const baseAO = 0.8 + Math.random() * 0.2;
        return [baseAO, baseAO, baseAO, baseAO];
    }

    /**
     * 计算面的光照
     */
    private static calculateFaceLight(dir: string, context: MeshBuildContext): number {
        // 简单的方向光照
        switch (dir) {
            case 'up': return 1.0;
            case 'down': return 0.5;
            case 'north':
            case 'south': return 0.8;
            case 'west':
            case 'east': return 0.6;
            default: return 0.7;
        }
    }

    /**
     * 应用元素旋转
     */
    private static applyElementRotation(from: Vec3, to: Vec3, rotation: any): void {
        if (!rotation) return;
        
        const origin = new Vec3(
            (rotation.origin[0] - 8) / 16,
            (rotation.origin[1] - 8) / 16,
            (rotation.origin[2] - 8) / 16
        );
        
        const angle = rotation.angle * Math.PI / 180;
        const axis = rotation.axis;
        
        // 简化的旋转实现
        // TODO: 实现完整的旋转逻辑
    }

    /**
     * 应用方块旋转
     */
    private static applyBlockRotation(meshData: VoxelMeshData, rotation: { x: number; y: number; z: number }): void {
        if (rotation.y === 0) return;
        
        const angle = rotation.y * Math.PI / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        // 旋转所有顶点
        for (const group of meshData.textureGroups.values()) {
            for (const vertex of group.vertices) {
                const x = vertex.position.x;
                const z = vertex.position.z;
                vertex.position.x = x * cos - z * sin;
                vertex.position.z = x * sin + z * cos;
                
                // 也旋转法线
                const nx = vertex.normal.x;
                const nz = vertex.normal.z;
                vertex.normal.x = nx * cos - nz * sin;
                vertex.normal.z = nx * sin + nz * cos;
            }
        }
    }

    /**
     * 创建Cocos的Mesh对象
     */
    static createCCMesh(meshData: VoxelMeshData): Mesh {
        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];
        
        let indexOffset = 0;
        
        for (const group of meshData.textureGroups.values()) {
            for (const vertex of group.vertices) {
                positions.push(vertex.position.x, vertex.position.y, vertex.position.z);
                normals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
                uvs.push(vertex.texCoord.x, vertex.texCoord.y);
                colors.push(
                    vertex.color.r / 255,
                    vertex.color.g / 255,
                    vertex.color.b / 255,
                    vertex.color.a / 255
                );
            }
            
            for (const index of group.indices) {
                indices.push(index + indexOffset);
            }
            
            indexOffset += group.vertices.length;
        }
        
        return utils.MeshUtils.createMesh({
            positions,
            normals,
            uvs,
            colors,
            indices,
            primitiveMode: gfx.PrimitiveMode.TRIANGLE_LIST
        });
    }
    
    /**
     * 创建 Cocos Creator Mesh 对象
     * @param meshData 网格数据
     * @param texturePath 纹理路径（用于从 textureGroups 中提取对应的数据）
     * @returns Mesh 对象
     */
    static createCocosMesh(meshData: VoxelMeshData, texturePath: string): Mesh | null {
        const textureGroup = meshData.textureGroups.get(texturePath);
        if (!textureGroup || textureGroup.vertices.length === 0) {
            console.warn(`[MeshBuilder] 纹理组为空或未找到: ${texturePath}`);
            return null;
        }
        
        // 提取顶点数据
        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const colors: number[] = [];
        
        for (const vertex of textureGroup.vertices) {
            // 位置
            positions.push(vertex.position.x, vertex.position.y, vertex.position.z);
            // 法线
            normals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
            // UV
            uvs.push(vertex.texCoord.x, vertex.texCoord.y);
            // 颜色（AO 作为灰度值）
            const ao = vertex.ao || 1.0;
            colors.push(ao, ao, ao, 1.0);
        }
        
        // 创建 Mesh
        return utils.MeshUtils.createMesh({
            positions,
            normals,
            uvs,
            colors,
            indices: textureGroup.indices,
            primitiveMode: gfx.PrimitiveMode.TRIANGLE_LIST
        });
    }
}