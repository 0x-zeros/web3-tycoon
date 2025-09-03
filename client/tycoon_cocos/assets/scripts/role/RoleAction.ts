/**
 * RoleAction - 角色行为组件
 * 
 * 负责角色的行为逻辑，如移动、攻击、交互等
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';
import { Role } from './Role';
import { RoleState, RoleMoveParams } from './RoleTypes';

/**
 * 行为类型枚举
 */
export enum ActionType {
    IDLE = 'idle',
    MOVE = 'move',
    INTERACT = 'interact',
    USE_SKILL = 'use_skill',
    USE_CARD = 'use_card'
}

/**
 * 行为状态枚举
 */
export enum ActionState {
    READY = 'ready',
    EXECUTING = 'executing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELLED = 'cancelled'
}

/**
 * 行为结果接口
 */
export interface ActionResult {
    /** 是否成功 */
    success: boolean;
    /** 结果消息 */
    message: string;
    /** 行为类型 */
    actionType: ActionType;
    /** 执行时间 */
    duration: number;
    /** 额外数据 */
    data?: any;
}

/**
 * 行为参数接口
 */
export interface ActionParams {
    /** 行为类型 */
    type: ActionType;
    /** 目标对象 */
    target?: any;
    /** 参数数据 */
    data?: any;
    /** 是否异步执行 */
    async?: boolean;
    /** 执行延迟（秒） */
    delay?: number;
}

/**
 * 行为队列项接口
 */
interface ActionQueueItem {
    /** 行为参数 */
    params: ActionParams;
    /** 回调函数 */
    callback?: (result: ActionResult) => void;
    /** 创建时间 */
    createTime: number;
    /** 优先级 */
    priority: number;
}

/**
 * 角色行为组件
 * 管理角色的各种行为和动作
 */
export class RoleAction {
    
    // ========================= 私有属性 =========================
    
    /** 绑定的角色 */
    private m_role: Role | null = null;
    
    /** 当前行为 */
    private m_currentAction: ActionType = ActionType.IDLE;
    
    /** 当前行为状态 */
    private m_actionState: ActionState = ActionState.READY;
    
    /** 行为队列 */
    private m_actionQueue: ActionQueueItem[] = [];
    
    /** 是否正在执行行为 */
    private m_isExecuting: boolean = false;
    
    /** 当前行为开始时间 */
    private m_actionStartTime: number = 0;
    
    /** 行为超时时间（毫秒） */
    private m_actionTimeout: number = 30000; // 30秒
    
    /** 是否启用行为队列 */
    private m_enableQueue: boolean = true;
    
    /** 最大队列长度 */
    private m_maxQueueLength: number = 10;
    
    // ========================= 构造和初始化 =========================
    
    constructor() {
        // 初始化完成
    }
    
    /**
     * 绑定角色
     */
    public bindRole(role: Role): void {
        this.m_role = role;
        console.log(`[RoleAction] 绑定角色: ${role.getName()}`);
    }
    
    /**
     * 解绑角色
     */
    public unbindRole(): void {
        // 清空行为队列
        this.clearQueue();
        
        // 取消当前行为
        if (this.m_isExecuting) {
            this.cancelCurrentAction();
        }
        
        this.m_role = null;
        console.log('[RoleAction] 角色解绑');
    }
    
    // ========================= 行为执行 =========================
    
    /**
     * 执行行为
     */
    public async executeAction(params: ActionParams): Promise<ActionResult> {
        if (!this.m_role) {
            return this.createFailResult('未绑定角色', params.type);
        }
        
        // 检查是否可以执行新行为
        if (this.m_isExecuting && !this.canInterrupt()) {
            if (this.m_enableQueue && this.m_actionQueue.length < this.m_maxQueueLength) {
                // 加入队列
                return this.enqueueAction(params);
            } else {
                return this.createFailResult('角色正在执行其他行为', params.type);
            }
        }
        
        // 设置延迟
        if (params.delay && params.delay > 0) {
            await this.delay(params.delay * 1000);
        }
        
        // 开始执行
        return await this.startAction(params);
    }
    
    /**
     * 开始执行行为
     */
    private async startAction(params: ActionParams): Promise<ActionResult> {
        this.m_isExecuting = true;
        this.m_currentAction = params.type;
        this.m_actionState = ActionState.EXECUTING;
        this.m_actionStartTime = Date.now();
        
        // 更新角色状态
        this.updateRoleState(params.type);
        
        // 触发行为开始事件
        this.emit('action-start', {
            actionType: params.type,
            role: this.m_role,
            params: params
        });
        
        try {
            let result: ActionResult;
            
            // 根据行为类型执行相应逻辑
            switch (params.type) {
                case ActionType.MOVE:
                    result = await this.executeMove(params);
                    break;
                case ActionType.INTERACT:
                    result = await this.executeInteract(params);
                    break;
                case ActionType.USE_SKILL:
                    result = await this.executeUseSkill(params);
                    break;
                case ActionType.USE_CARD:
                    result = await this.executeUseCard(params);
                    break;
                default:
                    result = await this.executeIdle(params);
                    break;
            }
            
            // 更新状态
            this.m_actionState = result.success ? ActionState.COMPLETED : ActionState.FAILED;
            
            return result;
            
        } catch (error) {
            console.error(`[RoleAction] 行为执行异常:`, error);
            this.m_actionState = ActionState.FAILED;
            return this.createFailResult(error.toString(), params.type);
            
        } finally {
            this.finishAction();
        }
    }
    
    /**
     * 结束行为
     */
    private finishAction(): void {
        const duration = Date.now() - this.m_actionStartTime;
        
        // 触发行为结束事件
        this.emit('action-end', {
            actionType: this.m_currentAction,
            actionState: this.m_actionState,
            duration: duration,
            role: this.m_role
        });
        
        // 重置状态
        this.m_isExecuting = false;
        this.m_currentAction = ActionType.IDLE;
        this.m_actionState = ActionState.READY;
        
        // 更新角色状态为空闲
        if (this.m_role) {
            this.m_role.setState(RoleState.IDLE);
        }
        
        // 处理队列中的下一个行为
        this.processNextAction();
    }
    
    // ========================= 具体行为实现 =========================
    
    /**
     * 执行移动行为
     */
    private async executeMove(params: ActionParams): Promise<ActionResult> {
        if (!this.m_role) {
            return this.createFailResult('角色不存在', ActionType.MOVE);
        }
        
        const moveParams = params.data as RoleMoveParams;
        if (!moveParams) {
            return this.createFailResult('移动参数无效', ActionType.MOVE);
        }
        
        try {
            // 检查是否可以移动
            if (!this.m_role.canMove()) {
                return this.createFailResult('角色当前无法移动', ActionType.MOVE);
            }
            
            // 执行移动
            const success = await this.m_role.moveTo(moveParams);
            
            if (success) {
                return this.createSuccessResult('移动完成', ActionType.MOVE, {
                    fromTileId: this.m_role.getCurrentTileId(),
                    toTileId: moveParams.targetTileId,
                    steps: moveParams.steps
                });
            } else {
                return this.createFailResult('移动失败', ActionType.MOVE);
            }
            
        } catch (error) {
            return this.createFailResult(`移动异常: ${error}`, ActionType.MOVE);
        }
    }
    
    /**
     * 执行交互行为
     */
    private async executeInteract(params: ActionParams): Promise<ActionResult> {
        const target = params.target;
        const interactType = params.data?.type || 'default';
        
        console.log(`[RoleAction] 执行交互: ${interactType}`);
        
        // 模拟交互延迟
        await this.delay(500);
        
        return this.createSuccessResult('交互完成', ActionType.INTERACT, {
            target: target,
            interactType: interactType
        });
    }
    
    /**
     * 执行使用技能行为
     */
    private async executeUseSkill(params: ActionParams): Promise<ActionResult> {
        const skillId = params.data?.skillId;
        const target = params.target;
        
        if (!skillId) {
            return this.createFailResult('技能ID无效', ActionType.USE_SKILL);
        }
        
        console.log(`[RoleAction] 使用技能: ${skillId}`);
        
        // 这里需要通过技能系统执行
        // 暂时模拟
        await this.delay(1000);
        
        return this.createSuccessResult('技能使用完成', ActionType.USE_SKILL, {
            skillId: skillId,
            target: target
        });
    }
    
    /**
     * 执行使用卡牌行为
     */
    private async executeUseCard(params: ActionParams): Promise<ActionResult> {
        const cardIndex = params.data?.cardIndex;
        const target = params.target;
        
        if (cardIndex === undefined || cardIndex < 0) {
            return this.createFailResult('卡牌索引无效', ActionType.USE_CARD);
        }
        
        console.log(`[RoleAction] 使用卡牌: ${cardIndex}`);
        
        // 通过角色使用卡牌
        if (this.m_role) {
            const success = await this.m_role.useCard(cardIndex, target as Role);
            
            if (success) {
                return this.createSuccessResult('卡牌使用完成', ActionType.USE_CARD, {
                    cardIndex: cardIndex,
                    target: target
                });
            } else {
                return this.createFailResult('卡牌使用失败', ActionType.USE_CARD);
            }
        }
        
        return this.createFailResult('角色不存在', ActionType.USE_CARD);
    }
    
    /**
     * 执行空闲行为
     */
    private async executeIdle(params: ActionParams): Promise<ActionResult> {
        // 空闲行为无需特殊处理
        return this.createSuccessResult('空闲', ActionType.IDLE);
    }
    
    // ========================= 行为队列管理 =========================
    
    /**
     * 将行为加入队列
     */
    private async enqueueAction(params: ActionParams): Promise<ActionResult> {
        return new Promise((resolve) => {
            const queueItem: ActionQueueItem = {
                params: params,
                callback: resolve,
                createTime: Date.now(),
                priority: this.getActionPriority(params.type)
            };
            
            // 按优先级插入队列
            this.insertActionByPriority(queueItem);
            
            console.log(`[RoleAction] 行为加入队列: ${params.type}`);
        });
    }
    
    /**
     * 按优先级插入行为
     */
    private insertActionByPriority(item: ActionQueueItem): void {
        let inserted = false;
        for (let i = 0; i < this.m_actionQueue.length; i++) {
            if (item.priority > this.m_actionQueue[i].priority) {
                this.m_actionQueue.splice(i, 0, item);
                inserted = true;
                break;
            }
        }
        
        if (!inserted) {
            this.m_actionQueue.push(item);
        }
    }
    
    /**
     * 处理队列中的下一个行为
     */
    private async processNextAction(): Promise<void> {
        if (this.m_actionQueue.length === 0 || this.m_isExecuting) {
            return;
        }
        
        const nextItem = this.m_actionQueue.shift()!;
        const result = await this.startAction(nextItem.params);
        
        if (nextItem.callback) {
            nextItem.callback(result);
        }
    }
    
    /**
     * 获取行为优先级
     */
    private getActionPriority(actionType: ActionType): number {
        switch (actionType) {
            case ActionType.USE_SKILL: return 10;
            case ActionType.USE_CARD: return 9;
            case ActionType.INTERACT: return 8;
            case ActionType.MOVE: return 5;
            case ActionType.IDLE: return 1;
            default: return 5;
        }
    }
    
    /**
     * 清空行为队列
     */
    public clearQueue(): void {
        // 回调所有等待中的行为
        for (const item of this.m_actionQueue) {
            if (item.callback) {
                item.callback(this.createFailResult('行为被取消', item.params.type));
            }
        }
        
        this.m_actionQueue.length = 0;
        console.log('[RoleAction] 行为队列已清空');
    }
    
    // ========================= 行为控制 =========================
    
    /**
     * 取消当前行为
     */
    public cancelCurrentAction(): boolean {
        if (!this.m_isExecuting) {
            return false;
        }
        
        this.m_actionState = ActionState.CANCELLED;
        
        // 触发取消事件
        this.emit('action-cancelled', {
            actionType: this.m_currentAction,
            role: this.m_role
        });
        
        this.finishAction();
        
        console.log(`[RoleAction] 当前行为已取消: ${this.m_currentAction}`);
        return true;
    }
    
    /**
     * 检查是否可以中断当前行为
     */
    private canInterrupt(): boolean {
        // 某些行为不能被中断
        switch (this.m_currentAction) {
            case ActionType.MOVE:
                return false; // 移动中不能中断
            default:
                return true;
        }
    }
    
    /**
     * 检查行为是否超时
     */
    public checkTimeout(): boolean {
        if (!this.m_isExecuting) {
            return false;
        }
        
        const elapsed = Date.now() - this.m_actionStartTime;
        if (elapsed > this.m_actionTimeout) {
            console.warn(`[RoleAction] 行为超时: ${this.m_currentAction}, 耗时: ${elapsed}ms`);
            this.cancelCurrentAction();
            return true;
        }
        
        return false;
    }
    
    // ========================= 辅助方法 =========================
    
    /**
     * 更新角色状态
     */
    private updateRoleState(actionType: ActionType): void {
        if (!this.m_role) return;
        
        switch (actionType) {
            case ActionType.MOVE:
                this.m_role.setState(RoleState.MOVING);
                break;
            case ActionType.IDLE:
            default:
                this.m_role.setState(RoleState.IDLE);
                break;
        }
    }
    
    /**
     * 延迟函数
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 创建成功结果
     */
    private createSuccessResult(message: string, actionType: ActionType, data?: any): ActionResult {
        return {
            success: true,
            message: message,
            actionType: actionType,
            duration: Date.now() - this.m_actionStartTime,
            data: data
        };
    }
    
    /**
     * 创建失败结果
     */
    private createFailResult(message: string, actionType: ActionType): ActionResult {
        return {
            success: false,
            message: message,
            actionType: actionType,
            duration: Date.now() - this.m_actionStartTime
        };
    }
    
    // ========================= 公共接口 =========================
    
    /**
     * 获取当前行为
     */
    public getCurrentAction(): ActionType {
        return this.m_currentAction;
    }
    
    /**
     * 获取当前行为状态
     */
    public getActionState(): ActionState {
        return this.m_actionState;
    }
    
    /**
     * 是否正在执行行为
     */
    public isExecuting(): boolean {
        return this.m_isExecuting;
    }
    
    /**
     * 获取队列长度
     */
    public getQueueLength(): number {
        return this.m_actionQueue.length;
    }
    
    /**
     * 设置行为超时时间
     */
    public setActionTimeout(timeout: number): void {
        this.m_actionTimeout = Math.max(1000, timeout); // 最少1秒
    }
    
    /**
     * 设置是否启用队列
     */
    public setEnableQueue(enable: boolean): void {
        this.m_enableQueue = enable;
        if (!enable) {
            this.clearQueue();
        }
    }
    
    /**
     * 销毁组件
     */
    public destroy(): void {
        this.clearQueue();
        this.cancelCurrentAction();
        this.unbindRole();
        this.targetOff();
        
        console.log('[RoleAction] 组件销毁完成');
    }
    
    /**
     * 调试信息
     */
    public debugInfo(): string {
        const info = [
            `当前行为: ${this.m_currentAction}`,
            `行为状态: ${this.m_actionState}`,
            `队列长度: ${this.m_actionQueue.length}`,
            `正在执行: ${this.m_isExecuting}`,
            `绑定角色: ${this.m_role?.getName() || '无'}`
        ];
        
        return `[RoleAction] ${info.join(', ')}`;
    }
}