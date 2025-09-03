import { skill } from './skill';
import { _ } from '../../common/lodash-compat';

// 技能接口定义
interface SkillInstance {
    data: any;
    getSkillId: () => string | number;
    init: (skillData: any) => void;
    addBufToPlayer: (player: any) => void;
    addSkillToPlayerSkillSet: (player: any) => void;
    doAttackToActors: (grid: any, gridX: number, gridY: number) => void;
    doSceneEffect: (grid: any) => void;
    isNextRoundSkill: () => boolean;
}

/**
 * 技能管理器类
 * 负责技能的加载、初始化和获取
 */
class SkillManager {
    // 技能功能类型常量
    public static readonly FUNCTION_TYPE_PLAYER_BUF = 1;
    public static readonly FUNCTION_TYPE_IMM = 2;
    public static readonly FUNCTION_TYPE_DELAY = 4;

    // 私有属性
    private skills: Map<string | number, SkillInstance> = new Map();

    constructor() {
        // 构造函数中不做任何初始化，等待外部调用 init
    }

    /**
     * 初始化技能管理器
     * 必须在 game.jsonData 加载完成后调用
     */
    public init(): void {
        console.log('skillManager init');
        this.initSkills();
    }

    /**
     * 从配置数据中初始化技能
     */
    private initSkills(): void {
        const skillList = game.jsonData.skill;
        _.each(skillList, (data: any) => {
            const skillInstance = skill();
            skillInstance.init(data);
            this.skills.set(data.skill_id, skillInstance);
        });
    }

    /**
     * 根据技能ID获取技能实例
     * @param skillId 技能ID
     * @returns 技能实例，如果不存在返回undefined
     */
    public getSkill(skillId: string | number): SkillInstance | undefined {
        return this.skills.get(skillId);
    }

    /**
     * 获取所有技能
     * @returns 技能Map
     */
    public getAllSkills(): Map<string | number, SkillInstance> {
        return this.skills;
    }

    /**
     * 检查技能是否存在
     * @param skillId 技能ID
     * @returns 是否存在
     */
    public hasSkill(skillId: string | number): boolean {
        return this.skills.has(skillId);
    }

    // 为了向后兼容，保留这些常量属性
    public get FUNCTIN_TYPE_PLAYER_BUF(): number {
        return SkillManager.FUNCTION_TYPE_PLAYER_BUF;
    }

    public get FUNCTIN_TYPE_IMM(): number {
        return SkillManager.FUNCTION_TYPE_IMM;
    }

    public get FUNCTIN_TYPE_DELAY(): number {
        return SkillManager.FUNCTION_TYPE_DELAY;
    }
}

export { SkillManager };