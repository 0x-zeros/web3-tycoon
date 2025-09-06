// Voxel Module Entry Point
// 体素模块入口文件 - Minecraft 资源包渲染系统

// === 新的 Minecraft 资源包系统 ===
// Main system
export { VoxelSystem, getVoxelSystem, isVoxelSystemReady } from './VoxelSystem';

// Resource management
export { ResourcePackLoader, getGlobalResourcePackLoader } from './resource/ResourcePackLoader';
export { TextureManager, getGlobalTextureManager, initializeGlobalTextureManager } from './resource/TextureManager';
export { MaterialFactory, getGlobalMaterialFactory, initializeGlobalMaterialFactory, MaterialType } from './resource/MaterialFactory';
export { ModelParser, ModelTemplate } from './resource/ModelParser';
export { BlockStateParser } from './resource/BlockStateParser';
export { MeshBuilder } from './resource/MeshBuilder';

// Block system (new)
export { BlockRegistry, BlockDefinition, BlockRenderType } from './core/VoxelBlock';

// Examples and testing
export { VoxelSystemExample, VoxelSystemTest } from './examples/VoxelSystemExample';

// === 兼容性导出（旧系统） ===
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

// Interaction modules
export { VoxelInteractionManager } from './interaction/VoxelInteractionManager';
export { VoxelRayCaster, RaycastAlgorithm } from './interaction/VoxelRayCaster';

// 使用示例 (新系统)：
// import { VoxelSystem, VoxelSystemExample } from 'assets/scripts/voxel';
// 
// @ccclass('GameScene')
// export class GameScene extends Component {
//     @property(Node)
//     voxelContainer: Node = null;
// 
//     async start() {
//         // 初始化 Minecraft 资源包渲染系统
//         const voxelSystem = await VoxelSystem.quickInitialize();
//         if (!voxelSystem) {
//             console.error('体素系统初始化失败');
//             return;
//         }
//         
//         // 添加测试组件
//         const testComponent = this.voxelContainer.addComponent(VoxelSystemExample);
//         
//         // 生成方块
//         await voxelSystem.generateBlockMesh('minecraft:stone', new Vec3(0, 0, 0));
//     }
// }

// 使用示例 (旧系统，兼容性)：
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