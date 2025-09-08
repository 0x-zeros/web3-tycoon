# 网格地面使用说明

## 功能概述

`GridGround` 组件使用 Cocos Creator 3.8 的 GeometryRenderer 绘制网格线，提供可视化的网格地面和精确的鼠标点击检测。该组件无需复杂的 Mesh 和材质系统，更简单可靠。

## 主要特性

1. **基于 GeometryRenderer**：使用相机的 GeometryRenderer 直接绘制线条
2. **数学射线检测**：无需 Mesh 碰撞器，使用纯数学计算射线与平面交点
3. **网格对齐功能**：支持自动将点击位置对齐到网格点
4. **编辑器预览**：支持在编辑器中实时预览网格效果
5. **高性能**：每帧直接绘制线条，不需要复杂的渲染管线

## 基本使用

### 1. 通过 MapManager 创建

```typescript
// 基本创建
const mapManager = MapManager.getInstance();
if (mapManager) {
    const gridGround = mapManager.createGridGround();
    
    // 添加到场景
    const scene = director.getScene();
    if (scene) {
        scene.addChild(gridGround);
    }
}
```

### 2. 使用自定义配置

```typescript
import { GridGroundConfig } from '../map/GridGround';
import { Color } from 'cc';

// 创建配置
const config: GridGroundConfig = {
    step: 2,                    // 网格间距 2 单位
    halfSize: 30,               // 半尺寸 30 单位（总大小 60x60）
    color: new Color(0, 255, 0, 255), // 绿色网格线
    y: 0,                       // 网格高度 Y=0
    enableClickDetection: true,  // 启用点击检测
    enableSnapping: true         // 启用网格对齐
};

const gridGround = mapManager.createGridGround(config);
```

### 3. 直接使用组件

```typescript
import { GridGround } from '../map/GridGround';

// 创建节点并添加组件
const groundNode = new Node('MyGridGround');
const gridComponent = groundNode.addComponent(GridGround);

// 配置属性
gridComponent.step = 1.5;
gridComponent.halfSize = 25;
gridComponent.color = new Color(128, 128, 255, 255);
gridComponent.y = -1;
gridComponent.enableClickDetection = true;
gridComponent.debugMode = true; // 启用调试日志

// 添加到场景
this.node.addChild(groundNode);
```

## 组件属性

### 基本属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `cam` | Camera | null | 目标相机（自动查找 Main Camera） |
| `step` | number | 1 | 网格间距（单位） |
| `halfSize` | number | 50 | 半尺寸（总大小为 halfSize * 2） |
| `color` | Color | 浅灰色 | 网格线颜色 |
| `y` | number | 0 | 网格所在的 Y 高度 |

### 功能属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enableClickDetection` | boolean | true | 是否启用点击检测 |
| `enableSnapping` | boolean | true | 是否启用网格对齐 |
| `debugMode` | boolean | false | 调试模式（输出详细日志） |

## 事件处理

### 监听地面点击事件

```typescript
import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';
import { GridClickData } from '../map/GridGround';

// 监听点击事件
EventBus.on(EventTypes.Game.GroundClicked, (data: GridClickData) => {
    console.log('网格点击事件:', data);
    
    // 获取各种坐标
    console.log('世界坐标:', data.worldPosition);
    console.log('本地坐标:', data.localPosition);
    console.log('网格对齐坐标:', data.snappedPosition);
    console.log('网格索引:', data.gridIndex); // { x: number, z: number }
    
    // 访问组件
    const gridComponent = data.groundComponent as GridGround;
    console.log('网格信息:', gridComponent.getGridInfo());
}, this);
```

### 事件数据结构

```typescript
interface GridClickData {
    worldPosition: Vec3;        // 世界坐标位置
    localPosition: Vec3;        // 本地坐标位置（相对于网格中心）
    snappedPosition: Vec3;      // 网格对齐的坐标
    gridIndex: { x: number, z: number }; // 网格索引
    groundComponent: Component;  // 网格地面组件引用
}
```

## 实用方法

### 坐标转换

```typescript
// 获取网格组件实例
const gridGround = groundNode.getComponent(GridGround);

// 世界坐标转网格索引
const worldPos = new Vec3(5.7, 0, -3.2);
const gridIndex = gridGround.worldToGridIndex(worldPos);
console.log('网格索引:', gridIndex); // { x: 6, z: -3 }

// 网格索引转世界坐标
const worldCoord = gridGround.gridIndexToWorld(gridIndex.x, gridIndex.z);
console.log('世界坐标:', worldCoord); // Vec3(6, 0, -3)

// 检查网格索引是否有效
const isValid = gridGround.isValidGridIndex(gridIndex.x, gridIndex.z);
console.log('索引有效:', isValid);
```

### 获取网格信息

```typescript
const gridInfo = gridGround.getGridInfo();
console.log('网格间距:', gridInfo.step);
console.log('半尺寸:', gridInfo.halfSize);
console.log('总尺寸:', gridInfo.totalSize);
console.log('线条数量:', gridInfo.lineCount);
```

### 动态修改属性

```typescript
// 更改网格颜色
gridGround.setColor(new Color(255, 0, 0, 255)); // 红色

// 修改其他属性（会在下一帧生效）
gridGround.step = 2.0;
gridGround.halfSize = 40;
gridGround.y = -2;
```

## 配置示例

### 小型精细网格
```typescript
const fineGridConfig: GridGroundConfig = {
    step: 0.5,          // 0.5 单位间距
    halfSize: 10,       // 20x20 总大小
    color: new Color(200, 200, 200, 128), // 半透明灰色
    enableSnapping: true
};
```

### 大型粗糙网格
```typescript
const coarseGridConfig: GridGroundConfig = {
    step: 5,            // 5 单位间距
    halfSize: 100,      // 200x200 总大小
    color: new Color(100, 255, 100, 255), // 绿色
    enableSnapping: false
};
```

### 彩色调试网格
```typescript
const debugGridConfig: GridGroundConfig = {
    step: 1,
    halfSize: 20,
    color: new Color(255, 100, 255, 255), // 紫色
    y: 0.1,             // 稍微抬高避免 z-fighting
    enableClickDetection: true
};
```

## 性能考虑

1. **线条数量**：网格线数量 = `(halfSize * 2 / step + 1) * 2`
   - 例如：halfSize=50, step=1 时，总共 202 条线
   - 建议根据需要调整参数以平衡视觉效果和性能

2. **更新频率**：网格线每帧重绘，大量线条可能影响性能
   - 可以考虑在静态场景中禁用 `update()` 调用

3. **点击检测**：数学计算非常轻量，性能优秀

## 注意事项

1. **相机要求**：需要场景中存在相机，组件会自动查找 "Main Camera"
2. **GeometryRenderer 初始化**：组件会自动调用 `camera.initGeometryRenderer()`
3. **编辑器模式**：使用 `@executeInEditMode(true)` 支持编辑器预览
4. **事件清理**：组件销毁时会自动清理事件监听器

## 故障排除

### 网格不显示
1. 检查相机是否存在并正确引用
2. 确认相机位置不在网格平面上（建议相机 Y > 网格 Y）
3. 检查网格颜色是否与背景色区分度足够

### 点击检测无效
1. 确认 `enableClickDetection` 为 true
2. 检查点击位置是否在网格范围内
3. 验证相机射线计算是否正确

### 性能问题
1. 减少网格线数量（增大 `step` 或减小 `halfSize`）
2. 考虑使用较少的网格线密度
3. 在不需要时禁用点击检测

## 迁移指南

从旧的 GroundPlane 组件迁移：

```typescript
// 旧版本
const groundPlane = mapManager.createGroundPlane({
    width: 30,
    height: 30,
    color: new Color(128, 128, 128, 255)
});

// 新版本
const gridGround = mapManager.createGridGround({
    step: 1,
    halfSize: 15,  // 30/2 = 15
    color: new Color(128, 128, 128, 255)
});
```

事件处理保持兼容，无需修改事件监听代码。