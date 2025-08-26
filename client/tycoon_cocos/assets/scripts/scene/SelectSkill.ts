import { _decorator, Component, Node, Label, NodeEventType, EventTouch, Button } from 'cc';
import { _ } from '../common/lodash-compat';
import Scene from './Scene';

const { ccclass, property } = _decorator;


/**
 * 技能选择场景
 * 允许玩家选择和获取技能
 */
@ccclass('SelectSkill')
export default class SelectSkill extends Scene {
    @property([Node])
    skillRoot: Node[] = [];

    @property([Label])
    skillCountLabel: Label[] = [];

    @property(Node)
    btnSkill1: Node = null!;

    @property(Node)
    btnSkill2: Node = null!;

    /**
     * 启用时注册事件和更新显示
     */
    onEnable(): void {
        super.onEnable?.();
        
        this.btnSkill1.on(NodeEventType.TOUCH_END, this.addSkill1, this);
        this.btnSkill2.on(NodeEventType.TOUCH_END, this.addSkill2, this);

        this.updateShow();
    }

    /**
     * 禁用时注销事件
     */
    onDisable(): void {
        super.onDisable?.();
        
        this.btnSkill1.off(NodeEventType.TOUCH_END, this.addSkill1, this);
        this.btnSkill2.off(NodeEventType.TOUCH_END, this.addSkill2, this);
    }

    /**
     * 添加技能1
     */
    private addSkill1(): void {
        game.role.awardToSkillSet(0);

        game.audioManager.playEffect('click');
        game.popScene();
    }

    /**
     * 添加技能2
     */
    private addSkill2(): void {
        game.role.awardToSkillSet(1);

        game.audioManager.playEffect('click');
        game.popScene();
    }

    /**
     * 更新显示状态
     */
    private updateShow(): void {
        const configSkillSet = game.config.skill_set;
        
        for (let i = 0; i < configSkillSet.length; i++) {
            const num = game.role.getSkillSetRemaindAwardCount(i);
            
            // 更新数量标签
            if (this.skillCountLabel[i]) {
                this.skillCountLabel[i].string = 'x' + num.toString();
            }
            
            // 更新技能根节点的可见性
            if (this.skillRoot[i]) {
                this.skillRoot[i].active = num > 0;
            }
        }
    }

    /**
     * 获取指定技能的剩余奖励数量
     * @param skillIndex 技能索引
     * @returns 剩余奖励数量
     */
    getSkillRemainingCount(skillIndex: number): number {
        return game.role.getSkillSetRemaindAwardCount(skillIndex);
    }

    /**
     * 检查指定技能是否可选
     * @param skillIndex 技能索引
     * @returns 是否可选
     */
    isSkillSelectable(skillIndex: number): boolean {
        return this.getSkillRemainingCount(skillIndex) > 0;
    }

    /**
     * 获取所有技能的剩余奖励总数
     * @returns 总剩余奖励数量
     */
    getTotalRemainingCount(): number {
        return game.role.getSkillSetRemaindAwardCountTotal();
    }

    /**
     * 程序化添加指定技能
     * @param skillIndex 技能索引
     */
    addSkillByIndex(skillIndex: number): void {
        if (this.isSkillSelectable(skillIndex)) {
            game.role.awardToSkillSet(skillIndex);
            this.updateShow();
            
            // 播放音效
            game.audioManager.playEffect('click');
        }
    }

    /**
     * 设置技能按钮的可交互性
     * @param skillIndex 技能索引
     * @param interactable 是否可交互
     */
    setSkillInteractable(skillIndex: number, interactable: boolean): void {
        const button = skillIndex === 0 ? this.btnSkill1 : this.btnSkill2;
        if (button) {
            const buttonComponent = button.getComponent(Button);
            if (buttonComponent) {
                buttonComponent.interactable = interactable;
            }
        }
    }

    /**
     * 刷新所有技能按钮的可交互状态
     */
    refreshSkillButtons(): void {
        for (let i = 0; i < 2; i++) {
            const isSelectable = this.isSkillSelectable(i);
            this.setSkillInteractable(i, isSelectable);
        }
    }

    /**
     * 获取技能配置信息
     * @param skillIndex 技能索引
     * @returns 技能配置对象
     */
    getSkillConfig(skillIndex: number): any {
        const configSkillSet = game.config.skill_set;
        return configSkillSet[skillIndex] || null;
    }

    /**
     * 检查是否还有可选技能
     * @returns 是否有可选技能
     */
    hasSelectableSkills(): boolean {
        return this.getTotalRemainingCount() > 0;
    }

    /**
     * 重置技能选择状态
     */
    resetSkillSelection(): void {
        this.updateShow();
        this.refreshSkillButtons();
    }

    /**
     * 获取技能显示名称
     * @param skillIndex 技能索引
     * @returns 技能名称
     */
    getSkillDisplayName(skillIndex: number): string {
        const config = this.getSkillConfig(skillIndex);
        return config ? config.name || `Skill ${skillIndex + 1}` : `Unknown Skill`;
    }

    /**
     * 设置技能数量标签文本
     * @param skillIndex 技能索引
     * @param count 数量
     */
    setSkillCountText(skillIndex: number, count: number): void {
        if (this.skillCountLabel[skillIndex]) {
            this.skillCountLabel[skillIndex].string = 'x' + count.toString();
        }
    }

    /**
     * 强制更新显示（用于外部调用）
     */
    forceUpdateDisplay(): void {
        this.updateShow();
        this.refreshSkillButtons();
    }
}