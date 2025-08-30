import { Vec3 } from "cc";

export class VoxelNormalCalculator {
    
    static calculateNormals(vertices: number[], indices: number[]): number[] {
        const normals = new Array(vertices.length).fill(0);

        for (let i = 0; i < indices.length; i += 3) {
            const v0 = indices[i] * 3;
            const v1 = indices[i + 1] * 3;
            const v2 = indices[i + 2] * 3;

            const p0 = { x: vertices[v0], y: vertices[v0 + 1], z: vertices[v0 + 2] };
            const p1 = { x: vertices[v1], y: vertices[v1 + 1], z: vertices[v1 + 2] };
            const p2 = { x: vertices[v2], y: vertices[v2 + 1], z: vertices[v2 + 2] };

            const edge1 = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
            const edge2 = { x: p2.x - p0.x, y: p2.y - p0.y, z: p2.z - p0.z };

            const normal = this.crossProduct(edge1, edge2);

            normals[v0] += normal.x;
            normals[v0 + 1] += normal.y;
            normals[v0 + 2] += normal.z;

            normals[v1] += normal.x;
            normals[v1 + 1] += normal.y;
            normals[v1 + 2] += normal.z;

            normals[v2] += normal.x;
            normals[v2 + 1] += normal.y;
            normals[v2 + 2] += normal.z;
        }

        // Normalize the normals
        for (let i = 0; i < normals.length; i += 3) {
            const x = normals[i];
            const y = normals[i + 1];
            const z = normals[i + 2];

            const length = Math.sqrt(x * x + y * y + z * z);
            
            if (length > 0) {
                normals[i] = x / length;
                normals[i + 1] = y / length;
                normals[i + 2] = z / length;
            } else {
                normals[i] = 0;
                normals[i + 1] = 1;
                normals[i + 2] = 0;
            }
        }

        return normals;
    }

    private static crossProduct(a: { x: number, y: number, z: number }, b: { x: number, y: number, z: number }) {
        return {
            x: a.y * b.z - a.z * b.y,
            y: a.z * b.x - a.x * b.z,
            z: a.x * b.y - a.y * b.x,
        };
    }

    static generateCubeNormals(positions: Vec3[]): Vec3[] {
        const normals: Vec3[] = [];
        
        // 立方体的 6 个面，每个面 4 个顶点
        const faceNormals = [
            new Vec3(0, 1, 0),   // 顶面
            new Vec3(0, -1, 0),  // 底面  
            new Vec3(0, 0, 1),   // 前面
            new Vec3(0, 0, -1),  // 后面
            new Vec3(1, 0, 0),   // 右面
            new Vec3(-1, 0, 0),  // 左面
        ];
        
        for (let face = 0; face < 6; face++) {
            for (let vertex = 0; vertex < 4; vertex++) {
                normals.push(faceNormals[face]);
            }
        }
        
        return normals;
    }

    static flattenNormals(normals: Vec3[]): number[] {
        const result: number[] = [];
        normals.forEach(normal => {
            result.push(normal.x, normal.y, normal.z);
        });
        return result;
    }
}