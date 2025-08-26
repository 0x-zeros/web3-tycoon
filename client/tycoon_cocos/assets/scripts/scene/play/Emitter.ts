import { _decorator, Component, Node, Vec3, log } from 'cc';
import { Vector, Bounds } from '../../common/math';
import EmitterLevel from './EmitterLevel';
import { utils } from '../../common/utils';
import { _ } from '../../common/lodash-compat';

const { ccclass, property } = _decorator;

@ccclass('Emitter')
export default class Emitter extends Component {
    @property([EmitterLevel])
    level: EmitterLevel[] = [];

    // Role reference
    role: any = null;

    // Missile management
    missiles: any[] = [];

    // Barrel properties
    barrelMatrix: any = null;
    barrels: any[] = []; // 炮管(1, 2, 3)
    barrel: EmitterLevel = null;

    // Initial values - set only in init when no buff bonuses
    private _barrelCount: number = 1;
    private _emitCount: number = 0;
    private _missileDamage: number = 0;

    // Current values affected by buffs
    barrelCount: number = 1; // 炮管数//level
    emitCount: number = 0; // 每炮的子弹数
    missileDamage: number = 0; // 子弹的攻击力加成

    max_extra_damage: number = 0;
    missileDelay: number = 0;

    // Position
    position: Vec3 = new Vec3();

    // Missile properties
    missileStartSpeed: number = 0;

    // Direction vectors
    upDirNew: Vec3 = new Vec3(0, 1, 0);

    // Rotation angles
    leftAngle: number = 0;
    rightAngle: number = 0;

    // Next missile tracking
    nextMissileCount: number = 1;

    init(role: any): void {
        this.role = role;

        this.missiles = [];

        this.barrelMatrix = null;
        this.barrels = []; // 炮管(1, 2, 3)

        // 初始值, 在无buf加成的时候, 只在init里面设置
        this._barrelCount = 1;
        this._emitCount = game.config.emitter.missile_count;
        this._missileDamage = game.config.missile.damage;

        this.barrelCount = 1; // 炮管数//level
        this.emitCount = this._emitCount; // 每炮的子弹数
        this.missileDamage = 0; // 子弹的攻击力加成

        this.max_extra_damage = game.config.missile.max_extra_damage;

        this.missileDelay = game.config.emitter.missile_delay;

        // Calculate position
        // 在Cocos Creator 3.x中，convertToWorldSpaceAR和convertToNodeSpaceAR API被移除
        // 需要使用世界变换矩阵进行坐标转换
        let lPos = this.node.position;
        // 将本地坐标转换为世界坐标：使用父节点的世界矩阵变换本地坐标
        let parentTransform = this.node.parent.getWorldMatrix();
        let wPos = new Vec3();
        Vec3.transformMat4(wPos, lPos, parentTransform);
        
        // 将世界坐标转换为playground节点的本地坐标：使用playground逆矩阵变换世界坐标
        let playgroundTransform = game.playground.node.getWorldMatrix();
        playgroundTransform.invert();
        let pos = new Vec3();
        Vec3.transformMat4(pos, wPos, playgroundTransform);
        this.position = pos;
        // log('emitter position', lPos, wPos, pos);

        // initBarrels
        for (let i = 0; i < this.level.length; i++) {
            let barrel = this.level[i];
            barrel.init(this);
        }
        this.initBarrels(this._barrelCount);

        this.missileStartSpeed = game.config.missile.startSpeed; // 需要和屏幕大小无关

        this.upDirNew = new Vec3(0, 1, 0);

        this.initRotationMaxAngle();
    }

    initBarrels(count: number): void {
        this.barrelCount = count;
        let idx = utils.clamp(count - 1, 0, this.level.length - 1);

        for (let i = 0; i < this.level.length; i++) {
            let barrel = this.level[i];
            if (i === idx) {
                barrel.node.active = true;
                this.barrel = barrel;
            } else {
                barrel.node.active = false;
            }
        }
    }

    initRotationMaxAngle(): void {
        let leftPos = game.rebounceWall.getLeftBottomPosition();
        let rightPos = game.rebounceWall.getRightBottomPosition();

        let leftDir = leftPos.subtract(this.position);
        let rightDir = rightPos.subtract(this.position);

        // radians = degrees * (Math.PI / 180);
        // degrees = radians * (180 / Math.PI);

        let addOn = 10 * (Math.PI / 180);
        // this.leftAngle = leftDir.signAngle(this.upDirNew) + addOn;
        // this.rightAngle = rightDir.signAngle(this.upDirNew) - addOn;
        this.leftAngle = Vector.angle(leftDir, this.upDirNew) + addOn;
        this.rightAngle = Vector.angle(rightDir, this.upDirNew) - addOn;

        log('angle:', this.leftAngle * 180 / Math.PI, this.rightAngle * 180 / Math.PI, addOn * 180 / Math.PI);
    }

    // for replay
    resetAttr(): void {
        this.emitCount = this._emitCount;
        this.missileDamage = 0;

        this.initBarrels(this._barrelCount);
    }

    nextRound(roundNum: number): void {
        // 新回合的开始
        let num = this.role.getBufNum('barrelCount') + this._barrelCount;
        if (this.barrelCount !== num) {
            this.initBarrels(num);
        }

        num = this.role.getBufNum('emitCount') + this._emitCount;
        if (this.emitCount !== num) {
            this.emitCount = num;
        }

        num = this.role.getBufNum('missileDamage');
        if (this.missileDamage !== num) {
            this.missileDamage = num;
        }

        this.nextMissileCount = 1;
        this.showNextMissile();
    }

    showNextMissile(): void {
        let damage = this.calcMissileDamage(this.nextMissileCount);
        this.barrel.showMissile(damage);
    }

    hideNextMissile(): void {
        this.barrel.hideMissile();
    }

    // fireCount: 1 -> emitCount
    calcMissileDamage(fireCount: number): number {
        let avg = Math.floor(this.missileDamage / this.emitCount);
        let remind = this.missileDamage - (avg * this.emitCount);
        let add = fireCount <= remind ? 1 : 0;
        let extraDamage = avg + add;
        if (extraDamage > this.max_extra_damage) {
            extraDamage = this.max_extra_damage;
        }
        let damage = this._missileDamage + extraDamage;
        // logA('missile damage: ', fireCount, avg, add, emitCount, missileDamage)

        return damage;
    }

    getPosition(): Vec3 {
        return this.position;
    }

    getBarrelDirAngle(targetPosition: Vec3): [Vec3, number] {
        // cocos
        // 克隆向量避免修改原值
        let dir = targetPosition.clone().subtract(this.position);

        //             0
        //   -90  -----------> 90
        //         -179, 179

        // 使用 signAngle 获取带符号角度，直接支持 Vec3
        let angle = Vector.signAngle(dir, this.upDirNew);
        angle = utils.clamp(angle, this.leftAngle, this.rightAngle);

        log('getBarrelDirAngle', dir, angle, angle * 180 / Math.PI);

        return [dir, angle];
    }

    rotateBarrelTo(angle: number, time: number): void {
        this.barrel.rotateTo(angle, time);
    }

    calcRotateAngle(targetPosition: Vec3): number {
        // Math.atan2()
        // Computes the angle from the X axis to a point

        // 记住y轴是向下的
        //             -90
        //   -179  -----------> 0
        //    179       90
        // Vector.angle(that.position, targetPosition)

        let angle = Vector.angle(this.position, targetPosition);

        // 这边不能直接clamp
        if (angle > this.rightAngle && angle < Math.PI / 2) {
            angle = this.rightAngle;
        } else if (angle < this.leftAngle || angle >= Math.PI / 2) {
            angle = this.leftAngle;
        }

        angle = angle + (Math.PI / 2);

        return angle;
    }

    fireMissile(dir: Vec3): void {
        let roundStep = game.round.getStep();
        if (roundStep !== game.round.STEP_FIRE_MISSILE && roundStep !== game.round.STEP_PLAYER_USE_ANY_ROUND_SKILL) {
            return;
        }

        game.round.setStep(game.round.STEP_WAIT_NEXT_ROUND);

        this.barrel.fireMissile(dir);
    }

    clearAllMissile(): void {
        for (let i = 0; i < this.missiles.length; i += 1) {
            let m = this.missiles[i];
            game.pool.put(m.node);
        }

        this.missiles = [];
    }

    gameloop(delta: number): void {
        if (!this.missiles || this.missiles.length < 1)
            return;

        // missiles
        let deleteMissile = false;
        for (let i = 0; i < this.missiles.length; i += 1) {
            let m = this.missiles[i];
            m.gameloop(delta);

            if (m.isDelete()) {
                this.missiles[i] = null;
                game.pool.put(m.node);

                if (!deleteMissile) {
                    deleteMissile = true;
                }
            }
        }

        // 有要delete的missile
        if (deleteMissile) {
            this.missiles = _.compact(this.missiles);
            // log('missiles:');
            // log(that.missiles);

            if (this.missiles.length < 1 && game.round.getStep() === game.round.STEP_WAIT_NEXT_ROUND) {
                game.round.next();
                game.round.start();
            }
        }
    }

    onDestroy(): void {
        console.log('Emitter onDestroy');
    }
}