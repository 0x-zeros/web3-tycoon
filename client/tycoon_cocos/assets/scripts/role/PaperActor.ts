/**
 * PaperActor - 统一的纸片角色/建筑渲染组件
 *
 * 用于渲染所有非体素的游戏对象，包括：
 * - NPC（各种神、狗等）
 * - 玩家角色
 * - 建筑物（各等级）
 * - 特殊物体
 *
 * 特性：
 * - Billboard效果（始终面向相机）
 * - Tween动画（跳跃、缩放、移动等）
 * - 帧动画系统
 * - 动态纹理切换
 */

import {
    _decorator, Component, Camera, Node, Vec3, MeshRenderer,
    Material, Mesh, Texture2D, SpriteFrame, utils, primitives,
    Quat, tween, Tween, resources, ImageAsset, UITransform,
    Size, Sprite, find, EffectAsset, Prefab, instantiate
} from 'cc';
import type { Role } from './Role';

const { ccclass, property } = _decorator;

// Actor类型枚举
export enum ActorType {
    NPC = 0,
    PLAYER = 1,
    BUILDING = 2,
    OBJECT = 3
}

@ccclass('PaperActor')
export class PaperActor extends Component {

    // ===== 基础配置 =====
    @property
    actorId: string = '';  // 如 'web3:land_god', 'web3:property_small'

    @property
    level: number = 1;  // 等级（主要用于建筑）

    @property({ type: ActorType })
    actorType: ActorType = ActorType.NPC;

    @property(Camera)
    camera: Camera | null = null;

    @property(Node)
    card: Node | null = null;  // 纸片节点

    @property
    billboardMode: 'full' | 'yAxis' | 'off' = 'yAxis';

    @property
    direction: number = 0;  // 方向（0-3），对应Y轴旋转 0°, 90°, 180°, 270°

    // ===== 渲染相关 =====
    private meshRenderer: MeshRenderer | null = null;
    private quadMesh: Mesh | null = null;
    private material: Material | null = null;
    private currentTexture: Texture2D | null = null;

    // ===== 帧动画 =====
    @property([SpriteFrame])
    frames: SpriteFrame[] = [];  // 所有动画帧

    private currentFrame: number = 0;
    private frameTimer: number = 0;
    private frameRange: [number, number] = [0, 0];  // 当前动画的帧范围
    private isPlayingAnimation: boolean = false;

    @property
    frameRate: number = 10;  // 每秒帧数

    // ===== 动画管理 =====
    private tweens: Map<string, Tween<any>> = new Map();

    // ===== 状态 =====
    private state: 'idle' | 'moving' | 'jumping' | 'talking' | 'building' = 'idle';

    // ===== UI元素 =====
    private textBubble: Node | null = null;  // 对话气泡
    private arrowNode: Node | null = null;   // 方向指示箭头（仅建筑类型使用）

    // ===== 逻辑关联 =====
    /** 关联的逻辑对象（Player/NPC/等，都继承自 Role） */
    public role: Role | null = null;

    // Billboard更新用的临时变量
    private _tmp = new Vec3();

    // ===== 生命周期 =====

    protected onLoad() {
        // 先隐藏节点，等资源加载完成后再显示
        this.node.active = false;

        // 如果没有指定card节点，使用自身
        if (!this.card) {
            this.card = this.node;
        }

        // 自动查找相机
        if (!this.camera) {
            const cameraNode = find('Main Camera') || find('Camera');
            if (cameraNode) {
                this.camera = cameraNode.getComponent(Camera);
            }
        }

        // 初始化渲染组件
        this.setupRenderer();
    }

    protected start() {
        // 不在这里直接加载纹理，而是等待initialize调用
    }

    protected update(dt: number) {
        // Billboard更新
        if (this.billboardMode !== 'off') {
            this.updateBillboard();
        }

        // 帧动画更新
        if (this.isPlayingAnimation && this.frames.length > 0) {
            this.updateFrameAnimation(dt);
        }
    }

    protected onDestroy() {
        // 清理所有动画
        this.stopAllTweens();

        // 清理箭头节点
        if (this.arrowNode) {
            this.arrowNode.destroy();
            this.arrowNode = null;
        }
    }

    // ===== 初始化 =====

    /**
     * 初始化Actor（异步加载资源）
     */
    public async initialize(): Promise<boolean> {
        try {
            // console.log(`[PaperActor] Initializing ${this.node.name}...`);

            // 1. 先确保材质已创建并准备好
            await this.ensureMaterialReady();

            // 2. 加载纹理
            if (this.actorId) {
                await this.loadTexture();
            }

            // 3. 应用方向旋转（仅对建筑生效，因为其他类型需要Billboard）
            if (this.actorType === ActorType.BUILDING && this.billboardMode === 'off') {
                this.applyDirection();
                // 为建筑加载方向指示箭头
                await this.loadArrowIndicator();
            }

            // 4. 根据类型设置默认动画
            if (this.actorType === ActorType.NPC || this.actorType === ActorType.PLAYER) {
                this.playFrameAnimation('idle');
            }

            // 5. 资源加载完成，显示节点
            this.node.active = true;
            // console.log(`[PaperActor] Initialized ${this.node.name} successfully`);
            return true;
        } catch (error) {
            console.error(`[PaperActor] Failed to initialize ${this.node.name}:`, error);
            // 加载失败也显示，避免完全看不见
            this.node.active = true;
            return false;
        }
    }

    /**
     * 确保材质已准备好
     */
    private ensureMaterialReady(): Promise<void> {
        return new Promise((resolve) => {
            if (this.material) {
                resolve();
                return;
            }

            // 等待材质创建完成
            let checkCount = 0;
            const checkInterval = setInterval(() => {
                if (this.material) {
                    clearInterval(checkInterval);
                    resolve();
                } else if (checkCount++ > 20) { // 最多等2秒
                    clearInterval(checkInterval);
                    console.warn('[PaperActor] Material not ready after timeout');
                    resolve();
                }
            }, 100);
        });
    }

    /**
     * 设置渲染组件
     */
    private setupRenderer() {
        // 获取或创建MeshRenderer
        this.meshRenderer = this.card.getComponent(MeshRenderer);
        if (!this.meshRenderer) {
            this.meshRenderer = this.card.addComponent(MeshRenderer);
        }

        // 创建Quad网格
        this.createQuadMesh();

        // 创建材质
        this.createMaterial();
    }

    /**
     * 创建Quad网格（两个三角形组成的平面）
     * 原点在底部中心
     */
    private createQuadMesh() {
        // 创建简单的Quad几何体
        const quadInfo = primitives.quad();

        // 修改顶点位置，将原点从中心移动到底部中心
        // 原始的quad顶点是 (-0.5, -0.5) 到 (0.5, 0.5)
        // 我们需要改为 (-0.5, 0) 到 (0.5, 1)
        if (quadInfo.positions) {
            const positions = quadInfo.positions as Float32Array;
            // quad有 4 个顶点，每个顶点有3个分量 (x, y, z)
            // 只需要将y分量加上0.5
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] += 0.5; // y分量加上0.5
            }
        }

        this.quadMesh = utils.MeshUtils.createMesh(quadInfo);

        if (this.meshRenderer) {
            this.meshRenderer.mesh = this.quadMesh;
        }
    }

    /**
     * 创建材质
     */
    private createMaterial() {
        // 方法1: 尝试加载预制材质并创建新实例
        resources.load('materials/paper-actor', Material, (err, templateMaterial) => {
            if (!err && templateMaterial) {
              this.material = new Material();
              this.material.copy(templateMaterial);
            }
            else {
              console.error('[PaperActor] Failed to create material!');
            }
        });
    }

    // ===== Billboard功能 =====

    private updateBillboard() {
        if (!this.camera || !this.card) return;

        const camPos = this.camera.node.worldPosition;
        const myPos = this.node.worldPosition;

        if (this.billboardMode === 'full') {
            // 完全面向相机
            this.card.lookAt(camPos);
        } else if (this.billboardMode === 'yAxis') {
            // 仅Y轴旋转（纸片马里奥效果）
            Vec3.subtract(this._tmp, camPos, myPos);
            this._tmp.y = 0; // 锁定Y轴

            if (this._tmp.lengthSqr() > 0.001) {
                this._tmp.normalize();
                const yaw = Math.atan2(this._tmp.x, this._tmp.z);
                this.card.setRotationFromEuler(0, yaw * 180 / Math.PI, 0);
            }
        }
    }

    // ===== 纹理管理 =====

    /**
     * 加载纹理
     */
    public async loadTexture() {
        const texturePath = this.getTexturePath();
        if (!texturePath) {
            console.warn(`[PaperActor] No texture path for ${this.node.name}`);
            return;
        }

        return new Promise<void>((resolve) => {
            // 加载纹理，需要添加 /texture 后缀
            const fullPath = texturePath + '/texture';
            // console.log(`[PaperActor] Loading texture: ${fullPath} for ${this.node.name}`);

            resources.load(fullPath, Texture2D, (err, texture) => {
                if (err) {
                    console.error(`[PaperActor] Failed to load texture: ${texturePath}`, err);
                    resolve();
                    return;
                }

                // 立即应用纹理
                this.applyTexture(texture);
                resolve();
            });
        });
    }

    /**
     * 获取纹理路径
     */
    private getTexturePath(): string {
        if (!this.actorId) return '';

        const id = this.actorId.replace('web3:', '');

        // 根据类型决定路径
        if (this.actorType === ActorType.BUILDING) {
            // 建筑：包含等级
            if (this.level === 0) {
                return `web3/buildings/lv${this.level}`;
            }
            return `web3/buildings/${id}_lv${this.level}`;
        } else {
            // NPC/物体/玩家
            return `web3/actors/${id}`;
        }
    }

    /**
     * 应用纹理到材质
     */
    private applyTexture(texture: Texture2D) {
        if (!this.material) {
            console.warn(`[PaperActor] Material not ready for ${this.node.name}`);
            // 重试一次
            this.scheduleOnce(() => {
                if (this.material && texture) {
                    this.applyTexture(texture);
                }
            }, 0.1);
            return;
        }

        // 设置纹理到材质
        try {
            // Cocos Creator 3.x 中 sprite 材质使用 mainTexture
            this.material.setProperty('mainTexture', texture);

            // 保存当前纹理引用
            this.currentTexture = texture;

            // 重要：每次设置纹理后都重新应用材质到渲染器
            // 这确保了材质更改生效
            if (this.meshRenderer) {
                this.meshRenderer.setMaterial(this.material, 0);
            }

            // console.log(`[PaperActor] Set texture for ${this.node.name}: ${texture.name || 'unnamed'}`);
        } catch (e) {
            console.warn(`[PaperActor] Failed to set texture for ${this.node.name}:`, e);
        }
    }

    /**
     * 设置单帧纹理
     */
    public setFrame(frameIndex: number) {
        if (frameIndex >= 0 && frameIndex < this.frames.length) {
            const frame = this.frames[frameIndex];
            if (frame && frame.texture) {
                this.applyTexture(frame.texture as Texture2D);
            }
        }
    }

    // ===== 动画API =====

    /**
     * 跳跃动画
     */
    public jump(height: number = 0.5, duration: number = 0.5) {
        this.stopTween('jump');

        const startPos = this.node.position.clone();
        const peakPos = startPos.clone();
        peakPos.y += height;

        const jumpTween = tween(this.node)
            .to(duration * 0.4, { position: peakPos }, {
                easing: 'quadOut'
            })
            .to(duration * 0.6, { position: startPos }, {
                easing: 'bounceOut'
            })
            .call(() => {
                this.tweens.delete('jump');
                this.state = 'idle';
            })
            .start();

        this.tweens.set('jump', jumpTween);
        this.state = 'jumping';
    }

    /**
     * 说话动画（替代bark）
     */
    public say(text: string, duration: number = 2) {
        this.stopTween('say');

        // 缩放弹跳效果
        const sayTween = tween(this.card)
            .to(0.1, { scale: new Vec3(1.1, 1.2, 1) }, {
                easing: 'backOut'
            })
            .to(0.2, { scale: Vec3.ONE }, {
                easing: 'elasticOut'
            })
            .call(() => {
                this.tweens.delete('say');
            })
            .start();

        this.tweens.set('say', sayTween);
        this.state = 'talking';

        // 显示文字气泡
        if (text) {
            this.showTextBubble(text, duration);
        }
    }

    /**
     * 移动到目标位置
     */
    public moveTo(target: Vec3, duration: number) {
        this.stopTween('move');

        // 开始移动动画
        this.state = 'moving';
        this.playFrameAnimation('walk');

        const moveTween = tween(this.node)
            .to(duration, { position: target }, {
                easing: 'linear',
                onUpdate: () => {
                    // 可以在这里添加脚步声等效果
                }
            })
            .call(() => {
                this.state = 'idle';
                this.playFrameAnimation('idle');
                this.tweens.delete('move');
            })
            .start();

        this.tweens.set('move', moveTween);
    }

    /**
     * 建筑升级动画
     */
    public upgrade(newLevel: number) {
        this.stopTween('upgrade');

        // 缩小 -> 旋转 -> 放大
        const upgradeTween = tween(this.card)
            .to(0.3, { scale: new Vec3(0.8, 0.8, 0.8) }, {
                easing: 'quadIn'
            })
            .call(() => {
                // 切换到新等级纹理
                this.level = newLevel;
                this.loadTexture();
            })
            .to(0.5, {
                scale: new Vec3(1.2, 1.2, 1.2),
                eulerAngles: new Vec3(0, 360, 0)
            }, {
                easing: 'backOut'
            })
            .to(0.2, { scale: Vec3.ONE }, {
                easing: 'quadOut'
            })
            .call(() => {
                this.tweens.delete('upgrade');
            })
            .start();

        this.tweens.set('upgrade', upgradeTween);
    }

    /**
     * 震动效果
     */
    public shake(intensity: number = 0.1, duration: number = 0.3) {
        this.stopTween('shake');

        const originalPos = this.node.position.clone();
        const shakeCount = Math.floor(duration / 0.05);
        let shakeTween = tween(this.node);

        for (let i = 0; i < shakeCount; i++) {
            const offsetX = (Math.random() - 0.5) * intensity * 2;
            const offsetZ = (Math.random() - 0.5) * intensity * 2;
            const shakePos = originalPos.clone();
            shakePos.x += offsetX;
            shakePos.z += offsetZ;

            shakeTween = shakeTween.to(0.05, { position: shakePos });
        }

        shakeTween
            .to(0.05, { position: originalPos })
            .call(() => {
                this.tweens.delete('shake');
            })
            .start();

        this.tweens.set('shake', shakeTween);
    }

    /**
     * 消失动画
     */
    public disappear() {
        this.stopAllTweens();

        tween(this.card)
            .to(0.3, {
                scale: new Vec3(1.2, 0, 1.2),  // 压扁
                eulerAngles: new Vec3(0, 720, 0)  // 旋转两圈
            }, {
                easing: 'quadIn'
            })
            .call(() => {
                this.node.destroy();
            })
            .start();
    }

    /**
     * 漂浮动画（用于道具等）
     */
    public float(amplitude: number = 0.2, period: number = 2) {
        this.stopTween('float');

        const startY = this.node.position.y;

        const floatTween = tween(this.node)
            .repeatForever(
                tween()
                    .to(period / 2, { position: new Vec3(
                        this.node.position.x,
                        startY + amplitude,
                        this.node.position.z
                    )}, { easing: 'sineInOut' })
                    .to(period / 2, { position: new Vec3(
                        this.node.position.x,
                        startY,
                        this.node.position.z
                    )}, { easing: 'sineInOut' })
            )
            .start();

        this.tweens.set('float', floatTween);
    }

    // ===== 帧动画系统 =====

    /**
     * 播放帧动画
     */
    public playFrameAnimation(animName: string) {
        // 根据动画名设置帧范围
        switch(animName) {
            case 'idle':
                this.frameRange = [0, Math.min(1, this.frames.length - 1)];
                break;
            case 'walk':
                this.frameRange = [2, Math.min(5, this.frames.length - 1)];
                break;
            case 'jump':
                this.frameRange = [6, Math.min(7, this.frames.length - 1)];
                break;
            default:
                this.frameRange = [0, 0];
        }

        this.currentFrame = this.frameRange[0];
        this.frameTimer = 0;
        this.isPlayingAnimation = true;

        // 设置第一帧
        this.setFrame(this.currentFrame);
    }

    /**
     * 停止帧动画
     */
    public stopFrameAnimation() {
        this.isPlayingAnimation = false;
    }

    /**
     * 更新帧动画
     */
    private updateFrameAnimation(dt: number) {
        if (this.frames.length === 0) return;

        this.frameTimer += dt;
        const frameDuration = 1.0 / this.frameRate;

        if (this.frameTimer >= frameDuration) {
            this.frameTimer -= frameDuration;

            // 切换到下一帧
            this.currentFrame++;
            if (this.currentFrame > this.frameRange[1]) {
                this.currentFrame = this.frameRange[0];
            }

            this.setFrame(this.currentFrame);
        }
    }

    // ===== UI相关 =====

    /**
     * 显示文字气泡
     */
    private showTextBubble(text: string, duration: number) {
        // TODO: 实现文字气泡UI
        // 这里可以创建一个UI节点显示文字
        console.log(`[${this.actorId}]: ${text}`);

        // 自动隐藏
        this.scheduleOnce(() => {
            this.hideTextBubble();
        }, duration);
    }

    /**
     * 隐藏文字气泡
     */
    private hideTextBubble() {
        if (this.textBubble) {
            this.textBubble.active = false;
        }
    }

    // ===== 工具方法 =====

    /**
     * 停止指定动画
     */
    private stopTween(name: string) {
        const tween = this.tweens.get(name);
        if (tween) {
            tween.stop();
            this.tweens.delete(name);
        }
    }

    /**
     * 停止所有动画
     */
    private stopAllTweens() {
        this.tweens.forEach(tween => tween.stop());
        this.tweens.clear();
    }

    /**
     * 设置Actor类型和ID
     */
    public setActorInfo(actorId: string, type: ActorType, level: number = 1) {
        this.actorId = actorId;
        this.actorType = type;
        this.level = level;
    }

    /**
     * 设置方向（0-3），对应Y轴旋转 0°, 90°, 180°, 270°
     */
    public setDirection(direction: number): void {
        this.direction = Math.floor(direction) % 4;
        if (this.direction < 0) this.direction += 4;

        // 如果是建筑且Billboard关闭，立即应用旋转
        if (this.actorType === ActorType.BUILDING && this.billboardMode === 'off') {
            this.applyDirection();
        }
    }

    /**
     * 应用方向旋转
     */
    private applyDirection(): void {
        const rotationY = this.direction * 90;
        const euler = this.node.eulerAngles;
        this.node.setRotationFromEuler(euler.x, rotationY, euler.z);
    }

    /**
     * 加载方向指示箭头（仅建筑类型使用）
     */
    private async loadArrowIndicator(): Promise<void> {
        if (this.actorType !== ActorType.BUILDING) return;

        return new Promise<void>((resolve) => {
            resources.load('prefabs/arrow', Prefab, (err, prefab) => {
                if (err) {
                    console.warn('[PaperActor] Failed to load arrow prefab:', err);
                    resolve();
                    return;
                }

                // 实例化箭头
                this.arrowNode = instantiate(prefab);
                this.arrowNode.parent = this.node;

                // 设置位置（作为子节点，位置为0）
                this.arrowNode.setPosition(0, 0, 0);

                // 缩放调整（箭头稍微小一点）
                this.arrowNode.setScale(0.4, 0.4, 0.4);

                // console.log(`[PaperActor] Arrow indicator loaded for building ${this.actorId}`);
                resolve();
            });
        });
    }

    /**
     * 获取当前状态
     */
    public getState(): string {
        return this.state;
    }

    // ===== 逻辑对象关联 =====

    /**
     * 设置关联的逻辑对象（Player/NPC 等）
     */
    public setRole(role: Role | null): void {
        this.role = role;
    }

    /**
     * 获取关联的逻辑对象
     * 使用泛型支持类型转换
     */
    public getRole<T extends Role>(): T | null {
        return this.role as T;
    }

    /**
     * 检查是否有关联的逻辑对象
     */
    public hasRole(): boolean {
        return this.role !== null;
    }
}