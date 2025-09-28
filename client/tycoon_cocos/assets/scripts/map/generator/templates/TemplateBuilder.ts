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
}

