/**
 * GameBuilding 类 - 游戏中的逻辑 Building
 *
 * 对应数据：BuildingStatic (template) + Building (game) 的合并
 *
 * 职责：
 * - 存储 building 的逻辑数据（静态+动态）
 * - 提供游戏逻辑方法（租金计算、升级判断等）
 * - 不包含 Cocos 渲染相关代码
 *
 * 与 MapBuilding 的关系：
 * - GameBuilding：逻辑层，纯数据和逻辑
 * - MapBuilding：渲染层，Cocos Component
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import type { Building } from '../../sui/types/game';
import type { BuildingStatic, MapTemplate } from '../../sui/types/map';
import { BuildingSize, BuildingType, NO_OWNER, INVALID_TILE_ID } from '../../sui/types/constants';
import { Web3BuildingType } from '../../voxel/Web3BlockTypes';
import { GameData } from '../../sui/models/GameData';
import type { Player } from '../../role/Player';
import { Vec3 } from 'cc';

/**
 * GameBuilding 类
 * 游戏中的逻辑 Building 实例
 */
export class GameBuilding {

    // ========================= 唯一标识 =========================

    /** Building ID（在 vector 中的索引） */
    public readonly buildingId: number;

    // ========================= 静态数据（来自 BuildingStatic） =========================

    /** X 坐标 */
    public readonly x: number;

    /** Y 坐标（对应 Cocos 的 z） */
    public readonly y: number;

    /** 建筑尺寸（1x1 或 2x2） */
    public readonly size: 1 | 2;

    /** 购买价格 */
    public readonly price: bigint;

    /** 前一个连街建筑 ID（只对 1x1 有效） */
    public readonly chainPrevId: number;

    /** 后一个连街建筑 ID（只对 1x1 有效） */
    public readonly chainNextId: number;

    // ========================= 动态数据（来自 Building） =========================

    /** 拥有者玩家索引（255=无主） */
    public readonly owner: number;

    /** 建筑等级（0-5） */
    public readonly level: number;

    /** 建筑类型（BUILDING_NONE/TEMPLE/RESEARCH等） */
    public readonly buildingType: number;

    // ========================= 客户端维护数据（非readonly）=========================

    /** 原始拥有者（用于无主建筑的prefab选择） */
    public originalOwner: number = NO_OWNER;

    // ========================= 计算数据（客户端需要） =========================

    /** Block ID（用于渲染） */
    public readonly blockId: string;

    /** 朝向（0-3：南东北西） */
    public readonly direction: number;

    /** 入口 tile IDs（最多 2 个） */
    public readonly entranceTileIds: [number, number];

    // ========================= 构造函数 =========================

    constructor(
        buildingId: number,
        x: number,
        y: number,
        size: 1 | 2,
        price: bigint,
        chainPrevId: number,
        chainNextId: number,
        owner: number,
        level: number,
        buildingType: number,
        blockId: string,
        direction: number,
        entranceTileIds: [number, number]
    ) {
        this.buildingId = buildingId;
        this.x = x;
        this.y = y;
        this.size = size;
        this.price = price;
        this.chainPrevId = chainPrevId;
        this.chainNextId = chainNextId;
        this.owner = owner;
        this.level = level;
        this.buildingType = buildingType;
        this.blockId = blockId;
        this.direction = direction;
        this.entranceTileIds = entranceTileIds;

        // 初始化 originalOwner 为当前 owner
        this.originalOwner = owner;
    }

    // ========================= 静态工厂方法 =========================

    /**
     * 合并 BuildingStatic + Building 创建 GameBuilding
     * @param buildingStatic Move 端的 BuildingStatic 数据
     * @param building Move 端的 Building 数据
     * @param buildingId Building 在 vector 中的索引
     * @param template MapTemplate（用于计算 direction 和 entranceTileIds）
     */
    public static merge(
        buildingStatic: BuildingStatic,
        building: Building,
        buildingId: number,
        template: MapTemplate
    ): GameBuilding {
        // 计算入口 tiles
        const entranceTileIds = this.calculateEntranceTileIds(buildingId, template);

        // 计算朝向
        const direction = this.calculateDirection(
            { x: buildingStatic.x, y: buildingStatic.y },
            entranceTileIds[0],
            template
        );

        // 计算 blockId
        const blockId = this.getBuildingBlockId(buildingStatic.size, building.building_type);

        return new GameBuilding(
            buildingId,
            buildingStatic.x,
            buildingStatic.y,
            buildingStatic.size as (1 | 2),
            buildingStatic.price,
            buildingStatic.chain_prev_id,
            buildingStatic.chain_next_id,
            building.owner,
            building.level,
            building.building_type,
            blockId,
            direction,
            entranceTileIds
        );
    }

    // ========================= 游戏逻辑方法 =========================

    /**
     * 是否有主人
     */
    public isOwned(): boolean {
        return this.owner !== NO_OWNER;
    }

    /**
     * 获取拥有者玩家
     */
    public getOwnerPlayer(players: Player[]): Player | null {
        if (!this.isOwned()) return null;
        return players.find(p => p.getPlayerIndex() === this.owner) || null;
    }

    /**
     * 是否可以升级
     */
    public canUpgrade(): boolean {
        return this.isOwned() && this.level < 5;
    }

    /**
     * 获取下一级升级成本
     */
    public getNextUpgradeCost(gameData: GameData): number {
        if (!this.canUpgrade()) return 0;

        if (this.size === BuildingSize.SIZE_1X1) {
            return gameData.getBuildingUpgradeCost(this.level);
        } else {
            return gameData.getLargeBuildingCost(this.level + 1);
        }
    }

    /**
     * 计算租金
     * @param gameData GameData 配置
     * @param templeLevels 拥有者的土地庙等级列表（用于加成）
     */
    public calculateRent(gameData: GameData, templeLevels: number[]): bigint {
        // 如果无主，租金为 0
        if (!this.isOwned()) return BigInt(0);

        // 基础租金 = price × rent_multiplier
        const rentMultiplier = gameData.getRentMultiplier(this.level);
        let rent = this.price * BigInt(rentMultiplier) / BigInt(100);

        // 土地庙加成（只对小建筑有效）
        if (this.size === BuildingSize.SIZE_1X1 && templeLevels.length > 0) {
            // 使用最高等级的土地庙
            const maxTempleLevel = Math.max(...templeLevels);
            const templeMultiplier = gameData.getTempleMultiplier(maxTempleLevel);
            rent = rent * BigInt(templeMultiplier) / BigInt(100);
        }

        // TODO: 连街加成（需要遍历 chainPrevId/chainNextId）

        return rent;
    }

    /**
     * 是否为大建筑（2x2）
     */
    public isLargeBuilding(): boolean {
        return this.size === BuildingSize.SIZE_2X2;
    }

    /**
     * 是否有建筑类型
     */
    public hasBuildingType(): boolean {
        return this.buildingType !== BuildingType.NONE;
    }

    /**
     * 获取建筑类型名称
     */
    public getBuildingTypeName(): string {
        return getBuildingTypeName(this.buildingType);
    }

    /**
     * 获取位置（Cocos 坐标）
     */
    public getPosition(): { x: number; z: number } {
        return { x: this.x, z: this.y };
    }

    // ========================= 渲染配置方法 =========================

    /**
     * 获取建筑 Prefab 路径
     * @returns Prefab 资源路径（用于 resources.load）
     */
    public getPrefabPath(): string {
        // 确定使用的 owner index
        let ownerIndex = this.owner;
        if (ownerIndex === NO_OWNER) {
            ownerIndex = this.originalOwner !== NO_OWNER ? this.originalOwner : 0;
        }

        if (this.size === BuildingSize.SIZE_1X1) {
            // 1x1 建筑：始终使用 owner 对应的 prefab
            return `prefabs/building/${ownerIndex}`;
        } else {
            // 2x2 建筑
            if (this.level === 0 || this.buildingType === BuildingType.NONE) {
                // Level 0 或无类型：使用 1x1 的 prefab（按owner颜色）
                return `prefabs/building/${ownerIndex}`;
            } else {
                // Level 1+ 且有类型：使用类型对应的 prefab
                const typeName = this.getBuildingTypePrefabName();
                return `prefabs/building/${typeName}`;
            }
        }
    }

    /**
     * 获取建筑类型对应的 prefab 名称
     */
    private getBuildingTypePrefabName(): string {
        switch (this.buildingType) {
            case BuildingType.TEMPLE: return 'temple';
            case BuildingType.RESEARCH: return 'research';
            case BuildingType.OIL: return 'oil';
            case BuildingType.COMMERCIAL: return 'commercial';
            case BuildingType.HOTEL: return 'hotel';
            default: return 'temple'; // 默认
        }
    }

    /**
     * 获取等级对应的 scale 值
     * Level 0-4 对应 1.0, 1.1, 1.2, 1.3, 1.4
     */
    public getLevelScale(): number {
        return 1.0 + (this.level * 0.1);
    }

    /**
     * 获取等级对应的颜色调整因子（在色系内调整亮度）
     * Level 0-4 对应 0.8, 0.9, 1.0, 1.1, 1.2
     */
    public getLevelColorFactor(): number {
        return 0.8 + (this.level * 0.1);
    }

    /**
     * 是否需要显示 prefab
     * - 有主人即显示（包括空地Lv0）
     * - 无主但有originalOwner也显示（破产后的建筑）
     */
    public shouldShowPrefab(): boolean {
        return this.isOwned() || this.originalOwner !== NO_OWNER;
    }

    /**
     * 获取 Actor 节点的世界位置（Y在block顶部）
     * @returns 世界坐标（Y=1.0）
     */
    public getActorPosition(): Vec3 {

        if (this.size === BuildingSize.SIZE_1X1) {
            // 1x1: 中心在 (x+0.5, 1.0, y+0.5)
            return new Vec3(this.x + 0.5, 1.0, this.y + 0.5);
        } else {
            // 2x2: 中心在 (x+1, 1.0, y+1)
            return new Vec3(this.x + 1, 1.0, this.y + 1);
        }
    }

    // ========================= 私有静态方法（计算） =========================

    /**
     * 计算入口 tile IDs
     */
    private static calculateEntranceTileIds(
        buildingId: number,
        template: MapTemplate
    ): [number, number] {
        const entrances: number[] = [];

        // 遍历所有 tiles，找到 building_id 匹配的
        template.tiles_static.forEach((tile, tileId) => {
            if (tile.building_id === buildingId) {
                entrances.push(tileId);
            }
        });

        // 最多 2 个入口
        if (entrances.length === 0) {
            console.warn(`[GameBuilding] Building ${buildingId} has no entrance tiles`);
            return [INVALID_TILE_ID, INVALID_TILE_ID];
        } else if (entrances.length === 1) {
            return [entrances[0], INVALID_TILE_ID];
        } else {
            return [entrances[0], entrances[1]];
        }
    }

    /**
     * 计算建筑朝向
     * 根据建筑和第一个入口 tile 的相对位置
     */
    private static calculateDirection(
        buildingPos: { x: number; y: number },
        entranceTileId: number,
        template: MapTemplate
    ): number {
        if (entranceTileId === INVALID_TILE_ID) return 0;

        const entranceTile = template.tiles_static.get(entranceTileId);
        if (!entranceTile) return 0;

        // 计算相对位置
        const dx = entranceTile.x - buildingPos.x;
        const dz = entranceTile.y - buildingPos.y;

        // 根据相对位置判断朝向
        // direction: 0=南(+z), 1=东(+x), 2=北(-z), 3=西(-x)
        if (Math.abs(dz) > Math.abs(dx)) {
            return dz > 0 ? 0 : 2;  // 南 或 北
        } else {
            return dx > 0 ? 1 : 3;  // 东 或 西
        }
    }

    /**
     * 根据 size 和 building_type 获取 blockId
     */
    private static getBuildingBlockId(size: number, buildingType: number): string {
        if (size === BuildingSize.SIZE_1X1) {
            return 'web3:building_1x1';
        } else if (size === BuildingSize.SIZE_2X2) {
            // 2x2 建筑根据类型返回不同 block
            // 目前统一使用 building_2x2
            return 'web3:building_2x2';
        } else {
            console.warn(`[GameBuilding] Unknown building size: ${size}`);
            return 'web3:building_1x1';
        }
    }

    // ========================= 调试方法 =========================

    /**
     * 调试输出
     */
    public debugInfo(): string {
        return JSON.stringify({
            buildingId: this.buildingId,
            position: { x: this.x, y: this.y },
            size: this.size === 1 ? '1x1' : '2x2',
            owner: this.owner !== NO_OWNER ? this.owner : 'none',
            level: this.level,
            buildingType: this.getBuildingTypeName(),
            price: this.price.toString(),
            direction: this.direction,
            entranceTileIds: this.entranceTileIds,
            chainPrev: this.chainPrevId !== INVALID_TILE_ID ? this.chainPrevId : 'none',
            chainNext: this.chainNextId !== INVALID_TILE_ID ? this.chainNextId : 'none'
        }, null, 2);
    }
}

/**
 * 获取建筑类型名称
 */
function getBuildingTypeName(buildingType: number): string {
    switch (buildingType) {
        case BuildingType.NONE: return '无类型';
        case BuildingType.TEMPLE: return '土地庙';
        case BuildingType.RESEARCH: return '研究所';
        case BuildingType.OIL: return '石油公司';
        case BuildingType.COMMERCIAL: return '商业中心';
        case BuildingType.HOTEL: return '大饭店';
        default: return `未知(${buildingType})`;
    }
}
