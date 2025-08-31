import { _decorator, Component, Node, Vec3, Camera, input, Input, EventMouse } from "cc";
import { VoxelRayCaster, VoxelHitResult } from "./VoxelRayCaster";
import { VoxelCameraController, CameraMode } from "./VoxelCameraController";
import { VoxelCollisionSystem } from "./VoxelCollisionSystem";
import { VoxelWorldManager } from "../world/VoxelWorld";
import { VoxelBlockType } from "../core/VoxelBlock";

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
    maxRaycastDistance: number = 8.0;

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

    public performRaycast(): VoxelHitResult {
        if (!this.camera || !this.worldManager) {
            return { hit: false };
        }

        const cameraPos = this.camera.node.getWorldPosition();
        const cameraRot = this.camera.node.getWorldRotation();
        
        const forward = new Vec3(0, 0, -1);
        Vec3.transformQuat(forward, forward, cameraRot);

        return this.rayCaster.raycastBlocks(
            cameraPos,
            forward,
            this.maxRaycastDistance,
            (x, y, z) => this.worldManager.getBlock(x, y, z)
        );
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
        const hitResult = this.performRaycast();
        
        if (hitResult.hit && hitResult.position) {
            if (event.getButton() === EventMouse.BUTTON_LEFT) {
                this.breakBlock(hitResult.position);
            } else if (event.getButton() === EventMouse.BUTTON_RIGHT) {
                const placePosition = this.calculatePlacePosition(hitResult);
                if (placePosition) {
                    this.placeBlock(placePosition);
                }
            }
            
            if (this.events.onBlockClick) {
                this.events.onBlockClick(hitResult);
            }
        }
    }

    private onMouseMove(event: EventMouse): void {
        const hitResult = this.performRaycast();
        
        if (this.hasHoverChanged(hitResult)) {
            this.lastHoverResult = hitResult.hit ? hitResult : null;
            
            if (this.events.onBlockHover) {
                this.events.onBlockHover(this.lastHoverResult);
            }
        }
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