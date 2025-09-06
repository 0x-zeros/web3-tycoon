import { _decorator, Component, Node, Vec3, Camera, input, Input, EventMouse, MeshRenderer, Material, utils } from "cc";
import { VoxelRayCaster, VoxelHitResult, RaycastAlgorithm } from "./VoxelRayCaster";
import { VoxelCollisionSystem } from "./VoxelCollisionSystem";
import { VoxelWorldManager } from "../world/VoxelWorld";
import { VoxelBlockType } from "../core/VoxelBlock";
import { VoxelWorldConfig, VoxelWorldMode } from "../core/VoxelWorldConfig";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";

const { ccclass, property } = _decorator;

// 简化的相机模式定义（避免循环依赖）
export enum VoxelCameraMode {
    WALKING = 'walking',
    FLYING = 'flying',
    SPECTATOR = 'spectator'
}

export interface VoxelInteractionEvents {
    onBlockClick?: (hitResult: VoxelHitResult) => void;
    onBlockHover?: (hitResult: VoxelHitResult | null) => void;
    onBlockPlace?: (position: Vec3, blockType: VoxelBlockType) => void;
    onBlockBreak?: (position: Vec3) => void;
    onModeChange?: (mode: VoxelCameraMode) => void;
}

/**
 * 体素交互管理器
 * 处理体素世界中的鼠标交互、射线检测和方块操作
 * 简化版本，避免复杂的相机系统依赖
 */
@ccclass('VoxelInteractionManager')
export class VoxelInteractionManager extends Component {

    @property({ type: Camera })
    camera: Camera = null;

    @property({ displayName: "默认相机模式", tooltip: "启动时的默认体素相机模式" })
    public defaultVoxelMode: VoxelCameraMode = VoxelCameraMode.WALKING;

    @property({ type: VoxelCollisionSystem })
    collisionSystem: VoxelCollisionSystem = null;

    @property
    maxRaycastDistance: number = 64.0;

    @property
    selectedBlockType: VoxelBlockType = VoxelBlockType.STONE;

    @property({ tooltip: "启用射线可视化调试" })
    enableDebugVisualization: boolean = true;

    @property({ tooltip: "启用击中点标记" })
    enableHitMarkers: boolean = true;

    @property({ tooltip: "调试信息保持时间（秒）" })
    debugDisplayTime: number = 2.0;

    // 私有变量
    private worldManager: VoxelWorldManager = null;
    private events: VoxelInteractionEvents = {};
    private _currentCameraMode: VoxelCameraMode = VoxelCameraMode.WALKING;
    private lastHoverResult: VoxelHitResult | null = null;

    // 调试可视化相关
    private debugRayNodes: Node[] = [];
    private debugMarkerNodes: Node[] = [];

    protected onLoad() {
        console.log('[VoxelInteractionManager] 开始初始化...');

        // 简化相机初始化
        if (!this.camera) {
            console.warn('[VoxelInteractionManager] 请在Inspector中设置Camera引用');
        }
        
        if (!this.collisionSystem) {
            this.collisionSystem = this.getComponent(VoxelCollisionSystem);
        }

        // 初始化相机模式
        this._currentCameraMode = this.defaultVoxelMode;

        console.log('[VoxelInteractionManager] 体素交互管理器初始化完成');
    }

    protected onEnable(): void {
        // 设置相机模式
        this._currentCameraMode = this.defaultVoxelMode;
        console.log(`[VoxelInteractionManager] onEnable: 相机模式设置为: ${this._currentCameraMode}`);

        this.setupInputHandlers();
        this.setupWorldManager();
    }

    private setupWorldManager(): void {
        if (!this.worldManager) {
            this.worldManager = this.node.getComponent(VoxelWorldManager);
            if (!this.worldManager) {
                console.warn('[VoxelInteractionManager] 未找到VoxelWorldManager组件');
            }
        }
    }

    public setWorldManager(manager: VoxelWorldManager): void {
        this.worldManager = manager;
        console.log('[VoxelInteractionManager] 世界管理器设置完成');
    }

    public setEvents(events: VoxelInteractionEvents): void {
        this.events = events;
        console.log('[VoxelInteractionManager] 事件回调设置完成');
    }

    // 统一初始化入口，兼容外部调用
    public initialize(manager: VoxelWorldManager, events?: VoxelInteractionEvents): void {
        this.setWorldManager(manager);
        if (events) this.setEvents(events);
    }

    private setupInputHandlers(): void {
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        console.log('[VoxelInteractionManager] 鼠标输入监听器设置完成');
    }

    private onMouseDown(event: EventMouse): void {
        if (event.getButton() === EventMouse.BUTTON_LEFT) {
            this.handleLeftClick(event);
        } else if (event.getButton() === EventMouse.BUTTON_RIGHT) {
            this.handleRightClick(event);
        }
    }

    private onMouseMove(event: EventMouse): void {
        if (this.events.onBlockHover) {
            const hitResult = this.performRaycastFromEvent(event);
            
            if (hitResult !== this.lastHoverResult) {
                this.events.onBlockHover(hitResult);
                this.lastHoverResult = hitResult;
            }
        }
    }

    private handleLeftClick(event: EventMouse): void {
        const hitResult = this.performRaycastFromEvent(event);
        
        if (hitResult && this.events.onBlockClick) {
            this.events.onBlockClick(hitResult);
        }

        // 破坏方块
        if (hitResult && this.worldManager) {
            const pos = hitResult.position;
            this.worldManager.setBlock(pos.x, pos.y, pos.z, VoxelBlockType.EMPTY);
            
            if (this.events.onBlockBreak) {
                this.events.onBlockBreak(pos);
            }

            console.log(`[VoxelInteractionManager] 方块已破坏: (${pos.x}, ${pos.y}, ${pos.z})`);
        }
    }

    private handleRightClick(event: EventMouse): void {
        const hitResult = this.performRaycastFromEvent(event);
        
        // 放置方块
        if (hitResult && this.worldManager) {
            const normal = hitResult.normal;
            const pos = hitResult.position;
            const placePos = new Vec3(
                pos.x + normal.x,
                pos.y + normal.y,
                pos.z + normal.z
            );
            
            this.worldManager.setBlock(placePos.x, placePos.y, placePos.z, this.selectedBlockType);
            
            if (this.events.onBlockPlace) {
                this.events.onBlockPlace(placePos, this.selectedBlockType);
            }

            console.log(`[VoxelInteractionManager] 方块已放置: (${placePos.x}, ${placePos.y}, ${placePos.z}) 类型:${this.selectedBlockType}`);
        }
    }

    private performRaycastFromEvent(event: EventMouse): VoxelHitResult | null {
        if (!this.camera || !this.worldManager) {
            return null;
        }

        // 获取鼠标位置（使用UI坐标，自动适配分辨率与视口）
        const ui = event.getUILocation();
        const mouseX = ui.x;
        const mouseY = ui.y;

        console.log(`[VoxelInteractionManager] 射线检测: 屏幕坐标(${mouseX}, ${mouseY})`);

        // 执行射线检测
        const hitResult = VoxelRayCaster.performRaycast(
            this.camera,
            mouseX,
            mouseY,
            this.maxRaycastDistance,
            this.worldManager,
            RaycastAlgorithm.SIMPLE
        );

        // 可视化调试
        if (this.enableDebugVisualization) {
            this.visualizeRaycast(hitResult);
        }

        if (hitResult) {
            console.log(`[VoxelInteractionManager] 击中方块: (${hitResult.position.x}, ${hitResult.position.y}, ${hitResult.position.z})`);
        }

        return hitResult;
    }

    // 对外暴露：根据屏幕坐标进行射线检测（供渲染器/调试器调用）
    public performRaycast(mouseX?: number, mouseY?: number): VoxelHitResult | null {
        if (!this.camera || !this.worldManager) return null;
        if (mouseX === undefined || mouseY === undefined) return null;

        return VoxelRayCaster.performRaycast(
            this.camera,
            mouseX,
            mouseY,
            this.maxRaycastDistance,
            this.worldManager,
            RaycastAlgorithm.SIMPLE
        );
    }

    private visualizeRaycast(hitResult: VoxelHitResult | null): void {
        // 清理之前的调试节点
        this.clearDebugNodes();

        if (!hitResult) {
            console.log('[VoxelInteractionManager] 射线未击中任何方块');
            return;
        }

        // 创建射线可视化
        if (this.enableDebugVisualization) {
            const rayNode = this.createDebugRay(hitResult.rayStart, hitResult.rayEnd);
            if (rayNode) {
                this.debugRayNodes.push(rayNode);
            }
        }

        // 创建击中点标记
        if (this.enableHitMarkers) {
            const markerNode = this.createDebugMarker(hitResult.position);
            if (markerNode) {
                this.debugMarkerNodes.push(markerNode);
            }
        }

        // 定时清理调试节点
        this.scheduleOnce(() => {
            this.clearDebugNodes();
        }, this.debugDisplayTime);
    }

    private createDebugRay(start: Vec3, end: Vec3): Node | null {
        try {
            const rayNode = new Node('DebugRay');
            this.node.addChild(rayNode);

            const direction = Vec3.subtract(new Vec3(), end, start);
            const length = direction.length();
            direction.normalize();

            // 创建线段网格
            const lineGeometry = utils.primitives.cylinder({
                radiusTop: 0.02,
                radiusBottom: 0.02,
                height: length
            });

            const mesh = utils.MeshUtils.createMesh(lineGeometry);
            if (!mesh) return null;

            const meshRenderer = rayNode.addComponent(MeshRenderer);
            meshRenderer.mesh = mesh;

            // 创建红色材质
            const material = new Material();
            material.initialize({ effectName: 'builtin-unlit' });
            meshRenderer.material = material;

            // 设置位置和方向
            const midPoint = Vec3.lerp(new Vec3(), start, end, 0.5);
            rayNode.setWorldPosition(midPoint);

            return rayNode;

        } catch (error) {
            console.error('[VoxelInteractionManager] 创建调试射线失败:', error);
            return null;
        }
    }

    private createDebugMarker(position: Vec3): Node | null {
        try {
            const markerNode = new Node('DebugMarker');
            this.node.addChild(markerNode);

            // 创建小立方体
            const cubeGeometry = utils.primitives.box({
                width: 0.2,
                height: 0.2,
                length: 0.2
            });

            const mesh = utils.MeshUtils.createMesh(cubeGeometry);
            if (!mesh) return null;

            const meshRenderer = markerNode.addComponent(MeshRenderer);
            meshRenderer.mesh = mesh;

            // 创建绿色材质
            const material = new Material();
            material.initialize({ effectName: 'builtin-unlit' });
            meshRenderer.material = material;

            markerNode.setWorldPosition(position);

            return markerNode;

        } catch (error) {
            console.error('[VoxelInteractionManager] 创建调试标记失败:', error);
            return null;
        }
    }

    private clearDebugNodes(): void {
        // 清理射线节点
        for (const node of this.debugRayNodes) {
            if (node && node.isValid) {
                node.destroy();
            }
        }
        this.debugRayNodes = [];

        // 清理标记节点
        for (const node of this.debugMarkerNodes) {
            if (node && node.isValid) {
                node.destroy();
            }
        }
        this.debugMarkerNodes = [];
    }

    // 简化的相机模式管理
    public toggleCameraMode(): void {
        const modes = Object.values(VoxelCameraMode);
        const currentIndex = modes.indexOf(this._currentCameraMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this._currentCameraMode = modes[nextIndex] as VoxelCameraMode;

        console.log(`[VoxelInteractionManager] 相机模式切换到: ${this._currentCameraMode}`);
        
        if (this.events.onModeChange) {
            this.events.onModeChange(this._currentCameraMode);
        }
    }

    public setCameraMode(mode: VoxelCameraMode): void {
        this._currentCameraMode = mode;
        console.log(`[VoxelInteractionManager] 相机模式设置为: ${mode}`);
    }

    public getCurrentCameraMode(): VoxelCameraMode {
        return this._currentCameraMode;
    }

    // 对外：放置与破坏方块
    public placeBlock(position: Vec3, blockType: VoxelBlockType = this.selectedBlockType): boolean {
        if (!this.worldManager) return false;
        const ok = this.worldManager.setBlock(position.x, position.y, position.z, blockType);
        if (ok && this.events.onBlockPlace) this.events.onBlockPlace(position, blockType);
        return ok;
    }

    public breakBlock(position: Vec3): boolean {
        if (!this.worldManager) return false;
        const ok = this.worldManager.setBlock(position.x, position.y, position.z, VoxelBlockType.EMPTY);
        if (ok && this.events.onBlockBreak) this.events.onBlockBreak(position);
        return ok;
    }

    public getLastHoverResult(): VoxelHitResult | null {
        return this.lastHoverResult;
    }

    public getCollisionSystem(): VoxelCollisionSystem | null {
        return this.collisionSystem;
    }

    // 获取当前选中的方块类型
    public getSelectedBlockType(): VoxelBlockType {
        return this.selectedBlockType;
    }

    // 设置选中的方块类型
    public setSelectedBlockType(blockType: VoxelBlockType): void {
        this.selectedBlockType = blockType;
        console.log(`[VoxelInteractionManager] 选中方块类型: ${blockType}`);
    }

    // 获取当前的射线检测算法
    public getRaycastAlgorithm(): RaycastAlgorithm {
        return RaycastAlgorithm.SIMPLE; // 默认使用简单算法
    }

    protected onDisable(): void {
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        this.clearDebugNodes();
        console.log('[VoxelInteractionManager] 交互管理器已禁用');
    }

    protected onDestroy(): void {
        this.clearDebugNodes();
        console.log('[VoxelInteractionManager] 交互管理器已销毁');
    }
}