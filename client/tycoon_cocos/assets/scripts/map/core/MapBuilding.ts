/**
 * 建筑组件
 *
 * Web3BuildingType的包装器，负责管理建筑的渲染和交互
 * 建筑是放置在可购买地块上的实体，与地块(Tile)完全分离
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Vec2, Vec3 } from 'cc';
import { MapElement } from './MapElement';
import { Web3BuildingType, getWeb3BlockByBlockId } from '../../voxel/Web3BlockTypes';
import { BuildingData } from '../data/MapDataTypes';

const { ccclass } = _decorator;

/**
 * 建筑组件
 * 完全独立于MapTile，专门管理建筑实体
 */
@ccclass('MapBuilding')
export class MapBuilding extends MapElement {

    // ========================= 建筑特有属性 =========================

    /** Building编号（u16最大值65535表示无效） */
    private _buildingId: number = 65535;

    /** 建筑拥有者 */
    private _owner: string | null = null;

    /** 建筑等级 (0-4: 空地,小屋,洋房,大楼,地标) */
    private _level: number = 0;

    /** 建筑朝向 (0-3: 南西北东) */
    private _direction: number = 0;

    /** 建筑尺寸 (1x1或2x2) */
    private _size: 1 | 2 = 1;

    /** 建筑价格 */
    private _price: number = 0;

    /** 各等级租金 */
    private _rent: number[] = [];

    /** 是否被抵押 */
    private _mortgaged: boolean = false;

    // ========================= 初始化 =========================

    /**
     * 初始化建筑
     * @param blockId 方块ID (如 "web3:building_1x1")
     * @param gridPos 网格坐标
     */
    public async initialize(blockId: string, gridPos: Vec2): Promise<void> {
        // 设置基础属性
        this._blockId = blockId;
        this._gridPosition = gridPos;

        // 建筑位置根据尺寸计算
        const blockInfo = getWeb3BlockByBlockId(blockId);
        if (!blockInfo) {
            console.error(`[MapBuilding] Unknown block ID: ${blockId}`);
            return;
        }

        this._size = blockInfo.size || 1;
        this._typeId = blockInfo.typeId;

        // 计算世界位置（建筑在地面上）
        if (this._size === 1) {
            this._worldPosition = new Vec3(gridPos.x + 0.5, 0, gridPos.y + 0.5);
        } else {
            // 2x2建筑中心在4格中间
            this._worldPosition = new Vec3(gridPos.x + 1, 0, gridPos.y + 1);
        }

        // 设置节点位置
        this.node.setPosition(this._worldPosition);

        // 初始化建筑属性
        this.initializeBuildingProperties();

        // 建筑使用PaperActor渲染，不需要体素渲染
        // createVisual在GameMap中处理（创建PaperActor）

        this._initialized = true;
        console.log(`[MapBuilding] Initialized building ${blockId} at (${gridPos.x}, ${gridPos.y})`);
    }

    /**
     * 初始化建筑特有属性
     */
    private initializeBuildingProperties(): void {
        // 设置默认属性
        this._price = 1000; // 默认价格
        this._rent = [50, 200, 600, 1400, 1700, 2000]; // 默认租金
    }

    // ========================= 抽象方法实现 =========================

    /**
     * 获取元素类型
     */
    public getElementType(): 'tile' | 'object' | 'building' {
        return 'building' as any; // 扩展了基类的类型
    }

    /**
     * 创建视觉表现（建筑使用PaperActor，这里留空）
     */
    protected async createVisual(): Promise<void> {
        // 建筑的视觉表现由GameMap通过PaperActor处理
        // 这里不需要实现
    }

    /**
     * 获取序列化数据
     */
    public getData(): BuildingData {
        return {
            blockId: this._blockId,
            typeId: this._typeId,
            position: {
                x: this._gridPosition.x,
                z: this._gridPosition.y
            },
            size: this._size,
            buildingId: this._buildingId !== 65535 ? this._buildingId : undefined,
            owner: this._owner || undefined,
            level: this._level,
            direction: this._direction,
            price: this._price,
            rent: this._rent,
            mortgaged: this._mortgaged
        };
    }

    /**
     * 从数据恢复
     */
    public async loadData(data: BuildingData): Promise<void> {
        // 初始化基础数据
        await this.initialize(
            data.blockId,
            new Vec2(data.position.x, data.position.z)
        );

        // 恢复建筑特有数据
        if (data.buildingId !== undefined) {
            this._buildingId = data.buildingId;
        }
        if (data.owner !== undefined) {
            this._owner = data.owner;
        }
        if (data.level !== undefined) {
            this._level = data.level;
        }
        if (data.direction !== undefined) {
            this._direction = data.direction;
        }
        if (data.price !== undefined) {
            this._price = data.price;
        }
        if (data.rent !== undefined) {
            this._rent = data.rent;
        }
        if (data.mortgaged !== undefined) {
            this._mortgaged = data.mortgaged;
        }
    }

    // ========================= 建筑特有方法 =========================

    /**
     * 是否可以升级
     */
    public canUpgrade(): boolean {
        // 必须有拥有者
        if (!this._owner) {
            return false;
        }

        // 不能被抵押
        if (this._mortgaged) {
            return false;
        }

        // 不能超过最大等级
        if (this._level >= 4) {
            return false;
        }

        return true;
    }

    /**
     * 获取Building ID
     */
    public getBuildingId(): number {
        return this._buildingId;
    }

    /**
     * 设置Building ID
     */
    public setBuildingId(id: number): void {
        this._buildingId = id;
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
        console.log(`[MapBuilding] Set owner of building at (${this._gridPosition.x}, ${this._gridPosition.y}) to ${owner}`);
    }

    /**
     * 获取建筑等级
     */
    public getLevel(): number {
        return this._level;
    }

    /**
     * 设置建筑等级
     */
    public setLevel(level: number): void {
        if (level < 0 || level > 4) {
            console.warn(`[MapBuilding] Invalid building level: ${level}`);
            return;
        }

        const oldLevel = this._level;
        this._level = level;

        console.log(`[MapBuilding] Building level changed from ${oldLevel} to ${level}`);
    }

    /**
     * 获取朝向
     */
    public getDirection(): number {
        return this._direction;
    }

    /**
     * 设置朝向
     */
    public setDirection(direction: number): void {
        this._direction = direction % 4;
    }

    /**
     * 获取尺寸
     */
    public getSize(): 1 | 2 {
        return this._size;
    }

    /**
     * 升级建筑
     */
    public upgrade(): boolean {
        if (!this.canUpgrade()) {
            return false;
        }

        this.setLevel(this._level + 1);
        return true;
    }

    /**
     * 降级建筑
     */
    public downgrade(): boolean {
        if (this._level <= 0) {
            return false;
        }

        this.setLevel(this._level - 1);
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
            return 0; // 抵押的建筑不收租
        }

        if (this._level >= 0 && this._level < this._rent.length) {
            return this._rent[this._level];
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
            console.log(`[MapBuilding] Building at (${this._gridPosition.x}, ${this._gridPosition.y}) is mortgaged`);
        } else {
            console.log(`[MapBuilding] Building at (${this._gridPosition.x}, ${this._gridPosition.y}) is unmortgaged`);
        }
    }

    /**
     * 计算升级成本
     */
    public getUpgradeCost(): number {
        // 简单的升级成本计算
        return this._price * 0.5 * (this._level + 1);
    }

    /**
     * 计算抵押价值
     */
    public getMortgageValue(): number {
        // 抵押价值为购买价格的一半
        return this._price * 0.5;
    }

    /**
     * 获取建筑信息（用于UI显示）
     */
    public getBuildingInfo(): any {
        return {
            blockId: this._blockId,
            typeId: this._typeId,
            position: { x: this._gridPosition.x, z: this._gridPosition.y },
            size: this._size,
            buildingId: this._buildingId !== 65535 ? this._buildingId : undefined,
            owner: this._owner,
            level: this._level,
            levelName: this.getLevelName(),
            direction: this._direction,
            price: this._price,
            rent: this.getRent(),
            upgradeCost: this.canUpgrade() ? this.getUpgradeCost() : null,
            mortgaged: this._mortgaged,
            mortgageValue: this.getMortgageValue()
        };
    }

    /**
     * 获取建筑等级名称
     */
    private getLevelName(): string {
        switch (this._level) {
            case 0: return '空地';
            case 1: return '小屋';
            case 2: return '洋房';
            case 3: return '大楼';
            case 4: return '地标';
            default: return '未知';
        }
    }
}