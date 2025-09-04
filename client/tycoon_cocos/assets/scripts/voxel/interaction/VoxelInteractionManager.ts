import { _decorator, Component, Node, Vec3, Camera, input, Input, EventMouse, MeshRenderer, Material, primitives, Mesh, Color, view, UITransform, Canvas, utils } from "cc";
import { VoxelRayCaster, VoxelHitResult, RaycastAlgorithm } from "./VoxelRayCaster";
import { VoxelCollisionSystem } from "./VoxelCollisionSystem";
import { VoxelWorldManager } from "../world/VoxelWorld";
import { VoxelBlockType } from "../core/VoxelBlock";
import { VoxelWorldConfig, VoxelWorldMode } from "../core/VoxelWorldConfig";
import { EventBus } from "../../events/EventBus";
import { EventTypes, Input3DEventData } from "../../events/EventTypes";
import { CameraManager, CameraControllerType } from "../../camera/CameraManager";
import { VoxelCameraController } from "../../camera/voxel/VoxelCameraController";
import { VoxelCameraMode } from "../../camera/voxel/VoxelCameraConfig";

const { ccclass, property } = _decorator;

export interface VoxelInteractionEvents {
    onBlockClick?: (hitResult: VoxelHitResult) => void;
    onBlockHover?: (hitResult: VoxelHitResult | null) => void;
    onBlockPlace?: (position: Vec3, blockType: VoxelBlockType) => void;
    onBlockBreak?: (position: Vec3) => void;
    onModeChange?: (mode: VoxelCameraMode) => void;
}

@ccclass('VoxelInteractionManager')
export class VoxelInteractionManager extends Component {

    @property({ type: Camera })
    camera: Camera = null;

    @property({ displayName: "启用体素相机", tooltip: "在start时自动启用体素相机控制器" })
    public enableVoxelCamera: boolean = true;

    @property({ displayName: "默认相机模式", tooltip: "启动时的默认体素相机模式" })
    public defaultVoxelMode: VoxelCameraMode = VoxelCameraMode.WALKING;

    @property({ type: VoxelCollisionSystem })
    collisionSystem: VoxelCollisionSystem = null;

    @property
    maxRaycastDistance: number = 64.0;//8.0;

    @property
    selectedBlockType: VoxelBlockType = VoxelBlockType.STONE;

    @property({ tooltip: "启用射线可视化调试" })
    enableDebugVisualization: boolean = true;

    @property({ tooltip: "启用击中点标记" })
    enableHitMarkers: boolean = true;

    @property({ tooltip: "调试信息保持时间（秒）" })
    debugDisplayDuration: number = 3.0;

    private rayCaster: VoxelRayCaster = new VoxelRayCaster();
    private worldManager: VoxelWorldManager = null;
    private events: VoxelInteractionEvents = {};
    
    // 相机管理器和控制器引用
    private _cameraManager: CameraManager | null = null;
    private _voxelCameraController: VoxelCameraController | null = null;
    
    private lastHoverResult: VoxelHitResult | null = null;
    
    // 调试可视化相关
    private debugRayNodes: Node[] = [];
    private debugMarkerNodes: Node[] = [];

    protected onLoad() {
        // 获取相机管理器实例
        this._cameraManager = CameraManager.getInstance();
        
        if (!this._cameraManager) {
            console.error('[VoxelInteractionManager] 无法获取CameraManager实例！请确保场景中有CameraManager组件');
            return;
        }

        // 获取相机引用
        if (!this.camera) {
            this.camera = this._cameraManager.getMainCamera();
        }
        
        if (!this.collisionSystem) {
            this.collisionSystem = this.getComponent(VoxelCollisionSystem);
        }
        
    }

    protected start(): void {
    }

    protected onEnable(): void {
        // 启用体素相机控制器
        if (this._cameraManager) {
            const success = this._cameraManager.switchToController(CameraControllerType.VOXEL_WORLD);
            if (success) {
                this._cameraManager.setVoxelCameraMode(this.defaultVoxelMode);
                
                // 获取体素相机控制器引用
                this._voxelCameraController = this._cameraManager.getActiveController() as VoxelCameraController;
                
                console.log(`[VoxelInteractionManager] onEnable: 已切换到体素相机，模式: ${this.defaultVoxelMode}`);
            } else {
                console.warn('[VoxelInteractionManager] onEnable: 无法切换到体素相机控制器');
            }
        }
        
        // 监听通过UI3DInteractionManager转发的3D输入事件
        EventBus.on(EventTypes.Input3D.MouseDown, this.onInput3DMouseDown, this);
        EventBus.on(EventTypes.Input3D.MouseMove, this.onInput3DMouseMove, this);
        EventBus.on(EventTypes.Input3D.TouchStart, this.onInput3DTouchStart, this);
        EventBus.on(EventTypes.Input3D.TouchMove, this.onInput3DTouchMove, this);

    }

    protected onDisable(): void {
        // 解绑3D输入事件
        EventBus.off(EventTypes.Input3D.MouseDown, this.onInput3DMouseDown, this);
        EventBus.off(EventTypes.Input3D.MouseMove, this.onInput3DMouseMove, this);
        EventBus.off(EventTypes.Input3D.TouchStart, this.onInput3DTouchStart, this);
        EventBus.off(EventTypes.Input3D.TouchMove, this.onInput3DTouchMove, this);

    }

    public initialize(worldManager: VoxelWorldManager, events?: VoxelInteractionEvents): void {
        this.worldManager = worldManager;
        this.events = events || {};
        
        if (this._voxelCameraController) {
            this._voxelCameraController.setBlockQueryFunction((x, y, z) => 
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

    public getVoxelCameraController(): VoxelCameraController {
        return this._voxelCameraController;
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
        
        // 调试可视化
        if (mouseX !== undefined && mouseY !== undefined) {
            // 输出调试信息
            this.outputDebugInfo(mouseX, mouseY);
            
            // 清理之前的调试节点
            this.clearDebugNodes();
            
            // 创建射线可视化
            if (this.enableDebugVisualization) {
                this.createDebugRay(rayOrigin, rayDirection, castDistance);
            }
            
            // 创建击中点标记
            if (result.hit && result.position && this.enableHitMarkers) {
                this.createHitMarker(result.position, Color.GREEN, "击中点");
            }
            
            // 计划清理调试节点
            this.scheduleDebugCleanup();
        }
        
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

    // ==================== 新的3D输入事件处理方法 ====================

    /**
     * 处理从UI3DInteractionManager转发的鼠标按下事件
     * @param eventData 3D输入事件数据
     */
    private onInput3DMouseDown(eventData: Input3DEventData): void {
        
        // 转换为EventMouse进行处理
        const originalEvent = eventData.originalEvent as EventMouse;
        this.onMouseDown(originalEvent);
    }

    /**
     * 处理从UI3DInteractionManager转发的鼠标移动事件
     * @param eventData 3D输入事件数据
     */
    private onInput3DMouseMove(eventData: Input3DEventData): void {
        // 转换为EventMouse进行处理
        const originalEvent = eventData.originalEvent as EventMouse;
        this.onMouseMove(originalEvent);
    }

    /**
     * 处理从UI3DInteractionManager转发的触摸开始事件
     * @param eventData 3D输入事件数据
     */
    private onInput3DTouchStart(eventData: Input3DEventData): void {
        
        // 模拟鼠标事件进行处理
        // 可以根据需要创建一个模拟的EventMouse对象，或者直接使用eventData
        this.handleTouchAsMouseDown(eventData);
    }

    /**
     * 处理从UI3DInteractionManager转发的触摸移动事件
     * @param eventData 3D输入事件数据
     */
    private onInput3DTouchMove(eventData: Input3DEventData): void {
        // 处理触摸移动，可以用于悬停检测
        // 暂时禁用以避免频繁日志
    }

    /**
     * 将触摸事件按鼠标事件处理
     * @param eventData 3D输入事件数据
     */
    private handleTouchAsMouseDown(eventData: Input3DEventData): void {
        const buttonName = '触摸';
        
        
        if (!this.camera) {
            console.warn('[VoxelInteraction] 摄像机未设置，无法进行射线投射');
            return;
        }
        
        if (!this.worldManager) {
            console.warn('[VoxelInteraction] 世界管理器未设置，无法进行方块操作');
            return;
        }

        // 使用UI坐标进行射线投射
        const mouseX = eventData.uiX || eventData.screenX;
        const mouseY = eventData.uiY || eventData.screenY;

        
        const hitResult = this.performRaycast(mouseX, mouseY);
        console.log('[VoxelInteraction] 射线投射结果:', hitResult);
        
        if (hitResult.hit && hitResult.position) {
            console.log(`[VoxelInteraction] 击中方块 位置:(${hitResult.position.x}, ${hitResult.position.y}, ${hitResult.position.z}) 类型:${hitResult.blockType}`);
            
            // 触摸默认执行破坏操作（可以根据需要调整）
            console.log('[VoxelInteraction] 执行破坏方块操作');
            const success = this.breakBlock(hitResult.position);
            console.log(`[VoxelInteraction] 破坏方块结果: ${success ? '成功' : '失败'}`);
            
            if (this.events.onBlockClick) {
                this.events.onBlockClick(hitResult);
            }
        } else {
            console.log('[VoxelInteraction] 射线未击中任何方块');
        }
    }

    // ==================== 原有的事件处理方法（保留用于兼容） ====================

    private onMouseDown(event: EventMouse): void {
        const buttonName = event.getButton() === EventMouse.BUTTON_LEFT ? '左键' : 
                          event.getButton() === EventMouse.BUTTON_RIGHT ? '右键' : 
                          `按键${event.getButton()}`;
        
        
        if (!this.camera) {
            console.warn('[VoxelInteraction] 摄像机未设置，无法进行射线投射');
            return;
        }
        
        if (!this.worldManager) {
            console.warn('[VoxelInteraction] 世界管理器未设置，无法进行方块操作');
            return;
        }
        
        //在 Cocos Creator 3.x 下如果 Canvas 使用了设计分辨率和适配（Fit Height/Width、Retina 等），这两个值与 camera.screenPointToRay() 期望的 UI 坐标会有偏差，典型表现就是“有偏移”。
        // const mouseX = event.getLocationX();
        // const mouseY = event.getLocationY();
        const ui = event.getUILocation(); // 使用UI坐标，自动适配分辨率与视口
        const mouseX = ui.x;
        const mouseY = ui.y;

        //debug event.getLocationX() 与 event.getUILocation() 的差异
        const locX = event.getLocationX();
        const locY = event.getLocationY();

        
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
        if (this._voxelCameraController) {
            this._voxelCameraController.toggleMode();
            
            if (this.events.onModeChange) {
                this.events.onModeChange(this._voxelCameraController.getCurrentMode());
            }
        }
    }

    public setCameraMode(mode: VoxelCameraMode): void {
        if (this._voxelCameraController) {
            this._voxelCameraController.setMode(mode);
            
            if (this.events.onModeChange) {
                this.events.onModeChange(mode);
            }
        }
    }

    public getCurrentCameraMode(): VoxelCameraMode | null {
        return this._voxelCameraController ? this._voxelCameraController.getCurrentMode() : null;
    }

    public getWorldManager(): VoxelWorldManager {
        return this.worldManager;
    }

    public update(deltaTime: number): void {

    }

    // === 调试可视化功能 ===
    
    private createDebugRay(origin: Vec3, direction: Vec3, distance: number): Node {
        if (!this.enableDebugVisualization) return null;
        
        const rayNode = new Node('DebugRay');
        // 将调试节点挂在当前节点，保证层级/可见性一致
        rayNode.setParent(this.node);
        // 匹配渲染层，避免被相机可见性剔除
        rayNode.layer = this.node.layer;
        
        // 计算射线终点
        const endPoint = origin.clone().add(direction.clone().multiplyScalar(distance));
        
        // 使用简单的方式：创建一个细长的立方体表示射线
        const meshRenderer = rayNode.addComponent(MeshRenderer);
        
        // 创建线段网格（使用更粗的立方体便于观察）
        const lineLength = Vec3.distance(origin, endPoint);
        const geometryData = primitives.box({ width: 0.1, height: 0.1, length: lineLength });
        const mesh = utils.MeshUtils.createMesh(geometryData);
        meshRenderer.mesh = mesh;
        
        // 创建红色材质
        try {
            const material = new Material();
            // 使用内置无光材质，避免缺少灯光导致不可见
            material.initialize({ effectName: 'builtin-unlit' });
            // 设置为红色，便于观察
            try { material.setProperty('mainColor', new Color(0, 0, 255, 255)); } catch {}
            try { material.setProperty('albedo', new Color(0, 0, 255, 255)); } catch {}
            meshRenderer.material = material;
        } catch (e) {
            console.warn('[调试] 无法设置射线材质:', e);
        }
        
        // 设置位置和旋转
        const center = Vec3.lerp(new Vec3(), origin, endPoint, 0.5);
        rayNode.setWorldPosition(center);
        
        // 计算旋转让立方体指向射线方向
        const forward = direction.clone().normalize();
        const up = new Vec3(0, 1, 0);
        
        // 使用lookAt让立方体指向终点
        rayNode.lookAt(endPoint, up);
        
        // 详细调试信息
        console.log(`[调试] 射线可视化详情:`);
        console.log(`  起点: (${origin.x.toFixed(2)}, ${origin.y.toFixed(2)}, ${origin.z.toFixed(2)})`);
        console.log(`  终点: (${endPoint.x.toFixed(2)}, ${endPoint.y.toFixed(2)}, ${endPoint.z.toFixed(2)})`);
        console.log(`  中心: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`);
        console.log(`  长度: ${lineLength.toFixed(2)}`);
        console.log(`  方向: (${forward.x.toFixed(2)}, ${forward.y.toFixed(2)}, ${forward.z.toFixed(2)})`);
        
        this.debugRayNodes.push(rayNode);

        // 额外：在射线上撒点，增强可见性
        const dotSteps = Math.max(12, Math.floor(lineLength / 0.5));
        const dotLen = lineLength / dotSteps;
        for (let i = 0; i <= dotSteps; i++) {
            const t = i * dotLen;
            const p = origin.clone().add(direction.clone().normalize().multiplyScalar(t));
            const dot = new Node('RayDot');
            dot.setParent(this.node);
            dot.layer = this.node.layer;
            const mr = dot.addComponent(MeshRenderer);
            const geo = primitives.box({ width: 0.08, height: 0.08, length: 0.08 });
            mr.mesh = utils.MeshUtils.createMesh(geo);
            try {
                const mat = new Material();
                mat.initialize({ effectName: 'builtin-unlit' });
                const col = i === dotSteps ? new Color(255, 200, 40, 255) : new Color(240, 240, 240, 220);
                try { mat.setProperty('mainColor', col); } catch {}
                try { mat.setProperty('albedo', col); } catch {}
                mr.material = mat;
            } catch {}
            dot.setWorldPosition(p);
            this.debugRayNodes.push(dot);
        }
        return rayNode;
    }
    
    private createHitMarker(position: Vec3, color: Color, label: string): Node {
        if (!this.enableHitMarkers) return null;
        
        const markerNode = new Node(`HitMarker_${label}`);
        markerNode.setParent(this.node);
        markerNode.layer = this.node.layer;
        
        const meshRenderer = markerNode.addComponent(MeshRenderer);
        const geometryData = primitives.box({ width: 0.2, height: 0.2, length: 0.2 });
        const mesh = utils.MeshUtils.createMesh(geometryData);
        meshRenderer.mesh = mesh;
        
        // 为标记设置材质和颜色
        try {
            const material = new Material();
            material.initialize({ effectName: 'builtin-unlit' });
            // 根据标记类型设置颜色
            const c = (label === "击中点") ? new Color(0, 255, 0, 255) : color;
            try { material.setProperty('mainColor', c); } catch {}
            try { material.setProperty('albedo', c); } catch {}
            meshRenderer.material = material;
        } catch (e) {
            console.warn('[调试] 无法设置标记材质:', e);
        }
        
        // 设置位置（方块中心）
        markerNode.setWorldPosition(new Vec3(position.x + 0.5, position.y + 0.5, position.z + 0.5));
        
        console.log(`[调试] 创建${label}标记: 位置(${position.x}, ${position.y}, ${position.z})`);
        
        this.debugMarkerNodes.push(markerNode);
        return markerNode;
    }
    
    private clearDebugNodes(): void {
        // 清理射线可视化
        this.debugRayNodes.forEach(node => {
            if (node && node.isValid) {
                node.destroy();
            }
        });
        this.debugRayNodes = [];
        
        // 清理标记
        this.debugMarkerNodes.forEach(node => {
            if (node && node.isValid) {
                node.destroy();
            }
        });
        this.debugMarkerNodes = [];
    }
    
    private scheduleDebugCleanup(): void {
        this.scheduleOnce(() => {
            this.clearDebugNodes();
        }, this.debugDisplayDuration);
    }
    
    private outputDebugInfo(mouseX: number, mouseY: number): void {
        console.log('=== 射线检测调试信息 ===');
        
        // Canvas和视口信息
        const canvas = this.camera.node.scene.getComponentInChildren(Canvas);
        if (canvas) {
            const canvasTransform = canvas.node.getComponent(UITransform);
            console.log(`Canvas信息: 设计尺寸(${canvasTransform.width}, ${canvasTransform.height})`);
        }
        
        // 视图信息
        const visibleSize = view.getVisibleSize();
        const designSize = view.getDesignResolutionSize();
        console.log(`视图信息: 可见尺寸(${visibleSize.width}, ${visibleSize.height}), 设计分辨率(${designSize.width}, ${designSize.height})`);
        
        // 相机信息
        console.log(`相机信息: FOV=${this.camera.fov}, Near=${this.camera.near}, Far=${this.camera.far}`);
        
        // 鼠标坐标信息
        console.log(`鼠标坐标: UI(${mouseX}, ${mouseY})`);
        
        console.log('=== 调试信息结束 ===');
    }
}