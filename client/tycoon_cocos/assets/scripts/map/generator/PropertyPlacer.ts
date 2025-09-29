/**
 * 地产放置器 - Phase 2
 * 负责在路径旁随机放置地产
 * 纯随机放置，不使用评分系统
 */

import { Vec2 } from 'cc';
import { CoordUtils, TileData } from './MapGeneratorTypes';
import { Web3TileType } from '../../voxel/Web3BlockTypes';

export interface PropertyPlacementResult {
  properties: PlacedPropertyData[];     // 所有地产
  convertedTiles: Vec2[];        // 被转换为property的tile（不再使用）
  propertyGroups: PropertyGroup[]; // 地产分组信息（保留接口兼容）
}

export interface PlacedPropertyData {
  position: Vec2;
  size: '1x1' | '2x2';
  color?: string;  // 保留字段兼容性
  level: number;
  group?: number;  // 保留字段兼容性
  adjacentTiles?: Vec2[]; // 保留字段兼容性
  value?: number;
  name?: string;
}

export interface PropertyGroup {
  id: number;
  color: string;
  properties: PlacedPropertyData[];
  centerPosition: Vec2;
}

export class PropertyPlacer {
  private width: number;
  private height: number;
  private random: () => number;
  private pathSet: Set<string>;
  private occupiedSet: Set<string>;
  private placedProperties: PlacedPropertyData[];

  constructor(width: number, height: number, randomFn?: () => number) {
    this.width = width;
    this.height = height;
    this.random = randomFn || Math.random;
    this.pathSet = new Set();
    this.occupiedSet = new Set();
    this.placedProperties = [];
  }

  /**
   * 放置地产（不需要模板）
   */
  placeProperties(paths: Vec2[]): PropertyPlacementResult {
    // 初始化路径集合
    this.pathSet.clear();
    for (const pos of paths) {
      this.pathSet.add(CoordUtils.posToKey(pos));
    }

    this.occupiedSet = new Set();
    this.placedProperties = [];

    // 随机决定地产数量（路径的30-50%）
    const ratio = 0.3 + this.random() * 0.2;
    const targetCount = Math.floor(paths.length * ratio);

    // 获取所有路径邻接的空位
    const adjacentPositions = this.getAdjacentToPath(paths);

    // 随机打乱
    this.shuffle(adjacentPositions);

    // 放置地产
    for (let i = 0; i < Math.min(targetCount, adjacentPositions.length); i++) {
      const pos = adjacentPositions[i];
      const key = CoordUtils.posToKey(pos);

      // 跳过已占用的位置
      if (this.occupiedSet.has(key)) {
        continue;
      }

      // 随机决定大小（15%概率大地产）
      const size = this.random() > 0.85 ? '2x2' : '1x1';

      // 如果是2x2，检查是否有足够空间
      if (size === '2x2' && !this.canPlace2x2(pos)) {
        continue; // 空间不足，跳过
      }

      // 创建地产数据
      const property: PlacedPropertyData = {
        position: pos,
        size: size,
        level: 0,
        value: 500 + Math.floor(this.random() * 3500), // 500-4000的随机价格
        color: 'default', // 默认颜色
        group: Math.floor(this.random() * 8) // 随机分组（仅用于兼容）
      };

      this.placedProperties.push(property);

      // 标记占用
      this.markOccupied(pos, size);
    }

    return {
      properties: this.placedProperties,
      convertedTiles: [], // 不再使用tile转换
      propertyGroups: [] // 不再使用分组
    };
  }

  /**
   * 获取路径邻接的所有空位
   */
  private getAdjacentToPath(paths: Vec2[]): Vec2[] {
    const adjacent: Vec2[] = [];
    const seen = new Set<string>();

    for (const path of paths) {
      // 获取4个方向的邻居
      const neighbors = this.getNeighbors(path);

      for (const neighbor of neighbors) {
        const key = CoordUtils.posToKey(neighbor);

        // 不能在路径上，不能重复
        if (!this.pathSet.has(key) && !seen.has(key)) {
          // 确保在地图范围内
          if (neighbor.x >= 1 && neighbor.x < this.width - 1 &&
              neighbor.y >= 1 && neighbor.y < this.height - 1) {
            adjacent.push(neighbor);
            seen.add(key);
          }
        }
      }
    }

    return adjacent;
  }

  /**
   * 获取一个位置的4个邻居
   */
  private getNeighbors(pos: Vec2): Vec2[] {
    return [
      new Vec2(pos.x + 1, pos.y),
      new Vec2(pos.x - 1, pos.y),
      new Vec2(pos.x, pos.y + 1),
      new Vec2(pos.x, pos.y - 1)
    ];
  }

  /**
   * 检查是否可以放置2x2地产
   */
  private canPlace2x2(pos: Vec2): boolean {
    // 检查2x2范围内的4个格子
    const positions = [
      pos,
      new Vec2(pos.x + 1, pos.y),
      new Vec2(pos.x, pos.y + 1),
      new Vec2(pos.x + 1, pos.y + 1)
    ];

    for (const p of positions) {
      const key = CoordUtils.posToKey(p);

      // 不能占用路径或已占用的位置
      if (this.pathSet.has(key) || this.occupiedSet.has(key)) {
        return false;
      }

      // 必须在地图范围内
      if (p.x < 0 || p.x >= this.width || p.y < 0 || p.y >= this.height) {
        return false;
      }
    }

    // 至少有一个格子邻接路径
    for (const p of positions) {
      const neighbors = this.getNeighbors(p);
      for (const n of neighbors) {
        if (this.pathSet.has(CoordUtils.posToKey(n))) {
          return true; // 找到邻接路径的格子
        }
      }
    }

    return false;
  }

  /**
   * 标记占用的格子
   */
  private markOccupied(pos: Vec2, size: '1x1' | '2x2'): void {
    if (size === '1x1') {
      this.occupiedSet.add(CoordUtils.posToKey(pos));
    } else {
      // 2x2占用4个格子
      this.occupiedSet.add(CoordUtils.posToKey(pos));
      this.occupiedSet.add(CoordUtils.posToKey(new Vec2(pos.x + 1, pos.y)));
      this.occupiedSet.add(CoordUtils.posToKey(new Vec2(pos.x, pos.y + 1)));
      this.occupiedSet.add(CoordUtils.posToKey(new Vec2(pos.x + 1, pos.y + 1)));
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
   * 生成tile数据（用于兼容）
   */
  generateTileData(
    paths: Vec2[],
    properties: PlacedPropertyData[],
    convertedTiles: Vec2[]
  ): TileData[] {
    const tiles: TileData[] = [];

    // 所有路径都是空地
    for (const pos of paths) {
      tiles.push({
        x: pos.x,
        y: pos.y,
        type: Web3TileType.EMPTY_LAND,
        value: 0,
        group: -1
      });
    }

    return tiles;
  }

  /**
   * 验证分布（保留接口兼容）
   */
  validateDistribution(properties: PlacedPropertyData[]): boolean {
    return true; // 不再验证，纯随机即可
  }
}