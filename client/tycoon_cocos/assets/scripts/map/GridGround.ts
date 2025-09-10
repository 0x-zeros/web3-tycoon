/**
 * 网格地面组件
 * 
 * 使用 GeometryRenderer 绘制网格线，支持鼠标点击检测
 * 无需 Mesh 和复杂材质系统，更简单可靠
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { 
    _decorator, 
    Component, 
    Camera, 
    Color, 
    Vec3,
    EventMouse,
    find
} from 'cc';
import { EventBus } from '../events/EventBus';
import { EventTypes, Input3DEventData } from '../events/EventTypes';

const { ccclass, property, executeInEditMode } = _decorator;

/**
 * 网格地面配置接口
 */
export interface GridGroundConfig {
    /** 网格间距 */
    step?: number;
    /** 半尺寸（从中心到边缘的距离） */
    halfSize?: number;
    /** 网格颜色 */
    color?: Color;
    /** 网格所在的 Y 高度 */
    y?: number;
    /** 是否启用点击检测 */
    enableClickDetection?: boolean;
    /** 目标相机（如果不指定，自动查找 Main Camera） */
    camera?: Camera;
}

/**
 * 地面点击事件数据
 */
export interface GridClickData {
    /** 世界坐标位置 */
    worldPosition: Vec3;
    /** 本地坐标位置（相对于网格中心） */
    localPosition: Vec3;
    /** 网格对齐的坐标 */
    snappedPosition: Vec3;
    /** 网格索引 */
    gridIndex: { x: number, z: number };
    /** 地面组件 */
    groundComponent: Component;
    /** 鼠标按键 (0=左键, 2=右键) */
    button: number;
}

@ccclass('GridGround')
@executeInEditMode(true)
export class GridGround extends Component {

    @property({ tooltip: '目标相机' })
    public cam: Camera | null = null;

    @property({ tooltip: '网格间距（单位）' })
    public step: number = 1;

    @property({ tooltip: '半尺寸（共绘制 2*halfSize/step + 1 条线）' })
    public halfSize: number = 50;

    @property({ tooltip: '网格颜色' })
    public color: Color = new Color(130, 130, 130, 255);

    @property({ tooltip: '网格所在的 Y 高度' })
    public y: number = 0;

    @property({ tooltip: '是否启用点击检测' })
    public enableClickDetection: boolean = true;

    @property({ tooltip: '是否启用网格对齐' })
    public enableSnapping: boolean = true;

    @property({ tooltip: '调试模式' })
    public debugMode: boolean = false;

    private _isInitialized: boolean = false;

    protected start(): void {
        this.log('GridGround start');
        this.initializeCamera();
        
        if (this.enableClickDetection) {
            this.registerClickEvents();
        }
    }

    protected update(): void {
        // 每帧绘制网格线
        this.drawGrid();
    }

    protected onDestroy(): void {
        this.log('GridGround onDestroy');
        this.unregisterClickEvents();
    }

    /**
     * 使用配置创建网格地面
     */
    public createWithConfig(config: GridGroundConfig): void {
        if (config.step !== undefined) this.step = config.step;
        if (config.halfSize !== undefined) this.halfSize = config.halfSize;
        if (config.color !== undefined) this.color = config.color;
        if (config.y !== undefined) this.y = config.y;
        if (config.enableClickDetection !== undefined) this.enableClickDetection = config.enableClickDetection;
        if (config.camera !== undefined) this.cam = config.camera;
        
        this.initializeCamera();
    }

    /**
     * 初始化相机
     */
    private initializeCamera(): void {
        // 如果没有指定相机，自动查找主相机
        if (!this.cam) {
            const mainCameraNode = find('Main Camera');
            if (mainCameraNode) {
                this.cam = mainCameraNode.getComponent(Camera);
            }
        }

        if (!this.cam) {
            this.logError('No camera found for GridGround');
            return;
        }

        // 初始化 GeometryRenderer
        this.cam.camera?.initGeometryRenderer();
        this._isInitialized = true;
        this.log('GeometryRenderer initialized');
    }

    /**
     * 绘制网格线
     */
    private drawGrid(): void {
        if (!this._isInitialized) return;
        
        const gr = this.cam?.camera?.geometryRenderer;
        if (!gr) return;

        const y = this.y;
        const hs = this.halfSize;
        const s = Math.max(0.001, this.step);

        // 画 X 方向的平行线（沿 Z 轴方向）
        for (let x = -hs; x <= hs; x += s) {
            gr.addLine(new Vec3(x, y, -hs), new Vec3(x, y, hs), this.color);
        }
        
        // 画 Z 方向的平行线（沿 X 轴方向）
        for (let z = -hs; z <= hs; z += s) {
            gr.addLine(new Vec3(-hs, y, z), new Vec3(hs, y, z), this.color);
        }
    }

    /**
     * 注册点击事件
     */
    private registerClickEvents(): void {
        if (!this.enableClickDetection) return;

        // 优先使用 EventBus 的输入事件
        EventBus.on(EventTypes.Input3D.MouseDown, this.onEventBusMouseDown, this);
        EventBus.on(EventTypes.Input3D.MouseUp, this.onEventBusMouseUp, this);
        
        // 如果 EventBus 没有输入事件，回退到直接监听
        // input.on(Input.EventType.MOUSE_DOWN, this.onDirectMouseDown, this);
        
        this.log('Click events registered (EventBus + Direct input)');
    }

    /**
     * 取消注册点击事件
     */
    private unregisterClickEvents(): void {
        // 取消 EventBus 事件
        EventBus.off(EventTypes.Input3D.MouseDown, this.onEventBusMouseDown, this);
        EventBus.off(EventTypes.Input3D.MouseUp, this.onEventBusMouseUp, this);
        
        // 取消直接输入事件
        // input.off(Input.EventType.MOUSE_DOWN, this.onDirectMouseDown, this);
        
        this.log('Click events unregistered');
    }

    /**
     * EventBus 鼠标点击事件处理
     */
    private onEventBusMouseDown(data: Input3DEventData): void {
        if (data.button !== 0) return; // 只处理左键点击
        if (!this._isInitialized || !this.cam) return;

        // 创建模拟的 EventMouse 对象用于射线检测
        const mockEvent = {
            getLocationX: () => data.screenX,
            getLocationY: () => data.screenY,
            getButton: () => data.button || 0
        } as EventMouse;

        // 进行射线检测
        const intersectionPoint = this.performRaycast(mockEvent, this.cam);
        if (intersectionPoint) {
            this.handleGroundClick(intersectionPoint, data.button || 0);
        }
    }
    
    /**
     * EventBus 鼠标释放事件处理（右键）
     */
    private onEventBusMouseUp(data: Input3DEventData): void {
        if (data.button !== 2) return; // 只处理右键
        if (!this._isInitialized || !this.cam) return;

        // 创建模拟的 EventMouse 对象用于射线检测
        const mockEvent = {
            getLocationX: () => data.screenX,
            getLocationY: () => data.screenY,
            getButton: () => data.button || 2
        } as EventMouse;

        // 进行射线检测
        const intersectionPoint = this.performRaycast(mockEvent, this.cam);
        if (intersectionPoint) {
            this.handleGroundClick(intersectionPoint, data.button || 2);
        }
    }


    /**
     * 执行射线与平面相交检测（纯数学计算）
     */
    private performRaycast(event: EventMouse, camera: Camera): Vec3 | null {
        // 1. 创建射线
        const ray = camera.screenPointToRay(event.getLocationX(), event.getLocationY());
        
        // 2. 平面高度（网格所在的 Y 高度）
        const planeY = this.y;
        
        // 3. 检查射线是否几乎平行于平面
        if (Math.abs(ray.d.y) < 0.001) {
            return null; // 射线几乎平行于平面
        }
        
        // 4. 计算参数 t
        const t = (planeY - ray.o.y) / ray.d.y;
        
        // 5. 确保交点在射线前方
        if (t < 0) {
            return null; // 交点在射线后方
        }
        
        // 6. 计算交点坐标
        const intersectionPoint = new Vec3(
            ray.o.x + t * ray.d.x,
            planeY,
            ray.o.z + t * ray.d.z
        );
        
        // 7. 检查是否在网格范围内
        if (Math.abs(intersectionPoint.x) <= this.halfSize && 
            Math.abs(intersectionPoint.z) <= this.halfSize) {
            return intersectionPoint;
        }
        
        return null;
    }

    /**
     * 处理地面点击
     * 算法：将网格看作由多个BoxCollider组成，每个格子是一个Box
     * 计算点击位置落在哪个Box中，返回该Box的中心位置和索引
     */
    private handleGroundClick(worldPos: Vec3, button: number = 0): void {
        // ========== 1. 计算点击的格子索引 ==========
        // 把网格想象成多个BoxCollider组成的阵列
        // 每个Box的大小是 step x step，中心在格子中央
        
        // 计算点击位置落在哪个格子（BoxCollider）中
        // 注意：Math.floor 处理负数时的行为（-0.5 -> -1）
        const gridX = Math.floor(worldPos.x / this.step);
        const gridZ = Math.floor(worldPos.z / this.step);
        
        // 格子索引（BoxCollider的索引）
        const gridIndex = { x: gridX, z: gridZ };
        
        // ========== 2. 计算该格子（BoxCollider）的中心位置 ==========
        // 每个BoxCollider的中心位置计算：
        // 左下角位置 + 半个格子大小
        const boxCenterX = gridX * this.step + this.step * 0.5;
        const boxCenterZ = gridZ * this.step + this.step * 0.5;
        
        // 对齐后的位置（BoxCollider的中心）
        let snappedPos = new Vec3(boxCenterX, worldPos.y, boxCenterZ);
        
        // 如果禁用对齐，则使用原始点击位置
        if (!this.enableSnapping) {
            snappedPos = worldPos.clone();
        }
        
        // ========== 3. 计算本地坐标（相对于网格中心） ==========
        const localPos = new Vec3(
            worldPos.x,
            worldPos.y - this.y,
            worldPos.z
        );
        
        // ========== 4. 调试输出 ==========
        if (this.debugMode) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('[GridGround] 点击检测 - BoxCollider计算');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`原始点击位置: (${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)})`);
            console.log(`命中的格子索引: [${gridIndex.x}, ${gridIndex.z}]`);
            console.log(`该格子的范围: X[${gridX * this.step}, ${(gridX + 1) * this.step}], Z[${gridZ * this.step}, ${(gridZ + 1) * this.step}]`);
            console.log(`格子中心（对齐位置）: (${snappedPos.x.toFixed(2)}, ${snappedPos.y.toFixed(2)}, ${snappedPos.z.toFixed(2)})`);
            console.log(`鼠标按键: ${button === 0 ? '左键' : button === 2 ? '右键' : '其他'}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }
        
        // ========== 5. 创建点击数据 ==========
        const clickData: GridClickData = {
            worldPosition: worldPos.clone(),
            localPosition: localPos.clone(),
            snappedPosition: snappedPos.clone(),
            gridIndex: gridIndex,
            groundComponent: this,
            button: button
        };
        
        // ========== 6. 发送事件 ==========
        EventBus.emit(EventTypes.Game.GroundClicked, clickData);
    }

    /**
     * 获取网格信息
     */
    public getGridInfo(): { step: number; halfSize: number; totalSize: number; lineCount: number } {
        const totalSize = this.halfSize * 2;
        const lineCount = Math.floor(totalSize / this.step) + 1;
        
        return {
            step: this.step,
            halfSize: this.halfSize,
            totalSize: totalSize,
            lineCount: lineCount
        };
    }

    /**
     * 世界坐标转网格索引
     */
    public worldToGridIndex(worldPos: Vec3): { x: number; z: number } {
        return {
            x: Math.round(worldPos.x / this.step),
            z: Math.round(worldPos.z / this.step)
        };
    }

    /**
     * 网格索引转世界坐标
     */
    public gridIndexToWorld(gridX: number, gridZ: number): Vec3 {
        return new Vec3(
            gridX * this.step,
            this.y,
            gridZ * this.step
        );
    }

    /**
     * 检查网格索引是否在范围内
     */
    public isValidGridIndex(gridX: number, gridZ: number): boolean {
        const maxIndex = Math.floor(this.halfSize / this.step);
        return Math.abs(gridX) <= maxIndex && Math.abs(gridZ) <= maxIndex;
    }

    /**
     * 更新网格颜色
     */
    public setColor(color: Color): void {
        this.color = color;
    }

    /**
     * 调试日志
     */
    private log(message: string): void {
        if (this.debugMode) {
            console.log(`[GridGround] ${message}`);
        }
    }

    /**
     * 错误日志
     */
    private logError(message: string): void {
        console.error(`[GridGround] ${message}`);
    }
}