# 体素系统开发笔记

## 核心技术要点

### 1. Block Overlay 系统

**实现原理**：同一方块渲染两次，实现复杂的纹理叠加效果

**技术方案**：
- **基础层**：不透明材质，包含所有6个面
- **Overlay层**：透明材质，仅渲染4个侧面，支持生物群系染色

**关键实现**：
```typescript
// 两个子网格结构
const mesh = Mesh.create([
    primitiveBase,    // 基础层：所有6个面
    primitiveOverlay  // Overlay层：仅4个侧面
]);
```

**材质配置**：
- 基础层：`depthWrite: true, blend: false`
- Overlay层：`depthWrite: false, blend: true, tint: u_BiomeColor`

### 2. 体素交互系统

**核心创新**：零碰撞器设计，采用数学射线投射

**技术优势**：
- 无需为每个方块创建物理碰撞器
- O(1)哈希查找，支持无限大世界
- 32步/单位精度，确保准确检测

**关键算法**：
```typescript
raycast(origin: Vec3, direction: Vec3, maxDistance: number): VoxelHitResult {
    const steps = Math.floor(maxDistance * 32);
    const stepSize = maxDistance / steps;
    
    for (let i = 0; i < steps; i++) {
        const currentPos = origin + direction * (i * stepSize);
        const blockPos = this.worldToBlockPosition(currentPos);
        const blockType = getBlockAt(blockPos.x, blockPos.y, blockPos.z);
        
        if (blockType !== EMPTY) {
            return { hit: true, position: blockPos };
        }
    }
    return { hit: false };
}
```

### 3. 网格与着色器语义

**标准语义映射**：
- `a_position(vec3)`: 顶点位置
- `a_normal(vec3)`: 顶点法线
- `a_texCoord(vec2)`: 主UV坐标
- `a_texCoord1(vec2)`: Overlay UV坐标
- `a_color(vec4)`: 顶点颜色
  - R通道：AO（环境光遮蔽）
  - G通道：Light（顶点光照强度）
  - B/A通道：预留扩展

**网格创建**：
```typescript
const mesh = utils.MeshUtils.createMesh({
    positions, normals, uvs, uvs1, colors, indices
});
```

### 4. 性能优化经验

**场景设计原则**：
- y=0：地图基础层（不可破坏）
- y=1+：玩家、建筑、装饰层

**渲染优化**：
- 面剔除（Face Culling）简单有效
- 合并渲染减少Draw Call
- 稀疏存储只保存非空方块

**内存优化**：
- 使用Map<string, BlockType>存储方块数据
- 避免为每个方块创建组件
- Chunk级别的按需加载

## 开发经验总结

### 1. 技术选型

**推荐方案**：
- 使用标准语义映射，避免自定义顶点格式
- 通过`MeshUtils.createMesh`创建网格，不直接操作只读属性
- 数学算法替代物理引擎，提升性能

### 2. 常见问题

**Z-Fighting解决**：
- Overlay层使用`depthWrite: false`
- 或通过顶点微膨胀`u_Inflate=0.001`

**透明渲染**：
- 使用Alpha混合模式
- 注意渲染顺序：先不透明，后透明

**性能瓶颈**：
- 避免大量物理碰撞器
- 使用哈希查找替代遍历
- 合理使用面剔除

### 3. 扩展方向

**功能扩展**：
- 支持更多方块类型
- 添加动画效果
- 实现动态光照

**技术扩展**：
- 使用`a_color.b/a`通道存储更多自定义数据
- 利用`a_texCoord2~7`实现复杂纹理效果
- 考虑切换到`createDynamicMesh`支持运行时更新

## 参考资源

**开源项目**：
- Craft：数学射线投射实现
- Luanti：资源包和渲染技术
- DivineVoxelEngine：体素引擎架构

**技术文档**：
- Cocos Creator 3.8 程序化创建网格
- WebGL2/GLES3 顶点属性限制
- Minecraft资源包标准

这套体素系统为项目提供了专业级的3D体素渲染和交互能力，可以作为任何体素类游戏的基础架构使用。
