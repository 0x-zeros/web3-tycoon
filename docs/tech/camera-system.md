# 相机系统技术文档

## 系统架构

### 双相机控制器设计

项目采用双相机控制器架构，分别服务于不同的游戏场景：

#### 1. CameraController (通用游戏相机)

**适用场景**：大富翁游戏、策略游戏、棋盘游戏

**三种模式**：
- **ISOMETRIC**: 等距视角 (45度俯视，经典棋盘游戏)
- **TOP_DOWN**: 俯视视角 (90度垂直俯视)
- **THIRD_PERSON_FOLLOW**: 第三人称跟随

**核心特性**：
- 单例模式：`CameraController.getInstance()`
- 平滑过渡：Tween动画切换视角
- 事件系统：集成EventBus
- 调试模式：实时调试信息显示

#### 2. VoxelCameraController (体素世界专用)

**适用场景**：Minecraft风格体素游戏

**两种模式**：
- **WALKING**: 行走模式，有碰撞检测
- **FLYING**: 飞行模式，可自由移动

**核心特性**：
- 体素碰撞检测
- 分轴移动（贴墙滑动）
- FPS控制方式
- 方块查询功能

## 使用方式

### 通用相机控制

```typescript
// 获取相机实例
const camera = CameraController.getMainCamera();

// 切换相机模式
const controller = CameraController.getInstance();
controller?.setMode(CameraMode.ISOMETRIC);

// 设置跟随目标
controller?.setTarget(playerNode);

// 查看指定位置
controller?.lookAt(new Vec3(10, 0, 10));
```

### 体素相机控制

```typescript
// 获取体素相机控制器
const voxelController = CameraManager.getInstance().getVoxelCameraController();

// 切换模式
voxelController.setMode(VoxelCameraMode.WALKING);

// 设置方块查询函数
voxelController.setBlockQueryFunction((x, y, z) => {
    return getBlockAt(x, y, z);
});
```

## 快捷键控制

### 通用相机快捷键
- **F1**: 切换到等距视角
- **F2**: 切换到俯视视角
- **F3**: 切换到第三人称跟随
- **F4**: 创建测试跟随目标

### 体素相机快捷键
- **F**: 切换行走/飞行模式
- **Space/Shift**: 飞行模式下的上升/下降
- **WASD**: 移动控制
- **鼠标左键拖拽**: 视角旋转

### 调试快捷键
- **1-3**: 主游戏相机模式切换
- **4-5**: 体素相机模式切换
- **M**: 控制器类型切换
- **D**: 演示自动切换流程

## 交互控制

### 键盘控制
- **WASD**: 在等距和俯视模式下调用lookAt，前后左右移动

### 鼠标控制
- **滚轮**: 
  - TopDown模式：缩放相机高度
  - Isometric模式：缩放distance
- **右键拖拽**: 在等距模式下旋转相机（有bug，暂不实现）

## 视角配置

### 经典视角参数

**等距视角 (45度俯视)**：
```typescript
rotation: (45, 0, 0)  // 单纯俯视45°，正对Z轴
```

**大富翁棋盘效果**：
```typescript
rotation: (45, -45, 0)  // 俯视45° + 斜对角
```

**暗黑破坏神效果**：
```typescript
rotation: (26.565, -45, 0)  // 经典ARPG视角
```

### 2.5D视角实现

参考《饥荒》等游戏的2D素材3D表现：
- 使用2D素材在3D空间中渲染
- 通过相机角度营造3D感
- 避免使用Spine，使用原生Cocos Creator方案

## 系统集成

### 交互管理器

**InteractionManager**：
- 管理主游戏的交互逻辑
- 自动启用CameraManager的主游戏相机模式
- 提供F1-F3快捷键切换相机模式

**VoxelInteractionManager**：
- 管理体素世界的交互逻辑
- 自动启用体素相机模式
- 保持所有体素特有的交互功能

### 调试系统

**CameraDebugger**：
- 统一调试工具，支持所有相机功能测试
- 可配置的调试功能开关
- 实时显示相机状态信息
- 支持自动演示功能

## 配置示例

### 场景设置

```typescript
// 1. 将CameraManager组件挂载到场景节点
// 2. 将CameraDebugger组件挂载到CameraManager同一节点
// 3. 将InteractionManager挂载到主游戏场景需要的节点
// 4. 将VoxelInteractionManager挂载到体素世界场景需要的节点
```

### 属性配置

```typescript
// CameraDebugger配置
@property({ tooltip: "启用调试信息显示" })
enableDebugDisplay: boolean = true;

@property({ tooltip: "启用键盘快捷键" })
enableKeyboardSwitching: boolean = true;

@property({ tooltip: "启用自动演示功能" })
enableCameraDemo: boolean = false;
```

## 技术要点

### 1. 单例模式
- 使用单例模式确保相机控制器的全局唯一性
- 提供统一的访问接口

### 2. 事件系统
- 集成EventBus，支持相机模式变化事件
- 实现松耦合的模块间通信

### 3. 平滑过渡
- 使用Tween动画实现相机切换的平滑过渡
- 避免突兀的视角跳跃

### 4. 碰撞检测
- 体素相机支持与方块的碰撞检测
- 实现分轴移动，支持贴墙滑动

### 5. 边界限制
- 通用相机支持边界限制
- 防止相机移动到无效区域

## 性能优化

### 1. 按需启用
- 根据游戏场景自动启用对应的相机模式
- 避免不必要的计算开销

### 2. 事件清理
- 及时清理事件监听器
- 避免内存泄漏

### 3. 调试开关
- 提供调试功能的开关控制
- 生产环境可关闭调试功能

## 扩展方向

### 1. 更多视角模式
- 支持更多自定义视角
- 实现视角预设系统

### 2. 相机动画
- 支持复杂的相机路径动画
- 实现电影级镜头效果

### 3. 多人游戏支持
- 支持多相机同时工作
- 实现分屏显示

这套相机系统为项目提供了灵活、强大的视角控制能力，支持从2D策略游戏到3D体素游戏的各种需求。
