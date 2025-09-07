import { Vec3, Vec2, Vec4, Color, utils } from 'cc';
import { ResolvedModel, ResolvedElement, ResolvedFace } from './ModelParser';

export interface VoxelMeshData {
    vertices: VoxelVertex[];
    indices: number[];
    textureGroups: Map<string, TextureGroup>; // 按纹理分组
    hasOverlay?: boolean; // 是否包含overlay层
}

export interface VoxelVertex {
    position: Vec3;
    normal: Vec3;
    texCoord: Vec4;  // xy: 主纹理UV, zw: overlay纹理UV
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
    blockRotation: { x: number; y: number; z: number };
    aoData?: number[][];
    lightData?: number[][];
}

export class MeshBuilder {
    
    /**
     * 从解析的模型构建网格数据
     * @param model 解析后的模型
     * @param context 构建上下文
     * @returns 网格数据
     */
    static buildMesh(model: ResolvedModel, context: MeshBuildContext): VoxelMeshData {
        const meshData: VoxelMeshData = {
            vertices: [],
            indices: [],
            textureGroups: new Map()
        };

        // 检查是否有overlay系统需求
        const hasOverlayElements = this.hasOverlaySystem(model);
        
        if (hasOverlayElements) {
            // 使用overlay系统处理
            this.buildOverlayMesh(model, context, meshData);
        } else {
            // 构建每个元素的几何体（传统方式）
            for (const element of model.elements) {
                this.buildElementMesh(element, context, meshData);
            }
        }

        // 应用方块级别的旋转
        if (context.blockRotation.y !== 0) {
            this.applyBlockRotation(meshData, context.blockRotation);
        }

        // 注意：不应用方块位置偏移，顶点坐标保持以原点为中心(-0.5到+0.5)
        // 方块在场景中的位置应该通过Node的position属性来控制
        // this.applyBlockTransform(meshData, context.blockPosition);

        return meshData;
    }

    /**
     * 构建单个元素的网格
     * @param element 元素数据
     * @param context 构建上下文
     * @param meshData 目标网格数据
     */
    private static buildElementMesh(
        element: ResolvedElement, 
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

        // 定义立方体的面（逆时针顺序，从外部观看）
        const faces = [
            { name: 'north', normal: new Vec3(0, 0, -1), positions: [
                new Vec3(from.x, from.y, from.z), new Vec3(from.x, to.y, from.z),
                new Vec3(to.x, to.y, from.z), new Vec3(to.x, from.y, from.z)
            ]},
            { name: 'south', normal: new Vec3(0, 0, 1), positions: [
                new Vec3(to.x, from.y, to.z), new Vec3(to.x, to.y, to.z),
                new Vec3(from.x, to.y, to.z), new Vec3(from.x, from.y, to.z)
            ]},
            { name: 'west', normal: new Vec3(-1, 0, 0), positions: [
                new Vec3(from.x, from.y, to.z), new Vec3(from.x, to.y, to.z),
                new Vec3(from.x, to.y, from.z), new Vec3(from.x, from.y, from.z)
            ]},
            { name: 'east', normal: new Vec3(1, 0, 0), positions: [
                new Vec3(to.x, from.y, from.z), new Vec3(to.x, to.y, from.z),
                new Vec3(to.x, to.y, to.z), new Vec3(to.x, from.y, to.z)
            ]},
            { name: 'down', normal: new Vec3(0, -1, 0), positions: [
                new Vec3(from.x, from.y, to.z), new Vec3(from.x, from.y, from.z),
                new Vec3(to.x, from.y, from.z), new Vec3(to.x, from.y, to.z)
            ]},
            { name: 'up', normal: new Vec3(0, 1, 0), positions: [
                new Vec3(from.x, to.y, from.z), new Vec3(from.x, to.y, to.z),
                new Vec3(to.x, to.y, to.z), new Vec3(to.x, to.y, from.z)
            ]}
        ];

        // 处理每个面
        for (const faceInfo of faces) {
            const faceData = element.faces.get(faceInfo.name);
            if (!faceData) continue; // 跳过未定义的面

            // 构建面的几何体
            this.buildFaceGeometry(
                faceInfo.positions,
                faceInfo.normal,
                faceData,
                element.shade,
                context,
                meshData
            );
        }
    }

    /**
     * 构建面的几何体
     * @param positions 面的顶点位置
     * @param normal 面的法线
     * @param faceData 面数据
     * @param shade 是否启用阴影
     * @param context 构建上下文
     * @param meshData 目标网格数据
     */
    private static buildFaceGeometry(
        positions: Vec3[],
        normal: Vec3,
        faceData: ResolvedFace,
        shade: boolean,
        context: MeshBuildContext,
        meshData: VoxelMeshData
    ): void {
        const texture = faceData.texture;
        
        // 确保纹理组存在
        if (!meshData.textureGroups.has(texture)) {
            meshData.textureGroups.set(texture, {
                texture,
                vertices: [],
                indices: [],
                transparent: this.isTransparentTexture(texture)
            });
        }

        const textureGroup = meshData.textureGroups.get(texture)!;
        const baseIndex = textureGroup.vertices.length;

        // 计算UV坐标
        const uvs = this.calculateFaceUVs(faceData);

        // 计算AO和光照值
        const ao = shade ? this.calculateAO(positions, normal, context) : [1, 1, 1, 1];
        const light = this.calculateLight(positions, context);

        // 检测是否是overlay纹理
        const isOverlay = this.isOverlayTexture(texture);
        const hasTint = faceData.tintindex !== undefined && faceData.tintindex >= 0;
        
        // 确定tint颜色
        const tintColor = hasTint ? 
            new Color(127, 255, 76, 255) : // 草地绿色
            Color.WHITE;

        // 创建四个顶点
        for (let i = 0; i < 4; i++) {
            const vertex: VoxelVertex = {
                position: positions[i].clone(),
                normal: normal.clone(),
                texCoord: new Vec4(
                    uvs[i].x, uvs[i].y,  // xy: 主纹理UV
                    isOverlay ? uvs[i].x : 0, // z: overlay U
                    isOverlay ? uvs[i].y : 0  // w: overlay V
                ),
                color: tintColor,
                ao: ao[i],
                light: light[i]
            };
            textureGroup.vertices.push(vertex);
        }
        
        // 标记mesh包含overlay
        if (isOverlay) {
            meshData.hasOverlay = true;
        }

        // 创建两个三角形（四边形）
        // 根据AO值优化三角形拆分，避免光照瑕疵
        const ao0 = ao[0], ao1 = ao[1], ao2 = ao[2], ao3 = ao[3];
        if (ao0 + ao2 > ao1 + ao3) {
            // 使用 0-1-2 和 0-2-3 拆分
            textureGroup.indices.push(
                baseIndex + 0, baseIndex + 1, baseIndex + 2,
                baseIndex + 0, baseIndex + 2, baseIndex + 3
            );
        } else {
            // 使用 0-1-3 和 1-2-3 拆分
            textureGroup.indices.push(
                baseIndex + 0, baseIndex + 1, baseIndex + 3,
                baseIndex + 1, baseIndex + 2, baseIndex + 3
            );
        }
    }

    /**
     * 计算面的UV坐标
     * @param faceData 面数据
     * @returns UV坐标数组
     */
    private static calculateFaceUVs(faceData: ResolvedFace): Vec2[] {
        const [u1, v1, u2, v2] = faceData.uv;
        
        // 基础UV坐标（左下、右下、右上、左上）
        let uvs = [
            new Vec2(u1 / 16, 1 - v2 / 16), // 左下
            new Vec2(u2 / 16, 1 - v2 / 16), // 右下
            new Vec2(u2 / 16, 1 - v1 / 16), // 右上
            new Vec2(u1 / 16, 1 - v1 / 16)  // 左上
        ];

        // 应用面旋转
        if (faceData.rotation !== 0) {
            uvs = this.rotateUVs(uvs, faceData.rotation);
        }

        return uvs;
    }

    /**
     * 旋转UV坐标
     * @param uvs 原始UV数组
     * @param rotation 旋转角度（0, 90, 180, 270）
     * @returns 旋转后的UV数组
     */
    private static rotateUVs(uvs: Vec2[], rotation: number): Vec2[] {
        const steps = (rotation / 90) % 4;
        let result = [...uvs];

        for (let i = 0; i < steps; i++) {
            // 顺时针旋转90度：[0,1,2,3] -> [3,0,1,2]
            result = [result[3], result[0], result[1], result[2]];
        }

        return result;
    }

    /**
     * 计算环境光遮蔽
     * @param positions 顶点位置
     * @param normal 面法线
     * @param context 构建上下文
     * @returns AO值数组
     */
    private static calculateAO(positions: Vec3[], normal: Vec3, context: MeshBuildContext): number[] {
        if (!context.aoData) {
            return [1, 1, 1, 1]; // 无AO数据时返回无遮蔽
        }

        // 简化实现：使用固定AO值
        // 实际应用中应该根据相邻方块计算遮蔽
        return [0.8, 0.9, 1.0, 0.85];
    }

    /**
     * 计算光照值
     * @param positions 顶点位置
     * @param context 构建上下文
     * @returns 光照值数组
     */
    private static calculateLight(positions: Vec3[], context: MeshBuildContext): number[] {
        if (!context.lightData) {
            return [1, 1, 1, 1]; // 无光照数据时返回全亮
        }

        // 简化实现：使用固定光照值
        return [1, 1, 1, 1];
    }

    /**
     * 应用方块级别的旋转
     * @param meshData 网格数据
     * @param rotation 旋转角度
     */
    private static applyBlockRotation(meshData: VoxelMeshData, rotation: { x: number; y: number; z: number }): void {
        // 只处理Y轴旋转（最常见）
        if (rotation.y !== 0) {
            const angle = rotation.y * Math.PI / 180;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            for (const group of meshData.textureGroups.values()) {
                for (const vertex of group.vertices) {
                    const { x, z } = vertex.position;
                    vertex.position.x = x * cos - z * sin;
                    vertex.position.z = x * sin + z * cos;

                    // 也旋转法线
                    const { x: nx, z: nz } = vertex.normal;
                    vertex.normal.x = nx * cos - nz * sin;
                    vertex.normal.z = nx * sin + nz * cos;
                }
            }
        }
    }

    /**
     * 应用方块位置变换
     * @param meshData 网格数据
     * @param position 方块位置
     */
    private static applyBlockTransform(meshData: VoxelMeshData, position: Vec3): void {
        for (const group of meshData.textureGroups.values()) {
            for (const vertex of group.vertices) {
                vertex.position.add(position);
            }
        }
    }

    /**
     * 判断纹理是否透明
     * @param texture 纹理路径
     * @returns 是否透明
     */
    private static isTransparentTexture(texture: string): boolean {
        const transparentTextures = [
            'glass', 'leaves', 'short_grass', 'fern', 'dandelion', 'poppy',
            'water', 'ice', 'portal'
        ];

        return transparentTextures.some(t => texture.includes(t));
    }

    /**
     * 检查纹理是否为overlay类型
     * @param texture 纹理路径
     * @returns 是否为overlay
     */
    private static isOverlayTexture(texture: string): boolean {
        return texture.includes('overlay');
    }

    /**
     * 检查模型是否使用overlay系统
     * @param model 解析后的模型
     * @returns 是否使用overlay系统
     */
    private static hasOverlaySystem(model: ResolvedModel): boolean {
        // 检查是否有多个element且包含overlay纹理
        if (model.elements.length < 2) return false;
        
        for (const element of model.elements) {
            for (const [, face] of element.faces) {
                if (this.isOverlayTexture(face.texture)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 构建overlay系统的网格
     * @param model 解析后的模型
     * @param context 构建上下文
     * @param meshData 目标网格数据
     */
    private static buildOverlayMesh(model: ResolvedModel, context: MeshBuildContext, meshData: VoxelMeshData): void {
        // 分离base和overlay元素
        const baseElements: ResolvedElement[] = [];
        const overlayElements: ResolvedElement[] = [];
        
        for (const element of model.elements) {
            let hasOverlay = false;
            for (const [, face] of element.faces) {
                if (this.isOverlayTexture(face.texture)) {
                    hasOverlay = true;
                    break;
                }
            }
            if (hasOverlay) {
                overlayElements.push(element);
            } else {
                baseElements.push(element);
            }
        }

        // 为每个base element的每个面构建顶点
        for (const baseElement of baseElements) {
            this.buildOverlayElementMesh(baseElement, overlayElements, context, meshData);
        }
    }

    /**
     * 构建支持overlay的元素网格
     * @param baseElement 基础元素
     * @param overlayElements overlay元素列表
     * @param context 构建上下文
     * @param meshData 目标网格数据
     */
    private static buildOverlayElementMesh(
        baseElement: ResolvedElement,
        overlayElements: ResolvedElement[],
        context: MeshBuildContext,
        meshData: VoxelMeshData
    ): void {
        const [fromX, fromY, fromZ] = baseElement.from;
        const [toX, toY, toZ] = baseElement.to;

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

        // 定义立方体的面
        const faces = [
            { name: 'north', normal: new Vec3(0, 0, -1), positions: [
                new Vec3(from.x, from.y, from.z), new Vec3(from.x, to.y, from.z),
                new Vec3(to.x, to.y, from.z), new Vec3(to.x, from.y, from.z)
            ]},
            { name: 'south', normal: new Vec3(0, 0, 1), positions: [
                new Vec3(to.x, from.y, to.z), new Vec3(to.x, to.y, to.z),
                new Vec3(from.x, to.y, to.z), new Vec3(from.x, from.y, to.z)
            ]},
            { name: 'west', normal: new Vec3(-1, 0, 0), positions: [
                new Vec3(from.x, from.y, to.z), new Vec3(from.x, to.y, to.z),
                new Vec3(from.x, to.y, from.z), new Vec3(from.x, from.y, from.z)
            ]},
            { name: 'east', normal: new Vec3(1, 0, 0), positions: [
                new Vec3(to.x, from.y, from.z), new Vec3(to.x, to.y, from.z),
                new Vec3(to.x, to.y, to.z), new Vec3(to.x, from.y, to.z)
            ]},
            { name: 'down', normal: new Vec3(0, -1, 0), positions: [
                new Vec3(from.x, from.y, to.z), new Vec3(from.x, from.y, from.z),
                new Vec3(to.x, from.y, from.z), new Vec3(to.x, from.y, to.z)
            ]},
            { name: 'up', normal: new Vec3(0, 1, 0), positions: [
                new Vec3(from.x, to.y, from.z), new Vec3(from.x, to.y, to.z),
                new Vec3(to.x, to.y, to.z), new Vec3(to.x, to.y, from.z)
            ]}
        ];

        // 处理每个面
        for (const faceInfo of faces) {
            const baseFace = baseElement.faces.get(faceInfo.name);
            if (!baseFace) continue;

            // 查找对应的overlay面
            let overlayFace: ResolvedFace | null = null;
            for (const overlayElement of overlayElements) {
                const face = overlayElement.faces.get(faceInfo.name);
                if (face) {
                    overlayFace = face;
                    break;
                }
            }

            // 构建合并的面几何体
            this.buildOverlayFaceGeometry(
                faceInfo.positions,
                faceInfo.normal,
                baseFace,
                overlayFace,
                baseElement.shade,
                context,
                meshData
            );
        }
    }

    /**
     * 构建支持overlay的面几何体
     * @param positions 面的顶点位置
     * @param normal 面的法线
     * @param baseFace 基础面数据
     * @param overlayFace overlay面数据（可能为null）
     * @param shade 是否启用阴影
     * @param context 构建上下文
     * @param meshData 目标网格数据
     */
    private static buildOverlayFaceGeometry(
        positions: Vec3[],
        normal: Vec3,
        baseFace: ResolvedFace,
        overlayFace: ResolvedFace | null,
        shade: boolean,
        context: MeshBuildContext,
        meshData: VoxelMeshData
    ): void {
        const baseTexture = baseFace.texture;
        
        // 使用base纹理作为key，统一管理
        if (!meshData.textureGroups.has(baseTexture)) {
            meshData.textureGroups.set(baseTexture, {
                texture: baseTexture,
                vertices: [],
                indices: [],
                transparent: this.isTransparentTexture(baseTexture)
            });
        }

        const textureGroup = meshData.textureGroups.get(baseTexture)!;
        const baseIndex = textureGroup.vertices.length;

        // 计算基础UV
        const baseUVs = this.calculateFaceUVs(baseFace);
        // 计算overlay UV（如果存在）
        const overlayUVs = overlayFace ? this.calculateFaceUVs(overlayFace) : [new Vec2(0, 0), new Vec2(0, 0), new Vec2(0, 0), new Vec2(0, 0)];

        // 计算AO和光照值
        const ao = shade ? this.calculateAO(positions, normal, context) : [1, 1, 1, 1];
        const light = this.calculateLight(positions, context);

        // 确定tint颜色（优先使用overlay的tint）
        const hasTint = (overlayFace && overlayFace.tintindex !== undefined && overlayFace.tintindex >= 0) ||
                       (baseFace.tintindex !== undefined && baseFace.tintindex >= 0);
        const tintColor = hasTint ? 
            new Color(127, 255, 76, 255) : // 草地绿色
            Color.WHITE;

        // 创建四个顶点
        for (let i = 0; i < 4; i++) {
            const vertex: VoxelVertex = {
                position: positions[i].clone(),
                normal: normal.clone(),
                texCoord: new Vec4(
                    baseUVs[i].x, baseUVs[i].y,      // xy: 主纹理UV
                    overlayUVs[i].x, overlayUVs[i].y // zw: overlay纹理UV
                ),
                color: tintColor,
                ao: ao[i],
                light: light[i]
            };
            textureGroup.vertices.push(vertex);
        }
        
        // 标记mesh包含overlay
        if (overlayFace) {
            meshData.hasOverlay = true;
        }

        // 创建两个三角形（四边形）
        const ao0 = ao[0], ao1 = ao[1], ao2 = ao[2], ao3 = ao[3];
        if (ao0 + ao2 > ao1 + ao3) {
            textureGroup.indices.push(
                baseIndex + 0, baseIndex + 1, baseIndex + 2,
                baseIndex + 0, baseIndex + 2, baseIndex + 3
            );
        } else {
            textureGroup.indices.push(
                baseIndex + 0, baseIndex + 1, baseIndex + 3,
                baseIndex + 1, baseIndex + 2, baseIndex + 3
            );
        }
    }

    /**
     * 合并网格数据（用于批处理）
     * @param meshDataArray 网格数据数组
     * @returns 合并后的网格数据
     */
    static mergeMeshData(meshDataArray: VoxelMeshData[]): VoxelMeshData {
        const merged: VoxelMeshData = {
            vertices: [],
            indices: [],
            textureGroups: new Map()
        };

        for (const meshData of meshDataArray) {
            for (const [texture, group] of meshData.textureGroups) {
                if (!merged.textureGroups.has(texture)) {
                    merged.textureGroups.set(texture, {
                        texture,
                        vertices: [],
                        indices: [],
                        transparent: group.transparent
                    });
                }

                const mergedGroup = merged.textureGroups.get(texture)!;
                const baseIndex = mergedGroup.vertices.length;

                // 合并顶点
                mergedGroup.vertices.push(...group.vertices);

                // 合并索引（调整索引偏移）
                for (const index of group.indices) {
                    mergedGroup.indices.push(index + baseIndex);
                }
            }
        }

        return merged;
    }

    /**
     * 创建Cocos Creator网格对象
     * @param meshData 网格数据
     * @param texture 纹理名称（用于单纹理网格）
     * @returns Mesh对象
     */
    static createCocosMesh(meshData: VoxelMeshData, texture?: string): any {
        let targetGroup: TextureGroup;

        if (texture && meshData.textureGroups.has(texture)) {
            targetGroup = meshData.textureGroups.get(texture)!;
        } else {
            // 使用第一个纹理组
            targetGroup = meshData.textureGroups.values().next().value;
            if (!targetGroup) {
                console.error('[MeshBuilder] 无可用的纹理组');
                return null;
            }
        }

        const vertices = targetGroup.vertices;
        const indices = targetGroup.indices;

        if (vertices.length === 0) {
            return null;
        }

        // 构建Cocos Creator几何数据
        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const uvs2: number[] = [];

        for (const vertex of vertices) {
            positions.push(vertex.position.x, vertex.position.y, vertex.position.z);
            normals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
            uvs.push(vertex.texCoord.x, vertex.texCoord.y);   // 主UV
            uvs2.push(vertex.texCoord.z, vertex.texCoord.w);  // overlay UV
        }

        const geometryData = {
            positions,
            normals,
            uvs,
            uvs2,
            indices: new Uint16Array(indices)
        };

        return utils.MeshUtils.createMesh(geometryData);
    }
}