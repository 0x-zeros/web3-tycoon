# Prompt: Minecraft Resource Pack Rendering System (MVP Scope, with Plants/Emissive/AO)

> 说明：本提示**不限定具体类名/方法签名/文件结构**，请你（Claude Code）自由发挥工程设计；只需满足下述功能与行为约束。

## 目标与范围（MVP）
- 解析并渲染 **Minecraft Java 版资源包**中的**方块模型与贴图（block）**。
- **单资源包模式**（见下文）：不做多包叠加/覆盖；仅 Java 版标准目录结构。
- **最小支持模型模板**：
  - `cube_all`（如石头、泥土）
  - `cube_column`（如原木柱）
  - `cross`（花草类：花、草、蕨、蘑菇、树苗等；用两张交叉四边形呈现）
- **blockstates 支持**：
  - 只解析 `variants` 的**默认/简单键值**（不含复杂条件、随机/加权）。
  - 支持读取 `y` 旋转（仅 0/90/180/270），并应用到**整个模型实例**。
- **elements 支持**：
  - 支持 `from`/`to`（0~16）、`faces`、面级 `uv`（[u1,v1,u2,v2]）、`texture`（`#name`）、`rotation`（0/90/180/270）。
- **纹理散图加载**（不做 atlas 合并）：
  - 单 PNG 纹理、保持原尺寸；最近邻采样；启用透明通道；mipmap 可配置。
- **半透明材质**（玻璃/植物等）**必须支持**：
  - 启用 alpha blending + （可选）alpha test（建议阈值 0.5）；保证透明像素正确显示。
- **集成现有 AO 与发光能力**
- **不在本次范围**：
  - 多 parent 链与复杂模板、模型重定向、贴图拼接、随机/连接纹理、biome 染色、动态模型、item 模型。

## 单资源包模式（“仅支持单个资源包”的具体含义）
- **只加载一个 resourcepack 根目录**（例如 `MyPack/`）。
- 不实现 Minecraft 客户端的**多资源包叠加/优先级覆盖**机制（即不支持同时加载多个包并合并解析）。
- 资源包必须符合 **Java 版标准目录结构**（不支持基岩版 `.mcpack` 与自定义结构）：
```
MyPack/
  pack.mcmeta
  assets/minecraft/
    blockstates/<block>.json
    models/block/<name>.json
    textures/block/<name>.png
```
- 若目录缺失或结构异常，请走降级策略（见下）。

## 资源与加载流程（行为约束，不限定类设计）
1. **资源索引**
   - 能枚举并读取 `blockstates` / `models` / `textures`；提供以方块 id / 模型名 / 纹理路径为键的查询能力。

2. **blockstates 解析**
   - 从 `blockstates/<id>.json` 读取 `variants`；仅处理默认键（或取第一可用变体）。
   - 返回：所属模型名与可选 `y` 旋转。

3. **模型解析**
   - 解析 `models/block/<name>.json`：
     - `parent` 允许：`minecraft:block/cube_all`、`minecraft:block/cube_column`、`minecraft:block/cross`；其他 parent 走降级。
     - 合并 `textures` 映射（支持 `#xxx` 引用）。
     - 若存在 `elements` 则按元素生成；`cross` 模型则忽略 `elements`，按模板生成两张交叉四边形。
       - `cross` 的两张四边形需以方块中心为轴正交交叉；高度与宽度按贴图像素比或 16×16 默认。

4. **纹理管理**
   - 读取单 PNG → 纹理对象；最近邻采样；透明通道；mipmap 可选。

5. **网格生成**
   - 把元素（0~16）转换到“方块单位”（/16 → 1 个方块为 1 单位）。
   - 为每个元素的可见面生成四边形顶点、法线、UV。
   - `face.rotation` 只影响该面的 UV 旋转；`blockstate.y` 作用于整个网格的 Y 轴离散旋转。
   - **cross**：生成两张穿插四边形；按需求设置双面渲染或禁用背面剔除以避免反面被裁。
   - 为**同一纹理**的面聚合为同一个可渲染子网格（便于绑定最简材质）。

6. **渲染对接**
   - 绑定网格与纹理到引擎（例如 Cocos Creator 的 `MeshRenderer + Material` 思路）。
   - 材质最小化：基础贴图 + 透明混合；与现有 **AO/Emissive** 管线对齐（仅做参数/标记传递，不在此处重新实现）。

## JSON 示例片段
**blockstates**
```json
{
  "variants": {
    "": { "model": "minecraft:block/stone" }
  }
}
```
**cube_all**
```json
{
  "parent": "minecraft:block/cube_all",
  "textures": { "all": "minecraft:block/stone" }
}
```
**cube_column**
```json
{
  "parent": "minecraft:block/cube_column",
  "textures": {
    "end": "minecraft:block/oak_log_top",
    "side": "minecraft:block/oak_log"
  }
}
```
**cross（花草）**
```json
{
  "parent": "minecraft:block/cross",
  "textures": {
    "cross": "minecraft:block/dandelion"
  }
}
```

**elements**
```json
{
  "elements": [
    {
      "from": [0, 0, 0],
      "to": [16, 16, 16],
      "faces": {
        "north": { "uv": [0,0,16,16], "texture": "#all" },
        "up":    { "uv": [0,0,16,16], "texture": "#all" }
      }
    }
  ]
}
```

## 降级与兜底
- 缺失 `blockstates` / `models`：渲染一个“紫黑方格”默认立方体（16×16×16）。
- `parent` 不受支持：使用默认立方体兜底（`cross` 若不支持，同样用立方体兜底）。
- 纹理丢失：使用“紫黑方格”占位纹理。
- 元素为空或越界：退回默认立方体。

## 验收标准（最小可运行）
- 指定资源包根目录后：
  1) 能渲染 `minecraft:block/stone`（cube_all）。  
  2) 能渲染 `minecraft:block/oak_log`（cube_column，side/end 正确）。  
  3) 能渲染 `minecraft:block/dandelion` 或任一 `cross` 植物模型（两张交叉四边形，透明正确）。  
  4) 玻璃类半透明方块能正确显示（背景可见，透明边缘无明显溢色）。  
  5) 与现有 **AO 与发光** 管线兼容：不破坏 AO 效果；发光参数能被正确传递到材质。  
- 提供一个**单方块预览**入口：给定方块 id → 在场景中渲染该方块。

## 实施提示（可自由发挥）
- 可按纹理分组生成多个子网格，减少材质切换；不做贴图 atlas。  
- `cross` 植物建议禁用背面剔除或使用双面材质，避免从背面看不到贴图。  
- 请自行选择工程分层/类命名/方法签名，**不要受此文约束**。
