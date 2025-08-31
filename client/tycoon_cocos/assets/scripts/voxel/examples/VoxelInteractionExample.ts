import { _decorator, Component, Camera, Vec3, KeyCode, input, Input, EventKeyboard } from "cc";
import { VoxelRenderer } from "../render/VoxelRenderer";
import { VoxelInteractionManager, VoxelInteractionEvents } from "../interaction/VoxelInteractionManager";
import { VoxelCameraController, CameraMode } from "../interaction/VoxelCameraController";
import { VoxelCollisionSystem } from "../interaction/VoxelCollisionSystem";
import { VoxelBlockType } from "../core/VoxelBlock";
import { VoxelWorldMode } from "../core/VoxelWorldConfig";
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

        console.log('[VoxelInteractionExample] 体素交互系统初始化完成');
        console.log('键位控制:');
        console.log('  WASD: 移动');
        console.log('  F: 切换步行/飞行模式');
        console.log('  1-6: 切换方块类型');
        console.log('  R: 切换渲染模式');
        console.log('  T: 切换世界模式');
        console.log('  G: 重新生成世界');
        console.log('  I: 打印调试信息');
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
                const speedText = mode === CameraMode.FLYING ? '飞行模式 (20 units/s)' : '步行模式 (5 units/s)';
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
                this.setBlockType(VoxelBlockType.WATER);
                break;
            case KeyCode.KEY_R:
                this.toggleRenderMode();
                break;
            case KeyCode.KEY_T:
                this.toggleWorldMode();
                break;
            case KeyCode.KEY_G:
                this.regenerateWorld();
                break;
            case KeyCode.KEY_I:
                this.printDebugInfo();
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
        this.voxelRenderer.debugPrintInteractionInfo();
        
        // 节点层级结构
        this.voxelRenderer.debugPrintNodeHierarchy();
        
        // 网格信息
        this.voxelRenderer.debugPrintMeshInfo();
        
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
}