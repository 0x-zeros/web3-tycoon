import { Vec2 } from 'cc';

/**
 * 地图布局类型
 */
export type MapLayoutType =
  | 'snake'           // 蛇形/S形
  | 'double_loop'     // 双环交叉
  | 'musical_note'    // 音符形状
  | 'grid'            // 田字格
  | 'nested_loops'    // 嵌套环
  | 'full_grid'       // 完整网格
  | 'complex_grid'    // 复杂网格
  | 'single_ring';    // 单环

/**
 * 路径节点定义
 */
export interface PathNode {
  pos: Vec2;           // 位置
  type: 'normal' | 'corner' | 'intersection' | 'bridge';  // 节点类型
  connections: number[]; // 连接的其他节点索引
}

/**
 * 地产组定义
 */
export interface PropertyGroupDef {
  color: string;       // 颜色标识
  count: number;       // 地产数量
  size: '1x1' | '2x2'; // 地产大小
  preferredZone?: 'corner' | 'straight' | 'any'; // 偏好位置
}

/**
 * 特殊格子配置
 */
export interface SpecialTileConfig {
  type: 'hospital' | 'shop' | 'bank' | 'chance' | 'news' | 'bonus' | 'fee' | 'card';
  count: number;       // 数量
  distribution: 'even' | 'clustered' | 'random'; // 分布方式
}

/**
 * 地图模板规格
 */
export interface MapTemplateSpec {
  id: string;          // 模板ID
  name: string;        // 模板名称
  layout: MapLayoutType; // 布局类型
  tileCount: number;   // 格子总数

  // 路径定义
  pathConfig: {
    mainPath?: PathNode[];     // 主路径节点
    subPaths?: PathNode[][];   // 子路径
    rings?: {                  // 环形定义
      outer?: Vec2[];          // 外环顶点
      inner?: Vec2[];          // 内环顶点
      bridges?: number;        // 桥接数量
    };
    grid?: {                   // 网格定义
      rows: number;
      cols: number;
      connectivity: 'full' | 'cross' | 'partial';
    };
  };

  // 地产配置
  propertyConfig: {
    groups: PropertyGroupDef[]; // 地产组定义
    totalRatio: number;         // 地产占比 (0.4-0.6)
    placement: 'grouped' | 'scattered' | 'mixed'; // 放置策略
  };

  // 特殊格子配置
  specialTiles: SpecialTileConfig[];

  // 指定位置的特殊格子（用于1:1复刻。若提供，则优先放置这些固定点）
  fixedSpecialTiles?: Array<{
    type: 'hospital' | 'shop' | 'bank' | 'chance' | 'news' | 'bonus' | 'fee' | 'card' | 'teleport';
    positions: Array<[number, number]>; // [x,y] 网格坐标
  }>;

  // 生成参数
  generationHints?: {
    minSpacing?: number;        // 最小间隔
    avoidParallel?: boolean;    // 避免平行
    symmetry?: 'none' | 'axial' | 'radial'; // 对称性
  };

  // 预览图（可选）
  thumbnail?: string;
}

// 保留旧的接口用于兼容
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
