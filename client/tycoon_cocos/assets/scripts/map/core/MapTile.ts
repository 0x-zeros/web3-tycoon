/**
 * 地块基类
 * 
 * 所有地块类型的基础类，提供通用的地块行为和接口
 * 继承自Cocos Creator的Component，可以挂载到场景节点上
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component, Node, Vec3, Color, Material, MeshRenderer, BoxCollider, tween, Vec4, resources } from 'cc';
import { MapTileData, TileType, TileState, Position3D } from '../types/MapTypes';
import { PlayerData, GameEvent, GameEventType } from '../types/GameTypes';

const { ccclass, property } = _decorator;

/**
 * 地块交互结果接口
 * 定义玩家与地块交互后的结果
 */
export interface TileInteractionResult {
    /** 是否成功执行交互 */
    success: boolean;
    /** 结果消息 */
    message: string;
    /** 是否需要等待用户输入（如选择购买） */
    needUserInput?: boolean;
    /** 产生的游戏事件 */
    events?: GameEvent[];
    /** 金钱变动 */
    moneyChange?: number;
    /** 是否阻止玩家继续移动 */
    blockMovement?: boolean;
}

/**
 * 地块渲染配置接口
 * 用于配置地块的3D渲染表现
 */
export interface TileRenderState {
    /** 基础颜色 */
    baseColor: Color;
    /** 高亮颜色（选中或悬停时） */
    highlightColor: Color;
    /** 是否高亮显示 */
    isHighlighted: boolean;
    /** 是否被选中 */
    isSelected: boolean;
    /** 透明度 */
    opacity: number;
}

/**
 * 地块基类
 * 提供所有地块的通用功能和接口定义
 */
@ccclass('MapTile')
export abstract class MapTile extends Component {
    
    // ========================= 编辑器属性 =========================
    
    @property({ displayName: "地块名称", tooltip: "显示在UI中的地块名称" })
    public tileName: string = '';
    
    @property({ displayName: "地块描述", multiline: true, tooltip: "地块的详细描述" })
    public description: string = '';
    
    @property({ displayName: "基础颜色", tooltip: "地块的默认颜色" })
    public baseColor: Color = new Color(200, 200, 200, 255);
    
    @property({ displayName: "高亮颜色", tooltip: "鼠标悬停或选中时的颜色" })
    public highlightColor: Color = new Color(255, 255, 100, 255);
    
    @property({ displayName: "启用点击交互", tooltip: "是否响应鼠标点击" })
    public enableClickInteraction: boolean = true;
    
    @property({ displayName: "启用悬停效果", tooltip: "是否响应鼠标悬停" })
    public enableHoverEffect: boolean = true;
    
    // ========================= 私有属性 =========================
    
    /** 地块数据 */
    protected _tileData: MapTileData | null = null;
    
    /** 当前状态 */
    protected _currentState: TileState = TileState.NORMAL;
    
    /** 渲染状态 */
    protected _renderState: TileRenderState;
    
    /** 网格渲染组件 */
    protected _meshRenderer: MeshRenderer | null = null;
    
    /** 碰撞器组件 */
    protected _collider: BoxCollider | null = null;
    
    /** 当前停留的玩家列表 */
    protected _playersOnTile: PlayerData[] = [];
    
    /** 是否已初始化 */
    protected _isInitialized: boolean = false;
    
    // ========================= 抽象属性（子类必须实现） =========================
    
    /** 地块类型（子类必须定义） */
    public abstract get tileType(): TileType;
    
    // ========================= 生命周期方法 =========================
    
    protected onLoad(): void {
        this.initializeRenderState();
        this.setupComponents();
        this.registerEventHandlers();
    }
    
    protected start(): void {
        // 等待一帧确保所有组件都已准备好
        this.scheduleOnce(() => {
            this.onTileReady();
        }, 0);
    }
    
    protected onDestroy(): void {
        this.unregisterEventHandlers();
        this.cleanup();
    }
    
    // ========================= 初始化方法 =========================
    
    /**
     * 初始化渲染状态
     * 设置默认的渲染配置
     */
    protected initializeRenderState(): void {
        this._renderState = {
            baseColor: this.baseColor.clone(),
            highlightColor: this.highlightColor.clone(),
            isHighlighted: false,
            isSelected: false,
            opacity: 1.0
        };
    }
    
    /**
     * 设置必要的组件
     * 确保地块拥有渲染和碰撞检测能力
     */
    protected setupComponents(): void {
        // 获取或创建MeshRenderer组件
        this._meshRenderer = this.getComponent(MeshRenderer);
        if (!this._meshRenderer) {
            //从第一个子节点里获取
            this._meshRenderer = this.node.children[0].getComponent(MeshRenderer);
            if (!this._meshRenderer) {
                this._meshRenderer = this.addComponent(MeshRenderer);
                console.warn(`[MapTile] 地块 ${this.node.name} 缺少MeshRenderer组件，已自动添加`);
            }
        }
        
        // 获取或创建BoxCollider组件（用于点击检测）
        this._collider = this.getComponent(BoxCollider);
        if (!this._collider && this.enableClickInteraction) {
            this._collider = this.node.children[0].getComponent(BoxCollider);
            if (!this._collider) {
                this._collider = this.addComponent(BoxCollider);
                console.warn(`[MapTile] 地块 ${this.node.name} 缺少BoxCollider组件，已自动添加`);
            }
            this._collider.isTrigger = true; // 设置为触发器，用于检测点击
        }
    }
    
    /**
     * 注册事件处理器
     * 设置鼠标交互事件
     */
    protected registerEventHandlers(): void {
        if (this.enableClickInteraction) {
            // TODO: 这里需要根据Cocos Creator的具体版本调整事件处理方式
            // 当前版本的射线检测和鼠标事件需要在场景级别处理
            // 这里预留接口，具体实现需要配合MapManager
            this.node.on(Node.EventType.MOUSE_DOWN, this.onMouseClick, this);
            this.node.on(Node.EventType.MOUSE_ENTER, this.onMouseEnter, this);
            this.node.on(Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
        }
    }
    
    /**
     * 取消注册事件处理器
     */
    protected unregisterEventHandlers(): void {
        if (this.node.isValid) {
            this.node.off(Node.EventType.MOUSE_DOWN, this.onMouseClick, this);
            this.node.off(Node.EventType.MOUSE_ENTER, this.onMouseEnter, this);
            this.node.off(Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
        }
    }
    
    /**
     * 地块准备完成回调
     * 在所有初始化完成后调用
     */
    protected onTileReady(): void {
        this._isInitialized = true;
        this.updateVisualAppearance();
        console.log(`[MapTile] 地块 ${this.tileName} 初始化完成`);
    }
    
    /**
     * 清理资源
     */
    protected cleanup(): void {
        this._playersOnTile = [];
        this._tileData = null;
    }
    
    // ========================= 公共接口方法 =========================
    
    /**
     * 初始化地块数据
     * @param tileData 地块配置数据
     */
    public initializeTile(tileData: MapTileData): void {
        this._tileData = tileData;
        this._currentState = tileData.state;
        
        // 更新基本属性
        this.tileName = tileData.name;
        this.description = tileData.description;
        
        // 应用渲染配置
        if (tileData.renderConfig) {
            this._renderState.baseColor = tileData.renderConfig.primaryColor;
            if (tileData.renderConfig.secondaryColor) {
                this._renderState.highlightColor = tileData.renderConfig.secondaryColor;
            }
        }
        
        // 设置3D位置
        this.setPosition(tileData.position);
        
        // 调用子类的初始化逻辑
        this.onTileInitialized(tileData);
        
        // 更新视觉表现
        this.updateVisualAppearance();
        
        console.log(`[MapTile] 地块 ${this.tileName} (${this.tileType}) 数据初始化完成`);
    }
    
    /**
     * 设置地块的3D位置
     * @param position 目标位置
     */
    public setPosition(position: Position3D): void {
        const vec3Pos = new Vec3(position.x, position.y, position.z);
        this.node.setPosition(vec3Pos);
        
        // 设置旋转（如果有的话）
        if (position.rotation !== undefined) {
            this.node.setRotationFromEuler(0, position.rotation, 0);
        }
    }
    
    /**
     * 获取地块的世界位置
     */
    public getWorldPosition(): Vec3 {
        const worldPos = new Vec3();
        this.node.getWorldPosition(worldPos);
        return worldPos;
    }
    
    /**
     * 玩家停留在此地块
     * @param player 停留的玩家
     */
    public async playerLandOn(player: PlayerData): Promise<TileInteractionResult> {
        console.log(`[MapTile] 玩家 ${player.nickname} 停留在地块 ${this.tileName}`);
        
        // 添加玩家到停留列表
        if (!this._playersOnTile.find(p => p.id === player.id)) {
            this._playersOnTile.push(player);
        }
        
        // 更新玩家位置
        player.currentTileId = this._tileData!.id;
        
        // 调用子类的停留处理逻辑
        const result = await this.onPlayerLandOn(player);
        
        // 触发停留事件
        this.emitGameEvent(GameEventType.PLAYER_MOVE, {
            playerId: player.id,
            tileId: this._tileData!.id,
            tileName: this.tileName,
            tileType: this.tileType
        });
        
        return result;
    }
    
    /**
     * 玩家经过此地块（不停留）
     * @param player 经过的玩家
     */
    public async playerPassThrough(player: PlayerData): Promise<TileInteractionResult> {
        console.log(`[MapTile] 玩家 ${player.nickname} 经过地块 ${this.tileName}`);
        
        // 调用子类的经过处理逻辑
        const result = await this.onPlayerPassThrough(player);
        
        return result;
    }
    
    /**
     * 玩家离开此地块
     * @param player 离开的玩家
     */
    public playerLeave(player: PlayerData): void {
        console.log(`[MapTile] 玩家 ${player.nickname} 离开地块 ${this.tileName}`);
        
        // 从停留列表中移除玩家
        const index = this._playersOnTile.findIndex(p => p.id === player.id);
        if (index !== -1) {
            this._playersOnTile.splice(index, 1);
        }
        
        // 调用子类的离开处理逻辑
        this.onPlayerLeave(player);
    }
    
    /**
     * 设置地块状态
     * @param newState 新的状态
     */
    public setState(newState: TileState): void {
        const oldState = this._currentState;
        this._currentState = newState;
        
        // 更新数据
        if (this._tileData) {
            this._tileData.state = newState;
        }
        
        // 更新视觉表现
        this.updateVisualAppearance();
        
        // 调用状态变化回调
        this.onStateChanged(oldState, newState);
        
        console.log(`[MapTile] 地块 ${this.tileName} 状态变更: ${oldState} -> ${newState}`);
    }
    
    /**
     * 设置高亮状态
     * @param highlighted 是否高亮
     */
    public setHighlighted(highlighted: boolean): void {
        if (this._renderState.isHighlighted !== highlighted) {
            this._renderState.isHighlighted = highlighted;
            this.updateVisualAppearance();
            
            // 播放高亮动画
            if (highlighted) {
                this.playHighlightAnimation();
            }
        }
    }
    
    /**
     * 设置选中状态
     * @param selected 是否选中
     */
    public setSelected(selected: boolean): void {
        if (this._renderState.isSelected !== selected) {
            this._renderState.isSelected = selected;
            this.updateVisualAppearance();
            
            // 播放选中动画
            if (selected) {
                this.playSelectionAnimation();
            }
        }
    }
    
    // ========================= 抽象方法（子类必须实现） =========================
    
    /**
     * 子类初始化回调
     * 子类可以重写此方法来执行特定的初始化逻辑
     * @param tileData 地块数据
     */
    protected abstract onTileInitialized(tileData: MapTileData): void;
    
    /**
     * 玩家停留处理
     * 子类必须实现具体的停留逻辑
     * @param player 停留的玩家
     */
    protected abstract onPlayerLandOn(player: PlayerData): Promise<TileInteractionResult>;
    
    /**
     * 玩家经过处理
     * 子类可以重写此方法来处理玩家经过的逻辑
     * @param player 经过的玩家
     */
    protected onPlayerPassThrough(player: PlayerData): Promise<TileInteractionResult> {
        // 默认实现：经过不触发特殊效果
        return Promise.resolve({
            success: true,
            message: `玩家经过 ${this.tileName}`,
            events: []
        });
    }
    
    /**
     * 玩家离开处理
     * 子类可以重写此方法来处理玩家离开的逻辑
     * @param player 离开的玩家
     */
    protected onPlayerLeave(player: PlayerData): void {
        // 默认实现：无特殊处理
    }
    
    /**
     * 状态变化回调
     * 子类可以重写此方法来响应状态变化
     * @param oldState 旧状态
     * @param newState 新状态
     */
    protected onStateChanged(oldState: TileState, newState: TileState): void {
        // 默认实现：无特殊处理
    }
    
    /**
     * 更新材质颜色
     * @param color 要设置的颜色
     */
    private updateMaterialColor(color: Color): void {
        if (!this._meshRenderer) {
            console.warn(`[MapTile] 地块 ${this.tileName} 没有MeshRenderer组件`);
            return;
        }

        const material = this._meshRenderer.getMaterialInstance(0);
        if (!material) {
            console.warn(`[MapTile] 地块 ${this.tileName} 没有材质实例，尝试创建默认材质`);
            this.ensureMaterialInstance();
            return;
        }

        // 转换为Vec4格式，范围 0-1
        const colorVec4 = new Vec4(
            color.r / 255.0,
            color.g / 255.0, 
            color.b / 255.0,
            color.a / 255.0
        );

        // 尝试常见的颜色属性名
        const propertyNames = ['albedo', 'mainColor', 'baseColor', 'diffuse', 'u_color'];
        let success = false;

        for (const propName of propertyNames) {
            try {
                material.setProperty(propName, colorVec4);
                console.log(`[MapTile] 成功设置地块 ${this.tileName} 颜色属性 '${propName}'`, {
                    r: colorVec4.x.toFixed(2),
                    g: colorVec4.y.toFixed(2),
                    b: colorVec4.z.toFixed(2),
                    a: colorVec4.w.toFixed(2)
                });
                success = true;
                break;
            } catch (error) {
                // 继续尝试下一个
                continue;
            }
        }

        if (!success) {
            // 如果所有属性名都失败，记录材质信息供调试
            console.warn(`[MapTile] 无法设置地块 ${this.tileName} 颜色，材质信息:`);
            console.log('Material:', {
                name: material.name,
                effectName: material.effectAsset?.name,
                passCount: material.passes?.length
            });
            
            // 显示可用的材质属性
            if (material.passes && material.passes[0]) {
                const pass = material.passes[0];
                console.log('Available properties:', Object.keys(pass.properties || {}));
            }
        }
    }

    /**
     * 确保有材质实例
     */
    private ensureMaterialInstance(): void {
        if (!this._meshRenderer) return;

        let material = this._meshRenderer.getMaterialInstance(0);
        if (!material) {
            // 尝试创建默认材质
            console.log(`[MapTile] 地块 ${this.tileName} 没有材质，尝试创建默认材质`);
            
            // 加载默认材质 - 使用内置标准材质
            resources.load('effects/builtin-standard', Material, (err, mat) => {
                if (!err && mat && this._meshRenderer) {
                    this._meshRenderer.materials = [mat];
                    console.log(`[MapTile] 地块 ${this.tileName} 已设置默认材质`);
                    // 重新设置颜色
                    this.updateVisualAppearance();
                } else {
                    console.error(`[MapTile] 无法加载默认材质:`, err);
                }
            });
        }
    }

    // ========================= 事件处理方法 =========================
    
    /**
     * 鼠标点击处理
     */
    protected onMouseClick(event: any): void {
        console.log(`[MapTile] 点击地块: ${this.tileName}`);
        
        // 触发地块点击事件
        this.emitGameEvent('tile_click', {
            tileId: this._tileData?.id,
            tileName: this.tileName,
            tileType: this.tileType,
            clickPosition: event.getLocation()
        });
        
        // 调用子类的点击处理
        this.onTileClicked(event);
    }
    
    /**
     * 鼠标进入处理
     */
    protected onMouseEnter(event: any): void {
        if (this.enableHoverEffect) {
            this.setHighlighted(true);
        }
        
        // 调用子类的悬停处理
        this.onTileHoverEnter(event);
    }
    
    /**
     * 鼠标离开处理
     */
    protected onMouseLeave(event: any): void {
        if (this.enableHoverEffect) {
            this.setHighlighted(false);
        }
        
        // 调用子类的悬停处理
        this.onTileHoverLeave(event);
    }
    
    /**
     * 地块点击回调（子类可重写）
     */
    protected onTileClicked(_event: any): void {
        // 默认实现：无特殊处理
    }
    
    /**
     * 鼠标悬停进入回调（子类可重写）
     */
    protected onTileHoverEnter(_event: any): void {
        // 默认实现：无特殊处理
    }
    
    /**
     * 鼠标悬停离开回调（子类可重写）
     */
    protected onTileHoverLeave(_event: any): void {
        // 默认实现：无特殊处理
    }
    
    // ========================= 渲染和动画方法 =========================
    
    /**
     * 更新视觉表现
     * 根据当前状态更新地块的视觉效果
     */
    protected updateVisualAppearance(): void {
        if (!this._meshRenderer || !this._isInitialized) {
            return;
        }
        
        // 计算当前显示颜色
        let currentColor = this._renderState.baseColor.clone();
        
        // 应用高亮效果
        if (this._renderState.isHighlighted || this._renderState.isSelected) {
            currentColor = this._renderState.highlightColor.clone();
        }
        
        // 应用状态效果
        switch (this._currentState) {
            case TileState.BLOCKED:
                // 被阻挡的地块变暗
                currentColor.r *= 0.5;
                currentColor.g *= 0.5;
                currentColor.b *= 0.5;
                break;
            case TileState.SELECTED:
                // 被选中的地块更亮
                currentColor.r = Math.min(255, currentColor.r * 1.2);
                currentColor.g = Math.min(255, currentColor.g * 1.2);
                currentColor.b = Math.min(255, currentColor.b * 1.2);
                break;
        }
        
        // 应用透明度
        currentColor.a = this._renderState.opacity * 255;
        
        // 更新材质颜色 - 修复版本
        this.updateMaterialColor(currentColor);
    }
    
    /**
     * 播放高亮动画
     */
    protected playHighlightAnimation(): void {
        // 简单的缩放动画
        tween(this.node)
            .to(0.1, { scale: new Vec3(1.05, 1.05, 1.05) })
            .to(0.1, { scale: new Vec3(1, 1, 1) })
            .start();
    }
    
    /**
     * 播放选中动画
     */
    protected playSelectionAnimation(): void {
        // 简单的上下浮动动画
        const originalY = this.node.position.y;
        tween(this.node)
            .to(0.2, { position: new Vec3(this.node.position.x, originalY + 0.1, this.node.position.z) })
            .to(0.2, { position: new Vec3(this.node.position.x, originalY, this.node.position.z) })
            .start();
    }
    
    // ========================= 工具方法 =========================
    
    /**
     * 发射游戏事件
     * @param eventType 事件类型
     * @param eventData 事件数据
     */
    protected emitGameEvent(eventType: GameEventType | string, eventData: any): void {
        // TODO: 这里需要与GameManager集成来发射事件
        // 当前只是记录日志，实际实现时需要通过事件系统通知其他组件
        console.log(`[MapTile] 发射游戏事件: ${eventType}`, eventData);
        
        // 示例：通过节点事件系统发射（需要在MapManager中监听）
        this.node.emit('game-event', {
            type: eventType,
            data: eventData,
            source: this
        });
    }
    
    /**
     * 获取地块数据
     */
    public getTileData(): MapTileData | null {
        return this._tileData;
    }
    
    /**
     * 获取当前状态
     */
    public getCurrentState(): TileState {
        return this._currentState;
    }
    
    /**
     * 获取当前停留的玩家列表
     */
    public getPlayersOnTile(): PlayerData[] {
        return [...this._playersOnTile];
    }
    
    /**
     * 检查是否有玩家停留
     */
    public hasPlayersOnTile(): boolean {
        return this._playersOnTile.length > 0;
    }
    
    /**
     * 检查特定玩家是否停留在此地块
     */
    public hasPlayer(playerId: string): boolean {
        return this._playersOnTile.some(p => p.id === playerId);
    }
    
    /**
     * 获取地块描述信息（用于UI显示）
     */
    public getTileInfo(): { name: string; description: string; type: TileType; state: TileState } {
        return {
            name: this.tileName,
            description: this.description,
            type: this.tileType,
            state: this._currentState
        };
    }
}