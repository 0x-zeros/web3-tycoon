// PaperActor.ts（简化片段）
import { _decorator, Component, Camera, Node, Vec3, Quat } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('PaperActor')
export class PaperActor extends Component {
  @property(Camera) cam: Camera|null = null;
  @property(Node) card: Node|null = null;
  private _tmp = new Vec3();

  update() {
    if (!this.cam || !this.card) return;
    // 仅绕 Y 面向相机（等于水平朝向）
    const camPos = this.cam.node.worldPosition;
    const myPos = this.node.worldPosition;
    Vec3.subtract(this._tmp, camPos, myPos);
    this._tmp.y = 0; // 锁 Y
    this._tmp.normalize();
    // 计算目标 yaw
    const yaw = Math.atan2(this._tmp.x, this._tmp.z); // 绕Y的弧度
    this.card.setRotationFromEuler(0, yaw * 180 / Math.PI, 0);
  }
}