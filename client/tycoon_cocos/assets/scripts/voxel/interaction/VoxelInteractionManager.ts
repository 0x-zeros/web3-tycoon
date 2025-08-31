import { _decorator, Component, Node, Vec3, Camera, input, Input, EventMouse } from "cc";
import { VoxelRayCaster, VoxelHitResult } from "./VoxelRayCaster";
import { VoxelCameraController, CameraMode } from "./VoxelCameraController";
import { VoxelCollisionSystem } from "./VoxelCollisionSystem";
import { VoxelWorldManager } from "../world/VoxelWorld";
import { VoxelBlockType } from "../core/VoxelBlock";
import { VoxelWorldConfig, VoxelWorldMode } from "../core/VoxelWorldConfig";

const { ccclass, property } = _decorator;

export interface VoxelInteractionEvents {
    onBlockClick?: (hitResult: VoxelHitResult) => void;
    onBlockHover?: (hitResult: VoxelHitResult | null) => void;
    onBlockPlace?: (position: Vec3, blockType: VoxelBlockType) => void;
    onBlockBreak?: (position: Vec3) => void;
    onModeChange?: (mode: CameraMode) => void;
}

@ccclass('VoxelInteractionManager')
export class VoxelInteractionManager extends Component {

    @property({ type: Camera })
    camera: Camera = null;

    @property({ type: VoxelCameraController })
    cameraController: VoxelCameraController = null;

    @property({ type: VoxelCollisionSystem })
    collisionSystem: VoxelCollisionSystem = null;

    @property
    maxRaycastDistance: number = 64.0;//8.0;

    @property
    selectedBlockType: VoxelBlockType = VoxelBlockType.STONE;

    private rayCaster: VoxelRayCaster = new VoxelRayCaster();
    private worldManager: VoxelWorldManager = null;
    private events: VoxelInteractionEvents = {};
    
    private lastHoverResult: VoxelHitResult | null = null;

    protected onLoad() {
        if (!this.camera) {
            this.camera = this.getComponent(Camera) || this.getComponentInChildren(Camera);
        }
        
        if (!this.cameraController) {
            this.cameraController = this.getComponent(VoxelCameraController);
        }
        
        if (!this.collisionSystem) {
            this.collisionSystem = this.getComponent(VoxelCollisionSystem);
        }
    }

    protected onEnable() {
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    }

    protected onDisable() {
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    }

    public initialize(worldManager: VoxelWorldManager, events?: VoxelInteractionEvents): void {
        this.worldManager = worldManager;
        this.events = events || {};
        
        if (this.cameraController) {
            this.cameraController.setBlockQueryFunction((x, y, z) => 
                this.worldManager.getBlock(x, y, z)
            );
        }
    }

    public setSelectedBlockType(blockType: VoxelBlockType): void {
        this.selectedBlockType = blockType;
    }

    public getSelectedBlockType(): VoxelBlockType {
        return this.selectedBlockType;
    }

    public getCameraController(): VoxelCameraController {
        return this.cameraController;
    }

    public getCollisionSystem(): VoxelCollisionSystem {
        return this.collisionSystem;
    }

    public performRaycast(mouseX?: number, mouseY?: number): VoxelHitResult {
        if (!this.camera || !this.worldManager) {
            console.warn('[VoxelRaycast] 摄像机或世界管理器未设置');
            return { hit: false };
        }

        let rayOrigin: Vec3;
        let rayDirection: Vec3;

        if (mouseX !== undefined && mouseY !== undefined) {
            // 使用鼠标位置计算射线（正确的Cocos Creator方式）
            const ray = this.camera.screenPointToRay(mouseX, mouseY);
            rayOrigin = ray.o;
            rayDirection = ray.d.clone().normalize();
            
            console.log(`[VoxelRaycast] 鼠标射线投射:`);
            console.log(`  鼠标位置: (${mouseX}, ${mouseY})`);
        } else {
            // 兜底：使用摄像机中心射线
            const cameraPos = this.camera.node.getWorldPosition();
            const cameraRot = this.camera.node.getWorldRotation();
            
            rayOrigin = cameraPos;
            rayDirection = new Vec3(0, 0, -1);
            Vec3.transformQuat(rayDirection, rayDirection, cameraRot);
            
            console.log(`[VoxelRaycast] 摄像机中心射线:`);
        }

        console.log(`  起点: (${rayOrigin.x.toFixed(2)}, ${rayOrigin.y.toFixed(2)}, ${rayOrigin.z.toFixed(2)})`);
        console.log(`  方向: (${rayDirection.x.toFixed(2)}, ${rayDirection.y.toFixed(2)}, ${rayDirection.z.toFixed(2)})`);
        console.log(`  最大距离: ${this.maxRaycastDistance}`);

        // 动态放大：确保至少能触达 y=0（SMALL_FLAT 地面），封顶 128，避免无谓超远遍历
        let castDistance = this.maxRaycastDistance;
        if (rayDirection.y < 0) {
            const toY0 = (rayOrigin.y - 0) / -rayDirection.y;
            if (Number.isFinite(toY0) && toY0 > castDistance) {
                castDistance = Math.min(128, toY0 + 2); // 留点冗余
            }
        }
        console.log(`  实际投射距离: ${castDistance.toFixed(2)}`);

        // 检查射线前方几个位置
        for (let dist = 1; dist <= 5; dist++) {
            const checkPos = rayOrigin.clone().add(rayDirection.clone().multiplyScalar(dist));
            const blockPos = new Vec3(Math.floor(checkPos.x), Math.floor(checkPos.y), Math.floor(checkPos.z));
            const blockType = this.worldManager.getBlock(blockPos.x, blockPos.y, blockPos.z);
            console.log(`[VoxelRaycast] 距离${dist} 方块 (${blockPos.x}, ${blockPos.y}, ${blockPos.z}): ${blockType}`);
        }

        const result = this.rayCaster.raycastBlocks(
            rayOrigin,
            rayDirection,
            castDistance,
            (x, y, z) => {
                const blockType = this.worldManager.getBlock(x, y, z);
                if (blockType !== VoxelBlockType.EMPTY) {
                    console.log(`[VoxelRaycast] 检查方块 (${x}, ${y}, ${z}): ${blockType}`);
                }
                return blockType;
            }
        );

        console.log(`[VoxelRaycast] 射线投射结果: hit=${result.hit}`, result.hit ? `pos=(${result.position.x}, ${result.position.y}, ${result.position.z})` : '');
        
        return result;
    }

    public placeBlock(position: Vec3, blockType?: VoxelBlockType): boolean {
        if (!this.worldManager) return false;
        
        const type = blockType || this.selectedBlockType;
        const success = this.worldManager.setBlock(position.x, position.y, position.z, type);
        
        if (success && this.events.onBlockPlace) {
            this.events.onBlockPlace(position, type);
        }
        
        return success;
    }

    public breakBlock(position: Vec3): boolean {
        if (!this.worldManager) return false;
        
        const success = this.worldManager.setBlock(position.x, position.y, position.z, VoxelBlockType.EMPTY);
        
        if (success && this.events.onBlockBreak) {
            this.events.onBlockBreak(position);
        }
        
        return success;
    }

    private onMouseDown(event: EventMouse): void {
        const buttonName = event.getButton() === EventMouse.BUTTON_LEFT ? '左键' : 
                          event.getButton() === EventMouse.BUTTON_RIGHT ? '右键' : 
                          `按键${event.getButton()}`;
        
        console.log(`[VoxelInteraction] 鼠标点击: ${buttonName}`);
        
        if (!this.camera) {
            console.warn('[VoxelInteraction] 摄像机未设置，无法进行射线投射');
            return;
        }
        
        if (!this.worldManager) {
            console.warn('[VoxelInteraction] 世界管理器未设置，无法进行方块操作');
            return;
        }
        
        const mouseX = event.getLocationX();
        const mouseY = event.getLocationY();
        
        const hitResult = this.performRaycast(mouseX, mouseY);
        console.log('[VoxelInteraction] 射线投射结果:', hitResult);
        
        if (hitResult.hit && hitResult.position) {
            console.log(`[VoxelInteraction] 击中方块 位置:(${hitResult.position.x}, ${hitResult.position.y}, ${hitResult.position.z}) 类型:${hitResult.blockType}`);
            
            if (event.getButton() === EventMouse.BUTTON_LEFT) {
                console.log('[VoxelInteraction] 执行破坏方块操作');
                const success = this.breakBlock(hitResult.position);
                console.log(`[VoxelInteraction] 破坏方块结果: ${success ? '成功' : '失败'}`);
            } else if (event.getButton() === EventMouse.BUTTON_RIGHT) {
                console.log('[VoxelInteraction] 执行放置方块操作');
                const placePosition = this.calculatePlacePosition(hitResult);
                console.log(`[VoxelInteraction] 计算放置位置: ${placePosition ? `(${placePosition.x}, ${placePosition.y}, ${placePosition.z})` : '无效'}`);
                
                if (placePosition) {
                    const success = this.placeBlock(placePosition);
                    console.log(`[VoxelInteraction] 放置方块结果: ${success ? '成功' : '失败'}`);
                } else {
                    console.log('[VoxelInteraction] 无法放置方块：位置无效或被占用');
                }
            }
            
            if (this.events.onBlockClick) {
                this.events.onBlockClick(hitResult);
            }
        } else {
            console.log('[VoxelInteraction] 射线未击中任何方块');
        }
    }

    private onMouseMove(_event: EventMouse): void {
        // 暂时禁用鼠标移动时的射线投射，避免频繁的调试日志
        // 只有在点击时才进行射线测试
        
        // const hitResult = this.performRaycast();
        // 
        // if (this.hasHoverChanged(hitResult)) {
        //     this.lastHoverResult = hitResult.hit ? hitResult : null;
        //     
        //     if (this.events.onBlockHover) {
        //         this.events.onBlockHover(this.lastHoverResult);
        //     }
        // }
    }

    private hasHoverChanged(newResult: VoxelHitResult): boolean {
        if (!newResult.hit && !this.lastHoverResult) {
            return false;
        }
        
        if (!newResult.hit && this.lastHoverResult) {
            return true;
        }
        
        if (newResult.hit && !this.lastHoverResult) {
            return true;
        }
        
        if (newResult.hit && this.lastHoverResult && newResult.position && this.lastHoverResult.position) {
            return !newResult.position.equals(this.lastHoverResult.position);
        }
        
        return false;
    }

    private calculatePlacePosition(hitResult: VoxelHitResult): Vec3 | null {
        if (!hitResult.hit || !hitResult.position || !hitResult.normal) {
            return null;
        }
        
        const placePos = hitResult.position.clone().add(hitResult.normal);
        
        if (!this.worldManager) return null;
        
        const existingBlock = this.worldManager.getBlock(placePos.x, placePos.y, placePos.z);
        if (existingBlock !== VoxelBlockType.EMPTY) {
            return null;
        }
        
        if (this.collisionSystem) {
            const cameraPos = this.camera.node.getWorldPosition();
            const blockWorldPos = new Vec3(placePos.x + 0.5, placePos.y + 0.5, placePos.z + 0.5);
            
            if (this.collisionSystem.checkCollision(cameraPos, (x, y, z) => {
                if (x === placePos.x && y === placePos.y && z === placePos.z) {
                    return this.selectedBlockType;
                }
                return this.worldManager.getBlock(x, y, z);
            })) {
                return null;
            }
        }
        
        return placePos;
    }

    public setEventCallbacks(events: VoxelInteractionEvents): void {
        this.events = { ...this.events, ...events };
    }

    public getLastHoverResult(): VoxelHitResult | null {
        return this.lastHoverResult;
    }

    public toggleCameraMode(): void {
        if (this.cameraController) {
            this.cameraController.toggleMode();
            
            if (this.events.onModeChange) {
                this.events.onModeChange(this.cameraController.getCurrentMode());
            }
        }
    }

    public setCameraMode(mode: CameraMode): void {
        if (this.cameraController) {
            this.cameraController.setMode(mode);
            
            if (this.events.onModeChange) {
                this.events.onModeChange(mode);
            }
        }
    }

    public getCurrentCameraMode(): CameraMode | null {
        return this.cameraController ? this.cameraController.getCurrentMode() : null;
    }

    public getWorldManager(): VoxelWorldManager {
        return this.worldManager;
    }

    public update(deltaTime: number): void {

    }
}