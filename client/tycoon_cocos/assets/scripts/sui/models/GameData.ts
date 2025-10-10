/**
 * GameData 模型类
 * 对应 Move 端的 tycoon::GameData 结构
 *
 * 职责：
 * - 存储全局游戏配置和策划数据
 * - 管理 MapRegistry 和 CardRegistry
 * - 提供数值配置访问（租金倍率、升级价格等）
 *
 * Move源文件: move/tycoon/sources/tycoon.move
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { MapRegistry } from './MapRegistry';
import { CardRegistry } from './CardRegistry';

/**
 * GameData 类
 * 对应 Move 的 tycoon::GameData 结构
 */
export class GameData {

    // ========================= Move 端对应字段 =========================

    /** GameData 对象 ID */
    public readonly id: string;

    /** 地图注册表 */
    public readonly mapRegistry: MapRegistry;

    /** 卡牌注册表 */
    public readonly cardRegistry: CardRegistry;

    // drop_config 跳过不解析

    // ========================= 数值配置 =========================

    /** 起始现金 */
    public readonly startingCash: bigint;

    /**
     * 小地产租金倍率（×100 存储）
     * [L0空地, L1, L2, L3, L4, L5]
     * 对应倍率：[0.5, 1, 2.5, 5, 10, 15]
     */
    public readonly rentMultipliers: number[];

    /**
     * 土地庙加成倍率（×100 存储）
     * [1级, 2级, 3级, 4级, 5级]
     * 对应倍率：[1.3, 1.4, 1.5, 1.7, 2.0]
     */
    public readonly templeMultipliers: number[];

    /**
     * 小建筑升级价格表
     * [L0, L1, L2, L3, L4, L5]
     */
    public readonly buildingUpgradeCosts: number[];

    /**
     * 大建筑升级价格
     * [L1, L2, L3, L4, L5]
     */
    public readonly largeBuildingCosts: number[];

    /** NPC 生成权重配置 */
    public readonly npcSpawnWeights: number[];

    /** 地图 schema 版本 */
    public readonly mapSchemaVersion: number;

    // ========================= 构造函数 =========================

    constructor(
        id: string,
        mapRegistry: MapRegistry,
        cardRegistry: CardRegistry,
        startingCash: bigint,
        rentMultipliers: number[],
        templeMultipliers: number[],
        buildingUpgradeCosts: number[],
        largeBuildingCosts: number[],
        npcSpawnWeights: number[],
        mapSchemaVersion: number
    ) {
        this.id = id;
        this.mapRegistry = mapRegistry;
        this.cardRegistry = cardRegistry;
        this.startingCash = startingCash;
        this.rentMultipliers = rentMultipliers;
        this.templeMultipliers = templeMultipliers;
        this.buildingUpgradeCosts = buildingUpgradeCosts;
        this.largeBuildingCosts = largeBuildingCosts;
        this.npcSpawnWeights = npcSpawnWeights;
        this.mapSchemaVersion = mapSchemaVersion;
    }

    // ========================= 静态工厂方法 =========================

    /**
     * 从 Move fields 加载 GameData
     * @param fields Move 端的 GameData 对象字段
     */
    public static loadFromFields(fields: any): GameData {
        console.log('[GameData] 从 fields 加载数据', fields);

        const id = fields.id?.id || fields.id || '';

        // 解析嵌套的注册表
        const mapRegistry = MapRegistry.loadFromFields(
            fields.map_registry?.fields || fields.map_registry
        );

        const cardRegistry = CardRegistry.loadFromFields(
            fields.card_registry?.fields || fields.card_registry
        );

        // 解析数值配置
        const startingCash = BigInt(fields.starting_cash || 0);
        const rentMultipliers = this.parseNumberArray(fields.rent_multipliers);
        const templeMultipliers = this.parseNumberArray(fields.temple_multipliers);
        const buildingUpgradeCosts = this.parseNumberArray(fields.building_upgrade_costs);
        const largeBuildingCosts = this.parseNumberArray(fields.large_building_costs);
        const npcSpawnWeights = this.parseNumberArray(fields.npc_spawn_weights);
        const mapSchemaVersion = Number(fields.map_schema_version || 1);

        console.log('[GameData] 数据加载完成', {
            startingCash: startingCash.toString(),
            mapTemplates: mapRegistry.getTemplateCount(),
            cards: cardRegistry.getCardCount(),
            mapSchemaVersion
        });

        return new GameData(
            id,
            mapRegistry,
            cardRegistry,
            startingCash,
            rentMultipliers,
            templeMultipliers,
            buildingUpgradeCosts,
            largeBuildingCosts,
            npcSpawnWeights,
            mapSchemaVersion
        );
    }

    /**
     * 解析数字数组
     */
    private static parseNumberArray(data: any): number[] {
        if (!Array.isArray(data)) {
            return [];
        }
        return data.map(v => Number(v));
    }

    // ========================= 租金倍率相关 =========================

    /**
     * 获取指定等级的租金倍率
     * @param level 建筑等级（0-5）
     * @returns 倍率（已经是 ×100 的值，如 250 表示 2.5 倍）
     */
    public getRentMultiplier(level: number): number {
        if (level >= 0 && level < this.rentMultipliers.length) {
            return this.rentMultipliers[level];
        }
        return 100; // 默认 1.0 倍
    }

    /**
     * 获取实际租金倍率（转换为小数）
     * @param level 建筑等级（0-5）
     * @returns 实际倍率（如 2.5）
     */
    public getRentMultiplierActual(level: number): number {
        return this.getRentMultiplier(level) / 100;
    }

    /**
     * 获取所有租金倍率
     */
    public getAllRentMultipliers(): number[] {
        return [...this.rentMultipliers];
    }

    // ========================= 土地庙加成相关 =========================

    /**
     * 获取指定等级的土地庙加成倍率
     * @param level 土地庙等级（1-5）
     * @returns 倍率（×100，如 130 表示 1.3 倍）
     */
    public getTempleMultiplier(level: number): number {
        const index = level - 1; // level 从 1 开始，数组从 0 开始
        if (index >= 0 && index < this.templeMultipliers.length) {
            return this.templeMultipliers[index];
        }
        return 100; // 默认 1.0 倍（无加成）
    }

    /**
     * 获取实际土地庙加成倍率（转换为小数）
     */
    public getTempleMultiplierActual(level: number): number {
        return this.getTempleMultiplier(level) / 100;
    }

    /**
     * 获取所有土地庙加成倍率
     */
    public getAllTempleMultipliers(): number[] {
        return [...this.templeMultipliers];
    }

    // ========================= 升级价格相关 =========================

    /**
     * 获取小建筑升级价格
     * @param level 当前等级（0-5）
     * @returns 升级到下一级的价格
     */
    public getBuildingUpgradeCost(level: number): number {
        if (level >= 0 && level < this.buildingUpgradeCosts.length) {
            return this.buildingUpgradeCosts[level];
        }
        return 0;
    }

    /**
     * 获取大建筑升级价格
     * @param level 目标等级（1-5）
     * @returns 升级价格
     */
    public getLargeBuildingCost(level: number): number {
        const index = level - 1; // level 从 1 开始
        if (index >= 0 && index < this.largeBuildingCosts.length) {
            return this.largeBuildingCosts[index];
        }
        return 0;
    }

    /**
     * 获取所有小建筑升级价格
     */
    public getAllBuildingUpgradeCosts(): number[] {
        return [...this.buildingUpgradeCosts];
    }

    /**
     * 获取所有大建筑升级价格
     */
    public getAllLargeBuildingCosts(): number[] {
        return [...this.largeBuildingCosts];
    }

    // ========================= NPC 配置相关 =========================

    /**
     * 获取 NPC 生成权重
     */
    public getNpcSpawnWeights(): number[] {
        return [...this.npcSpawnWeights];
    }

    /**
     * 获取指定索引的 NPC 权重
     */
    public getNpcWeightAt(index: number): number {
        if (index >= 0 && index < this.npcSpawnWeights.length) {
            return this.npcSpawnWeights[index];
        }
        return 0;
    }

    // ========================= 访问器 =========================

    public getId(): string { return this.id; }
    public getMapRegistry(): MapRegistry { return this.mapRegistry; }
    public getCardRegistry(): CardRegistry { return this.cardRegistry; }
    public getStartingCash(): bigint { return this.startingCash; }
    public getMapSchemaVersion(): number { return this.mapSchemaVersion; }

    // ========================= 调试方法 =========================

    /**
     * 打印完整配置
     */
    public printConfig(): void {
        console.log('=== GameData 配置 ===');
        console.log(`ID: ${this.id}`);
        console.log(`起始现金: ${this.startingCash.toString()}`);
        console.log(`地图模板数: ${this.mapRegistry.getTemplateCount()}`);
        console.log(`卡牌数: ${this.cardRegistry.getCardCount()}`);
        console.log(`Schema 版本: ${this.mapSchemaVersion}`);
        console.log('租金倍率:', this.rentMultipliers.map((v, i) => `L${i}=${v/100}`));
        console.log('土地庙倍率:', this.templeMultipliers.map((v, i) => `${i+1}级=${v/100}`));
        console.log('====================');
    }

    /**
     * 调试输出
     */
    public debugInfo(): string {
        return JSON.stringify({
            id: this.id,
            startingCash: this.startingCash.toString(),
            mapSchemaVersion: this.mapSchemaVersion,
            mapTemplateCount: this.mapRegistry.getTemplateCount(),
            cardCount: this.cardRegistry.getCardCount(),
            rentMultipliers: this.rentMultipliers,
            templeMultipliers: this.templeMultipliers,
            buildingUpgradeCosts: this.buildingUpgradeCosts,
            largeBuildingCosts: this.largeBuildingCosts,
            npcSpawnWeightsLength: this.npcSpawnWeights.length
        }, null, 2);
    }
}
