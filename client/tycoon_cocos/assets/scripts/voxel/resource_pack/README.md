# Resource Pack 解析系统

这是一个完整的 Minecraft Resource Pack 解析系统，严格按照设计文档实现，支持完整的 blockstate → model chain → textures → elements 解析链。

## 系统特性

- ✅ **完整的解析链**：从 blockstate 到最终的几何元素
- ✅ **命名空间支持**：支持 `minecraft` 和 `web3` 命名空间
- ✅ **模型继承**：完整的 parent 链解析
- ✅ **纹理变量解析**：支持 `#var` 变量引用
- ✅ **内置模板**：支持所有常见的 Minecraft 模型模板
- ✅ **缓存机制**：提高重复解析的性能
- ✅ **调试信息**：包含完整的解析路径和中间数据

## 文件结构

```
resource_pack/
├── types.ts              # 类型定义
├── utils.ts              # 工具函数
├── ResourceLoader.ts     # 资源加载器
├── TemplateProcessor.ts  # 模板处理器
├── BlockParser.ts        # 核心解析器
├── index.ts             # 主入口
├── Example.ts           # 使用示例
└── README.md            # 本文档
```

## 快速开始

### 基本使用

```typescript
import { parseBlock } from './resource_pack';

// 解析 Minecraft 方块
const stoneData = await parseBlock('stone');
const grassData = await parseBlock('minecraft:grass_block');

// 解析 Web3 方块
const propertyData = await parseBlock('web3:property');
```

### 批量解析

```typescript
import { parseBlocks } from './resource_pack';

const blockIds = [
    'minecraft:stone',
    'minecraft:oak_log',
    'web3:empty_land'
];

const results = await parseBlocks(blockIds);
```

### 预加载常用方块

```typescript
import { preloadCommonBlocks } from './resource_pack';

// 预加载以提高后续解析性能
await preloadCommonBlocks();
```

## 数据结构

### ParsedBlockData

解析后的方块数据包含以下信息：

```typescript
{
    id: NamespacedId;           // 命名空间ID
    shortId: string;            // 短ID（不含命名空间）
    rotationY?: number;         // Y轴旋转角度
    modelTemplate?: string;     // 模型模板类型
    elements: ElementDef[];     // 几何元素数组
    textures: TextureInfo[];    // 纹理信息数组
    debug: {                    // 调试信息
        blockstatePath?: string;
        modelChainPaths: string[];
        combinedJson: CombinedJson;
    };
}
```

## 命名空间策略

1. **规范化 ID**：所有 blockId 统一转成 `{namespace, path}` 形式
2. **默认命名空间**：未指定时默认为 `minecraft`
3. **相对引用**：JSON 中的引用先尝试当前命名空间，找不到再回退到 `minecraft`

## 支持的模型模板

- `cube_all` - 所有面使用相同纹理
- `cube_column` - 顶底面和侧面使用不同纹理
- `cube_bottom_top` - 顶、底、侧面分别使用不同纹理
- `cross` - 交叉平面（花草等）
- `tinted_cross` - 带颜色的交叉平面
- `orientable` - 可定向方块（熔炉等）
- `cube` - 每个面可以有不同纹理

## 资源包位置

资源包文件位于：`assets/resources/voxel/resource_pack/`

目录结构：
```
resource_pack/
└── assets/
    ├── minecraft/          # Minecraft 命名空间
    │   ├── blockstates/    # 方块状态文件
    │   ├── models/         # 模型文件
    │   └── textures/       # 纹理文件
    └── web3/              # Web3 命名空间
        ├── blockstates/
        ├── models/
        └── textures/
```

## 高级配置

```typescript
import { BlockParser } from './resource_pack';

// 创建自定义解析器
const parser = new BlockParser({
    rootDir: 'voxel/resource_pack',
    searchRoots: [
        'voxel/resource_pack',
        'voxel/fallback'
    ],
    defaultNamespace: 'web3'
});

// 使用自定义解析器
const data = await parser.parseBlock('empty_land');
```

## 性能优化

- 使用 `preloadCommonBlocks()` 预加载常用方块
- 解析结果会自动缓存，重复解析同一方块速度更快
- 可以使用 `getCacheStats()` 查看缓存状态
- 使用 `clearGlobalCache()` 清除缓存

## 注意事项

1. 纹理路径需要添加 `/texture` 后缀才能正确加载
2. 所有 JSON 文件不需要 `.json` 后缀
3. 缺失的资源会自动降级为 `minecraft:block/missing`
4. 内置模型（builtin）会根据类型处理或降级

## 与现有系统的关系

这个新系统独立于现有的 `ResourcePackLoader`、`ModelParser`、`BlockStateParser`，可以逐步替换现有实现。新系统更符合设计文档要求，功能更完整。