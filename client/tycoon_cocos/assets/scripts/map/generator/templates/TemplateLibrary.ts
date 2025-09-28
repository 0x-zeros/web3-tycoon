import { MapTemplateSpec } from './TemplateTypes';

// T1: OuterRing + InnerRing + 2 Bridges（默认 classic 模板）
export const TEMPLATE_T1: MapTemplateSpec = {
  id: 'OuterRing+Inner+2Bridges',
  rings: [
    {
      kind: 'outer',
      // 稍微不规则的矩形
      verts: [[0, 0], [36, 0], [38, 10], [10, 12], [-2, 6]],
      jitter: [1, 3]
    },
    {
      kind: 'inner',
      verts: [[8, 4], [28, 3], [30, 9], [12, 10]],
      jitter: [1, 2]
    }
  ],
  bridges: [
    { from: 'outer@1', to: 'inner@3', len: [3, 6] },
    { from: 'outer@3', to: 'inner@1', len: [4, 6] }
  ],
  quotas: {
    smallLand: { ratio: [0.55, 0.65], side: 'outer-prefer', stride: [2, 3] },
    big2x2: { count: [3, 5], minStraight: 7, minSpacing: 6 }
  }
};

// 预留：T2/T3 可后续补充

export function getDefaultClassicTemplate(): MapTemplateSpec {
  return TEMPLATE_T1;
}

