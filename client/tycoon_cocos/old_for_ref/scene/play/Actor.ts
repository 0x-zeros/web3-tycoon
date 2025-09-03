import { _decorator, Component, Sprite, SpriteAtlas, ProgressBar, Node, v3, log, error, Vec3, tween, Color, UIOpacity } from 'cc';
import { line, collision_lines, CollisionLines } from '../../common/physics';
import { utils } from "../../common/utils";
import { _ } from '../../common/lodash-compat';
import { Vector, Bounds, IVector, IBounds } from '../../common/math';
import { AnimatedSprite } from '../../common/AnimatedSprite';

const { ccclass, property } = _decorator;


interface ActorTemplate {
    size: number;
    hp: number;
    hp_rate: number;
    type: string;
    rebounce: number;
    eliminate_damage: number;
    speed: number;
    skill?: any;
    actor_id: string;
    pic_url: string[];
}

@ccclass('Actor')
export default class Actor extends Component {
    @property(Sprite)
    icon: Sprite = null!;
    
    @property(SpriteAtlas)
    atlas: SpriteAtlas = null!;
    
    @property(ProgressBar)
    hpBar: ProgressBar = null!;
    
    @property(Node)
    haloEffectRoot: Node = null!;

    // Properties
    public id: number = 0;
    public deleteflag: boolean = false;
    public liveTime: number = -1;
    public actorTmp: ActorTemplate = null!;
    public pixelSize: number = 0;
    public buckets: any[] | null = null;
    public enableCollider: boolean = true;
    public position: Vec3 = v3(0, 0, 0);
    public maxHp: number = 0;
    public hp: number = 0;
    public rebounce: boolean = false;
    public collisionHelpLines: CollisionLines = null!;
    public originalScale4Effect: number = 1;
    public haloEffect: Node | null = null;
    public frozenEffect: Node | null = null;
    public hitEffectRunning: boolean = false;

    init(tmp: ActorTemplate, pos: Vec3): void {
        this.id = game.nextId();

        this.deleteflag = false; // 生存期以及pool管理flag
        this.liveTime = -1;
        this.actorTmp = tmp;

        this.pixelSize = this.actorTmp.size * game.grid.UNIT_ACTOR_PIXEL;
        this.buckets = null;
        this.enableCollider = true;

        this.node.setPosition(pos.x, pos.y);

        let roundNum = game.playground.roundNum();
        this.maxHp = this.calcMaxHp(roundNum);
        this.hp = this.maxHp;

        this.rebounce = (this.actorTmp.rebounce === 1);
        let lines = collision_lines();
        lines.initWithActor(this.position.x, this.position.y, this.pixelSize, this.pixelSize);
        this.collisionHelpLines = lines;

        this.initShow();
    }

    calcMaxHp(roundNum: number): number {
        let actorTmp = this.actorTmp;
        let BOSS_ROUND = game.config.actor.boss_roundNum;

        let hp = actorTmp.hp;
        if (actorTmp.type === 'monster' || actorTmp.type === 'elite') {
            hp += Math.floor((roundNum - 1) / 3) * 2 + Math.floor((roundNum - 1) / BOSS_ROUND) * 10;
            // logA('calcMaxHp:', hp, actorTmp.hp, roundNum, Math.floor((roundNum -1) / 2), Math.floor((roundNum - 1) / BOSS_ROUND));
        }
        else if (actorTmp.type === 'boss') {
            hp += (Math.floor(roundNum / BOSS_ROUND) - 1) * 150;
            log('calcMaxHp boss:', hp, actorTmp.hp, roundNum, (Math.floor(roundNum / BOSS_ROUND) - 1));
        }

        hp *= actorTmp.hp_rate;
        // if(actorTmp.hp_rate !== 1) {
        //     log('hp_rate !== 1 ', actorTmp)
        // }

        hp = Math.floor(hp);
        if (hp <= 0) {
            error('calcMaxHp err');
        }

        return hp;
    }

    getActorTmp(): ActorTemplate {
        return this.actorTmp;
    }

    getBounds(): IBounds | null {
        if (this.collisionHelpLines) {
            return this.collisionHelpLines.bounds;
        }

        return null;
    }

    moveTo(pos: Vec3, ani?: any): void {
        // pos center
        this.position.x = pos.x;
        this.position.y = pos.y;
        // this.node.setPosition(pos.x, pos.y, this.node.position.z);//需要动画效果

        if (this.collisionHelpLines) {
            this.collisionHelpLines.updateActorLines(this.position.x, this.position.y, this.pixelSize, this.pixelSize);
        }

        // ani etc.
        this.doMoveTo(pos, ani);
    }

    getPosition(): Vec3 {
        return this.node.position;
    }

    nextRound(roundNum: number): void {
        if (this.frozenEffect) {
            this.addFrozenVanishEffect(); // inside call: this.removeFrozenEffect()
        }
    }

    setBuckets(l: any[]): void {
        this.buckets = l;
        this.node.active = true;
    }

    setBucket(b: any): void {
        this.buckets = [b];
        this.node.active = true;
    }

    getBuckets(): any[] | null {
        return this.buckets;
    }

    getGridX(): number {
        let num = this.buckets ? this.buckets[0].getGridX() : -1;
        return num;
    }

    getGridY(): number {
        let num = this.buckets ? this.buckets[0].getGridY() : -1;
        return num;
    }

    clearBuckets(): void {
        this.node.active = false;

        if (this.buckets) {
            _.each(this.buckets, (b) => {
                // logA('actor clearBuckets: ', b.getGridY(), b.getGridX())
                b.clear(this, false);
            });

            this.buckets = null;
        }
    }

    getSize(): number {
        return this.actorTmp.size;
    }

    getPixelSize(): number {
        return this.pixelSize;
    }

    isBad(): boolean {
        if (this.actorTmp.type === 'monster' || this.actorTmp.type === 'elite' || this.actorTmp.type === 'boss') {
            return true;
        }
        return false;
    }

    isBoss(): boolean {
        if (this.actorTmp.type === 'boss') {
            return true;
        }
        return false;
    }

    // 跳跃怪
    hasExtraMove(): boolean {
        return this.actorTmp.speed > 1;
    }

    doRebounce(intersectLineIdx: number, intersectPosition: Vec3, position: Vec3, velocity: Vec3): [Vec3, Vec3] {
        // 将Vec3参数转换为IVector进行内部计算
        const intersectPositionIV = Vector.toIVector(intersectPosition);
        const positionIV = Vector.toIVector(position);
        const velocityIV = Vector.toIVector(velocity);
        
        this.collisionHelpLines.fixVelocity(intersectLineIdx, positionIV, velocityIV);

        let distance = Vector.magnitude(Vector.sub(positionIV, intersectPositionIV));
        const newPosition = Vector.add(intersectPositionIV, Vector.mult(Vector.normalise(velocityIV), distance)); // 加了反弹的量

        // 将计算结果转换回Vec3
        return [Vector.toVec3(newPosition), Vector.toVec3(velocityIV)];
    }

    // missile, 碰撞的点, 和Actor哪条边碰撞的(从下方开始的顺时针, 1,2,3,4, 由<< 0~3来定义)
    hit(missile: any, p: IVector | null, lineIdx: number): void {
        // log('in actor_hit: actor ' + that.id + ' hit by missile ' + missile.id + ' lineIdx: ' + lineIdx);
        let bits = 0;

        if (p) {
            bits = 1 << lineIdx;
            // log('in actor_hit: actor ', lineIdx, bits, actorTmp.eliminate_damage, actorTmp.eliminate_damage & bits);
        }

        if (this.actorTmp.eliminate_damage & bits) {
            // 无伤害
            // logA('eliminate_damage', lineIdx);
            // music.playEffect(music.clipNames.actor_hit_no_damage);
            game.audioManager.playEffect('spark');
        }
        else {
            this.onDamage(missile.getDamage());
            // music.playEffect(music.clipNames.actor_hit);
            game.audioManager.playEffect('mission');
        }
    }

    onDamage(num: number): void {
        if (this.hp <= 0) // 已经hp为0了, 再次被各种item/技能/missile打中等, 防止死循环
            return;

        this.hp -= num;

        if (this.hp <= 0) {
            // drop items on dead
            game.grid.onDead(this);
            this.onDead();

            // that.setDelete(true);
        }
        else {
            this.updateHp();

            if (!this.hitEffectRunning) {
                game.effectManager.hitEffect(this);
            }
        }
    }

    isDead(): boolean {
        return this.hp <= 0;
    }

    onDead(): void {
        this.showHp(false);
        this.removeHaloEffect();
        this.removeFrozenEffect();
        this.showDeadEffect();
    }

    getSkill(): any {
        if (!this.actorTmp.skill && (this.actorTmp.type === 'item' || this.actorTmp.type === 'skill')) {
            this.actorTmp.skill = game.skillManager.getSkill(this.actorTmp.actor_id); // late init
        }

        return this.actorTmp.skill;
    }

    getTypeId(): string {
        return this.actorTmp.actor_id;
    }

    getMaxHp(): number {
        return this.maxHp;
    }

    isDelete(): boolean {
        return this.deleteflag;
    }

    setDelete(flag: boolean): void {
        this.deleteflag = flag;
    }

    initShow(): void {
        if (this.isBad()) {
            this.hpBar.node.active = true;
        }
        else {
            this.hpBar.node.active = false;
        }

        this.icon.spriteFrame = this.randomTexture();
        // 重置图标透明度用于fadeout效果
        const currentColor = this.icon.color.clone();
        currentColor.a = 255;
        this.icon.color = currentColor;

        this.originalScale4Effect = this.node.scale.x;

        this.updateHp();

        this.addHaloEffect();
    }

    randomTexture(): any {
        let num = _.random(0, this.actorTmp.pic_url.length - 1);
        // log(actorTmp.pic_url);
        // log(num);
        let url = this.actorTmp.pic_url[num];
        log('randomTexture', url);
        let texture = this.atlas.getSpriteFrame(url);

        return texture;
    }

    addHaloEffect(): void {
        let effectName: string | null = null;

        if (this.actorTmp.type === 'boss') {
            effectName = 'bossHalo';
        }
        // else {
        else if (this.actorTmp.type === 'elite') {
            effectName = 'eliteHalo';
        }

        if (effectName) {
            game.effectManager.getAnimatedSpriteEffectPrefab(effectName, (prefab: any) => {
                let node = game.pool.get(prefab);
                this.haloEffectRoot.addChild(node);
                this.haloEffect = node;

                // node.scale = this.actorTmp.size
                let ani = node.getComponent('AnimatedSprite') as AnimatedSprite;
                ani.play();
            });
        }
    }

    removeHaloEffect(): void {
        if (this.haloEffect) {
            game.pool.put(this.haloEffect);
            this.haloEffect = null;
        }
    }

    showDeadEffect(): void {
        if (this.isBad()) {
            game.effectManager.getAnimatedSpriteEffectPrefab('dead', (prefab: any) => {
                let node = game.pool.get(prefab);
                this.node.addChild(node);

                node.setScale(this.actorTmp.size, this.actorTmp.size, this.actorTmp.size);
                let ani = node.getComponent('AnimatedSprite') as AnimatedSprite;
                ani.setOnFinishedCb(() => {
                    this.setDelete(true);
                });
                ani.play();

                // 淡出动画：对Sprite组件的color进行tween
                const targetColor = this.icon.color.clone();
                targetColor.a = 0;
                tween(this.icon)
                    .to(0.2, { color: targetColor })
                    .start();
            });
        }
        else {
            this.setDelete(true);
        }
    }

    addFrozenEffect(): void {
        if (this.frozenEffect)
            return;

        game.effectManager.getAnimatedSpriteEffectPrefab('frozen', (prefab: any) => { // 'frozen'
            let node = game.pool.get(prefab);
            this.node.addChild(node);
            this.frozenEffect = node;

            node.setScale(this.actorTmp.size, this.actorTmp.size, this.actorTmp.size);
            let ani = node.getComponent('AnimatedSprite') as AnimatedSprite;
            ani.play();
        });
    }

    removeFrozenEffect(): boolean {
        if (this.frozenEffect) {
            game.pool.put(this.frozenEffect);
            this.frozenEffect = null;
            return true;
        }
        return false;
    }

    addFrozenVanishEffect(): void {
        game.effectManager.getAnimatedSpriteEffectPrefab('vanish', (prefab: any) => {
            let node = game.pool.get(prefab);
            this.node.addChild(node);

            node.setScale(this.actorTmp.size, this.actorTmp.size, this.actorTmp.size);
            let ani = node.getComponent('AnimatedSprite') as AnimatedSprite;
            ani.play();

            _.delay(() => {
                this.removeFrozenEffect();
            }, 10);
        });
    }

    updateHp(): void {
        if (this.hpBar.node.active) {
            let fillRate = this.hp / this.maxHp;
            // logA('setFillRate:', fillRate, hp, that.maxHp);
            this.hpBar.progress = fillRate;

            // if(that.hpNum) {
            //     that.hpNum.text = hp;
            // }
        }
    }

    showHp(bShow: boolean): void {
        this.hpBar.node.active = bShow;
    }

    getTexture(): any {
        return this.icon.spriteFrame;
    }

    doMoveTo(pos: Vec3, ani?: any): void {
        // pos center
        // this.node.setPosition(pos.x, pos.y, this.node.position.z);//需要动画效果呢

        // ani = null

        if (ani === game.effectManager.actorAni.walk) {
            game.effectManager.walkEffect(this, pos);
        }
        else if (ani === game.effectManager.actorAni.born) {
            if (this.isBoss()) {
                game.effectManager.showBossEffect();

                let delayTime = 1100; // showBossEffect所用时间
                _.delay(() => {
                    game.effectManager.bornEffect(this, pos);
                    // music.playEffect(music.clipNames.actor_born);
                    game.audioManager.playEffect('born');

                }, delayTime);
            }
            else {
                game.effectManager.bornEffect(this, pos);
                // music.playEffect(music.clipNames.actor_born);
                game.audioManager.playEffect('born');
            }
        }
        else if (ani === game.effectManager.actorAni.jump) {
            game.effectManager.jumpEffect(this, pos);
        }
        else if (ani === game.effectManager.actorAni.drop) {
            game.effectManager.dropEffect(this, pos, () => {
                // onFinished
                this.enableCollider = true;
            });
        }
        else {
            this.node.setPosition(pos.x, pos.y);
        }
    }

    scaleSmall(num: number): void {
        this.node.setScale(num, num, num); // scaleX, scaleY, scaleZ
    }

    clear(): void {
        this.clearBuckets();

        // pool reuse
        // 重置透明度用于对象池复用
        const currentColor = this.icon.color.clone();
        currentColor.a = 255;
        this.icon.color = currentColor; // fadeout
        // this.deleteflag = false
    }
}