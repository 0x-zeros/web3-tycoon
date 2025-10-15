/**
 * Actor组件 - 角色表现层
 * 
 * 负责所有Cocos Creator相关的渲染、动画、特效等表现层功能
 * 数据与表现分离，所有Cocos API都封装在这里
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component, Node, Vec3, Animation, Prefab, resources, instantiate, Tween, tween, ParticleSystem, AudioSource, MeshRenderer, Material, Color, Label, Sprite } from 'cc';
import { Role } from './Role';
import { RoleMoveParams } from './RoleTypes';
import { GameBuilding } from '../game/models';

const { ccclass, property } = _decorator;

/**
 * 动画配置接口
 */
interface AnimationConfig {
    /** 动画名称 */
    name: string;
    /** 动画长度 */
    duration: number;
    /** 是否循环 */
    loop: boolean;
    /** 播放速度 */
    speed: number;
}

/**
 * 移动动画配置接口
 */
interface MoveAnimationConfig {
    /** 移动类型 */
    type: 'linear' | 'smooth' | 'bounce' | 'teleport';
    /** 动画时长 */
    duration: number;
    /** 高度偏移（跳跃效果） */
    heightOffset: number;
    /** 缓动函数 */
    easing: string;
}

/**
 * 特效配置接口
 */
interface EffectConfig {
    /** 特效名称 */
    name: string;
    /** 预制件路径 */
    prefabPath: string;
    /** 播放时长 */
    duration: number;
    /** 是否跟随角色 */
    followTarget: boolean;
    /** 位置偏移 */
    offset: Vec3;
}

/**
 * Actor组件
 * 角色的表现层组件，处理所有视觉相关功能
 */
@ccclass('Actor')
export class Actor extends Component {
    
    // ========================= 编辑器属性 =========================
    
    @property({ displayName: "模型根节点", type: Node, tooltip: "用于放置3D模型或2D精灵的根节点" })
    public modelRoot: Node | null = null;
    
    @property({ displayName: "特效根节点", type: Node, tooltip: "用于播放各种特效的根节点" })
    public effectRoot: Node | null = null;
    
    @property({ displayName: "UI根节点", type: Node, tooltip: "用于显示血条、名称等UI元素的根节点" })
    public uiRoot: Node | null = null;
    
    @property({ displayName: "移动速度", tooltip: "移动动画的基础速度" })
    public moveSpeed: number = 3.0;
    
    @property({ displayName: "启用阴影", tooltip: "是否启用角色阴影效果" })
    public enableShadow: boolean = false;
    
    @property({ displayName: "启用音效", tooltip: "是否播放角色相关音效" })
    public enableAudio: boolean = false;
    
    // ========================= 组件引用 =========================
    
    /** 动画组件 */
    private m_animator: Animation | null = null;
    
    /** 网格渲染器 */
    private m_meshRenderer: MeshRenderer | null = null;
    
    /** 音频源 */
    private m_audioSource: AudioSource | null = null;
    
    /** 名称标签 */
    private m_nameLabel: Label | null = null;
    
    // ========================= 私有属性 =========================
    
    /** 绑定的角色 */
    private m_role: Role | null = null;
    
    /** 当前模型节点 */
    private m_currentModel: Node | null = null;
    
    /** 当前播放的特效列表 */
    private m_activeEffects: Map<string, Node> = new Map();
    
    /** 移动动画配置 */
    private m_moveConfig: MoveAnimationConfig = {
        type: 'smooth',
        duration: 1.0,
        heightOffset: 0.5,
        easing: 'sineInOut'
    };
    
    /** 动画配置映射 */
    private m_animationConfigs: Map<string, AnimationConfig> = new Map();
    
    /** 当前移动Tween */
    private m_moveTween: Tween<Node> | null = null;
    
    /** 是否正在移动 */
    private m_isMoving: boolean = false;

    // ========================= 建筑相关属性（新增）=========================

    /** 建筑 Prefab 节点 */
    private m_buildingPrefab: Node | null = null;

    /** 建筑配置（GameBuilding引用） */
    private m_buildingConfig: any = null;  // GameBuilding 类型

    // ========================= 生命周期方法 =========================
    
    protected onLoad(): void {
        this.initializeComponents();
        this.setupAnimationConfigs();
    }
    
    protected start(): void {
        this.updateDisplay();
    }
    
    protected onDestroy(): void {
        this.cleanup();
    }
    
    // ========================= 初始化方法 =========================
    
    /**
     * 初始化组件
     */
    private initializeComponents(): void {
        // 创建根节点（如果不存在）
        if (!this.modelRoot) {
            this.modelRoot = new Node('ModelRoot');
            this.modelRoot.parent = this.node;
        }
        
        if (!this.effectRoot) {
            this.effectRoot = new Node('EffectRoot');
            this.effectRoot.parent = this.node;
        }
        
        if (!this.uiRoot) {
            this.uiRoot = new Node('UIRoot');
            this.uiRoot.parent = this.node;
        }
        
        // 获取组件引用
        this.m_animator = this.getComponentInChildren(Animation);
        this.m_meshRenderer = this.getComponentInChildren(MeshRenderer);
        this.m_audioSource = this.getComponent(AudioSource);
        
        // 创建音频源（如果需要）
        if (this.enableAudio && !this.m_audioSource) {
            this.m_audioSource = this.node.addComponent(AudioSource);
        }
        
        console.log('[Actor] 组件初始化完成');
    }
    
    /**
     * 设置动画配置
     */
    private setupAnimationConfigs(): void {
        // 默认动画配置
        this.m_animationConfigs.set('idle', {
            name: 'idle',
            duration: 2.0,
            loop: true,
            speed: 1.0
        });
        
        this.m_animationConfigs.set('move', {
            name: 'move',
            duration: 1.0,
            loop: true,
            speed: 1.0
        });
        
        this.m_animationConfigs.set('jump', {
            name: 'jump',
            duration: 0.5,
            loop: false,
            speed: 1.0
        });
        
        this.m_animationConfigs.set('celebrate', {
            name: 'celebrate',
            duration: 2.0,
            loop: false,
            speed: 1.0
        });
        
        this.m_animationConfigs.set('defeat', {
            name: 'defeat',
            duration: 1.5,
            loop: false,
            speed: 1.0
        });
    }
    
    // ========================= 角色绑定 =========================
    
    /**
     * 绑定角色
     */
    public bindRole(role: Role): void {
        if (this.m_role) {
            this.unbindRole();
        }
        
        this.m_role = role;
        
        // 监听角色事件
        if (this.m_role) {
            this.m_role.on('state-changed', this.onRoleStateChanged, this);
            this.m_role.on('attribute-changed', this.onRoleAttributeChanged, this);
            this.m_role.on('tile-changed', this.onRoleTileChanged, this);
        }
        
        // 加载角色模型
        this.loadRoleModel();
        
        // 更新显示
        this.updateDisplay();
        
        console.log(`[Actor] 绑定角色: ${role?.getName()}`);
    }
    
    /**
     * 解绑角色
     */
    public unbindRole(): void {
        if (this.m_role) {
            this.m_role.off('state-changed', this.onRoleStateChanged, this);
            this.m_role.off('attribute-changed', this.onRoleAttributeChanged, this);
            this.m_role.off('tile-changed', this.onRoleTileChanged, this);
            this.m_role = null;
        }
        
        console.log('[Actor] 角色解绑');
    }
    
    // ========================= 模型管理 =========================
    
    /**
     * 加载角色模型
     */
    private async loadRoleModel(): Promise<void> {
        if (!this.m_role || !this.modelRoot) {
            return;
        }
        
        try {
            // 构建模型路径
            const modelPath = this.getModelPath(this.m_role.getTypeId());
            
            // 加载预制件
            const prefab = await this.loadPrefabAsync(modelPath);
            
            if (prefab) {
                // 清除旧模型
                if (this.m_currentModel && this.m_currentModel.isValid) {
                    this.m_currentModel.destroy();
                }
                
                // 实例化新模型
                this.m_currentModel = instantiate(prefab);
                this.m_currentModel.parent = this.modelRoot;
                this.m_currentModel.setPosition(Vec3.ZERO);
                
                // 获取动画组件
                this.m_animator = this.m_currentModel.getComponent(Animation) || 
                                this.m_currentModel.getComponentInChildren(Animation);
                
                // 获取网格渲染器
                this.m_meshRenderer = this.m_currentModel.getComponent(MeshRenderer) || 
                                    this.m_currentModel.getComponentInChildren(MeshRenderer);
                
                // 播放默认动画
                this.playAnimation('idle');
                
                console.log(`[Actor] 模型加载完成: ${modelPath}`);
            }
            
        } catch (error) {
            console.error(`[Actor] 模型加载失败: ${error}`);
        }
    }
    
    /**
     * 获取模型路径
     */
    private getModelPath(typeId: number): string {
        // 根据类型ID构建模型路径
        // 这里可以从配置文件读取
        return `models/role/type_${typeId}`;
    }
    
    /**
     * 异步加载预制件
     */
    private loadPrefabAsync(path: string): Promise<Prefab | null> {
        return new Promise((resolve) => {
            resources.load(path, Prefab, (err, prefab) => {
                if (err) {
                    console.error(`[Actor] 预制件加载失败: ${path}`, err);
                    resolve(null);
                } else {
                    resolve(prefab);
                }
            });
        });
    }
    
    // ========================= 位置管理 =========================
    
    /**
     * 更新位置
     */
    public updatePosition(worldPos: Vec3): void {
        this.node.setWorldPosition(worldPos);
    }
    
    /**
     * 移动到指定地块
     */
    public async moveToTile(params: RoleMoveParams): Promise<void> {
        if (this.m_isMoving) {
            console.warn('[Actor] 正在移动中，忽略新的移动请求');
            return;
        }

        this.m_isMoving = true;

        try {
            // 播放移动动画
            this.playAnimation('move');

            // 使用传入的目标位置（Tile 顶部中心点）
            const targetPos = params.targetPosition;

            if (targetPos) {
                // 执行移动动画
                await this.executeMove(targetPos, params);
            }

            // 播放到达动画
            this.playAnimation('idle');

        } finally {
            this.m_isMoving = false;
        }
    }
    
    /**
     * 执行移动动画
     */
    private executeMove(targetPos: Vec3, params: RoleMoveParams): Promise<void> {
        return new Promise((resolve) => {
            const duration = params.duration || this.m_moveConfig.duration;
            
            // 停止当前移动
            if (this.m_moveTween) {
                this.m_moveTween.stop();
            }
            
            switch (this.m_moveConfig.type) {
                case 'teleport':
                    // 瞬间移动
                    this.node.setWorldPosition(targetPos);
                    resolve();
                    break;
                    
                case 'bounce':
                    // 跳跃移动
                    this.executeBounceMove(targetPos, duration, resolve);
                    break;
                    
                default:
                    // 线性或平滑移动
                    this.m_moveTween = tween(this.node)
                        .to(duration, { worldPosition: targetPos }, {
                            easing: this.m_moveConfig.easing as any
                        })
                        .call(() => resolve())
                        .start();
                    break;
            }
        });
    }
    
    /**
     * 执行跳跃移动
     */
    private executeBounceMove(targetPos: Vec3, duration: number, callback: () => void): void {
        const startPos = this.node.worldPosition.clone();
        const midPos = startPos.clone().add(targetPos).multiplyScalar(0.5);
        midPos.y += this.m_moveConfig.heightOffset;
        
        // 两段式移动：起点->中点->终点
        this.m_moveTween = tween(this.node)
            .to(duration * 0.5, { worldPosition: midPos })
            .to(duration * 0.5, { worldPosition: targetPos })
            .call(() => callback())
            .start();
    }
    
    // ========================= 动画管理 =========================
    
    /**
     * 播放动画
     */
    public playAnimation(animName: string, loop?: boolean): void {
        if (!this.m_animator) {
            console.warn(`[Actor] 动画组件不存在，无法播放动画: ${animName}`);
            return;
        }
        
        const animState = this.m_animator.getState(animName);
        if (!animState) {
            console.warn(`[Actor] 动画不存在: ${animName}`);
            return;
        }
        
        const config = this.m_animationConfigs.get(animName);
        if (config) {
            animState.speed = config.speed;
            animState.wrapMode = (loop !== undefined ? loop : config.loop) ? 
                Animation.WrapMode.Loop : Animation.WrapMode.Normal;
        }
        
        this.m_animator.play(animName);
        
        console.log(`[Actor] 播放动画: ${animName}`);
    }
    
    /**
     * 停止动画
     */
    public stopAnimation(animName?: string): void {
        if (!this.m_animator) return;
        
        if (animName) {
            this.m_animator.stop(animName);
        } else {
            this.m_animator.stop();
        }
    }
    
    /**
     * 添加动画配置
     */
    public addAnimationConfig(name: string, config: AnimationConfig): void {
        this.m_animationConfigs.set(name, config);
    }
    
    // ========================= 特效管理 =========================
    
    /**
     * 播放特效
     */
    public async playEffect(effectName: string, duration?: number): Promise<void> {
        if (!this.effectRoot) {
            console.warn('[Actor] 特效根节点不存在');
            return;
        }
        
        try {
            // 加载特效预制件
            const effectPath = `effects/${effectName}`;
            const prefab = await this.loadPrefabAsync(effectPath);
            
            if (prefab) {
                const effectNode = instantiate(prefab);
                effectNode.parent = this.effectRoot;
                
                // 保存到活跃特效列表
                this.m_activeEffects.set(effectName, effectNode);
                
                // 获取粒子系统
                const particleSystem = effectNode.getComponent(ParticleSystem);
                if (particleSystem) {
                    particleSystem.play();
                }
                
                // 设置自动销毁
                const effectDuration = duration || 2.0;
                this.scheduleOnce(() => {
                    this.stopEffect(effectName);
                }, effectDuration);
                
                console.log(`[Actor] 播放特效: ${effectName}`);
            }
            
        } catch (error) {
            console.error(`[Actor] 特效播放失败: ${effectName}`, error);
        }
    }
    
    /**
     * 停止特效
     */
    public stopEffect(effectName: string): void {
        const effectNode = this.m_activeEffects.get(effectName);
        if (effectNode && effectNode.isValid) {
            effectNode.destroy();
            this.m_activeEffects.delete(effectName);
            console.log(`[Actor] 停止特效: ${effectName}`);
        }
    }
    
    /**
     * 停止所有特效
     */
    public stopAllEffects(): void {
        for (const [name, node] of this.m_activeEffects) {
            if (node && node.isValid) {
                node.destroy();
            }
        }
        this.m_activeEffects.clear();
        console.log('[Actor] 停止所有特效');
    }
    
    // ========================= 材质和颜色 =========================
    
    /**
     * 设置材质颜色
     */
    public setMaterialColor(color: Color): void {
        if (this.m_meshRenderer && this.m_meshRenderer.material) {
            this.m_meshRenderer.material.setProperty('albedo', color);
        }
    }
    
    /**
     * 设置透明度
     */
    public setOpacity(opacity: number): void {
        if (this.m_meshRenderer && this.m_meshRenderer.material) {
            const color = this.m_meshRenderer.material.getProperty('albedo') as Color;
            color.a = Math.max(0, Math.min(1, opacity));
            this.m_meshRenderer.material.setProperty('albedo', color);
        }
    }
    
    // ========================= 音效管理 =========================
    
    /**
     * 播放音效
     */
    public playAudio(audioName: string): void {
        if (!this.enableAudio || !this.m_audioSource) {
            return;
        }
        
        // 加载并播放音频
        const audioPath = `audio/${audioName}`;
        resources.load(audioPath, (err, audioClip) => {
            if (err) {
                console.error(`[Actor] 音频加载失败: ${audioPath}`, err);
                return;
            }
            
            this.m_audioSource!.clip = audioClip;
            this.m_audioSource!.play();
        });
    }
    
    // ========================= UI显示 =========================
    
    /**
     * 更新显示
     */
    public updateDisplay(): void {
        if (!this.m_role) return;
        
        // 更新名称显示
        this.updateNameDisplay();
        
        // 更新其他UI元素
        this.updateUIElements();
    }
    
    /**
     * 更新名称显示
     */
    private updateNameDisplay(): void {
        if (!this.uiRoot || !this.m_role) return;
        
        if (!this.m_nameLabel) {
            // 创建名称标签
            const nameNode = new Node('NameLabel');
            nameNode.parent = this.uiRoot;
            nameNode.setPosition(0, 2, 0); // 头顶位置
            this.m_nameLabel = nameNode.addComponent(Label);
        }
        
        this.m_nameLabel.string = this.m_role.getName();
    }
    
    /**
     * 更新UI元素
     */
    private updateUIElements(): void {
        // 根据角色状态更新UI
        // 例如：血条、状态图标等
    }
    
    // ========================= 事件处理 =========================
    
    /**
     * 角色状态变化处理
     */
    private onRoleStateChanged(event: any): void {
        const { oldState, newState } = event;
        
        // 根据状态播放相应动画
        switch (newState) {
            case 'idle':
                this.playAnimation('idle');
                break;
            case 'moving':
                this.playAnimation('move');
                break;
            case 'jailed':
                this.playAnimation('defeat');
                this.playEffect('jail', 3.0);
                break;
            case 'winner':
                this.playAnimation('celebrate');
                this.playEffect('victory', 5.0);
                break;
        }
        
        console.log(`[Actor] 角色状态变化: ${oldState} -> ${newState}`);
    }
    
    /**
     * 角色属性变化处理
     */
    private onRoleAttributeChanged(event: any): void {
        const { attribute, oldValue, newValue } = event;
        
        // 根据属性变化播放特效
        if (attribute === 0 && newValue > oldValue) { // 金钱增加
            this.playEffect('money_gain', 2.0);
        } else if (attribute === 1 && newValue < oldValue) { // 生命值减少
            this.playEffect('damage', 1.0);
        }
        
        // 更新UI显示
        this.updateDisplay();
    }
    
    /**
     * 角色位置变化处理
     */
    private onRoleTileChanged(event: any): void {
        const { oldTileId, newTileId } = event;
        console.log(`[Actor] 角色位置变化: ${oldTileId} -> ${newTileId}`);
    }
    
    // ========================= 清理方法 =========================
    
    /**
     * 清理资源
     */
    private cleanup(): void {
        // 停止所有动画
        this.stopAnimation();

        // 停止移动
        if (this.m_moveTween) {
            this.m_moveTween.stop();
            this.m_moveTween = null;
        }

        // 停止所有特效
        this.stopAllEffects();

        // 解绑角色
        this.unbindRole();

        // 清理模型
        if (this.m_currentModel && this.m_currentModel.isValid) {
            this.m_currentModel.destroy();
            this.m_currentModel = null;
        }

        // 清理建筑 prefab
        if (this.m_buildingPrefab) {
            this.m_buildingPrefab.destroy();
            this.m_buildingPrefab = null;
        }

        console.log('[Actor] 清理完成');
    }

    // ========================= 建筑Prefab渲染方法（新增）=========================

    /**
     * 创建建筑 Actor（静态工厂方法）
     * @param gameBuilding GameBuilding 实例
     * @returns Actor 节点
     */
    public static createBuildingActor(gameBuilding: GameBuilding): Node | null {
        // 创建节点
        const node = new Node('BuildingActor');
        const actor = node.addComponent(Actor);

        // 保存配置
        actor.m_buildingConfig = gameBuilding;

        // 设置位置（Y=1.0，在block顶部）
        const position = gameBuilding.getActorPosition();
        node.setWorldPosition(position);

        // 异步加载 prefab
        actor.loadBuildingPrefab();

        console.log(`[Actor] Building Actor 创建: buildingId=${gameBuilding.buildingId}, owner=${gameBuilding.owner}, originalOwner=${gameBuilding.originalOwner}, level=${gameBuilding.level}`);

        return node;
    }

    /**
     * 加载建筑 Prefab
     */
    private async loadBuildingPrefab(): Promise<void> {
        if (!this.m_buildingConfig) return;

        // 如果不应显示（无主且无originalOwner），销毁并跳过加载
        if (this.m_buildingConfig.shouldShowPrefab && !this.m_buildingConfig.shouldShowPrefab()) {
            if (this.m_buildingPrefab) {
                this.m_buildingPrefab.destroy();
                this.m_buildingPrefab = null;
            }
            return;
        }

        const prefabPath = this.m_buildingConfig.getPrefabPath();
        if (!prefabPath) return;

        return new Promise((resolve) => {
            resources.load(prefabPath, Prefab, (err, prefab) => {
                if (err) {
                    console.warn(`[Actor] Building prefab 加载失败: ${prefabPath}`, err);
                    resolve();
                    return;
                }

                // 移除旧 prefab
                if (this.m_buildingPrefab) {
                    this.m_buildingPrefab.destroy();
                }

                // 实例化 prefab
                this.m_buildingPrefab = instantiate(prefab);
                this.m_buildingPrefab.parent = this.modelRoot || this.node;
                this.m_buildingPrefab.name = 'Prefab';
                this.m_buildingPrefab.setPosition(0, 0, 0);

                // 应用 scale 和 color
                const scale = this.m_buildingConfig.getLevelScale();
                const colorFactor = this.m_buildingConfig.getLevelColorFactor();

                this.m_buildingPrefab.setScale(scale, scale, scale);
                this.applyColorFactor(this.m_buildingPrefab, colorFactor);

                console.log(`[Actor] Building prefab 加载完成: ${prefabPath}, scale=${scale}, colorFactor=${colorFactor}`);
                resolve();
            });
        });
    }

    /**
     * 更新建筑渲染（owner/level 变化时调用）
     * @param gameBuilding 新的 GameBuilding 数据
     */
    public updateBuildingRender(gameBuilding: any): void {
        const oldPrefabPath = this.m_buildingConfig?.getPrefabPath();
        this.m_buildingConfig = gameBuilding;

        // 检查 prefab 路径是否变化（owner/originalOwner 变化会导致路径变化）
        const newPrefabPath = gameBuilding.getPrefabPath();

        // 若新路径为空，表示无需显示，确保销毁现有prefab
        if (!newPrefabPath) {
            if (this.m_buildingPrefab) {
                this.m_buildingPrefab.destroy();
                this.m_buildingPrefab = null;
            }
            return;
        }

        if (newPrefabPath !== oldPrefabPath) {
            // 路径变化，重新加载 prefab
            this.loadBuildingPrefab();
        } else if (this.m_buildingPrefab) {
            // 路径未变，只更新 scale 和 color
            const scale = gameBuilding.getLevelScale();
            const colorFactor = gameBuilding.getLevelColorFactor();

            // 平滑过渡 scale
            tween(this.m_buildingPrefab)
                .to(0.3, { scale: new Vec3(scale, scale, scale) }, {
                    easing: 'backOut'
                })
                .start();

            // 更新颜色
            this.applyColorFactor(this.m_buildingPrefab, colorFactor);

            console.log(`[Actor] Building render 更新: scale=${scale}, colorFactor=${colorFactor}`);
        }
    }

    /**
     * 应用颜色因子到节点树（调整亮度，保持色系）
     * @param node 目标节点
     * @param factor 亮度因子（0.8-1.2）
     */
    private applyColorFactor(node: Node, factor: number): void {
        node.walk((n) => {
            // // 处理 Sprite 组件
            // const sprite = n.getComponent(Sprite);
            // if (sprite) {
            //     const color = sprite.color.clone();
            //     color.r = Math.min(255, Math.floor(color.r * factor));
            //     color.g = Math.min(255, Math.floor(color.g * factor));
            //     color.b = Math.min(255, Math.floor(color.b * factor));
            //     sprite.color = color;
            // }

            // 处理 MeshRenderer 组件
            const meshRenderer = n.getComponent(MeshRenderer);
            if (meshRenderer && meshRenderer.material) {
                const albedo = meshRenderer.material.getProperty('albedo') as Color;
                if (albedo) {
                    albedo.r = Math.min(255, Math.floor(albedo.r * factor));
                    albedo.g = Math.min(255, Math.floor(albedo.g * factor));
                    albedo.b = Math.min(255, Math.floor(albedo.b * factor));
                    meshRenderer.material.setProperty('albedo', albedo);
                }
            }
        });
    }
    
    // ========================= 调试方法 =========================
    
    /**
     * 调试信息
     */
    public debugInfo(): string {
        const info = [
            `绑定角色: ${this.m_role?.getName() || '无'}`,
            `移动状态: ${this.m_isMoving ? '移动中' : '静止'}`,
            `活跃特效: ${this.m_activeEffects.size}`,
            `动画组件: ${this.m_animator ? '存在' : '无'}`,
            `音频组件: ${this.m_audioSource ? '存在' : '无'}`
        ];
        
        return `[Actor] ${info.join(', ')}`;
    }
}
