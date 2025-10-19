/**
 * CashFlyAnimation - 现金飞字动画管理器
 *
 * 职责：
 * 1. 管理 FairyGUI Cash 组件的对象池
 * 2. 提供三种动画：
 *    - 向上飘（减钱，红色）
 *    - 向下飘（加钱，绿色）
 *    - 抛物线转账（玩家A→玩家B，黄色）
 * 3. 3D世界坐标 → FairyGUI屏幕坐标转换
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import * as fgui from 'fairygui-cc';
import * as TWEEN from '@tweenjs/tween.js';
import { Vec2, Vec3, Camera } from 'cc';
import { CashFlyPool, PoolConfig } from './CashFlyPool';
import type { Player } from '../../role/Player';

/**
 * 动画配置
 */
export interface AnimationConfig {
    /** 向上飘动画距离（像素） */
    floatUpDistance: number;
    /** 向上飘动画时长（毫秒） */
    floatUpDuration: number;
    /** 向下飘动画距离（像素） */
    floatDownDistance: number;
    /** 向下飘动画时长（毫秒） */
    floatDownDuration: number;
    /** 向下飘停留时长（毫秒） */
    floatDownStayDuration: number;
    /** 转账动画抛物线高度（像素） */
    transferArcHeight: number;
    /** 转账动画时长（毫秒） */
    transferDuration: number;
}

/**
 * 默认动画配置
 */
const DEFAULT_CONFIG: AnimationConfig = {
    floatUpDistance: 100,
    floatUpDuration: 1000,
    floatDownDistance: 100,
    floatDownDuration: 800,
    floatDownStayDuration: 500,
    transferArcHeight: 150,
    transferDuration: 1200
};

/**
 * CashFlyAnimation 单例类
 */
export class CashFlyAnimation {
    /** 单例实例 */
    private static _instance: CashFlyAnimation | null = null;

    /** 对象池 */
    private _pool: CashFlyPool;

    /** 动画配置 */
    private _config: AnimationConfig;

    /** 是否已初始化 */
    private _initialized: boolean = false;

    /** FairyGUI 根节点 */
    private _groot: fgui.GRoot | null = null;

    private constructor() {
        this._pool = new CashFlyPool();
        this._config = { ...DEFAULT_CONFIG };
        console.log('[CashFlyAnimation] 管理器创建');
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): CashFlyAnimation {
        if (!CashFlyAnimation._instance) {
            CashFlyAnimation._instance = new CashFlyAnimation();
        }
        return CashFlyAnimation._instance;
    }

    /**
     * 初始化动画系统
     *
     * @param packageName FairyGUI 包名（默认 "InGame"）
     * @param componentName 组件名（默认 "Cash"）
     */
    public initialize(packageName: string = 'InGame', componentName: string = 'Cash'): void {
        if (this._initialized) {
            console.warn('[CashFlyAnimation] 已经初始化过');
            return;
        }

        console.log('[CashFlyAnimation] 初始化动画系统', { packageName, componentName });

        // 获取 GRoot
        this._groot = fgui.GRoot.inst;
        if (!this._groot) {
            console.error('[CashFlyAnimation] GRoot 未初始化');
            return;
        }

        // 初始化对象池
        const poolConfig: PoolConfig = {
            packageName,
            componentName,
            initialSize: 10,      // 预创建10个
            maxActive: 20         // 最多同时20个
        };

        this._pool.initialize(poolConfig);

        this._initialized = true;
        console.log('[CashFlyAnimation] 初始化完成');
    }

    /**
     * 播放减钱动画（向上飘，红色）
     *
     * @param player 玩家
     * @param amount 金额（正数）
     */
    public async playCashDecrease(player: Player, amount: bigint): Promise<void> {
        if (!this._initialized) {
            console.warn('[CashFlyAnimation] 未初始化');
            return;
        }

        // 获取玩家的屏幕坐标
        const screenPos = await this._getPlayerScreenPosition(player);
        if (!screenPos) {
            console.warn('[CashFlyAnimation] 无法获取玩家屏幕坐标');
            return;
        }

        // 从池中获取对象
        const cashComponent = this._pool.get();
        if (!cashComponent) {
            console.warn('[CashFlyAnimation] 对象池已满或创建失败');
            return;
        }

        // 设置文本和颜色
        const titleText = cashComponent.getChild('title') as fgui.GTextField;
        if (titleText) {
            titleText.text = `-${amount.toString()}`;
            titleText.color = 0xFF0000; // 红色
        }

        // 播放向上飘动画
        this._playFloatUpAnimation(cashComponent, screenPos);

        console.log(`[CashFlyAnimation] 播放减钱动画: -${amount}`);
    }

    /**
     * 播放加钱动画（向下飘，绿色）
     *
     * @param player 玩家
     * @param amount 金额（正数）
     */
    public async playCashIncrease(player: Player, amount: bigint): Promise<void> {
        if (!this._initialized) {
            console.warn('[CashFlyAnimation] 未初始化');
            return;
        }

        // 获取玩家的屏幕坐标
        const screenPos = await this._getPlayerScreenPosition(player);
        if (!screenPos) {
            console.warn('[CashFlyAnimation] 无法获取玩家屏幕坐标');
            return;
        }

        // 从池中获取对象
        const cashComponent = this._pool.get();
        if (!cashComponent) {
            console.warn('[CashFlyAnimation] 对象池已满或创建失败');
            return;
        }

        // 设置文本和颜色
        const titleText = cashComponent.getChild('title') as fgui.GTextField;
        if (titleText) {
            titleText.text = `+${amount.toString()}`;
            titleText.color = 0x00FF00; // 绿色
        }

        // 播放向下飘动画
        this._playFloatDownAnimation(cashComponent, screenPos);

        console.log(`[CashFlyAnimation] 播放加钱动画: +${amount}`);
    }

    /**
     * 播放转账动画（抛物线，黄色）
     *
     * @param fromPlayer 付款玩家
     * @param toPlayer 收款玩家
     * @param amount 金额（正数）
     */
    public async playCashTransfer(fromPlayer: Player, toPlayer: Player, amount: bigint): Promise<void> {
        if (!this._initialized) {
            console.warn('[CashFlyAnimation] 未初始化');
            return;
        }

        // 获取起点和终点屏幕坐标
        const fromPos = await this._getPlayerScreenPosition(fromPlayer);
        const toPos = await this._getPlayerScreenPosition(toPlayer);

        if (!fromPos || !toPos) {
            console.warn('[CashFlyAnimation] 无法获取玩家屏幕坐标');
            return;
        }

        // 从池中获取对象
        const cashComponent = this._pool.get();
        if (!cashComponent) {
            console.warn('[CashFlyAnimation] 对象池已满或创建失败');
            return;
        }

        // 设置文本和颜色
        const titleText = cashComponent.getChild('title') as fgui.GTextField;
        if (titleText) {
            titleText.text = amount.toString();
            titleText.color = 0xFFFF00; // 黄色
        }

        // 播放转账动画
        this._playTransferAnimation(cashComponent, fromPos, toPos);

        console.log(`[CashFlyAnimation] 播放转账动画: ${amount}`);
    }

    /**
     * 获取玩家的屏幕坐标（FairyGUI坐标系）
     *
     * @param player 玩家
     * @returns 屏幕坐标，如果无法获取返回 null
     */
    private async _getPlayerScreenPosition(player: Player): Promise<Vec2 | null> {
        // 获取 PaperActor
        const paperActor = player.getPaperActor();
        if (!paperActor || !paperActor.node) {
            console.warn('[CashFlyAnimation] Player 没有 PaperActor');
            return null;
        }

        // 获取世界坐标
        const worldPos = new Vec3();
        paperActor.node.getWorldPosition(worldPos);

        // 世界坐标 → 屏幕坐标
        // 使用 CameraController 获取主摄像机（不能使用 Camera.main）
        const { CameraController } = await import('../../camera/CameraController');
        const camera = CameraController.getMainCamera();
        if (!camera) {
            console.warn('[CashFlyAnimation] 主摄像机未初始化');
            return null;
        }

        const screenPos = new Vec3();
        camera.worldToScreen(worldPos, screenPos);

        // Cocos 屏幕坐标转 FairyGUI 坐标
        // FairyGUI: 左上角为原点 (0, 0)
        // Cocos: 左下角为原点 (0, 0)
        const fguiX = screenPos.x;
        const fguiY = this._groot!.height - screenPos.y;

        return new Vec2(fguiX, fguiY);
    }

    /**
     * 播放向上飘动画
     *
     * @param cashComponent Cash 组件
     * @param startPos 起始位置
     */
    private _playFloatUpAnimation(cashComponent: fgui.GComponent, startPos: Vec2): void {
        // 设置初始位置和状态
        cashComponent.setXY(startPos.x, startPos.y);
        cashComponent.alpha = 1.0;
        cashComponent.visible = true;

        // 添加到 GRoot
        this._groot!.addChild(cashComponent);

        // 动画目标
        const target = { y: startPos.y, alpha: 1.0 };
        const endY = startPos.y - this._config.floatUpDistance;

        new TWEEN.Tween(target)
            .to({ y: endY, alpha: 0 }, this._config.floatUpDuration)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate(() => {
                cashComponent.y = target.y;
                cashComponent.alpha = target.alpha;
            })
            .onComplete(() => {
                // 回收到池
                this._pool.recycle(cashComponent);
            })
            .start();
    }

    /**
     * 播放向下飘动画
     *
     * @param cashComponent Cash 组件
     * @param playerPos 玩家位置
     */
    private _playFloatDownAnimation(cashComponent: fgui.GComponent, playerPos: Vec2): void {
        // 起始位置（玩家上方）
        const startY = playerPos.y - this._config.floatDownDistance;

        // 设置初始位置和状态
        cashComponent.setXY(playerPos.x, startY);
        cashComponent.alpha = 1.0;
        cashComponent.visible = true;

        // 添加到 GRoot
        this._groot!.addChild(cashComponent);

        // 动画目标
        const target = { y: startY };

        new TWEEN.Tween(target)
            .to({ y: playerPos.y }, this._config.floatDownDuration)
            .easing(TWEEN.Easing.Bounce.Out)
            .onUpdate(() => {
                cashComponent.y = target.y;
            })
            .onComplete(() => {
                // 停留一段时间后淡出
                const fadeTarget = { alpha: 1.0 };
                new TWEEN.Tween(fadeTarget)
                    .to({ alpha: 0 }, 300)
                    .delay(this._config.floatDownStayDuration)
                    .onUpdate(() => {
                        cashComponent.alpha = fadeTarget.alpha;
                    })
                    .onComplete(() => {
                        // 回收到池
                        this._pool.recycle(cashComponent);
                    })
                    .start();
            })
            .start();
    }

    /**
     * 播放转账动画（抛物线）
     *
     * @param cashComponent Cash 组件
     * @param fromPos 起点位置
     * @param toPos 终点位置
     */
    private _playTransferAnimation(
        cashComponent: fgui.GComponent,
        fromPos: Vec2,
        toPos: Vec2
    ): void {
        // 设置初始位置和状态
        cashComponent.setXY(fromPos.x, fromPos.y);
        cashComponent.alpha = 1.0;
        cashComponent.visible = true;

        // 添加到 GRoot
        this._groot!.addChild(cashComponent);

        // 计算抛物线控制点（顶点）
        const controlX = (fromPos.x + toPos.x) / 2;
        const controlY = Math.min(fromPos.y, toPos.y) - this._config.transferArcHeight;

        // 动画参数
        const target = { t: 0 };

        new TWEEN.Tween(target)
            .to({ t: 1 }, this._config.transferDuration)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                const t = target.t;

                // 二次贝塞尔曲线
                const x = (1 - t) * (1 - t) * fromPos.x + 2 * (1 - t) * t * controlX + t * t * toPos.x;
                const y = (1 - t) * (1 - t) * fromPos.y + 2 * (1 - t) * t * controlY + t * t * toPos.y;

                cashComponent.setXY(x, y);

                // 到达终点时开始淡出
                if (t > 0.8) {
                    cashComponent.alpha = 1 - (t - 0.8) / 0.2;
                }
            })
            .onComplete(() => {
                // 回收到池
                this._pool.recycle(cashComponent);
            })
            .start();
    }

    /**
     * 销毁动画系统
     */
    public destroy(): void {
        console.log('[CashFlyAnimation] 销毁动画系统');

        // 清空对象池
        this._pool.clear();

        this._initialized = false;
        this._groot = null;

        CashFlyAnimation._instance = null;
        console.log('[CashFlyAnimation] 动画系统已销毁');
    }

    /**
     * 获取统计信息
     */
    public getStats() {
        return this._pool.getStats();
    }
}

// 导出单例访问器
export const cashFlyAnimation = {
    get instance(): CashFlyAnimation {
        return CashFlyAnimation.getInstance();
    }
};
