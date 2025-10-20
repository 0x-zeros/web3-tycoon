# CompositeVoxelActor 系统

组合式体素 Actor 系统 - 通过组合 block + overlay + transform 来表现复杂对象。

## 特点

- ✅ **独立系统**：不依赖 VoxelSystem/ResourcePack
- ✅ **简化配置**：通过代码配置，无需 JSON 文件
- ✅ **灵活组合**：支持缩放、旋转、overlay
- ✅ **轻量高效**：只保留核心功能
- ✅ **可复用**：适用于建筑、装饰物、特效等

## 快速开始

### 1. 添加组件

```typescript
const actor = node.addComponent(CompositeVoxelActor);
```

### 2. 配置并渲染

```typescript
await actor.setConfig({
    components: [
        {
            blockId: "web3:hospital",
            position: new Vec3(0, 0, 0),
            scale: new Vec3(1, 2, 1),      // 高2倍
            rotation: new Vec3(0, 45, 0)   // Y轴旋转45度
        }
    ]
});
```

## 使用示例

### 示例1：简单建筑（单个 block + 缩放）

```typescript
const buildingActor = node.addComponent(CompositeVoxelActor);

await buildingActor.setConfig({
    components: [
        {
            blockId: "web3:hospital",
            position: new Vec3(0, 0, 0),
            scale: new Vec3(1, 1.5, 1)  // 稍微拉高
        }
    ]
});
```

### 示例2：多层建筑

```typescript
await buildingActor.setConfig({
    components: [
        // 底座
        {
            blockId: "web3:hospital",
            position: new Vec3(0, 0, 0),
            scale: new Vec3(1, 0.3, 1)
        },
        // 主体
        {
            blockId: "web3:hospital",
            position: new Vec3(0, 0.3, 0),
            scale: new Vec3(0.9, 1.4, 0.9)
        },
        // 顶部
        {
            blockId: "web3:hospital",
            position: new Vec3(0, 1.7, 0),
            scale: new Vec3(0.6, 0.3, 0.6),
            rotation: new Vec3(0, 45, 0)
        }
    ],
    baseScale: new Vec3(0.8, 0.8, 0.8)  // 整体缩小一点
});
```

### 示例3：带 Overlay 的建筑

```typescript
// 假设已有纹理
const iconTexture = await loadTexture('web3/icons/hospital_icon');

await buildingActor.setConfig({
    components: [
        {
            blockId: "web3:hospital",
            position: new Vec3(0, 0, 0),
            scale: new Vec3(1, 1.5, 1),
            overlays: [
                {
                    texture: iconTexture,
                    faces: [OverlayFace.UP],
                    layerIndex: 0,
                    inflate: 0.002
                }
            ]
        }
    ]
});
```

### 示例4：装饰物（旋转的小方块）

```typescript
const decorationActor = node.addComponent(CompositeVoxelActor);

await decorationActor.setConfig({
    components: [
        {
            blockId: "web3:card",
            position: new Vec3(0, 0, 0),
            scale: new Vec3(0.3, 0.3, 0.3),
            rotation: new Vec3(15, 30, 10)  // 三轴旋转
        }
    ]
});
```

## API 参考

### CompositeVoxelActor

#### 方法

- `setConfig(config: CompositeConfig): Promise<RenderResult>` - 设置配置并渲染
- `rebuild(): Promise<RenderResult>` - 重建（使用当前配置）
- `clear(): void` - 清理所有节点
- `setVisible(visible: boolean): void` - 显示/隐藏
- `setBaseTransform(pos?, scale?, rotation?): void` - 更新整体 transform
- `getConfig(): CompositeConfig | null` - 获取当前配置
- `isRendered(): boolean` - 是否已渲染
- `getRootNode(): Node | null` - 获取根节点
- `getBlockNodes(): Node[]` - 获取所有 block 节点

### CompositeConfig

```typescript
{
    components: BlockComponent[];     // Block 组件列表（必需）
    baseScale?: Vec3;                 // 整体缩放（可选）
    baseRotation?: Vec3;              // 整体旋转（可选）
    basePosition?: Vec3;              // 整体位置偏移（可选）
}
```

### BlockComponent

```typescript
{
    blockId: string;                  // Block ID（必需，如 "web3:hospital"）
    position?: Vec3;                  // 相对位置（默认 0,0,0）
    scale?: Vec3;                     // 缩放（默认 1,1,1）
    rotation?: Vec3;                  // 旋转（欧拉角，度，默认 0,0,0）
    overlays?: OverlayConfig[];       // Overlay 列表（可选）
    visible?: boolean;                // 是否可见（默认 true）
}
```

## 与现有系统的关系

### 复用的部分

- ✅ `BlockOverlayManager` - overlay 渲染（完全复用）
- ✅ `Web3BlockTypes` - block 定义（只读）
- ✅ `voxel-block.effect` - shader（复用）
- ✅ Block 纹理资源（复用）

### 独立的部分

- ✅ 不依赖 VoxelSystem
- ✅ 不依赖 ResourcePack（不解析 JSON 模型）
- ✅ 不依赖 VoxelChunk
- ✅ 不需要配置文件（代码直接配置）

### 简化的内容

- 只支持 **cube** 类型（不支持 cross 等复杂模型）
- 直接使用 **all 纹理**（所有面相同）
- 不需要 **biome color**、**AO** 等高级特性
- 配置通过**代码**而非 JSON

## 应用场景

1. **建筑 Actor**：替代预制 prefab，用 block 组合表现
2. **装饰物**：路边的小物件、标记等
3. **特效**：短暂的视觉效果
4. **UI 3D 元素**：在 UI 中显示 3D 物品

## 性能考虑

- 每个 component 创建1个 Node + 1个 MeshRenderer
- 建议单个 Actor 不超过 10 个 components
- 复用纹理和材质（自动缓存）
- 销毁时确保调用 `clear()`
