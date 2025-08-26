import { _decorator, Component, Prefab, Node, Vec3, instantiate, log as cclog } from 'cc';
import { Vector, Bounds } from '../../common/math';
import { bucket, IBucket } from './bucket';
import { _ } from '../../common/lodash-compat';
import Actor from './Actor';

const { ccclass, property } = _decorator;

export interface GridRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ActorSpawnData {
    actorTmp: any;
    gridX: number;
    gridY: number;
    srcPosition: Vec3;
}


const IMPOSSIBLE_ACTOR_POSITION = new Vec3(-1000, -1000, 0);

@ccclass('Actorgrid')
export default class Actorgrid extends Component {
    @property(Prefab)
    actorPrefab: Prefab = null!;

    @property(Prefab)
    bossPrefab: Prefab = null!;

    // Grid properties
    private bounds: GridRect = { x: 0, y: 0, width: 0, height: 0 };
    private MAX_ROW: number = 0;
    private MAX_COLUMN: number = 0;
    private UNIT_ACTOR_PIXEL: number = 0;

    // Bucket system
    private buckets: IBucket[][] = [];
    private bucketsPosition: Vec3[][] = [];

    // Actors management
    private actors: any[] = [];
    private tobeSpawnActors: ActorSpawnData[] = [];

    // Other properties
    private lastRowUpY: number = 0;

    /**
     * 初始化网格系统
     */
    init(gridRect: GridRect): void {
        this.bounds = {
            x: gridRect.x,
            y: gridRect.y,
            width: gridRect.width,
            height: gridRect.height
        };

        this.MAX_ROW = game.config.playground.max_row;
        this.MAX_COLUMN = game.config.playground.max_column;
        this.UNIT_ACTOR_PIXEL = gridRect.width / this.MAX_COLUMN;

        this.buckets = [];
        this.bucketsPosition = [];
        this.actors = [];
        this.tobeSpawnActors = [];

        this.initBucketList();

        // 注册回合事件
        game.eventTarget.on('onStep', (roundNum: number, step: number) => {
            if (step === game.round.STEP_SPAWN_ACTOR) {
                this.nextRound(roundNum);
            }
        }, this);
    }

    /**
     * 初始化桶列表
     */
    private initBucketList(): void {
        const origX = this.bounds.x;
        const origY = this.bounds.y + this.bounds.height;

        for (let r = 0; r < this.MAX_ROW; r++) {
            const row: IBucket[] = [];
            this.buckets.push(row);

            const positionRow: Vec3[] = [];
            this.bucketsPosition.push(positionRow);

            for (let c = 0; c < this.MAX_COLUMN; c++) {
                const position = new Vec3(
                    origX + (c * this.UNIT_ACTOR_PIXEL + this.UNIT_ACTOR_PIXEL / 2),
                    origY - (r * this.UNIT_ACTOR_PIXEL + this.UNIT_ACTOR_PIXEL / 2),
                    0
                );
                positionRow.push(position);

                const b = bucket();
                b.init(r, c, position, this.UNIT_ACTOR_PIXEL);
                row.push(b);
            }
        }

        this.lastRowUpY = origY - (this.MAX_ROW - 1) * this.UNIT_ACTOR_PIXEL;
    }

    /**
     * 移动桶列表一行
     */
    moveBucketListOneLine(): void {
        // console.log('moveBucketListOneLine');

        let playMoveEffect = false;

        // 从下往上移动
        for (let r = this.MAX_ROW - 2; r >= 0; r--) {
            for (let c = 0; c < this.MAX_COLUMN; c++) {
                const b = this.buckets[r][c];
                const pos = this.bucketsPosition[r + 1][c];
                b.set(r + 1, c, pos, true);
                if (b.moveActor()) {
                    playMoveEffect = true;
                }
            }
        }

        // 移动桶数组
        const bottomRow = this.buckets[this.MAX_ROW - 1];
        for (let r = this.MAX_ROW - 2; r >= 0; r--) {
            this.buckets[r + 1] = this.buckets[r];
        }

        this.buckets[0] = bottomRow;
        for (let c = 0; c < this.MAX_COLUMN; c++) {
            const b = bottomRow[c];
            const pos = this.bucketsPosition[0][c];
            b.clear(null, true);
            b.set(0, c, pos);
        }

        if (playMoveEffect) {
            game.audioManager.playEffect('move');
        }
    }

    /**
     * 获取指定大小区域的桶列表
     */
    getBuckets(gridX: number, gridY: number, size: number): any[] {
        const list: any[] = [];

        for (let dr = 0; dr < size; dr++) {
            for (let dc = 0; dc < size; dc++) {
                const y = gridY - dr;
                const x = gridX + dc;
                if (y >= 0 && y < this.MAX_ROW && x >= 0 && x < this.MAX_COLUMN) {
                    const b = this.buckets[y][x];
                    list.push(b);
                }
            }
        }

        return list;
    }

    /**
     * 获取指定位置的桶
     */
    getBucket(gridX: number, gridY: number): any | null {
        if (gridY >= 0 && gridY < this.MAX_ROW && gridX >= 0 && gridX < this.MAX_COLUMN) {
            return this.buckets[gridY][gridX];
        }
        return null;
    }

    /**
     * 获取指定位置的角色
     */
    getActor(r: number, c: number, mainFlag: boolean = true): any | null {
        const b = this.getBucket(c, r);
        if (b) {
            return b.getActor(mainFlag);
        }
        return null;
    }

    /**
     * 遍历所有角色
     */
    loopActors(now: number): void {
        let deleteActor = false;

        for (let i = 0; i < this.actors.length; i++) {
            const a = this.actors[i];

            if (!a.isDead()) {
                if (a.liveTime > 0 && a.liveTime <= now) {
                    a.onDamage(a.getMaxHp());
                }
            }

            if (a.isDelete()) {
                this.actors[i] = null;
                a.clear();
                game.pool.put(a.node);

                if (!deleteActor) {
                    deleteActor = true;
                }
            }
        }

        if (deleteActor) {
            this.actors = _.compact(this.actors);
        }
    }

    /**
     * 生成掉落的角色
     */
    spawnDropActors(): void {
        if (this.tobeSpawnActors && this.tobeSpawnActors.length > 0) {
            const roundNum = game.playground.roundNum();
            
            for (let i = 0; i < this.tobeSpawnActors.length; i++) {
                const data = this.tobeSpawnActors[i];
                const actor = this.spawnActor(data.actorTmp, data.gridX, data.gridY, roundNum, data.srcPosition);

                if (actor && !actor.isBad()) {
                    actor.liveTime = _.now() + 1000;
                    actor.enableCollider = false;
                }
            }

            this.tobeSpawnActors = [];
        }
    }

    /**
     * 重放时重置
     */
    replay(): void {
        this.clearAllActors();
    }

    /**
     * 清除所有角色
     */
    clearAllActors(): void {
        for (let i = 0; i < this.actors.length; i++) {
            const a = this.actors[i];
            a.clear();
            game.pool.put(a.node);
        }
        this.actors = [];
    }

    /**
     * 对每个角色执行函数
     */
    eachActor(func: Function, param: any): void {
        for (let i = 0; i < this.actors.length; i++) {
            const a = this.actors[i];
            func(a, param);
        }
    }

    /**
     * 在方形区域内对角色执行函数
     */
    squareActor(gridX: number, gridY: number, radius: number, func: Function, param: any): void {
        for (let n = 1; n <= radius; n++) {
            // 底边
            let j = gridY - n;
            for (let i = gridX - n; i < gridX + n; i++) {
                const a = this.getActor(j, i);
                if (a) {
                    func(a, param);
                }
            }

            // 右边
            let i = gridX + n;
            for (j = gridY - n; j < gridY + n; j++) {
                const a = this.getActor(j, i);
                if (a) {
                    func(a, param);
                }
            }

            // 顶边
            j = gridY + n;
            for (i = gridX + n; i > gridX - n; i--) {
                const a = this.getActor(j, i);
                if (a) {
                    func(a, param);
                }
            }

            // 左边
            i = gridX - n;
            for (j = gridY + n; j > gridY - n; j--) {
                const a = this.getActor(j, i);
                if (a) {
                    func(a, param);
                }
            }
        }
    }

    /**
     * 对一行中的角色执行函数
     */
    rowActor(gridX: number, gridY: number, func: Function, param: any): void {
        const r = gridY;

        for (let i = 1; i < this.MAX_COLUMN; i++) {
            // 右侧
            let c = gridX + i;
            if (c < this.MAX_COLUMN) {
                const a = this.getActor(r, c);
                if (a) {
                    func(a, param);
                }
            }

            // 左侧
            c = gridX - i;
            if (c >= 0) {
                const a = this.getActor(r, c);
                if (a) {
                    func(a, param);
                }
            }
        }
    }

    /**
     * 对一列中的角色执行函数
     */
    columnActor(gridX: number, gridY: number, func: Function, param: any): void {
        const c = gridX;

        for (let i = 1; i < this.MAX_ROW; i++) {
            // 下方
            let r = gridY + i;
            if (r < this.MAX_ROW) {
                const a = this.getActor(r, c);
                if (a) {
                    func(a, param);
                }
            }

            // 上方
            r = gridY - i;
            if (r >= 0) {
                const a = this.getActor(r, c);
                if (a) {
                    func(a, param);
                }
            }
        }
    }

    /**
     * 获取网格位置
     */
    getGridPosition(gridX: number, gridY: number): Vec3 | null {
        const b = this.getBucket(gridX, gridY);
        if (b) {
            return b.getPosition();
        }
        return null;
    }

    /**
     * 游戏循环
     */
    gameloop(delta: number): void {
        const now = _.now();
        this.loopActors(now);
        this.spawnDropActors();
    }

    /**
     * 生成角色
     */
    spawnActor(actorTmp: any, gridX: number, gridY: number, roundNum: number, dropSrcPosition?: Vec3): any {
        cclog('spawnActor: ', actorTmp.actor_id, gridX, gridY);

        const prefab = actorTmp.type === 'boss' ? this.bossPrefab : this.actorPrefab;
        const node = game.pool.get(prefab);
        this.node.addChild(node);

        const actor = node.getComponent(Actor);
        actor.init(actorTmp, IMPOSSIBLE_ACTOR_POSITION);

        // 设置出生位置和动画
        let ani: any;
        let bp: Vec3;

        if (dropSrcPosition) {
            bp = dropSrcPosition;
            ani = game.effectManager.actorAni.drop;
            actor.scaleSmall(0.01);
        } else {
            bp = this.getActorBornPoint(actor, gridX, gridY);
            ani = game.effectManager.actorAni.born;
        }

        cclog('spawnActor, moveTo', bp);
        actor.moveTo(bp);

        // 移动到目标位置
        this.attachActorToBuckets(actor, gridX, gridY, ani);
        this.actors.push(actor);

        return actor;
    }

    /**
     * 获取角色出生点
     */
    getActorBornPoint(actor: any, gridX: number, gridY: number): Vec3 {
        const b = this.getBucket(gridX, gridY);
        const pos = b.getActorPosition(actor.getSize());
        const y = this.bounds.y + this.bounds.height + (actor.getPixelSize() / 2);
        return new Vec3(pos.x, y, 0);
    }

    /**
     * 查询反弹路径
     */
    queryRebouncePath(startPoint: Vec3, rayDir: Vec3, rayLength: number, stepLength: number): any {
        for (let r = this.MAX_ROW - 1; r >= 0; r--) {
            for (let c = 0; c < this.MAX_COLUMN; c++) {
                const b = this.buckets[r][c];
                const a = b.getActor(true);

                if (a && a.rebounce) {
                    const path = a.collisionHelpLines.queryRebouncePath(startPoint, rayDir, rayLength, stepLength);
                    if (path) {
                        return path;
                    }
                }
            }
        }
        return null;
    }

    /**
     * 查询重叠边界的角色
     */
    queryOverlapBounds(boundsA: any): any[] | null {
        let list: any[] | null = null;

        for (let i = 0; i < this.actors.length; i++) {
            const a = this.actors[i];

            if (a && !a.isDead() && a.enableCollider) {
                const boundsB = a.getBounds();
                if (Bounds.overlaps(boundsA, boundsB)) {
                    if (!list) {
                        list = [];
                    }
                    list.push(a);
                }
            }
        }

        return list;
    }

    /**
     * 查询包含指定位置的角色
     */
    queryContainsActor(position: Vec3): any | null {
        for (let i = 0; i < this.actors.length; i++) {
            const a = this.actors[i];

            if (a && !a.isDead()) {
                const boundsB = a.getBounds();
                if (Bounds.contains(boundsB, position)) {
                    return a;
                }
            }
        }
        return null;
    }

    /**
     * 将角色附加到桶
     */
    attachActorToBuckets(actor: any, gridX: number, gridY: number, ani: any): void {
        const actorTmp = actor.getActorTmp();

        if (actorTmp.size > 1) {
            const list = this.getBuckets(gridX, gridY, actorTmp.size);
            const pos = list[0].getActorPosition(actorTmp.size);
            actor.moveTo(pos, ani);

            list[0].setActor(actor, true);
            for (let i = 1; i < list.length; i++) {
                list[i].setActor(actor, false);
            }

            actor.setBuckets(list);
        } else {
            const b = this.getBucket(gridX, gridY);
            const pos = b.getActorPosition(actorTmp.size);
            actor.moveTo(pos, ani);

            b.setActor(actor, true);
            actor.setBucket(b);
        }
    }

    /**
     * 从桶中分离角色
     */
    dettachActorFromBuckets(actor: any): void {
        actor.clearBuckets();
    }

    /**
     * 检查是否失败
     */
    checkLose(): boolean {
        // 检查最下面一行
        const row = this.buckets[this.MAX_ROW - 1];
        for (let c = 0; c < this.MAX_COLUMN; c++) {
            const b = row[c];
            const a = b.getActor(true);
            if (a && a.isBad()) {
                return true;
            }
        }

        // 检查倒数第二行的跳跃怪
        const secondRow = this.buckets[this.MAX_ROW - 2];
        for (let c = 0; c < this.MAX_COLUMN; c++) {
            const b = secondRow[c];
            const a = b.getActor(true);
            if (a && a.hasExtraMove() && a.isBad() && !this.getActor(this.MAX_ROW - 1, c, false)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 移动所有角色
     */
    moveActors(): void {
        this.moveBucketListOneLine();

        // 处理跳跃怪
        for (let r = this.MAX_ROW - 2; r >= 0; r--) {
            for (let c = 0; c < this.MAX_COLUMN; c++) {
                const b = this.buckets[r][c];
                const a = b.getActor(true);
                if (a && a.hasExtraMove() && !this.getActor(r + 1, c, false)) {
                    this.dettachActorFromBuckets(a);
                    this.attachActorToBuckets(a, c, r + 1, game.effectManager.actorAni.jump);
                }
            }
        }
    }

    /**
     * 在新回合生成角色
     */
    spawnOnNewRound(roundNum: number): void {
        const gridY = 1; // 第2排为出生点
        game.actorManager.spawnOnRound(roundNum, this.MAX_COLUMN, gridY);
    }

    /**
     * 调用下一回合
     */
    callNextRound(a: any, roundNum: number): void {
        a.nextRound(roundNum);
    }

    /**
     * 下一回合处理
     */
    nextRound(roundNum: number): void {
        if (!game.round.isRoundFlag(game.round.ROUND_FLAG_STOP_MOVE_AND_SPAWN)) {
            // 检查是否失败
            const lose = this.checkLose();
            if (lose) {
                game.playground.lose();
                return;
            }

            // 所有actor进入下一回合
            this.eachActor(this.callNextRound, roundNum);

            // 移动角色
            this.moveActors();

            // 生成新角色
            this.spawnOnNewRound(roundNum);
        }

        game.round.setStep(game.round.STEP_PLAYER_USE_SKILL);
    }

    /**
     * 角色死亡处理
     */
    onDead(actor: any): void {
        const role = game.role;

        if (actor.isBad()) {
            role.addScore(actor.getMaxHp());
        }

        // 处理掉落物品
        const drop = actor.getActorTmp().drop;
        if (drop) {
            // 金钱掉落
            if (drop.money) {
                role.addMoney(drop.money);
            }

            // 角色掉落
            if (drop.actor) {
                const drops = _.shuffle(drop.actor);
                const bucketList = actor.getBuckets();
                
                if (bucketList) {
                    this.addExtraBuckets(actor, bucketList);
                    
                    const count = Math.min(drops.length, bucketList.length);
                    for (let i = 0; i < count; i++) {
                        const b = bucketList[i];
                        const actorTmp = game.actorManager.getActorTmp(drops[i] as number);
                        
                        if (actorTmp) {
                            const data: ActorSpawnData = {
                                actorTmp: actorTmp,
                                gridX: b.getGridX(),
                                gridY: b.getGridY(),
                                srcPosition: _.clone(actor.getPosition())
                            };
                            this.tobeSpawnActors.push(data);
                        }
                    }
                }
            }
        }

        // 技能效果处理
        const skill = actor.getSkill();
        if (skill) {
            role.obtainAward(skill, actor);
            this.explode(skill, actor);
        }
    }

    /**
     * 添加额外的桶（用于死亡分裂）
     */
    addExtraBuckets(actor: any, list: any[]): void {
        if (actor.getTypeId() === game.config.actor.death_split_elite_id) {
            const gridX = actor.getGridX();
            const gridY = actor.getGridY();
            
            const leftBucket = this.getBucket(gridX - 1, gridY);
            if (leftBucket && !leftBucket.getActor(false)) {
                list.push(leftBucket);
            }
            
            const rightBucket = this.getBucket(gridX + 1, gridY);
            if (rightBucket && !rightBucket.getActor(false)) {
                list.push(rightBucket);
            }
        }
    }

    /**
     * 技能爆炸效果
     */
    explode(skill: any, actor: any): void {
        skill.doAttackToActors(this, actor.getGridX(), actor.getGridY());
    }

    /**
     * 检查点是否在边界内
     */
    isInsideBounds(point: Vec3): boolean {
        return point.x >= this.bounds.x && 
               point.x <= this.bounds.x + this.bounds.width &&
               point.y >= this.bounds.y && 
               point.y <= this.bounds.y + this.bounds.height;
    }
}