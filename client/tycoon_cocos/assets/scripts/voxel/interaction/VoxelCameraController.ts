import { _decorator, Component, Node, Vec3, input, Input, EventKeyboard, KeyCode, EventMouse, Quat, Camera } from "cc";
import { VoxelCollisionSystem } from "./VoxelCollisionSystem";
import { VoxelBlockType } from "../core/VoxelBlock";

const { ccclass, property } = _decorator;

export enum CameraMode {
    WALKING = "walking",
    FLYING = "flying"
}

@ccclass('VoxelCameraController')
export class VoxelCameraController extends Component {

    @property
    walkSpeed: number = 5.0;

    @property
    flySpeed: number = 20.0;

    @property
    mouseSensitivity: number = 0.1;

    @property
    maxPitchAngle: number = 80;

    @property({ type: Camera })
    camera: Camera = null;

    @property({ type: VoxelCollisionSystem })
    collisionSystem: VoxelCollisionSystem = null;

    private currentMode: CameraMode = CameraMode.WALKING;
    private keyStates: Map<KeyCode, boolean> = new Map();
    
    private yaw: number = 0;
    private pitch: number = 0;
    private lastMousePos: Vec3 = new Vec3();
    private isMouseDown: boolean = false;

    private getBlockAt: (x: number, y: number, z: number) => VoxelBlockType = null;

    protected onLoad() {
        if (!this.camera) {
            this.camera = this.getComponent(Camera);
        }
    }

    protected onEnable() {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    }

    protected onDisable() {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    }

    protected update(deltaTime: number) {
        this.handleMovement(deltaTime);
        this.updateCameraRotation();
    }

    public setBlockQueryFunction(getBlockAt: (x: number, y: number, z: number) => VoxelBlockType) {
        this.getBlockAt = getBlockAt;
    }

    public toggleMode(): void {
        this.currentMode = this.currentMode === CameraMode.WALKING ? CameraMode.FLYING : CameraMode.WALKING;
    }

    public setMode(mode: CameraMode): void {
        this.currentMode = mode;
    }

    public getCurrentMode(): CameraMode {
        return this.currentMode;
    }

    private handleMovement(deltaTime: number): void {
        const speed = this.currentMode === CameraMode.FLYING ? this.flySpeed : this.walkSpeed;
        const velocity = new Vec3(0, 0, 0);

        const forward = this.getCameraForward();
        const right = this.getCameraRight();
        const up = new Vec3(0, 1, 0);

        if (this.keyStates.get(KeyCode.KEY_W)) {
            if (this.currentMode === CameraMode.FLYING) {
                velocity.add(forward);
            } else {
                const horizontalForward = new Vec3(forward.x, 0, forward.z).normalize();
                velocity.add(horizontalForward);
            }
        }
        if (this.keyStates.get(KeyCode.KEY_S)) {
            if (this.currentMode === CameraMode.FLYING) {
                velocity.subtract(forward);
            } else {
                const horizontalForward = new Vec3(forward.x, 0, forward.z).normalize();
                velocity.subtract(horizontalForward);
            }
        }
        if (this.keyStates.get(KeyCode.KEY_A)) {
            velocity.subtract(right);
        }
        if (this.keyStates.get(KeyCode.KEY_D)) {
            velocity.add(right);
        }

        if (this.currentMode === CameraMode.FLYING) {
            if (this.keyStates.get(KeyCode.SPACE)) {
                velocity.add(up);
            }
            if (this.keyStates.get(KeyCode.SHIFT_LEFT)) {
                velocity.subtract(up);
            }
        }

        if (velocity.length() > 0) {
            velocity.normalize();
            const movement = velocity.multiplyScalar(speed * deltaTime);
            this.moveWithCollision(movement);
        }
    }

    private moveWithCollision(movement: Vec3): void {
        const currentPos = this.node.getWorldPosition();
        const newPos = currentPos.clone().add(movement);

        if (this.currentMode === CameraMode.WALKING && this.collisionSystem && this.getBlockAt) {
            if (!this.collisionSystem.checkCollision(newPos, this.getBlockAt)) {
                this.node.setWorldPosition(newPos);
            } else {
                const separateMovement = this.trySeparateAxisMovement(currentPos, movement);
                if (separateMovement) {
                    this.node.setWorldPosition(separateMovement);
                }
            }
        } else {
            this.node.setWorldPosition(newPos);
        }
    }

    private trySeparateAxisMovement(currentPos: Vec3, movement: Vec3): Vec3 | null {
        const xMovement = new Vec3(movement.x, 0, 0);
        const yMovement = new Vec3(0, movement.y, 0);
        const zMovement = new Vec3(0, 0, movement.z);

        const movements = [xMovement, yMovement, zMovement];
        let finalPos = currentPos.clone();

        for (const mov of movements) {
            if (mov.length() > 0) {
                const testPos = finalPos.clone().add(mov);
                if (!this.collisionSystem.checkCollision(testPos, this.getBlockAt)) {
                    finalPos.add(mov);
                }
            }
        }

        return finalPos.equals(currentPos) ? null : finalPos;
    }

    private getCameraForward(): Vec3 {
        const rotation = this.node.getRotation();
        const forward = new Vec3(0, 0, -1);
        Vec3.transformQuat(forward, forward, rotation);
        return forward;
    }

    private getCameraRight(): Vec3 {
        const rotation = this.node.getRotation();
        const right = new Vec3(1, 0, 0);
        Vec3.transformQuat(right, right, rotation);
        return right;
    }

    private updateCameraRotation(): void {
        const yawQuat = Quat.fromAxisAngle(new Quat(), Vec3.UP, this.yaw * Math.PI / 180);
        const pitchQuat = Quat.fromAxisAngle(new Quat(), Vec3.RIGHT, this.pitch * Math.PI / 180);
        const finalRotation = yawQuat.clone();
        Quat.multiply(finalRotation, finalRotation, pitchQuat);
        
        this.node.setRotation(finalRotation);
    }

    private onKeyDown(event: EventKeyboard): void {
        this.keyStates.set(event.keyCode, true);
        
        if (event.keyCode === KeyCode.KEY_F) {
            this.toggleMode();
        }
    }

    private onKeyUp(event: EventKeyboard): void {
        this.keyStates.set(event.keyCode, false);
    }

    private onMouseDown(event: EventMouse): void {
        if (event.getButton() === EventMouse.BUTTON_LEFT) {
            this.isMouseDown = true;
            this.lastMousePos = new Vec3(event.getLocationX(), event.getLocationY(), 0);
        }
    }

    private onMouseUp(event: EventMouse): void {
        if (event.getButton() === EventMouse.BUTTON_LEFT) {
            this.isMouseDown = false;
        }
    }

    private onMouseMove(event: EventMouse): void {
        if (!this.isMouseDown) return;

        const currentPos = new Vec3(event.getLocationX(), event.getLocationY(), 0);
        const deltaPos = currentPos.subtract(this.lastMousePos);

        this.yaw -= deltaPos.x * this.mouseSensitivity;
        this.pitch += deltaPos.y * this.mouseSensitivity;
        
        this.pitch = Math.max(-this.maxPitchAngle, Math.min(this.maxPitchAngle, this.pitch));
        
        this.lastMousePos = currentPos;
    }
}