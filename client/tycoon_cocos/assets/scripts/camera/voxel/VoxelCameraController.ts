import { _decorator, Node, Vec3, EventKeyboard, KeyCode, EventMouse, Quat, Camera } from "cc";
import { VoxelCollisionSystem } from "../../voxel/interaction/VoxelCollisionSystem";
import { VoxelBlockType } from "../../voxel/core/VoxelBlock";
import { BaseCameraController } from "../BaseCameraController";
import { VoxelCameraMode, VoxelCameraConfig, DEFAULT_VOXEL_CAMERA_CONFIG } from "./VoxelCameraConfig";

const { ccclass, property } = _decorator;

@ccclass('VoxelCameraController')
export class VoxelCameraController extends BaseCameraController {

    @property({ displayName: "体素相机配置", tooltip: "体素相机的配置参数" })
    public config: VoxelCameraConfig = DEFAULT_VOXEL_CAMERA_CONFIG;

    @property({ type: VoxelCollisionSystem, displayName: "碰撞系统", tooltip: "体素碰撞检测系统" })
    public collisionSystem: VoxelCollisionSystem = null;

    // 当前模式和状态
    private _currentMode: VoxelCameraMode = VoxelCameraMode.WALKING;
    private _yaw: number = 0;
    private _pitch: number = 0;
    private _velocity: Vec3 = new Vec3();

    // 体素世界交互
    private _getBlockAt: (x: number, y: number, z: number) => VoxelBlockType = null;

    // ========================= 基类抽象方法实现 =========================

    protected onCameraStart(): void {
        this.debugLog(`体素相机启动，默认模式: ${this._currentMode}`);
    }

    protected onCameraEnable(): void {
        this.debugLog('体素相机已启用');
    }

    protected onCameraDisable(): void {
        this.debugLog('体素相机已禁用');
    }

    protected onCameraUpdate(deltaTime: number): void {
        this._handleMovement(deltaTime);
        this._updateCameraRotation();
    }

    protected onCameraDestroy(): void {
        this.debugLog('体素相机已销毁');
    }

    protected onResetToDefault(): void {
        this._currentMode = VoxelCameraMode.WALKING;
        this._yaw = 0;
        this._pitch = 0;
        this._velocity.set(0, 0, 0);
        this.debugLog('体素相机已重置为默认状态');
    }

    // ========================= 公共接口方法 =========================

    /**
     * 设置方块查询函数
     */
    public setBlockQueryFunction(getBlockAt: (x: number, y: number, z: number) => VoxelBlockType): void {
        this._getBlockAt = getBlockAt;
    }

    /**
     * 切换相机模式
     */
    public toggleMode(): void {
        this._currentMode = this._currentMode === VoxelCameraMode.WALKING ? VoxelCameraMode.FLYING : VoxelCameraMode.WALKING;
        this.debugLog(`切换体素相机模式: ${this._currentMode}`);
    }

    /**
     * 设置相机模式
     */
    public setMode(mode: VoxelCameraMode): void {
        if (this._currentMode !== mode) {
            this._currentMode = mode;
            this.debugLog(`设置体素相机模式: ${mode}`);
        }
    }

    /**
     * 获取当前相机模式
     */
    public getCurrentMode(): VoxelCameraMode {
        return this._currentMode;
    }

    // ========================= 私有方法 =========================

    /**
     * 处理移动逻辑
     */
    private _handleMovement(deltaTime: number): void {
        const speed = this._currentMode === VoxelCameraMode.FLYING 
            ? this.config.movement.flySpeed 
            : this.config.movement.walkSpeed;
        
        const velocity = new Vec3(0, 0, 0);

        const forward = this.getCameraForward();
        const right = this.getCameraRight();
        const up = new Vec3(0, 1, 0);

        if (this.isKeyPressed(KeyCode.KEY_W)) {
            if (this._currentMode === VoxelCameraMode.FLYING) {
                velocity.add(forward);
            } else {
                const horizontalForward = new Vec3(forward.x, 0, forward.z).normalize();
                velocity.add(horizontalForward);
            }
        }
        if (this.isKeyPressed(KeyCode.KEY_S)) {
            if (this._currentMode === VoxelCameraMode.FLYING) {
                velocity.subtract(forward);
            } else {
                const horizontalForward = new Vec3(forward.x, 0, forward.z).normalize();
                velocity.subtract(horizontalForward);
            }
        }
        if (this.isKeyPressed(KeyCode.KEY_A)) {
            velocity.subtract(right);
        }
        if (this.isKeyPressed(KeyCode.KEY_D)) {
            velocity.add(right);
        }

        if (this._currentMode === VoxelCameraMode.FLYING) {
            if (this.isKeyPressed(KeyCode.SPACE)) {
                velocity.add(up);
            }
            if (this.isKeyPressed(KeyCode.SHIFT_LEFT)) {
                velocity.subtract(up);
            }
        }

        if (velocity.length() > 0) {
            velocity.normalize();
            const movement = velocity.multiplyScalar(speed * deltaTime);
            this._moveWithCollision(movement);
        }
    }

    private _moveWithCollision(movement: Vec3): void {
        const currentPos = this.node.getWorldPosition();
        const newPos = currentPos.clone().add(movement);

        if (this.currentMode === CameraMode.WALKING && this.collisionSystem && this.getBlockAt) {
            if (!this.collisionSystem.checkCollision(newPos, this.getBlockAt)) {
                this.node.setWorldPosition(newPos);
            } else {
                const separateMovement = this._trySeparateAxisMovement(currentPos, movement);
                if (separateMovement) {
                    this.node.setWorldPosition(separateMovement);
                }
            }
        } else {
            this.node.setWorldPosition(newPos);
        }
    }

    private _trySeparateAxisMovement(currentPos: Vec3, movement: Vec3): Vec3 | null {
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
        const yawQuat = Quat.fromAxisAngle(new Quat(), Vec3.UP, this._yaw * Math.PI / 180);
        const pitchQuat = Quat.fromAxisAngle(new Quat(), Vec3.RIGHT, this._pitch * Math.PI / 180);
        const finalRotation = yawQuat.clone();
        Quat.multiply(finalRotation, finalRotation, pitchQuat);
        
        this.node.setRotation(finalRotation);
    }

    private onKeyDown(event: EventKeyboard): void {
        this._keyStates.set(event.keyCode, true);
        
        if (event.keyCode === KeyCode.KEY_F) {
            this.toggleMode();
        }
    }

    private onKeyUp(event: EventKeyboard): void {
        this._keyStates.set(event.keyCode, false);
    }

    private onMouseDown(event: EventMouse): void {
        if (event.getButton() === EventMouse.BUTTON_LEFT) {
            this._isMouseDown = true;
            this._lastMousePos = new Vec3(event.getLocationX(), event.getLocationY(), 0);
        }
    }

    private onMouseUp(event: EventMouse): void {
        if (event.getButton() === EventMouse.BUTTON_LEFT) {
            this._isMouseDown = false;
        }
    }

    private onMouseMove(event: EventMouse): void {
        if (!this._isMouseDown) return;

        const currentPos = new Vec3(event.getLocationX(), event.getLocationY(), 0);
        const deltaPos = currentPos.subtract(this._lastMousePos);

        this._yaw -= deltaPos.x * this.config.view.mouseSensitivity;
        this._pitch += deltaPos.y * this.config.view.mouseSensitivity;
        
        this._pitch = Math.max(this.config.view.minPitchAngle, Math.min(this.config.view.maxPitchAngle, this._pitch));
        
        this._lastMousePos = currentPos;
    }
}