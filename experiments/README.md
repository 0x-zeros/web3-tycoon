# Experiments / 实验项目

这个文件夹包含各种技术验证和性能优化实验，**不是生产代码**。

## 项目列表

### 1. rust-hello-wasm
**目标**: 验证 Rust→WASM 编译和基础功能

**技术栈**:
- Rust + wasm-bindgen
- wasm-pack (构建工具)

**测试内容**:
- 简单的数组求和函数
- WASM 模块导出和调用
- 性能基准测试

**构建命令**:
```bash
cd rust-hello-wasm
wasm-pack build --target web
```

### 2. wasm-worker-test
**目标**: 验证 WASM 在 Web Worker 中的运行

**技术栈**:
- TypeScript
- Vite (开发服务器)
- Web Worker API

**测试内容**:
- Worker 加载 WASM 模块
- 主线程 ↔ Worker ↔ WASM 通信
- TypedArray 零拷贝传输
- JS vs WASM 性能对比

**开发命令**:
```bash
cd wasm-worker-test
npm install
npm run dev
```

## 注意事项

1. **实验性代码**: 这里的代码仅用于技术验证，不要直接用于生产环境
2. **独立依赖**: 每个项目有自己的依赖管理（Cargo.toml / package.json）
3. **快速迭代**: 优先验证可行性，代码质量其次
4. **性能数据**: 记录关键性能指标，用于决策是否集成到主项目

## 未来实验方向

- 体素网格生成算法优化（Greedy Meshing）
- 寻路算法性能测试（BFS/Dijkstra）
- 物理计算卸载到 WASM
- Cocos Creator 集成测试
