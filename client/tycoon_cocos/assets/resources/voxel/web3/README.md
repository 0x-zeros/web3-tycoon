# Web3 Tycoon Game Blocks

这是为 Web3 大富翁游戏生成的 Minecraft 风格资源包，包含自定义的方块类型。

## 文件结构

```
web3/
├── pack.mcmeta                    # 资源包元数据
└── assets/
    └── web3/                      # 自定义命名空间
        ├── blockstates/           # 方块状态定义
        ├── models/block/          # 方块模型定义
        └── textures/block/        # 方块贴图
```

## 地块类型 (Tile Types)

| 游戏地块 | Web3 方块 ID | Minecraft 参考 | 贴图来源 | 模型类型 |
|---------|-------------|---------------|---------|---------|
| 空地 (Empty Land) | `web3:empty_land` | `minecraft:stone` | stone.png | cube_all |
| 地产 (Property) | `web3:property` | `minecraft:dirt` | dirt.png | cube_all |
| 医院 (Hospital) | `web3:hospital` | `minecraft:grass_block` | grass_block_side.png | cube_all |
| 机会 (Chance) | `web3:chance` | `minecraft:sand` | sand.png | cube_all |
| 奖励 (Bonus) | `web3:bonus` | `minecraft:cobblestone` | cobblestone.png | cube_all |
| 费用 (Fee) | `web3:fee` | `minecraft:oak_log` | oak_log.png | cube_all |
| 卡片 (Card) | `web3:card` | `minecraft:oak_planks` | oak_planks.png | cube_all |
| 新闻 (News) | `web3:news` | `minecraft:oak_leaves` | oak_leaves.png | cube_all |

## NPC 和路面物体 (NPCs & Road Objects)

| 游戏对象 | Web3 方块 ID | Minecraft 参考 | 贴图来源 | 模型类型 |
|---------|-------------|---------------|---------|---------|
| 土地神 (Land God) | `web3:land_god` | `minecraft:dandelion` | dandelion.png | cross |
| 财神 (Wealth God) | `web3:wealth_god` | `minecraft:poppy` | poppy.png | cross |
| 福神 (Fortune God) | `web3:fortune_god` | `minecraft:short_grass` | short_grass.png | cross |
| 狗狗 (Dog) | `web3:dog` | `minecraft:fern` | fern.png | cross |
| 穷神 (Poverty God) | `web3:poverty_god` | `minecraft:dandelion` | dandelion.png | cross |
| 路障 (Roadblock) | `web3:roadblock` | `minecraft:poppy` | poppy.png | cross |
| 炸弹 (Bomb) | `web3:bomb` | `minecraft:short_grass` | short_grass.png | cross |

## 使用方法

1. 将整个 `web3` 文件夹作为资源包加载到你的 Cocos Creator 项目中
2. 在代码中使用 `web3:` 命名空间引用这些方块
3. 例如：`web3:empty_land`, `web3:property`, `web3:land_god` 等

## 注意事项

- 所有地块类型使用 `cube_all` 模型（完整方块）
- 所有 NPC 和路面物体使用 `cross` 模型（交叉植物模型）
- 贴图暂时使用 Minecraft 原版贴图，后续可以替换为自定义贴图
- 资源包格式版本为 64，兼容 Minecraft 1.21.7

## 后续开发

- 可以替换贴图文件为自定义的游戏风格贴图
- 可以调整方块模型以获得更好的视觉效果
- 可以添加更多的方块变体和状态
