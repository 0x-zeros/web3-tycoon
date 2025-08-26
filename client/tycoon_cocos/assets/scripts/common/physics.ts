import { Bounds, Vector, IVector, IBounds } from "./math";
import { v3, view, log } from 'cc';

// Physics utilities for game collision and ray casting

// 导出接口以保持向后兼容
export interface CollisionLines {
    bounds: IBounds;
    initWithActor: (x: number, y: number, width: number, height: number) => void;
    initWithWalls: (p: IVector[]) => void;
    updateActorLines: (x: number, y: number, width: number, height: number) => void;
    queryRebouncePath: (startPoint: IVector, rayDir: IVector, rayLength: number, stepLength: number) => IVector[] | null;
    queryLineIntersect: (p2: IVector, p3: IVector, asRay?: boolean) => [IVector | null, number];
    queryLineIntersectNearest: (p2: IVector, p3: IVector) => [IVector | null, number, number];
    fixVelocity: (idx: number, position: IVector, velocity: IVector) => void;
}

/**
 * 物理工具类 - 包含纯函数工具方法
 */
class PhysicsUtils {
    /**
     * 计算线段绘制点
     */
    static calcLineDrawPoint(p0: IVector, p1: IVector, stepLength?: number): IVector[] {
        const list: IVector[] = [p0];
        const p01 = Vector.sub(p1, p0);
        const mag = Vector.magnitude(p01);

        if (!stepLength || mag < stepLength) {
            // list.push(p1);
        } else {
            // adjust stepLength, 使之尽量均匀
            const step = Math.floor(mag / stepLength);
            const remainder = mag - (stepLength * step);
            stepLength += remainder / step;

            // 点的插值
            const dir = Vector.div(p01, mag);
            for (let i = 1; i < step; i++) {
                const p = Vector.add(p0, Vector.mult(dir, stepLength * i));
                list.push(p);
            }
        }

        list.push(p1);
        return list;
    }

    /**
     * 根据方向计算线段绘制点
     */
    static calcLineDrawPointByDir(p0: IVector, dir: IVector, stepLength: number, step: number, list: IVector[]): void {
        // normalize
        dir = Vector.normalise(dir);

        for (let i = 1; i <= step; i++) {
            const p = Vector.add(p0, Vector.mult(dir, stepLength * i));
            list.push(p);
        }
    }

    /**
     * 计算线段相交点
     */
    static calcLineIntersect(p0: IVector, p1: IVector, p2: IVector, p3: IVector): IVector | null {
        // 参考windows游戏编程大师技巧2D.pdf p685
        const s1 = Vector.sub(p1, p0);
        const s2 = Vector.sub(p3, p2);

        const num = -s2.x * s1.y + s1.x * s2.y;
        const s = (-s1.y * (p0.x - p2.x) + s1.x * (p0.y - p2.y)) / num;
        const t = (s2.x * (p0.y - p2.y) - s2.y * (p0.x - p2.x)) / num;

        let p: IVector | null = null;
        // 如果s和t都>=0并且<=1, 有交点
        if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
            p = Vector.add(p0, Vector.mult(s1, t));
        }

        return p;
    }
}

/**
 * 线段类 - 用于物理碰撞计算
 */
class Line {
    private _start: IVector;
    private _end: IVector;
    private _rebounceFunc?: (myPos: IVector, tarPos: IVector, tarV: IVector) => void;
    private _n: IVector; // 法向量

    constructor(start: IVector, end: IVector, rebounce: string | null = null) {
        this._start = v3(start.x, start.y, 0);
        this._end = v3(end.x, end.y, 0);
        this._n = this.perp(this._start, this._end); // cache 法向量
        
        if (rebounce) {
            this._rebounceFunc = this.getRebounceFunc(rebounce);
        }
    }

    // Getters
    get start(): IVector { return this._start; }
    get end(): IVector { return this._end; }
    get n(): IVector { return this._n; }
    get rebounceFunc() { return this._rebounceFunc; }

    /**
     * 更新线段端点
     */
    updatePoint(start: IVector, end: IVector, updateN: boolean = false): void {
        this._start = v3(start.x, start.y, 0);
        this._end = v3(end.x, end.y, 0);

        // actor方向并不会动,法向量n不需要重新计算了
        if (updateN) {
            this._n = this.perp(this._start, this._end); // cache 法向量
        }
    }

    /**
     * 查询反弹路径
     */
    queryRebouncePath(startPoint: IVector, rayDir: IVector, rayLength: number, stepLength: number): IVector[] | null {
        const p = this.rayIntersectLine(startPoint, rayDir, rayLength);
        let path: IVector[] | null = null;

        if (p) {
            // 反弹
            const n = this._n;
            const i = Vector.sub(startPoint, p); // 交点->startPoint
            const dot = Vector.dot(n, i);

            // pixijs//<0, 只有在钝角的情况下才反弹//注意y轴是向下的, 和书上有些不一样
            if (dot >= 0) {
                const rebounceDir = this.reflect(rayDir);

                path = PhysicsUtils.calcLineDrawPoint(startPoint, p, stepLength);
                PhysicsUtils.calcLineDrawPointByDir(p, rebounceDir, stepLength, 3, path);
            }
        }

        return path;
    }

    /**
     * 获取反弹函数
     */
    private getRebounceFunc(rebounce: string): (myPos: IVector, tarPos: IVector, tarV: IVector) => void {
        const rebounceRight = (myPos: IVector, tarPos: IVector, tarV: IVector) => {
            if (tarPos.x < myPos.x) {
                tarV.x = -tarV.x;
            }
        };

        const rebounceLeft = (myPos: IVector, tarPos: IVector, tarV: IVector) => {
            if (tarPos.x > myPos.x) {
                tarV.x = -tarV.x;
            }
        };

        const rebounceDown = (myPos: IVector, tarPos: IVector, tarV: IVector) => {
            if (tarPos.y > myPos.y) {
                tarV.y = -tarV.y;
            }
        };

        const rebounceUp = (myPos: IVector, tarPos: IVector, tarV: IVector) => {
            if (tarPos.y < myPos.y) {
                tarV.y = -tarV.y;
            }
        };

        const rFuncs: { [key: string]: (myPos: IVector, tarPos: IVector, tarV: IVector) => void } = {
            right: rebounceRight,
            left: rebounceLeft,
            down: rebounceDown,
            up: rebounceUp
        };

        return rFuncs[rebounce];
    }

    /**
     * 计算矢量的法向量(逆时针的90度)
     */
    private perp(p0: IVector, p1: IVector, normalise: boolean = true): IVector {
        const p01 = Vector.sub(p1, p0);
        let n = { x: -p01.y, y: p01.x };

        if (normalise) {
            const len = Math.sqrt((n.x * n.x + n.y * n.y));
            n = { x: n.x / len, y: n.y / len }; // 法向量
        }

        return n;
    }

    /**
     * 射线/线段的相交点
     */
    private rayIntersectLine(rayStart: IVector, rayDir: IVector, rayLength: number): IVector | null {
        const p0 = this._start;
        const p1 = this._end;
        const p2 = rayStart;
        const p3 = Vector.add(p2, Vector.mult(rayDir, rayLength));

        const p = PhysicsUtils.calcLineIntersect(p0, p1, p2, p3);
        return p;
    }

    /**
     * rayDir在line上的反射
     */
    private reflect(rayDir: IVector): IVector {
        // 计算line的法向量
        const n = this._n;

        // 计算反射
        const tmp = -2 * (rayDir.x * n.x + rayDir.y * n.y);
        const f = Vector.add(Vector.mult(n, tmp), rayDir);
        return f;
    }
}

/**
 * 碰撞线段管理类
 */
class CollisionLinesImpl implements CollisionLines {
    private lines: Line[] = [];
    private _bounds: IBounds;

    constructor() {
        this._bounds = { x: 0, y: 0, width: 0, height: 0 };
    }

    get bounds(): IBounds {
        return this._bounds;
    }

    set bounds(value: IBounds) {
        this._bounds = value;
    }

    /**
     * 用Actor初始化碰撞线段
     */
    initWithActor(x: number, y: number, width: number, height: number): void {
        x = x - width / 2;
        y = y - height / 2;
        const p = [
            { x: x, y: y + height },
            { x: x + width, y: y + height },
            { x: x + width, y: y },
            { x: x, y: y }
        ];

        // 从下方开始的顺时针 //保持左边反弹
        this.lines.length = 0;
        this.lines.push(new Line(p[2], p[3], 'down'));
        this.lines.push(new Line(p[3], p[0], 'left'));
        this.lines.push(new Line(p[0], p[1], 'up'));
        this.lines.push(new Line(p[1], p[2], 'right'));

        this._bounds = Bounds.createBy(p[3].x, p[3].y, p[1].x - p[3].x, p[1].y - p[3].y);
    }

    /**
     * 用墙体初始化碰撞线段
     */
    initWithWalls(p: IVector[]): void {
        // 保持左边反弹
        this.lines.length = 0;
        this.lines.push(new Line(p[2], p[1], 'left'));
        this.lines.push(new Line(p[1], p[0], 'down'));
        this.lines.push(new Line(p[0], p[3], 'right'));

        this._bounds = Bounds.createBy(p[3].x, p[3].y, p[1].x - p[3].x, p[1].y - p[3].y);
        log('initWithWalls bounds', this._bounds);
    }

    /**
     * 更新Actor线段位置
     */
    updateActorLines(x: number, y: number, width: number, height: number): void {
        x = x - width / 2;
        y = y - height / 2;
        const p = [
            { x: x, y: y + height },
            { x: x + width, y: y + height },
            { x: x + width, y: y },
            { x: x, y: y }
        ];

        this.lines[0].updatePoint(p[2], p[3]);
        this.lines[1].updatePoint(p[3], p[0]);
        this.lines[2].updatePoint(p[0], p[1]);
        this.lines[3].updatePoint(p[1], p[2]);

        this._bounds = Bounds.createBy(p[3].x, p[3].y, p[1].x - p[3].x, p[1].y - p[3].y);
    }

    /**
     * 查询反弹路径
     */
    queryRebouncePath(startPoint: IVector, rayDir: IVector, rayLength: number, stepLength: number): IVector[] | null {
        for (let i = 0; i < this.lines.length; i++) {
            const l = this.lines[i];
            const path = l.queryRebouncePath(startPoint, rayDir, rayLength, stepLength);
            if (path) {
                return path;
            }
        }
        return null;
    }

    /**
     * 查询线段相交
     */
    queryLineIntersect(p2: IVector, p3: IVector, asRay: boolean = true): [IVector | null, number] {
        if (asRay) {
            // protect 由于物理引擎穿透的存在, 适当延长p2->p3的长度来计算
            const dir = Vector.normalise(Vector.sub(p3, p2));
            const dirLen = view.getVisibleSize().width + view.getVisibleSize().height;
            p3 = Vector.add(p2, Vector.mult(dir, dirLen));
        }

        for (let i = 0; i < this.lines.length; i++) {
            const l = this.lines[i];
            const p = PhysicsUtils.calcLineIntersect(l.start, l.end, p2, p3);
            if (p) {
                return [p, i];
            }
        }

        return [null, this.lines.length]; // 并没有lines.length这个side, 超出范围就行
    }

    /**
     * 查询最近的线段相交点
     */
    queryLineIntersectNearest(p2: IVector, p3: IVector): [IVector | null, number, number] {
        let np: IVector | null = null;
        let ni = -1;
        let distance = Infinity;
        const subOutput = {} as IVector;

        for (let i = 0; i < this.lines.length; i++) {
            const l = this.lines[i];
            const p = PhysicsUtils.calcLineIntersect(l.start, l.end, p2, p3);
            if (p) {
                Vector.sub(p, p2, subOutput);
                const d = Vector.magnitudeSquared(subOutput);
                if (d < distance) {
                    np = p;
                    ni = i;
                    distance = d;
                } else if (Math.abs(d - distance) < 0.01) {
                    console.error('collision at rectangle corner!');
                }
            }
        }

        return [np, ni, distance];
    }

    /**
     * 修正速度
     */
    fixVelocity(idx: number, position: IVector, velocity: IVector): void {
        const l = this.lines[idx];
        if (l && l.rebounceFunc) {
            l.rebounceFunc(l.start, position, velocity);
        }
    }
}

/**
 * 物理系统管理类
 */
class PhysicsManager {
    /**
     * 查询导弹路径
     */
    queryMissilePath(startPoint: IVector, rayDir: IVector, stepLength: number): IVector[] | null {
        const QUERY_MISSILE_PATH_RAY_LENGTH = view.getVisibleSize().width + view.getVisibleSize().height;

        // vs actors
        let path = game.grid?.queryRebouncePath(startPoint, rayDir, QUERY_MISSILE_PATH_RAY_LENGTH, stepLength);

        // vs wall
        if (!path) {
            path = game.rebounceWall?.queryRebouncePath(startPoint, rayDir, QUERY_MISSILE_PATH_RAY_LENGTH, stepLength);
        }

        return path;
    }
}

// 导出类
export { PhysicsUtils, Line, CollisionLinesImpl };

// 向后兼容的工厂函数
export const line = (start: IVector, end: IVector, rebounce: string | null = null): Line => {
    return new Line(start, end, rebounce);
};

export const collision_lines = (): CollisionLines => {
    return new CollisionLinesImpl();
};

// 导出物理系统单例
export const physics = new PhysicsManager();