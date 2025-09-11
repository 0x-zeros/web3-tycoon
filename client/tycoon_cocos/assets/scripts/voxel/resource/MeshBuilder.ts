import { Vec3, Vec2, Vec4, Color, Mesh, gfx, utils, geometry } from 'cc';
import { ResolvedModel, ResolvedElement, ResolvedFace } from './ModelParser';
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
    blockRotation: { x: number; y: number; z: number };
    aoData?: number[][];
    lightData?: number[][];
    // 新增：方块查询函数和光照系统
    getBlockAt?: (x: number, y: number, z: number) => string;
    chunkLights?: any; // VoxelChunk 光照数据
    chunkBaseX?: number;
    chunkBaseZ?: number;
    // 新增：方块ID用于获取光照等级
    blockId?: string;
}

export class MeshBuilder {
    
    /**
     * 从解析的模型构建网格数据
     * @param model 解析后的模型
     * @param context 构建上下文
     * @returns 网格数据
     */
    static buildMesh(model: ResolvedModel, context: MeshBuildContext): VoxelMeshData {
        console.log(`[MeshBuilder] buildMesh: 开始构建网格, elements数量=${model.elements.length}`);
        
        const meshData: VoxelMeshData = {
            vertices: [],
            indices: [],
            textureGroups: new Map()
        };

        // 构建每个元素的几何体
        for (const element of model.elements) {
            this.buildElementMesh(element, context, meshData);
        }

        // 应用方块级别的旋转
        // if (context.blockRotation.y !== 0) {
        //     this.applyBlockRotation(meshData, context.blockRotation);
        // }

        // 注意：不应用方块位置偏移，顶点坐标保持以原点为中心(-0.5到+0.5)
        // 方块在场景中的位置应该通过Node的position属性来控制
        // this.applyBlockTransform(meshData, context.blockPosition);

        console.log(`[MeshBuilder] buildMesh: 网格构建完成, textureGroups数量=${meshData.textureGroups.size}`);
        for (const [texture, group] of meshData.textureGroups) {
            console.log(`[MeshBuilder]   - 纹理组: ${texture}, 顶点数=${group.vertices.length}, 索引数=${group.indices.length}`);
        }

        return meshData;
    }

    /**
     * 构建 overlay 方块网格（两个子网格：基础层 + Overlay 层）
     * 注意：该网格仅提供几何与两套索引，实际贴图由材质决定
     */
    static buildOverlayBlockMeshes(context: MeshBuildContext): { baseMesh: any; overlayMesh: any } {
        console.log('[MeshBuilder] buildOverlayBlockMesh: 开始构建双层网格');
        
        // 共享的顶点数据
        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const colors: number[] = []; // 顶点色可用于 AO，overlay 可保持 1

        const indicesBase: number[] = [];
        const indicesOverlay: number[] = [];

        // 假设我们有一个函数 addFace(...) 能往上追加一个面（两个三角形）
        // 面类型：'up','down','north','south','west','east'
        const addFace = (type: string, toOverlay: boolean) => {
            // 计算该面的 4 顶点 pos/normal/uv，push 到数组
            const baseIndex = positions.length / 3;
            
            // 定义立方体面的顶点位置和法线
            let facePositions: Vec3[];
            let faceNormal: Vec3;
            let texture: string;
            
            // 使用与 buildElementMesh 中 cubeFaces 一致的 CCW 顶点顺序
            const from = new Vec3(-0.5, -0.5, -0.5);
            const to   = new Vec3( 0.5,  0.5,  0.5);

            switch (type) {
                case 'up':
                    facePositions = [
                        new Vec3(from.x, to.y, from.z), new Vec3(from.x, to.y, to.z), new Vec3(to.x, to.y, to.z), new Vec3(to.x, to.y, from.z)
                    ];
                    faceNormal = new Vec3(0, 1, 0);
                    texture = 'grass_block_top';
                    break;
                case 'down':
                    facePositions = [
                        new Vec3(from.x, from.y, from.z), new Vec3(to.x, from.y, from.z), new Vec3(to.x, from.y, to.z), new Vec3(from.x, from.y, to.z)
                    ];
                    faceNormal = new Vec3(0, -1, 0);
                    texture = 'dirt';
                    break;
                case 'north':
                    facePositions = [
                        new Vec3(from.x, from.y, from.z), new Vec3(from.x, to.y, from.z), new Vec3(to.x, to.y, from.z), new Vec3(to.x, from.y, from.z)
                    ];
                    faceNormal = new Vec3(0, 0, -1);
                    texture = toOverlay ? 'grass_block_side_overlay' : 'grass_block_side';
                    break;
                case 'south':
                    facePositions = [
                        new Vec3(to.x, from.y, to.z), new Vec3(to.x, to.y, to.z), new Vec3(from.x, to.y, to.z), new Vec3(from.x, from.y, to.z)
                    ];
                    faceNormal = new Vec3(0, 0, 1);
                    texture = toOverlay ? 'grass_block_side_overlay' : 'grass_block_side';
                    break;
                case 'west':
                    facePositions = [
                        new Vec3(from.x, from.y, to.z), new Vec3(from.x, to.y, to.z), new Vec3(from.x, to.y, from.z), new Vec3(from.x, from.y, from.z)
                    ];
                    faceNormal = new Vec3(-1, 0, 0);
                    texture = toOverlay ? 'grass_block_side_overlay' : 'grass_block_side';
                    break;
                case 'east':
                    facePositions = [
                        new Vec3(to.x, from.y, from.z), new Vec3(to.x, to.y, from.z), new Vec3(to.x, to.y, to.z), new Vec3(to.x, from.y, to.z)
                    ];
                    faceNormal = new Vec3(1, 0, 0);
                    texture = toOverlay ? 'grass_block_side_overlay' : 'grass_block_side';
                    break;
                default:
                    return; // 未知面类型
            }
            
            // 计算AO和光照（简化版本）
            const ao = [1, 1, 1, 1]; // 简化为无AO
            const light = [1, 1, 1, 1]; // 简化为全亮
            
            // 添加4个顶点（UV 与 CCW 位置一致：0:左下, 1:右下, 2:右上, 3:左上）
            const uvList = [
                [0, 0], [1, 0], [1, 1], [0, 1]
            ];
            for (let i = 0; i < 4; i++) {
                positions.push(facePositions[i].x, facePositions[i].y, facePositions[i].z);
                normals.push(faceNormal.x, faceNormal.y, faceNormal.z);
                uvs.push(uvList[i][0], uvList[i][1]);
                colors.push(ao[i], light[i], 0.0, 1.0);
            }
            
            // 生成两个三角形索引，保持 CCW：[0,1,2], [0,2,3]
            const faceIdx = [0, 1, 2, 0, 2, 3].map(i => i + baseIndex);
            if (toOverlay) {
                indicesOverlay.push(...faceIdx);
            } else {
                indicesBase.push(...faceIdx);
            }
        };

        // 六个面：基础层
        addFace('up', false);
        addFace('down', false);
        addFace('north', false);
        addFace('south', false);
        addFace('west', false);
        addFace('east', false);

        // overlay：仅四侧
        addFace('north', true);
        addFace('south', true);
        addFace('west', true);
        addFace('east', true);

        // 分别创建基础层与 Overlay 层 Mesh
        const baseMesh = utils.MeshUtils.createMesh({
            positions,
            normals,
            uvs,
            colors,
            indices: indicesBase
        } as any);

        const overlayMesh = utils.MeshUtils.createMesh({
            positions,
            normals,
            uvs,
            colors,
            indices: indicesOverlay
        } as any);

        console.log(`[MeshBuilder] buildOverlayBlockMesh: 创建完成，基础层索引数=${indicesBase.length}，overlay层索引数=${indicesOverlay.length}`);
        
        return { baseMesh, overlayMesh };
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

        // 通过判断 element 在 x 或 z 轴上是否为一个平面来确定是否为 cross 类型
        const isCrossElement = (element.to[0] - element.from[0] < 0.1) || (element.to[2] - element.from[2] < 0.1);

        // //ccw
        // const cubeFaces = [
        //     // north (-Z)
        //     { name: 'north', normal: new Vec3(0, 0, -1), positions: [
        //         new Vec3(from.x, from.y, from.z), new Vec3(from.x, to.y, from.z), new Vec3(to.x, to.y, from.z), new Vec3(to.x, from.y, from.z)
        //     ]},
        //     // south (+Z)
        //     { name: 'south', normal: new Vec3(0, 0, 1), positions: [
        //         new Vec3(to.x, from.y, to.z), new Vec3(to.x, to.y, to.z), new Vec3(from.x, to.y, to.z), new Vec3(from.x, from.y, to.z)
        //     ]},
        //     // west (-X)
        //     { name: 'west', normal: new Vec3(-1, 0, 0), positions: [
        //         new Vec3(from.x, from.y, to.z), new Vec3(from.x, to.y, to.z), new Vec3(from.x, to.y, from.z), new Vec3(from.x, from.y, from.z)
        //     ]},
        //     // east (+X)
        //     { name: 'east', normal: new Vec3(1, 0, 0), positions: [
        //         new Vec3(to.x, from.y, from.z), new Vec3(to.x, to.y, from.z), new Vec3(to.x, to.y, to.z), new Vec3(to.x, from.y, to.z)
        //     ]},
        //     // down (-Y)
        //     { name: 'down', normal: new Vec3(0, -1, 0), positions: [
        //         new Vec3(from.x, from.y, from.z), new Vec3(to.x, from.y, from.z), new Vec3(to.x, from.y, to.z), new Vec3(from.x, from.y, to.z)
        //     ]},
        //     // up (+Y)
        //     { name: 'up', normal: new Vec3(0, 1, 0), positions: [
        //         new Vec3(from.x, to.y, from.z), new Vec3(from.x, to.y, to.z), new Vec3(to.x, to.y, to.z), new Vec3(to.x, to.y, from.z)
        //     ]}
        // ];

        //ccw
        // 和minecraft的uv匹配的顶点顺序 fix by zeros
        // •	0 → 左下
        // •	1 → 右下
        // •	2 → 右上
        // •	3 → 左上
        const cubeFaces = [
            // north (-Z)
            { name: 'north', normal: new Vec3(0, 0, -1), positions: [
                new Vec3(to.x, from.y, from.z),
                new Vec3(from.x, from.y, from.z), 
                new Vec3(from.x, to.y, from.z), 
                new Vec3(to.x, to.y, from.z),
                
            ]},
            // south (+Z)
            { name: 'south', normal: new Vec3(0, 0, 1), positions: [
                new Vec3(from.x, from.y, to.z), new Vec3(to.x, from.y, to.z), new Vec3(to.x, to.y, to.z), new Vec3(from.x, to.y, to.z), 
            ]},
            // west (-X)
            { name: 'west', normal: new Vec3(-1, 0, 0), positions: [
                new Vec3(from.x, from.y, from.z), new Vec3(from.x, from.y, to.z), new Vec3(from.x, to.y, to.z), new Vec3(from.x, to.y, from.z), 
            ]},
            // east (+X)
            { name: 'east', normal: new Vec3(1, 0, 0), positions: [
                new Vec3(to.x, from.y, to.z), new Vec3(to.x, from.y, from.z), new Vec3(to.x, to.y, from.z), new Vec3(to.x, to.y, to.z), 
            ]},
            // down (-Y)
            { name: 'down', normal: new Vec3(0, -1, 0), positions: [
                new Vec3(from.x, from.y, to.z), new Vec3(from.x, from.y, from.z), new Vec3(to.x, from.y, from.z), new Vec3(to.x, from.y, to.z), 
            ]},
            // up (+Y)
            { name: 'up', normal: new Vec3(0, 1, 0), positions: [
                new Vec3(to.x, to.y, from.z), new Vec3(from.x, to.y, from.z), new Vec3(from.x, to.y, to.z), new Vec3(to.x, to.y, to.z), 
            ]}
        ];

        //让 Cocos 的 +Z 就代表 MC 的 南（+Z）

        // Minecraft 世界坐标系（也是右手系）
        // Minecraft 的规则和 OpenGL 类似，但有自己约定：
        // •	X = 东 (East)
        // •	Y = 上 (Up)
        // •	Z = 南 (South)
        // •	玩家面朝南方时，Z 正在增加。



        // 修正后的 cross 类型面顶点顺序
        const crossFaces = [
            { name: 'north', normal: new Vec3(0, 0, -1), positions: [ // -Z
                new Vec3(from.x, from.y, from.z), new Vec3(to.x, from.y, from.z),
                new Vec3(to.x, to.y, from.z), new Vec3(from.x, to.y, from.z)
            ]},
            { name: 'south', normal: new Vec3(0, 0, 1), positions: [ // +Z
                new Vec3(to.x, from.y, to.z), new Vec3(from.x, from.y, to.z),
                new Vec3(from.x, to.y, to.z), new Vec3(to.x, to.y, to.z)
            ]},
            { name: 'west', normal: new Vec3(-1, 0, 0), positions: [ // -X
                new Vec3(from.x, from.y, to.z), new Vec3(from.x, from.y, from.z),
                new Vec3(from.x, to.y, from.z), new Vec3(from.x, to.y, to.z)
            ]},
            { name: 'east', normal: new Vec3(1, 0, 0), positions: [ // +X
                new Vec3(to.x, from.y, from.z), new Vec3(to.x, from.y, to.z),
                new Vec3(to.x, to.y, to.z), new Vec3(to.x, to.y, from.z)
            ]},
            { name: 'down', normal: new Vec3(0, -1, 0), positions: [ // -Y
                new Vec3(from.x, from.y, to.z), new Vec3(to.x, from.y, to.z),
                new Vec3(to.x, from.y, from.z), new Vec3(from.x, from.y, from.z)
            ]},
            { name: 'up', normal: new Vec3(0, 1, 0), positions: [ // +Y
                new Vec3(from.x, to.y, from.z), new Vec3(to.x, to.y, from.z),
                new Vec3(to.x, to.y, to.z), new Vec3(from.x, to.y, to.z)
            ]}
        ];

        const faces = isCrossElement ? crossFaces : cubeFaces;

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
                meshData,
                isCrossElement
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
        meshData: VoxelMeshData,
        isCrossElement: boolean = false
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
        const uvs = this.calculateFaceUVs(faceData, isCrossElement);

        // 计算AO和光照值
        const ao = shade ? this.calculateAO(positions, normal, context) : [1, 1, 1, 1];
        const light = this.calculateLight(positions, context);

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
                texCoord: uvs[i],
                color: tintColor,
                ao: ao[i],
                light: light[i]
            };
            textureGroup.vertices.push(vertex);
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
    private static calculateFaceUVs(faceData: ResolvedFace, isCross: boolean = false): Vec2[] {
        const [u1, v1, u2, v2] = faceData.uv;
        
        let uvs: Vec2[];

        if (isCross) {
            // Cross 类型使用翻转的V坐标来修正上下颠倒问题
            // 顶点顺序: BL, BR, TR, TL
            // UV 坐标顺序需要对应
            uvs = [
                new Vec2(u1 / 16, 1 - v1 / 16), // 在纹理中是左上角，对应几何体的左下角
                new Vec2(u2 / 16, 1 - v1 / 16), // 右上角 -> 右下角
                new Vec2(u2 / 16, 1 - v2 / 16), // 右下角 -> 右上角
                new Vec2(u1 / 16, 1 - v2 / 16)  // 左下角 -> 左上角
            ];
        } else {
            // 基础UV坐标（左下、右下、右上、左上）
            // uvs = [
            //     new Vec2(u1 / 16, 1 - v2 / 16), // 左下
            //     new Vec2(u2 / 16, 1 - v2 / 16), // 右下
            //     new Vec2(u2 / 16, 1 - v1 / 16), // 右上
            //     new Vec2(u1 / 16, 1 - v1 / 16)  // 左上
            // ];

            // 不使用V翻转
            uvs = [
                new Vec2(u1 / 16, v2 / 16), // 左下
                new Vec2(u2 / 16, v2 / 16), // 右下
                new Vec2(u2 / 16, v1 / 16), // 右上
                new Vec2(u1 / 16, v1 / 16)  // 左上
            ];
        }

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
        // 如果有预计算的AO数据，使用它
        if (context.aoData && context.aoData.length > 0) {
            // 假设aoData按面顺序存储，这里简化处理
            return context.aoData[0] || [1, 1, 1, 1];
        }
        
        // 如果有方块查询函数，使用真实AO计算
        if (context.getBlockAt) {
            try {
                // 将相对坐标转换为世界坐标
                const worldPositions = positions.map(pos => 
                    Vec3.add(new Vec3(), pos, context.blockPosition)
                );
                
                return AOCalculator.calculateFaceAO(worldPositions, normal, context.getBlockAt);
            } catch (error) {
                console.warn('[MeshBuilder] AO计算失败:', error);
            }
        }
        
        // 降级方案：使用固定值
        return [0.8, 0.9, 1.0, 0.85];
    }

    /**
     * 计算光照值
     * @param positions 顶点位置
     * @param context 构建上下文
     * @returns 光照值数组
     */
    private static calculateLight(positions: Vec3[], context: MeshBuildContext): number[] {
        // 如果有预计算的光照数据，使用它
        if (context.lightData && context.lightData.length > 0) {
            return context.lightData[0] || [1, 1, 1, 1];
        }
        
        // 如果有区块光照数据，使用插值光照
        if (context.chunkLights && typeof context.chunkBaseX === 'number' && typeof context.chunkBaseZ === 'number') {
            try {
                const lightValues: number[] = [];
                
                for (const pos of positions) {
                    // 转换为世界坐标
                    const worldPos = Vec3.add(new Vec3(), pos, context.blockPosition);
                    
                    // 获取插值光照
                    const light = VoxelLightingSystem.getInterpolatedLight(
                        context.chunkLights,
                        worldPos.x,
                        worldPos.y,
                        worldPos.z,
                        context.chunkBaseX,
                        context.chunkBaseZ
                    );
                    
                    lightValues.push(light);
                }
                
                return lightValues;
            } catch (error) {
                console.warn('[MeshBuilder] 光照计算失败:', error);
            }
        }
        
        // 降级方案：检查是否有方块ID可用于获取光照等级
        if (context.blockId) {
            const lightLevel = BlockRegistry.getLightLevel(context.blockId);
            if (lightLevel > 0) {
                // 发光方块：返回归一化的光照值
                const normalizedLight = lightLevel / 15.0;
                console.log(`[MeshBuilder] 设置发光方块光照: ${context.blockId} 光照等级=${lightLevel} 归一化=${normalizedLight}`);
                return [normalizedLight, normalizedLight, normalizedLight, normalizedLight];
            } else {
                console.log(`[MeshBuilder] 普通方块: ${context.blockId} 光照等级=${lightLevel}`);
            }
        }
        
        // 最终降级：全亮
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

        // 构建Cocos Creator几何数据（遵循官方 MeshUtils 字段，避免直接写 Mesh.struct/data）
        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const colors: number[] = [];   // 顶点颜色，用 RG 存 ao/light

        for (const vertex of vertices) {
            positions.push(vertex.position.x, vertex.position.y, vertex.position.z);
            normals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
            uvs.push(vertex.texCoord.x, vertex.texCoord.y);
            // 将 AO 和 Light 打包进颜色（a_color）：R=AO, G=Light, B=0, A=1
            colors.push(vertex.ao, vertex.light, 0.0, 1.0);
        }

        const geometryData = {
            positions,
            normals,
            uvs,
            colors,
            indices: Array.from(indices)
        } as any; // 按官方 IGeometry 约定

        // 使用引擎提供的工具创建静态网格
        return utils.MeshUtils.createMesh(geometryData);
    }

    /**
     * 创建包含自定义属性的网格
     * @param geometryData 几何数据
     * @returns Mesh对象
     */
    static createMeshWithCustomAttributes(geometryData: {
        positions: number[];
        normals: number[];
        uvs: number[];
        uvs2: number[];
        aos: number[];
        lights: number[];
        indices: Uint16Array;
    }): any {
        // 简化：当前版本统一降级为基础网格创建，忽略自定义 AO/Light attribute
        try {
            return utils.MeshUtils.createMesh({
                positions: geometryData.positions,
                normals: geometryData.normals,
                uvs: geometryData.uvs,
                indices: Array.from(geometryData.indices)
            } as any);
        } catch (error) {
            console.error('[MeshBuilder] createMeshWithCustomAttributes 降级失败:', error);
            return null;
        }
    }
}