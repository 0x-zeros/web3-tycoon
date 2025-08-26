// Copy from matter-js
// http://brm.io/matter-js/docs/
// http://brm.io/matter-js/docs/classes/Vector.html
// http://brm.io/matter-js/docs/classes/Bounds.html

import { Vec2 } from 'cc';
import { Vec3, v3 } from 'cc';

/**
 * Vector interface
 */
export interface IVector {
    x: number;
    y: number;
}

/**
 * Bounds interface
 */
export interface IBounds {
    min: IVector;
    max: IVector;
}

type VectorLike = IVector | Vec3;

/**
 * The Vector class contains methods for creating and manipulating vectors.
 * Vectors are the basis of all the geometry related operations in the engine.
 */
export class Vector {
    //坐标轴： x轴向右，y轴向下
    //角度的正负： 顺时针为正，逆时针为负


    /**
     * 内部辅助方法：将任意向量类型转换为IVector
     */
    public static toIVector(vector: VectorLike): IVector {
        return { x: vector.x, y: vector.y };
    }

    /**
     * 将IVector转换为Vec3
     */
    public static toVec3(vector: IVector, z: number = 0): Vec3 {
        return v3(vector.x, vector.y, z);
    }

    /**
     * Vec3版本的lerp
     */
    public static lerpVec3(a: Vec3, b: Vec3, k: number): Vec3 {
        const result = Vector.lerp(a, b, k);
        return Vector.toVec3(result, a.z + (b.z - a.z) * k);
    }

    /**
     * Creates a new vector.
     */
    static create(x: number = 0, y: number = 0): IVector {
        return { x: x || 0, y: y || 0 };
    }

    /**
     * Returns a new vector with x and y copied from the given vector.
     */
    static clone(vector: VectorLike): IVector {
        const v = Vector.toIVector(vector);
        return { x: v.x, y: v.y };
    }

    /**
     * Returns the magnitude (length) of a vector.
     */
    static magnitude(vector: VectorLike): number {
        const v = Vector.toIVector(vector);
        return Math.sqrt((v.x * v.x) + (v.y * v.y));
    }

    /**
     * Returns the magnitude (length) of a vector (therefore saving a sqrt operation).
     */
    static magnitudeSquared(vector: VectorLike): number {
        const v = Vector.toIVector(vector);
        return (v.x * v.x) + (v.y * v.y);
    }

    /**
     * Rotates the vector about (0, 0) by specified angle.
     */
    static rotate(vector: VectorLike, angle: number, output?: IVector): IVector {
        const v = Vector.toIVector(vector);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        if (!output) output = {} as IVector;
        const x = v.x * cos - v.y * sin;
        output.y = v.x * sin + v.y * cos;
        output.x = x;
        return output;
    }

    /**
     * Rotates the vector about a specified point by specified angle.
     */
    static rotateAbout(vector: VectorLike, angle: number, point: VectorLike, output?: IVector): IVector {
        const v = Vector.toIVector(vector);
        const p = Vector.toIVector(point);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        if (!output) output = {} as IVector;
        const x = p.x + ((v.x - p.x) * cos - (v.y - p.y) * sin);
        output.y = p.y + ((v.x - p.x) * sin + (v.y - p.y) * cos);
        output.x = x;
        return output;
    }

    /**
     * Normalises a vector (such that its magnitude is 1).
     */
    static normalise(vector: VectorLike): IVector {
        const magnitude = Vector.magnitude(vector);
        if (magnitude === 0)
            return { x: 0, y: 0 };
        const v = Vector.toIVector(vector);
        return { x: v.x / magnitude, y: v.y / magnitude };
    }

    /**
     * Returns the dot-product of two vectors.
     */
    static dot(vectorA: VectorLike, vectorB: VectorLike): number {
        const a = Vector.toIVector(vectorA);
        const b = Vector.toIVector(vectorB);
        return (a.x * b.x) + (a.y * b.y);
    }

    /**
     * Returns the cross-product of two vectors.
     */
    static cross(vectorA: VectorLike, vectorB: VectorLike): number {
        const a = Vector.toIVector(vectorA);
        const b = Vector.toIVector(vectorB);
        return (a.x * b.y) - (a.y * b.x);
    }

    /**
     * Returns the cross-product of three vectors.
     */
    static cross3(vectorA: VectorLike, vectorB: VectorLike, vectorC: VectorLike): number {
        const a = Vector.toIVector(vectorA);
        const b = Vector.toIVector(vectorB);
        const c = Vector.toIVector(vectorC);
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }

    /**
     * Adds the two vectors.
     */
    static add(vectorA: VectorLike, vectorB: VectorLike, output?: IVector): IVector {
        const a = Vector.toIVector(vectorA);
        const b = Vector.toIVector(vectorB);
        if (!output) output = {} as IVector;
        output.x = a.x + b.x;
        output.y = a.y + b.y;
        return output;
    }

    /**
     * Subtracts the two vectors.
     */
    static sub(vectorA: VectorLike, vectorB: VectorLike, output?: IVector): IVector {
        const a = Vector.toIVector(vectorA);
        const b = Vector.toIVector(vectorB);
        if (!output) output = {} as IVector;
        output.x = a.x - b.x;
        output.y = a.y - b.y;
        return output;
    }

    /**
     * Multiplies a vector and a scalar.
     */
    static mult(vector: VectorLike, scalar: number): IVector {
        const v = Vector.toIVector(vector);
        return { x: v.x * scalar, y: v.y * scalar };
    }

    /**
     * Divides a vector and a scalar.
     */
    static div(vector: VectorLike, scalar: number): IVector {
        const v = Vector.toIVector(vector);
        return { x: v.x / scalar, y: v.y / scalar };
    }

    /**
     * Returns the perpendicular vector. Set negate to true for the perpendicular in the opposite direction.
     */
    static perp(vector: VectorLike, negate?: boolean): IVector {
        const v = Vector.toIVector(vector);
        const negateValue = negate === true ? -1 : 1;
        return { x: negateValue * -v.y, y: negateValue * v.x };
    }

    /**
     * Negates both components of a vector such that it points in the opposite direction.
     */
    static neg(vector: VectorLike): IVector {
        const v = Vector.toIVector(vector);
        return { x: -v.x, y: -v.y };
    }

    /**
     * Returns the angle in radians between the two vectors relative to the x-axis.
     */
    static angle(vectorA: VectorLike, vectorB: VectorLike): number {

        //坐标轴： x轴向右，y轴向下
        //角度的正负： 顺时针为正，逆时针为负

        
        //角度范围：-179, 179
        //             -90
        //   -179  -----------> 0
        //    179       90


        //常见角度
        //0
        //console.log('angle=', Vector.angle({x:0, y:0}, {x:1, y:0}) * 360 / (Math.PI * 2))

        //90
        //console.log('angle=', Vector.angle({x:0, y:0}, {x:0, y:1}) * 360 / (Math.PI * 2))

        //180
        //console.log('angle=', Vector.angle({x:0, y:0}, {x:-1, y:0}) * 360 / (Math.PI * 2))

        //-90
        //console.log('angle=', Vector.angle({x:0, y:0}, {x:0, y:-1}) * 360 / (Math.PI * 2))

        //-179.9999994270422
        //console.log('angle=', Vector.angle({x:0, y:0}, {x:-1, y:-0.00000001}) * 360 / (Math.PI * 2))


        const a = Vector.toIVector(vectorA);
        const b = Vector.toIVector(vectorB);
        return Math.atan2(b.y - a.y, b.x - a.x);
    }

    //这个实现有问题，先用下面专为Vec2的方式吧
    // /**
    //  * 计算向量相对于参考向量的带符号角度 (替代 Cocos2x 的 signAngle)
    //  * @param vector 要计算角度的向量
    //  * @param reference 参考向量
    //  * @returns 带符号角度，范围 [-π, π]
    //  */
    // static signAngle(vector: VectorLike, reference: VectorLike): number {
    //     const v = Vector.toIVector(vector);
    //     const r = Vector.toIVector(reference);
        
    //     // 计算向量的角度
    //     const vectorAngle = Math.atan2(v.y, v.x);
    //     const referenceAngle = Math.atan2(r.y, r.x);
        
    //     // 计算相对角度
    //     let angle = vectorAngle - referenceAngle;
        
    //     // 将角度标准化到 [-π, π] 范围
    //     while (angle > Math.PI) angle -= 2 * Math.PI;
    //     while (angle < -Math.PI) angle += 2 * Math.PI;
        
    //     return angle;
    // }

    /**
     * 计算向量相对于参考向量的带符号角度 (替代 Cocos2x 的 signAngle)
     * @param vector 要计算角度的向量
     * @param reference 参考向量
     * @returns 带符号角度，范围 [-π, π]
     */
    static signAngle(vector: Vec3, reference: Vec3): number {
        const v = new Vec2(vector.x, vector.y);
        const r = new Vec2(reference.x, reference.y);
        
        let angle = v.signAngle(r);
        
        return angle;
    }

    /**
     * lerp: vectorA -> vectorB的线性插值, k为[0, 1.0]
     */
    static lerp(vectorA: VectorLike, vectorB: VectorLike, k: number, output?: IVector): IVector {
        const a = Vector.toIVector(vectorA);
        const b = Vector.toIVector(vectorB);
        if (!output) output = {} as IVector;
        output.x = a.x + (b.x - a.x) * k;
        output.y = a.y + (b.y - a.y) * k;
        return output;
    }

    /**
     * Temporary vector pool (not thread-safe).
     */
    static _temp: IVector[] = [];
}

// Initialize temp pool
Vector._temp = [
    Vector.create(), Vector.create(),
    Vector.create(), Vector.create(),
    Vector.create(), Vector.create()
];

/**
 * The Bounds class contains methods for creating and manipulating axis-aligned bounding boxes (AABB).
 */
export class Bounds {
    /**
     * Creates a new axis-aligned bounding box (AABB) for the given vertices.
     */
    static create(vertices?: VectorLike[]): IBounds {
        const bounds: IBounds = {
            min: { x: 0, y: 0 },
            max: { x: 0, y: 0 }
        };

        if (vertices)
            Bounds.update(bounds, vertices);

        return bounds;
    }

    /**
     * Creates a new axis-aligned bounding box (AABB) for the given <x, y, width, height>.
     */
    static createBy(x: number, y: number, width: number, height: number): IBounds {
        const bounds: IBounds = {
            min: { x: x, y: y },
            max: { x: x + width, y: y + height }
        };

        return bounds;
    }

    /**
     * Updates bounds using the given vertices and extends the bounds given a velocity.
     */
    static update(bounds: IBounds, vertices: VectorLike[], velocity?: VectorLike): void {
        bounds.min.x = Infinity;
        bounds.max.x = -Infinity;
        bounds.min.y = Infinity;
        bounds.max.y = -Infinity;

        for (let i = 0; i < vertices.length; i++) {
            const vertex = Vector.toIVector(vertices[i]);
            if (vertex.x > bounds.max.x) bounds.max.x = vertex.x;
            if (vertex.x < bounds.min.x) bounds.min.x = vertex.x;
            if (vertex.y > bounds.max.y) bounds.max.y = vertex.y;
            if (vertex.y < bounds.min.y) bounds.min.y = vertex.y;
        }

        if (velocity) {
            const v = Vector.toIVector(velocity);
            if (v.x > 0) {
                bounds.max.x += v.x;
            } else {
                bounds.min.x += v.x;
            }

            if (v.y > 0) {
                bounds.max.y += v.y;
            } else {
                bounds.min.y += v.y;
            }
        }
    }

    /**
     * Returns true if the bounds contains the given point.
     */
    static contains(bounds: IBounds, point: VectorLike): boolean {
        const p = Vector.toIVector(point);
        return p.x >= bounds.min.x && p.x <= bounds.max.x
            && p.y >= bounds.min.y && p.y <= bounds.max.y;
    }

    /**
     * Returns true if the two bounds intersect.
     */
    static overlaps(boundsA: IBounds, boundsB: IBounds): boolean {
        return (boundsA.min.x <= boundsB.max.x && boundsA.max.x >= boundsB.min.x
            && boundsA.max.y >= boundsB.min.y && boundsA.min.y <= boundsB.max.y);
    }

    /**
     * Translates the bounds by the given vector.
     */
    static translate(bounds: IBounds, vector: VectorLike): void {
        const v = Vector.toIVector(vector);
        bounds.min.x += v.x;
        bounds.max.x += v.x;
        bounds.min.y += v.y;
        bounds.max.y += v.y;
    }

    /**
     * Shifts the bounds to the given position.
     */
    static shift(bounds: IBounds, position: VectorLike): void {
        const pos = Vector.toIVector(position);
        const deltaX = bounds.max.x - bounds.min.x;
        const deltaY = bounds.max.y - bounds.min.y;

        bounds.min.x = pos.x;
        bounds.max.x = pos.x + deltaX;
        bounds.min.y = pos.y;
        bounds.max.y = pos.y + deltaY;
    }
}

