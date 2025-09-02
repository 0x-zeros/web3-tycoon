import { _decorator, Component, input, Input, EventTouch, EventMouse, Camera, geometry, PhysicsSystem, find} from 'cc';
import { GRoot } from 'fairygui-cc';   // 路径根据你的工程里 fairygui 的导入方式调整

const { ccclass, property } = _decorator;

@ccclass('UI3DInteractionManager')
export class UI3DInteractionManager extends Component {
  @property(Camera)
  camera3D!: Camera;   // 指向你的 3D 相机


  start() {
    console.log("[UI3DInteractionManager] start");
    this.camera3D = find("scene/Main Camera")!.getComponent(Camera)!;
  }
  
  onEnable () {
    // 注册全局输入事件
    // input.on(Input.EventType.TOUCH_START, this.onTouchOrMouse, this);
    // input.on(Input.EventType.MOUSE_DOWN, this.onTouchOrMouse, this);

    this.node.on(Input.EventType.TOUCH_START, this.onTouchOrMouse, this);
    this.node.on(Input.EventType.MOUSE_DOWN, this.onTouchOrMouse, this);
  }

  onDisable () {
    // 注销全局输入事件
    this.node.off(Input.EventType.TOUCH_START, this.onTouchOrMouse, this);
    this.node.off(Input.EventType.MOUSE_DOWN, this.onTouchOrMouse, this);
  }

  private onTouchOrMouse(event: EventTouch | EventMouse) {
    const pos = event.getLocation();

    // 1️⃣ 检查是否点击在 FairyGUI UI 上
    const target = GRoot.inst.touchTarget;
    if (target &&  target !== GRoot.inst) {
      console.log("[UI3DInteractionManager] 点击到 FairyGUI UI 元素:", target.name);
      // ✅ FairyGUI 消费事件，不往 3D 传递
      return;
    }

    //!target || target === GRoot.inst
    // 2️⃣ 没点到 UI → 进行 3D 射线检测
    this.raycast3D(pos.x, pos.y);
  }

  private raycast3D(x: number, y: number) {
    if (!this.camera3D) {
      console.warn("[UI3DInteractionManager] 3D 相机未设置");
      return;
    }

    const ray = new geometry.Ray();
    this.camera3D.screenPointToRay(x, y, ray);

    if (PhysicsSystem.instance.raycast(ray)) {
      for (const res of PhysicsSystem.instance.raycastResults) {
        console.log("[UI3DInteractionManager] 3D 点击到:", res.collider.node.name);
        // TODO: 这里可以派发事件或调用你自己的点击处理逻辑
        break;
      }
    } else {
      console.log("[UI3DInteractionManager] 没有点到任何 3D 对象");
    }
  }
}