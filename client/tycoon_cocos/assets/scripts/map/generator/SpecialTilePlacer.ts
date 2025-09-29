/**
 * 特殊格子放置器 - Phase 3
 * 负责在空地tiles上放置特殊格子（医院、机会、奖励、费用、卡片、新闻等）
 */

import { Vec2 } from 'cc';
import { SpecialTileConfig, MapTemplateSpec } from './templates/TemplateTypes';
import { CoordUtils, TileData, SpecialTileData } from './MapGeneratorTypes';
import { Web3TileType } from '../../voxel/Web3BlockTypes';

export interface SpecialTilePlacementResult {
  specialTiles: SpecialTileData[];
  totalPlaced: number;
  distribution: Map<string, number>; // 各类型数量统计
}

interface TileCandidate {
  position: Vec2;
  score: number;
  quadrant: number; // 所在象限 (0-3)
  centrality: number; // 中心性分数
  accessibility: number; // 可达性分数
}

export class SpecialTilePlacer {
  private width: number;
  private height: number;
  private random: () => number;
  private occupiedSet: Set<string>;
  private pathSet: Set<string>;
  private placedSpecialTiles: SpecialTileData[];

  constructor(width: number, height: number, randomFn?: () => number) {
    this.width = width;
    this.height = height;
    this.random = randomFn || Math.random;
    this.occupiedSet = new Set();
    this.pathSet = new Set();
    this.placedSpecialTiles = [];
  }

  /**
   * 放置特殊格子
   */
  placeSpecialTiles(
    emptyTiles: Vec2[],
    template: MapTemplateSpec,
    occupiedPositions: Vec2[] = []
  ): SpecialTilePlacementResult {
    // 初始化集合
    this.pathSet.clear();
    for (const tile of emptyTiles) {
      this.pathSet.add(CoordUtils.posToKey(tile));
    }

    this.occupiedSet.clear();
    for (const pos of occupiedPositions) {
      this.occupiedSet.add(CoordUtils.posToKey(pos));
    }

    this.placedSpecialTiles = [];

    // 先放置固定特殊格子（如果模板提供）
    const prePlacedCount = new Map<string, number>();
    if (template.fixedSpecialTiles && template.fixedSpecialTiles.length > 0) {
      for (const fixed of template.fixedSpecialTiles) {
        for (const [x, y] of fixed.positions) {
          const pos = new Vec2(x, y);
          const key = CoordUtils.posToKey(pos);
          if (this.pathSet.has(key) && !this.occupiedSet.has(key)) {
            this.addSpecialTile(pos, fixed.type);
            this.occupiedSet.add(key);
            prePlacedCount.set(fixed.type, (prePlacedCount.get(fixed.type) || 0) + 1);
          }
        }
      }
    }

    // 计算总特殊格子数量 (占总tile数的15%)
    const totalTileCount = emptyTiles.length;
    const targetSpecialCount = Math.floor(totalTileCount * 0.15);

    // 分配各类型数量
    const distribution = this.calculateDistribution(
      targetSpecialCount,
      template.specialTiles
    );

    // 扣除已固定放置的数量
    prePlacedCount.forEach((cnt, type) => {
      const prev = distribution.get(type) || 0;
      distribution.set(type, Math.max(0, prev - cnt));
    });

    // 获取候选位置并评分
    const candidates = this.evaluateCandidates(emptyTiles);

    // 按类型放置特殊格子
    for (const config of template.specialTiles) {
      const count = distribution.get(config.type) || 0;
      if (count > 0) {
        this.placeSpecialTileType(
          config,
          count,
          candidates
        );
      }
    }

    // 统计结果
    const finalDistribution = new Map<string, number>();
    for (const tile of this.placedSpecialTiles) {
      const count = finalDistribution.get(tile.specialType!) || 0;
      finalDistribution.set(tile.specialType!, count + 1);
    }

    return {
      specialTiles: this.placedSpecialTiles,
      totalPlaced: this.placedSpecialTiles.length,
      distribution: finalDistribution
    };
  }

  /**
   * 计算各类型分配数量
   */
  private calculateDistribution(
    totalCount: number,
    configs: SpecialTileConfig[]
  ): Map<string, number> {
    const distribution = new Map<string, number>();
    let totalRequested = 0;

    // 统计总请求数
    for (const config of configs) {
      totalRequested += config.count;
    }

    // 按比例分配
    let allocated = 0;
    for (const config of configs) {
      const ratio = config.count / totalRequested;
      const count = Math.floor(totalCount * ratio);
      distribution.set(config.type, count);
      allocated += count;
    }

    // 分配剩余格子（优先给重要类型）
    const remaining = totalCount - allocated;
    const priorityTypes = ['hospital', 'bank', 'chance'];
    let added = 0;

    for (const type of priorityTypes) {
      if (added >= remaining) break;
      const current = distribution.get(type) || 0;
      if (current > 0) {
        distribution.set(type, current + 1);
        added++;
      }
    }

    return distribution;
  }

  /**
   * 评估候选位置
   */
  private evaluateCandidates(emptyTiles: Vec2[]): TileCandidate[] {
    const candidates: TileCandidate[] = [];
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    for (const tile of emptyTiles) {
      // 跳过已占用位置
      if (this.occupiedSet.has(CoordUtils.posToKey(tile))) {
        continue;
      }

      // 计算象限
      const quadrant = this.getQuadrant(tile, centerX, centerY);

      // 计算中心性（距离地图中心的远近）
      const centrality = this.calculateCentrality(tile, centerX, centerY);

      // 计算可达性（周围路径tiles的数量）
      const accessibility = this.calculateAccessibility(tile);

      // 综合评分
      const score = centrality * 0.4 + accessibility * 0.6;

      candidates.push({
        position: tile,
        score,
        quadrant,
        centrality,
        accessibility
      });
    }

    // 按分数排序
    candidates.sort((a, b) => b.score - a.score);

    return candidates;
  }

  /**
   * 放置特定类型的特殊格子
   */
  private placeSpecialTileType(
    config: SpecialTileConfig,
    count: number,
    candidates: TileCandidate[]
  ): void {
    const placed: Vec2[] = [];
    const minSpacing = this.getMinSpacing(config.type);

    // 根据分布策略选择位置
    if (config.distribution === 'even') {
      // 均匀分布：确保四个象限都有
      this.placeEvenly(config.type, count, candidates, placed, minSpacing);
    } else if (config.distribution === 'clustered') {
      // 聚集分布：集中在某个区域
      this.placeClustered(config.type, count, candidates, placed, minSpacing);
    } else {
      // 随机分布
      this.placeRandomly(config.type, count, candidates, placed, minSpacing);
    }
  }

  /**
   * 均匀分布放置
   */
  private placeEvenly(
    type: string,
    count: number,
    candidates: TileCandidate[],
    placed: Vec2[],
    minSpacing: number
  ): void {
    // 按象限分组
    const byQuadrant = new Map<number, TileCandidate[]>();
    for (let q = 0; q < 4; q++) {
      byQuadrant.set(q, []);
    }

    for (const candidate of candidates) {
      const quadrantList = byQuadrant.get(candidate.quadrant);
      if (quadrantList) {
        quadrantList.push(candidate);
      }
    }

    // 每个象限分配数量
    const perQuadrant = Math.floor(count / 4);
    const remainder = count % 4;

    let totalPlaced = 0;
    for (let q = 0; q < 4; q++) {
      const quadrantCandidates = byQuadrant.get(q) || [];
      const targetCount = perQuadrant + (q < remainder ? 1 : 0);

      for (const candidate of quadrantCandidates) {
        if (totalPlaced >= count) break;
        if (placed.filter(p => candidate.quadrant === this.getQuadrant(p, this.width / 2, this.height / 2)).length >= targetCount) {
          continue;
        }

        if (this.canPlaceSpecialTile(candidate.position, placed, minSpacing)) {
          this.addSpecialTile(candidate.position, type);
          placed.push(candidate.position);
          totalPlaced++;
        }
      }
    }

    // 如果没有放置够，使用剩余的高分位置
    for (const candidate of candidates) {
      if (totalPlaced >= count) break;

      if (this.canPlaceSpecialTile(candidate.position, placed, minSpacing)) {
        this.addSpecialTile(candidate.position, type);
        placed.push(candidate.position);
        totalPlaced++;
      }
    }
  }

  /**
   * 聚集分布放置
   */
  private placeClustered(
    type: string,
    count: number,
    candidates: TileCandidate[],
    placed: Vec2[],
    minSpacing: number
  ): void {
    // 选择一个中心点（高分位置）
    if (candidates.length === 0) return;

    const center = candidates[0].position;

    // 按距离中心点排序
    const sorted = candidates.sort((a, b) => {
      const distA = Vec2.distance(a.position, center);
      const distB = Vec2.distance(b.position, center);
      return distA - distB;
    });

    // 放置
    let totalPlaced = 0;
    for (const candidate of sorted) {
      if (totalPlaced >= count) break;

      if (this.canPlaceSpecialTile(candidate.position, placed, minSpacing / 2)) { // 聚集时减小间距
        this.addSpecialTile(candidate.position, type);
        placed.push(candidate.position);
        totalPlaced++;
      }
    }
  }

  /**
   * 随机分布放置
   */
  private placeRandomly(
    type: string,
    count: number,
    candidates: TileCandidate[],
    placed: Vec2[],
    minSpacing: number
  ): void {
    // 打乱候选列表
    const shuffled = this.shuffle(candidates);

    let totalPlaced = 0;
    for (const candidate of shuffled) {
      if (totalPlaced >= count) break;

      if (this.canPlaceSpecialTile(candidate.position, placed, minSpacing)) {
        this.addSpecialTile(candidate.position, type);
        placed.push(candidate.position);
        totalPlaced++;
      }
    }
  }

  /**
   * 检查是否可以放置特殊格子
   */
  private canPlaceSpecialTile(
    position: Vec2,
    placed: Vec2[],
    minSpacing: number
  ): boolean {
    // 检查是否已占用
    if (this.occupiedSet.has(CoordUtils.posToKey(position))) {
      return false;
    }

    // 检查与其他特殊格子的间距
    for (const other of placed) {
      if (Vec2.distance(position, other) < minSpacing) {
        return false;
      }
    }

    // 检查与已放置的特殊格子的间距
    for (const existing of this.placedSpecialTiles) {
      if (Vec2.distance(position, new Vec2(existing.x, existing.y)) < minSpacing) {
        return false;
      }
    }

    return true;
  }

  /**
   * 添加特殊格子
   */
  private addSpecialTile(position: Vec2, type: string): void {
    const tileType = this.getWeb3TileType(type);
    const value = this.getSpecialTileValue(type);

    const specialTile: SpecialTileData = {
      x: position.x,
      y: position.y,
      type: tileType,
      specialType: type,
      value: value,
      group: -1
    };

    this.placedSpecialTiles.push(specialTile);
    this.occupiedSet.add(CoordUtils.posToKey(position));
  }

  /**
   * 获取象限
   */
  private getQuadrant(pos: Vec2, centerX: number, centerY: number): number {
    if (pos.x < centerX && pos.y < centerY) return 0; // 左下
    if (pos.x >= centerX && pos.y < centerY) return 1; // 右下
    if (pos.x >= centerX && pos.y >= centerY) return 2; // 右上
    return 3; // 左上
  }

  /**
   * 计算中心性分数
   */
  private calculateCentrality(pos: Vec2, centerX: number, centerY: number): number {
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
    const dist = Vec2.distance(pos, new Vec2(centerX, centerY));
    return 1 - (dist / maxDist); // 越靠近中心分数越高
  }

  /**
   * 计算可达性分数
   */
  private calculateAccessibility(pos: Vec2): number {
    let pathCount = 0;
    const checkRadius = 3;

    for (let dx = -checkRadius; dx <= checkRadius; dx++) {
      for (let dy = -checkRadius; dy <= checkRadius; dy++) {
        if (dx === 0 && dy === 0) continue;

        const checkPos = new Vec2(pos.x + dx, pos.y + dy);
        if (this.pathSet.has(CoordUtils.posToKey(checkPos))) {
          pathCount++;
        }
      }
    }

    // 归一化到0-1
    const maxPossible = (checkRadius * 2 + 1) * (checkRadius * 2 + 1) - 1;
    return pathCount / maxPossible;
  }

  /**
   * 获取最小间距
   */
  private getMinSpacing(type: string): number {
    switch (type) {
      case 'hospital':
      case 'bank':
        return 8; // 重要设施间距更大
      case 'shop':
        return 6;
      case 'chance':
      case 'news':
        return 4;
      default:
        return 3;
    }
  }

  /**
   * 获取Web3TileType
   */
  private getWeb3TileType(type: string): Web3TileType {
    // 统一映射到现有的 Web3TileType（见 Web3BlockTypes.ts）
    // 缺失的类型按约定替换：bank -> chance, teleport -> bonus, shop -> card, fee -> fee
    switch (type) {
      case 'hospital':
        return Web3TileType.HOSPITAL;
      case 'shop':
        // 没有单独的商店格，映射为卡片格
        return Web3TileType.CARD;
      case 'bank':
        // 没有银行格，按约定替换为机会格
        return Web3TileType.CHANCE;
      case 'teleport':
        // 没有传送格，按约定替换为奖励格
        return Web3TileType.BONUS;
      case 'chance':
        return Web3TileType.CHANCE;
      case 'news':
        return Web3TileType.NEWS;
      case 'bonus':
        return Web3TileType.BONUS;
      case 'fee':
        return Web3TileType.FEE;
      case 'card':
        return Web3TileType.CARD;
      default:
        return Web3TileType.EMPTY_LAND;
    }
  }

  /**
   * 获取特殊格子价值
   */
  private getSpecialTileValue(type: string): number {
    switch (type) {
      case 'hospital':
        return 5000; // 医院费用
      case 'shop':
        return 2000; // 商店价格
      case 'bank':
        return 0; // 银行无费用
      case 'chance':
        return 0; // 机会卡无费用
      case 'news':
        return 0; // 新闻无费用
      case 'bonus':
        return 3000; // 奖励金额
      case 'fee':
        return 2000; // 费用金额
      case 'card':
        return 0; // 卡片无费用
      default:
        return 0;
    }
  }

  /**
   * 打乱数组
   */
  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * 验证分布平衡性
   */
  public validateDistribution(specialTiles: SpecialTileData[]): boolean {
    // 检查四个象限的分布
    const quadrantCounts = [0, 0, 0, 0];
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    for (const tile of specialTiles) {
      const quadrant = this.getQuadrant(new Vec2(tile.x, tile.y), centerX, centerY);
      quadrantCounts[quadrant]++;
    }

    // 检查是否每个象限都有特殊格子
    const minPerQuadrant = Math.floor(specialTiles.length / 4) * 0.5; // 允许50%的偏差
    for (const count of quadrantCounts) {
      if (count < minPerQuadrant) {
        return false;
      }
    }

    // 检查可达性（每个特殊格子10格内必须有路径）
    for (const tile of specialTiles) {
      const pos = new Vec2(tile.x, tile.y);
      const accessibility = this.calculateAccessibility(pos);
      if (accessibility < 0.1) { // 至少10%的可达性
        return false;
      }
    }

    return true;
  }
}
