import { _decorator, Component, Camera, Vec3, KeyCode, input, Input, EventKeyboard } from "cc";
import { VoxelRenderer } from "../render/VoxelRenderer";
import { VoxelInteractionManager, VoxelInteractionEvents } from "../interaction/VoxelInteractionManager";
// import { VoxelCameraController } from "../../camera/voxel/VoxelCameraController";
// import { VoxelCameraMode } from "../../camera/voxel/VoxelCameraConfig";
import { VoxelCollisionSystem } from "../interaction/VoxelCollisionSystem";
import { VoxelBlockType } from "../core/VoxelBlock";
import { VoxelWorldMode, VoxelWorldConfig } from "../core/VoxelWorldConfig";
import { VoxelRenderMode } from "../core/VoxelConfig";

const { ccclass, property } = _decorator;

@ccclass('VoxelInteractionExample')
export class VoxelInteractionExample extends Component {

    @property(Camera)
    camera: Camera = null;

    @property(VoxelRenderer)
    voxelRenderer: VoxelRenderer = null;

    private currentBlockType: VoxelBlockType = VoxelBlockType.STONE;

    protected onLoad() {
        this.initializeVoxelSystem();
        this.setupEventCallbacks();
        
        // 延迟一秒后测试交互系统
        this.scheduleOnce(() => {
            this.testInteractionSystem();
        }, 1.0);
    }

    protected onEnable() {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    protected onDisable() {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    private initializeVoxelSystem(): void {
        if (!this.voxelRenderer) {
            console.error('[VoxelInteractionExample] VoxelRenderer 组件未设置');
            return;
        }

        // 设置摄像机到玩家出生位置
        const spawnPos = this.voxelRenderer.findSpawnLocation();
        spawnPos.y += 2; // 相机位置稍高一些
        
        if (this.camera) {
            this.camera.node.setWorldPosition(spawnPos);
        }

        // 在玩家周围生成地形
        this.voxelRenderer.generateAroundPosition(spawnPos.x, spawnPos.z, 5);
        
        // 手动放置一些测试方块
        this.createTestBlocks(spawnPos);

        console.log('[VoxelInteractionExample] 体素交互系统初始化完成');
        console.log('键位控制:');
        console.log('  WASD: 移动');
        console.log('  F: 切换步行/飞行模式');
        console.log('  1-6: 切换方块类型');
        console.log('  R: 切换渲染模式');
        console.log('  T: 切换世界模式');
        console.log('  G: 重新生成世界');
        console.log('  I: 打印调试信息');
        console.log('  P: 在前方放置测试方块');
        console.log('  O: 检查摄像机位置和前方方块');
        console.log('  鼠标左键: 破坏方块');
        console.log('  鼠标右键: 放置方块');
    }

    private setupEventCallbacks(): void {
        const events: VoxelInteractionEvents = {
            onBlockClick: (hitResult) => {
                if (hitResult.hit && hitResult.position) {
                    console.log(`[交互] 点击方块 位置:(${hitResult.position.x}, ${hitResult.position.y}, ${hitResult.position.z}) 类型:${hitResult.blockType}`);
                }
            },
            onBlockHover: (hitResult) => {
                // 悬停事件太频繁，仅在需要时启用
                // if (hitResult && hitResult.position) {
                //     console.log(`[交互] 悬停方块 位置:(${hitResult.position.x}, ${hitResult.position.y}, ${hitResult.position.z})`);
                // }
            },
            onBlockPlace: (position, blockType) => {
                console.log(`[交互] 放置方块 位置:(${position.x}, ${position.y}, ${position.z}) 类型:${blockType}`);
            },
            onBlockBreak: (position) => {
                console.log(`[交互] 破坏方块 位置:(${position.x}, ${position.y}, ${position.z})`);
            },
            onModeChange: (mode) => {
                console.log(`[交互] 摄像机模式切换: ${mode}`);
                const speedText = mode === VoxelCameraMode.FLYING ? '飞行模式 (20 units/s)' : '步行模式 (5 units/s)';
                console.log(`[交互] 当前速度: ${speedText}`);
            }
        };

        this.voxelRenderer.setInteractionEventCallbacks(events);
    }

    private onKeyDown(event: EventKeyboard): void {
        switch (event.keyCode) {
            case KeyCode.DIGIT_1:
                this.setBlockType(VoxelBlockType.STONE);
                break;
            case KeyCode.DIGIT_2:
                this.setBlockType(VoxelBlockType.DIRT);
                break;
            case KeyCode.DIGIT_3:
                this.setBlockType(VoxelBlockType.GRASS);
                break;
            case KeyCode.DIGIT_4:
                this.setBlockType(VoxelBlockType.WOOD);
                break;
            case KeyCode.DIGIT_5:
                this.setBlockType(VoxelBlockType.LEAVES);
                break;
            case KeyCode.DIGIT_6:
                this.setBlockType(VoxelBlockType.GLASS);
                break;
            case KeyCode.KEY_R:
                this.toggleRenderMode();
                break;
            case KeyCode.KEY_T:
                // this.toggleWorldMode();
                console.log('toggleWorldMode 太卡了，暂时禁用');
                break;
            case KeyCode.KEY_G:
                this.regenerateWorld();
                break;
            case KeyCode.KEY_I:
                this.printDebugInfo();
                break;
            case KeyCode.KEY_P:
                this.placeTestBlock();
                break;
            case KeyCode.KEY_O:
                this.printCameraAndBlocks();
                break;
        }
    }

    private setBlockType(blockType: VoxelBlockType): void {
        this.currentBlockType = blockType;
        this.voxelRenderer.setSelectedBlockType(blockType);
        console.log(`[交互] 选择方块类型: ${blockType}`);
    }

    private toggleRenderMode(): void {
        const currentMode = this.voxelRenderer.getCurrentRenderMode();
        const newMode = currentMode === VoxelRenderMode.MERGED_CHUNK 
            ? VoxelRenderMode.INDIVIDUAL_BLOCK 
            : VoxelRenderMode.MERGED_CHUNK;
        
        this.voxelRenderer.setRenderMode(newMode);
        console.log(`[交互] 渲染模式: ${currentMode} → ${newMode}`);
    }

    private toggleWorldMode(): void {
        const currentMode = this.voxelRenderer.getCurrentWorldMode();
        let newMode: VoxelWorldMode;
        
        switch (currentMode) {
            case VoxelWorldMode.NORMAL:
                newMode = VoxelWorldMode.SMALL_FLAT;
                break;
            case VoxelWorldMode.SMALL_FLAT:
                newMode = VoxelWorldMode.TINY_DEBUG;
                break;
            case VoxelWorldMode.TINY_DEBUG:
                newMode = VoxelWorldMode.NORMAL;
                break;
            default:
                newMode = VoxelWorldMode.NORMAL;
        }
        
        this.voxelRenderer.switchWorldMode(newMode);
        console.log(`[交互] 世界模式: ${currentMode} → ${newMode}`);
        
        // 重新设置相机位置
        const spawnPos = this.voxelRenderer.findSpawnLocation();
        spawnPos.y += 2;
        if (this.camera) {
            this.camera.node.setWorldPosition(spawnPos);
        }
        
        // 重新生成周围地形
        this.voxelRenderer.generateAroundPosition(spawnPos.x, spawnPos.z, 3);
    }

    private regenerateWorld(): void {
        console.log('[交互] 重新生成世界');
        this.voxelRenderer.regenerateWorld();
        
        // 重新设置相机位置
        const spawnPos = this.voxelRenderer.findSpawnLocation();
        spawnPos.y += 2;
        if (this.camera) {
            this.camera.node.setWorldPosition(spawnPos);
        }
    }

    private printDebugInfo(): void {
        console.log('=== 体素交互系统调试信息 ===');
        
        // 世界统计
        const stats = this.voxelRenderer.getWorldStatistics();
        console.log('世界统计:', stats);
        
        // 渲染模式信息
        const renderInfo = this.voxelRenderer.getRenderModeInfo();
        console.log(renderInfo);
        
        // 世界模式信息
        const worldInfo = this.voxelRenderer.getWorldModeInfo();
        console.log(worldInfo);
        
        // 交互系统信息
        const interactionManager = this.voxelRenderer.getInteractionManager();
        if (interactionManager) {
            console.log('交互系统状态: 已初始化');
            console.log('当前选择的方块类型:', this.currentBlockType);
        } else {
            console.log('交互系统状态: 未初始化');
        }
        
        // 节点层级结构信息
        console.log('VoxelRenderer节点子节点数量:', this.voxelRenderer.node.children.length);
        
        // 简化的调试信息
        console.log('当前渲染模式:', this.voxelRenderer.getCurrentRenderMode());
        console.log('当前世界模式:', this.voxelRenderer.getCurrentWorldMode());
        
        console.log('=== 调试信息结束 ===');
    }

    public manualPlaceBlock(x: number, y: number, z: number, blockType?: VoxelBlockType): boolean {
        const type = blockType || this.currentBlockType;
        const position = new Vec3(x, y, z);
        return this.voxelRenderer.placeBlock(position, type);
    }

    public manualBreakBlock(x: number, y: number, z: number): boolean {
        const position = new Vec3(x, y, z);
        return this.voxelRenderer.breakBlock(position);
    }

    public getBlockAt(x: number, y: number, z: number): VoxelBlockType {
        return this.voxelRenderer.getBlock(x, y, z);
    }

    public getCameraPosition(): Vec3 {
        return this.camera ? this.camera.node.getWorldPosition() : new Vec3();
    }

    public setCameraPosition(x: number, y: number, z: number): void {
        if (this.camera) {
            this.camera.node.setWorldPosition(new Vec3(x, y, z));
        }
    }

    public teleportToSpawn(): void {
        const spawnPos = this.voxelRenderer.findSpawnLocation();
        spawnPos.y += 2;
        this.setCameraPosition(spawnPos.x, spawnPos.y, spawnPos.z);
        console.log(`[交互] 传送到出生点: (${spawnPos.x}, ${spawnPos.y}, ${spawnPos.z})`);
    }

    public buildStructure(): void {
        const cameraPos = this.getCameraPosition();
        const baseX = Math.floor(cameraPos.x) + 5;
        const baseY = Math.floor(cameraPos.y);
        const baseZ = Math.floor(cameraPos.z);

        console.log(`[交互] 在位置 (${baseX}, ${baseY}, ${baseZ}) 建造小房子`);

        // 建造一个简单的3x3x3房子
        for (let x = 0; x < 3; x++) {
            for (let z = 0; z < 3; z++) {
                // 地基
                this.manualPlaceBlock(baseX + x, baseY - 1, baseZ + z, VoxelBlockType.STONE);
                
                // 墙壁
                if (x === 0 || x === 2 || z === 0 || z === 2) {
                    this.manualPlaceBlock(baseX + x, baseY, baseZ + z, VoxelBlockType.WOOD);
                    this.manualPlaceBlock(baseX + x, baseY + 1, baseZ + z, VoxelBlockType.WOOD);
                }
                
                // 屋顶
                this.manualPlaceBlock(baseX + x, baseY + 2, baseZ + z, VoxelBlockType.LEAVES);
            }
        }

        // 添加门（移除一个墙块）
        this.manualBreakBlock(baseX + 1, baseY, baseZ);
        
        console.log('[交互] 房子建造完成！');
    }

    private testInteractionSystem(): void {
        console.log('=== 交互系统测试开始 ===');
        
        if (!this.voxelRenderer) {
            console.error('[测试] VoxelRenderer未设置！');
            return;
        }
        
        const interactionManager = this.voxelRenderer.getInteractionManager();
        if (!interactionManager) {
            console.error('[测试] 交互管理器未初始化！');
            console.log('[测试] 请确保在VoxelRenderer节点上添加了以下组件:');
            console.log('  - VoxelInteractionManager');
            console.log('  - VoxelCameraController'); 
            console.log('  - VoxelCollisionSystem');
            return;
        }
        
        console.log('[测试] 交互管理器已初始化 ✓');
        
        // 测试射线投射
        console.log('[测试] 执行射线投射测试（屏幕中心）...');
        const rayResult = this.voxelRenderer.performRaycast();
        console.log('[测试] 射线投射结果:', rayResult);
        
        // 测试摄像机位置
        const cameraPos = this.getCameraPosition();
        console.log(`[测试] 摄像机位置: (${cameraPos.x.toFixed(2)}, ${cameraPos.y.toFixed(2)}, ${cameraPos.z.toFixed(2)})`);
        
        // 测试世界中是否有方块
        console.log('[测试] 检查摄像机周围的方块...');
        let foundBlocks = 0;
        for (let dx = -3; dx <= 3; dx++) {
            for (let dy = -3; dy <= 3; dy++) {
                for (let dz = -3; dz <= 3; dz++) {
                    const x = Math.floor(cameraPos.x) + dx;
                    const y = Math.floor(cameraPos.y) + dy;
                    const z = Math.floor(cameraPos.z) + dz;
                    
                    const blockType = this.getBlockAt(x, y, z);
                    if (blockType !== VoxelBlockType.EMPTY) {
                        foundBlocks++;
                        if (foundBlocks <= 10) { // 只打印前10个
                            console.log(`[测试] 发现方块 (${x}, ${y}, ${z}): ${blockType}`);
                        }
                    }
                }
            }
        }
        
        console.log(`[测试] 在7x7x7范围内发现 ${foundBlocks} 个方块`);
        
        if (foundBlocks === 0) {
            console.warn('[测试] 警告：摄像机周围没有方块！请尝试:');
            console.warn('  1. 按T键切换到TINY_DEBUG世界模式');
            console.warn('  2. 按G键重新生成世界');
            console.warn('  3. 移动摄像机到地面附近');
        } else {
            console.log('[测试] 交互系统基础功能正常 ✓');
            console.log('[测试] 现在可以尝试点击方块进行交互');
        }
        
        console.log('=== 交互系统测试完成 ===');
    }

    private createTestBlocks(spawnPos: Vec3): void {
        console.log('[VoxelInteractionExample] 创建测试方块...');
        
        const worldMode = this.voxelRenderer.getCurrentWorldMode();
        const baseX = Math.floor(spawnPos.x);
        const baseZ = Math.floor(spawnPos.z);
        
        if (worldMode === VoxelWorldMode.SMALL_FLAT) {
            // SMALL_FLAT模式：在单层平面上放置测试方块
            console.log('[测试方块] SMALL_FLAT模式 - 在y=1层放置测试方块');
            
            // 在前方放置一个石头方块用于测试点击
            this.voxelRenderer.setBlock(baseX, 1, baseZ - 2, VoxelBlockType.STONE);
            console.log(`[测试方块] 放置石头方块 (${baseX}, 1, ${baseZ - 2}) 用于点击测试`);
            
            // 放置一些不同类型的方块在地面上方
            this.voxelRenderer.setBlock(baseX - 2, 1, baseZ, VoxelBlockType.WOOD);
            this.voxelRenderer.setBlock(baseX + 2, 1, baseZ, VoxelBlockType.DIRT);
            this.voxelRenderer.setBlock(baseX, 1, baseZ + 2, VoxelBlockType.LEAVES);
            
            console.log('[测试提示] SMALL_FLAT模式：地面在y=0，测试方块在y=1');
        } else {
            // 其他模式：保持原来的逻辑
            const baseY = Math.floor(spawnPos.y) - 3; // 在脚下放置方块
            
            // 创建一个3x3的地面
            for (let x = -1; x <= 1; x++) {
                for (let z = -1; z <= 1; z++) {
                    this.voxelRenderer.setBlock(baseX + x, baseY, baseZ + z, VoxelBlockType.GRASS);
                    console.log(`[测试方块] 放置草方块 (${baseX + x}, ${baseY}, ${baseZ + z})`);
                }
            }
            
            // 在前方放置一个石头方块用于测试点击
            this.voxelRenderer.setBlock(baseX, baseY + 1, baseZ - 2, VoxelBlockType.STONE);
            console.log(`[测试方块] 放置石头方块 (${baseX}, ${baseY + 1}, ${baseZ - 2}) 用于点击测试`);
            
            // 放置一些不同类型的方块
            this.voxelRenderer.setBlock(baseX - 2, baseY + 1, baseZ, VoxelBlockType.WOOD);
            this.voxelRenderer.setBlock(baseX + 2, baseY + 1, baseZ, VoxelBlockType.DIRT);
            this.voxelRenderer.setBlock(baseX, baseY + 1, baseZ + 2, VoxelBlockType.LEAVES);
        }
        
        console.log('[VoxelInteractionExample] 测试方块创建完成');
        console.log('[测试提示] 请朝向前方的石头方块点击鼠标进行测试');
    }

    private placeTestBlock(): void {
        const cameraPos = this.getCameraPosition();
        const x = Math.floor(cameraPos.x);
        const y = Math.floor(cameraPos.y) - 1;
        const z = Math.floor(cameraPos.z) - 2;
        
        console.log(`[测试] 在 (${x}, ${y}, ${z}) 放置测试方块`);
        const success = this.voxelRenderer.setBlock(x, y, z, VoxelBlockType.STONE);
        console.log(`[测试] 放置结果: ${success ? '成功' : '失败'}`);
    }

    private printCameraAndBlocks(): void {
        const cameraPos = this.getCameraPosition();
        console.log(`[调试] 摄像机位置: (${cameraPos.x.toFixed(2)}, ${cameraPos.y.toFixed(2)}, ${cameraPos.z.toFixed(2)})`);
        
        console.log('[调试] 检查摄像机前方的方块:');
        for (let dist = 1; dist <= 8; dist++) {
            const checkX = Math.floor(cameraPos.x);
            const checkY = Math.floor(cameraPos.y);
            const checkZ = Math.floor(cameraPos.z) - dist;
            
            const blockType = this.getBlockAt(checkX, checkY, checkZ);
            if (blockType !== VoxelBlockType.EMPTY) {
                console.log(`[调试] 距离${dist}: (${checkX}, ${checkY}, ${checkZ}) = ${blockType}`);
            }
        }
        
        // 执行一次射线投射测试（使用屏幕中心）
        console.log('[调试] 执行射线投射测试（屏幕中心）...');
        const rayResult = this.voxelRenderer.performRaycast();
        console.log('[调试] 射线投射结果:', rayResult);
    }
}