/**
 * PriceCalculator - 价格计算工具类
 *
 * ==================== 重要：与Move端同步 ====================
 * 此文件中的计算逻辑必须与 move/tycoon/sources/game.move 保持完全一致！
 *
 * 对应的Move端函数：
 * - calculatePriceIndex() → calculate_price_index() (game.move:2625-2629)
 * - calculatePriceFactor() → calculate_price_factor() (game.move:2750-2755)
 * - calculateSingleTileRent() → calculate_single_tile_rent() (game.move:2634-2649)
 * - calculateTempleBonus() → calculate_temple_bonus() (game.move:2653-2673)
 * - calculateToll() → calculate_toll() (game.move:2681-2725)
 * - calculateBuildingPrice() → calculate_building_price() (game.move:2760-2830)
 *
 * **修改Move端价格算法时，必须同步更新此文件！**
 * ===========================================================
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import type { GameSession } from '../core/GameSession';
import type { GameBuilding } from '../game/models/GameBuilding';
import { BuildingType, NO_OWNER, INVALID_TILE_ID } from '../sui/types/constants';

/** 默认配置常量（与tycoon.move一致） */
const DEFAULT_RENT_MULTIPLIERS = [50, 100, 250, 500, 1000, 1500];  // L0-L5
const DEFAULT_TEMPLE_MULTIPLIERS = [130, 140, 150, 170, 200];      // L1-L5
const DEFAULT_UPGRADE_COSTS = [0, 1000, 1500, 6000, 15000, 35000]; // L0-L5
const DEFAULT_LARGE_BUILDING_COSTS = [2000, 3000, 7000, 18000, 40000]; // L1-L5
const MAX_LEVEL = 4;

/**
 * 价格计算工具类
 */
export class PriceCalculator {

    // ========================= 基础计算 =========================

    /**
     * 计算物价指数
     * 公式：I = floor(round / priceRiseDays) + 1
     *
     * @param round 当前轮次
     * @param priceRiseDays 物价上涨周期
     * @returns 物价指数
     */
    static calculatePriceIndex(round: number, priceRiseDays: number): number {
        const indexLevel = Math.floor(round / priceRiseDays);
        return indexLevel + 1;
    }

    /**
     * 计算物价系数
     * 公式：F = I × 20
     *
     * @param round 当前轮次
     * @param priceRiseDays 物价上涨周期
     * @returns 物价系数
     */
    static calculatePriceFactor(round: number, priceRiseDays: number): number {
        const priceIndex = this.calculatePriceIndex(round, priceRiseDays);
        return priceIndex * 20;
    }

    // ========================= 租金计算 =========================

    /**
     * 计算单块地的基础租金
     * 公式：rent = (price × rentMultiplier × priceIndex) / 100
     * 注：rentMultiplier 以 ×100 存储（如 0.5→50, 1→100），所以需要 /100 还原
     *
     * @param price 建筑基础价格
     * @param level 建筑等级
     * @param priceIndex 物价指数
     * @param rentMultipliers 租金倍率表（默认使用DEFAULT）
     * @returns 基础租金
     */
    static calculateSingleTileRent(
        price: bigint,
        level: number,
        priceIndex: number,
        rentMultipliers: number[] = DEFAULT_RENT_MULTIPLIERS
    ): bigint {
        const multiplier = level < rentMultipliers.length
            ? rentMultipliers[level]
            : 100;

        // (price × multiplier × priceIndex) / 100
        return (price * BigInt(multiplier) * BigInt(priceIndex)) / BigInt(100);
    }

    /**
     * 计算土地庙加成（分别相加模式）
     * 多个土地庙不是连乘，而是各自计算加成后相加
     *
     * @param baseRent 基础租金
     * @param templeLevels 拥有者的土地庙等级列表
     * @param templeMultipliers 土地庙倍率表（默认使用DEFAULT）
     * @returns 土地庙加成金额
     */
    static calculateTempleBonus(
        baseRent: bigint,
        templeLevels: number[],
        templeMultipliers: number[] = DEFAULT_TEMPLE_MULTIPLIERS
    ): bigint {
        let bonus = BigInt(0);

        for (const level of templeLevels) {
            if (level > 0 && level <= templeMultipliers.length) {
                const multiplier = templeMultipliers[level - 1];
                const templeBonus = (baseRent * BigInt(multiplier)) / BigInt(100);
                bonus += templeBonus;
            }
        }

        return bonus;
    }

    /**
     * 获取连街建筑ID列表
     * 遍历 chainPrevId 和 chainNextId 找出同主人的相邻建筑
     *
     * @param building 起始建筑
     * @param session 游戏会话
     * @returns 连街建筑ID列表（包含起始建筑）
     */
    static getChainBuildings(
        building: GameBuilding,
        session: GameSession
    ): number[] {
        const chainIds: number[] = [building.buildingId];

        // 只有1x1建筑才有连街
        if (building.size !== 1) {
            return chainIds;
        }

        const owner = building.owner;
        if (owner === NO_OWNER) {
            return chainIds;
        }

        const buildings = session.getBuildings();
        const visited = new Set<number>([building.buildingId]);

        // 向前遍历
        let currentId = building.chainPrevId;
        while (currentId !== INVALID_TILE_ID && !visited.has(currentId)) {
            const current = buildings[currentId];
            if (!current || current.owner !== owner) break;

            visited.add(currentId);
            chainIds.unshift(currentId);  // 加到前面
            currentId = current.chainPrevId;
        }

        // 向后遍历
        currentId = building.chainNextId;
        while (currentId !== INVALID_TILE_ID && !visited.has(currentId)) {
            const current = buildings[currentId];
            if (!current || current.owner !== owner) break;

            visited.add(currentId);
            chainIds.push(currentId);  // 加到后面
            currentId = current.chainNextId;
        }

        return chainIds;
    }

    /**
     * 查找玩家拥有的土地庙等级列表
     *
     * @param session 游戏会话
     * @param ownerIndex 玩家索引
     * @returns 土地庙等级列表
     */
    static findOwnerTempleLevels(session: GameSession, ownerIndex: number): number[] {
        const templeLevels: number[] = [];
        const buildings = session.getBuildings();

        for (const building of buildings) {
            if (building.owner === ownerIndex &&
                building.buildingType === BuildingType.TEMPLE &&
                building.level > 0) {
                templeLevels.push(building.level);
            }
        }

        return templeLevels;
    }

    /**
     * 计算完整租金（含连街和土地庙加成）
     *
     * @param building 踩到的建筑
     * @param session 游戏会话
     * @returns 完整租金
     */
    static calculateToll(building: GameBuilding, session: GameSession): bigint {
        const owner = building.owner;
        if (owner === NO_OWNER) return BigInt(0);

        const round = session.getRound();
        const priceRiseDays = session.getPriceRiseDays();
        const priceIndex = this.calculatePriceIndex(round, priceRiseDays);

        // 获取配置
        const gameData = session.getGameData();
        const rentMultipliers = gameData?.rentMultipliers || DEFAULT_RENT_MULTIPLIERS;
        const templeMultipliers = gameData?.templeMultipliers || DEFAULT_TEMPLE_MULTIPLIERS;

        // 获取连街建筑
        const chainBuildingIds = this.getChainBuildings(building, session);

        // 获取土地庙等级
        const templeLevels = this.findOwnerTempleLevels(session, owner);

        // 累计租金
        let totalRent = BigInt(0);
        const buildings = session.getBuildings();

        for (const bId of chainBuildingIds) {
            const b = buildings[bId];
            if (!b) continue;

            // 计算基础租金
            const baseRent = this.calculateSingleTileRent(
                b.price,
                b.level,
                priceIndex,
                rentMultipliers
            );

            // 计算土地庙加成
            const templeBonus = this.calculateTempleBonus(
                baseRent,
                templeLevels,
                templeMultipliers
            );

            totalRent += baseRent + templeBonus;
        }

        return totalRent;
    }

    // ========================= 购买/升级价格计算 =========================

    /**
     * 计算建筑购买/升级价格
     *
     * @param building 建筑
     * @param targetLevel 目标等级
     * @param session 游戏会话
     * @returns 价格（0表示不可升级）
     */
    static calculateBuildingPrice(
        building: GameBuilding,
        targetLevel: number,
        session: GameSession
    ): bigint {
        const currentLevel = building.level;

        if (targetLevel <= currentLevel) return BigInt(0);

        const round = session.getRound();
        const priceRiseDays = session.getPriceRiseDays();
        const priceFactor = this.calculatePriceFactor(round, priceRiseDays);

        // 获取配置
        const gameData = session.getGameData();
        const upgradeCosts = gameData?.buildingUpgradeCosts || DEFAULT_UPGRADE_COSTS;
        const largeBuildingCosts = gameData?.largeBuildingCosts || DEFAULT_LARGE_BUILDING_COSTS;

        if (building.size === 1) {
            // 1x1 建筑
            const basePrice = building.price;

            const currentCost = currentLevel < upgradeCosts.length
                ? BigInt(upgradeCosts[currentLevel])
                : BigInt(0);

            const targetCost = targetLevel < upgradeCosts.length
                ? BigInt(upgradeCosts[targetLevel])
                : BigInt(0);

            if (targetCost === BigInt(0)) return BigInt(0);

            // 当前等级总价
            const currentTotal = ((basePrice + currentCost) * BigInt(priceFactor)) / BigInt(100);

            // 目标等级总价
            const targetTotal = ((basePrice + targetCost) * BigInt(priceFactor)) / BigInt(100);

            return targetTotal > currentTotal ? targetTotal - currentTotal : BigInt(0);

        } else {
            // 2x2 建筑
            // 土地庙升级到L1后不能继续升级
            if (building.buildingType === BuildingType.TEMPLE && currentLevel > 0) {
                return BigInt(0);
            }

            const currentIdx = currentLevel > 0 ? currentLevel - 1 : 0;
            const targetIdx = targetLevel - 1;

            const currentCost = currentLevel > 0 && currentIdx < largeBuildingCosts.length
                ? BigInt(largeBuildingCosts[currentIdx])
                : BigInt(0);

            const targetCost = targetIdx < largeBuildingCosts.length
                ? BigInt(largeBuildingCosts[targetIdx])
                : BigInt(0);

            if (targetCost === BigInt(0)) return BigInt(0);

            const upgradeDiff = targetCost > currentCost
                ? targetCost - currentCost
                : targetCost;

            return (upgradeDiff * BigInt(priceFactor)) / BigInt(100);
        }
    }

    /**
     * 计算购买空地价格（L0→L1）
     *
     * @param building 建筑
     * @param session 游戏会话
     * @returns 购买价格
     */
    static calculateBuyPrice(building: GameBuilding, session: GameSession): bigint {
        return this.calculateBuildingPrice(building, 1, session);
    }

    /**
     * 计算升级价格（当前等级→下一等级）
     *
     * @param building 建筑
     * @param session 游戏会话
     * @returns 升级价格（0表示已满级或不可升级）
     */
    static calculateUpgradePrice(building: GameBuilding, session: GameSession): bigint {
        const currentLevel = building.level;

        // 已满级
        if (currentLevel >= MAX_LEVEL) return BigInt(0);

        return this.calculateBuildingPrice(building, currentLevel + 1, session);
    }

    /**
     * 判断建筑是否可升级
     *
     * @param building 建筑
     * @returns 是否可升级
     */
    static canUpgrade(building: GameBuilding): boolean {
        // 满级不可升
        if (building.level >= MAX_LEVEL) return false;

        // 土地庙L1后不可升
        if (building.size === 2 &&
            building.buildingType === BuildingType.TEMPLE &&
            building.level > 0) {
            return false;
        }

        return true;
    }

    // ========================= 特殊地块计算 =========================

    /**
     * 计算特殊地块金额（奖励/费用）
     * 公式：amount = baseAmount × priceIndex
     *
     * @param baseAmount 基础金额（tile.special，bigint 类型）
     * @param session 游戏会话
     * @returns 实际金额
     */
    static calculateSpecialTileAmount(baseAmount: bigint, session: GameSession): bigint {
        const round = session.getRound();
        const priceRiseDays = session.getPriceRiseDays();
        const priceIndex = this.calculatePriceIndex(round, priceRiseDays);

        return baseAmount * BigInt(priceIndex);
    }

    // ========================= 格式化方法 =========================

    /**
     * 格式化金额（带千位分隔符）
     *
     * @param amount 金额
     * @returns 格式化字符串
     */
    static formatAmount(amount: bigint): string {
        return amount.toLocaleString();
    }

    /**
     * 格式化简短金额（K/M表示）
     *
     * @param amount 金额
     * @returns 简短格式字符串
     */
    static formatShortAmount(amount: bigint): string {
        const num = Number(amount);
        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(1)}M`;
        } else if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K`;
        }
        return num.toString();
    }
}
