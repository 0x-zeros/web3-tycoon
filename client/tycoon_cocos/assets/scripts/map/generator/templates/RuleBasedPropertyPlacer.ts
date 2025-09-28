import { Vec2 } from 'cc';
import { CoordUtils, PropertyData } from '../MapGeneratorTypes';
import { BuiltRing } from './TemplateTypes';

interface RuleParams {
  mapWidth: number;
  mapHeight: number;
  stride: [number, number];
  minStraight: number;
  big2x2Count: number;
  minBigSpacing: number;
}

export class RuleBasedPropertyPlacer {
  private random: () => number;
  private occupied = new Set<string>();
  private roadSet: Set<string>;

  constructor(random: () => number, roads: Vec2[]) {
    this.random = random;
    this.roadSet = new Set(roads.map(p => CoordUtils.posToKey(p)));
  }

  place(rings: BuiltRing[], params: RuleParams): PropertyData[] {
    const outer = rings.find(r => r.kind === 'outer');
    const properties: PropertyData[] = [];
    if (!outer) return properties;

    // 1) 1x1：外环单侧节奏放置
    const strideMin = params.stride[0];
    const strideMax = params.stride[1];
    let step = this.randInt(strideMin, strideMax);

    for (let i = 1; i < outer.path.length - 1; i++) {
      const prev = outer.path[i - 1];
      const cur = outer.path[i];
      const next = outer.path[i + 1];

      // 拐角缓冲：遇到转向则跳过，并重置节拍
      const d1 = new Vec2(cur.x - prev.x, cur.y - prev.y);
      const d2 = new Vec2(next.x - cur.x, next.y - cur.y);
      if ((d1.x !== d2.x) || (d1.y !== d2.y)) { step = this.randInt(strideMin, strideMax); continue; }

      if (step > 0) { step--; continue; }

      // 决定“外侧”法线
      const normal = this.getOutwardNormal(outer, cur, d2);
      const pos = new Vec2(cur.x + normal.x, cur.y + normal.y);

      if (this.canPlace1x1(pos, params)) {
        properties.push({ blockId: 'web3:property_1x1', gridPos: pos, size: 1, priceCoefficient: 1.0 });
        this.markOccupied(pos, 1);
        // 下一拍
        step = this.randInt(strideMin, strideMax);
      }
    }

    // 2) 2x2：仅贴外环长直段，间距>=minBigSpacing
    const bigPlacedIdx: number[] = [];
    const minStraight = Math.max(3, params.minStraight);
    for (let i = 1; i < outer.path.length - 1 && bigPlacedIdx.length < params.big2x2Count; i++) {
      const prev = outer.path[i - 1];
      const cur = outer.path[i];
      const next = outer.path[i + 1];
      const dir = new Vec2(next.x - cur.x, next.y - cur.y);
      const d1 = new Vec2(cur.x - prev.x, cur.y - prev.y);
      if ((d1.x !== dir.x) || (d1.y !== dir.y)) continue; // 必须直段

      // 统计该直段连续长度
      const span = this.straightSpan(outer.path, i);
      if (span < minStraight) { i += Math.max(0, span - 1); continue; }

      // 间距约束
      if (bigPlacedIdx.some(j => Math.abs(j - i) < params.minBigSpacing)) continue;

      const normal = this.getOutwardNormal(outer, cur, dir);
      const anchor = new Vec2(cur.x + normal.x, cur.y + normal.y);
      if (this.canPlace2x2(anchor, params)) {
        properties.push({ blockId: 'web3:property_2x2', gridPos: anchor, size: 2, priceCoefficient: 1.2 });
        this.markOccupied(anchor, 2);
        bigPlacedIdx.push(i);
        i += 1; // 轻微跳过，避免过密
      }
    }

    return properties;
  }

  private randInt(min: number, max: number) { return Math.floor(this.random() * (max - min + 1)) + min; }

  private inBounds(p: Vec2, params: RuleParams): boolean {
    return p.x >= 1 && p.x < params.mapWidth - 1 && p.y >= 1 && p.y < params.mapHeight - 1;
  }

  private canPlace1x1(pos: Vec2, params: RuleParams): boolean {
    if (!this.inBounds(pos, params)) return false;
    const key = CoordUtils.posToKey(pos);
    if (this.roadSet.has(key) || this.occupied.has(key)) return false;
    return true;
  }

  private canPlace2x2(anchor: Vec2, params: RuleParams): boolean {
    for (let dx = 0; dx < 2; dx++) {
      for (let dy = 0; dy < 2; dy++) {
        const p = new Vec2(anchor.x + dx, anchor.y + dy);
        if (!this.inBounds(p, params)) return false;
        const k = CoordUtils.posToKey(p);
        if (this.roadSet.has(k) || this.occupied.has(k)) return false;
      }
    }
    return true;
  }

  private markOccupied(anchor: Vec2, size: number) {
    for (let dx = 0; dx < size; dx++) {
      for (let dy = 0; dy < size; dy++) {
        this.occupied.add(CoordUtils.posToKey(new Vec2(anchor.x + dx, anchor.y + dy)));
      }
    }
  }

  private straightSpan(path: Vec2[], idx: number): number {
    let len = 1;
    let i = idx;
    const dir = new Vec2(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
    while (i + 1 < path.length) {
      const d = new Vec2(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
      if (d.x === dir.x && d.y === dir.y) { len++; i++; } else break;
    }
    return len;
  }

  // 依据环的包围盒判断“外侧”，在四边各自有明确外法线
  private getOutwardNormal(ring: BuiltRing, cur: Vec2, dir: Vec2): Vec2 {
    // 水平段：y 常量；
    if (dir.x !== 0) {
      if (cur.y === ring.bbox.top) return new Vec2(0, -1); // 顶边：外侧向上
      if (cur.y === ring.bbox.bottom) return new Vec2(0, 1); // 底边：外侧向下
      // 中部段：根据整体位置估个外侧（远离中心）
      const cy = (ring.bbox.top + ring.bbox.bottom) / 2;
      return cur.y < cy ? new Vec2(0, -1) : new Vec2(0, 1);
    }
    // 垂直段：x 常量；
    if (cur.x === ring.bbox.left) return new Vec2(-1, 0);
    if (cur.x === ring.bbox.right) return new Vec2(1, 0);
    const cx = (ring.bbox.left + ring.bbox.right) / 2;
    return cur.x < cx ? new Vec2(-1, 0) : new Vec2(1, 0);
  }
}

