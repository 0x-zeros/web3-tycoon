/**
 * 物体组件
 * 
 * Web3ObjectType的包装器，负责管理物体的渲染和交互
 * 使用组件化架构，每个物体管理自己的节点和视觉表现
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Vec2, Vec3, Animation } from 'cc';
import { MapElement } from './MapElement';
import { Web3ObjectType, getWeb3BlockByBlockId } from '../../voxel/Web3BlockTypes';
import { ObjectData } from '../data/MapDataTypes';

const { ccclass } = _decorator;

/**
 * 物体组件
 * Web3ObjectType的包装器，支持体素渲染和FBX模型
 */
@ccclass('MapObject')
export class MapObject extends MapElement {
    
    // ========================= 物体特有属性 =========================
    
    /** 动画组件（用于FBX模型） */
    private _animation: Animation | null = null;
    
    /** 当前动画名称 */
    private _currentAnimation: string = '';
    
    /** 物体状态 */
    private _state: string = 'idle';
    
    /** 拥有者（如果是玩家放置的） */
    private _owner: string | null = null;
    
    /** 剩余回合数（如路障） */
    private _remainingTurns: number = -1;
    
    /** 是否使用FBX模型 */
    private _useFBXModel: boolean = false;
    
    /** FBX模型路径 */
    private _fbxModelPath: string = '';
    
    // ========================= 初始化 =========================
    
    /**
     * 初始化物体
     * @param blockId 方块ID (如 "web3:land_god")
     * @param gridPos 网格坐标
     */
    public async initialize(blockId: string, gridPos: Vec2): Promise<void> {
        // 设置基础属性
        this._blockId = blockId;
        this._gridPosition = gridPos;
        this._worldPosition = this.gridToWorld(gridPos, 1); // 物体在y=1层
        
        // 获取方块信息
        const blockInfo = getWeb3BlockByBlockId(blockId);
        if (!blockInfo) {
            console.error(`[MapObject] Unknown block ID: ${blockId}`);
            return;
        }
        
        // 设置类型ID
        this._typeId = blockInfo.typeId;
        
        // 设置节点位置
        this.node.setPosition(this._worldPosition);
        
        // 初始化物体特有属性
        this.initializeObjectProperties();
        
        // 创建视觉表现
        await this.createVisual();
        
        // 设置碰撞器（用于点击检测）
        this.setupCollider(new Vec3(1, 1, 1), new Vec3(0, 0.5, 0));
        
        this._initialized = true;
        console.log(`[MapObject] Initialized object ${blockId} at (${gridPos.x}, ${gridPos.y})`);
    }
    
    /**
     * 初始化物体特有属性
     */
    private initializeObjectProperties(): void {
        // 根据类型设置默认属性
        switch (this._typeId) {
            case Web3ObjectType.LAND_GOD:
            case Web3ObjectType.WEALTH_GOD:
            case Web3ObjectType.FORTUNE_GOD:
            case Web3ObjectType.POVERTY_GOD:
                // NPC类型，可能有动画
                this._state = 'idle';
                this._useFBXModel = false; // 暂时使用体素，以后可以改为true使用FBX
                break;
                
            case Web3ObjectType.DOG:
                // 宠物类型
                this._state = 'idle';
                this._useFBXModel = false;
                break;
                
            case Web3ObjectType.ROADBLOCK:
                // 路障类型，有持续回合数
                this._state = 'active';
                this._remainingTurns = 3; // 默认持续3回合
                break;
                
            case Web3ObjectType.BOMB:
                // 炸弹类型
                this._state = 'armed';
                this._remainingTurns = 1; // 触发后立即生效
                break;
        }
    }
    
    // ========================= 抽象方法实现 =========================
    
    /**
     * 获取元素类型
     */
    public getElementType(): 'tile' | 'object' {
        return 'object';
    }
    
    /**
     * 创建视觉表现
     */
    protected async createVisual(): Promise<void> {
        if (this._useFBXModel && this._fbxModelPath) {
            // 使用FBX模型
            await this.createFBXModel();
        } else {
            // 使用体素系统创建物体渲染
            await this.createVoxelRender(this._blockId, Vec3.ZERO);
        }
        
        // 如果有动画，初始化动画组件
        if (this._renderNode) {
            this._animation = this._renderNode.getComponent(Animation);
            if (this._animation && this._currentAnimation) {
                this.playAnimation(this._currentAnimation);
            }
        }
    }
    
    /**
     * 创建FBX模型
     */
    private async createFBXModel(): Promise<void> {
        // TODO: 实现FBX模型加载
        console.log(`[MapObject] Loading FBX model from ${this._fbxModelPath}`);
        // 这里需要实现FBX模型的加载逻辑
        // 1. 加载FBX资源
        // 2. 实例化模型
        // 3. 设置为renderNode
    }
    
    /**
     * 获取序列化数据
     */
    public getData(): ObjectData {
        const data: ObjectData = {
            blockId: this._blockId,
            typeId: this._typeId,
            position: {
                x: this._gridPosition.x,
                z: this._gridPosition.y
            }
        };
        
        // 添加物体特有数据
        if (this._currentAnimation || this._state !== 'idle' || this._owner || this._remainingTurns >= 0) {
            data.data = {
                animation: this._currentAnimation || undefined,
                state: this._state !== 'idle' ? this._state : undefined,
                owner: this._owner || undefined,
                remainingTurns: this._remainingTurns >= 0 ? this._remainingTurns : undefined
            };
        }
        
        return data;
    }
    
    /**
     * 从数据恢复
     */
    public async loadData(data: ObjectData): Promise<void> {
        // 初始化基础数据
        await this.initialize(
            data.blockId,
            new Vec2(data.position.x, data.position.z)
        );
        
        // 恢复物体特有数据
        if (data.data) {
            if (data.data.animation) {
                this._currentAnimation = data.data.animation;
                this.playAnimation(this._currentAnimation);
            }
            if (data.data.state) {
                this._state = data.data.state;
            }
            if (data.data.owner) {
                this._owner = data.data.owner;
            }
            if (data.data.remainingTurns !== undefined) {
                this._remainingTurns = data.data.remainingTurns;
            }
        }
    }
    
    // ========================= 物体特有方法 =========================
    
    /**
     * 获取物体状态
     */
    public getState(): string {
        return this._state;
    }
    
    /**
     * 设置物体状态
     */
    public setState(state: string): void {
        const oldState = this._state;
        this._state = state;
        console.log(`[MapObject] State changed from ${oldState} to ${state}`);
        
        // 根据状态变化播放动画
        this.onStateChanged(oldState, state);
    }
    
    /**
     * 状态变化处理
     */
    private onStateChanged(oldState: string, newState: string): void {
        // 根据新状态播放对应动画
        switch (newState) {
            case 'idle':
                this.playAnimation('idle');
                break;
            case 'active':
                this.playAnimation('active');
                break;
            case 'triggered':
                this.playAnimation('triggered');
                break;
            case 'destroyed':
                this.playAnimation('destroyed');
                // 播放销毁动画后移除
                this.scheduleOnce(() => {
                    this.destroyObject();
                }, 1);
                break;
        }
    }
    
    /**
     * 获取拥有者
     */
    public getOwner(): string | null {
        return this._owner;
    }
    
    /**
     * 设置拥有者
     */
    public setOwner(owner: string | null): void {
        this._owner = owner;
        console.log(`[MapObject] Set owner to ${owner}`);
    }
    
    /**
     * 获取剩余回合数
     */
    public getRemainingTurns(): number {
        return this._remainingTurns;
    }
    
    /**
     * 设置剩余回合数
     */
    public setRemainingTurns(turns: number): void {
        this._remainingTurns = turns;
        
        if (turns <= 0 && this.isTemporary()) {
            // 临时物体到期，触发销毁
            this.setState('destroyed');
        }
    }
    
    /**
     * 减少剩余回合数
     */
    public decrementTurns(): boolean {
        if (this._remainingTurns > 0) {
            this._remainingTurns--;
            console.log(`[MapObject] Remaining turns: ${this._remainingTurns}`);
            
            if (this._remainingTurns <= 0) {
                this.setState('destroyed');
                return false; // 物体已销毁
            }
        }
        return true; // 物体仍然存在
    }
    
    /**
     * 是否是临时物体
     */
    public isTemporary(): boolean {
        // 路障和炸弹是临时物体
        return this._typeId === Web3ObjectType.ROADBLOCK || 
               this._typeId === Web3ObjectType.BOMB;
    }
    
    /**
     * 是否是NPC
     */
    public isNPC(): boolean {
        return this._typeId >= Web3ObjectType.LAND_GOD && 
               this._typeId <= Web3ObjectType.POVERTY_GOD;
    }
    
    /**
     * 播放动画
     */
    public playAnimation(animName: string): void {
        if (this._animation) {
            this._currentAnimation = animName;
            
            // 检查动画是否存在
            const clip = this._animation.clips.find(c => c.name === animName);
            if (clip) {
                this._animation.play(animName);
                console.log(`[MapObject] Playing animation: ${animName}`);
            } else {
                console.warn(`[MapObject] Animation not found: ${animName}`);
            }
        }
    }
    
    /**
     * 停止动画
     */
    public stopAnimation(): void {
        if (this._animation) {
            this._animation.stop();
            this._currentAnimation = '';
            console.log(`[MapObject] Animation stopped`);
        }
    }
    
    /**
     * 玩家与物体交互
     */
    public onPlayerInteract(playerId: string): void {
        console.log(`[MapObject] Player ${playerId} interacts with object at (${this._gridPosition.x}, ${this._gridPosition.y})`);
        
        // 根据物体类型处理不同的交互逻辑
        switch (this._typeId) {
            case Web3ObjectType.LAND_GOD:
                this.handleLandGodInteraction(playerId);
                break;
            case Web3ObjectType.WEALTH_GOD:
                this.handleWealthGodInteraction(playerId);
                break;
            case Web3ObjectType.FORTUNE_GOD:
                this.handleFortuneGodInteraction(playerId);
                break;
            case Web3ObjectType.POVERTY_GOD:
                this.handlePovertyGodInteraction(playerId);
                break;
            case Web3ObjectType.DOG:
                this.handleDogInteraction(playerId);
                break;
            case Web3ObjectType.ROADBLOCK:
                this.handleRoadblockInteraction(playerId);
                break;
            case Web3ObjectType.BOMB:
                this.handleBombInteraction(playerId);
                break;
        }
    }
    
    /**
     * 处理土地神交互
     */
    private handleLandGodInteraction(playerId: string): void {
        console.log(`[MapObject] Land God grants property discount to ${playerId}`);
        this.playAnimation('blessing');
        // TODO: 触发土地神效果事件
    }
    
    /**
     * 处理财神交互
     */
    private handleWealthGodInteraction(playerId: string): void {
        console.log(`[MapObject] Wealth God grants money to ${playerId}`);
        this.playAnimation('blessing');
        // TODO: 触发财神效果事件
    }
    
    /**
     * 处理福神交互
     */
    private handleFortuneGodInteraction(playerId: string): void {
        console.log(`[MapObject] Fortune God grants luck to ${playerId}`);
        this.playAnimation('blessing');
        // TODO: 触发福神效果事件
    }
    
    /**
     * 处理穷神交互
     */
    private handlePovertyGodInteraction(playerId: string): void {
        console.log(`[MapObject] Poverty God curses ${playerId}`);
        this.playAnimation('curse');
        // TODO: 触发穷神效果事件
    }
    
    /**
     * 处理狗狗交互
     */
    private handleDogInteraction(playerId: string): void {
        console.log(`[MapObject] Dog barks at ${playerId}`);
        this.playAnimation('bark');
        // TODO: 触发狗狗效果事件
    }
    
    /**
     * 处理路障交互
     */
    private handleRoadblockInteraction(playerId: string): void {
        console.log(`[MapObject] Player ${playerId} is blocked by roadblock`);
        this.setState('triggered');
        // TODO: 触发路障效果事件
    }
    
    /**
     * 处理炸弹交互
     */
    private handleBombInteraction(playerId: string): void {
        console.log(`[MapObject] Bomb explodes on ${playerId}`);
        this.setState('triggered');
        this.playAnimation('explode');
        
        // 炸弹触发后立即销毁
        this.scheduleOnce(() => {
            this.setState('destroyed');
        }, 0.5);
        
        // TODO: 触发炸弹效果事件
    }
    
    /**
     * 获取物体信息（用于UI显示）
     */
    public getObjectInfo(): any {
        const info: any = {
            blockId: this._blockId,
            typeId: this._typeId,
            position: { x: this._gridPosition.x, z: this._gridPosition.y },
            typeName: this.getTypeName(),
            state: this._state
        };
        
        // 添加特定信息
        if (this._owner) {
            info.owner = this._owner;
        }
        if (this._remainingTurns >= 0) {
            info.remainingTurns = this._remainingTurns;
        }
        if (this.isNPC()) {
            info.isNPC = true;
        }
        if (this.isTemporary()) {
            info.isTemporary = true;
        }
        
        return info;
    }
    
    /**
     * 获取类型名称
     */
    private getTypeName(): string {
        switch (this._typeId) {
            case Web3ObjectType.LAND_GOD: return '土地神';
            case Web3ObjectType.WEALTH_GOD: return '财神';
            case Web3ObjectType.FORTUNE_GOD: return '福神';
            case Web3ObjectType.DOG: return '狗狗';
            case Web3ObjectType.POVERTY_GOD: return '穷神';
            case Web3ObjectType.ROADBLOCK: return '路障';
            case Web3ObjectType.BOMB: return '炸弹';
            default: return '未知';
        }
    }
    
    /**
     * 销毁物体
     */
    public destroyObject(): void {
        console.log(`[MapObject] Destroying object at (${this._gridPosition.x}, ${this._gridPosition.y})`);
        
        // 清理动画
        if (this._animation) {
            this._animation.stop();
            this._animation = null;
        }
        
        // 调用父类销毁方法
        super.onDestroy();
        
        // 销毁节点
        if (this.node && this.node.isValid) {
            this.node.destroy();
        }
    }
}