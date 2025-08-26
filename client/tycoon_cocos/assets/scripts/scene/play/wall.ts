import { _decorator, Vec3 } from 'cc';
import { Vector, Bounds } from '../../common/math';
import { line, collision_lines } from '../../common/physics';

const { ccclass } = _decorator;

interface GridRect {
    x: number;
    y: number;
    width: number;
    height: number;
}


/**
 * 墙体类 - 处理碰撞检测和反弹逻辑
 * 适配Cocos Creator v3.8
 */
@ccclass('Wall')
export default class Wall {
    private points: Vec3[] = [];
    private collisionHelpLines: any = null;
    private missileLostY: number = 0;

    /**
     * 创建墙体
     * @param gridRect 网格区域
     */
    create(gridRect: GridRect): void {
        // 创建墙体的四个角点
        // 0   1
        //
        // 3   2
        const points: Vec3[] = [];
        points.push(new Vec3(gridRect.x, gridRect.y + gridRect.height, 0)); // 左上
        points.push(new Vec3(gridRect.x + gridRect.width, gridRect.y + gridRect.height, 0)); // 右上
        points.push(new Vec3(gridRect.x + gridRect.width, gridRect.y, 0)); // 右下
        points.push(new Vec3(gridRect.x, gridRect.y, 0)); // 左下

        this.points = points;

        // 初始化碰撞检测辅助线
        const lines = collision_lines();
        lines.initWithWalls(points);
        this.collisionHelpLines = lines;

        // 设置导弹丢失的Y坐标（已经反弹过一次的子弹落入该区域会被删掉）
        this.missileLostY = gridRect.y;
    }

    /**
     * 获取左下角位置
     * @returns 左下角位置
     */
    getLeftBottomPosition(): Vec3 {
        return this.points[3];
    }

    /**
     * 获取右下角位置
     * @returns 右下角位置
     */
    getRightBottomPosition(): Vec3 {
        return this.points[2];
    }

    /**
     * 查询反弹路径
     * @param startPoint 起始点
     * @param rayDir 射线方向
     * @param rayLength 射线长度
     * @param stepLength 步长
     * @returns 反弹路径或null
     */
    queryRebouncePath(startPoint: Vec3, rayDir: Vec3, rayLength: number, stepLength: number): any {
        return this.collisionHelpLines.queryRebouncePath(startPoint, rayDir, rayLength, stepLength);
    }

    /**
     * 检查点是否在墙体内
     * @param p 检查的点
     * @returns 是否包含
     */
    contains(p: Vec3): boolean {
        return Bounds.contains(this.collisionHelpLines.bounds, p);
    }

    /**
     * 检查点是否在屏幕外
     * @param p 检查的点
     * @returns 是否在屏幕外
     */
    isOutScreen(p: Vec3): boolean {
        return !Bounds.contains(game.playground.bounds, p);
    }

    /**
     * 检查导弹是否丢失
     * @param p 导弹位置
     * @returns 是否丢失
     */
    isMissileLost(p: Vec3): boolean {
        if (p.y < this.missileLostY) {
            return true;
        }
        return false;
    }

    /**
     * 执行反弹计算
     * @param prev_position 前一个位置
     * @param position 当前位置
     * @param velocity 速度向量
     * @returns [新位置, 新速度, 交点位置] 或 [原位置, 原速度]
     */
    doRebounce(prev_position: Vec3, position: Vec3, velocity: Vec3): [Vec3, Vec3, Vec3?] {
        const lines = this.collisionHelpLines;
        const [intersectPosition, intersectLineIdx] = lines.queryLineIntersect(prev_position, position, false);

        if (intersectPosition) {
            // 转换为IVector进行计算
            let newVelocity = Vector.clone(velocity);
            lines.fixVelocity(intersectLineIdx, position, newVelocity);

            const distance = Vector.magnitude(Vector.sub(position, intersectPosition));
            let newPosition = Vector.add(intersectPosition, Vector.mult(Vector.normalise(newVelocity), distance));

            // 如果newPosition还是在playarea范围外(比如左上角/右上角的反弹)，直接翻转Velocity，再计算一遍
            if (!this.contains(Vector.toVec3(newPosition))) {
                newVelocity = Vector.mult(velocity, -1);
                newPosition = Vector.add(intersectPosition, Vector.mult(Vector.normalise(newVelocity), distance));
            }

            // 转换回Vec3类型返回
            return [
                Vector.toVec3(newPosition), 
                Vector.toVec3(newVelocity), 
                Vector.toVec3(intersectPosition)
            ];
        }

        return [position, velocity];
    }

    /**
     * 获取所有墙体点
     * @returns 点数组
     */
    getPoints(): Vec3[] {
        return [...this.points];
    }

    /**
     * 获取碰撞辅助线对象
     * @returns 碰撞辅助线
     */
    getCollisionHelpLines(): any {
        return this.collisionHelpLines;
    }

    /**
     * 获取导弹丢失Y坐标
     * @returns Y坐标
     */
    getMissileLostY(): number {
        return this.missileLostY;
    }

    /**
     * 设置导弹丢失Y坐标
     * @param y Y坐标
     */
    setMissileLostY(y: number): void {
        this.missileLostY = y;
    }

    /**
     * 获取墙体边界
     * @returns 边界对象
     */
    getBounds(): any {
        return this.collisionHelpLines ? this.collisionHelpLines.bounds : null;
    }

    /**
     * 检查两点之间是否有墙体阻挡
     * @param startPoint 起始点
     * @param endPoint 结束点
     * @returns 是否有阻挡
     */
    isBlocked(startPoint: Vec3, endPoint: Vec3): boolean {
        const lines = this.collisionHelpLines;
        if (lines) {
            const [intersectPosition] = lines.queryLineIntersect(startPoint, endPoint, false);
            return !!intersectPosition;
        }
        return false;
    }

    /**
     * 获取最近的墙体交点
     * @param startPoint 起始点
     * @param endPoint 结束点
     * @returns 交点位置或null
     */
    getClosestIntersection(startPoint: Vec3, endPoint: Vec3): Vec3 | null {
        const lines = this.collisionHelpLines;
        if (lines) {
            const [intersectPosition] = lines.queryLineIntersect(startPoint, endPoint, false);
            return intersectPosition || null;
        }
        return null;
    }

    /**
     * 销毁墙体资源
     */
    destroy(): void {
        this.points = [];
        this.collisionHelpLines = null;
    }
}