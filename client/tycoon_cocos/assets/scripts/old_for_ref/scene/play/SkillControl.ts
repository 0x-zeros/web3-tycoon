import { _decorator, Component, Node, Label, NodeEventType, log as cclog } from 'cc';
import { _ } from '../../common/lodash-compat';

const { ccclass, property } = _decorator;

const LONG_PRESS_DURATION = 1000;


@ccclass('SkillControl')
export default class SkillControl extends Component {
    @property(Node)
    icon: Node = null!;

    @property(Node)
    icon_gray: Node = null!;

    @property(Label)
    numLabel: Label = null!;

    @property(Node)
    desNode: Node = null!;

    @property({ type: 'Integer' })
    idx: number = 0;

    // Private properties
    private startTime: number = -1;
    private skillId: number = 0;
    private usageCount: number = 0;
    private allowUseSkill: boolean = true;

    onLoad(): void {
        this.desNode.active = false;

        // 初始化数据
        this.skillId = 0;
        this.usageCount = 0;
        this.allowUseSkill = true;

        // 监听技能设置事件
        game.eventTarget.on('setSkill', (idx: number, s: any) => {
            if (this.idx === idx) {
                this.skillId = s.skillId;
                this.usageCount = s.usageCount;
                this.numLabel.string = this.usageCount.toString();
            }
        }, this);

        // 监听步骤变化事件
        game.eventTarget.on('onStep', (roundNum: number, step: number) => {
            if (step === game.round.STEP_PLAYER_USE_ANY_ROUND_SKILL && this.usageCount > 0) {
                this.allowUseSkill = true;
                this.icon_gray.active = false;
            } else {
                this.allowUseSkill = false;
                this.icon_gray.active = true;
            }
        }, this);
    }

    onEnable(): void {
        this.icon.on(NodeEventType.TOUCH_START, this.onTouchStart, this);
        this.icon.on(NodeEventType.TOUCH_END, this.onTouchEnd, this);
        this.icon.on(NodeEventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    onDisable(): void {
        this.icon.off(NodeEventType.TOUCH_START, this.onTouchStart, this);
        this.icon.off(NodeEventType.TOUCH_END, this.onTouchEnd, this);
        this.icon.off(NodeEventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    onDestroy(): void {
        // 移除事件监听
        game.eventTarget.off('setSkill', null, this);
        game.eventTarget.off('onStep', null, this);
    }

    /**
     * 触摸开始处理
     */
    private onTouchStart(): void {
        this.startTime = _.now();
    }

    /**
     * 触摸结束处理
     */
    private onTouchEnd(): void {
        if (this.startTime > 0) {
            if (this.skillId && this.allowUseSkill) {
                game.role.useSkill(this.idx);
            }
        }

        this.startTime = -1;
        this.desNode.active = false;
    }

    /**
     * 触摸取消处理
     */
    private onTouchCancel(): void {
        this.startTime = -1;
        this.desNode.active = false;
    }

    /**
     * 长按处理
     */
    private onLongPress(): void {
        // 显示技能描述
        this.desNode.active = true;
        this.startTime = -1;
    }

    /**
     * 更新处理 - 检测长按
     */
    update(): void {
        if (this.startTime > 0) {
            const df = _.now() - this.startTime;
            if (df > LONG_PRESS_DURATION) {
                this.onLongPress();
            }
        }
    }

    /**
     * 设置技能索引
     * @param idx 技能索引
     */
    setSkillIndex(idx: number): void {
        this.idx = idx;
    }

    /**
     * 获取技能索引
     * @returns 技能索引
     */
    getSkillIndex(): number {
        return this.idx;
    }

    /**
     * 获取技能ID
     * @returns 技能ID
     */
    getSkillId(): number {
        return this.skillId;
    }

    /**
     * 获取使用次数
     * @returns 使用次数
     */
    getUsageCount(): number {
        return this.usageCount;
    }

    /**
     * 是否允许使用技能
     * @returns 是否允许
     */
    isAllowUseSkill(): boolean {
        return this.allowUseSkill;
    }

    /**
     * 手动设置允许使用技能状态
     * @param allow 是否允许
     */
    setAllowUseSkill(allow: boolean): void {
        this.allowUseSkill = allow;
        this.icon_gray.active = !allow;
    }

    /**
     * 显示技能描述
     */
    showDescription(): void {
        this.desNode.active = true;
    }

    /**
     * 隐藏技能描述
     */
    hideDescription(): void {
        this.desNode.active = false;
    }

    /**
     * 设置技能数量显示
     * @param count 数量
     */
    setSkillCount(count: number): void {
        this.usageCount = count;
        this.numLabel.string = count.toString();
    }

    /**
     * 重置控件状态
     */
    reset(): void {
        this.startTime = -1;
        this.skillId = 0;
        this.usageCount = 0;
        this.allowUseSkill = true;
        this.desNode.active = false;
        this.icon_gray.active = false;
        this.numLabel.string = '0';
    }
}