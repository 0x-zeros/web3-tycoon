# Web3 资源目录

这个目录包含所有PaperActor系统使用的美术资源。

## 目录结构

### actors/
NPC、物体、装饰物的纹理资源
- 命名规则：`{name}.png` 或 `{name}.jpg`
- 示例：
  - `land_god.png` - 土地神
  - `wealth_god.png` - 财神
  - `dog.png` - 狗狗
  - `bomb.png` - 炸弹
  - `deco_dandelion.png` - 蒲公英装饰

### buildings/
建筑物纹理资源（包含各个等级）
- 命名规则：`{building_name}_lv{level}.png`
- 示例：
  - `property_small_lv0.png` - 小型地产空地
  - `property_small_lv1.png` - 小型地产1级
  - `property_small_lv2.png` - 小型地产2级
  - `temple_lv1.png` - 土地庙1级

### ui/
UI相关资源（对话气泡、图标等）
- `bubble.png` - 对话气泡
- `icons/` - 各种UI图标

## 纹理规格建议

- **NPC/物体**: 256x256 或 512x512
- **建筑**: 512x512 或 1024x1024
- **装饰物**: 128x128 或 256x256
- **格式**: PNG（带透明通道）或 JPG（不透明）

## 注意事项

1. 所有纹理都应该是正方形
2. 建议使用2的幂次方尺寸（128, 256, 512, 1024）
3. 透明背景的精灵使用PNG格式
4. 纹理文件名必须与ActorConfig.ts中的配置一致