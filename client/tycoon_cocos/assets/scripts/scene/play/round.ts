/**
 * 回合管理系统 - 适配Cocos Creator v3.8
 * 管理游戏回合状态和步骤流程
 */

interface IRound {
    // 步骤常量
    readonly STEP_SPAWN_ACTOR: number;
    readonly STEP_PLAYER_USE_SKILL: number;
    readonly STEP_PLAYER_USE_ANY_ROUND_SKILL: number;
    readonly STEP_FIRE_MISSILE: number;
    readonly STEP_WAIT_NEXT_ROUND: number;
    readonly STEP_ALL: number;

    // 回合标志常量
    readonly ROUND_FLAG_NONE: number;
    readonly ROUND_FLAG_STOP_MOVE_AND_SPAWN: number;
    readonly ROUND_FLAG_STOP_ADVANCE_ROUNDNUM: number;

    // 方法
    init(): void;
    next(): void;
    roundNum(): number;
    start(): void;
    setStep(nextStep: number): void;
    getStep(): number;
    setRoundFlag(flag: number): void;
    clearRoundFlag(): void;
    isRoundFlag(flag: number): boolean;
}

interface RoundFlag {
    roundNum: number;
    flag: number;
}

/**
 * 创建回合管理对象
 * @returns 回合管理实例
 */
export function round(): IRound {
    // 私有变量
    let num: number = 1; // 用于spawn怪物等的round num，在比如技能冰封万里的影响下会有一回合不递增等情况
    let num_inc: number = 1; // 不受任何影响，一直递增的数字

    // 步骤常量
    const STEP_NONE = -1; // 未开始round
    const STEP_SPAWN_ACTOR = 0; // 新出来一行怪物
    const STEP_PLAYER_USE_SKILL = 1; // 玩家主动技能的使用
    const STEP_PLAYER_USE_ANY_ROUND_SKILL = 2; // 玩家主动技能any round skill的使用
    const STEP_FIRE_MISSILE = 3; // 玩家发射子弹
    const STEP_WAIT_NEXT_ROUND = 4; // 等待子弹和actor碰撞(碰撞后结束该回合)
    const STEP_ALL = 100; // 用于所有step都触发回调

    // 回合标志常量
    const ROUND_FLAG_NONE = 0;
    const ROUND_FLAG_STOP_MOVE_AND_SPAWN = 1;
    const ROUND_FLAG_STOP_ADVANCE_ROUNDNUM = 2;

    let step: number = STEP_NONE;
    let roundFlag: RoundFlag = { roundNum: 0, flag: ROUND_FLAG_NONE };

    /**
     * 步骤回调处理
     * @param currentStep 当前步骤
     */
    const onStep = (currentStep: number): void => {
        // 发射步骤事件，监听者可以根据步骤执行相应逻辑
        game.eventTarget.emit('onStep', num, currentStep);
    };

    const roundInstance: IRound = {
        // 常量属性
        STEP_SPAWN_ACTOR,
        STEP_PLAYER_USE_SKILL,
        STEP_PLAYER_USE_ANY_ROUND_SKILL,
        STEP_FIRE_MISSILE,
        STEP_WAIT_NEXT_ROUND,
        STEP_ALL,

        ROUND_FLAG_NONE,
        ROUND_FLAG_STOP_MOVE_AND_SPAWN,
        ROUND_FLAG_STOP_ADVANCE_ROUNDNUM,

        /**
         * 初始化回合系统
         */
        init(): void {
            num = 1;
            num_inc = 1;
            step = STEP_NONE;
            roundInstance.clearRoundFlag();
        },

        /**
         * 进入下一回合
         */
        next(): void {
            num_inc += 1;

            if (!roundInstance.isRoundFlag(ROUND_FLAG_STOP_ADVANCE_ROUNDNUM)) {
                num += 1;
            }

            game.eventTarget.emit('nextRound', num);
        },

        /**
         * 获取当前回合数
         * @returns 当前回合数
         */
        roundNum(): number {
            return num;
        },

        /**
         * 开始回合
         */
        start(): void {
            step = STEP_SPAWN_ACTOR;
            onStep(step);
            game.eventTarget.emit('nextRound', num);
        },

        /**
         * 设置当前步骤
         * @param nextStep 下一个步骤
         */
        setStep(nextStep: number): void {
            step = nextStep;
            onStep(step);
        },

        /**
         * 获取当前步骤
         * @returns 当前步骤
         */
        getStep(): number {
            return step;
        },

        /**
         * 设置回合标志（用于特殊技能效果）
         * @param flag 标志值
         */
        setRoundFlag(flag: number): void {
            roundFlag.roundNum = num_inc + 1;
            roundFlag.flag = flag;
        },

        /**
         * 清除回合标志
         */
        clearRoundFlag(): void {
            roundFlag.roundNum = 0;
            roundFlag.flag = ROUND_FLAG_NONE;
        },

        /**
         * 检查是否有指定的回合标志
         * @param flag 要检查的标志
         * @returns 是否有该标志
         */
        isRoundFlag(flag: number): boolean {
            if (roundFlag.roundNum === num_inc) {
                return (roundFlag.flag & flag) !== 0;
            }
            return false;
        }
    };

    return roundInstance;
}

/**
 * 回合管理器类（可选的面向对象实现）
 */
export class RoundManager implements IRound {
    private _round: IRound;

    constructor() {
        this._round = round();
    }

    // 常量属性代理
    get STEP_SPAWN_ACTOR(): number { return this._round.STEP_SPAWN_ACTOR; }
    get STEP_PLAYER_USE_SKILL(): number { return this._round.STEP_PLAYER_USE_SKILL; }
    get STEP_PLAYER_USE_ANY_ROUND_SKILL(): number { return this._round.STEP_PLAYER_USE_ANY_ROUND_SKILL; }
    get STEP_FIRE_MISSILE(): number { return this._round.STEP_FIRE_MISSILE; }
    get STEP_WAIT_NEXT_ROUND(): number { return this._round.STEP_WAIT_NEXT_ROUND; }
    get STEP_ALL(): number { return this._round.STEP_ALL; }

    get ROUND_FLAG_NONE(): number { return this._round.ROUND_FLAG_NONE; }
    get ROUND_FLAG_STOP_MOVE_AND_SPAWN(): number { return this._round.ROUND_FLAG_STOP_MOVE_AND_SPAWN; }
    get ROUND_FLAG_STOP_ADVANCE_ROUNDNUM(): number { return this._round.ROUND_FLAG_STOP_ADVANCE_ROUNDNUM; }

    // 方法代理
    init(): void {
        this._round.init();
    }

    next(): void {
        this._round.next();
    }

    roundNum(): number {
        return this._round.roundNum();
    }

    start(): void {
        this._round.start();
    }

    setStep(nextStep: number): void {
        this._round.setStep(nextStep);
    }

    getStep(): number {
        return this._round.getStep();
    }

    setRoundFlag(flag: number): void {
        this._round.setRoundFlag(flag);
    }

    clearRoundFlag(): void {
        this._round.clearRoundFlag();
    }

    isRoundFlag(flag: number): boolean {
        return this._round.isRoundFlag(flag);
    }

    /**
     * 获取内部回合实例（用于特殊情况）
     * @returns 回合实例
     */
    getRoundInstance(): IRound {
        return this._round;
    }

    /**
     * 销毁回合管理器
     */
    destroy(): void {
        // 清理事件监听等资源
        game.eventTarget.targetOff(this);
    }
}

// 类型导出
export type { IRound, RoundFlag };