/**
 * 地块组件
 * 
 * Web3TileType的包装器，负责管理地块的渲染和交互
 * 使用组件化架构，每个地块管理自己的节点和视觉表现
 * 
 * @author Web3 Tycoon Team
 * @version 2.0.0
 */

import { _decorator, Vec2, Vec3 } from 'cc';
import { MapElement } from './MapElement';
import { Web3TileType, getWeb3BlockByBlockId } from '../../voxel/Web3BlockTypes';
import { TileData } from '../data/MapDataTypes';

const { ccclass } = _decorator;

/**
 * 地块组件
 * 完全重写的MapTile，作为Web3TileType的包装器
 */
@ccclass('MapTile')
export class MapTile extends MapElement {
    
    // ========================= 地块特有属性 =========================
    
    /** 地产拥有者 (仅地产类型有效) */
    private _owner: string | null = null;
    
    /** 建筑等级 (0-4: 空地,小屋,洋房,大楼,地标) */
    private _buildingLevel: number = 0;
    
    /** 地产价格 */
    private _price: number = 0;
    
    /** 各等级租金 */
    private _rent: number[] = [];
    
    /** 是否被抵押 */
    private _mortgaged: boolean = false;
    
    /** 是否可建造 */
    private _canBuild: boolean = false;
    
    // ========================= 初始化 =========================
    
    /**
     * 初始化地块
     * @param blockId 方块ID (如 "web3:property")
     * @param gridPos 网格坐标
     */
    public async initialize(blockId: string, gridPos: Vec2): Promise<void> {
        // 设置基础属性
        this._blockId = blockId;
        this._gridPosition = gridPos;
        this._worldPosition = this.gridToWorld(gridPos, 0); // 地块在y=0层
        
        // 获取方块信息
        const blockInfo = getWeb3BlockByBlockId(blockId);
        if (!blockInfo) {
            console.error(`[MapTile] Unknown block ID: ${blockId}`);
            return;
        }
        
        // 设置类型ID
        this._typeId = blockInfo.typeId;
        
        // 设置节点位置
        this.node.setPosition(this._worldPosition);
        
        // 创建视觉表现
        await this.createVisual();
        
        // 设置碰撞器（用于点击检测）
        this.setupCollider(new Vec3(1, 0.5, 1), new Vec3(0, 0.25, 0));
        
        // 初始化地块特有属性
        this.initializeTileProperties();
        
        this._initialized = true;
        console.log(`[MapTile] Initialized tile ${blockId} at (${gridPos.x}, ${gridPos.y})`);
    }
    
    /**
     * 初始化地块特有属性
     */
    private initializeTileProperties(): void {
        // 根据类型设置默认属性
        switch (this._typeId) {
            case Web3TileType.PROPERTY:
                this._canBuild = true;
                this._price = 1000; // 默认价格
                this._rent = [50, 200, 600, 1400, 1700, 2000]; // 默认租金
                break;
                
                
            case Web3TileType.CHANCE:
            case Web3TileType.BONUS:
            case Web3TileType.FEE:
            case Web3TileType.CARD:
            case Web3TileType.NEWS:
            case Web3TileType.HOSPITAL:
            case Web3TileType.EMPTY_LAND:
                // 特殊地块不可建造
                this._canBuild = false;
                break;
        }
    }
    
    // ========================= 抽象方法实现 =========================
    
    /**
     * 获取元素类型
     */
    public getElementType(): 'tile' | 'object' {
        return 'tile';
    }
    
    /**
     * 创建视觉表现
     */
    protected async createVisual(): Promise<void> {
        // 使用体素系统创建地块渲染
        await this.createVoxelRender(this._blockId, Vec3.ZERO);
        
        // 如果是地产，可能需要创建建筑物的额外渲染
        if (this._typeId === Web3TileType.PROPERTY && this._buildingLevel > 0) {
            await this.updateBuildingVisual();
        }
    }
    
    /**
     * 获取序列化数据
     */
    public getData(): TileData {
        const data: TileData = {
            blockId: this._blockId,
            typeId: this._typeId,
            position: {
                x: this._gridPosition.x,
                z: this._gridPosition.y
            }
        };
        
        // 添加地产特有数据
        if (this._typeId === Web3TileType.PROPERTY) {
            data.data = {
                owner: this._owner || undefined,
                level: this._buildingLevel,
                price: this._price,
                rent: this._rent,
                mortgaged: this._mortgaged
            };
        }
        
        return data;
    }
    
    /**
     * 从数据恢复
     */
    public async loadData(data: TileData): Promise<void> {
        // 初始化基础数据
        await this.initialize(
            data.blockId,
            new Vec2(data.position.x, data.position.z)
        );
        
        // 恢复地产特有数据
        if (data.data) {
            if (data.data.owner !== undefined) {
                this._owner = data.data.owner;
            }
            if (data.data.level !== undefined) {
                this._buildingLevel = data.data.level;
                await this.updateBuildingVisual();
            }
            if (data.data.price !== undefined) {
                this._price = data.data.price;
            }
            if (data.data.rent !== undefined) {
                this._rent = data.data.rent;
            }
            if (data.data.mortgaged !== undefined) {
                this._mortgaged = data.data.mortgaged;
            }
        }
    }
    
    // ========================= 地块特有方法 =========================
    
    /**
     * 是否可以建造
     */
    public canBuild(): boolean {
        // 必须是地产类型
        if (this._typeId !== Web3TileType.PROPERTY) {
            return false;
        }
        
        // 必须有拥有者
        if (!this._owner) {
            return false;
        }
        
        // 不能被抵押
        if (this._mortgaged) {
            return false;
        }
        
        // 不能超过最大等级
        if (this._buildingLevel >= 4) {
            return false;
        }
        
        return this._canBuild;
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
        console.log(`[MapTile] Set owner of tile at (${this._gridPosition.x}, ${this._gridPosition.y}) to ${owner}`);
        
        // TODO: 更新视觉效果（如改变颜色）
    }
    
    /**
     * 获取建筑等级
     */
    public getLevel(): number {
        return this._buildingLevel;
    }
    
    /**
     * 设置建筑等级
     */
    public async setLevel(level: number): Promise<void> {
        if (level < 0 || level > 4) {
            console.warn(`[MapTile] Invalid building level: ${level}`);
            return;
        }
        
        const oldLevel = this._buildingLevel;
        this._buildingLevel = level;
        
        console.log(`[MapTile] Building level changed from ${oldLevel} to ${level}`);
        
        // 更新建筑视觉
        await this.updateBuildingVisual();
    }
    
    /**
     * 升级建筑
     */
    public async upgrade(): Promise<boolean> {
        if (!this.canBuild()) {
            return false;
        }
        
        await this.setLevel(this._buildingLevel + 1);
        return true;
    }
    
    /**
     * 降级建筑
     */
    public async downgrade(): Promise<boolean> {
        if (this._buildingLevel <= 0) {
            return false;
        }
        
        await this.setLevel(this._buildingLevel - 1);
        return true;
    }
    
    /**
     * 获取价格
     */
    public getPrice(): number {
        return this._price;
    }
    
    /**
     * 设置价格
     */
    public setPrice(price: number): void {
        this._price = price;
    }
    
    /**
     * 获取当前租金
     */
    public getRent(): number {
        if (this._mortgaged) {
            return 0; // 抵押的地产不收租
        }
        
        if (this._buildingLevel >= 0 && this._buildingLevel < this._rent.length) {
            return this._rent[this._buildingLevel];
        }
        
        return 0;
    }
    
    /**
     * 设置租金数组
     */
    public setRentArray(rent: number[]): void {
        this._rent = rent;
    }
    
    /**
     * 是否被抵押
     */
    public isMortgaged(): boolean {
        return this._mortgaged;
    }
    
    /**
     * 设置抵押状态
     */
    public setMortgaged(mortgaged: boolean): void {
        this._mortgaged = mortgaged;
        
        if (mortgaged) {
            console.log(`[MapTile] Tile at (${this._gridPosition.x}, ${this._gridPosition.y}) is mortgaged`);
            // TODO: 更新视觉效果（如变暗）
        } else {
            console.log(`[MapTile] Tile at (${this._gridPosition.x}, ${this._gridPosition.y}) is unmortgaged`);
            // TODO: 恢复正常视觉效果
        }
    }
    
    /**
     * 计算升级成本
     */
    public getUpgradeCost(): number {
        // 简单的升级成本计算
        return this._price * 0.5 * (this._buildingLevel + 1);
    }
    
    /**
     * 计算抵押价值
     */
    public getMortgageValue(): number {
        // 抵押价值为购买价格的一半
        return this._price * 0.5;
    }
    
    /**
     * 更新建筑视觉
     */
    private async updateBuildingVisual(): Promise<void> {
        // TODO: 根据建筑等级创建不同的建筑模型
        // 例如：
        // 0 - 空地（无额外模型）
        // 1 - 小屋
        // 2 - 洋房
        // 3 - 大楼
        // 4 - 地标建筑
        
        console.log(`[MapTile] Update building visual to level ${this._buildingLevel}`);
        
        // 暂时使用不同的方块表示不同等级
        if (this._buildingLevel > 0) {
            // 可以在y=1层放置建筑标识
            // 或者改变地块本身的外观
        }
    }
    
    /**
     * 获取地块信息（用于UI显示）
     */
    public getTileInfo(): any {
        const info: any = {
            blockId: this._blockId,
            typeId: this._typeId,
            position: { x: this._gridPosition.x, z: this._gridPosition.y },
            typeName: this.getTypeName()
        };
        
        // 添加地产特有信息
        if (this._typeId === Web3TileType.PROPERTY) {
            info.property = {
                owner: this._owner,
                level: this._buildingLevel,
                levelName: this.getLevelName(),
                price: this._price,
                rent: this.getRent(),
                upgradeCost: this.canBuild() ? this.getUpgradeCost() : null,
                mortgaged: this._mortgaged,
                mortgageValue: this.getMortgageValue()
            };
        }
        
        return info;
    }
    
    /**
     * 获取类型名称
     */
    private getTypeName(): string {
        switch (this._typeId) {
            case Web3TileType.EMPTY_LAND: return '空地';
            case Web3TileType.PROPERTY: return '地产';
            case Web3TileType.HOSPITAL: return '医院';
            case Web3TileType.CHANCE: return '机会';
            case Web3TileType.BONUS: return '奖励';
            case Web3TileType.FEE: return '收费站';
            case Web3TileType.CARD: return '卡片站';
            case Web3TileType.NEWS: return '新闻站';
            default: return '未知';
        }
    }
    
    /**
     * 获取建筑等级名称
     */
    private getLevelName(): string {
        switch (this._buildingLevel) {
            case 0: return '空地';
            case 1: return '小屋';
            case 2: return '洋房';
            case 3: return '大楼';
            case 4: return '地标';
            default: return '未知';
        }
    }
    
    /**
     * 玩家踩到地块时的处理
     */
    public onPlayerLand(playerId: string): void {
        console.log(`[MapTile] Player ${playerId} landed on tile at (${this._gridPosition.x}, ${this._gridPosition.y})`);
        
        // 根据地块类型处理不同的逻辑
        switch (this._typeId) {
            case Web3TileType.PROPERTY:
                this.handlePropertyLand(playerId);
                break;
            case Web3TileType.CHANCE:
                this.handleChanceLand(playerId);
                break;
            // ... 其他类型的处理
        }
    }
    
    /**
     * 处理玩家踩到地产
     */
    private handlePropertyLand(playerId: string): void {
        if (!this._owner) {
            // 无主地产，可以购买
            console.log(`[MapTile] Property available for purchase at price ${this._price}`);
            // TODO: 触发购买事件
        } else if (this._owner === playerId) {
            // 自己的地产，可以升级
            if (this.canBuild()) {
                console.log(`[MapTile] Can upgrade property, cost: ${this.getUpgradeCost()}`);
                // TODO: 触发升级事件
            }
        } else {
            // 别人的地产，需要付租金
            const rent = this.getRent();
            console.log(`[MapTile] Need to pay rent: ${rent} to ${this._owner}`);
            // TODO: 触发付租金事件
        }
    }
    
    /**
     * 处理玩家踩到机会格
     */
    private handleChanceLand(playerId: string): void {
        console.log(`[MapTile] Player ${playerId} landed on CHANCE, draw a card!`);
        // TODO: 触发抽卡事件
    }
}