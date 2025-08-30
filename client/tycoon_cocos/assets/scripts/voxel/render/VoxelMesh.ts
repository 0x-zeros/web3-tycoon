import { Vec3, primitives, utils } from "cc";
import { VoxelVertexData, VoxelMeshData, VoxelCubeParams, VoxelLightData } from "../core/VoxelTypes";
import { VoxelBlockType, VoxelBlockRegistry } from "../core/VoxelBlock";
import { VoxelConfig } from "../core/VoxelConfig";
import { VoxelNormalCalculator } from "../math/VoxelNormalCalculator";

export class VoxelMeshGenerator {
    
    static makeCubeFaces(
        cubeParams: VoxelCubeParams,
        aoData: number[][],
        lightData: number[][],
        leftType: VoxelBlockType = VoxelBlockType.EMPTY,
        rightType: VoxelBlockType = VoxelBlockType.EMPTY,
        topType: VoxelBlockType = VoxelBlockType.EMPTY,
        bottomType: VoxelBlockType = VoxelBlockType.EMPTY,
        frontType: VoxelBlockType = VoxelBlockType.EMPTY,
        backType: VoxelBlockType = VoxelBlockType.EMPTY
    ): VoxelMeshData {
        const vertices: VoxelVertexData[] = [];
        const indices: number[] = [];
        
        const { x, y, z, size, blockType } = cubeParams;
        const half = size * 0.5;
        
        const faces = [
            { 
                name: 'top', 
                positions: [
                    new Vec3(x - half, y + half, z - half),
                    new Vec3(x + half, y + half, z - half),
                    new Vec3(x + half, y + half, z + half),
                    new Vec3(x - half, y + half, z + half)
                ],
                normal: new Vec3(0, 1, 0),
                shouldRender: VoxelBlockRegistry.isTransparent(topType)
            },
            { 
                name: 'bottom', 
                positions: [
                    new Vec3(x - half, y - half, z + half),
                    new Vec3(x + half, y - half, z + half),
                    new Vec3(x + half, y - half, z - half),
                    new Vec3(x - half, y - half, z - half)
                ],
                normal: new Vec3(0, -1, 0),
                shouldRender: VoxelBlockRegistry.isTransparent(bottomType)
            },
            { 
                name: 'front', 
                positions: [
                    new Vec3(x - half, y - half, z + half),
                    new Vec3(x - half, y + half, z + half),
                    new Vec3(x + half, y + half, z + half),
                    new Vec3(x + half, y - half, z + half)
                ],
                normal: new Vec3(0, 0, 1),
                shouldRender: VoxelBlockRegistry.isTransparent(frontType)
            },
            { 
                name: 'back', 
                positions: [
                    new Vec3(x + half, y - half, z - half),
                    new Vec3(x + half, y + half, z - half),
                    new Vec3(x - half, y + half, z - half),
                    new Vec3(x - half, y - half, z - half)
                ],
                normal: new Vec3(0, 0, -1),
                shouldRender: VoxelBlockRegistry.isTransparent(backType)
            },
            { 
                name: 'right', 
                positions: [
                    new Vec3(x + half, y - half, z + half),
                    new Vec3(x + half, y + half, z + half),
                    new Vec3(x + half, y + half, z - half),
                    new Vec3(x + half, y - half, z - half)
                ],
                normal: new Vec3(1, 0, 0),
                shouldRender: VoxelBlockRegistry.isTransparent(rightType)
            },
            { 
                name: 'left', 
                positions: [
                    new Vec3(x - half, y - half, z - half),
                    new Vec3(x - half, y + half, z - half),
                    new Vec3(x - half, y + half, z + half),
                    new Vec3(x - half, y - half, z + half)
                ],
                normal: new Vec3(-1, 0, 0),
                shouldRender: VoxelBlockRegistry.isTransparent(leftType)
            }
        ];
        
        let vertexIndex = 0;
        
        faces.forEach((face, faceIndex) => {
            if (!face.shouldRender) return;
            
            const textureIndex = VoxelBlockRegistry.getTextureIndex(blockType, faceIndex);
            const uvs = this.getTextureUVs(textureIndex);
            
            for (let i = 0; i < 4; i++) {
                const vertex: VoxelVertexData = {
                    position: face.positions[i],
                    normal: face.normal,
                    uv: uvs[i],
                    ao: aoData[faceIndex] ? aoData[faceIndex][i] : 1.0,
                    light: lightData[faceIndex] ? lightData[faceIndex][i] : 0.0
                };
                vertices.push(vertex);
            }
            
            // 调整为顺时针顺序，适应Cocos Creator的面剔除
            indices.push(
                vertexIndex, vertexIndex + 2, vertexIndex + 1,
                vertexIndex, vertexIndex + 3, vertexIndex + 2
            );
            
            vertexIndex += 4;
        });
        
        return { vertices, indices };
    }

    private static getTextureUVs(textureIndex: number): { x: number; y: number }[] {
        const texturesPerRow = 16;
        const uvSize = 1.0 / texturesPerRow;  // 0.0625
        
        // 边界偏移，避免纹理渗透：按UV单元比例给出，避免依赖固定像素
        const offset = uvSize * 0.5 * 0.01;   // 相当于每格的1%的一半
        const a = offset;                      // 左上角偏移
        const b = uvSize - offset;             // 右下角偏移
        
        const col = textureIndex % texturesPerRow;
        const row = Math.floor(textureIndex / texturesPerRow);
        
        const du = col * uvSize;
        // OpenGL/GLSL 的 (0,0) 在左下，通常图集索引的 row=0 表示顶行，需要翻转
        const flippedRow = (texturesPerRow - 1) - row;
        const dv = flippedRow * uvSize;
        
        // UV 顺序：左上、右上、右下、左下
        return [
            { x: du + a, y: dv + b },  // 左上（注意y使用b）
            { x: du + b, y: dv + b },  // 右上
            { x: du + b, y: dv + a },  // 右下
            { x: du + a, y: dv + a }   // 左下
        ];
    }

    static makeCube(cubeParams: VoxelCubeParams, lightData: VoxelLightData): VoxelMeshData {
        const aoData = lightData.ao || Array(6).fill([1, 1, 1, 1]);
        const lightLevelData = lightData.light || Array(6).fill([0, 0, 0, 0]);
        
        return this.makeCubeFaces(cubeParams, aoData, lightLevelData);
    }

    static makePlant(
        x: number, y: number, z: number, 
        size: number, blockType: VoxelBlockType,
        ao: number = 1.0, light: number = 0.0,
        rotation: number = 0
    ): VoxelMeshData {
        const vertices: VoxelVertexData[] = [];
        const indices: number[] = [];
        
        const half = size * 0.5;
        const textureIndex = VoxelBlockRegistry.getTextureIndex(blockType, 0);
        const uvs = this.getTextureUVs(textureIndex);
        
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        
        const positions = [
            new Vec3(x - half * cos, y - half, z - half * sin),
            new Vec3(x - half * cos, y + half, z - half * sin),
            new Vec3(x + half * cos, y + half, z + half * sin),
            new Vec3(x + half * cos, y - half, z + half * sin),
            
            new Vec3(x - half * sin, y - half, z + half * cos),
            new Vec3(x - half * sin, y + half, z + half * cos),
            new Vec3(x + half * sin, y + half, z - half * cos),
            new Vec3(x + half * sin, y - half, z - half * cos)
        ];
        
        const normal = new Vec3(0, 0, 1);
        
        for (let i = 0; i < 8; i++) {
            const vertex: VoxelVertexData = {
                position: positions[i],
                normal: normal,
                uv: uvs[i % 4],
                ao: ao,
                light: light
            };
            vertices.push(vertex);
        }
        
        // 调整为顺时针顺序，适应Cocos Creator的面剔除
        indices.push(
            0, 2, 1, 0, 3, 2,  // first cross
            4, 6, 5, 4, 7, 6   // second cross
        );
        
        return { vertices, indices };
    }

    static makeWireframe(x: number, y: number, z: number, size: number): VoxelMeshData {
        const vertices: VoxelVertexData[] = [];
        const indices: number[] = [];
        
        const half = size * 0.5;
        const positions = [
            new Vec3(x - half, y - half, z - half),
            new Vec3(x + half, y - half, z - half),
            new Vec3(x + half, y + half, z - half),
            new Vec3(x - half, y + half, z - half),
            new Vec3(x - half, y - half, z + half),
            new Vec3(x + half, y - half, z + half),
            new Vec3(x + half, y + half, z + half),
            new Vec3(x - half, y + half, z + half)
        ];
        
        positions.forEach(pos => {
            const vertex: VoxelVertexData = {
                position: pos,
                normal: new Vec3(0, 1, 0),
                uv: { x: 0, y: 0 },
                ao: 1.0,
                light: 0.0
            };
            vertices.push(vertex);
        });
        
        const wireframeIndices = [
            0, 1, 1, 2, 2, 3, 3, 0,  // bottom
            4, 5, 5, 6, 6, 7, 7, 4,  // top
            0, 4, 1, 5, 2, 6, 3, 7   // vertical edges
        ];
        
        indices.push(...wireframeIndices);
        
        return { vertices, indices };
    }

    static combineMeshes(meshes: VoxelMeshData[]): VoxelMeshData {
        const combinedVertices: VoxelVertexData[] = [];
        const combinedIndices: number[] = [];
        
        let vertexOffset = 0;
        
        meshes.forEach(mesh => {
            combinedVertices.push(...mesh.vertices);
            
            const offsetIndices = mesh.indices.map(index => index + vertexOffset);
            combinedIndices.push(...offsetIndices);
            
            vertexOffset += mesh.vertices.length;
        });
        
        return {
            vertices: combinedVertices,
            indices: combinedIndices
        };
    }

    static extractPositions(meshData: VoxelMeshData): number[] {
        const positions: number[] = [];
        meshData.vertices.forEach(vertex => {
            positions.push(vertex.position.x, vertex.position.y, vertex.position.z);
        });
        return positions;
    }

    static extractNormals(meshData: VoxelMeshData): number[] {
        const normals: number[] = [];
        meshData.vertices.forEach(vertex => {
            normals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
        });
        return normals;
    }

    static extractUVs(meshData: VoxelMeshData): number[] {
        const uvs: number[] = [];
        meshData.vertices.forEach(vertex => {
            uvs.push(vertex.uv.x, vertex.uv.y);
        });
        return uvs;
    }

    static createCocosMesh(meshData: VoxelMeshData): primitives.IGeometry {
        const positions = this.extractPositions(meshData);
        const uvs = this.extractUVs(meshData);
        const normals = VoxelNormalCalculator.calculateNormals(positions, meshData.indices);
        
        return {
            positions: positions,
            normals: normals,
            uvs: uvs,
            indices: meshData.indices
        };
    }

    static generateChunkMesh(
        blocks: { x: number, y: number, z: number, type: VoxelBlockType }[],
        getBlockAt: (x: number, y: number, z: number) => VoxelBlockType,
        baseX: number = 0,
        baseZ: number = 0
    ): VoxelMeshData {
        const meshes: VoxelMeshData[] = [];
        
        blocks.forEach(block => {
            if (block.type === VoxelBlockType.EMPTY) return;
            
            if (VoxelBlockRegistry.isPlant(block.type)) {
                const plantMesh = this.makePlant(
                    // 使用区块本地坐标生成顶点，避免与区块节点位移叠加
                    block.x - baseX, block.y, block.z - baseZ, 1.0, block.type
                );
                meshes.push(plantMesh);
            } else {
                const neighbors = {
                    // 邻居查询保持世界坐标，保证跨区块相邻面的可见性判断正确
                    left: getBlockAt(block.x - 1, block.y, block.z),
                    right: getBlockAt(block.x + 1, block.y, block.z),
                    top: getBlockAt(block.x, block.y + 1, block.z),
                    bottom: getBlockAt(block.x, block.y - 1, block.z),
                    front: getBlockAt(block.x, block.y, block.z + 1),
                    back: getBlockAt(block.x, block.y, block.z - 1)
                };
                
                const cubeParams: VoxelCubeParams = {
                    left: neighbors.left,
                    right: neighbors.right,
                    top: neighbors.top,
                    bottom: neighbors.bottom,
                    front: neighbors.front,
                    back: neighbors.back,
                    // 使用本地坐标生成几何体
                    x: block.x - baseX,
                    y: block.y,
                    z: block.z - baseZ,
                    size: 1.0,
                    blockType: block.type
                };
                
                const lightData: VoxelLightData = {
                    ao: Array(6).fill([1, 1, 1, 1]),
                    light: Array(6).fill([0, 0, 0, 0])
                };
                
                const cubeMesh = this.makeCube(cubeParams, lightData);
                if (cubeMesh.vertices.length > 0) {
                    meshes.push(cubeMesh);
                }
            }
        });
        
        return this.combineMeshes(meshes);
    }
}