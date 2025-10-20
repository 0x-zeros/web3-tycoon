/**
 * GameTile 类 - 游戏中的逻辑 Tile
 *
 * 对应数据：TileStatic (template) + Tile (game) 的合并
 *
 * 职责：
 * - 存储 tile 的逻辑数据（静态+动态）
 * - 提供游戏逻辑方法（邻居查询、状态判断等）
 * - 不包含 Cocos 渲染相关代码
 *
 * 与 MapTile 的关系：
 * - GameTile：逻辑层，纯数据和逻辑
 * - MapTile：渲染层，Cocos Component
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import type { TileStatic, Tile } from '../../sui/types/game';
import type { MapTemplate } from '../../sui/types/map';
import { TileKind, INVALID_TILE_ID, NO_BUILDING } from '../../sui/types/constants';
import { Web3TileType } from '../../voxel/Web3BlockTypes';
import { Vec3 } from 'cc';

/**
 * GameTile 类
 * 游戏中的逻辑 Tile 实例
 */
export class GameTile {

    // ========================= 唯一标识 =========================

    /** Tile ID（在 vector 中的索引） */
    public readonly tileId: number;

    // ========================= 静态数据（来自 TileStatic） =========================

    /** X 坐标 */
    public readonly x: number;

    /** Y 坐标（对应 Cocos 的 z） */
    public readonly y: number;

    /** Tile 类型（TileKind） */
    public readonly kind: number;

    /** 关联的 building ID（65535=无建筑） */
    public readonly buildingId: number;

    /** 特殊数值（如奖金、罚款金额） */
    public readonly special: bigint;

    /** West 方向邻居 tile ID */
    public readonly w: number;

    /** North 方向邻居 tile ID */
    public readonly n: number;

    /** East 方向邻居 tile ID */
    public readonly e: number;

    /** South 方向邻居 tile ID */
    public readonly s: number;

    // ========================= 动态数据（来自 Tile） =========================

    /** NPC 索引（在 game.npc_on 数组中的索引，65535=无NPC） */
    public readonly npcIndex: number;

    // ========================= 计算数据（客户端需要） =========================

    /** Block ID（用于渲染） */
    public readonly blockId: string;

    /** Type ID（Web3TileType） */
    public readonly typeId: number;

    // ========================= 缓存数据 =========================

    /** Tile 顶部中心点的世界坐标（用于 Player/NPC 放置） */
    private _worldCenter: Vec3 | null = null;

    // ========================= 构造函数 =========================

    constructor(
        tileId: number,
        x: number,
        y: number,
        kind: number,
        buildingId: number,
        special: bigint,
        w: number,
        n: number,
        e: number,
        s: number,
        npcIndex: number,
        blockId: string,
        typeId: number
    ) {
        this.tileId = tileId;
        this.x = x;
        this.y = y;
        this.kind = kind;
        this.buildingId = buildingId;
        this.special = special;
        this.w = w;
        this.n = n;
        this.e = e;
        this.s = s;
        this.npcIndex = npcIndex;
        this.blockId = blockId;
        this.typeId = typeId;
    }

    // ========================= 静态工厂方法 =========================

    /**
     * 合并 TileStatic + Tile 创建 GameTile
     * @param tileStatic Move 端的 TileStatic 数据
     * @param tile Move 端的 Tile 数据
     * @param tileId Tile 在 vector 中的索引
     */
    public static merge(tileStatic: TileStatic, tile: Tile, tileId: number): GameTile {
        // 计算 blockId 和 typeId
        const blockId = this.getTileBlockId(tileStatic.kind);
        const typeId = this.getTileTypeId(tileStatic.kind);

        return new GameTile(
            tileId,
            tileStatic.x,
            tileStatic.y,
            tileStatic.kind,
            tileStatic.building_id,
            tileStatic.special,
            tileStatic.w,
            tileStatic.n,
            tileStatic.e,
            tileStatic.s,
            tile.npc_on,  // NPC 索引
            blockId,
            typeId
        );
    }

    // ========================= 辅助方法 =========================

    /**
     * 是否有关联的 building
     */
    public hasBuilding(): boolean {
        return this.buildingId !== NO_BUILDING;
    }

    /**
     * 是否有 NPC
     */
    public hasNPC(): boolean {
        return this.npcIndex !== INVALID_TILE_ID;
    }

    /**
     * 获取所有邻居（包括无效的）
     */
    public getNeighbors(): number[] {
        return [this.w, this.n, this.e, this.s];
    }

    /**
     * 获取有效的邻居（排除 65535）
     */
    public getValidNeighbors(): number[] {
        const neighbors: number[] = [];
        if (this.w !== INVALID_TILE_ID) neighbors.push(this.w);
        if (this.n !== INVALID_TILE_ID) neighbors.push(this.n);
        if (this.e !== INVALID_TILE_ID) neighbors.push(this.e);
        if (this.s !== INVALID_TILE_ID) neighbors.push(this.s);
        return neighbors;
    }

    /**
     * 获取邻居数量
     */
    public getNeighborCount(): number {
        return this.getValidNeighbors().length;
    }

    /**
     * 获取位置（Cocos 坐标）
     */
    public getPosition(): { x: number; z: number } {
        return { x: this.x, z: this.y };
    }

    /**
     * 获取 Tile 类型名称
     */
    public getKindName(): string {
        return getTileKindName(this.kind);
    }

    /**
     * 设置世界中心点（顶部）
     */
    public setWorldCenter(center: Vec3): void {
        this._worldCenter = center;
    }

    /**
     * 获取世界中心点（顶部）
     */
    public getWorldCenter(): Vec3 | null {
        return this._worldCenter;
    }

    /**
     * 是否为功能型地块（医院、监狱等）
     */
    public isFunctionalTile(): boolean {
        return this.kind === TileKind.HOSPITAL ||
               this.kind === TileKind.LOTTERY ||
               this.kind === TileKind.CHANCE ||
               this.kind === TileKind.BONUS ||
               this.kind === TileKind.FEE ||
               this.kind === TileKind.CARD ||
               this.kind === TileKind.NEWS;
    }

    // ========================= 类型转换（私有静态方法） =========================

    /**
     * Move TileKind → 客户端 blockId
     */
    private static getTileBlockId(kind: number): string {
        switch (kind) {
            case TileKind.EMPTY: return 'web3:empty_land';
            case TileKind.LOTTERY: return 'web3:lottery';
            case TileKind.HOSPITAL: return 'web3:hospital';
            case TileKind.CHANCE: return 'web3:chance';
            case TileKind.BONUS: return 'web3:bonus';
            case TileKind.FEE: return 'web3:fee';
            case TileKind.CARD: return 'web3:card';
            case TileKind.NEWS: return 'web3:news';
            default:
                console.warn(`[GameTile] Unknown tile kind: ${kind}, using empty_land`);
                return 'web3:empty_land';
        }
    }

    /**
     * Move TileKind → Web3TileType
     */
    private static getTileTypeId(kind: number): number {
        switch (kind) {
            case TileKind.EMPTY: return Web3TileType.EMPTY_LAND;
            case TileKind.LOTTERY: return Web3TileType.LOTTERY;
            case TileKind.HOSPITAL: return Web3TileType.HOSPITAL;
            case TileKind.CHANCE: return Web3TileType.CHANCE;
            case TileKind.BONUS: return Web3TileType.BONUS;
            case TileKind.FEE: return Web3TileType.FEE;
            case TileKind.CARD: return Web3TileType.CARD;
            case TileKind.NEWS: return Web3TileType.NEWS;
            default:
                console.warn(`[GameTile] Unknown tile kind: ${kind}, using EMPTY_LAND`);
                return Web3TileType.EMPTY_LAND;
        }
    }

    // ========================= 调试方法 =========================

    /**
     * 调试输出
     */
    public debugInfo(): string {
        return JSON.stringify({
            tileId: this.tileId,
            position: { x: this.x, y: this.y },
            kind: getTileKindName(this.kind),
            buildingId: this.buildingId !== NO_BUILDING ? this.buildingId : 'none',
            neighbors: {
                w: this.w !== INVALID_TILE_ID ? this.w : 'none',
                n: this.n !== INVALID_TILE_ID ? this.n : 'none',
                e: this.e !== INVALID_TILE_ID ? this.e : 'none',
                s: this.s !== INVALID_TILE_ID ? this.s : 'none'
            },
            hasNPC: this.hasNPC(),
            npcIndex: this.npcIndex !== INVALID_TILE_ID ? this.npcIndex : 'none'
        }, null, 2);
    }
}

/**
 * 获取 TileKind 名称
 */
function getTileKindName(kind: number): string {
    switch (kind) {
        case TileKind.EMPTY: return '空地';
        case TileKind.LOTTERY: return '乐透';
        case TileKind.HOSPITAL: return '医院';
        case TileKind.CHANCE: return '机会';
        case TileKind.BONUS: return '奖励';
        case TileKind.FEE: return '收费站';
        case TileKind.CARD: return '卡片站';
        case TileKind.NEWS: return '新闻站';
        default: return `未知(${kind})`;
    }
}
