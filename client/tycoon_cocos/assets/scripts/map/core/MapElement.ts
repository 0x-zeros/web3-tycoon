/**
 * 地图元素基类
 * 
 * 所有地图元素（地块和物体）的基类
 * 提供通用的初始化、渲染、碰撞检测和数据管理功能
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component, Node, Vec2, Vec3, BoxCollider } from 'cc';
import { VoxelSystem } from '../../voxel/VoxelSystem';

const { ccclass, property } = _decorator;

/**
 * 地图元素基类
 */
@ccclass('MapElement')
export abstract class MapElement extends Component {
    /** 方块ID (如 "web3:property") */
    protected _blockId: string = '';
    
    /** 类型ID (Web3TileType 或 Web3ObjectType) */
    protected _typeId: number = 0;
    
    /** 网格坐标 (x, z) */
    protected _gridPosition: Vec2 = new Vec2();
    
    /** 世界坐标 */
    protected _worldPosition: Vec3 = new Vec3();
    
    /** 渲染节点（可以是体素block或FBX模型） */
    protected _renderNode: Node | null = null;
    
    /** 碰撞器（用于点击检测） */
    protected _collider: BoxCollider | null = null;
    
    /** 体素系统引用 */
    protected _voxelSystem: VoxelSystem | null = null;
    
    /** 是否已初始化 */
    protected _initialized: boolean = false;
    
    /**
     * 初始化元素
     * @param blockId 方块ID
     * @param gridPos 网格坐标
     */
    public abstract initialize(blockId: string, gridPos: Vec2): Promise<void>;
    
    /**
     * 获取元素类型
     * @returns 'tile' 或 'object'
     */
    public abstract getElementType(): 'tile' | 'object';
    
    /**
     * 创建视觉表现
     */
    protected abstract createVisual(): Promise<void>;
    
    /**
     * 获取序列化数据
     */
    public abstract getData(): any;
    
    /**
     * 从数据恢复
     */
    public abstract loadData(data: any): Promise<void>;
    
    // ========================= 通用方法 =========================
    
    /**
     * 获取网格坐标
     */
    public getGridPosition(): Vec2 {
        return this._gridPosition.clone();
    }
    
    /**
     * 获取世界坐标
     */
    public getWorldPosition(): Vec3 {
        return this._worldPosition.clone();
    }
    
    /**
     * 获取方块ID
     */
    public getBlockId(): string {
        return this._blockId;
    }
    
    /**
     * 获取类型ID
     */
    public getTypeId(): number {
        return this._typeId;
    }
    
    /**
     * 是否已初始化
     */
    public isInitialized(): boolean {
        return this._initialized;
    }
    
    /**
     * 设置碰撞器
     * @param size 碰撞器尺寸
     * @param center 碰撞器中心偏移
     */
    protected setupCollider(size: Vec3 = new Vec3(1, 1, 1), center: Vec3 = new Vec3(0, 0.5, 0)): void {
        if (!this._collider) {
            this._collider = this.node.addComponent(BoxCollider);
        }
        this._collider.size = size;
        this._collider.center = center;
    }
    
    /**
     * 使用体素系统创建渲染节点
     * @param blockId 方块ID
     * @param position 世界坐标
     */
    protected async createVoxelRender(blockId: string, position: Vec3): Promise<void> {
        try {
            if (!this._voxelSystem) {
                this._voxelSystem = VoxelSystem.getInstance();
                if (!this._voxelSystem) {
                    this._voxelSystem = await VoxelSystem.quickInitialize();
                }
            }
            
            if (this._voxelSystem) {
                this._renderNode = await this._voxelSystem.createBlockNode(
                    this.node,
                    blockId,
                    position
                );
                
                if (this._renderNode) {
                    console.log(`[MapElement] Created voxel render for ${blockId} at ${position}`);
                } else {
                    console.warn(`[MapElement] Failed to create voxel render for ${blockId}`);
                }
            }
        } catch (error) {
            console.error(`[MapElement] Error creating voxel render:`, error);
        }
    }
    
    /**
     * 清理渲染节点
     */
    protected cleanupRenderNode(): void {
        if (this._renderNode && this._renderNode.isValid) {
            this._renderNode.destroy();
            this._renderNode = null;
        }
    }
    
    /**
     * 设置高亮状态
     * @param highlighted 是否高亮
     */
    public setHighlighted(highlighted: boolean): void {
        // 子类可以覆盖实现高亮效果
        if (this._renderNode) {
            // TODO: 实现高亮效果（修改材质、颜色等）
        }
    }
    
    /**
     * 设置选中状态
     * @param selected 是否选中
     */
    public setSelected(selected: boolean): void {
        // 子类可以覆盖实现选中效果
        if (this._renderNode) {
            // TODO: 实现选中效果
        }
    }
    
    /**
     * 播放动画（如果有）
     * @param animName 动画名称
     */
    public playAnimation(animName: string): void {
        // 子类可以覆盖实现动画播放
    }
    
    /**
     * 停止动画
     */
    public stopAnimation(): void {
        // 子类可以覆盖实现动画停止
    }
    
    /**
     * 更新元素状态
     * @param deltaTime 时间增量
     */
    protected update(deltaTime: number): void {
        // 子类可以覆盖实现更新逻辑
    }
    
    /**
     * 生命周期：组件启用时
     */
    protected onEnable(): void {
        // 子类可以覆盖
    }
    
    /**
     * 生命周期：组件禁用时
     */
    protected onDisable(): void {
        // 子类可以覆盖
    }
    
    /**
     * 生命周期：组件销毁时
     */
    protected onDestroy(): void {
        // 清理渲染节点
        this.cleanupRenderNode();
        
        // 清理碰撞器
        if (this._collider) {
            this._collider = null;
        }
        
        // 清理体素系统引用
        this._voxelSystem = null;
        
        this._initialized = false;
    }
    
    /**
     * 转换网格坐标到世界坐标
     * @param gridPos 网格坐标
     * @param y Y轴高度
     * @returns 世界坐标
     */
    protected gridToWorld(gridPos: Vec2, y: number = 0): Vec3 {
        return new Vec3(gridPos.x, y, gridPos.y);
    }
    
    /**
     * 转换世界坐标到网格坐标
     * @param worldPos 世界坐标
     * @returns 网格坐标
     */
    protected worldToGrid(worldPos: Vec3): Vec2 {
        return new Vec2(Math.floor(worldPos.x), Math.floor(worldPos.z));
    }
}