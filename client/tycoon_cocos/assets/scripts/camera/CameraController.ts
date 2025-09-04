/**
 * 相机控制器
 * 
 * 统一管理游戏中的主相机，提供多种相机模式和平滑过渡
 * 支持等距视角、俯视视角、第三人称跟随等常见游戏视角
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Camera, Node, Vec3, Quat, director, find, EventKeyboard, KeyCode, EventMouse, input, Input, tween, Tween } from 'cc';
import { CameraMode, CameraConfig, CameraState, DEFAULT_CAMERA_CONFIG, TransitionConfig } from './CameraConfig';
import { BaseCameraController } from './BaseCameraController';
import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';

const { ccclass, property } = _decorator;

/**
 * 主相机控制器组件
 * 单例模式，提供全局相机访问和控制功能
 */
@ccclass('CameraController')
export class CameraController extends BaseCameraController {
    
    @property({ displayName: "相机配置", tooltip: "相机各种模式的配置参数" })
    public config: CameraConfig = DEFAULT_CAMERA_CONFIG;

    @property({ displayName: "自动查找相机", tooltip: "是否自动查找Main Camera节点" })
    public autoFindCamera: boolean = true;

    @property({ type: Node, displayName: "跟随目标", tooltip: "第三人称模式的跟随目标" })
    public followTarget: Node | null = null;

    // 单例实例
    private static _instance: CameraController | null = null;

    // 当前状态
    private _currentMode: CameraMode = CameraMode.ISOMETRIC;
    private _targetPosition: Vec3 = new Vec3();
    private _targetRotation: Quat = new Quat();
    private _isTransitioning: boolean = false;

    // 当前跟随目标中心点（用于非跟随模式）
    private _lookAtTarget: Vec3 = new Vec3(0, 0, 0);

    // Tween引用，用于相机动画
    private _positionTween: Tween<Vec3> | null = null;
    private _rotationTween: Tween<Quat> | null = null;

    /**
     * 获取单例实例
     */
    public static getInstance(): CameraController | null {
        return CameraController._instance;
    }

    /**
     * 获取主相机实例 - 这是其他代码应该使用的统一方法
     */
    public static getMainCamera(): Camera | null {
        const instance = CameraController.getInstance();
        return instance ? instance.getMainCamera() : null;
    }

    protected onLoad(): void {
        // 设置单例
        if (CameraController._instance === null) {
            CameraController._instance = this;
            director.addPersistRootNode(this.node);
        } else {
            console.warn('[CameraController] 多个CameraController实例，销毁重复实例');
            this.destroy();
            return;
        }

        // 调用基类onLoad
        super.onLoad();
    }

    // ========================= 基类抽象方法实现 =========================

    protected onCameraStart(): void {
        // 设置默认视角
        this.setMode(CameraMode.ISOMETRIC);
        
        // 注册事件监听
        this._setupEventListeners();
        
        this.debugLog(`已设置为默认模式: ${this._currentMode}`);
    }

    protected onCameraEnable(): void {
        // 相机启用时的逻辑
        this.debugLog('主相机控制器已启用');
    }

    protected onCameraDisable(): void {
        // 相机禁用时的逻辑  
        this.debugLog('主相机控制器已禁用');
    }

    protected onCameraUpdate(deltaTime: number): void {
        if (!this.camera) return;

        // 处理相机跟随逻辑
        this._updateCameraFollow(deltaTime);
        
        // 处理输入控制
        if (this.enableInputControl) {
            this._handleInput(deltaTime);
        }

        // 更新调试信息
        if (this.config.debugMode) {
            this._updateDebugInfo();
        }
    }

    protected onCameraDestroy(): void {
        if (CameraController._instance === this) {
            CameraController._instance = null;
        }

        // 停止所有动画
        this._stopAllTweens();

        // 移除事件监听
        this._removeEventListeners();
    }

    protected onResetToDefault(): void {
        this.setMode(CameraMode.ISOMETRIC, true);
        this._lookAtTarget.set(0, 0, 0);
        this._stopAllTweens();
    }

    // ========================= 公共接口方法 =========================

    /**
     * 获取主相机组件 - 重写基类方法
     */
    public getCamera(): Camera | null {
        return this.camera;
    }

    /**
     * 获取主相机组件 - 保持向后兼容
     */
    public getMainCamera(): Camera | null {
        return this.camera;
    }

    /**
     * 设置相机模式
     */
    public setMode(mode: CameraMode, immediate: boolean = false): void {
        if (this._currentMode === mode && !immediate) return;

        const oldMode = this._currentMode;
        this._currentMode = mode;

        console.log(`[CameraController] 切换相机模式: ${oldMode} -> ${mode}`);

        // 根据模式设置相机位置和角度
        this._applyModeSettings(mode, immediate);

        // 发送模式变化事件
        EventBus.emit(EventTypes.System.CameraModeChanged, {
            oldMode,
            newMode: mode
        });
    }

    /**
     * 设置跟随目标
     */
    public setTarget(target: Node | null): void {
        this.followTarget = target;
        
        if (target) {
            console.log(`[CameraController] 设置跟随目标: ${target.name}`);
            
            // 如果当前是跟随模式，立即更新位置
            if (this._currentMode === CameraMode.THIRD_PERSON_FOLLOW) {
                this._updateFollowPosition();
            }
        } else {
            console.log('[CameraController] 清除跟随目标');
        }
    }

    /**
     * 设置查看目标点（用于非跟随模式）
     */
    public lookAt(targetPosition: Vec3, immediate: boolean = false): void {
        this._lookAtTarget.set(targetPosition);

        if (immediate) {
            this._applyLookAt();
        } else {
            this._transitionToLookAt();
        }
    }

    /**
     * 平滑移动到指定位置
     */
    public moveTo(position: Vec3, duration?: number): void {
        const actualDuration = duration || this.config.transition.positionDuration;
        
        this._stopPositionTween();
        
        this._positionTween = tween(this.node.position)
            .to(actualDuration, position, {
                easing: this._getEasingFunction()
            })
            .call(() => {
                this._positionTween = null;
            })
            .start();

        this._isTransitioning = true;
    }

    /**
     * 获取当前相机状态
     */
    public getCameraState(): CameraState {
        const position = this.node.getPosition();
        const rotation = this.node.getRotation();
        const eulerAngles = new Vec3();
        rotation.getEulerAngles(eulerAngles);

        return {
            currentMode: this._currentMode,
            position: position.clone(),
            rotation: eulerAngles,
            target: this._lookAtTarget.clone(),
            isTransitioning: this._isTransitioning,
            lastUpdateTime: Date.now()
        };
    }

    /**
     * 创建默认跟随目标（测试用胶囊体）
     */
    public createDefaultTarget(): Node {
        const targetNode = new Node('CameraTarget');
        
        // 设置初始位置
        targetNode.setPosition(0, 1, 0);
        
        // 添加到场景
        const scene = director.getScene();
        if (scene) {
            scene.addChild(targetNode);
        }

        // 设置为跟随目标
        this.setTarget(targetNode);
        
        console.log('[CameraController] 创建默认跟随目标');
        return targetNode;
    }

    // ========================= 私有方法 =========================


    /**
     * 设置事件监听器
     */
    private _setupEventListeners(): void {
        if (this.enableInputControl) {
            input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
            input.on(Input.EventType.KEY_UP, this._onKeyUp, this);
            input.on(Input.EventType.MOUSE_DOWN, this._onMouseDown, this);
            input.on(Input.EventType.MOUSE_UP, this._onMouseUp, this);
            input.on(Input.EventType.MOUSE_MOVE, this._onMouseMove, this);
            input.on(Input.EventType.MOUSE_WHEEL, this._onMouseWheel, this);
        }
    }

    /**
     * 移除事件监听器
     */
    private _removeEventListeners(): void {
        if (this.enableInputControl) {
            input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
            input.off(Input.EventType.KEY_UP, this._onKeyUp, this);
            input.off(Input.EventType.MOUSE_DOWN, this._onMouseDown, this);
            input.off(Input.EventType.MOUSE_UP, this._onMouseUp, this);
            input.off(Input.EventType.MOUSE_MOVE, this._onMouseMove, this);
            input.off(Input.EventType.MOUSE_WHEEL, this._onMouseWheel, this);
        }
    }

    /**
     * 应用相机模式设置
     */
    private _applyModeSettings(mode: CameraMode, immediate: boolean): void {
        switch (mode) {
            case CameraMode.ISOMETRIC:
                this._applyIsometricMode(immediate);
                break;
            case CameraMode.TOP_DOWN:
                this._applyTopDownMode(immediate);
                break;
            case CameraMode.THIRD_PERSON_FOLLOW:
                this._applyFollowMode(immediate);
                break;
        }
    }

    /**
     * 应用等距视角模式
     */
    private _applyIsometricMode(immediate: boolean): void {
        const config = this.config.isometric;
        
        // 计算等距视角位置
        const distance = config.distance;
        const height = config.height;
        const angleRad = config.angle * Math.PI / 180;
        const yawRad = config.yawAngle * Math.PI / 180;
        
        const targetPos = new Vec3(
            this._lookAtTarget.x + Math.cos(yawRad) * distance * Math.cos(angleRad),
            this._lookAtTarget.y + height,
            this._lookAtTarget.z + Math.sin(yawRad) * distance * Math.cos(angleRad)
        );

        // 计算旋转
        const lookDirection = Vec3.subtract(new Vec3(), this._lookAtTarget, targetPos);
        lookDirection.normalize();
        
        const rotation = Quat.fromViewUp(lookDirection, Vec3.UP);

        // 设置FOV
        if (this.camera) {
            this.camera.fov = config.fov;
        }

        // 应用位置和旋转
        if (immediate) {
            this.node.setPosition(targetPos);
            this.node.setRotation(rotation);
        } else {
            this._transitionToPositionAndRotation(targetPos, rotation);
        }
    }

    /**
     * 应用俯视视角模式
     */
    private _applyTopDownMode(immediate: boolean): void {
        const config = this.config.topDown;
        
        const targetPos = new Vec3(
            this._lookAtTarget.x,
            this._lookAtTarget.y + config.height,
            this._lookAtTarget.z
        );

        // 俯视角度（向下看）
        const rotation = Quat.fromEuler(new Quat(), -90, 0, 0);

        // 设置FOV
        if (this.camera) {
            this.camera.fov = config.fov;
        }

        // 应用位置和旋转
        if (immediate) {
            this.node.setPosition(targetPos);
            this.node.setRotation(rotation);
        } else {
            this._transitionToPositionAndRotation(targetPos, rotation);
        }
    }

    /**
     * 应用第三人称跟随模式
     */
    private _applyFollowMode(immediate: boolean): void {
        if (!this.followTarget) {
            console.warn('[CameraController] 跟随模式需要设置跟随目标');
            return;
        }

        this._updateFollowPosition(immediate);
    }

    /**
     * 更新跟随位置
     */
    private _updateFollowPosition(immediate: boolean = false): void {
        if (!this.followTarget) return;

        const config = this.config.follow;
        const targetPos = this.followTarget.getWorldPosition();
        
        // 计算相机位置（在目标后方和上方）
        const targetForward = this.followTarget.forward;
        const offset = Vec3.multiplyScalar(new Vec3(), targetForward, -config.distance);
        offset.y += config.height;
        
        const cameraPos = Vec3.add(new Vec3(), targetPos, offset);
        
        // 计算前瞻点
        const lookAhead = Vec3.multiplyScalar(new Vec3(), targetForward, config.lookAheadDistance);
        const lookAtPoint = Vec3.add(new Vec3(), targetPos, lookAhead);
        
        // 计算旋转
        const lookDirection = Vec3.subtract(new Vec3(), lookAtPoint, cameraPos);
        lookDirection.normalize();
        const rotation = Quat.fromViewUp(lookDirection, Vec3.UP);

        // 应用位置和旋转
        if (immediate) {
            this.node.setPosition(cameraPos);
            this.node.setRotation(rotation);
        } else {
            // 平滑跟随
            const currentPos = this.node.getPosition();
            const lerpedPos = Vec3.lerp(new Vec3(), currentPos, cameraPos, config.smoothSpeed * 0.016);
            this.node.setPosition(lerpedPos);

            const currentRot = this.node.getRotation();
            const lerpedRot = Quat.slerp(new Quat(), currentRot, rotation, config.smoothSpeed * 0.016);
            this.node.setRotation(lerpedRot);
        }
    }

    /**
     * 更新相机跟随逻辑
     */
    private _updateCameraFollow(deltaTime: number): void {
        if (this._currentMode === CameraMode.THIRD_PERSON_FOLLOW && this.followTarget) {
            this._updateFollowPosition();
        }
    }

    /**
     * 过渡到指定位置和旋转
     */
    private _transitionToPositionAndRotation(position: Vec3, rotation: Quat): void {
        this._stopAllTweens();
        this._isTransitioning = true;

        // 位置过渡
        this._positionTween = tween(this.node.position)
            .to(this.config.transition.positionDuration, position, {
                easing: this._getEasingFunction()
            })
            .call(() => {
                this._positionTween = null;
                this._checkTransitionComplete();
            })
            .start();

        // 旋转过渡
        this._rotationTween = tween(this.node.rotation)
            .to(this.config.transition.rotationDuration, rotation, {
                easing: this._getEasingFunction()
            })
            .call(() => {
                this._rotationTween = null;
                this._checkTransitionComplete();
            })
            .start();
    }

    /**
     * 过渡到查看目标
     */
    private _transitionToLookAt(): void {
        this._applyModeSettings(this._currentMode, false);
    }

    /**
     * 立即应用查看目标
     */
    private _applyLookAt(): void {
        this._applyModeSettings(this._currentMode, true);
    }

    /**
     * 检查过渡是否完成
     */
    private _checkTransitionComplete(): void {
        if (!this._positionTween && !this._rotationTween) {
            this._isTransitioning = false;
        }
    }

    /**
     * 停止所有Tween动画
     */
    private _stopAllTweens(): void {
        this._stopPositionTween();
        this._stopRotationTween();
    }

    /**
     * 停止位置Tween
     */
    private _stopPositionTween(): void {
        if (this._positionTween) {
            this._positionTween.stop();
            this._positionTween = null;
        }
    }

    /**
     * 停止旋转Tween
     */
    private _stopRotationTween(): void {
        if (this._rotationTween) {
            this._rotationTween.stop();
            this._rotationTween = null;
        }
    }

    /**
     * 获取缓动函数
     */
    private _getEasingFunction(): string {
        return this.config.transition.easing;
    }

    // ========================= 输入处理 =========================

    /**
     * 处理输入控制
     */
    private _handleInput(deltaTime: number): void {
        // 这里可以添加额外的输入处理逻辑
        // 例如 WASD 移动目标点等
    }

    // ========================= 重写基类输入处理方法 =========================

    /**
     * 重写基类键盘按下事件
     */
    protected onKeyDown(event: EventKeyboard): void {
        // 调用基类方法处理基础功能
        super.onKeyDown(event);

        // 快捷键切换相机模式
        switch (event.keyCode) {
            case KeyCode.F1:
                this.setMode(CameraMode.ISOMETRIC);
                break;
            case KeyCode.F2:
                this.setMode(CameraMode.TOP_DOWN);
                break;
            case KeyCode.F3:
                this.setMode(CameraMode.THIRD_PERSON_FOLLOW);
                break;
            case KeyCode.F4:
                // 创建默认目标用于测试
                if (!this.followTarget) {
                    this.createDefaultTarget();
                }
                break;
        }
    }

    /**
     * 重写基类鼠标按下事件
     */
    protected onMouseDown(event: EventMouse): void {
        // 调用基类方法处理基础功能
        super.onMouseDown(event);
        
        // 右键特殊处理
        if (event.getButton() === EventMouse.BUTTON_RIGHT) {
            this.debugLog('Right mouse button pressed for camera control');
        }
    }

    /**
     * 重写基类鼠标拖拽处理
     */
    protected onMouseDrag(deltaPos: Vec3): void {
        // 右键拖拽旋转（仅在等距模式下）
        if (this._currentMode === CameraMode.ISOMETRIC && this.config.isometric.allowRotation) {
            this.config.isometric.yawAngle += deltaPos.x * this.config.isometric.rotationSpeed * 0.1;
            this._applyModeSettings(this._currentMode, true);
        }
    }

    /**
     * 鼠标滚轮事件
     */
    private _onMouseWheel(event): void {
        const scrollY = event.getScrollY();
        
        // 滚轮缩放
        if (this._currentMode === CameraMode.TOP_DOWN && this.config.topDown.allowZoom) {
            const config = this.config.topDown;
            const newHeight = config.height - scrollY * config.zoomSpeed;
            config.height = Math.max(config.minHeight, Math.min(config.maxHeight, newHeight));
            this._applyModeSettings(this._currentMode, true);
        }
    }

    // ========================= 调试功能 =========================

    /**
     * 更新调试信息
     */
    private _updateDebugInfo(): void {
        // 这里可以显示调试UI，暂时用控制台输出
        // 实际项目中可以集成到调试面板中
    }
}

/**
 * 全局CameraController访问器
 */
export const cameraController = {
    get instance(): CameraController | null {
        return CameraController.getInstance();
    },
    
    getMainCamera(): Camera | null {
        return CameraController.getMainCamera();
    }
};