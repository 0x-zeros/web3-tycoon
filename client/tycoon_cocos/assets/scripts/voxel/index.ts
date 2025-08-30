// Voxel Module Entry Point
// 体素模块入口文件

// Core modules
export { VoxelConfig } from './core/VoxelConfig';
export { VoxelBlockType, VoxelBlockRegistry } from './core/VoxelBlock';
export { VoxelMapUtils } from './core/VoxelMap';
export * from './core/VoxelTypes';

// World modules
export { VoxelChunkManager } from './world/VoxelChunk';
export { VoxelTerrain } from './world/VoxelTerrain';
export { VoxelWorldManager } from './world/VoxelWorld';

// Math modules
export { VoxelNoise } from './math/VoxelNoise';

// Render modules
export { VoxelMeshGenerator } from './render/VoxelMesh';
export { VoxelRenderer } from './render/VoxelRenderer';
export { VoxelCuller } from './render/VoxelCuller';

// 使用示例：
// import { VoxelRenderer, VoxelBlockType } from 'assets/scripts/voxel';
// 
// @ccclass('GameScene')
// export class GameScene extends Component {
//     @property(VoxelRenderer)
//     voxelRenderer: VoxelRenderer = null;
// 
//     start() {
//         // 生成初始地形
//         this.voxelRenderer.generateAroundPosition(0, 0, 5);
//         
//         // 设置方块
//         this.voxelRenderer.setBlock(0, 10, 0, VoxelBlockType.STONE);
//     }
// }