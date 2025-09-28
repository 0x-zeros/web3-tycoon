import { Vec2 } from 'cc';
import { CoordUtils, PropertyData } from '../MapGeneratorTypes';
import { BuiltRing } from './TemplateTypes';

type Side = 'L' | 'R';

interface RuleParams {
  mapWidth: number;
  mapHeight: number;
  stride: [number, number];
  minStraight: number;
  big2x2Count: number;
  minBigSpacing: number; // 以“同一直段索引差”计
  smallTargetMin?: number; // R5 触发阈值（目标下限）
}

interface Segment { id: number; pts: Vec2[]; dir: Vec2; }
interface Slot { segId: number; side: Side; idx: number; road: Vec2; }

export class RuleBasedPropertyPlacer {
  private random: () => number;
  private occupied = new Set<string>(); // 已占用地图坐标（地产格）
  private roadSet: Set<string>; // 道路集合

  constructor(random: () => number, roads: Vec2[]) {
    this.random = random;
    this.roadSet = new Set(roads.map(p => CoordUtils.posToKey(p)));
  }

  place(rings: BuiltRing[], params: RuleParams): PropertyData[] {
    const outer = rings.find(r => r.kind === 'outer');
    if (!outer) return [];

    const segments = this.segmentize(outer.path);

    // 先放 2x2（R4 也需要屏蔽同侧 1 格缓冲）
    const bigBlocked = new Map<string, Set<number>>(); // key=seg|side -> idx集合
    const properties: PropertyData[] = [];
    const placedBigSlots: Array<{ segId: number; side: Side; idx: number; normal: Vec2 }>= [];
    const bigTarget = params.big2x2Count;
    let bigPlaced = 0;

    for (const seg of segments) {
      if (bigPlaced >= bigTarget) break;
      const minStraight = Math.max(3, params.minStraight);
      const span = seg.pts.length;
      if (span < minStraight) continue;

      // 选择 outer side
      const side = this.getOuterSide(outer, seg);
      const normal = this.sideNormalFromDir(seg.dir, side);

      // 扫描可用位置，保证 spacing
      const usedIdx: number[] = [];
      for (let i = 1; i < span - 1 && bigPlaced < bigTarget; i++) {
        // 周围至少有连续直段（2x2 紧贴道路，轴向覆盖约2个索引），简单用 i 与 i+1
        if (i + 1 >= span) break;
        if (usedIdx.some(j => Math.abs(j - i) < params.minBigSpacing)) continue;

        const anchor = new Vec2(seg.pts[i].x + normal.x, seg.pts[i].y + normal.y);
        if (!this.canPlace2x2(anchor, params)) continue;

        properties.push({ blockId: 'web3:property_2x2', gridPos: anchor, size: 2, priceCoefficient: 1.2 });
        this.markOccupied(anchor, 2);
        usedIdx.push(i);
        placedBigSlots.push({ segId: seg.id, side, idx: i, normal });
        bigPlaced++;

        // 屏蔽本侧周围 1 格（R4），以及 2x2 占用轴向的第二格
        const key = this.key(seg.id, side);
        const set = bigBlocked.get(key) || new Set<number>();
        set.add(i - 1); set.add(i); set.add(i + 1); set.add(i + 2);
        bigBlocked.set(key, set);
      }
    }

    // 小地（1x1）：按段节拍铺点；R1/R2/R4；开启双侧
    const chosen = new Set<string>(); // seg|side|idx
    const chosenBy = new Map<string, Set<number>>(); // seg|side -> idx集合
    const strideMin = params.stride[0];
    const strideMax = params.stride[1];

    for (const seg of segments) {
      const outerSide: Side = this.getOuterSide(outer, seg);
      const sides: Side[] = [outerSide, outerSide === 'L' ? 'R' : 'L'];

      for (const side of sides) {
        const normal = this.sideNormalFromDir(seg.dir, side);
        const key = this.key(seg.id, side);
        const oppSide: Side = side === 'L' ? 'R' : 'L';
        const oppKey = this.key(seg.id, oppSide);
        const blocked = bigBlocked.get(key) || new Set<number>();

        const endBuf = seg.pts.length >= 7 ? 1 : 0; // R1：长直段端点缓冲
        const step = this.randInt(strideMin, strideMax); // 2 或 3
        let phase = this.randInt(0, step - 1);
        let lastIdx = -999;

        for (let i = endBuf + phase; i < seg.pts.length - endBuf; i += step) {
          if (blocked.has(i) || blocked.has(i - 1)) continue; // R4
          if (i - lastIdx < 2) continue; // R1：同侧最小间距2

          // R2：对侧同 idx 不允许（错位>=1）
          if (chosen.has(this.slotKey(seg.id, oppSide, i))) continue;

          const road = seg.pts[i];
          const pos = new Vec2(road.x + normal.x, road.y + normal.y);
          if (!this.canPlace1x1(pos, params)) continue;

          chosen.add(this.slotKey(seg.id, side, i));
          if (!chosenBy.has(key)) chosenBy.set(key, new Set<number>());
          chosenBy.get(key)!.add(i);
          properties.push({ blockId: 'web3:property_1x1', gridPos: pos, size: 1, priceCoefficient: 1.0 });
          this.markOccupied(pos, 1);
          lastIdx = i;
        }
      }
    }

    // 拐角校正（R3）：仅针对 90° 转角，允许一次“间隔1”的组合
    this.applyCornerCorrection(outer, segments, properties);

    // R5：若不足，优先在短段补量；其次放宽短段端点缓冲
    const targetMin = params.smallTargetMin || 0;
    const smallCount = properties.filter(p => p.size === 1).length;
    if (smallCount < targetMin) {
      this.boostShortSegments(outer, segments, properties, chosenBy, bigBlocked, params, /*relaxEnd*/ false);
    }
    if (properties.filter(p => p.size === 1).length < targetMin) {
      this.boostShortSegments(outer, segments, properties, chosenBy, bigBlocked, params, /*relaxEnd*/ true);
    }

    return properties;
  }

  // ===== 段落与拐角 =====
  private segmentize(path: Vec2[]): Segment[] {
    const segs: Segment[] = [];
    if (path.length < 2) return segs;
    let start = 0;
    const dirOf = (i: number) => new Vec2(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
    let dir = dirOf(0);
    let id = 0;
    for (let i = 1; i < path.length - 1; i++) {
      const d = dirOf(i);
      if (d.x !== dir.x || d.y !== dir.y) {
        const pts = path.slice(start, i + 1); // 包含转角前最后一个点
        segs.push({ id: id++, pts, dir });
        start = i; dir = d;
      }
    }
    segs.push({ id: id++, pts: path.slice(start), dir });
    return segs;
  }

  private applyCornerCorrection(ring: BuiltRing, segs: Segment[], props: PropertyData[]) {
    // 建立快速索引：道路 -> 最近的 1x1 小地距离角点偏移
    const propKey = new Set(props.filter(p => p.size === 1).map(p => CoordUtils.posToKey(p.gridPos)));

    for (let s = 0; s < segs.length; s++) {
      const A = segs[s];
      const B = segs[(s + 1) % segs.length];
      const corner = A.pts[A.pts.length - 1]; // A 的终点 == B 的起点

      // 角点“度”：看周围4邻中有多少是道路
      const deg = CoordUtils.getNeighbors(corner).filter(n => this.roadSet.has(CoordUtils.posToKey(n))).length;

      // 最近的两侧小地：查找紧邻角点的 1x1
      const aIdx = this.findNearestSmallOnSegment(propKey, A, true);
      const bIdx = this.findNearestSmallOnSegment(propKey, B, false);
      if (aIdx == null || bIdx == null) continue;

      const distA = (A.pts.length - 1) - aIdx; // 距离角点
      const distB = bIdx;
      const d = distA + distB; // 跨角距离

      if (d <= 1) {
        const lenA = A.pts.length; const lenB = B.pts.length;
        const shortOK = Math.min(lenA, lenB) <= 5 && deg === 2; // 仅纯拐角允许
        if (d === 0 || !shortOK) {
          // 删除更靠近角点的一侧（或更短段）
          const dropFromA = distA <= distB || lenA <= lenB;
          const targetSeg = dropFromA ? A : B;
          const idx = dropFromA ? aIdx : bIdx;
          this.removeSmallAtIndex(propKey, props, targetSeg, idx, ring);
        }
        // else d==1 且满足短段条件 -> 可保留一次，不做处理（简化：不记录“已用名额”）
      }
    }
  }

  private findNearestSmallOnSegment(propKey: Set<string>, seg: Segment, fromEnd: boolean): number | null {
    if (fromEnd) {
      for (let i = seg.pts.length - 1; i >= 0; i--) {
        const road = seg.pts[i];
        const sides: Side[] = ['L', 'R'];
        for (const side of sides) {
          const normal = this.sideNormalFromDir(seg.dir, side);
          const pos = new Vec2(road.x + normal.x, road.y + normal.y);
          if (propKey.has(CoordUtils.posToKey(pos))) return i;
        }
      }
    } else {
      for (let i = 0; i < seg.pts.length; i++) {
        const road = seg.pts[i];
        const sides: Side[] = ['L', 'R'];
        for (const side of sides) {
          const normal = this.sideNormalFromDir(seg.dir, side);
          const pos = new Vec2(road.x + normal.x, road.y + normal.y);
          if (propKey.has(CoordUtils.posToKey(pos))) return i;
        }
      }
    }
    return null;
  }

  private removeSmallAtIndex(propKey: Set<string>, props: PropertyData[], seg: Segment, idx: number, ring: BuiltRing) {
    const road = seg.pts[idx];
    // 仅移除 1x1 小地，并且匹配任一侧
    for (let pi = 0; pi < props.length; pi++) {
      const p = props[pi];
      if (p.size !== 1) continue;
      if (Math.abs(p.gridPos.x - road.x) + Math.abs(p.gridPos.y - road.y) !== 1) continue; // 必须相邻
      // 移除
      propKey.delete(CoordUtils.posToKey(p.gridPos));
      props.splice(pi, 1);
      break;
    }
  }

  private boostShortSegments(
    ring: BuiltRing,
    segs: Segment[],
    props: PropertyData[],
    chosenBy: Map<string, Set<number>>, // 仅同侧最近已选索引
    bigBlocked: Map<string, Set<number>>,
    params: RuleParams,
    relaxEnd: boolean
  ) {
    const isSmall = (p: PropertyData) => p.size === 1;
    const have = new Set(props.filter(isSmall).map(p => CoordUtils.posToKey(p.gridPos)));

    for (const seg of segs) {
      if (seg.pts.length >= 7) continue; // 只在短段补
      const outerSide = this.getOuterSide(ring, seg);
      const sides: Side[] = [outerSide, outerSide === 'L' ? 'R' : 'L'];

      for (const side of sides) {
        const normal = this.sideNormalFromDir(seg.dir, side);
        const key = this.key(seg.id, side);
        const oppSide: Side = side === 'L' ? 'R' : 'L';
        const oppKey = this.key(seg.id, oppSide);
        const blocked = bigBlocked.get(key) || new Set<number>();
        const endBuf = relaxEnd ? 0 : (seg.pts.length >= 7 ? 1 : 0);

        for (let i = endBuf; i < seg.pts.length - endBuf; i++) {
          if (blocked.has(i) || blocked.has(i - 1)) continue;
          const set = chosenBy.get(key) || new Set<number>();
          // 同侧距≥2
          const near = [...set].some(idx => Math.abs(idx - i) < 2);
          if (near) continue;
          // 对侧不对脸
          const oppSet = chosenBy.get(oppKey) || new Set<number>();
          if (oppSet.has(i)) continue;

          const road = seg.pts[i];
          const pos = new Vec2(road.x + normal.x, road.y + normal.y);
          const k = CoordUtils.posToKey(pos);
          if (have.has(k) || !this.canPlace1x1(pos, params)) continue;

          props.push({ blockId: 'web3:property_1x1', gridPos: pos, size: 1, priceCoefficient: 1.0 });
          this.markOccupied(pos, 1);
          set.add(i); chosenBy.set(key, set); have.add(k);
        }
      }
    }
  }

  // ===== 几何/工具 =====
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

  private key(segId: number, side: Side) { return `${segId}|${side}`; }
  private slotKey(segId: number, side: Side, idx: number) { return `${segId}|${side}|${idx}`; }

  private sideNormalFromDir(dir: Vec2, side: Side): Vec2 {
    // 方向 -> 左法线
    const left = dir.x === 1 ? new Vec2(0, -1)
      : dir.x === -1 ? new Vec2(0, 1)
      : dir.y === 1 ? new Vec2(-1, 0)
      : new Vec2(1, 0);
    return side === 'L' ? left : new Vec2(-left.x, -left.y);
  }

  private getOuterSide(ring: BuiltRing, seg: Segment): Side {
    // 基于 bbox 判断外法线方向是否等于左法线，从而决定 outer 是 L 还是 R
    const sample = seg.pts[Math.floor(seg.pts.length / 2)];
    const left = this.sideNormalFromDir(seg.dir, 'L');
    const outward = this.getOutwardNormal(ring, sample, seg.dir);
    const isLeftOuter = (left.x === outward.x && left.y === outward.y);
    return isLeftOuter ? 'L' : 'R';
  }

  // 依据环的包围盒判断“外侧”，在四边各自有明确外法线
  private getOutwardNormal(ring: BuiltRing, cur: Vec2, dir: Vec2): Vec2 {
    if (dir.x !== 0) {
      if (cur.y <= ring.bbox.top) return new Vec2(0, -1);
      if (cur.y >= ring.bbox.bottom) return new Vec2(0, 1);
      const cy = (ring.bbox.top + ring.bbox.bottom) / 2;
      return cur.y < cy ? new Vec2(0, -1) : new Vec2(0, 1);
    }
    if (cur.x <= ring.bbox.left) return new Vec2(-1, 0);
    if (cur.x >= ring.bbox.right) return new Vec2(1, 0);
    const cx = (ring.bbox.left + ring.bbox.right) / 2;
    return cur.x < cx ? new Vec2(-1, 0) : new Vec2(1, 0);
  }
}
