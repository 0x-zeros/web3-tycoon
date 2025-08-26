import { _ } from '../../common/lodash-compat';

interface SkillData {
    skill_id: string | number;
    round_num: number;
    percentage: number;
    num: number;
    function_combi: number;
    damage_area: string;
    damage_radius: number;
    boom_url: string;
    boomend_url: string;
    sound: string;
    any_round: boolean;
}

interface BufInterface {
    skill: SkillInterface;
    skillData: SkillData;
    start_round_num: number;
    init: (skill: SkillInterface) => void;
    isExpired: (roundNum: number) => boolean;
}

interface SkillInterface {
    data: SkillData;
    getSkillId: () => string | number;
    init: (skillData: SkillData) => void;
    addBufToPlayer: (player: any) => void;
    addSkillToPlayerSkillSet: (player: any) => void;
    doAttackToActors: (grid: any, gridX: number, gridY: number) => void;
    doSceneEffect: (grid: any) => void;
    isNextRoundSkill: () => boolean;
}

// buf是skill作用在player身上的效果记录
const buf = function (): BufInterface {
    let that = {} as BufInterface;
    that.skill = null;
    that.skillData = null;
    that.start_round_num = 0; // 开始起作用的回合数

    that.init = (skill: SkillInterface): void => {
        that.skill = skill;
        that.skillData = skill.data;
    };

    // 是否已经超过有效回合数了
    that.isExpired = (roundNum: number): boolean => {
        let validRoundNum = that.skillData.round_num;
        // logA('isExpired?', 'roundNum:', roundNum, 'validRoundNum:', validRoundNum, 'start_round_num:', that.start_round_num);
        if (validRoundNum === -1) {
            // 永久有效
            return false;
        } else if (validRoundNum && validRoundNum > 0) {
            let invalidNum = that.start_round_num + validRoundNum;
            if (roundNum >= invalidNum) {
                return true;
            }
        }

        return false;
    };

    return that;
};

const skill = function (): SkillInterface {
    let that = {} as SkillInterface;
    let skill_id: string | number = 0;
    let data: SkillData = null;

    // const define
    // 1: 玩家身上的buf;
    // 2: 场景上的就地技能释放;
    // 4: 放入玩家技能包, 玩家可操作释放时机或者下一回合开始时强制释放
    const FUNCTIN_TYPE_PLAYER_BUF = 1;
    const FUNCTIN_TYPE_IMM = 2;
    const FUNCTIN_TYPE_DELAY = 4;

    that.getSkillId = (): string | number => skill_id;

    // 具体skill效果的实现
    const attackDamage = (actor: any, param?: any): void => {
        // logA('in attackDamage: ', actor.name);

        if (actor.isBad()) {
            let damage = actor.getMaxHp() * data.percentage / 100 + data.num;

            if (actor.isBoss()) {
                damage *= 0.5;
            }

            damage = Math.floor(damage);
            if (isNaN(damage) || damage < 1) {
                damage = 1;
            }

            if (param && param.flyUnitTime) {
                let num = 1;
                if (param.gridX !== undefined) {
                    num = Math.abs(actor.getGridX() - param.gridX);
                } else if (param.gridY !== undefined) {
                    num = Math.abs(actor.getGridY() - param.gridY);
                }
                const delayTime = num * param.flyUnitTime;

                _.delay(() => {
                    actor.onDamage(damage);
                }, delayTime);
            } else {
                actor.onDamage(damage);
            }
        }
    };

    const addFrozenEffect = (actor: any, param?: any): void => {
        // actor.showEffect(param)
        actor.addFrozenEffect();
    };

    that.init = (skillData: SkillData): void => {
        data = skillData;
        that.data = skillData;
        skill_id = skillData.skill_id;
    };

    that.addBufToPlayer = (player: any): void => {
        let doProcess = data.function_combi & FUNCTIN_TYPE_PLAYER_BUF;
        if (doProcess) {
            let b = buf();
            b.init(that);

            player.addBuf(b);
        }
    };

    that.addSkillToPlayerSkillSet = (player: any): void => {
        let doProcess = data.function_combi & FUNCTIN_TYPE_DELAY;
        if (doProcess) {
            player.addToSkillSet(that);
        }
    };

    // 全场景(playground)技能, 不需要x, y
    that.doAttackToActors = (grid: any, gridX: number, gridY: number): void => {
        // logA('doAttackToActors: ', gridX, gridY);

        let doProcess = data.function_combi & FUNCTIN_TYPE_IMM;
        if (doProcess) {
            if (data.damage_area === 'row') {
                const flyUnitTime = 80;

                let param = { gridX: gridX, flyUnitTime: flyUnitTime };
                grid.rowActor(gridX, gridY, attackDamage, param);

                game.effectManager.showRowMissile(that.data.boom_url, gridX, gridY, flyUnitTime);
            } else if (data.damage_area === 'column') {
                const flyUnitTime = 80;
                let param = { gridY: gridY, flyUnitTime: flyUnitTime };
                grid.columnActor(gridX, gridY, attackDamage, param);

                game.effectManager.showColumnMissile(that.data.boom_url, gridX, gridY, flyUnitTime);
            } else if (data.damage_area === 'square') {
                let radius = that.data.damage_radius;
                grid.squareActor(gridX, gridY, radius, attackDamage);

                let effetName = that.data.boom_url;
                let center = grid.getGridPosition(gridX, gridY);
                if (effetName && center) {
                    let size = radius * 2 + 1; // grid.UNIT_ACTOR_PIXEL * (radius * 2 + 1)
                    game.effectManager.showAreaEffect(effetName, center, size);
                }
            } else if (data.damage_area === 'scene') {
                grid.eachActor(attackDamage);
            }

            // music
            // music.playEffect(that.data.sound);
            game.audioManager.playEffect(that.data.sound);
        }
    };

    that.doSceneEffect = (grid: any): void => {
        // 具体skill效果
        if (skill_id === 6001) {
            // 火焰冲击
            const flyUnitTime = 80;
            let param = { gridY: game.grid.MAX_ROW - 1, flyUnitTime: flyUnitTime };
            grid.eachActor(attackDamage, param);

            game.effectManager.showSceneMissile(that.data.boom_url, flyUnitTime);

            _.delay(() => {
                game.grid.spawnDropActors();
            }, flyUnitTime * game.grid.MAX_ROW);
        } else if (skill_id === 6002) {
            // 冰封万里
            // grid.stopMoveAndSpawnNextRound();
            game.round.setRoundFlag(game.round.ROUND_FLAG_STOP_MOVE_AND_SPAWN | game.round.ROUND_FLAG_STOP_ADVANCE_ROUNDNUM);

            let param = { effectType: 'frozen', effectName: that.data.boom_url, endEffectName: that.data.boomend_url };
            grid.eachActor(addFrozenEffect, param);
        }

        // music
        // music.playEffect(that.data.sound);
        game.audioManager.playEffect(that.data.sound);
    };

    // 是否是下个回合应该强制用掉的技能(或者是可选的any round skill)
    that.isNextRoundSkill = (): boolean => {
        return data.any_round;
    };

    return that;
};

export { skill, SkillInterface, SkillData, BufInterface };