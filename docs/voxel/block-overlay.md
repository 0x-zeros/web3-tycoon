# Block Overlay系统使用文档

## 概述

Block Overlay系统允许在block的任意面上叠加透明贴图，支持多层渲染。

## 核心特性

- ✅ **参数化面控制**: 通过`faces`数组灵活指定要渲染的6个面中的任意组合
- ✅ **多层支持**: 通过`layerIndex`实现无限层overlay
- ✅ **Z-fight防护**: 通过`inflate`参数自动膨胀避免闪烁
- ✅ **动态更新**: 运行时切换纹理和颜色
- ✅ **Alpha混合**: 支持透明贴图

## 基础使用

### 1. 单层overlay - 顶部箭头

```typescript
import { OverlayFace } from '../../voxel/overlay/OverlayTypes';

// 在tile顶部添加北向箭头
const arrowTexture = await resources.loadAsync('overlays/arrow_north', Texture2D);
await gameMap.addTileOverlay(new Vec2(5, 10), {
    texture: arrowTexture,
    faces: [OverlayFace.UP],  // 只渲染顶面
    alpha: 0.8,
    layerIndex: 0
});
```

### 2. 多面overlay - 边框高亮

```typescript
// 在tile的四个侧面添加高亮边框
const borderTexture = await resources.loadAsync('overlays/highlight_border', Texture2D);
await gameMap.addTileOverlay(new Vec2(5, 10), {
    texture: borderTexture,
    faces: [
        OverlayFace.NORTH,
        OverlayFace.SOUTH,
        OverlayFace.EAST,
        OverlayFace.WEST
    ],
    color: new Color(255, 200, 0, 255),  // 金色tint
    alpha: 0.6,
    inflate: 0.001,
    layerIndex: 0
});
```

### 3. 多层overlay - 复杂效果

```typescript
const pos = new Vec2(5, 10);

// Layer 0: 底层装饰（顶面）
await gameMap.addTileOverlay(pos, {
    texture: await resources.loadAsync('overlays/decoration', Texture2D),
    faces: [OverlayFace.UP],
    alpha: 0.5,
    inflate: 0.001,
    layerIndex: 0
});

// Layer 1: 中层箭头（顶面）
await gameMap.addTileOverlay(pos, {
    texture: await resources.loadAsync('overlays/arrow_north', Texture2D),
    faces: [OverlayFace.UP],
    alpha: 0.8,
    inflate: 0.002,  // 比layer0高，避免Z-fight
    layerIndex: 1
});

// Layer 2: 上层文字（顶面）
const textTexture = generateNumberTexture(12);  // 生成包含数字的纹理
await gameMap.addTileOverlay(pos, {
    texture: textTexture,
    faces: [OverlayFace.UP],
    inflate: 0.003,  // 最外层
    layerIndex: 2
});
```

## API参考

### GameMap方法

#### addTileOverlay(gridPos, config)
为tile添加overlay层。

**参数**:
- `gridPos: Vec2` - Tile网格位置
- `config: OverlayConfig` - Overlay配置

**返回**: `Promise<boolean>` - 是否成功

#### removeTileOverlay(gridPos, layerIndex)
移除指定层的overlay。

#### removeAllTileOverlays(gridPos)
移除tile的所有overlay层。

#### updateTileOverlayTexture(gridPos, layerIndex, newTexture)
动态更新overlay纹理。

#### updateTileOverlayColor(gridPos, layerIndex, color)
更新overlay颜色tint。

#### hasTileOverlay(gridPos, layerIndex)
检查overlay是否存在。

## OverlayConfig参数详解

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| texture | Texture2D | ✅ | - | Overlay纹理（支持alpha通道）|
| faces | OverlayFace[] | ❌ | [UP] | 要渲染的面列表 |
| color | Color | ❌ | 白色 | 颜色tint（与纹理相乘）|
| alpha | number | ❌ | 1.0 | 整体透明度（0-1）|
| inflate | number | ❌ | 0.001 | Z轴膨胀值（防止闪烁）|
| layerIndex | number | ❌ | 0 | 层级索引（0, 1, 2...）|

## OverlayFace枚举

```typescript
enum OverlayFace {
    UP = 'up',       // +Y 顶面
    DOWN = 'down',   // -Y 底面
    NORTH = 'north', // -Z 北面
    SOUTH = 'south', // +Z 南面
    WEST = 'west',   // -X 西面
    EAST = 'east'    // +X 东面
}
```

## 常见使用场景

### 场景1：玩家移动路径指示

```typescript
// 在路径上显示方向箭头
const path = [new Vec2(0,0), new Vec2(1,0), new Vec2(2,0)];
for (const pos of path) {
    await gameMap.addTileOverlay(pos, {
        texture: arrowTexture,
        faces: [OverlayFace.UP],
        alpha: 0.7,
        layerIndex: 0
    });
}

// 清除路径指示
for (const pos of path) {
    gameMap.removeTileOverlay(pos, 0);
}
```

### 场景2：Building入口标记

```typescript
// 入口tile显示building图标（顶面）+ 金色边框（侧面）
const entrancePos = new Vec2(10, 15);

// Layer 0: 顶部图标
await gameMap.addTileOverlay(entrancePos, {
    texture: buildingIconTexture,
    faces: [OverlayFace.UP],
    inflate: 0.001,
    layerIndex: 0
});

// Layer 1: 侧面边框
await gameMap.addTileOverlay(entrancePos, {
    texture: borderTexture,
    faces: [OverlayFace.NORTH, OverlayFace.SOUTH, OverlayFace.EAST, OverlayFace.WEST],
    color: new Color(255, 200, 0, 255),
    alpha: 0.5,
    inflate: 0.002,
    layerIndex: 1
});
```

### 场景3：Tile编号显示

```typescript
// 使用Canvas2D动态生成包含数字的纹理
function generateNumberTexture(num: number): Texture2D {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(num.toString(), 32, 32);

    const texture = new Texture2D();
    const image = new ImageAsset(canvas);
    texture.image = image;
    return texture;
}

// 为tile添加编号overlay
const numberTex = generateNumberTexture(tileId);
await gameMap.addTileOverlay(pos, {
    texture: numberTex,
    faces: [OverlayFace.UP],
    inflate: 0.002,
    layerIndex: 1
});
```

### 场景4：全面渲染 - 6个面

```typescript
// 在所有6个面上应用纹理（如特殊效果）
await gameMap.addTileOverlay(pos, {
    texture: glowTexture,
    faces: [
        OverlayFace.UP,
        OverlayFace.DOWN,
        OverlayFace.NORTH,
        OverlayFace.SOUTH,
        OverlayFace.EAST,
        OverlayFace.WEST
    ],
    color: new Color(100, 200, 255, 255),  // 蓝色发光
    alpha: 0.4,
    layerIndex: 0
});
```

## 性能优化建议

1. **按需创建**: 只为需要overlay的tile创建
2. **及时清理**: 不需要时调用`removeTileOverlay()`
3. **Inflate分层**: 多层时递增（0.001, 0.002, 0.003...）
4. **纹理复用**: 相同overlay可共享Texture2D

## inflate参数说明

```typescript
// Layer 0: 最内层（贴近block表面）
inflate: 0.001

// Layer 1: 中间层
inflate: 0.002

// Layer 2: 最外层
inflate: 0.003

// 规则：每层递增0.001，确保Z轴正确排序
```

inflate值沿法线方向膨胀顶点，避免与原block表面产生Z-fighting。

## 技术细节

- **Shader**: 使用`voxel-overlay.effect`（已有）
- **材质类型**: `MaterialType.OVERLAY`
- **混合模式**: Alpha blending
- **深度写入**: 关闭（`depthWrite: false`）
- **剔除模式**: 背面剔除

## 注意事项

1. overlay贴图**必须有alpha通道**
2. 多层overlay时，**inflate必须递增**
3. faces数组为空时，不会渲染任何面
4. 同一layer会覆盖之前的overlay（通过`Overlay_${layerIndex}`节点名称管理）
