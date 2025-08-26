import { Vec3 } from 'cc';
import Actor from './Actor';

/**
 * 桶接口定义
 */
export interface IBucket {
    init(r: number, c: number, pos: Vec3, ps: number): void;
    set(r: number, c: number, pos: Vec3, showAni?: boolean): void;
    getGridX(): number;
    getGridY(): number;
    getPosition(): Vec3;
    getActorPosition(size: number): Vec3;
    setActor(a: any, mainFlag?: boolean): void;
    getActor(mainFlag?: boolean): any;
    moveActor(): boolean;
    clear(targetActor?: any, deleteActor?: boolean): void;
    debugDraw(parent: any): void;
}

/**
 * Bucket 类 - 网格桶实现
 */
export class Bucket implements IBucket {
    private rowIdx: number = 0;
    private columnIdx: number = 0;
    private pixelSize: number = 1; // UNIT_ACTOR_PIXEL
    private position: Vec3 | null = null;
    private actor: Actor | null = null;
    private actorMainControlFlag: boolean = true;

    /**
     * 初始化桶
     * @param r 行索引
     * @param c 列索引
     * @param pos 位置
     * @param ps 像素大小
     */
    init(r: number, c: number, pos: Vec3, ps: number): void {
        this.pixelSize = ps;
        this.set(r, c, pos);
    }

    /**
     * 设置桶的位置和索引
     * @param r 行索引
     * @param c 列索引
     * @param pos 位置（格子中心点）
     * @param showAni 是否显示动画
     */
    set(r: number, c: number, pos: Vec3, showAni?: boolean): void {
        this.rowIdx = r;
        this.columnIdx = c;
        this.position = pos;
    }

    /**
     * 获取网格X坐标（列索引）
     * @returns 列索引
     */
    getGridX(): number {
        return this.columnIdx;
    }

    /**
     * 获取网格Y坐标（行索引）
     * @returns 行索引
     */
    getGridY(): number {
        return this.rowIdx;
    }

    /**
     * 获取格子中心点位置
     * @returns 位置向量
     */
    getPosition(): Vec3 {
        return this.position!;
    }

    /**
     * 获取角色应该放置的位置
     * @param size 角色大小
     * @returns 位置向量
     */
    getActorPosition(size: number): Vec3 {
        if (size > 1) {
            const pos = new Vec3();
            const d = this.pixelSize * (size - 1) / 2;
            pos.x = this.position!.x + d;
            pos.y = this.position!.y + d;
            pos.z = this.position!.z; // 保留原始z值
            return pos;
        } else {
            return this.position!;
        }
    }

    /**
     * 设置角色到桶中
     * @param a 角色对象
     * @param mainFlag 是否为主控制标志（对于大于1格的角色，只有一个桶是主控制）
     */
    setActor(a: any, mainFlag: boolean = true): void {
        this.actor = a;
        this.actorMainControlFlag = mainFlag;
    }

    /**
     * 获取桶中的角色
     * @param mainFlag 是否只获取主控制角色
     * @returns 角色对象或null
     */
    getActor(mainFlag?: boolean): any {
        if (mainFlag) {
            if (this.actorMainControlFlag) {
                return this.actor;
            }
        } else {
            return this.actor;
        }
        return null;
    }

    /**
     * 移动桶中的角色
     * @returns 是否成功移动
     */
    moveActor(): boolean {
        if (this.actor && this.actorMainControlFlag) {
            const pos = this.getActorPosition(this.actor.getSize());
            // console.log('moveActor', pos);
            this.actor.moveTo(pos, game.effectManager.actorAni.walk);
            return true;
        }
        return false;
    }

    /**
     * 清除桶中的角色
     * @param targetActor 目标角色（用于验证）
     * @param deleteActor 是否删除角色
     */
    clear(targetActor?: any, deleteActor?: boolean): void {
        // 有可能该bucket已经被设置为别的actor了
        if (targetActor && targetActor !== this.actor) {
            return;
        }

        this.actorMainControlFlag = true;

        if (this.actor) {
            if (deleteActor) {
                this.actor.setDelete(true);
            }
            this.actor = null;
        }
    }

    /**
     * 调试绘制（暂未实现）
     * @param parent 父节点
     */
    debugDraw(_parent: any): void {
        // 预留的调试绘制功能
        // 在v3.8中可以使用Graphics组件来实现调试绘制
    }
}

/**
 * 创建桶对象的工厂函数（保持向后兼容）
 * @returns 桶对象实例
 */
export function bucket(): IBucket {
    return new Bucket();
}

/**
 * 桶工厂类
 */
export class BucketFactory {
    /**
     * 创建新的桶实例
     * @returns 桶对象
     */
    static create(): IBucket {
        return new Bucket();
    }

    /**
     * 创建并初始化桶实例
     * @param r 行索引
     * @param c 列索引
     * @param pos 位置
     * @param ps 像素大小
     * @returns 初始化后的桶对象
     */
    static createAndInit(r: number, c: number, pos: Vec3, ps: number): IBucket {
        const bucketInstance = new Bucket();
        bucketInstance.init(r, c, pos, ps);
        return bucketInstance;
    }
}