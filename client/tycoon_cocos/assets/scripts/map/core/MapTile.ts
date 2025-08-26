/**
 * 地块基类
 * 
 * 所有地块类型的基础类，提供通用的地块行为和接口
 * 继承自Cocos Creator的Component，可以挂载到场景节点上
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component, Node, Vec3, Color, Material, MeshRenderer, BoxCollider, tween } from 'cc';
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
            this._meshRenderer = this.addComponent(MeshRenderer);
            console.warn(`[MapTile] 地块 ${this.node.name} 缺少MeshRenderer组件，已自动添加`);
        }
        
        // 获取或创建BoxCollider组件（用于点击检测）
        this._collider = this.getComponent(BoxCollider);
        if (!this._collider && this.enableClickInteraction) {
            this._collider = this.addComponent(BoxCollider);
            this._collider.isTrigger = true; // 设置为触发器，用于检测点击
            console.warn(`[MapTile] 地块 ${this.node.name} 缺少BoxCollider组件，已自动添加`);
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
        
        // 调用子类的初始化逻辑\n        this.onTileInitialized(tileData);
        \n        // 更新视觉表现\n        this.updateVisualAppearance();\n        \n        console.log(`[MapTile] 地块 ${this.tileName} (${this.tileType}) 数据初始化完成`);\n    }\n    \n    /**\n     * 设置地块的3D位置\n     * @param position 目标位置\n     */\n    public setPosition(position: Position3D): void {\n        const vec3Pos = new Vec3(position.x, position.y, position.z);\n        this.node.setPosition(vec3Pos);\n        \n        // 设置旋转（如果有的话）\n        if (position.rotation !== undefined) {\n            this.node.setRotationFromEuler(0, position.rotation, 0);\n        }\n    }\n    \n    /**\n     * 获取地块的世界位置\n     */\n    public getWorldPosition(): Vec3 {\n        const worldPos = new Vec3();\n        this.node.getWorldPosition(worldPos);\n        return worldPos;\n    }\n    \n    /**\n     * 玩家停留在此地块\n     * @param player 停留的玩家\n     */\n    public async playerLandOn(player: PlayerData): Promise<TileInteractionResult> {\n        console.log(`[MapTile] 玩家 ${player.nickname} 停留在地块 ${this.tileName}`);\n        \n        // 添加玩家到停留列表\n        if (!this._playersOnTile.find(p => p.id === player.id)) {\n            this._playersOnTile.push(player);\n        }\n        \n        // 更新玩家位置\n        player.currentTileId = this._tileData!.id;\n        \n        // 调用子类的停留处理逻辑\n        const result = await this.onPlayerLandOn(player);\n        \n        // 触发停留事件\n        this.emitGameEvent(GameEventType.PLAYER_MOVE, {\n            playerId: player.id,\n            tileId: this._tileData!.id,\n            tileName: this.tileName,\n            tileType: this.tileType\n        });\n        \n        return result;\n    }\n    \n    /**\n     * 玩家经过此地块（不停留）\n     * @param player 经过的玩家\n     */\n    public async playerPassThrough(player: PlayerData): Promise<TileInteractionResult> {\n        console.log(`[MapTile] 玩家 ${player.nickname} 经过地块 ${this.tileName}`);\n        \n        // 调用子类的经过处理逻辑\n        const result = await this.onPlayerPassThrough(player);\n        \n        return result;\n    }\n    \n    /**\n     * 玩家离开此地块\n     * @param player 离开的玩家\n     */\n    public playerLeave(player: PlayerData): void {\n        console.log(`[MapTile] 玩家 ${player.nickname} 离开地块 ${this.tileName}`);\n        \n        // 从停留列表中移除玩家\n        const index = this._playersOnTile.findIndex(p => p.id === player.id);\n        if (index !== -1) {\n            this._playersOnTile.splice(index, 1);\n        }\n        \n        // 调用子类的离开处理逻辑\n        this.onPlayerLeave(player);\n    }\n    \n    /**\n     * 设置地块状态\n     * @param newState 新的状态\n     */\n    public setState(newState: TileState): void {\n        const oldState = this._currentState;\n        this._currentState = newState;\n        \n        // 更新数据\n        if (this._tileData) {\n            this._tileData.state = newState;\n        }\n        \n        // 更新视觉表现\n        this.updateVisualAppearance();\n        \n        // 调用状态变化回调\n        this.onStateChanged(oldState, newState);\n        \n        console.log(`[MapTile] 地块 ${this.tileName} 状态变更: ${oldState} -> ${newState}`);\n    }\n    \n    /**\n     * 设置高亮状态\n     * @param highlighted 是否高亮\n     */\n    public setHighlighted(highlighted: boolean): void {\n        if (this._renderState.isHighlighted !== highlighted) {\n            this._renderState.isHighlighted = highlighted;\n            this.updateVisualAppearance();\n            \n            // 播放高亮动画\n            if (highlighted) {\n                this.playHighlightAnimation();\n            }\n        }\n    }\n    \n    /**\n     * 设置选中状态\n     * @param selected 是否选中\n     */\n    public setSelected(selected: boolean): void {\n        if (this._renderState.isSelected !== selected) {\n            this._renderState.isSelected = selected;\n            this.updateVisualAppearance();\n            \n            // 播放选中动画\n            if (selected) {\n                this.playSelectionAnimation();\n            }\n        }\n    }\n    \n    // ========================= 抽象方法（子类必须实现） =========================\n    \n    /**\n     * 子类初始化回调\n     * 子类可以重写此方法来执行特定的初始化逻辑\n     * @param tileData 地块数据\n     */\n    protected abstract onTileInitialized(tileData: MapTileData): void;\n    \n    /**\n     * 玩家停留处理\n     * 子类必须实现具体的停留逻辑\n     * @param player 停留的玩家\n     */\n    protected abstract onPlayerLandOn(player: PlayerData): Promise<TileInteractionResult>;\n    \n    /**\n     * 玩家经过处理\n     * 子类可以重写此方法来处理玩家经过的逻辑\n     * @param player 经过的玩家\n     */\n    protected onPlayerPassThrough(player: PlayerData): Promise<TileInteractionResult> {\n        // 默认实现：经过不触发特殊效果\n        return Promise.resolve({\n            success: true,\n            message: `玩家经过 ${this.tileName}`,\n            events: []\n        });\n    }\n    \n    /**\n     * 玩家离开处理\n     * 子类可以重写此方法来处理玩家离开的逻辑\n     * @param player 离开的玩家\n     */\n    protected onPlayerLeave(player: PlayerData): void {\n        // 默认实现：无特殊处理\n    }\n    \n    /**\n     * 状态变化回调\n     * 子类可以重写此方法来响应状态变化\n     * @param oldState 旧状态\n     * @param newState 新状态\n     */\n    protected onStateChanged(oldState: TileState, newState: TileState): void {\n        // 默认实现：无特殊处理\n    }\n    \n    // ========================= 事件处理方法 =========================\n    \n    /**\n     * 鼠标点击处理\n     */\n    protected onMouseClick(event: any): void {\n        console.log(`[MapTile] 点击地块: ${this.tileName}`);\n        \n        // 触发地块点击事件\n        this.emitGameEvent('tile_click', {\n            tileId: this._tileData?.id,\n            tileName: this.tileName,\n            tileType: this.tileType,\n            clickPosition: event.getLocation()\n        });\n        \n        // 调用子类的点击处理\n        this.onTileClicked(event);\n    }\n    \n    /**\n     * 鼠标进入处理\n     */\n    protected onMouseEnter(event: any): void {\n        if (this.enableHoverEffect) {\n            this.setHighlighted(true);\n        }\n        \n        // 调用子类的悬停处理\n        this.onTileHoverEnter(event);\n    }\n    \n    /**\n     * 鼠标离开处理\n     */\n    protected onMouseLeave(event: any): void {\n        if (this.enableHoverEffect) {\n            this.setHighlighted(false);\n        }\n        \n        // 调用子类的悬停处理\n        this.onTileHoverLeave(event);\n    }\n    \n    /**\n     * 地块点击回调（子类可重写）\n     */\n    protected onTileClicked(event: any): void {\n        // 默认实现：无特殊处理\n    }\n    \n    /**\n     * 鼠标悬停进入回调（子类可重写）\n     */\n    protected onTileHoverEnter(event: any): void {\n        // 默认实现：无特殊处理\n    }\n    \n    /**\n     * 鼠标悬停离开回调（子类可重写）\n     */\n    protected onTileHoverLeave(event: any): void {\n        // 默认实现：无特殊处理\n    }\n    \n    // ========================= 渲染和动画方法 =========================\n    \n    /**\n     * 更新视觉表现\n     * 根据当前状态更新地块的视觉效果\n     */\n    protected updateVisualAppearance(): void {\n        if (!this._meshRenderer || !this._isInitialized) {\n            return;\n        }\n        \n        // 计算当前显示颜色\n        let currentColor = this._renderState.baseColor.clone();\n        \n        // 应用高亮效果\n        if (this._renderState.isHighlighted || this._renderState.isSelected) {\n            currentColor = this._renderState.highlightColor.clone();\n        }\n        \n        // 应用状态效果\n        switch (this._currentState) {\n            case TileState.BLOCKED:\n                // 被阻挡的地块变暗\n                currentColor.r *= 0.5;\n                currentColor.g *= 0.5;\n                currentColor.b *= 0.5;\n                break;\n            case TileState.SELECTED:\n                // 被选中的地块更亮\n                currentColor.r = Math.min(255, currentColor.r * 1.2);\n                currentColor.g = Math.min(255, currentColor.g * 1.2);\n                currentColor.b = Math.min(255, currentColor.b * 1.2);\n                break;\n        }\n        \n        // 应用透明度\n        currentColor.a = this._renderState.opacity * 255;\n        \n        // 更新材质颜色\n        // TODO: 这里需要根据具体的材质类型来设置颜色\n        // 目前假设使用的是有albedo属性的材质\n        const material = this._meshRenderer.getMaterial(0);\n        if (material) {\n            // material.setProperty('albedo', currentColor); // 实际实现时需要确认属性名\n            console.log(`[MapTile] 更新地块 ${this.tileName} 颜色:`, currentColor);\n        }\n    }\n    \n    /**\n     * 播放高亮动画\n     */\n    protected playHighlightAnimation(): void {\n        // 简单的缩放动画\n        tween(this.node)\n            .to(0.1, { scale: new Vec3(1.05, 1.05, 1.05) })\n            .to(0.1, { scale: new Vec3(1, 1, 1) })\n            .start();\n    }\n    \n    /**\n     * 播放选中动画\n     */\n    protected playSelectionAnimation(): void {\n        // 简单的上下浮动动画\n        const originalY = this.node.position.y;\n        tween(this.node)\n            .to(0.2, { position: new Vec3(this.node.position.x, originalY + 0.1, this.node.position.z) })\n            .to(0.2, { position: new Vec3(this.node.position.x, originalY, this.node.position.z) })\n            .start();\n    }\n    \n    // ========================= 工具方法 =========================\n    \n    /**\n     * 发射游戏事件\n     * @param eventType 事件类型\n     * @param eventData 事件数据\n     */\n    protected emitGameEvent(eventType: GameEventType | string, eventData: any): void {\n        // TODO: 这里需要与GameManager集成来发射事件\n        // 当前只是记录日志，实际实现时需要通过事件系统通知其他组件\n        console.log(`[MapTile] 发射游戏事件: ${eventType}`, eventData);\n        \n        // 示例：通过节点事件系统发射（需要在MapManager中监听）\n        this.node.emit('game-event', {\n            type: eventType,\n            data: eventData,\n            source: this\n        });\n    }\n    \n    /**\n     * 获取地块数据\n     */\n    public getTileData(): MapTileData | null {\n        return this._tileData;\n    }\n    \n    /**\n     * 获取当前状态\n     */\n    public getCurrentState(): TileState {\n        return this._currentState;\n    }\n    \n    /**\n     * 获取当前停留的玩家列表\n     */\n    public getPlayersOnTile(): PlayerData[] {\n        return [...this._playersOnTile];\n    }\n    \n    /**\n     * 检查是否有玩家停留\n     */\n    public hasPlayersOnTile(): boolean {\n        return this._playersOnTile.length > 0;\n    }\n    \n    /**\n     * 检查特定玩家是否停留在此地块\n     */\n    public hasPlayer(playerId: string): boolean {\n        return this._playersOnTile.some(p => p.id === playerId);\n    }\n    \n    /**\n     * 获取地块描述信息（用于UI显示）\n     */\n    public getTileInfo(): { name: string; description: string; type: TileType; state: TileState } {\n        return {\n            name: this.tileName,\n            description: this.description,\n            type: this.tileType,\n            state: this._currentState\n        };\n    }\n}