# Cocos Creator 3D场景设置指南

## 问题描述
运行时出现错误：`Cannot read properties of null (reading 'cameraPriority')`

**原因**：场景中缺少摄像机组件，导致引擎无法处理鼠标射线投射事件。

## 解决方案

### 1. 创建基础3D场景

在 Cocos Creator 中创建新场景时，需要包含以下基本组件：

#### 场景层次结构：
```
Scene
├── Main Light (DirectionalLight)
├── Main Camera (Camera)
└── Canvas (UI层，可选)
    └── UI组件...
```

### 2. 设置主摄像机

**创建摄像机节点**：
1. 在 **Hierarchy** 面板右键 → **Create** → **3D Object** → **Camera**
2. 重命名为 `Main Camera`

**摄像机组件配置**：
```typescript
// Camera组件属性设置
Priority: 0                    // 摄像机优先级
ClearFlags: SOLID_COLOR        // 清屏标志  
BackgroundColor: (50,90,120,255) // 背景颜色
Projection: PERSPECTIVE        // 投影模式：透视
FOV: 45                       // 视野角度
Near: 1                       // 近裁剪面
Far: 1000                     // 远裁剪面
```

**摄像机位置**（适合查看地图）：
```typescript
Position: (3, 8, 8)           // 位置：地图中央上方
Rotation: (-30, 0, 0)         // 俯视角度
```

### 3. 设置主光源

**创建光源节点**：
1. 在 **Hierarchy** 面板右键 → **Create** → **Light** → **Directional Light**  
2. 重命名为 `Main Light`

**光源组件配置**：
```typescript
// DirectionalLight组件属性
Color: (255, 255, 255, 255)   // 白色光源
Intensity: 1.0                // 光照强度
StaticSettings: 启用           // 静态光照
```

**光源位置和方向**：
```typescript
Position: (0, 10, 0)          // 位置：上方
Rotation: (-45, -30, 0)       // 方向：斜向下照射
```

### 4. 地图容器设置

**创建地图根节点**：
```typescript
Position: (0, 0, 0)           // 地图中心
Rotation: (0, 0, 0)           // 无旋转  
Scale: (1, 1, 1)              // 标准缩放
```

**子节点结构**：
```
Map Root
├── Tile Container            // 地块容器
│   ├── Tile_001 (MapTile组件)
│   ├── Tile_002 (MapTile组件)
│   └── ...
├── Player Container          // 玩家容器
└── UI Container             // 3D UI容器
```

### 5. 测试场景模板

创建一个最小可用的3D测试场景：

**Scene.scene 内容**：
```json
{
  "nodes": [
    {
      "name": "Main Camera",
      "position": [3, 8, 8],
      "rotation": [-30, 0, 0, 1],
      "components": [
        {
          "type": "Camera",
          "priority": 0,
          "clearFlags": 7,
          "backgroundColor": [0.2, 0.35, 0.47, 1]
        }
      ]
    },
    {
      "name": "Main Light", 
      "position": [0, 10, 0],
      "rotation": [-45, -30, 0, 1],
      "components": [
        {
          "type": "DirectionalLight",
          "color": [1, 1, 1, 1],
          "intensity": 1.0
        }
      ]
    },
    {
      "name": "Map Root",
      "position": [0, 0, 0],
      "children": ["Tile Container"]
    }
  ]
}
```

### 6. 脚本挂载

**MapManager 脚本挂载**：
- 挂载到 `Map Root` 节点上
- 设置 `tileContainer` 属性为 `Tile Container` 节点

**地块预制件设置**：
- 每个地块预制件必须有 `MeshRenderer` 组件
- 必须有 `BoxCollider` 或其他碰撞器组件（用于射线检测）
- 挂载对应的地块类型脚本（如 `StartTile`、`PropertyTile` 等）

### 7. 调试检查清单

运行场景前检查：

- [ ] 场景中有至少一个活跃的 `Camera` 组件
- [ ] 摄像机的 `Priority` 属性已设置（通常为0）
- [ ] 场景中有 `DirectionalLight` 或其他光源
- [ ] 地块节点有 `Collider` 组件（用于射线检测）
- [ ] 没有空的或损坏的组件引用

### 8. 常见问题

**问题1**: `cameraPriority` 为null  
**解决**: 确保场景中有活跃的Camera组件

**问题2**: 地块无法点击  
**解决**: 检查地块是否有Collider组件

**问题3**: 光照异常  
**解决**: 添加DirectionalLight并设置正确的方向

### 9. 快速修复脚本

如果需要通过代码动态创建摄像机：

```typescript
// 在MapManager或场景管理脚本中
private ensureCamera(): void {
    let camera = find('Main Camera');
    if (!camera) {
        // 创建摄像机节点
        camera = new Node('Main Camera');
        const cameraComp = camera.addComponent(Camera);
        cameraComp.priority = 0;
        cameraComp.clearFlags = CameraComponent.ClearFlags.SOLID_COLOR;
        
        // 设置位置
        camera.setPosition(3, 8, 8);
        camera.setRotationFromEuler(-30, 0, 0);
        
        // 添加到场景
        director.getScene().addChild(camera);
    }
}
```

按照这个指南设置场景后，`cameraPriority` 错误应该会被解决。