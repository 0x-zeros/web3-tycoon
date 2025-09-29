/**
 * 特殊格子放置器 - Phase 3
 * 负责在空路径上随机放置特殊格子
 * 纯随机放置，不使用评分系统
 */

import { Vec2 } from 'cc';
import { CoordUtils, TileData } from './MapGeneratorTypes';
import { Web3TileType } from '../../voxel/Web3BlockTypes';

export interface SpecialTilePlacementResult {
  specialTiles: TileData[];
  distribution: Map<string, number>;
  totalPlaced: number;
}

export class SpecialTilePlacer {
  private width: number;
  private height: number;
  private random: () => number;
  private occupiedSet: Set<string>;
  private placedSpecialTiles: TileData[];

  constructor(width: number, height: number, randomFn?: () => number) {
    this.width = width;
    this.height = height;
    this.random = randomFn || Math.random;
    this.occupiedSet = new Set();
    this.placedSpecialTiles = [];
  }

  /**
   * 放置特殊格子（不需要模板）
   */
  placeSpecialTiles(
    emptyTiles: Vec2[],
    occupiedPositions: Vec2[] = []
  ): SpecialTilePlacementResult {

    this.occupiedSet.clear();
    for (const pos of occupiedPositions) {
      this.occupiedSet.add(CoordUtils.posToKey(pos));
    }

    this.placedSpecialTiles = [];

    // 过滤出真正可用的空格子
    const availableTiles = emptyTiles.filter(pos => {
      const key = CoordUtils.posToKey(pos);
      return !this.occupiedSet.has(key);
    });

    // 随机决定特殊格子数量（空格子的10-20%）
    const ratio = 0.1 + this.random() * 0.1;
    const targetCount = Math.floor(availableTiles.length * ratio);

    // 特殊格子类型
    const specialTypes = [
      { type: 'hospital', tileType: Web3TileType.HOSPITAL },
      { type: 'chance', tileType: Web3TileType.CHANCE },
      { type: 'news', tileType: Web3TileType.NEWS },
      { type: 'bonus', tileType: Web3TileType.BONUS },
      { type: 'fee', tileType: Web3TileType.FEE },
      { type: 'card', tileType: Web3TileType.CARD }
    ];

    // 随机打乱可用位置
    const shuffled = [...availableTiles];
    this.shuffle(shuffled);

    // 放置特殊格子
    for (let i = 0; i < Math.min(targetCount, shuffled.length); i++) {
      const pos = shuffled[i];
      const typeInfo = specialTypes[Math.floor(this.random() * specialTypes.length)];

      const tile: TileData = {
        x: pos.x,
        y: pos.y,
        type: typeInfo.tileType,
        specialType: typeInfo.type,
        value: this.getRandomValue(typeInfo.type),
        group: -1
      };

      this.placedSpecialTiles.push(tile);
      this.occupiedSet.add(CoordUtils.posToKey(pos));
    }

    // 统计分布
    const distribution = new Map<string, number>();
    for (const tile of this.placedSpecialTiles) {
      if (tile.specialType) {
        const count = distribution.get(tile.specialType) || 0;
        distribution.set(tile.specialType, count + 1);
      }
    }

    return {
      specialTiles: this.placedSpecialTiles,
      distribution,
      totalPlaced: this.placedSpecialTiles.length
    };
  }

  /**
   * 获取特殊格子的随机价值
   */
  private getRandomValue(type: string): number {
    switch (type) {
      case 'hospital':
        return 0; // 医院不需要价值
      case 'fee':
        return 100 + Math.floor(this.random() * 400); // 100-500的费用
      case 'bonus':
        return 200 + Math.floor(this.random() * 800); // 200-1000的奖励
      default:
        return 0; // 其他类型不需要价值
    }
  }

  /**
   * 随机打乱数组
   */
  private shuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * 验证分布（保留接口兼容）
   */
  validateDistribution(specialTiles: TileData[]): boolean {
    return true; // 不再验证，纯随机即可
  }

  /**
   * 计算可达性（保留接口兼容）
   */
  calculateAccessibility(pos: Vec2): number {
    return 1.0; // 不再计算，所有位置都可达
  }
}