/**
 * 基础相机控制器
 * 
 * 提供相机控制的通用功能和接口规范
 * 其他具体的相机控制器应继承此基类
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component, Camera, Node, Vec3, input, Input, EventKeyboard, KeyCode, EventMouse, find } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 基础相机控制器状态接口
 */
export interface BaseCameraState {
    /** 是否启用 */
    enabled: boolean;
    /** 当前位置 */
    position: Vec3;
    /** 当前旋转角度(欧拉角) */
    rotation: Vec3;
    /** 最后更新时间 */
    lastUpdateTime: number;
}

/**
 * 相机控制器基础接口
 */
export interface ICameraController {
    /** 获取相机组件 */
    getCamera(): Camera | null;
    /** 设置相机启用状态 */
    setEnabled(enabled: boolean): void;
    /** 获取相机状态 */
    getCameraState(): BaseCameraState;
    /** 重置相机到默认状态 */
    resetToDefault(): void;
}

/**
 * 基础相机控制器抽象类
 */
@ccclass('BaseCameraController')
export abstract class BaseCameraController extends Component implements ICameraController {

    @property({ displayName: "启用输入控制", tooltip: "是否启用键盘和鼠标输入" })
    public enableInputControl: boolean = true;

    @property({ displayName: "启用调试模式", tooltip: "是否输出调试信息" })
    public debugMode: boolean = false;

    @property({ type: Camera, displayName: "相机组件", tooltip: "相机组件引用" })
    public camera: Camera | null = null;

    // 输入状态管理
    protected _keyStates: Map<KeyCode, boolean> = new Map();
    protected _mouseDown: boolean = false;
    protected _lastMousePosition: Vec3 = new Vec3();

    // 相机状态
    protected _isEnabled: boolean = true;

    protected onLoad(): void {
        this._setupCamera();
        this._setupInput();
        this.debugLog('BaseCameraController onLoad');
    }

    protected start(): void {
        this.onCameraStart();
    }

    protected onEnable(): void {
        if (this.enableInputControl) {
            this._registerInputEvents();
        }
        this.onCameraEnable();
    }

    protected onDisable(): void {
        if (this.enableInputControl) {
            this._unregisterInputEvents();
        }
        this.onCameraDisable();
    }

    protected onDestroy(): void {
        this._unregisterInputEvents();
        this.onCameraDestroy();
    }

    protected update(deltaTime: number): void {
        if (this._isEnabled) {
            this.onCameraUpdate(deltaTime);
        }
    }

    // ==================== 公共接口实现 ====================

    /**
     * 获取相机组件
     */
    public getCamera(): Camera | null {
        return this.camera;
    }

    /**
     * 设置相机启用状态
     */
    public setEnabled(enabled: boolean): void {
        this._isEnabled = enabled;
        
        if (enabled) {
            this.onCameraEnable();
        } else {
            this.onCameraDisable();
        }
    }

    /**
     * 获取相机状态
     */
    public getCameraState(): BaseCameraState {
        const position = this.node.getPosition();
        const rotation = this.node.getRotation();
        const eulerAngles = new Vec3();
        rotation.getEulerAngles(eulerAngles);

        return {
            enabled: this._isEnabled,
            position: position.clone(),
            rotation: eulerAngles,
            lastUpdateTime: Date.now()
        };
    }

    /**
     * 重置相机到默认状态
     */
    public resetToDefault(): void {
        this.onResetToDefault();
    }

    // ==================== 子类需要实现的抽象方法 ====================

    /**
     * 相机启动时调用
     */
    protected abstract onCameraStart(): void;

    /**
     * 相机启用时调用
     */
    protected abstract onCameraEnable(): void;

    /**
     * 相机禁用时调用
     */
    protected abstract onCameraDisable(): void;

    /**
     * 相机销毁时调用
     */
    protected abstract onCameraDestroy(): void;

    /**
     * 相机更新时调用
     */
    protected abstract onCameraUpdate(deltaTime: number): void;

    /**
     * 重置到默认状态时调用
     */
    protected abstract onResetToDefault(): void;

    // ==================== 子类可以重写的虚拟方法 ====================

    /**
     * 处理键盘按下事件
     */
    protected onKeyDown(event: EventKeyboard): void {
        this._keyStates.set(event.keyCode, true);
        this.debugLog(`Key down: ${event.keyCode}`);
    }

    /**
     * 处理键盘抬起事件
     */
    protected onKeyUp(event: EventKeyboard): void {
        this._keyStates.set(event.keyCode, false);
        this.debugLog(`Key up: ${event.keyCode}`);
    }

    /**
     * 处理鼠标按下事件
     */
    protected onMouseDown(event: EventMouse): void {
        this._mouseDown = true;
        this._lastMousePosition.set(event.getLocationX(), event.getLocationY(), 0);
        this.debugLog(`Mouse down: ${event.getButton()}`);
    }

    /**
     * 处理鼠标抬起事件
     */
    protected onMouseUp(event: EventMouse): void {
        this._mouseDown = false;
        this.debugLog(`Mouse up: ${event.getButton()}`);
    }

    /**
     * 处理鼠标移动事件
     */
    protected onMouseMove(event: EventMouse): void {
        if (this._mouseDown) {
            const currentPos = new Vec3(event.getLocationX(), event.getLocationY(), 0);
            const deltaPos = Vec3.subtract(new Vec3(), currentPos, this._lastMousePosition);
            this._lastMousePosition.set(currentPos);
            
            this.onMouseDrag(deltaPos);
        }
    }

    /**
     * 处理鼠标拖拽
     */
    protected onMouseDrag(deltaPos: Vec3): void {
        // 子类可以重写此方法
    }

    /**
     * 处理鼠标滚轮事件
     */
    protected onMouseWheel(event): void {
        // 子类可以重写此方法
    }

    // ==================== 受保护的工具方法 ====================

    /**
     * 检查按键是否按下
     */
    protected isKeyPressed(keyCode: KeyCode): boolean {
        return this._keyStates.get(keyCode) || false;
    }

    /**
     * 调试日志输出
     */
    protected debugLog(message: string): void {
        if (this.debugMode) {
            console.log(`[${this.constructor.name}] ${message}`);
        }
    }

    /**
     * 计算相机前方向量
     */
    protected getCameraForward(): Vec3 {
        const rotation = this.node.getRotation();
        const forward = new Vec3(0, 0, -1);
        Vec3.transformQuat(forward, forward, rotation);
        return forward;
    }

    /**
     * 计算相机右方向量
     */
    protected getCameraRight(): Vec3 {
        const rotation = this.node.getRotation();
        const right = new Vec3(1, 0, 0);
        Vec3.transformQuat(right, right, rotation);
        return right;
    }

    /**
     * 计算相机上方向量
     */
    protected getCameraUp(): Vec3 {
        const rotation = this.node.getRotation();
        const up = new Vec3(0, 1, 0);
        Vec3.transformQuat(up, up, rotation);
        return up;
    }

    // ==================== 私有方法 ====================

    /**
     * 设置相机
     */
    private _setupCamera(): void {
        if (!this.camera) {
            // 尝试从当前组件获取
            this.camera = this.getComponent(Camera);
            
            // 如果还没有，尝试从场景中查找Camera组件
            if (!this.camera) {
                const mainCameraNode = find('Main Camera') || find('MainCamera') || find('Camera');
                if (mainCameraNode) {
                    this.camera = mainCameraNode.getComponent(Camera);
                }
            }
        }

        if (!this.camera) {
            console.warn(`[${this.constructor.name}] 无法找到Camera组件`);
        }
    }

    /**
     * 设置输入系统
     */
    private _setupInput(): void {
        if (this.enableInputControl) {
            this.debugLog('Input control enabled');
        }
    }

    /**
     * 注册输入事件
     */
    private _registerInputEvents(): void {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
    }

    /**
     * 取消注册输入事件
     */
    private _unregisterInputEvents(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.off(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
    }
}