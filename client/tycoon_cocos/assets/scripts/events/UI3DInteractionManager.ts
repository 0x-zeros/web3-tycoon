import { _decorator, Component, input, Input, EventTouch, EventMouse, Camera, geometry, PhysicsSystem, find, Vec2, Vec3} from 'cc';
import { GRoot } from 'fairygui-cc';
import { EventBus } from './EventBus';
import { EventTypes, Input3DEventData, RaycastEventData } from './EventTypes';
import { CameraController } from '../camera/CameraController';

const { ccclass, property } = _decorator;

@ccclass('UI3DInteractionManager')
export class UI3DInteractionManager extends Component {
  @property(Camera)
  camera3D!: Camera;

  @property({ tooltip: "启用内置射线检测功能" })
  enableBuiltinRaycast: boolean = true;

  @property({ tooltip: "启用调试日志" })
  enableDebug: boolean = false;

  @property({ tooltip: "射线检测最大距离" })
  maxRaycastDistance: number = 100;

  start() {
    if (this.enableDebug) {
      console.log("[UI3DInteractionManager] start");
    }
    
    // 通过CameraController获取3D相机
    if (!this.camera3D) {
      this.camera3D = CameraController.getMainCamera(); //通过CameraController统一访问
    }
    
    if (!this.camera3D && this.enableDebug) {
      console.warn("[UI3DInteractionManager] 未找到3D相机");
    }
  }
  
  onEnable() {
    // 监听所有MOUSE事件
    this.node.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    this.node.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    this.node.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    this.node.on(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
    
    // 监听所有TOUCH事件
    this.node.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.on(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
  }

  onDisable() {
    // 解绑所有MOUSE事件
    this.node.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    this.node.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    this.node.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    this.node.off(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
    
    // 解绑所有TOUCH事件
    this.node.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.off(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
  }

  // ==================== 鼠标事件处理 ====================

  private onMouseDown(event: EventMouse): void {
    if (this.shouldPassToScene(event)) {
      this.emit3DInputEvent(EventTypes.Input3D.MouseDown, event);
    }
  }

  private onMouseUp(event: EventMouse): void {
    if (this.shouldPassToScene(event)) {
      this.emit3DInputEvent(EventTypes.Input3D.MouseUp, event);
    }
  }

  private onMouseMove(event: EventMouse): void {
    if (this.shouldPassToScene(event)) {
      this.emit3DInputEvent(EventTypes.Input3D.MouseMove, event);
    }
  }

  private onMouseWheel(event: EventMouse): void {
    if (this.shouldPassToScene(event)) {
      this.emit3DInputEvent(EventTypes.Input3D.MouseWheel, event);
    }
  }

  // ==================== 触摸事件处理 ====================

  private onTouchStart(event: EventTouch): void {
    if (this.shouldPassToScene(event)) {
      this.emit3DInputEvent(EventTypes.Input3D.TouchStart, event);
    }
  }

  private onTouchMove(event: EventTouch): void {
    if (this.shouldPassToScene(event)) {
      this.emit3DInputEvent(EventTypes.Input3D.TouchMove, event);
    }
  }

  private onTouchEnd(event: EventTouch): void {
    if (this.shouldPassToScene(event)) {
      this.emit3DInputEvent(EventTypes.Input3D.TouchEnd, event);
    }
  }

  private onTouchCancel(event: EventTouch): void {
    if (this.shouldPassToScene(event)) {
      this.emit3DInputEvent(EventTypes.Input3D.TouchCancel, event);
    }
  }

  // ==================== 核心判断和转发逻辑 ====================

  /**
   * 判断是否应该将事件传递给3D场景
   * @param event 输入事件
   * @returns true=传递给3D，false=由FairyGUI处理
   */
  private shouldPassToScene(event: EventTouch | EventMouse): boolean {
    // 检查是否点击在FairyGUI UI元素上
    const target = GRoot.inst.touchTarget;
    
    if (target && target !== GRoot.inst) {
      // 点击到UI元素，不传递给3D
      if (this.enableDebug) {
        console.log("[UI3DInteractionManager] 点击到FairyGUI UI元素:", target.name);
      }
      return false;
    }

    // 没点到UI元素或只点到GRoot（空白区域），传递给3D
    if (this.enableDebug) {
      console.log("[UI3DInteractionManager] 事件将传递给3D场景");
    }
    return true;
  }

  /**
   * 发送3D输入事件到EventBus
   * @param eventType 事件类型
   * @param originalEvent 原始输入事件
   */
  private emit3DInputEvent(eventType: string, originalEvent: EventTouch | EventMouse): void {
    const pos = originalEvent.getLocation();
    const uiPos = (originalEvent as any).getUILocation ? (originalEvent as any).getUILocation() : pos;
    
    // 构造3D输入事件数据
    const eventData: Input3DEventData = {
      type: eventType,
      screenX: pos.x,
      screenY: pos.y,
      uiX: uiPos.x,
      uiY: uiPos.y,
      originalEvent: originalEvent,
      timestamp: Date.now()
    };

    // 添加鼠标特有数据
    if (originalEvent instanceof EventMouse) {
      eventData.button = originalEvent.getButton();
      
      // 滚轮事件特殊处理
      if (eventType === EventTypes.Input3D.MouseWheel) {
        const wheelY = originalEvent.getScrollY();
        eventData.scrollDelta = { x: 0, y: wheelY };
      }
    }
    
    // 添加触摸特有数据
    if (originalEvent instanceof EventTouch) {
      eventData.touchId = originalEvent.getID();
    }

    // 通过EventBus发送事件（即时同步）
    EventBus.emitEvent(eventType, eventData);

    // 如果启用内置射线检测，执行射线检测并发送结果事件
    if (this.enableBuiltinRaycast && this.camera3D) {
      this.performRaycastAndEmit(uiPos.x, uiPos.y, eventType);
    }

    if (this.enableDebug) {
      console.log(`[UI3DInteractionManager] 发送3D输入事件: ${eventType}`, eventData);
    }
  }

  /**
   * 执行内置射线检测并发送结果事件
   * @param x UI坐标X
   * @param y UI坐标Y  
   * @param inputEventType 触发射线检测的输入事件类型
   */
  private performRaycastAndEmit(x: number, y: number, inputEventType: string): void {
    try {
      const ray = new geometry.Ray();
      this.camera3D.screenPointToRay(x, y, ray);

      // 构造射线检测事件数据
      const raycastData: RaycastEventData = {
        rayOrigin: { x: ray.o.x, y: ray.o.y, z: ray.o.z },
        rayDirection: { x: ray.d.x, y: ray.d.y, z: ray.d.z },
        rayDistance: this.maxRaycastDistance,
        hit: false,
        timestamp: Date.now()
      };

      // 执行物理射线检测
      if (PhysicsSystem.instance.raycast(ray, undefined, this.maxRaycastDistance)) {
        const results = PhysicsSystem.instance.raycastResults;
        if (results.length > 0) {
          const firstHit = results[0];
          
          raycastData.hit = true;
          raycastData.hitPoint = { 
            x: firstHit.hitPoint.x, 
            y: firstHit.hitPoint.y, 
            z: firstHit.hitPoint.z 
          };
          raycastData.hitNodeName = firstHit.collider.node.name;

          // 发送命中事件
          EventBus.emitEvent(EventTypes.Input3D.RaycastHit, raycastData);
          
          if (this.enableDebug) {
            console.log("[UI3DInteractionManager] 射线检测命中:", raycastData.hitNodeName);
          }
        } else {
          raycastData.hit = false;
        }
      }

      // 如果没有命中，发送未命中事件
      if (!raycastData.hit) {
        EventBus.emitEvent(EventTypes.Input3D.RaycastMiss, raycastData);
        
        if (this.enableDebug) {
          console.log("[UI3DInteractionManager] 射线检测未命中");
        }
      }

    } catch (error) {
      console.error("[UI3DInteractionManager] 射线检测出错:", error);
    }
  }
}