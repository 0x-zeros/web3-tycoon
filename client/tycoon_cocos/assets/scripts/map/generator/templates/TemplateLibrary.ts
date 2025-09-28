/**
 * 地图模板库 - 基于大富翁11的8个经典地图
 */

import { Vec2 } from 'cc';
import { MapTemplateSpec, PropertyGroupDef, SpecialTileConfig } from './TemplateTypes';

// 通用的地产组配置
const STANDARD_PROPERTY_GROUPS: PropertyGroupDef[] = [
  { color: 'brown', count: 2, size: '1x1', preferredZone: 'corner' },
  { color: 'lightblue', count: 3, size: '1x1', preferredZone: 'straight' },
  { color: 'pink', count: 3, size: '1x1', preferredZone: 'straight' },
  { color: 'orange', count: 3, size: '1x1', preferredZone: 'any' },
  { color: 'red', count: 3, size: '2x2', preferredZone: 'corner' },
  { color: 'yellow', count: 3, size: '1x1', preferredZone: 'straight' },
  { color: 'green', count: 3, size: '2x2', preferredZone: 'straight' },
  { color: 'blue', count: 2, size: '2x2', preferredZone: 'corner' }
];

// 通用的特殊格子配置
const STANDARD_SPECIAL_TILES: SpecialTileConfig[] = [
  { type: 'chance', count: 4, distribution: 'even' },
  { type: 'hospital', count: 1, distribution: 'random' },
  { type: 'shop', count: 2, distribution: 'even' },
  { type: 'bank', count: 1, distribution: 'random' },
  { type: 'news', count: 3, distribution: 'even' },
  { type: 'bonus', count: 2, distribution: 'even' },
  { type: 'fee', count: 2, distribution: 'random' }
];

/**
 * 模板1: 水乡 - 蛇形水道布局
 */
export const TEMPLATE_WATER_TOWN: MapTemplateSpec = {
  id: 'water_town',
  name: '水乡',
  layout: 'snake',
  tileCount: 52,

  pathConfig: {
    mainPath: [
      { pos: new Vec2(2, 2), type: 'corner', connections: [1] },
      { pos: new Vec2(10, 2), type: 'normal', connections: [0, 2] },
      { pos: new Vec2(20, 2), type: 'normal', connections: [1, 3] },
      { pos: new Vec2(30, 2), type: 'corner', connections: [2, 4] },
      { pos: new Vec2(30, 8), type: 'normal', connections: [3, 5] },
      { pos: new Vec2(30, 14), type: 'corner', connections: [4, 6] },
      { pos: new Vec2(20, 14), type: 'normal', connections: [5, 7] },
      { pos: new Vec2(10, 14), type: 'normal', connections: [6, 8] },
      { pos: new Vec2(2, 14), type: 'corner', connections: [7, 9] },
      { pos: new Vec2(2, 20), type: 'normal', connections: [8, 10] },
      { pos: new Vec2(2, 26), type: 'corner', connections: [9, 11] },
      { pos: new Vec2(10, 26), type: 'normal', connections: [10, 12] },
      { pos: new Vec2(20, 26), type: 'normal', connections: [11, 13] },
      { pos: new Vec2(30, 26), type: 'corner', connections: [12, 14] },
      { pos: new Vec2(30, 32), type: 'normal', connections: [13, 15] },
      { pos: new Vec2(30, 38), type: 'corner', connections: [14, 16] },
      { pos: new Vec2(20, 38), type: 'normal', connections: [15, 17] },
      { pos: new Vec2(10, 38), type: 'normal', connections: [16, 18] },
      { pos: new Vec2(2, 38), type: 'corner', connections: [17, 0] }
    ]
  },

  propertyConfig: {
    groups: STANDARD_PROPERTY_GROUPS,
    totalRatio: 0.5,
    placement: 'grouped'
  },

  specialTiles: STANDARD_SPECIAL_TILES,

  generationHints: {
    minSpacing: 2,
    avoidParallel: true,
    symmetry: 'none'
  }
};

/**
 * 模板2: 天使岛 - 双环交叉
 */
export const TEMPLATE_ANGEL_ISLAND: MapTemplateSpec = {
  id: 'angel_island',
  name: '天使岛',
  layout: 'double_loop',
  tileCount: 48,

  pathConfig: {
    rings: {
      outer: [
        new Vec2(2, 2), new Vec2(37, 2),
        new Vec2(37, 37), new Vec2(2, 37)
      ],
      inner: [
        new Vec2(12, 12), new Vec2(27, 12),
        new Vec2(27, 27), new Vec2(12, 27)
      ],
      bridges: 2
    }
  },

  propertyConfig: {
    groups: STANDARD_PROPERTY_GROUPS,
    totalRatio: 0.45,
    placement: 'grouped'
  },

  specialTiles: STANDARD_SPECIAL_TILES,

  generationHints: {
    minSpacing: 2,
    avoidParallel: true,
    symmetry: 'axial'
  }
};

/**
 * 模板3: 音乐之都 - 音符形状
 */
export const TEMPLATE_MUSIC_CITY: MapTemplateSpec = {
  id: 'music_city',
  name: '音乐之都',
  layout: 'musical_note',
  tileCount: 44,

  pathConfig: {
    mainPath: [
      // 主环部分
      { pos: new Vec2(10, 10), type: 'corner', connections: [1, 15] },
      { pos: new Vec2(20, 10), type: 'normal', connections: [0, 2] },
      { pos: new Vec2(30, 10), type: 'corner', connections: [1, 3] },
      { pos: new Vec2(30, 20), type: 'normal', connections: [2, 4] },
      { pos: new Vec2(30, 30), type: 'corner', connections: [3, 5] },
      { pos: new Vec2(20, 30), type: 'normal', connections: [4, 6] },
      { pos: new Vec2(10, 30), type: 'corner', connections: [5, 7] },
      { pos: new Vec2(10, 20), type: 'normal', connections: [6, 0] }
    ],
    subPaths: [
      // 音符的小圆圈部分1
      [
        { pos: new Vec2(5, 5), type: 'corner', connections: [1] },
        { pos: new Vec2(15, 5), type: 'corner', connections: [0, 2] },
        { pos: new Vec2(15, 15), type: 'corner', connections: [1, 3] },
        { pos: new Vec2(5, 15), type: 'corner', connections: [2, 0] }
      ],
      // 音符的小圆圈部分2
      [
        { pos: new Vec2(25, 25), type: 'corner', connections: [1] },
        { pos: new Vec2(35, 25), type: 'corner', connections: [0, 2] },
        { pos: new Vec2(35, 35), type: 'corner', connections: [1, 3] },
        { pos: new Vec2(25, 35), type: 'corner', connections: [2, 0] }
      ]
    ]
  },

  propertyConfig: {
    groups: STANDARD_PROPERTY_GROUPS,
    totalRatio: 0.45,
    placement: 'mixed'
  },

  specialTiles: STANDARD_SPECIAL_TILES
};

/**
 * 模板4: 云上庭院 - 田字格布局
 */
export const TEMPLATE_CLOUD_GARDEN: MapTemplateSpec = {
  id: 'cloud_garden',
  name: '云上庭院',
  layout: 'grid',
  tileCount: 46,

  pathConfig: {
    grid: {
      rows: 3,
      cols: 3,
      connectivity: 'cross'
    },
    rings: {
      outer: [
        new Vec2(5, 5), new Vec2(35, 5),
        new Vec2(35, 35), new Vec2(5, 35)
      ]
    }
  },

  propertyConfig: {
    groups: STANDARD_PROPERTY_GROUPS,
    totalRatio: 0.5,
    placement: 'grouped'
  },

  specialTiles: STANDARD_SPECIAL_TILES,

  generationHints: {
    minSpacing: 2,
    symmetry: 'axial'
  }
};

/**
 * 模板5: 音乐之都II - 双环嵌套
 */
export const TEMPLATE_MUSIC_CITY_2: MapTemplateSpec = {
  id: 'music_city_2',
  name: '音乐之都II',
  layout: 'nested_loops',
  tileCount: 50,

  pathConfig: {
    rings: {
      outer: [
        new Vec2(2, 2), new Vec2(38, 2),
        new Vec2(38, 28), new Vec2(2, 28)
      ],
      inner: [
        new Vec2(10, 10), new Vec2(30, 10),
        new Vec2(30, 20), new Vec2(10, 20)
      ],
      bridges: 2
    }
  },

  propertyConfig: {
    groups: STANDARD_PROPERTY_GROUPS,
    totalRatio: 0.5,
    placement: 'grouped'
  },

  specialTiles: STANDARD_SPECIAL_TILES
};

/**
 * 模板6: 绵绘时代 - 完整田字格
 */
export const TEMPLATE_PICTURE_ERA: MapTemplateSpec = {
  id: 'picture_era',
  name: '绵绘时代',
  layout: 'full_grid',
  tileCount: 54,

  pathConfig: {
    grid: {
      rows: 4,
      cols: 4,
      connectivity: 'full'
    }
  },

  propertyConfig: {
    groups: [
      ...STANDARD_PROPERTY_GROUPS,
      { color: 'purple', count: 4, size: '1x1', preferredZone: 'intersection' }
    ],
    totalRatio: 0.55,
    placement: 'scattered'
  },

  specialTiles: [
    ...STANDARD_SPECIAL_TILES,
    { type: 'card', count: 2, distribution: 'random' }
  ],

  generationHints: {
    minSpacing: 2,
    symmetry: 'radial'
  }
};

/**
 * 模板7: 火山古迹 - 复杂网格
 */
export const TEMPLATE_VOLCANO_RELIC: MapTemplateSpec = {
  id: 'volcano_relic',
  name: '火山古迹',
  layout: 'complex_grid',
  tileCount: 56,

  pathConfig: {
    grid: {
      rows: 5,
      cols: 4,
      connectivity: 'partial'
    },
    mainPath: [
      // 不规则的主路径
      { pos: new Vec2(5, 5), type: 'corner', connections: [1] },
      { pos: new Vec2(15, 5), type: 'intersection', connections: [0, 2, 5] },
      { pos: new Vec2(25, 5), type: 'intersection', connections: [1, 3, 6] },
      { pos: new Vec2(35, 5), type: 'corner', connections: [2, 4] },
      { pos: new Vec2(35, 15), type: 'intersection', connections: [3, 7, 8] },
      { pos: new Vec2(15, 15), type: 'intersection', connections: [1, 6, 9] },
      { pos: new Vec2(25, 15), type: 'intersection', connections: [2, 5, 10] },
      { pos: new Vec2(35, 25), type: 'intersection', connections: [4, 11] },
      { pos: new Vec2(35, 35), type: 'corner', connections: [7, 12] },
      { pos: new Vec2(15, 25), type: 'intersection', connections: [5, 10, 13] },
      { pos: new Vec2(25, 25), type: 'intersection', connections: [6, 9, 14] },
      { pos: new Vec2(35, 25), type: 'corner', connections: [7, 15] },
      { pos: new Vec2(25, 35), type: 'corner', connections: [8, 13] },
      { pos: new Vec2(15, 35), type: 'corner', connections: [9, 12, 14] },
      { pos: new Vec2(5, 35), type: 'corner', connections: [10, 13, 15] },
      { pos: new Vec2(5, 15), type: 'corner', connections: [11, 14, 0] }
    ]
  },

  propertyConfig: {
    groups: [
      ...STANDARD_PROPERTY_GROUPS,
      { color: 'volcanic', count: 3, size: '2x2', preferredZone: 'any' }
    ],
    totalRatio: 0.6,
    placement: 'mixed'
  },

  specialTiles: [
    ...STANDARD_SPECIAL_TILES,
    { type: 'fee', count: 3, distribution: 'clustered' }
  ]
};

/**
 * 模板8: 经典方形 - 传统大富翁
 */
export const TEMPLATE_CLASSIC_SQUARE: MapTemplateSpec = {
  id: 'classic_square',
  name: '经典方形',
  layout: 'single_ring',
  tileCount: 40,

  pathConfig: {
    rings: {
      outer: [
        new Vec2(5, 5), new Vec2(35, 5),
        new Vec2(35, 35), new Vec2(5, 35)
      ]
    }
  },

  propertyConfig: {
    groups: STANDARD_PROPERTY_GROUPS.slice(0, 8), // 使用前8个颜色组
    totalRatio: 0.55,
    placement: 'grouped'
  },

  specialTiles: [
    { type: 'chance', count: 3, distribution: 'even' },
    { type: 'hospital', count: 1, distribution: 'random' },
    { type: 'shop', count: 2, distribution: 'even' },
    { type: 'bank', count: 1, distribution: 'random' },
    { type: 'bonus', count: 2, distribution: 'even' }
  ],

  generationHints: {
    minSpacing: 2,
    symmetry: 'radial'
  }
};

/**
 * 模板池 - 所有可用的模板
 */
export const MONOPOLY_TEMPLATES = [
  TEMPLATE_WATER_TOWN,
  TEMPLATE_ANGEL_ISLAND,
  TEMPLATE_MUSIC_CITY,
  TEMPLATE_CLOUD_GARDEN,
  TEMPLATE_MUSIC_CITY_2,
  TEMPLATE_PICTURE_ERA,
  TEMPLATE_VOLCANO_RELIC,
  TEMPLATE_CLASSIC_SQUARE
];

/**
 * 根据ID获取模板
 */
export function getTemplateById(id: string): MapTemplateSpec | null {
  return MONOPOLY_TEMPLATES.find(t => t.id === id) || null;
}

/**
 * 获取随机模板
 */
export function getRandomTemplate(seed?: number): MapTemplateSpec {
  const s = seed || Date.now();
  const index = Math.abs((s * 9301 + 49297) % 233280) % MONOPOLY_TEMPLATES.length;
  return MONOPOLY_TEMPLATES[index];
}

/**
 * 获取模板列表（用于UI展示）
 */
export function getTemplateList(): Array<{ id: string; name: string; tileCount: number }> {
  return MONOPOLY_TEMPLATES.map(t => ({
    id: t.id,
    name: t.name,
    tileCount: t.tileCount
  }));
}

// 保留旧的函数用于兼容
export function getDefaultClassicTemplate(index?: number): MapTemplateSpec {
  if (index !== undefined) {
    return MONOPOLY_TEMPLATES[Math.abs(index) % MONOPOLY_TEMPLATES.length];
  }
  return getRandomTemplate();
}