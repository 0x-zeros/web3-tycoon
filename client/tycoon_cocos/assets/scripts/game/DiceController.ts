/**
 * 骰子控制器 - 单例模式
 * 管理骰子的加载、动画和显示
 */

import {
    _decorator,
    Component,
    Node,
    Prefab,
    instantiate,
    resources,
    Vec3,
    Quat,
    tween,
    Tween,
    Camera,
    director,
} from 'cc';

const { ccclass, property } = _decorator;

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

@ccclass('DiceController')
export class DiceController {
    private static _instance: DiceController | null = null;
    
    private diceNode: Node | null = null;
    private dicePrefab: Prefab | null = null;
    private isRolling: boolean = false;
    private currentValue: number = 1;
    private hideTimer: number | null = null;
    
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
     * 获取相机注视点位置
     */
    private getCameraFocusPosition(): Vec3 {
        // 获取主相机
        const camera = director.getScene()?.getChildByName('Main Camera')?.getComponent(Camera);
        if (!camera) {
            console.warn('[DiceController] 找不到主相机，使用默认位置');
            return new Vec3(0, 5, 0);
        }
        
        // 计算相机前方一定距离的位置作为骰子出现位置
        const cameraPos = camera.node.worldPosition.clone();
        const forward = camera.node.forward.clone();
        
        // 在相机前方10单位的位置
        const focusPos = new Vec3();
        Vec3.add(focusPos, cameraPos, forward.multiplyScalar(10));
        focusPos.y = 5; // 固定高度
        
        return focusPos;
    }
    
    /**
     * 滚动骰子
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
        
        // 确保已初始化
        await this.initialize();
        
        if (!this.dicePrefab) {
            console.error('[DiceController] 骰子预制体未加载');
            return;
        }
        
        this.isRolling = true;
        this.currentValue = value;
        
        // 清理上一次的隐藏计时，避免在新一轮滚动时被旧计时隐藏
        if (this.hideTimer !== null) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }

        // 创建或显示骰子
        if (!this.diceNode) {
            this.diceNode = instantiate(this.dicePrefab);
            director.getScene()?.addChild(this.diceNode);
        }

        // 设置初始位置和显示
        const startPos = this.getCameraFocusPosition();
        this.diceNode.setPosition(startPos);
        this.diceNode.active = true;
        // 停止可能残留的补间动画
        Tween.stopAllByTarget(this.diceNode);
        
        // 播放滚动动画
        this.playRollAnimation(value, () => {
            this.isRolling = false;
            
            // 3秒后隐藏
            this.scheduleHide();
            
            if (callback) {
                callback();
            }
        });
    }
    
    /**
     * 播放骰子滚动动画
     */
    private playRollAnimation(finalValue: number, onComplete: () => void): void {
        if (!this.diceNode) return;
        
        // 初始随机旋转
        const initialRotation = new Quat();
        Quat.fromEuler(initialRotation, 
            Math.random() * 360,
            Math.random() * 360,
            Math.random() * 360
        );
        this.diceNode.setRotation(initialRotation);
        
        // 创建滚动动画（时间缩短一半）
        const rollDuration = 0.75; // 滚动持续时间
        const bounceDuration = 0.25; // 弹跳持续时间
        
        // 滚动阶段 - 快速旋转
        tween(this.diceNode)
            // 上升并旋转
            .to(rollDuration * 0.3, {
                position: new Vec3(
                    this.diceNode.position.x,
                    this.diceNode.position.y + 3,
                    this.diceNode.position.z
                )
            }, { easing: 'quadOut' })
            .by(rollDuration * 0.3, {
                eulerAngles: new Vec3(720, 540, 360) // 快速旋转
            })
            // 下落
            .to(rollDuration * 0.4, {
                position: new Vec3(
                    this.diceNode.position.x,
                    this.diceNode.position.y - 2.5,
                    this.diceNode.position.z
                )
            }, { easing: 'quadIn' })
            .by(rollDuration * 0.4, {
                eulerAngles: new Vec3(360, 270, 180) // 继续旋转
            })
            // 弹跳
            .to(bounceDuration * 0.5, {
                position: new Vec3(
                    this.diceNode.position.x,
                    this.diceNode.position.y + 1,
                    this.diceNode.position.z
                )
            }, { easing: 'quadOut' })
            // 最终落地
            .to(bounceDuration * 0.5, {
                position: new Vec3(
                    this.diceNode.position.x,
                    this.diceNode.position.y - 0.5,
                    this.diceNode.position.z
                )
            }, { easing: 'bounceOut' })
            // 设置最终朝向
            .call(() => {
                if (this.diceNode) {
                    const targetRotation = DICE_FACE_ROTATIONS[finalValue];
                    // 平滑过渡到目标旋转（时间缩短一半）
                    tween(this.diceNode)
                        .to(0.15, { rotation: targetRotation }, { easing: 'quadInOut' })
                        .call(onComplete)
                        .start();
                }
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
        // 使用 setTimeout，并记录句柄，避免与下一次roll冲突
        this.hideTimer = setTimeout(() => {
            this.hide();
            this.hideTimer = null;
        }, 3000) as unknown as number;
    }
    
    /**
     * 隐藏骰子（不销毁）
     */
    public hide(): void {
        if (this.diceNode) {
            this.diceNode.active = false;
        }
    }
    
    /**
     * 显示骰子
     */
    public show(): void {
        if (this.diceNode) {
            this.diceNode.active = true;
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
     * 清理资源
     */
    public cleanup(): void {
        if (this.diceNode) {
            Tween.stopAllByTarget(this.diceNode);
            this.diceNode.destroy();
            this.diceNode = null;
        }
        this.dicePrefab = null;
        this.isRolling = false;
        if (this.hideTimer !== null) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
    }
}
