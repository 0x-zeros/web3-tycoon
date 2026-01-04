/**
 * 骰子控制器 - 单例模式
 * 管理骰子的加载、动画和显示
 * 支持1-3个骰子同时显示
 */

import {
    _decorator,
    Node,
    Prefab,
    instantiate,
    resources,
    Vec3,
    Quat,
    tween,
    Tween,
    director,
} from 'cc';
import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';
import { Blackboard } from '../events/Blackboard';

const { ccclass } = _decorator;

/**
 * 骰子面对应的旋转角度（使目标点数朝上）
 * 贴图布局参照 Horizontal Cross：
 *   上(py)=2， 下(ny)=5， 前(pz)=1， 后(nz)=6， 左(nx)=3， 右(px)=4
 * 我们计算将对应朝向转到 +Y 朝上的旋转。
 */
const DICE_FACE_ROTATIONS: { [key: number]: Quat } = {
    // +Z(前) -> 旋转 -90° 绕X 使前面朝上
    3: Quat.fromEuler(new Quat(), -90, 0, 0),
    // +Y(上) -> 无旋转
    5: Quat.fromEuler(new Quat(), 0, 0, 0),
    // -X(左) -> 旋转 -90° 绕Z 使左面朝上
    6: Quat.fromEuler(new Quat(), 0, 0, -90),
    // +X(右) -> 旋转 +90° 绕Z 使右面朝上
    1: Quat.fromEuler(new Quat(), 0, 0, 90),
    // -Y(下) -> 旋转 180° 绕X 使下面朝上
    2: Quat.fromEuler(new Quat(), 180, 0, 0),
    // -Z(后) -> 旋转 +90° 绕X 使后面朝上
    4: Quat.fromEuler(new Quat(), 90, 0, 0),
};

// 多骰子水平间距
const DICE_SPACING = 1.2;

@ccclass('DiceController')
export class DiceController {
    private static _instance: DiceController | null = null;

    // 多骰子节点数组
    private diceNodes: Node[] = [];
    private dicePrefab: Prefab | null = null;
    private isRolling: boolean = false;
    private currentValue: number = 1;
    private hideTimer: number | null = null;

    // 循环播放相关
    private isLooping: boolean = false;
    private loopTweens: Tween<Node>[] = [];
    private pendingCallback: (() => void) | null = null;

    // 当前骰子数量
    private currentDiceCount: number = 1;

    /**
     * 获取单例实例
     */
    public static get instance(): DiceController {
        if (!this._instance) {
            this._instance = new DiceController();
        }
        return this._instance;
    }

    private constructor() {
        // 私有构造函数，确保单例
    }

    /**
     * 初始化骰子系统
     */
    public async initialize(): Promise<void> {
        if (this.dicePrefab) {
            return; // 已经初始化
        }

        return new Promise((resolve, reject) => {
            resources.load('prefabs/dice', Prefab, (err, prefab) => {
                if (err) {
                    console.error('[DiceController] 加载骰子预制体失败:', err);
                    reject(err);
                    return;
                }

                this.dicePrefab = prefab;
                console.log('[DiceController] 骰子预制体加载成功');
                resolve();
            });
        });
    }

    /**
     * 获取当前活跃玩家位置（用于骰子显示）
     */
    private getActivePlayerPosition(): Vec3 {
        // 从 Blackboard 获取 GameSession
        const session = Blackboard.instance.get<any>("currentGameSession");

        if (!session) {
            console.warn('[DiceController] GameSession 未找到，使用默认位置');
            return new Vec3(0, 8, 0);
        }

        // 获取当前活跃玩家
        const activePlayer = session.getActivePlayer();
        if (!activePlayer) {
            console.warn('[DiceController] 活跃玩家未找到，使用默认位置');
            return new Vec3(0, 8, 0);
        }

        // 获取玩家的 PaperActor 节点
        const paperActor = activePlayer.getPaperActor();
        if (!paperActor || !paperActor.node) {
            console.warn('[DiceController] 玩家节点未找到，使用默认位置');
            return new Vec3(0, 8, 0);
        }

        // 计算骰子位置：玩家位置右侧偏移 + 上方
        const playerPos = paperActor.node.getWorldPosition();
        const dicePos = new Vec3(
            playerPos.x + 1.5,
            playerPos.y + 1.5,
            playerPos.z + 1.5
        );

        return dicePos;
    }

    /**
     * 确保有足够的骰子节点
     */
    private async _ensureDiceNodes(count: number): Promise<void> {
        await this.initialize();

        if (!this.dicePrefab) {
            console.error('[DiceController] 骰子预制体未加载');
            return;
        }

        // 创建缺少的骰子节点
        while (this.diceNodes.length < count) {
            const node = instantiate(this.dicePrefab);
            director.getScene()?.addChild(node);
            node.active = false;
            this.diceNodes.push(node);
            console.log('[DiceController] 创建新骰子节点，总数:', this.diceNodes.length);
        }
    }

    /**
     * 滚动骰子（单骰子兼容方法）
     * @param value 最终显示的值 (1-6)
     * @param callback 动画完成回调
     */
    public async roll(value: number, callback?: () => void): Promise<void> {
        if (this.isRolling) {
            console.warn('[DiceController] 骰子正在滚动中，请稍候');
            return;
        }

        if (value < 1 || value > 6) {
            console.error('[DiceController] 无效的骰子值:', value);
            return;
        }

        await this._ensureDiceNodes(1);

        this.isRolling = true;
        this.currentValue = value;
        this.currentDiceCount = 1;

        // 清理上一次的隐藏计时
        if (this.hideTimer !== null) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }

        const diceNode = this.diceNodes[0];

        // 设置初始位置和显示
        const startPos = this.getActivePlayerPosition();
        diceNode.setPosition(startPos);
        diceNode.active = true;

        // 停止可能残留的补间动画
        Tween.stopAllByTarget(diceNode);

        // 播放滚动动画
        this._playRollAnimationForNode(diceNode, value, () => {
            this.isRolling = false;
            this.scheduleHide();
            if (callback) {
                callback();
            }
        });
    }

    /**
     * 为单个节点播放滚动动画
     */
    private _playRollAnimationForNode(node: Node, finalValue: number, onComplete: () => void): void {
        // 初始随机旋转
        const initialRotation = new Quat();
        Quat.fromEuler(initialRotation,
            Math.random() * 360,
            Math.random() * 360,
            Math.random() * 360
        );
        node.setRotation(initialRotation);

        const rollDuration = 0.75;
        const bounceDuration = 0.25;
        const startPos = node.position.clone();

        tween(node)
            .to(rollDuration * 0.3, {
                position: new Vec3(startPos.x, startPos.y + 3, startPos.z)
            }, { easing: 'quadOut' })
            .by(rollDuration * 0.3, {
                eulerAngles: new Vec3(720, 540, 360)
            })
            .to(rollDuration * 0.4, {
                position: new Vec3(startPos.x, startPos.y + 0.5, startPos.z)
            }, { easing: 'quadIn' })
            .by(rollDuration * 0.4, {
                eulerAngles: new Vec3(360, 270, 180)
            })
            .to(bounceDuration * 0.5, {
                position: new Vec3(startPos.x, startPos.y + 1.5, startPos.z)
            }, { easing: 'quadOut' })
            .to(bounceDuration * 0.5, {
                position: new Vec3(startPos.x, startPos.y + 1, startPos.z)
            }, { easing: 'bounceOut' })
            .call(() => {
                const targetRotation = DICE_FACE_ROTATIONS[finalValue];
                tween(node)
                    .to(0.15, { rotation: targetRotation }, { easing: 'quadInOut' })
                    .call(onComplete)
                    .start();
            })
            .start();
    }

    /**
     * 计划隐藏骰子
     */
    private scheduleHide(): void {
        if (this.hideTimer !== null) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
        this.hideTimer = setTimeout(() => {
            this.hide();
            this.hideTimer = null;
        }, 3000) as unknown as number;
    }

    /**
     * 隐藏所有骰子（不销毁）
     */
    public hide(): void {
        for (const node of this.diceNodes) {
            node.active = false;
        }
    }

    /**
     * 显示当前数量的骰子
     */
    public show(): void {
        for (let i = 0; i < this.currentDiceCount && i < this.diceNodes.length; i++) {
            this.diceNodes[i].active = true;
        }
    }

    /**
     * 获取当前骰子值
     */
    public getCurrentValue(): number {
        return this.currentValue;
    }

    /**
     * 是否正在滚动
     */
    public getIsRolling(): boolean {
        return this.isRolling;
    }

    /**
     * 开始循环播放骰子动画（等待链上结果）
     * @param diceCount 骰子数量（1-3）
     * @param onComplete 完成回调（收到链上结果并停止后调用）
     */
    public async startRolling(diceCount: number, onComplete: () => void): Promise<void> {
        if (this.isRolling || this.isLooping) {
            console.warn('[DiceController] 骰子正在滚动或循环中');
            return;
        }

        // 限制骰子数量
        diceCount = Math.max(1, Math.min(3, diceCount));
        this.currentDiceCount = diceCount;

        await this._ensureDiceNodes(diceCount);

        this.isLooping = true;
        this.pendingCallback = onComplete;

        // 清理上一次的隐藏计时
        if (this.hideTimer !== null) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }

        // 获取基础位置
        const basePos = this.getActivePlayerPosition();

        // 设置每个骰子的位置并开始循环动画
        for (let i = 0; i < diceCount; i++) {
            const node = this.diceNodes[i];

            // 水平排列，居中对齐
            const offsetX = (i - (diceCount - 1) / 2) * DICE_SPACING;
            node.setPosition(basePos.x + offsetX, basePos.y, basePos.z);
            node.active = true;

            // 停止可能残留的补间动画
            Tween.stopAllByTarget(node);

            // 播放循环动画
            this._playLoopAnimationForNode(node, i);
        }

        // 隐藏多余的骰子
        for (let i = diceCount; i < this.diceNodes.length; i++) {
            this.diceNodes[i].active = false;
        }

        console.log('[DiceController] 开始循环播放骰子动画，数量:', diceCount);

        // 监听链上结果
        EventBus.on(EventTypes.Dice.RollResult, this._onRollResult, this);
    }

    /**
     * 为单个节点播放循环旋转动画
     */
    private _playLoopAnimationForNode(node: Node, index: number): void {
        // 随机初始旋转（每个骰子不同）
        const initialRotation = new Quat();
        Quat.fromEuler(initialRotation,
            Math.random() * 360,
            Math.random() * 360,
            Math.random() * 360
        );
        node.setRotation(initialRotation);

        // 持续旋转动画（每个骰子速度略有不同）
        const speed = 0.5 + index * 0.05;
        const loopTween = tween(node)
            .by(speed, {
                eulerAngles: new Vec3(180, 270, 180)
            })
            .union()
            .repeat(999)
            .start() as Tween<Node>;

        this.loopTweens.push(loopTween);
    }

    /**
     * 收到链上骰子结果
     */
    private _onRollResult(data: { values: number[] }): void {
        if (!this.isLooping) return;

        console.log('[DiceController] 收到链上骰子值:', data.values);

        // 停止循环，播放停止动画到各自目标值
        this._stopAtValues(data.values);

        // 取消监听
        EventBus.off(EventTypes.Dice.RollResult, this._onRollResult, this);
    }

    /**
     * 停止骰子在指定值数组（每个骰子独立显示）
     * @param values 骰子值数组，每个骰子对应一个值（1-6）
     */
    private _stopAtValues(values: number[]): void {
        this.isLooping = false;
        this.isRolling = true;

        // 计算总和作为 currentValue（用于兼容）
        this.currentValue = values.reduce((a, b) => a + b, 0);

        // 停止所有循环动画
        for (const loopTween of this.loopTweens) {
            loopTween.stop();
        }
        this.loopTweens = [];

        console.log('[DiceController] 停止循环，播放减速动画到各值:', values);

        let completedCount = 0;

        // 为每个骰子播放停止动画（使用各自的值）
        for (let i = 0; i < this.currentDiceCount; i++) {
            const node = this.diceNodes[i];
            Tween.stopAllByTarget(node);

            // 获取该骰子的目标值（如果values长度不够，默认使用1）
            const diceValue = values[i] || 1;
            // 确保值在1-6范围内
            const clampedValue = Math.max(1, Math.min(6, diceValue));
            const targetRotation = DICE_FACE_ROTATIONS[clampedValue];

            const startPos = node.position.clone();

            tween(node)
                // 减速阶段
                .by(0.12, {
                    eulerAngles: new Vec3(90, 135, 90)
                }, { easing: 'quadOut' })
                // 弹跳落地
                .to(0.08, {
                    position: new Vec3(startPos.x, startPos.y + 1, startPos.z)
                }, { easing: 'quadOut' })
                .to(0.08, {
                    position: new Vec3(startPos.x, startPos.y - 0.5, startPos.z)
                }, { easing: 'bounceOut' })
                // 最终旋转到目标值
                .to(0.12, { rotation: targetRotation }, { easing: 'quadInOut' })
                .call(() => {
                    completedCount++;
                    // 所有骰子动画完成后回调
                    if (completedCount >= this.currentDiceCount) {
                        this.isRolling = false;
                        this.scheduleHide();

                        if (this.pendingCallback) {
                            this.pendingCallback();
                            this.pendingCallback = null;
                        }

                        console.log('[DiceController] 所有骰子动画完成，停在值:', values);
                    }
                })
                .start();
        }
    }

    /**
     * 停止骰子循环动画（用于交易失败时）
     */
    public stopRolling(): void {
        console.log('[DiceController] 停止骰子循环动画（交易失败）');

        // 停止所有循环动画
        for (const loopTween of this.loopTweens) {
            loopTween.stop();
        }
        this.loopTweens = [];

        // 取消事件监听
        EventBus.off(EventTypes.Dice.RollResult, this._onRollResult, this);

        // 停止所有补间动画
        for (const node of this.diceNodes) {
            Tween.stopAllByTarget(node);
        }

        // 重置状态
        this.isRolling = false;
        this.isLooping = false;
        this.pendingCallback = null;

        // 隐藏骰子
        this.hide();

        console.log('[DiceController] 骰子已停止');
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        // 停止所有循环动画
        for (const loopTween of this.loopTweens) {
            loopTween.stop();
        }
        this.loopTweens = [];

        // 取消事件监听
        EventBus.off(EventTypes.Dice.RollResult, this._onRollResult, this);

        // 销毁所有骰子节点
        for (const node of this.diceNodes) {
            Tween.stopAllByTarget(node);
            node.destroy();
        }
        this.diceNodes = [];

        this.dicePrefab = null;
        this.isRolling = false;
        this.isLooping = false;
        this.pendingCallback = null;
        this.currentDiceCount = 1;

        if (this.hideTimer !== null) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
    }
}
