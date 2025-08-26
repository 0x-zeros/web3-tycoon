import { _decorator, Component, Graphics, Node, Vec3, Color, Touch, EventTouch, NodeEventType, UITransform, log as cclog } from 'cc';
import { physics } from '../../common/physics';
import { Vector, Bounds } from '../../common/math';
import { _ } from '../../common/lodash-compat';
import { GridRect } from './Actorgrid';

const { ccclass, property } = _decorator;


@ccclass('Path')
export default class Path extends Component {
    @property(Graphics)
    graphicsCtx: Graphics = null!;

    @property(Node)
    wallYNode: Node = null!;

    // Path properties
    private emitter: any = null;
    private bounds: any = null;
    private touchIdentifier: number = 0;
    private wallY: number = 0;
    private rebounceDirLen: number = 0;

    /**
     * 启用组件时注册触摸事件
     */
    onEnable(): void {
        this.node.on(NodeEventType.TOUCH_START, this.onDown, this);
        this.node.on(NodeEventType.TOUCH_END, this.onUp, this);
        this.node.on(NodeEventType.TOUCH_CANCEL, this.onUp, this);
        this.node.on(NodeEventType.TOUCH_MOVE, this.onMove, this);
    }

    /**
     * 禁用组件时注销触摸事件
     */
    onDisable(): void {
        this.node.off(NodeEventType.TOUCH_START, this.onDown, this);
        this.node.off(NodeEventType.TOUCH_END, this.onUp, this);
        this.node.off(NodeEventType.TOUCH_CANCEL, this.onUp, this);
        this.node.off(NodeEventType.TOUCH_MOVE, this.onMove, this);
    }

    /**
     * 初始化路径组件
     * @param emitter 发射器组件
     * @param gridRect 网格区域
     */
    init(emitter: any, gridRect: GridRect): void {
        this.emitter = emitter;
        this.bounds = Bounds.createBy(gridRect.x, gridRect.y, gridRect.width, gridRect.height);

        this.touchIdentifier = 0;
        this.wallY = this.wallYNode.getPosition().y;
        this.rebounceDirLen = game.grid.UNIT_ACTOR_PIXEL / 2;
    }

    /**
     * 绘制路径
     * @param dir 方向向量
     * @param touchPoint 触摸点
     */
    drawPath(dir: Vec3, touchPoint: Vec3): void {
        cclog('drawPath', dir, touchPoint);

        const startPoint = this.emitter.getPosition();
        const path = physics.queryMissilePath(startPoint, dir, this.rebounceDirLen);
        cclog('drawPath path ', path);

        // 清除之前的绘制
        const ctx = this.graphicsCtx;
        ctx.clear();

        // 根据触摸位置设置颜色
        if (touchPoint.y > this.wallY) {
            // 有效射击 - 青色
            ctx.fillColor = new Color(0, 255, 255, 255);
        } else {
            // 无效射击 - 红色
            ctx.fillColor = new Color(255, 0, 0, 255);
        }

        // 绘制路径点
        _.each(path, (p: Vec3) => {
            ctx.circle(p.x, p.y, 3);
        });

        ctx.fill();
    }

    /**
     * 清除路径绘制
     */
    clear(): void {
        this.touchIdentifier = 0;
        this.graphicsCtx.clear();
    }

    /**
     * 触摸开始事件处理
     * @param event 触摸事件
     */
    private onDown(event: EventTouch): void {
        cclog('path onDown');

        const roundStep = game.round.getStep();

        // 检查是否允许射击
        if (roundStep !== game.round.STEP_FIRE_MISSILE && roundStep !== game.round.STEP_PLAYER_USE_ANY_ROUND_SKILL) {
            return;
        }

        const pos = event.getLocation();
        // 将一个 UI 节点世界坐标系下点转换到另一个 UI 节点 (局部) 空间坐标系，这个坐标系以锚点为原点。 非 UI 节点转换到 UI 节点(局部) 空间坐标系，请走 Camera 的 `convertToUINode`。
        const touchPoint = this.node.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(pos.x, pos.y, 0));
        const touchPoint2D = new Vec3(touchPoint.x, touchPoint.y, 0);

        // 检查触摸点是否在有效区域内
        if (!Bounds.contains(this.bounds, touchPoint2D)) {
            return;
        }

        this.touchIdentifier = event.getID();
        const [dir, angle] = this.emitter.getBarrelDirAngle(touchPoint2D);
        
        cclog('path onDown', pos, touchPoint2D, dir, angle);
        
        this.emitter.rotateBarrelTo(angle, 0.1);
        this.drawPath(dir, touchPoint2D);
    }

    /**
     * 触摸移动事件处理
     * @param event 触摸事件
     */
    private onMove(event: EventTouch): void {
        if (event.getID() === this.touchIdentifier) {
            const pos = event.getLocation();
            // 将一个 UI 节点世界坐标系下点转换到另一个 UI 节点 (局部) 空间坐标系，这个坐标系以锚点为原点。 非 UI 节点转换到 UI 节点(局部) 空间坐标系，请走 Camera 的 `convertToUINode`。
            const touchPoint = this.node.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(pos.x, pos.y, 0));
            const touchPoint2D = new Vec3(touchPoint.x, touchPoint.y, 0);

            const [dir, angle] = this.emitter.getBarrelDirAngle(touchPoint2D);
            
            cclog('path onMove', pos, touchPoint2D, dir, angle);
            
            this.emitter.rotateBarrelTo(angle, -1);
            this.drawPath(dir, touchPoint2D);
        }
    }

    /**
     * 触摸结束事件处理
     * @param event 触摸事件
     */
    private onUp(event: EventTouch): void {
        if (event.getID() === this.touchIdentifier) {
            const pos = event.getLocation();
            //将一个 UI 节点世界坐标系下点转换到另一个 UI 节点 (局部) 空间坐标系，这个坐标系以锚点为原点。 非 UI 节点转换到 UI 节点(局部) 空间坐标系，请走 Camera 的 `convertToUINode`。
            const touchPoint = this.node.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(pos.x, pos.y, 0));
            const touchPoint2D = new Vec3(touchPoint.x, touchPoint.y, 0);

            if (touchPoint2D.y > this.wallY) {
                // 有效射击
                const [dir, angle] = this.emitter.getBarrelDirAngle(touchPoint2D);
                cclog('path onUp', pos, touchPoint2D, dir, angle);
                this.emitter.fireMissile(dir);
            } else {
                // 无效射击，重置炮筒角度
                this.emitter.rotateBarrelTo(0, 0.1);
            }

            this.clear();
        } else {
            this.clear();
        }
    }

    /**
     * 获取当前边界
     * @returns 边界对象
     */
    getBounds(): any {
        return this.bounds;
    }

    /**
     * 设置边界
     * @param bounds 新的边界
     */
    setBounds(bounds: any): void {
        this.bounds = bounds;
    }

    /**
     * 获取墙体Y坐标
     * @returns Y坐标值
     */
    getWallY(): number {
        return this.wallY;
    }

    /**
     * 设置墙体Y坐标
     * @param y Y坐标值
     */
    setWallY(y: number): void {
        this.wallY = y;
    }

    /**
     * 获取反弹方向长度
     * @returns 长度值
     */
    getRebounceDirLen(): number {
        return this.rebounceDirLen;
    }

    /**
     * 设置反弹方向长度
     * @param len 长度值
     */
    setRebounceDirLen(len: number): void {
        this.rebounceDirLen = len;
    }

    /**
     * 检查是否正在绘制路径
     * @returns 是否正在绘制
     */
    isDrawing(): boolean {
        return this.touchIdentifier !== 0;
    }

    /**
     * 强制结束路径绘制
     */
    forceFinish(): void {
        this.clear();
        if (this.emitter) {
            this.emitter.rotateBarrelTo(0, 0.1);
        }
    }
}