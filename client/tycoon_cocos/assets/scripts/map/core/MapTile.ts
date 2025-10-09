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

    /** Tile编号（u16最大值65535表示无效） */
    private _tileId: number = 65535;

    /** 关联的建筑ID（u16最大值65535表示无效） */
    private _buildingId: number = 65535;

    /** 4个方向的邻居tile ID（65535表示无效） */
    private _w: number = 65535;  // west: x-1
    private _n: number = 65535;  // north: z-1
    private _e: number = 65535;  // east: x+1
    private _s: number = 65535;  // south: z+1
    
    // ========================= 初始化 =========================
    
    /**
     * 初始化地块
     * @param blockId 方块ID (如 "web3:lottery")
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
        // 地块使用扁平的碰撞器
        this.setupCollider(new Vec3(1, 0.1, 1), new Vec3(0, 0, 0));

        this._initialized = true;
        // console.log(`[MapTile] Initialized tile ${blockId} at (${gridPos.x}, ${gridPos.y})`);
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
    }
    
    /**
     * 获取序列化数据
     */
    public getData(): TileData {
        return {
            blockId: this._blockId,
            typeId: this._typeId,
            position: {
                x: this._gridPosition.x,
                z: this._gridPosition.y
            },
            data: {
                tileId: this._tileId,
                buildingId: this._buildingId,
                w: this._w,
                n: this._n,
                e: this._e,
                s: this._s
            }
        };
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

        // 恢复tileId
        if (data.data?.tileId !== undefined) {
            this._tileId = data.data.tileId;
        }

        // 恢复buildingId
        if (data.data?.buildingId !== undefined) {
            this._buildingId = data.data.buildingId;
        }

        // 恢复4方向邻居
        if (data.data?.w !== undefined) {
            this._w = data.data.w;
        }
        if (data.data?.n !== undefined) {
            this._n = data.data.n;
        }
        if (data.data?.e !== undefined) {
            this._e = data.data.e;
        }
        if (data.data?.s !== undefined) {
            this._s = data.data.s;
        }
    }
    
    // ========================= 地块特有方法 =========================

    /**
     * 获取Tile ID
     */
    public getTileId(): number {
        return this._tileId;
    }

    /**
     * 设置Tile ID
     */
    public setTileId(id: number): void {
        this._tileId = id;
    }

    /**
     * 获取关联的建筑ID
     */
    public getBuildingId(): number {
        return this._buildingId;
    }

    /**
     * 设置关联的建筑ID
     */
    public setBuildingId(id: number): void {
        this._buildingId = id;
    }

    /**
     * 获取west方向邻居tile ID
     */
    public getW(): number {
        return this._w;
    }

    /**
     * 设置west方向邻居tile ID
     */
    public setW(id: number): void {
        this._w = id;
    }

    /**
     * 获取north方向邻居tile ID
     */
    public getN(): number {
        return this._n;
    }

    /**
     * 设置north方向邻居tile ID
     */
    public setN(id: number): void {
        this._n = id;
    }

    /**
     * 获取east方向邻居tile ID
     */
    public getE(): number {
        return this._e;
    }

    /**
     * 设置east方向邻居tile ID
     */
    public setE(id: number): void {
        this._e = id;
    }

    /**
     * 获取south方向邻居tile ID
     */
    public getS(): number {
        return this._s;
    }

    /**
     * 设置south方向邻居tile ID
     */
    public setS(id: number): void {
        this._s = id;
    }

    /**
     * 获取地块信息（用于UI显示）
     */
    public getTileInfo(): any {
        return {
            blockId: this._blockId,
            typeId: this._typeId,
            position: { x: this._gridPosition.x, z: this._gridPosition.y },
            typeName: this.getTypeName(),
            tileId: this._tileId,
            buildingId: this._buildingId
        };
    }
    
    /**
     * 获取类型名称
     */
    private getTypeName(): string {
        switch (this._typeId) {
            case Web3TileType.EMPTY_LAND: return '空地';
            case Web3TileType.LOTTERY: return '乐透';
            case Web3TileType.HOSPITAL: return '医院';
            case Web3TileType.CHANCE: return '机会';
            case Web3TileType.BONUS: return '奖励';
            case Web3TileType.FEE: return '收费站';
            case Web3TileType.CARD: return '卡片站';
            case Web3TileType.NEWS: return '新闻站';
            default: return '未知';
        }
    }
}
