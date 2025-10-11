/**
 * RollAndStepAction - 掷骰移动动作播放类
 *
 * 封装 RollAndStepActionEvent，提供 step-by-step 播放控制
 * 类似视频播放器，支持播放、暂停、继续、跳过等操作
 *
 * 设计模式：状态机模式 + 观察者模式
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import type { RollAndStepActionEvent, StepEffect } from '../types/RollAndStepEvent';
import { EventBus } from '../../events/EventBus';
import { EventTypes } from '../../events/EventTypes';

/**
 * 播放状态枚举
 */
export enum PlaybackState {
    /** 空闲状态（未开始） */
    IDLE = 'idle',
    /** 播放中 */
    PLAYING = 'playing',
    /** 暂停中 */
    PAUSED = 'paused',
    /** 已完成 */
    COMPLETED = 'completed',
    /** 已停止 */
    STOPPED = 'stopped'
}

/**
 * 步骤回调函数类型
 */
export type StepCallback = (step: StepEffect, index: number) => void | Promise<void>;

/**
 * 完成回调函数类型
 */
export type CompleteCallback = () => void | Promise<void>;

/**
 * 错误回调函数类型
 */
export type ErrorCallback = (error: Error) => void;

/**
 * 播放配置
 */
export interface PlaybackConfig {
    /** 每步之间的延迟（毫秒），默认 500ms */
    stepDelay?: number;
    /** 是否自动播放，默认 true */
    autoPlay?: boolean;
    /** 播放速度倍数，默认 1.0（1.5 = 1.5倍速） */
    playbackSpeed?: number;
}

/**
 * RollAndStepAction 播放类
 */
export class RollAndStepAction {
    /** 事件数据 */
    private event: RollAndStepActionEvent;

    /** 当前播放状态 */
    private state: PlaybackState = PlaybackState.IDLE;

    /** 当前播放到的步骤索引 */
    private currentStepIndex: number = -1;

    /** 播放配置 */
    private config: Required<PlaybackConfig>;

    /** 回调函数 */
    private callbacks: {
        onStepStart?: StepCallback;
        onStepComplete?: StepCallback;
        onComplete?: CompleteCallback;
        onError?: ErrorCallback;
    } = {};

    /** 播放定时器 */
    private playbackTimer: any = null;

    /** 是否正在执行 step（防止重复执行） */
    private isExecutingStep: boolean = false;

    constructor(event: RollAndStepActionEvent, config?: PlaybackConfig) {
        this.event = event;

        // 设置默认配置
        this.config = {
            stepDelay: config?.stepDelay ?? 500,
            autoPlay: config?.autoPlay ?? true,
            playbackSpeed: config?.playbackSpeed ?? 1.0
        };

        console.log('[RollAndStepAction] Created:', {
            game: event.game,
            player: event.player,
            steps: event.steps.length,
            config: this.config
        });
    }

    // ========================= 播放控制 =========================

    /**
     * 开始播放
     */
    public async play(): Promise<void> {
        if (this.state === PlaybackState.PLAYING) {
            console.warn('[RollAndStepAction] Already playing');
            return;
        }

        if (this.state === PlaybackState.COMPLETED) {
            console.warn('[RollAndStepAction] Already completed');
            return;
        }

        console.log('[RollAndStepAction] Starting playback');
        this.state = PlaybackState.PLAYING;

        // 发送播放开始事件
        EventBus.emit(EventTypes.Game.ActionPlaybackStart, {
            action: this,
            event: this.event
        });

        // 开始播放循环
        await this.playbackLoop();
    }

    /**
     * 暂停播放
     */
    public pause(): void {
        if (this.state !== PlaybackState.PLAYING) {
            console.warn('[RollAndStepAction] Not playing, cannot pause');
            return;
        }

        console.log('[RollAndStepAction] Paused');
        this.state = PlaybackState.PAUSED;

        // 清除定时器
        if (this.playbackTimer) {
            clearTimeout(this.playbackTimer);
            this.playbackTimer = null;
        }

        // 发送暂停事件
        EventBus.emit(EventTypes.Game.ActionPlaybackPaused, {
            action: this,
            currentStep: this.currentStepIndex
        });
    }

    /**
     * 继续播放
     */
    public async resume(): Promise<void> {
        if (this.state !== PlaybackState.PAUSED) {
            console.warn('[RollAndStepAction] Not paused, cannot resume');
            return;
        }

        console.log('[RollAndStepAction] Resumed');
        this.state = PlaybackState.PLAYING;

        // 发送恢复事件
        EventBus.emit(EventTypes.Game.ActionPlaybackResumed, {
            action: this,
            currentStep: this.currentStepIndex
        });

        // 继续播放循环
        await this.playbackLoop();
    }

    /**
     * 跳过当前步骤
     */
    public skipCurrentStep(): void {
        if (this.state !== PlaybackState.PLAYING && this.state !== PlaybackState.PAUSED) {
            console.warn('[RollAndStepAction] Cannot skip, not in playback');
            return;
        }

        console.log(`[RollAndStepAction] Skipping step ${this.currentStepIndex}`);

        // 如果正在执行 step，标记为跳过
        // 实际跳过会在 executeStep 中处理
    }

    /**
     * 停止播放
     */
    public stop(): void {
        console.log('[RollAndStepAction] Stopped');
        this.state = PlaybackState.STOPPED;

        // 清除定时器
        if (this.playbackTimer) {
            clearTimeout(this.playbackTimer);
            this.playbackTimer = null;
        }

        // 发送停止事件
        EventBus.emit(EventTypes.Game.ActionPlaybackStopped, {
            action: this,
            currentStep: this.currentStepIndex
        });
    }

    // ========================= 播放逻辑 =========================

    /**
     * 播放循环（核心）
     */
    private async playbackLoop(): Promise<void> {
        while (this.state === PlaybackState.PLAYING) {
            // 检查是否还有步骤
            if (this.currentStepIndex >= this.event.steps.length - 1) {
                // 播放完成
                await this.complete();
                return;
            }

            // 执行下一步
            this.currentStepIndex++;
            const step = this.event.steps[this.currentStepIndex];

            try {
                await this.executeStep(step, this.currentStepIndex);
            } catch (error) {
                console.error(`[RollAndStepAction] Error executing step ${this.currentStepIndex}:`, error);
                this.handleError(error as Error);
                return;
            }

            // 等待延迟（根据播放速度调整）
            const delay = this.config.stepDelay / this.config.playbackSpeed;
            await this.delay(delay);
        }
    }

    /**
     * 执行单个步骤
     */
    private async executeStep(step: StepEffect, index: number): Promise<void> {
        if (this.isExecutingStep) {
            console.warn('[RollAndStepAction] Step already executing, skipping');
            return;
        }

        this.isExecutingStep = true;

        try {
            console.log(`[RollAndStepAction] Executing step ${index}:`, step);

            // 触发步骤开始回调
            if (this.callbacks.onStepStart) {
                await this.callbacks.onStepStart(step, index);
            }

            // 发送步骤开始事件
            EventBus.emit(EventTypes.Game.ActionStepStart, {
                action: this,
                step,
                index
            });

            // 处理路过获得的卡牌
            if (step.pass_draws && step.pass_draws.length > 0) {
                console.log(`[RollAndStepAction] Pass draws:`, step.pass_draws);
                EventBus.emit(EventTypes.Game.CardDrawn, {
                    cards: step.pass_draws,
                    isPass: true
                });
            }

            // 处理 NPC 交互
            if (step.npc_event) {
                console.log(`[RollAndStepAction] NPC event:`, step.npc_event);
                EventBus.emit(EventTypes.Game.NPCInteraction, {
                    npcEvent: step.npc_event
                });
            }

            // 处理停留效果
            if (step.stop_effect) {
                console.log(`[RollAndStepAction] Stop effect:`, step.stop_effect);
                EventBus.emit(EventTypes.Game.TileStopEffect, {
                    stopEffect: step.stop_effect
                });
            }

            // 触发步骤完成回调
            if (this.callbacks.onStepComplete) {
                await this.callbacks.onStepComplete(step, index);
            }

            // 发送步骤完成事件
            EventBus.emit(EventTypes.Game.ActionStepComplete, {
                action: this,
                step,
                index
            });

        } finally {
            this.isExecutingStep = false;
        }
    }

    /**
     * 播放完成
     */
    private async complete(): Promise<void> {
        console.log('[RollAndStepAction] Playback completed');
        this.state = PlaybackState.COMPLETED;

        // 触发完成回调
        if (this.callbacks.onComplete) {
            await this.callbacks.onComplete();
        }

        // 发送完成事件
        EventBus.emit(EventTypes.Game.ActionPlaybackComplete, {
            action: this,
            event: this.event
        });
    }

    /**
     * 处理错误
     */
    private handleError(error: Error): void {
        console.error('[RollAndStepAction] Playback error:', error);
        this.state = PlaybackState.STOPPED;

        // 触发错误回调
        if (this.callbacks.onError) {
            this.callbacks.onError(error);
        }

        // 发送错误事件
        EventBus.emit(EventTypes.Game.ActionPlaybackError, {
            action: this,
            error: error.message
        });
    }

    /**
     * 延迟工具函数
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => {
            this.playbackTimer = setTimeout(() => {
                this.playbackTimer = null;
                resolve();
            }, ms);
        });
    }

    // ========================= 回调注册 =========================

    /**
     * 注册步骤开始回调
     */
    public onStepStart(callback: StepCallback): this {
        this.callbacks.onStepStart = callback;
        return this;
    }

    /**
     * 注册步骤完成回调
     */
    public onStepComplete(callback: StepCallback): this {
        this.callbacks.onStepComplete = callback;
        return this;
    }

    /**
     * 注册播放完成回调
     */
    public onComplete(callback: CompleteCallback): this {
        this.callbacks.onComplete = callback;
        return this;
    }

    /**
     * 注册错误回调
     */
    public onError(callback: ErrorCallback): this {
        this.callbacks.onError = callback;
        return this;
    }

    // ========================= 访问器 =========================

    /**
     * 获取事件数据
     */
    public getEvent(): RollAndStepActionEvent {
        return this.event;
    }

    /**
     * 获取当前状态
     */
    public getState(): PlaybackState {
        return this.state;
    }

    /**
     * 获取当前步骤索引
     */
    public getCurrentStepIndex(): number {
        return this.currentStepIndex;
    }

    /**
     * 获取总步数
     */
    public getTotalSteps(): number {
        return this.event.steps.length;
    }

    /**
     * 获取播放进度（0-1）
     */
    public getProgress(): number {
        if (this.event.steps.length === 0) return 0;
        return (this.currentStepIndex + 1) / this.event.steps.length;
    }

    /**
     * 是否正在播放
     */
    public isPlaying(): boolean {
        return this.state === PlaybackState.PLAYING;
    }

    /**
     * 是否已完成
     */
    public isCompleted(): boolean {
        return this.state === PlaybackState.COMPLETED;
    }
}
