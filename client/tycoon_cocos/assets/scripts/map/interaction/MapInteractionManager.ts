/**
 * 地图交互管理器
 * 
 * 统一处理地图编辑模式下的所有交互逻辑
 * 包括鼠标点击、射线检测、元素选择等
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { 
    _decorator, 
    Component, 
    Node, 
    Camera, 
    Vec3, 
    Vec2,
    PhysicsSystem,
    geometry,
    BoxCollider,
    find
} from 'cc';
import { EventBus } from '../../events/EventBus';
import { EventTypes, Input3DEventData } from '../../events/EventTypes';

const { ccclass, property } = _decorator;

/**
 * 地图交互事件数据
 */
export interface MapInteractionData {
    /** 世界坐标位置 */
    worldPosition: Vec3;
    /** 网格坐标 */
    gridPosition: Vec2;
    /** 鼠标按键 (0=左键, 2=右键) */
    button: number;
    /** 击中的节点（如果有） */
    hitNode?: Node;
    /** 击中的碰撞器（如果有） */
    hitCollider?: BoxCollider;
    /** 是否击中了已有元素 */
    hasElement: boolean;
}

/**
 * 地图交互事件类型
 */
export enum MapInteractionEvent {
    /** 点击了已有元素 */
    ELEMENT_CLICKED = 'MapElementClicked',
    /** 点击了空位置 */
    EMPTY_CLICKED = 'EmptyPositionClicked',
    /** 请求放置元素 */
    REQUEST_PLACE = 'RequestPlaceElement',
    /** 请求删除元素 */
    REQUEST_REMOVE = 'RequestRemoveElement',
    /** 鼠标悬停 */
    HOVER_CHANGED = 'HoverPositionChanged'
}

@ccclass('MapInteractionManager')
export class MapInteractionManager extends Component {

    @property({ type: Camera, displayName: '目标相机' })
    public targetCamera: Camera | null = null;

    @property({ displayName: '启用物理射线检测' })
    public enablePhysicsRaycast: boolean = true;

    @property({ displayName: '最大检测距离' })
    public maxRayDistance: number = 100;

    @property({ displayName: '地面Y坐标' })
    public groundY: number = 0;

    @property({ displayName: '网格步长' })
    public gridStep: number = 1;

    @property({ displayName: '调试模式' })
    public debugMode: boolean = false;

    // 物理检测层
    private readonly LAYER_TILES = 1 << 0;   // 地块层
    private readonly LAYER_OBJECTS = 1 << 1; // 物体层

    // 当前悬停位置
    private _currentHoverGrid: Vec2 | null = null;
    private _currentHoverNode: Node | null = null;

    // 是否已初始化
    private _initialized: boolean = false;

    protected onLoad(): void {
        // 查找相机
        if (!this.targetCamera) {
            const cameraNode = find('Main Camera');
            if (cameraNode) {
                this.targetCamera = cameraNode.getComponent(Camera);
            }
        }

        if (!this.targetCamera) {
            console.error('[MapInteractionManager] No camera found!');
            return;
        }

        this._initialized = true;
        this.log('MapInteractionManager initialized');
    }

    protected onEnable(): void {
        if (!this._initialized) return;

        // 注册EventBus鼠标事件
        EventBus.on(EventTypes.Input3D.MouseDown, this.onMouseDown, this);
        EventBus.on(EventTypes.Input3D.MouseUp, this.onMouseUp, this);
        EventBus.on(EventTypes.Input3D.MouseMove, this.onMouseMove, this);

        this.log('EventBus mouse events registered');
    }

    protected onDisable(): void {
        // 取消注册EventBus鼠标事件
        EventBus.off(EventTypes.Input3D.MouseDown, this.onMouseDown, this);
        EventBus.off(EventTypes.Input3D.MouseUp, this.onMouseUp, this);
        EventBus.off(EventTypes.Input3D.MouseMove, this.onMouseMove, this);

        this.log('EventBus mouse events unregistered');
    }

    /**
     * EventBus鼠标按下事件
     */
    private onMouseDown(data: Input3DEventData): void {
        this.handleMouseClick(data, true);
    }

    /**
     * EventBus鼠标释放事件
     */
    private onMouseUp(data: Input3DEventData): void {
        // 右键在释放时处理
        if (data.button === 2) {
            this.handleMouseClick(data, false);
        }
    }

    /**
     * EventBus鼠标移动事件
     */
    private onMouseMove(data: Input3DEventData): void {
        if (!this.targetCamera) return;

        const result = this.performRaycast(data);
        
        // 计算网格位置
        const gridPos = this.worldToGrid(result.worldPosition);
        
        // 检查悬停位置是否改变
        if (!this._currentHoverGrid || !gridPos.equals(this._currentHoverGrid)) {
            this._currentHoverGrid = gridPos;
            this._currentHoverNode = result.hitNode || null;
            
            // 发送悬停事件
            EventBus.emit(MapInteractionEvent.HOVER_CHANGED, {
                worldPosition: result.worldPosition,
                gridPosition: gridPos,
                hitNode: result.hitNode,
                hasElement: result.hasElement
            });
        }
    }

    /**
     * 处理鼠标点击
     */
    private handleMouseClick(data: Input3DEventData, isDown: boolean): void {
        if (!this.targetCamera) return;

        const button = data.button || 0;
        
        // 左键只在按下时处理，右键只在释放时处理
        if ((button === 0 && !isDown) || (button === 2 && isDown)) {
            return;
        }

        // 执行射线检测
        const result = this.performRaycast(data);
        
        // 创建交互数据
        const interactionData: MapInteractionData = {
            worldPosition: result.worldPosition,
            gridPosition: result.gridPosition,
            button: button,
            hitNode: result.hitNode,
            hitCollider: result.hitCollider,
            hasElement: result.hasElement
        };

        // 调试输出
        if (this.debugMode) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('[MapInteractionManager] 点击检测');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`世界坐标: (${result.worldPosition.x.toFixed(2)}, ${result.worldPosition.y.toFixed(2)}, ${result.worldPosition.z.toFixed(2)})`);
            console.log(`网格坐标: [${result.gridPosition.x}, ${result.gridPosition.y}]`);
            console.log(`击中元素: ${result.hasElement ? result.hitNode?.name : '无'}`);
            console.log(`鼠标按键: ${button === 0 ? '左键' : button === 2 ? '右键' : '其他'}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }

        // 根据情况发送不同事件
        if (result.hasElement) {
            // 点击了已有元素
            EventBus.emit(MapInteractionEvent.ELEMENT_CLICKED, interactionData);
            
            if (button === 2) {
                // 右键请求删除
                EventBus.emit(MapInteractionEvent.REQUEST_REMOVE, interactionData);
            } else if (button === 0) {
                // 左键也可以在有元素的位置放置（比如在地块上放置物体）
                EventBus.emit(MapInteractionEvent.REQUEST_PLACE, interactionData);
            }
        } else {
            // 点击了空位置
            EventBus.emit(MapInteractionEvent.EMPTY_CLICKED, interactionData);
            
            if (button === 0) {
                // 左键请求放置
                EventBus.emit(MapInteractionEvent.REQUEST_PLACE, interactionData);
            }
        }
    }

    /**
     * 执行射线检测
     */
    private performRaycast(data: Input3DEventData): any {
        if (!this.targetCamera) {
            return {
                worldPosition: new Vec3(),
                gridPosition: new Vec2(),
                hasElement: false
            };
        }

        // 创建射线
        const ray = this.targetCamera.screenPointToRay(data.screenX, data.screenY);
        
        let hitResult: any = null;
        let worldPosition = new Vec3();
        
        // 1. 尝试物理射线检测
        if (this.enablePhysicsRaycast && PhysicsSystem.instance) {
            const raycastResults = PhysicsSystem.instance.raycastResults;
            const mask = this.LAYER_TILES | this.LAYER_OBJECTS;
            
            if (PhysicsSystem.instance.raycast(ray, mask, this.maxRayDistance, false)) {
                // 获取最近的击中结果
                if (raycastResults.length > 0) {
                    const closest = raycastResults[0];
                    hitResult = {
                        hitNode: closest.collider.node,
                        hitCollider: closest.collider,
                        hitPoint: closest.hitPoint,
                        distance: closest.distance
                    };
                    worldPosition = closest.hitPoint.clone();
                    
                    this.log(`物理射线击中: ${closest.collider.node.name} at ${worldPosition}`);
                }
            }
        }
        
        // 2. 如果没有击中碰撞器，检测地面平面
        if (!hitResult) {
            const planeHit = this.raycastPlane(ray, this.groundY);
            if (planeHit) {
                worldPosition = planeHit;
                this.log(`平面检测击中: ${worldPosition}`);
            }
        }
        
        // 3. 转换为网格坐标
        const gridPosition = this.worldToGrid(worldPosition);
        
        return {
            worldPosition: worldPosition,
            gridPosition: gridPosition,
            hitNode: hitResult?.hitNode || null,
            hitCollider: hitResult?.hitCollider || null,
            hasElement: hitResult !== null
        };
    }

    /**
     * 射线与平面相交检测
     */
    private raycastPlane(ray: geometry.Ray, planeY: number): Vec3 | null {
        // 检查射线是否平行于平面
        if (Math.abs(ray.d.y) < 0.001) {
            return null;
        }
        
        // 计算交点
        const t = (planeY - ray.o.y) / ray.d.y;
        
        // 确保交点在射线前方
        if (t < 0) {
            return null;
        }
        
        // 计算交点坐标
        return new Vec3(
            ray.o.x + t * ray.d.x,
            planeY,
            ray.o.z + t * ray.d.z
        );
    }

    /**
     * 世界坐标转网格坐标
     * 返回格子的索引（左下角为基准）
     */
    public worldToGrid(worldPos: Vec3): Vec2 {
        return new Vec2(
            Math.floor(worldPos.x / this.gridStep),
            Math.floor(worldPos.z / this.gridStep)
        );
    }

    /**
     * 网格坐标转世界坐标
     * 返回格子中心的世界坐标
     */
    public gridToWorld(gridPos: Vec2, y: number = 0): Vec3 {
        return new Vec3(
            gridPos.x * this.gridStep + this.gridStep * 0.5,
            y,
            gridPos.y * this.gridStep + this.gridStep * 0.5
        );
    }

    /**
     * 获取当前悬停的网格位置
     */
    public getCurrentHoverGrid(): Vec2 | null {
        return this._currentHoverGrid ? this._currentHoverGrid.clone() : null;
    }

    /**
     * 获取当前悬停的节点
     */
    public getCurrentHoverNode(): Node | null {
        return this._currentHoverNode;
    }

    /**
     * 调试日志
     */
    private log(message: string): void {
        if (this.debugMode) {
            console.log(`[MapInteractionManager] ${message}`);
        }
    }
}