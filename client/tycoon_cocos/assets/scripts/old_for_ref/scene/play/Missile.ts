import { _decorator, Component, Sprite, SpriteAtlas, Vec3, log } from 'cc';
import { utils } from '../../common/utils';
import { Vector, Bounds } from '../../common/math';
import { _ } from '../../common/lodash-compat';

const { ccclass, property } = _decorator;

interface CollisionInfo {
    actor: any;
    p: Vec3;
    i: number;
    distance: number;
}

@ccclass('Missile')
export default class Missile extends Component {
    @property(Sprite)
    icon: Sprite = null;

    @property(SpriteAtlas)
    atlas: SpriteAtlas = null;

    // Properties
    id: number = 0;
    deleteflag: boolean = false; // 生存期以及pool管理flag
    damage: number = 0;
    velocity: Vec3 = new Vec3();

    init(missileDamage: number, dir: Vec3, startSpeed: number, spawnPosition: Vec3): void {
        this.id = game.nextId();

        this.deleteflag = false; // 生存期以及pool管理flag
        this.damage = missileDamage;

        // console.log('dir', dir instanceof Vec3, dir); //? 不是Vec3 _.clone(dir) 导致的，类型丢失了
        dir.normalize();
        this.velocity = dir.multiplyScalar(startSpeed); // 80的速度一帧能测到最多跑3个格子

        log('missile init', spawnPosition);
        this.node.setPosition(spawnPosition.x, spawnPosition.y);

        this.initShow();
    }

    getDamage(): number {
        return this.damage;
    }

    initShow(): void {
        let damage = this.damage;
        damage = utils.clamp(damage, 1, 6);
        let key = 'zidan_0' + damage; // zidan_01 - zidan_06
        this.icon.spriteFrame = this.atlas.getSpriteFrame(key);
    }

    gameloop(delta: number): void {
        if (this.deleteflag)
            return;

        let nodePosition = this.node.position;
        let prev_position = Vector.toVec3(Vector.create(nodePosition.x, nodePosition.y));
        let v = Vector.toVec3(Vector.mult(this.velocity, delta * 100));
        let position = Vector.toVec3(Vector.add(prev_position, v));

        let bounds = Bounds.create([prev_position, position]); // todo cache

        // 如果速度太快, 一帧跑了一两个格的情况, 当然一帧的距离就超过playarea之类的情况(或者三四格, 因为要考虑多次反弹), 就很难做了, 不考虑
        // 基本上控制速度一帧在一格之内是最好的, 不过现在的实现对应3个以为的格子基本没有问题, 因为missile的当前position的actor为空是基本的假定
        let overLayList = game.grid.queryOverlapBounds(bounds);
        // console.log('overLayList', overLayList ? overLayList.length: 0, Vector.magnitude(Vector.sub(prev_position, position)))
        if (overLayList && overLayList.length > 0) {
            let actors: CollisionInfo[] = [];
            _.each(overLayList, (a: any) => {
                let [p, intersectLineIdx, distance] = a.collisionHelpLines.queryLineIntersectNearest(prev_position, position);

                // 有碰撞点了
                if (p) {
                    let c: CollisionInfo = {
                        actor: a,
                        p: Vector.toVec3(p),
                        i: intersectLineIdx,
                        distance: distance
                    };

                    actors.push(c);
                }
            });

            if (actors.length > 1) {
                // sort //距离从近到远排序
                actors.sort((c1, c2) => {
                    return c1.distance - c2.distance;
                });
            }

            // process hit actors
            for (let i = 0; i < actors.length; i++) {
                let c = actors[i];
                let a = c.actor;
                if (a.rebounce) {
                    // 碰到第一个rebounce的, 就反弹回去
                    [position, this.velocity] = a.doRebounce(c.i, c.p, position, this.velocity);
                    position = this._checkRebouncePosition(position, c.p, prev_position);
                    // music.playEffect(music.clipNames.missile_rebounce)
                    game.audioManager.playEffect('mission');

                    a.hit(this, c.p, c.i);
                    this.hit(a, c.p, c.i);

                    break;
                } else {
                    // item/skill等
                    a.hit(this);
                    this.hit(a);
                }
            }
        }

        // 需要保证一定被删掉或者在playarea内, 不然游戏会卡住
        // 是否在walls的下方
        if (game.rebounceWall.isMissileLost(position)) {
            // console.log('isMissileLost', that.velocity.y)

            // 反弹回来要被删掉了
            if (this.velocity.y < 0) { // 速度方向是向下
                this.deleteflag = true;
                return;
            }
            // else: 刚出生, 向上move中
        } else {
            // check vs wall的碰撞
            if (!game.rebounceWall.contains(position)) { // 反弹
                let intersectPosition: Vec3;
                [position, this.velocity, intersectPosition] = game.rebounceWall.doRebounce(prev_position, position, this.velocity);
                // music.playEffect(music.clipNames.missile_rebounce)
                game.audioManager.playEffect('mission');
                position = this._checkRebouncePosition(position, intersectPosition, prev_position);
            }
            // else //在play区域里面, 不需要做特殊处理
        }

        // 更新显示位置, 调整显示层次
        if (this.node.parent === game.playground.missileOverlay) {
            if (position.y > game.grid.lastRowUpY) {
                this.node.removeFromParent();
                game.playground.missile.addChild(this.node);
            }
        }

        this.node.setPosition(position.x, position.y);
    }

    // 如果计算得到的反弹的点在某个actor内部, 或者out of playArea, 为了简单, 就直接使用之前计算得到的线段交点
    _checkRebouncePosition(position: Vec3, intersectPoint: Vec3, prev_position: Vec3): Vec3 {
        if (game.rebounceWall.isOutScreen(position)) {
            console.warn('_checkRebouncePosition: ', position);

            // 直接返回intersectPoint 会出现(子弹有时候会卡在怪身上，怪瞬间空血)的bug, 需要返回一个
            // 不在线上, 也不在阻挡里的点, 因此计算一个 prev->intersect上的点应该是安全的, 因为rebounce会导致v变化,
            // 因此也不会卡住?
            return Vector.lerpVec3(prev_position, intersectPoint, 0.8); // intersectPoint;
        } else {
            // contains in
            let a = game.grid.queryContainsActor(position);
            if (a) {
                console.warn('_checkRebouncePosition: ', position);
                return Vector.lerpVec3(prev_position, intersectPoint, 0.8); // intersectPoint;
            }
        }

        return position;
    }

    // actor, 碰撞的点, 和Actor哪条边碰撞的(从下方开始的顺时针, 1,2,3,4)
    hit(actor: any, p?: Vec3, lineIdx?: number): void {
        // log('in missile_hit: actor ' + actor.id + ' hit by missile ' + that.id);
    }

    isDelete(): boolean {
        return this.deleteflag;
    }

    setDelete(flag: boolean): void {
        this.deleteflag = flag;
    }
}