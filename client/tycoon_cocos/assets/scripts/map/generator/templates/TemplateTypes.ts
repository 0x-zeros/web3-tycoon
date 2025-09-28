import { Vec2 } from 'cc';

export type RingKind = 'outer' | 'inner' | 'spur';

export interface RingSpec {
  kind: RingKind;
  verts: Array<[number, number]>; // 顶点（模板坐标，后续会做jitter与裁剪）
  jitter?: [number, number]; // [min,max] 单轴抖动范围（格）
}

export interface BridgeSpec {
  from: string; // 格式 outer@1/inner@3 等，索引是相对分段位置的锚点提示
  to: string;
  len?: [number, number];
}

export interface QuotasSpec {
  smallLand?: { ratio?: [number, number]; side?: 'outer-prefer' | 'either'; stride?: [number, number] };
  big2x2?: { count?: [number, number]; minStraight?: number; minSpacing?: number };
}

export interface MapTemplateSpec {
  id: string;
  rings: RingSpec[];
  bridges?: BridgeSpec[];
  quotas?: QuotasSpec;
}

export interface BuiltRing {
  kind: RingKind;
  path: Vec2[]; // 环路径（按顺序，闭合）
  bbox: { left: number; right: number; top: number; bottom: number };
}

export interface TemplateBuildResult {
  rings: BuiltRing[];
  roads: Vec2[];
  // 额外：便于规则布置地产
  ringIndexByKey: Map<string, number>; // roadKey -> ringIdx（桥接与交叉可能不在环内，不一定都有映射）
}

