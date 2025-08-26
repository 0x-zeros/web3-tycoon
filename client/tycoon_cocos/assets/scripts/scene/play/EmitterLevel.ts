import { _decorator, Component, Node, Sprite, SpriteAtlas, Prefab, Vec3, log } from 'cc';
import { utils } from '../../common/utils';
import { _ } from '../../common/lodash-compat';
import Missile from './Missile';

const { ccclass, property } = _decorator;

@ccclass('EmitterLevel')
export default class EmitterLevel extends Component {
    @property(Sprite)
    missileSprite: Sprite = null;

    @property(SpriteAtlas)
    missileAtlas: SpriteAtlas = null;

    @property(Prefab)
    missilePrefab: Prefab = null;

    @property([Node])
    fire_pos: Node[] = [];

    // References
    emitter: any = null;

    // Rotation properties
    targetAngle: number = 0;
    rotateTime: number = -1;
    rotateSpeed: number = 0;

    // Fire barrel data
    fireBarrelData: Array<{firedCount: number, position: Vec3}> = [];

    // Effect properties
    originalScale4Effect: Vec3 = new Vec3();

    init(emitter: any): void {
        this.emitter = emitter;

        this.targetAngle = 0;
        this.rotateTime = -1;

        this.fireBarrelData = [];
        for (let i = 0; i < this.fire_pos.length; i++) {
            let lPos = this.fire_pos[i].position;
            // let wPos = this.node.convertToWorldSpaceAR(lPos)
            // let pos = game.playground.node.convertToNodeSpaceAR(wPos)
            this.fireBarrelData.push({firedCount: 0, position: lPos});
        }

        this.originalScale4Effect = this.node.scale;

        log('emitterLevel init', this.fireBarrelData);
    }

    showMissile(damage: number): void {
        this.missileSprite.node.active = true;

        damage = utils.clamp(damage, 1, 6);
        let key = 'zidan_0' + damage; // zidan_01 - zidan_06
        this.missileSprite.spriteFrame = this.missileAtlas.getSpriteFrame(key);
    }

    hideMissile(): void {
        this.missileSprite.node.active = false;
    }

    fireMissile(dir: Vec3): void {
        log('emitterLevel fireMissile');
        for (let i = 0; i < this.fireBarrelData.length; i++) {
            this.fireBarrel(this.fireBarrelData[i], dir.clone(), i === 0);
        }
    }

    fireBarrel(barrel: {firedCount: number, position: Vec3}, dir: Vec3, showAni: boolean): void {
        // 以秒为单位的时间间隔
        let interval = this.emitter.missileDelay;
        // 重复次数
        let repeat = this.emitter.emitCount;
        // 开始延时
        let delay = 0;
        barrel.firedCount = 0;
        this.schedule(() => {
            // 这里的 this 指向 component
            this.fireOneMissile(barrel, dir, showAni);
        }, interval, repeat, delay);
    }

    fireOneMissile(barrel: {firedCount: number, position: Vec3}, dir: Vec3, showAni: boolean): void {
        let node = game.pool.get(this.missilePrefab);
        game.playground.missileOverlay.addChild(node);
        let m = node.getComponent('Missile') as Missile;

        let missileDamage = this.emitter.calcMissileDamage(barrel.firedCount++);
        let spawnPosition = this.calcSpawnPosition(barrel.position);
        let startSpeed = this.emitter.missileStartSpeed;
        m.init(missileDamage, dir, startSpeed, spawnPosition);

        this.emitter.missiles.push(m);

        if (showAni) {
            // showNextMissile
            this.emitter.nextMissileCount = barrel.firedCount;
            if (this.emitter.nextMissileCount > this.emitter.emitCount) {
                this.emitter.nextMissileCount = 1;
            }
            game.effectManager.emitterFireEffect(this);

            this.hideMissile();

            _.delay(() => {
                this.emitter.showNextMissile();
            }, this.emitter.missileDelay / 2);

            // music
            game.audioManager.playEffect('mission'); // music.clipNames.missile_fire

            // 最后一发, 炮管转回去
            if (barrel.firedCount > this.emitter.emitCount) {
                // this.emitter.rotateBarrelTo(0, 0.1);
                this.rotateTo(0, 0.1);
            }
        }
    }

    calcSpawnPosition(lPos: Vec3): any {
        // 需要旋转, 需要实时计算
        // let lPos = this.fire_pos[i].position

        // Cocos Creator 3.x API迁移说明：
        // 2.x中的 node.convertToWorldSpaceAR(lPos) 和 node.convertToNodeSpaceAR(wPos) 被移除
        // 新的实现方式：
        // 1. 使用 node.getWorldMatrix() 获取世界变换矩阵
        // 2. 使用 Vec3.transformMat4() 进行矩阵变换
        // 3. 使用 matrix.invert() 获取逆矩阵实现逆向转换
        
        // 将本地坐标转换为世界坐标：lPos -> wPos
        let transform = this.node.getWorldMatrix();
        let wPos = new Vec3();
        Vec3.transformMat4(wPos, lPos, transform);
        
        // 将世界坐标转换为playground节点的本地坐标：wPos -> pos
        let playgroundTransform = game.playground.node.getWorldMatrix();
        playgroundTransform.invert();
        let pos = new Vec3();
        Vec3.transformMat4(pos, wPos, playgroundTransform);
        return pos;
    }

    rotateTo(angle: number, time: number): void {
        log('emitterLevel rotateTo', angle, time);

        // time = time || barrelRotateSpeed * Math.abs(angle);
        angle = angle * 180 / Math.PI;

        if (time > 0.005) { // 慢慢转到目标
            this.targetAngle = angle;
            this.rotateTime = time;

            this.rotateSpeed = (this.targetAngle - this.node.eulerAngles.z) / time;
        } else {
            // 立即
            this.node.setRotationFromEuler(0, 0, angle);
        }
    }

    update(delta: number): void {
        // do rotation
        if (this.rotateTime > 0) {
            this.rotateTime -= delta;

            if (this.rotateTime <= 0) {
                this.rotateTime = -1;
                this.node.setRotationFromEuler(0, 0, this.targetAngle);
            } else {
                const currentZ = this.node.eulerAngles.z;
                this.node.setRotationFromEuler(0, 0, currentZ + this.rotateSpeed * delta);
            }
        }
    }

    onDestroy(): void {
        console.log('EmitterLevel onDestroy');
    }
}