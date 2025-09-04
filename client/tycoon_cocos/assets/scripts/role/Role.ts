/**
 * 角色基类
 * 
 * 包含所有角色的核心数据和逻辑，数据层与表现层分离
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Vec3 } from 'cc';
import { forEach, includes } from 'lodash-es';
import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';
import { 
    RoleType, 
    RoleAttribute, 
    RoleState, 
    RoleData, 
    RoleConfig, 
    RoleMoveParams,
    RoleInteractionResult
} from './RoleTypes';
import { Actor } from './Actor';
import { RoleAction } from './RoleAction';
import { Skill } from '../skill/Skill';
import { Card } from '../card/Card';

/**
 * 角色基类
 * 数据层：包含所有角色数据和核心逻辑
 */
export abstract class Role {
    
    // ========================= 基础属性 =========================
    
    /** 唯一ID */
    protected m_oId: string = '';
    
    /** 角色类型 */
    protected m_eType: RoleType = RoleType.PLAYER;
    
    /** 类型ID（区分同类型的不同配置） */
    protected m_iTypeId: number = 0;
    
    /** 角色名称 */
    protected m_strName: string = '';
    
    /** 当前状态 */
    protected m_eState: RoleState = RoleState.IDLE;
    
    // ========================= 位置相关 =========================
    
    /** 世界坐标位置 */
    protected m_position: Vec3 = new Vec3();
    
    /** 当前所在地块ID */
    protected m_currentTileId: number = -1;
    
    /** 目标地块ID */
    protected m_targetTileId: number = -1;
    
    // ========================= 属性系统 =========================
    
    /** 永久属性 */
    protected m_attr: Map<RoleAttribute, number> = new Map();
    
    /** 临时属性 */
    protected m_tmpAttr: Map<RoleAttribute, number> = new Map();
    
    // ========================= 组件引用 =========================
    
    /** 表现层组件（所有Cocos相关API） */
    protected m_actor: Actor | null = null;
    
    /** 行为组件 */
    protected m_roleAction: RoleAction | null = null;
    
    // ========================= 游戏相关 =========================
    
    /** 目标角色 */
    protected m_target: Role | null = null;
    
    /** 攻击者列表 */
    protected m_attackerList: Role[] = [];
    
    /** 背包容器（简化版背包） */
    protected m_inventory: { [key: string]: number } = {};
    
    /** 拥有的技能 */
    protected m_skills: Skill[] = [];
    
    /** 拥有的卡牌 */
    protected m_cards: Card[] = [];
    
    // ========================= 状态标记 =========================
    
    /** 是否已初始化 */
    protected m_bInitialized: boolean = false;
    
    /** 是否可见 */
    protected m_bVisible: boolean = true;
    
    /** 是否激活 */
    protected m_bActive: boolean = true;
    
    // ========================= 构造和初始化 =========================
    
    constructor() {
        this.initializeAttributes();
        this.m_oId = this.generateId();
    }
    
    /**
     * 初始化默认属性
     */
    protected initializeAttributes(): void {
        // 设置默认属性值
        this.m_attr.set(RoleAttribute.MONEY, 10000);
        this.m_attr.set(RoleAttribute.HP, 100);
        this.m_attr.set(RoleAttribute.MOVE_SPEED, 1.0);
        this.m_attr.set(RoleAttribute.LUCK, 50);
        this.m_attr.set(RoleAttribute.LEVEL, 1);
        this.m_attr.set(RoleAttribute.VIP_LEVEL, 0);
        this.m_attr.set(RoleAttribute.PROPERTIES_COUNT, 0);
        this.m_attr.set(RoleAttribute.CARDS_COUNT, 0);
        this.m_attr.set(RoleAttribute.JAIL_TURNS, 0);
        this.m_attr.set(RoleAttribute.BANKRUPT, 0);
        
        // 清空临时属性
        this.m_tmpAttr.clear();
    }
    
    /**
     * 生成唯一ID
     */
    protected generateId(): string {
        return `role_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 初始化角色（从配置）
     */
    public initialize(config: RoleConfig): void {
        this.m_iTypeId = config.typeId;
        this.m_strName = config.name;
        
        // 加载默认属性
        if (config.defaultAttributes) {
            forEach(config.defaultAttributes, (value, attrName) => {
                const attr = RoleAttribute[attrName as keyof typeof RoleAttribute];
                if (attr !== undefined) {
                    this.m_attr.set(attr, value);
                }
            });
        }
        
        // 加载初始技能
        if (config.availableSkills) {
            this.loadSkills(config.availableSkills);
        }
        
        // 加载初始卡牌
        if (config.initialCards) {
            this.loadCards(config.initialCards);
        }
        
        this.m_bInitialized = true;
        
        // 触发初始化完成事件
        EventBus.emit(EventTypes.Role.Initialized, {
            roleId: this.m_oId,
            role: this
        });
        
        console.log(`[Role] 角色初始化完成: ${this.m_strName} (${this.m_oId})`);
    }
    
    // ========================= 属性访问方法 =========================
    
    /**
     * 获取属性值（永久属性 + 临时属性）
     */
    public getAttr(attr: RoleAttribute): number {
        const permanent = this.m_attr.get(attr) || 0;
        const temporary = this.m_tmpAttr.get(attr) || 0;
        return permanent + temporary;
    }
    
    /**
     * 设置永久属性值
     */
    public setAttr(attr: RoleAttribute, value: number): void {
        const oldValue = this.getAttr(attr);
        this.m_attr.set(attr, value);
        
        // 触发属性变化事件
        EventBus.emit(EventTypes.Role.AttributeChange, {
            roleId: this.m_oId,
            attribute: attr,
            oldValue: oldValue,
            newValue: value
        });
        
        // 特殊属性处理
        this.onAttributeChanged(attr, oldValue, this.getAttr(attr));
    }
    
    /**
     * 增加永久属性值
     */
    public addAttr(attr: RoleAttribute, add: number): void {
        const current = this.m_attr.get(attr) || 0;
        this.setAttr(attr, current + add);
    }
    
    /**
     * 获取临时属性值
     */
    public getTmpAttr(attr: RoleAttribute): number {
        return this.m_tmpAttr.get(attr) || 0;
    }
    
    /**
     * 设置临时属性值
     */
    public setTmpAttr(attr: RoleAttribute, value: number): void {
        this.m_tmpAttr.set(attr, value);
    }
    
    /**
     * 增加临时属性值
     */
    public addTmpAttr(attr: RoleAttribute, add: number): void {
        const current = this.m_tmpAttr.get(attr) || 0;
        this.setTmpAttr(attr, current + add);
    }
    
    /**
     * 清除临时属性
     */
    public clearTmpAttr(attr?: RoleAttribute): void {
        if (attr !== undefined) {
            this.m_tmpAttr.delete(attr);
        } else {
            this.m_tmpAttr.clear();
        }
    }
    
    // ========================= 基础访问器 =========================
    
    public getId(): string { return this.m_oId; }
    public getRoleId(): string { return this.m_oId; }
    public setId(id: string): void { this.m_oId = id; }
    
    public getName(): string { return this.m_strName; }
    public setName(name: string): void { this.m_strName = name; }
    
    public getType(): RoleType { return this.m_eType; }
    public setType(type: RoleType): void { this.m_eType = type; }
    
    public getTypeId(): number { return this.m_iTypeId; }
    public setTypeId(typeId: number): void { this.m_iTypeId = typeId; }
    
    public getState(): RoleState { return this.m_eState; }
    public setState(state: RoleState): void {
        const oldState = this.m_eState;
        this.m_eState = state;
        this.onStateChanged(oldState, state);
    }
    
    public getPosition(): Vec3 { return this.m_position.clone(); }
    public setPosition(pos: Vec3): void { 
        this.m_position.set(pos);
        // 通知Actor更新位置
        if (this.m_actor) {
            this.m_actor.updatePosition(pos);
        }
    }
    
    public getCurrentTileId(): number { return this.m_currentTileId; }
    public setCurrentTileId(tileId: number): void {
        const oldTileId = this.m_currentTileId;
        this.m_currentTileId = tileId;
        this.setAttr(RoleAttribute.POSITION, tileId);
        this.onTileChanged(oldTileId, tileId);
    }
    
    // ========================= 组件管理 =========================
    
    public getActor(): Actor | null { return this.m_actor; }
    public setActor(actor: Actor): void { 
        this.m_actor = actor;
        if (actor) {
            actor.bindRole(this);
        }
    }
    
    public getRoleAction(): RoleAction | null { return this.m_roleAction; }
    public setRoleAction(action: RoleAction): void { this.m_roleAction = action; }
    
    // ========================= 技能和卡牌管理 =========================
    
    /**
     * 加载技能
     */
    public loadSkills(skillIds: number[]): void {
        // 这里需要通过SkillManager加载技能
        // 暂时使用占位符
        console.log(`[Role] 加载技能: ${skillIds}`);
    }
    
    /**
     * 加载卡牌
     */
    public loadCards(cardIds: number[]): void {
        // 这里需要通过CardManager加载卡牌
        // 暂时使用占位符
        console.log(`[Role] 加载卡牌: ${cardIds}`);
    }
    
    /**
     * 添加技能
     */
    public addSkill(skill: Skill): void {
        if (!includes(this.m_skills, skill)) {
            this.m_skills.push(skill);
            EventBus.emit(EventTypes.Skill.Learned, {
                roleId: this.m_oId,
                skillId: skill.getConfig().id,
                skill: skill
            });
        }
    }
    
    /**
     * 移除技能
     */
    public removeSkill(skill: Skill): void {
        const index = this.m_skills.indexOf(skill);
        if (index >= 0) {
            this.m_skills.splice(index, 1);
            EventBus.emit(EventTypes.Role.StateChange, {
                roleId: this.m_oId,
                message: 'skill-removed',
                data: { skill: skill }
            });
        }
    }
    
    /**
     * 添加卡牌
     */
    public addCard(card: Card): void {
        if (!includes(this.m_cards, card)) {
            this.m_cards.push(card);
            this.setAttr(RoleAttribute.CARDS_COUNT, this.m_cards.length);
            EventBus.emit(EventTypes.Card.GetNewCard, {
                roleId: this.m_oId,
                card: card
            });
        }
    }
    
    /**
     * 移除卡牌
     */
    public removeCard(card: Card): void {
        const index = this.m_cards.indexOf(card);
        if (index >= 0) {
            this.m_cards.splice(index, 1);
            this.setAttr(RoleAttribute.CARDS_COUNT, this.m_cards.length);
            EventBus.emit(EventTypes.Role.StateChange, {
                roleId: this.m_oId,
                message: 'card-removed',
                data: { card: card }
            });
        }
    }
    
    // ========================= 移动相关 =========================
    
    /**
     * 移动到指定地块
     */
    public async moveTo(params: RoleMoveParams): Promise<boolean> {
        if (this.m_eState === RoleState.MOVING) {
            console.warn(`[Role] ${this.m_strName} 正在移动中`);
            return false;
        }
        
        this.setState(RoleState.MOVING);
        this.m_targetTileId = params.targetTileId;
        
        try {
            // 通知Actor执行移动动画
            if (this.m_actor) {
                await this.m_actor.moveToTile(params);
            }
            
            // 更新位置
            this.setCurrentTileId(params.targetTileId);
            this.setState(RoleState.IDLE);
            
            // 触发移动完成事件
            EventBus.emit(EventTypes.Role.PositionChange, {
                roleId: this.m_oId,
                fromTileId: this.m_currentTileId,
                toTileId: params.targetTileId,
                steps: params.steps,
                position: this.m_position
            });
            
            return true;
            
        } catch (error) {
            console.error(`[Role] ${this.m_strName} 移动失败:`, error);
            this.setState(RoleState.IDLE);
            return false;
        }
    }
    
    // ========================= 数据保存/加载 =========================
    
    /**
     * 导出角色数据
     */
    public exportData(): RoleData {
        const attributeData: { [key: number]: number } = {};
        for (const [attr, value] of this.m_attr) {
            attributeData[attr] = value;
        }
        
        const tmpAttributeData: { [key: number]: number } = {};
        for (const [attr, value] of this.m_tmpAttr) {
            tmpAttributeData[attr] = value;
        }
        
        return {
            id: this.m_oId,
            type: this.m_eType,
            typeId: this.m_iTypeId,
            name: this.m_strName,
            attributes: attributeData,
            tmpAttributes: tmpAttributeData,
            position: this.m_position.clone(),
            currentTileId: this.m_currentTileId,
            skillIds: this.m_skills.map(skill => skill.getId()),
            cardData: this.m_cards.map(card => card.exportData()),
            state: this.m_eState
        };
    }
    
    /**
     * 加载角色数据
     */
    public loadData(data: RoleData): void {
        this.m_oId = data.id;
        this.m_eType = data.type;
        this.m_iTypeId = data.typeId;
        this.m_strName = data.name;
        this.m_position.set(data.position);
        this.m_currentTileId = data.currentTileId;
        this.m_eState = data.state;
        
        // 加载属性
        this.m_attr.clear();
        forEach(data.attributes, (value, attr) => {
            this.m_attr.set(parseInt(attr), value);
        });
        
        // 加载临时属性
        this.m_tmpAttr.clear();
        forEach(data.tmpAttributes, (value, attr) => {
            this.m_tmpAttr.set(parseInt(attr), value);
        });
        
        console.log(`[Role] 角色数据加载完成: ${this.m_strName}`);
    }
    
    // ========================= 状态检查 =========================
    
    /**
     * 是否存活
     */
    public isAlive(): boolean {
        return this.getAttr(RoleAttribute.HP) > 0;
    }
    
    /**
     * 是否破产
     */
    public isBankrupt(): boolean {
        return this.getAttr(RoleAttribute.BANKRUPT) > 0;
    }
    
    /**
     * 是否在监狱
     */
    public isInJail(): boolean {
        return this.getAttr(RoleAttribute.JAIL_TURNS) > 0;
    }
    
    /**
     * 是否可以移动
     */
    public canMove(): boolean {
        return this.m_eState === RoleState.IDLE && 
               !this.isBankrupt() && 
               !this.isInJail();
    }
    
    // ========================= 事件回调（子类可重写） =========================
    
    /**
     * 属性变化回调
     */
    protected onAttributeChanged(attr: RoleAttribute, oldValue: number, newValue: number): void {
        // 子类可重写处理特定属性变化
    }
    
    /**
     * 状态变化回调
     */
    protected onStateChanged(oldState: RoleState, newState: RoleState): void {
        console.log(`[Role] ${this.m_strName} 状态变化: ${oldState} -> ${newState}`);
        EventBus.emit(EventTypes.Role.StateChange, {
            roleId: this.m_oId,
            oldState: oldState,
            newState: newState
        });
    }
    
    /**
     * 地块变化回调
     */
    protected onTileChanged(oldTileId: number, newTileId: number): void {
        console.log(`[Role] ${this.m_strName} 位置变化: ${oldTileId} -> ${newTileId}`);
        EventBus.emit(EventTypes.Role.PositionChange, {
            roleId: this.m_oId,
            oldTileId: oldTileId,
            newTileId: newTileId
        });
    }
    
    // ========================= 工具方法 =========================
    
    /**
     * 重置角色到初始状态
     */
    public reset(): void {
        this.initializeAttributes();
        this.setState(RoleState.IDLE);
        this.m_currentTileId = -1;
        this.m_targetTileId = -1;
        this.m_target = null;
        this.m_attackerList.length = 0;
        this.m_skills.length = 0;
        this.m_cards.length = 0;
        this.clearTmpAttr();
        
        console.log(`[Role] 角色重置完成: ${this.m_strName}`);
    }
    
    /**
     * 销毁角色
     */
    public destroy(): void {
        // 清理所有事件监听（通过EventBus管理）
        // EventBus会自动清理相关事件监听器
        
        // 清理组件引用
        if (this.m_actor) {
            this.m_actor.destroy();
            this.m_actor = null;
        }
        
        if (this.m_roleAction) {
            this.m_roleAction.destroy();
            this.m_roleAction = null;
        }
        
        // 清理背包
        this.m_inventory = {};
        
        // 触发销毁事件
        EventBus.emit(EventTypes.Role.Destroyed, {
            roleId: this.m_oId,
            roleType: this.m_eType,
            roleName: this.m_strName
        });
        
        // 清理数据
        this.m_attr.clear();
        this.m_tmpAttr.clear();
        this.m_skills.length = 0;
        this.m_cards.length = 0;
        this.m_attackerList.length = 0;
        
        console.log(`[Role] 角色销毁完成: ${this.m_strName}`);
    }
    
    /**
     * 调试输出角色信息
     */
    public debugInfo(): string {
        const info = [
            `ID: ${this.m_oId}`,
            `名称: ${this.m_strName}`,
            `类型: ${this.m_eType}`,
            `状态: ${this.m_eState}`,
            `位置: ${this.m_currentTileId}`,
            `金钱: ${this.getAttr(RoleAttribute.MONEY)}`,
            `生命: ${this.getAttr(RoleAttribute.HP)}`,
            `技能数: ${this.m_skills.length}`,
            `卡牌数: ${this.m_cards.length}`
        ];
        
        return `[Role] ${info.join(', ')}`;
    }
}