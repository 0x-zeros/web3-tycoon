/**
 * 主游戏交互管理器
 * 
 * 管理主游戏（非体素）的交互逻辑，负责启用主相机控制器
 * 处理棋盘游戏、策略游戏等场景的点击、拖拽交互
 * 
 * @author Web3 Tycoon Team  
 * @version 1.0.0
 */

import { _decorator, Component, Node, input, Input, EventKeyboard, KeyCode, Vec3 } from 'cc';
import { CameraManager, CameraControllerType } from '../camera/CameraManager';
import { CameraMode } from '../camera/CameraConfig';
import { EventBus } from '../events/EventBus';
import { EventTypes, Input3DEventData } from '../events/EventTypes';

const { ccclass, property } = _decorator;

/**
 * 主游戏交互事件接口
 */
export interface GameInteractionEvents {
    onNodeClick?: (node: Node, worldPos: Vec3) => void;
    onNodeHover?: (node: Node | null, worldPos: Vec3 | null) => void;
    onBoardClick?: (boardPos: Vec3) => void;
    onCameraModeChange?: (mode: CameraMode) => void;
}

@ccclass('InteractionManager')
export class InteractionManager extends Component {

    @property({ displayName: "启用主游戏相机", tooltip: "在start时自动启用主游戏相机控制器" })
    public enableMainGameCamera: boolean = true;

    @property({ displayName: "默认相机模式", tooltip: "启动时的默认相机模式" })
    public defaultCameraMode: CameraMode = CameraMode.ISOMETRIC;

    @property({ displayName: "启用键盘快捷键", tooltip: "是否启用F1-F3切换相机模式" })
    public enableKeyboardShortcuts: boolean = true;

    @property({ displayName: "启用鼠标交互", tooltip: "是否启用鼠标点击和拖拽交互" })
    public enableMouseInteraction: boolean = true;

    @property({ displayName: "调试模式", tooltip: "显示调试信息" })
    public debugMode: boolean = false;

    // 相机管理器引用
    private _cameraManager: CameraManager | null = null;
    
    // 事件回调
    private _events: GameInteractionEvents = {};

    // 鼠标状态
    private _isMouseDown: boolean = false;
    private _lastMousePos: Vec3 = new Vec3();

    protected onLoad(): void {
        // 获取相机管理器实例
        this._cameraManager = CameraManager.getInstance();
        
        if (!this._cameraManager) {
            console.error('[InteractionManager] 无法获取CameraManager实例！请确保场景中有CameraManager组件');
            return;
        }

    }

    protected start(): void {
        // 启用主游戏相机控制器
        if (this.enableMainGameCamera && this._cameraManager) {
            const success = this._cameraManager.switchToController(CameraControllerType.MAIN_GAME);
            if (success) {
                // 设置默认相机模式
                this._cameraManager.setMainGameCameraMode(this.defaultCameraMode);
                this.debugLog(`已启用主游戏相机，模式: ${this.defaultCameraMode}`);
            } else {
                console.warn('[InteractionManager] 无法切换到主游戏相机控制器');
            }
        }

        // 设置事件监听
        this._setupEventListeners();

    }

    protected onEnable(): void {
        // 启用主游戏相机
        if (this._cameraManager) {
            const success = this._cameraManager.switchToController(CameraControllerType.MAIN_GAME);
            if (success) {
                this._cameraManager.setMainGameCameraMode(this.defaultCameraMode);
                this.debugLog(`onEnable: 已切换到主游戏相机，模式: ${this.defaultCameraMode}`);
            } else {
                console.warn('[InteractionManager] onEnable: 无法切换到主游戏相机控制器');
            }
        }
        
        // 键盘事件
        if (this.enableKeyboardShortcuts) {
            input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        }
        
        // Input3D 事件
        if (this.enableMouseInteraction) {
            EventBus.on(EventTypes.Input3D.MouseDown, this.onInput3DMouseDown, this);
            EventBus.on(EventTypes.Input3D.MouseUp, this.onInput3DMouseUp, this);
            EventBus.on(EventTypes.Input3D.MouseMove, this.onInput3DMouseMove, this);
            EventBus.on(EventTypes.Input3D.TouchStart, this.onInput3DTouchStart, this);
            EventBus.on(EventTypes.Input3D.TouchEnd, this.onInput3DTouchEnd, this);
            
        }
    }

    protected onDisable(): void {
        // 移除键盘事件
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        
        // 移除 Input3D 事件
        EventBus.off(EventTypes.Input3D.MouseDown, this.onInput3DMouseDown, this);
        EventBus.off(EventTypes.Input3D.MouseUp, this.onInput3DMouseUp, this);
        EventBus.off(EventTypes.Input3D.MouseMove, this.onInput3DMouseMove, this);
        EventBus.off(EventTypes.Input3D.TouchStart, this.onInput3DTouchStart, this);
        EventBus.off(EventTypes.Input3D.TouchEnd, this.onInput3DTouchEnd, this);
        
        // 重置状态
        this._isMouseDown = false;
        
    }

    protected onDestroy(): void {
        this._removeEventListeners();
    }

    // ========================= 公共接口方法 =========================

    /**
     * 设置事件回调
     */
    public setEventCallbacks(events: GameInteractionEvents): void {
        this._events = { ...this._events, ...events };
    }

    /**
     * 切换相机模式
     */
    public switchCameraMode(mode: CameraMode): void {
        if (!this._cameraManager) return;

        this._cameraManager.setMainGameCameraMode(mode);
        this.debugLog(`切换相机模式: ${mode}`);

        if (this._events.onCameraModeChange) {
            this._events.onCameraModeChange(mode);
        }
    }

    /**
     * 获取当前相机模式
     */
    public getCurrentCameraMode(): CameraMode | null {
        if (!this._cameraManager) return null;

        const controller = this._cameraManager.getActiveController();
        if (controller && 'getCameraState' in controller) {
            return (controller as any).getCameraState().currentMode;
        }
        return null;
    }

    /**
     * 启用主游戏相机（手动调用）
     */
    public enableMainCamera(): boolean {
        if (!this._cameraManager) return false;

        const success = this._cameraManager.switchToController(CameraControllerType.MAIN_GAME);
        if (success) {
            this._cameraManager.setMainGameCameraMode(this.defaultCameraMode);
            this.debugLog('手动启用主游戏相机成功');
        }
        return success;
    }

    // ========================= 事件处理方法 =========================

    /**
     * 键盘按键处理
     */
    private onKeyDown(event: EventKeyboard): void {
        if (!this._cameraManager) return;

        switch (event.keyCode) {
            case KeyCode.F1:
                this.switchCameraMode(CameraMode.ISOMETRIC);
                break;
            case KeyCode.F2:
                this.switchCameraMode(CameraMode.TOP_DOWN);
                break;
            case KeyCode.F3:
                this.switchCameraMode(CameraMode.THIRD_PERSON_FOLLOW);
                break;
        }
    }

    /**
     * Input3D 鼠标按下处理
     */
    private onInput3DMouseDown(eventData: Input3DEventData): void {
        this._isMouseDown = true;
        this._lastMousePos.set(eventData.screenX, eventData.screenY, 0);

        // 处理鼠标点击交互
        this._handleInput3DClick(eventData);
        
    }

    /**
     * Input3D 鼠标抬起处理
     */
    private onInput3DMouseUp(eventData: Input3DEventData): void {
        this._isMouseDown = false;
        
    }

    /**
     * Input3D 鼠标移动处理
     */
    private onInput3DMouseMove(eventData: Input3DEventData): void {
        if (!this._isMouseDown) return;

        // 处理鼠标拖拽
        this._handleInput3DDrag(eventData);
    }

    /**
     * Input3D 触摸开始处理
     */
    private onInput3DTouchStart(eventData: Input3DEventData): void {
        this._isMouseDown = true;
        this._lastMousePos.set(eventData.screenX, eventData.screenY, 0);

        // 触摸事件按鼠标点击处理
        this._handleInput3DClick(eventData);
        
    }

    /**
     * Input3D 触摸结束处理
     */
    private onInput3DTouchEnd(eventData: Input3DEventData): void {
        this._isMouseDown = false;
        
    }

    /**
     * 处理 Input3D 点击
     */
    private _handleInput3DClick(eventData: Input3DEventData): void {
        const uiX = eventData.uiX ?? eventData.screenX;
        const uiY = eventData.uiY ?? eventData.screenY;
        const worldPos = new Vec3(uiX, uiY, 0);


        // 这里可以添加射线检测逻辑，检测点击的游戏对象
        // 暂时简化处理
        if (this._events.onBoardClick) {
            this._events.onBoardClick(worldPos);
        }
    }

    /**
     * 处理 Input3D 拖拽
     */
    private _handleInput3DDrag(eventData: Input3DEventData): void {
        const currentPos = new Vec3(eventData.screenX, eventData.screenY, 0);
        const deltaPos = currentPos.subtract(this._lastMousePos);


        // 这里可以根据当前相机模式处理拖拽
        // 例如在等距视角模式下旋转相机等
        
        this._lastMousePos = currentPos;
    }

    // ========================= 事件系统方法 =========================

    /**
     * 设置事件监听器
     */
    private _setupEventListeners(): void {
        // 监听相机模式变化事件
        EventBus.on(EventTypes.System.CameraModeChanged, this._onCameraModeChanged, this);
        
        // 监听游戏状态变化事件
        EventBus.on(EventTypes.Game.GameStart, this._onGameStart, this);
    }

    /**
     * 移除事件监听器
     */
    private _removeEventListeners(): void {
        EventBus.off(EventTypes.System.CameraModeChanged, this._onCameraModeChanged, this);
        EventBus.off(EventTypes.Game.GameStart, this._onGameStart, this);
    }

    /**
     * 相机模式变化事件处理
     */
    private _onCameraModeChanged(data: { controllerType: string, controller: any }): void {
        if (data.controllerType === CameraControllerType.MAIN_GAME) {
            this.debugLog(`相机控制器切换到主游戏模式`);
        }
    }

    /**
     * 游戏开始事件处理
     */
    private _onGameStart(data: { mode: string }): void {
        this.debugLog(`游戏开始，模式: ${data.mode}`);
        
        // 根据游戏模式调整相机设置
        if (data.mode === 'monopoly' || data.mode === 'strategy') {
            this.enableMainCamera();
        }
    }

    // ========================= 工具方法 =========================

    /**
     * 调试日志输出
     */
    private debugLog(message: string): void {
        if (this.debugMode) {
            console.log(`[InteractionManager] ${message}`);
        }
    }
}