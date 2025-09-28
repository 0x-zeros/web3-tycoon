import { MapTemplateSpec } from './TemplateTypes';

// T1: 双环结构 + 2桥接（经典模板）
export const TEMPLATE_T1: MapTemplateSpec = {
  id: 'DoubleRing+2Bridges',
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

// T2: 单环结构（传统大富翁风格）
export const TEMPLATE_T2: MapTemplateSpec = {
  id: 'SingleRing',
  rings: [
    {
      kind: 'outer',
      // 更接近正方形的单环
      verts: [[2, 2], [35, 1], [37, 36], [3, 38]],
      jitter: [2, 4] // 更大的抖动范围
    }
  ],
  bridges: [],
  quotas: {
    smallLand: { ratio: [0.60, 0.70], side: 'outer-prefer', stride: [2, 3] },
    big2x2: { count: [4, 6], minStraight: 6, minSpacing: 5 }
  }
};

// T3: 大外环 + 小内环 + 3桥接
export const TEMPLATE_T3: MapTemplateSpec = {
  id: 'LargeOuter+SmallInner+3Bridges',
  rings: [
    {
      kind: 'outer',
      // 大外环，接近地图边缘
      verts: [[-1, -1], [39, -2], [40, 40], [-2, 39]],
      jitter: [0, 2] // 较小抖动，避免超出边界
    },
    {
      kind: 'inner',
      // 小内环
      verts: [[14, 12], [24, 13], [25, 25], [13, 24]],
      jitter: [1, 3]
    }
  ],
  bridges: [
    { from: 'outer@1', to: 'inner@1', len: [4, 6] },
    { from: 'outer@2', to: 'inner@2', len: [3, 5] },
    { from: 'outer@3', to: 'inner@3', len: [4, 6] }
  ],
  quotas: {
    smallLand: { ratio: [0.50, 0.60], side: 'outer-prefer', stride: [2, 4] },
    big2x2: { count: [2, 4], minStraight: 8, minSpacing: 7 }
  }
};

// T4: 不规则双环
export const TEMPLATE_T4: MapTemplateSpec = {
  id: 'IrregularDoubleRing',
  rings: [
    {
      kind: 'outer',
      // 不规则外环
      verts: [[3, 1], [30, 2], [38, 8], [36, 35], [8, 38], [1, 20]],
      jitter: [1, 3]
    },
    {
      kind: 'inner',
      // 偏心的内环
      verts: [[10, 8], [25, 6], [28, 20], [20, 28], [8, 25]],
      jitter: [1, 2]
    }
  ],
  bridges: [
    { from: 'outer@2', to: 'inner@4', len: [3, 5] },
    { from: 'outer@4', to: 'inner@2', len: [4, 6] }
  ],
  quotas: {
    smallLand: { ratio: [0.55, 0.65], side: 'either', stride: [2, 3] },
    big2x2: { count: [3, 5], minStraight: 6, minSpacing: 6 }
  }
};

// T5: 方形单环变体
export const TEMPLATE_T5: MapTemplateSpec = {
  id: 'SquareRing',
  rings: [
    {
      kind: 'outer',
      // 几乎完美的方形，带轻微变化
      verts: [[5, 5], [33, 4], [34, 33], [4, 34]],
      jitter: [0, 1] // 极小抖动，保持方形
    }
  ],
  bridges: [],
  quotas: {
    smallLand: { ratio: [0.65, 0.75], side: 'outer-prefer', stride: [2, 3] },
    big2x2: { count: [4, 4], minStraight: 8, minSpacing: 8 } // 四角各一个大地产
  }
};

// 模板池
const TEMPLATE_POOL = [TEMPLATE_T1, TEMPLATE_T2, TEMPLATE_T3, TEMPLATE_T4, TEMPLATE_T5];

// 获取随机模板
export function getDefaultClassicTemplate(index?: number): MapTemplateSpec {
  // 如果提供了索引，直接使用
  if (index !== undefined) {
    return TEMPLATE_POOL[Math.abs(index) % TEMPLATE_POOL.length];
  }

  // 否则使用时间戳作为基础随机性
  const seed = Date.now();
  const randomIndex = Math.floor((seed * 9301 + 49297) % 233280) % TEMPLATE_POOL.length;
  return TEMPLATE_POOL[Math.abs(randomIndex)];
}

