/**
 * 地产放置器 - Phase 2
 * 负责在路径旁放置地产，并将相邻tile转换为property类型
 */

import { Vec2 } from 'cc';
import { PropertyGroupDef, MapTemplateSpec } from './templates/TemplateTypes';
import { CoordUtils, TileData } from './MapGeneratorTypes';
import { Web3TileType } from '../../voxel/Web3BlockTypes';

export interface PropertyPlacementResult {
  properties: PropertyData[];     // 所有地产
  convertedTiles: Vec2[];        // 被转换为property的tile
  propertyGroups: PropertyGroup[]; // 地产分组信息
}

export interface PropertyData {
  position: Vec2;
  size: '1x1' | '2x2';
  color: string;
  level: number;
  group: number;        // 所属组ID
  adjacentTiles: Vec2[]; // 相邻的被转换的tiles
}

export interface PropertyGroup {
  id: number;
  color: string;
  properties: PropertyData[];
  centerPosition: Vec2;
}

interface LocationScore {
  position: Vec2;
  score: number;
  type: 'straight' | 'corner' | 'intersection';
  nearbySpace: number;  // 附近空地数量
}

export class PropertyPlacer {
  private width: number;
  private height: number;
  private random: () => number;
  private pathSet: Set<string>;
  private occupiedSet: Set<string>;
  private placedProperties: PropertyData[];
  private convertedTiles: Set<string>;

  constructor(width: number, height: number, randomFn?: () => number) {
    this.width = width;
    this.height = height;
    this.random = randomFn || Math.random;
    this.pathSet = new Set();
    this.occupiedSet = new Set();
    this.placedProperties = [];
    this.convertedTiles = new Set();
  }

  /**
   * 放置地产
   */
  placeProperties(
    paths: Vec2[],
    template: MapTemplateSpec,
    corners: Vec2[] = [],
    intersections: Vec2[] = []
  ): PropertyPlacementResult {
    // 初始化路径集合
    this.pathSet.clear();
    for (const pos of paths) {
      this.pathSet.add(CoordUtils.posToKey(pos));
    }

    // 初始化已占用集合（包括路径）
    this.occupiedSet = new Set(this.pathSet);
    this.placedProperties = [];
    this.convertedTiles.clear();

    const propertyConfig = template.propertyConfig;
    const groups: PropertyGroup[] = [];
    let groupId = 0;

    // 按组放置地产
    for (const groupDef of propertyConfig.groups) {
      const group = this.placePropertyGroup(
        groupDef,
        groupId++,
        corners,
        intersections,
        propertyConfig.placement
      );
      if (group.properties.length > 0) {
        groups.push(group);
      }
    }

    // 转换相邻tiles
    this.convertAdjacentTiles();

    return {
      properties: this.placedProperties,
      convertedTiles: Array.from(this.convertedTiles).map(key => CoordUtils.keyToPos(key)),
      propertyGroups: groups
    };
  }

  /**
   * 放置一组地产
   */
  private placePropertyGroup(
    groupDef: PropertyGroupDef,
    groupId: number,
    corners: Vec2[],
    intersections: Vec2[],
    placement: 'grouped' | 'scattered' | 'mixed'
  ): PropertyGroup {
    const group: PropertyGroup = {
      id: groupId,
      color: groupDef.color,
      properties: [],
      centerPosition: new Vec2(this.width / 2, this.height / 2)
    };

    // 获取候选位置并评分
    const candidates = this.scoreCandidateLocations(
      groupDef,
      corners,
      intersections
    );

    // 根据放置策略选择位置
    const selectedPositions = this.selectPositions(
      candidates,
      groupDef.count,
      groupDef.size,
      placement
    );

    // 创建地产
    for (const pos of selectedPositions) {
      const property: PropertyData = {
        position: pos,
        size: groupDef.size,
        color: groupDef.color,
        level: 1,
        group: groupId,
        adjacentTiles: []
      };

      // 标记占用
      this.markOccupied(pos, groupDef.size);

      this.placedProperties.push(property);
      group.properties.push(property);
    }

    // 计算组中心
    if (group.properties.length > 0) {
      let sumX = 0, sumY = 0;
      for (const prop of group.properties) {
        sumX += prop.position.x;
        sumY += prop.position.y;
      }
      group.centerPosition = new Vec2(
        sumX / group.properties.length,
        sumY / group.properties.length
      );
    }

    return group;
  }

  /**
   * 对候选位置评分
   */
  private scoreCandidateLocations(
    groupDef: PropertyGroupDef,
    corners: Vec2[],
    intersections: Vec2[]
  ): LocationScore[] {
    const scores: LocationScore[] = [];
    const size = groupDef.size === '2x2' ? 2 : 1;

    // 遍历所有路径相邻位置
    for (const pathKey of this.pathSet) {
      const pathPos = CoordUtils.keyToPos(pathKey);
      const neighbors = this.getValidNeighbors(pathPos, size);

      for (const neighbor of neighbors) {
        if (this.canPlace(neighbor, size)) {
          const score = this.calculateLocationScore(
            neighbor,
            pathPos,
            groupDef,
            corners,
            intersections
          );
          scores.push(score);
        }
      }
    }

    // 排序，高分优先
    scores.sort((a, b) => b.score - a.score);

    return scores;
  }

  /**
   * 计算位置得分
   */
  private calculateLocationScore(
    position: Vec2,
    nearPath: Vec2,
    groupDef: PropertyGroupDef,
    corners: Vec2[],
    intersections: Vec2[]
  ): LocationScore {
    let score = 0;
    let type: 'straight' | 'corner' | 'intersection' = 'straight';

    // 基础分
    score = 10;

    // 检查是否在拐角附近
    const nearCorner = corners.some(c => Vec2.distance(position, c) <= 2);
    if (nearCorner) {
      type = 'corner';
      if (groupDef.preferredZone === 'corner') {
        score += 5;
      } else {
        score += 1;
      }
    }

    // 检查是否在交叉点附近
    const nearIntersection = intersections.some(i => Vec2.distance(position, i) <= 2);
    if (nearIntersection) {
      type = 'intersection';
      score += 2;
    }

    // 直线段加分
    if (!nearCorner && !nearIntersection) {
      if (groupDef.preferredZone === 'straight') {
        score += 3;
      }
    }

    // 计算附近空地
    const nearbySpace = this.countNearbySpace(position, groupDef.size === '2x2' ? 2 : 1);
    score += nearbySpace * 2;

    // 已有同色地产相邻额外加分
    const sameColorNearby = this.countSameColorNearby(position, groupDef.color);
    if (sameColorNearby > 0) {
      score += sameColorNearby * 5; // 鼓励聚集
    }

    // 边缘位置减分
    const edgeDist = Math.min(
      position.x, position.y,
      this.width - position.x - 1,
      this.height - position.y - 1
    );
    if (edgeDist < 3) {
      score -= 3;
    }

    return {
      position,
      score,
      type,
      nearbySpace
    };
  }

  /**
   * 选择地产位置
   */
  private selectPositions(
    candidates: LocationScore[],
    count: number,
    size: '1x1' | '2x2',
    placement: 'grouped' | 'scattered' | 'mixed'
  ): Vec2[] {
    const selected: Vec2[] = [];
    const used = new Set<string>();

    if (placement === 'grouped') {
      // 聚集放置：选择相邻的高分位置
      for (const candidate of candidates) {
        if (selected.length >= count) break;

        const key = CoordUtils.posToKey(candidate.position);
        if (used.has(key)) continue;

        // 检查是否可以放置
        if (this.canPlace(candidate.position, size === '2x2' ? 2 : 1)) {
          selected.push(candidate.position);
          used.add(key);

          // 标记为临时占用，避免重叠
          this.markOccupied(candidate.position, size);
        }
      }
    } else if (placement === 'scattered') {
      // 分散放置：保持最小间距
      const minSpacing = 3;
      for (const candidate of candidates) {
        if (selected.length >= count) break;

        const key = CoordUtils.posToKey(candidate.position);
        if (used.has(key)) continue;

        // 检查与已选位置的距离
        let tooClose = false;
        for (const sel of selected) {
          if (Vec2.distance(candidate.position, sel) < minSpacing) {
            tooClose = true;
            break;
          }
        }

        if (!tooClose && this.canPlace(candidate.position, size === '2x2' ? 2 : 1)) {
          selected.push(candidate.position);
          used.add(key);
          this.markOccupied(candidate.position, size);
        }
      }
    } else {
      // 混合放置：部分聚集，部分分散
      const halfCount = Math.floor(count / 2);

      // 先聚集放置一半
      for (const candidate of candidates) {
        if (selected.length >= halfCount) break;

        const key = CoordUtils.posToKey(candidate.position);
        if (used.has(key)) continue;

        if (this.canPlace(candidate.position, size === '2x2' ? 2 : 1)) {
          selected.push(candidate.position);
          used.add(key);
          this.markOccupied(candidate.position, size);
        }
      }

      // 再分散放置另一半
      const minSpacing = 4;
      for (const candidate of candidates) {
        if (selected.length >= count) break;

        const key = CoordUtils.posToKey(candidate.position);
        if (used.has(key)) continue;

        let tooClose = false;
        for (let i = halfCount; i < selected.length; i++) {
          if (Vec2.distance(candidate.position, selected[i]) < minSpacing) {
            tooClose = true;
            break;
          }
        }

        if (!tooClose && this.canPlace(candidate.position, size === '2x2' ? 2 : 1)) {
          selected.push(candidate.position);
          used.add(key);
          this.markOccupied(candidate.position, size);
        }
      }
    }

    return selected;
  }

  /**
   * 转换相邻tiles为property类型
   */
  private convertAdjacentTiles(): void {
    for (const property of this.placedProperties) {
      const maxConvert = property.size === '2x2' ? 2 : 1;
      let converted = 0;

      // 获取地产周围的路径tiles
      const adjacentPaths = this.getAdjacentPathTiles(property.position, property.size);

      // 优先级：拐角外侧 > 直线延伸 > 拐角内侧
      const prioritized = this.prioritizeAdjacentTiles(adjacentPaths, property.position);

      for (const pathPos of prioritized) {
        if (converted >= maxConvert) break;

        // 检查是否可以转换
        const key = CoordUtils.posToKey(pathPos);
        if (!this.convertedTiles.has(key) && this.pathSet.has(key)) {
          this.convertedTiles.add(key);
          property.adjacentTiles.push(pathPos);
          converted++;
        }
      }
    }
  }

  /**
   * 获取有效的邻居位置
   */
  private getValidNeighbors(pos: Vec2, size: number): Vec2[] {
    const neighbors: Vec2[] = [];
    const offsets = [
      new Vec2(-size, 0), new Vec2(size, 0),
      new Vec2(0, -size), new Vec2(0, size),
      new Vec2(-size, -size), new Vec2(size, -size),
      new Vec2(-size, size), new Vec2(size, size)
    ];

    for (const offset of offsets) {
      const neighbor = new Vec2(pos.x + offset.x, pos.y + offset.y);
      if (this.isInBounds(neighbor, size)) {
        neighbors.push(neighbor);
      }
    }

    return neighbors;
  }

  /**
   * 获取相邻的路径tiles
   */
  private getAdjacentPathTiles(pos: Vec2, size: '1x1' | '2x2'): Vec2[] {
    const adjacent: Vec2[] = [];
    const checkSize = size === '2x2' ? 2 : 1;

    // 检查四周
    for (let dx = -1; dx <= checkSize; dx++) {
      for (let dy = -1; dy <= checkSize; dy++) {
        // 跳过内部
        if (dx >= 0 && dx < checkSize && dy >= 0 && dy < checkSize) continue;

        const checkPos = new Vec2(pos.x + dx, pos.y + dy);
        if (this.pathSet.has(CoordUtils.posToKey(checkPos))) {
          adjacent.push(checkPos);
        }
      }
    }

    return adjacent;
  }

  /**
   * 优先级排序相邻tiles
   */
  private prioritizeAdjacentTiles(tiles: Vec2[], propertyPos: Vec2): Vec2[] {
    // 简单策略：按距离排序
    return tiles.sort((a, b) => {
      const distA = Vec2.distance(a, propertyPos);
      const distB = Vec2.distance(b, propertyPos);
      return distA - distB;
    });
  }

  /**
   * 检查是否可以放置
   */
  private canPlace(pos: Vec2, size: number): boolean {
    if (!this.isInBounds(pos, size)) return false;

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const checkPos = new Vec2(pos.x + x, pos.y + y);
        const key = CoordUtils.posToKey(checkPos);
        if (this.occupiedSet.has(key)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 标记占用
   */
  private markOccupied(pos: Vec2, size: '1x1' | '2x2'): void {
    const checkSize = size === '2x2' ? 2 : 1;
    for (let x = 0; x < checkSize; x++) {
      for (let y = 0; y < checkSize; y++) {
        const occupiedPos = new Vec2(pos.x + x, pos.y + y);
        this.occupiedSet.add(CoordUtils.posToKey(occupiedPos));
      }
    }
  }

  /**
   * 统计附近空地
   */
  private countNearbySpace(pos: Vec2, size: number): number {
    let count = 0;
    const checkRadius = 3;

    for (let dx = -checkRadius; dx <= checkRadius + size; dx++) {
      for (let dy = -checkRadius; dy <= checkRadius + size; dy++) {
        const checkPos = new Vec2(pos.x + dx, pos.y + dy);
        const key = CoordUtils.posToKey(checkPos);

        if (this.isInBounds(checkPos, 1) && !this.occupiedSet.has(key)) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * 统计附近同色地产
   */
  private countSameColorNearby(pos: Vec2, color: string): number {
    let count = 0;
    const checkRadius = 4;

    for (const property of this.placedProperties) {
      if (property.color === color) {
        const dist = Vec2.distance(pos, property.position);
        if (dist <= checkRadius && dist > 0) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * 检查是否在边界内
   */
  private isInBounds(pos: Vec2, size: number): boolean {
    return pos.x >= 1 && pos.y >= 1 &&
           pos.x + size <= this.width - 1 &&
           pos.y + size <= this.height - 1;
  }

  /**
   * 生成TileData（用于最终输出）
   */
  public generateTileData(
    paths: Vec2[],
    properties: PropertyData[],
    convertedTiles: Vec2[]
  ): TileData[] {
    const tiles: TileData[] = [];
    const convertedSet = new Set(convertedTiles.map(t => CoordUtils.posToKey(t)));
    const propertyMap = new Map<string, PropertyData>();

    // 建立地产位置映射
    for (const prop of properties) {
      const size = prop.size === '2x2' ? 2 : 1;
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          const pos = new Vec2(prop.position.x + x, prop.position.y + y);
          propertyMap.set(CoordUtils.posToKey(pos), prop);
        }
      }
    }

    // 生成路径tiles
    for (const pos of paths) {
      const key = CoordUtils.posToKey(pos);

      // 检查是否被转换为property
      if (convertedSet.has(key)) {
        tiles.push({
          x: pos.x,
          y: pos.y,
          type: Web3TileType.Property,
          value: 1000,
          group: 0
        });
      } else if (!propertyMap.has(key)) {
        // 普通路径tile
        tiles.push({
          x: pos.x,
          y: pos.y,
          type: Web3TileType.Empty,
          value: 0,
          group: -1
        });
      }
    }

    // 生成地产tiles
    for (const prop of properties) {
      const size = prop.size === '2x2' ? 2 : 1;
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          const pos = new Vec2(prop.position.x + x, prop.position.y + y);
          tiles.push({
            x: pos.x,
            y: pos.y,
            type: Web3TileType.Property,
            value: prop.size === '2x2' ? 2000 : 1000,
            group: prop.group,
            buildingType: prop.size === '2x2' ? 'web3:property_2x2' : 'web3:property_1x1',
            buildingLevel: prop.level
          });
        }
      }
    }

    return tiles;
  }
}