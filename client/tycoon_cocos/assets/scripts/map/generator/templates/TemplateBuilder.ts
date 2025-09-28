import { Vec2 } from 'cc';
import { CoordUtils } from '../MapGeneratorTypes';
import { MapTemplateSpec, BuiltRing, TemplateBuildResult } from './TemplateTypes';

export class TemplateBuilder {
  private width: number;
  private height: number;
  private random: () => number;

  constructor(width: number, height: number, random: () => number) {
    this.width = width; this.height = height; this.random = random;
  }

  build(template: MapTemplateSpec): TemplateBuildResult {
    const ringIndexByKey = new Map<string, number>();
    const rings: BuiltRing[] = [];
    const roadSet = new Set<string>();

    // 1) 构建各环
    template.rings.forEach((ring, idx) => {
      const verts = ring.verts.map(([x, y]) => new Vec2(x, y));
      const jitter = ring.jitter || [0, 0];

      // 抖动 & 裁剪到地图内
      const jittered = verts.map(v => this.clamp(this.jitter(v, jitter[0], jitter[1])));

      const path: Vec2[] = [];
      for (let i = 0; i < jittered.length; i++) {
        const a = jittered[i];
        const b = jittered[(i + 1) % jittered.length];
        const seg = this.drawManhattan(a, b);
        // 追加（避免重复点）
        if (path.length > 0 && seg.length > 0 && path[path.length - 1].equals(seg[0])) seg.shift();
        path.push(...seg);
      }

      // 去重填入 roadSet，并记录映射
      for (const p of path) {
        const k = CoordUtils.posToKey(p);
        roadSet.add(k);
        ringIndexByKey.set(k, idx);
      }

      const xs = path.map(p => p.x); const ys = path.map(p => p.y);
      const bbox = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
      rings.push({ kind: ring.kind, path, bbox });
    });

    // 2) 桥接
    for (const br of template.bridges || []) {
      const p1 = this.pickRingAnchor(rings, br.from);
      const p2 = this.pickRingAnchor(rings, br.to);
      if (!p1 || !p2) continue;
      const seg = this.drawManhattan(p1, p2);
      for (const p of seg) roadSet.add(CoordUtils.posToKey(p));
    }

    // 3) 去平行：避免长度>6且间距=1的双平行通道
    this.breakLongParallels(rings, roadSet);

    const roads = Array.from(roadSet).map(k => CoordUtils.keyToPos(k));
    return { rings, roads, ringIndexByKey };
  }

  private randInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  private jitter(v: Vec2, jmin: number, jmax: number): Vec2 {
    if (jmax <= 0) return v.clone();
    const jx = this.randInt(jmin, jmax) * (this.random() < 0.5 ? -1 : 1);
    const jy = this.randInt(jmin, jmax) * (this.random() < 0.5 ? -1 : 1);
    return new Vec2(v.x + jx, v.y + jy);
  }

  private clamp(v: Vec2): Vec2 {
    return new Vec2(
      Math.max(1, Math.min(this.width - 2, Math.floor(v.x))),
      Math.max(1, Math.min(this.height - 2, Math.floor(v.y)))
    );
  }

  // 曼哈顿折线：先水平后垂直（或反之随机），保证走格
  private drawManhattan(a: Vec2, b: Vec2): Vec2[] {
    const pts: Vec2[] = [];
    const horizFirst = this.random() < 0.5;
    const mid = horizFirst ? new Vec2(b.x, a.y) : new Vec2(a.x, b.y);
    pts.push(...this.drawLine(a, mid));
    const tail = this.drawLine(mid, b);
    if (pts.length > 0 && tail.length > 0 && pts[pts.length - 1].equals(tail[0])) tail.shift();
    pts.push(...tail);
    return pts;
  }

  // 轴对齐直线（包含端点）
  private drawLine(a: Vec2, b: Vec2): Vec2[] {
    const pts: Vec2[] = [];
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    let x = a.x, y = a.y;
    while (true) {
      const p = this.clamp(new Vec2(x, y));
      if (pts.length === 0 || !pts[pts.length - 1].equals(p)) pts.push(p);
      if (x === b.x && y === b.y) break;
      if (dx !== 0) x += dx; else y += dy;
    }
    return pts;
  }

  private pickRingAnchor(rings: BuiltRing[], ref: string): Vec2 | null {
    // outer@1, inner@3 之类；@n 表示等分段的第 n 个锚（1 基）
    const [kind, idxStr] = ref.split('@');
    const ringIdx = rings.findIndex(r => r.kind === (kind as any));
    if (ringIdx < 0) return null;
    const path = rings[ringIdx].path;
    const div = 4; // 简化：四分位
    const slot = Math.max(1, Math.min(div, parseInt(idxStr || '1', 10)));
    const i = Math.floor((slot / div) * path.length) % path.length;
    return path[i].clone();
  }

  // ====== Anti-parallelization ======
  private breakLongParallels(rings: BuiltRing[], roadSet: Set<string>) {
    const minLen = 7; // 连续长度阈值
    const bumpLen = () => this.randInt(2, 3);

    const segments = (r: BuiltRing) => this.segmentize(r.path);
    const segsByRing = rings.map(r => segments(r));

    // 仅处理 outer vs inner 的对
    const outerIdx = rings.findIndex(r => r.kind === 'outer');
    const innerIdx = rings.findIndex(r => r.kind === 'inner');
    if (outerIdx < 0 || innerIdx < 0) return;
    const outerSegs = segsByRing[outerIdx];
    const innerSegs = segsByRing[innerIdx];

    // 检测水平/垂直平行且间距=1（即中心距2格）
    for (const a of outerSegs) {
      for (const b of innerSegs) {
        // 水平
        if (a.dir.y === 0 && b.dir.y === 0) {
          const dy = b.pts[0].y - a.pts[0].y; // 可能不等，但若平行应近似常数
          if (Math.abs(dy) === 2) {
            const ov = this.overlapRange(a.pts.map(p => p.x), b.pts.map(p => p.x));
            if (ov && ov.len >= minLen) {
              const midX = ov.start + Math.floor(ov.len / 2);
              const base = new Vec2(midX, b.pts[0].y);
              const away = dy > 0 ? 1 : -1; // 朝远离outer方向
              this.applyBump(roadSet, base, new Vec2(1, 0), new Vec2(0, away), bumpLen());
            }
          }
        }
        // 垂直
        if (a.dir.x === 0 && b.dir.x === 0) {
          const dx = b.pts[0].x - a.pts[0].x;
          if (Math.abs(dx) === 2) {
            const ov = this.overlapRange(a.pts.map(p => p.y), b.pts.map(p => p.y));
            if (ov && ov.len >= minLen) {
              const midY = ov.start + Math.floor(ov.len / 2);
              const base = new Vec2(b.pts[0].x, midY);
              const away = dx > 0 ? 1 : -1;
              this.applyBump(roadSet, base, new Vec2(0, 1), new Vec2(away, 0), bumpLen());
            }
          }
        }
      }
    }
  }

  private segmentize(path: Vec2[]): { pts: Vec2[]; dir: Vec2 }[] {
    const segs: { pts: Vec2[]; dir: Vec2 }[] = [];
    if (path.length < 2) return segs;
    const dirOf = (i: number) => new Vec2(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
    let start = 0; let dir = dirOf(0);
    for (let i = 1; i < path.length - 1; i++) {
      const d = dirOf(i);
      if (d.x !== dir.x || d.y !== dir.y) {
        segs.push({ pts: path.slice(start, i + 1), dir });
        start = i; dir = d;
      }
    }
    segs.push({ pts: path.slice(start), dir });
    return segs;
  }

  private overlapRange(a: number[], b: number[]): { start: number; len: number } | null {
    const aMin = Math.min(...a), aMax = Math.max(...a);
    const bMin = Math.min(...b), bMax = Math.max(...b);
    const start = Math.max(aMin, bMin);
    const end = Math.min(aMax, bMax);
    if (end - start + 1 >= 1) return { start, len: end - start + 1 };
    return null;
  }

  // 在 base 位置做一次“凹/凸”绕行：先沿 normal 1 格，再沿 axis 走 len，再回到原线
  private applyBump(roadSet: Set<string>, base: Vec2, axis: Vec2, normal: Vec2, len: number) {
    const p1 = this.advance(base, normal, 1);
    const p2 = this.advance(p1, axis, len);
    const p3 = this.advance(p2, new Vec2(-normal.x, -normal.y), 1);
    const seg1 = this.drawLine(base, p1);
    const seg2 = this.drawLine(p1, p2);
    const seg3 = this.drawLine(p2, p3);
    for (const p of [...seg1, ...seg2, ...seg3]) roadSet.add(CoordUtils.posToKey(p));
  }
}
