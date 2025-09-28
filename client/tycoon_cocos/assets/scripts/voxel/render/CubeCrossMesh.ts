/**
 * 横十字（Horizontal Cross）立方体贴图网格生成器
 *
 * 贴图布局：
 *      [+Y]
 * [-X][+Z][+X][-Z]
 *      [-Y]
 *
 * @author Web3 Tycoon Team
 */

import { Mesh, Vec3, Vec2, gfx, utils } from 'cc';

/**
 * UV矩形区域
 */
export interface CrossUV {
    u0: number; // 左边界
    u1: number; // 右边界
    v0: number; // 下边界
    v1: number; // 上边界
}

/**
 * 横十字布局定义
 */
export interface CrossLayout {
    nx: CrossUV; // -X面
    px: CrossUV; // +X面
    ny: CrossUV; // -Y面
    py: CrossUV; // +Y面
    nz: CrossUV; // -Z面（背面）
    pz: CrossUV; // +Z面（正面/中心）
}

/**
 * 构建选项
 */
export interface BuildOptions {
    size?: number;        // 立方体边长（默认 1）
    uvEpsilon?: number;   // UV收缩偏移量，防止采样溢出（默认 0）
    layout?: CrossLayout; // 自定义布局（不传则使用标准横十字）
}

/**
 * 获取默认横十字布局
 */
function getDefaultCrossLayout(): CrossLayout {
    return {
        // 中间行（从左到右）
        nx: { u0: 0/4, u1: 1/4, v0: 1/3, v1: 2/3 }, // -X
        pz: { u0: 1/4, u1: 2/4, v0: 1/3, v1: 2/3 }, // +Z（中心）
        px: { u0: 2/4, u1: 3/4, v0: 1/3, v1: 2/3 }, // +X
        nz: { u0: 3/4, u1: 4/4, v0: 1/3, v1: 2/3 }, // -Z
        // 上下
        py: { u0: 1/4, u1: 2/4, v0: 2/3, v1: 3/3 }, // +Y（上）
        ny: { u0: 1/4, u1: 2/4, v0: 0/3, v1: 1/3 }, // -Y（下）
    };
}

/**
 * 应用UV epsilon收缩
 */
function applyUVEpsilon(uv: CrossUV, epsilon: number): CrossUV {
    if (epsilon <= 0) return uv;

    return {
        u0: uv.u0 + epsilon,
        u1: uv.u1 - epsilon,
        v0: uv.v0 + epsilon,
        v1: uv.v1 - epsilon,
    };
}

/**
 * 生成立方体网格（横十字UV布局）
 *
 * @param opts 构建选项
 * @returns 立方体Mesh对象
 */
export function buildCubeMeshWithCrossUV(opts?: BuildOptions): Mesh {
    // 默认参数
    const size = opts?.size ?? 1;
    const uvEpsilon = opts?.uvEpsilon ?? 0;
    const layout = opts?.layout ?? getDefaultCrossLayout();

    const half = size / 2;

    // 应用UV收缩
    const nx = applyUVEpsilon(layout.nx, uvEpsilon);
    const px = applyUVEpsilon(layout.px, uvEpsilon);
    const ny = applyUVEpsilon(layout.ny, uvEpsilon);
    const py = applyUVEpsilon(layout.py, uvEpsilon);
    const nz = applyUVEpsilon(layout.nz, uvEpsilon);
    const pz = applyUVEpsilon(layout.pz, uvEpsilon);

    // 准备顶点数据数组
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    let vertexOffset = 0;

    /**
     * 添加一个面的顶点数据
     * @param facePositions 4个顶点位置（CCW顺序）
     * @param normal 面法线
     * @param faceUV UV区域
     */
    function addFace(
        facePositions: Vec3[],
        normal: Vec3,
        faceUV: CrossUV
    ): void {
        // 添加4个顶点
        // 顶点顺序：左下、右下、右上、左上（从面朝向看）
        // UV对应：(u0,v0), (u1,v0), (u1,v1), (u0,v1)
        const uvCoords = [
            [faceUV.u0, faceUV.v0], // 左下
            [faceUV.u1, faceUV.v0], // 右下
            [faceUV.u1, faceUV.v1], // 右上
            [faceUV.u0, faceUV.v1], // 左上
        ];

        for (let i = 0; i < 4; i++) {
            const pos = facePositions[i];
            positions.push(pos.x, pos.y, pos.z);
            normals.push(normal.x, normal.y, normal.z);
            uvs.push(uvCoords[i][0], uvCoords[i][1]);
        }

        // 添加两个三角形的索引（CCW）
        const base = vertexOffset;
        indices.push(
            base + 0, base + 1, base + 2,  // 第一个三角形
            base + 0, base + 2, base + 3   // 第二个三角形
        );

        vertexOffset += 4;
    }

    // 1. +X面（右）
    addFace(
        [
            new Vec3(+half, -half, +half), // 左下（从+X方向看）
            new Vec3(+half, -half, -half), // 右下
            new Vec3(+half, +half, -half), // 右上
            new Vec3(+half, +half, +half), // 左上
        ],
        new Vec3(1, 0, 0),
        px
    );

    // 2. -X面（左）
    addFace(
        [
            new Vec3(-half, -half, -half), // 左下（从-X方向看）
            new Vec3(-half, -half, +half), // 右下
            new Vec3(-half, +half, +half), // 右上
            new Vec3(-half, +half, -half), // 左上
        ],
        new Vec3(-1, 0, 0),
        nx
    );

    // 3. +Y面（上）
    addFace(
        [
            new Vec3(-half, +half, +half), // 左下（从+Y方向看）
            new Vec3(+half, +half, +half), // 右下
            new Vec3(+half, +half, -half), // 右上
            new Vec3(-half, +half, -half), // 左上
        ],
        new Vec3(0, 1, 0),
        py
    );

    // 4. -Y面（下）
    addFace(
        [
            new Vec3(-half, -half, -half), // 左下（从-Y方向看）
            new Vec3(+half, -half, -half), // 右下
            new Vec3(+half, -half, +half), // 右上
            new Vec3(-half, -half, +half), // 左上
        ],
        new Vec3(0, -1, 0),
        ny
    );

    // 5. +Z面（前）
    addFace(
        [
            new Vec3(-half, -half, +half), // 左下（从+Z方向看）
            new Vec3(+half, -half, +half), // 右下
            new Vec3(+half, +half, +half), // 右上
            new Vec3(-half, +half, +half), // 左上
        ],
        new Vec3(0, 0, 1),
        pz
    );

    // 6. -Z面（后）
    addFace(
        [
            new Vec3(+half, -half, -half), // 左下（从-Z方向看）
            new Vec3(-half, -half, -half), // 右下
            new Vec3(-half, +half, -half), // 右上
            new Vec3(+half, +half, -half), // 左上
        ],
        new Vec3(0, 0, -1),
        nz
    );

    // 创建Mesh
    const mesh = utils.MeshUtils.createMesh({
        positions,
        normals,
        uvs,
        indices,

        // 可选：计算最小/最大边界
        minPos: new Vec3(-half, -half, -half),
        maxPos: new Vec3(+half, +half, +half),

        primitiveMode: gfx.PrimitiveMode.TRIANGLE_LIST,
    });

    return mesh;
}

/**
 * 创建测试用的带数字标记的横十字布局
 * 用于验证UV映射是否正确
 */
export function getTestCrossLayout(): CrossLayout {
    // 与默认布局相同，但可以用于调试
    return getDefaultCrossLayout();
}