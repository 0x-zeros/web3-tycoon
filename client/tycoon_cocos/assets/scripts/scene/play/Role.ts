import { _decorator, Component, Prefab, instantiate, Vec3, log as cclog } from 'cc';
import { _ } from '../../common/lodash-compat';

const { ccclass, property } = _decorator;

interface SkillSetItem {
    skillId: number;
    skill: any;
    usageCount: number;
    initCount: number;
    remaindAwardCount: number;
    awardCount: number;
}

interface BufItem {
    start_round_num: number;
    skillData: any;
}


@ccclass('Role')
export default class Role extends Component {
    @property(Prefab)
    emitterPrefab: Prefab = null!;

    // Role properties
    private money: number = 0;
    private score: number = 0;
    private skillSet: SkillSetItem[] = [];
    private bufList: { [key: string]: BufItem[] } = {};
    private emitter: any = null;

    /**
     * 初始化角色
     */
    init(): void {
        this.money = 0;
        this.score = 0;
        this.skillSet = [];
        this.bufList = {};

        this.createEmitter();
        this.initSkillSet();

        // 注册系统事件
        game.eventTarget.on('onStep', (roundNum: number, step: number) => {
            if (step === game.round.STEP_SPAWN_ACTOR) {
                this.nextRound(roundNum);
            } else if (step === game.round.STEP_PLAYER_USE_SKILL) {
                this.useNextRoundSkill(roundNum);
            }
        }, this);
    }

    /**
     * 重放时重置数据
     */
    replay(): void {
        // 重置发射器
        if (this.emitter) {
            this.emitter.clearAllMissile();
            this.emitter.resetAttr();
        }

        // 重置属性
        this.setScore(0);
        
        // 清空buff和技能集合
        this.bufList = {};
        this.resetSkillSet();
    }

    /**
     * 创建发射器
     */
    private createEmitter(): void {
        const node = instantiate(this.emitterPrefab);
        this.node.addChild(node);

        this.emitter = node.getComponent('Emitter');
        this.emitter.init(this);

        cclog('Created emitter:', this.emitter);
    }

    /**
     * 获取发射器
     * @returns 发射器组件
     */
    getEmitter(): any {
        return this.emitter;
    }

    /**
     * 添加金钱
     * @param num 金钱数量
     */
    addMoney(num: number): void {
        this.money += num;
    }

    /**
     * 设置金钱
     * @param num 金钱数量
     */
    setMoney(num: number): void {
        this.money = num;
    }

    /**
     * 获取金钱
     * @returns 当前金钱数量
     */
    getMoney(): number {
        return this.money;
    }

    /**
     * 添加分数
     * @param num 分数
     */
    addScore(num: number): void {
        this.score += num;

        game.player.recordScore(this.score);
        game.eventTarget.emit('setScore', this.score);
    }

    /**
     * 设置分数
     * @param num 分数
     */
    setScore(num: number): void {
        this.score = num;
        game.eventTarget.emit('setScore', this.score);
    }

    /**
     * 获取分数
     * @returns 当前分数
     */
    getScore(): number {
        return this.score;
    }

    /**
     * 初始化技能集合
     */
    private initSkillSet(): void {
        const configSkillSet = game.config.skill_set;
        
        for (let i = 0; i < configSkillSet.length; i++) {
            const s = _.clone(configSkillSet[i]) as SkillSetItem;

            s.skill = game.skillManager.getSkill(s.skillId);
            s.usageCount = s.initCount;
            s.remaindAwardCount = s.awardCount;

            this.skillSet.push(s);
            this.fireSkillEvent(i, s);
        }
    }

    /**
     * 重置技能集合
     */
    private resetSkillSet(): void {
        for (let i = 0; i < this.skillSet.length; i++) {
            const s = this.skillSet[i];
            s.usageCount = s.initCount;
            s.remaindAwardCount = s.awardCount;
            this.fireSkillEvent(i, s);
        }
    }

    /**
     * 获得奖励
     * @param skill 技能对象
     * @param actor 角色对象
     */
    obtainAward(skill: any, actor: any): void {
        // 获取道具的动画特效
        let target: Vec3;

        if (skill.data.function_combi & game.skillManager.FUNCTIN_TYPE_PLAYER_BUF) {
            target = this.emitter.getPosition();
            game.effectManager.createTreasureBox(actor, target);
        } else if (skill.data.function_combi & game.skillManager.FUNCTIN_TYPE_DELAY) {
            if (skill.getSkillId() === 6001) {
                target = game.playground.skill1Position.getPosition();
            } else if (skill.getSkillId() === 6002) {
                target = game.playground.skill2Position.getPosition();
            } else {
                target = this.emitter.getPosition();
            }
            game.effectManager.createTreasureBox(actor, target);
        }

        skill.addBufToPlayer(this);
        skill.addSkillToPlayerSkillSet(this);
    }

    /**
     * 添加Buff
     * @param buf Buff对象
     */
    addBuf(buf: BufItem): void {
        buf.start_round_num = game.round.roundNum() + 1; // 下一回合开始起作用

        const funcDesc = buf.skillData.buf_func;
        let list = this.bufList[funcDesc];
        if (!list) {
            list = [];
            this.bufList[funcDesc] = list;
        }

        list.push(buf);
    }

    /**
     * 获取Buff数量
     * @param funcDesc Buff功能描述
     * @returns Buff数量
     */
    getBufNum(funcDesc: string): number {
        let num = 0;
        let maxNum = 0;
        
        const list = this.bufList[funcDesc];
        if (list) {
            for (let i = 0; i < list.length; i++) {
                if (list[i]) {
                    num += list[i].skillData.num;
                    maxNum = list[i].skillData.num_max;
                }
            }
        }

        if (maxNum && num > maxNum) {
            num = maxNum;
        }

        return num;
    }

    /**
     * 添加技能到技能集合
     * @param skill 技能对象
     * @param skillId 技能ID
     * @returns 技能在集合中的索引，-1表示失败
     */
    addToSkillSet(skill: any, skillId: number): number {
        for (let i = 0; i < this.skillSet.length; i++) {
            const s = this.skillSet[i];
            if (s) {
                if ((skill && s.skillId === skill.getSkillId()) || s.skillId === skillId) {
                    s.usageCount += 1;
                    this.fireSkillEvent(i, s);
                    return i;
                }
            }
        }

        return -1; // 已经满了
    }

    /**
     * 奖励技能到技能集合
     * @param idx 技能索引
     */
    awardToSkillSet(idx: number): void {
        if (idx < this.skillSet.length) {
            const s = this.skillSet[idx];
            if (s.remaindAwardCount > 0) {
                s.remaindAwardCount -= 1;
                s.usageCount += 1;
                this.fireSkillEvent(idx, s);
            }
        }
    }

    /**
     * 获取技能集合剩余奖励数量
     * @param idx 技能索引
     * @returns 剩余奖励数量
     */
    getSkillSetRemaindAwardCount(idx: number): number {
        if (idx < this.skillSet.length) {
            const s = this.skillSet[idx];
            return s.remaindAwardCount;
        }
        return 0;
    }

    /**
     * 获取技能集合总剩余奖励数量
     * @returns 总剩余奖励数量
     */
    getSkillSetRemaindAwardCountTotal(): number {
        let num = 0;
        this.skillSet.forEach(s => {
            num += s.remaindAwardCount;
        });
        return num;
    }

    /**
     * 触发技能事件
     * @param i 技能索引
     * @param s 技能对象
     */
    private fireSkillEvent(i: number, s: SkillSetItem): void {
        game.eventTarget.emit('setSkill', i, s);
    }

    /**
     * 下一回合处理
     * @param roundNum 回合数
     */
    nextRound(roundNum: number): void {
        // 清除过期buff
        _.each(this.bufList, (list: BufItem[]) => {
            for (let i = 0; i < list.length; i++) {
                const b = list[i];
                if (b && this.isExpired(b, roundNum)) {
                    list[i] = null as any;
                }
            }
        });

        // 更新发射器数据
        this.emitter.nextRound(roundNum);
    }

    /**
     * 检查Buff是否过期
     * @param buf Buff对象
     * @param roundNum 当前回合数
     * @returns 是否过期
     */
    private isExpired(buf: BufItem, roundNum: number): boolean {
        // 这里需要根据具体的过期逻辑来实现
        // 假设Buff有duration属性表示持续时间
        const duration = (buf.skillData as any).duration || 1;
        return roundNum >= buf.start_round_num + duration;
    }

    /**
     * 执行技能
     * @param s 技能对象
     * @param idx 技能索引
     */
    doSkill(s: SkillSetItem, idx: number): void {
        if (s && s.skill && s.usageCount > 0) {
            s.skill.doSceneEffect(game.grid);

            s.usageCount -= 1;
            this.fireSkillEvent(idx, s);
        }
    }

    /**
     * 使用下一回合技能
     * @param roundNum 回合数
     */
    useNextRoundSkill(roundNum: number): void {
        let isEmpty = true;

        for (let i = 0; i < this.skillSet.length; i++) {
            const s = this.skillSet[i];
            if (s && s.usageCount > 0) {
                isEmpty = false;

                if (s.skill.isNextRoundSkill()) {
                    this.doSkill(s, i);
                    game.round.setStep(game.round.STEP_FIRE_MISSILE);
                    return;
                }
            }
        }

        if (isEmpty) {
            // 没有任何回合技能
            game.round.setStep(game.round.STEP_FIRE_MISSILE);
        } else {
            game.round.setStep(game.round.STEP_PLAYER_USE_ANY_ROUND_SKILL);
        }
    }

    /**
     * 使用技能
     * @param idx 技能索引
     */
    useSkill(idx: number): void {
        cclog('role useSkill', idx);
        const s = this.skillSet[idx];
        this.doSkill(s, idx);
    }

    /**
     * 游戏循环
     * @param delta 时间间隔
     */
    gameloop(delta: number): void {
        this.emitter.gameloop(delta);
    }

    /**
     * 获取技能集合
     * @returns 技能集合数组
     */
    getSkillSet(): SkillSetItem[] {
        return this.skillSet;
    }

    /**
     * 获取指定索引的技能
     * @param idx 技能索引
     * @returns 技能对象
     */
    getSkill(idx: number): SkillSetItem | null {
        if (idx >= 0 && idx < this.skillSet.length) {
            return this.skillSet[idx];
        }
        return null;
    }

    /**
     * 获取Buff列表
     * @returns Buff列表对象
     */
    getBufList(): { [key: string]: BufItem[] } {
        return this.bufList;
    }

    /**
     * 清除指定类型的所有Buff
     * @param funcDesc Buff功能描述
     */
    clearBuf(funcDesc: string): void {
        if (this.bufList[funcDesc]) {
            delete this.bufList[funcDesc];
        }
    }

    /**
     * 清除所有Buff
     */
    clearAllBuf(): void {
        this.bufList = {};
    }
}