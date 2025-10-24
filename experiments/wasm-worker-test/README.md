# wasm-worker-test

验证 WASM 在 Web Worker 中运行的完整示例。

## 功能

- 在 Worker 中加载 Rust WASM 模块
- 主线程 ↔ Worker ↔ WASM 三层通信
- 零拷贝数据传输（Transferable Objects）
- JS vs WASM 性能对比

## 安装依赖

```bash
npm install
```

## 运行

### 1. 首先构建 Rust WASM 模块

```bash
cd ../rust-hello-wasm
wasm-pack build --target web
```

### 2. 启动开发服务器

```bash
npm run dev
```

打开浏览器访问 `http://localhost:5173`

## 测试内容

### 性能测试
- 生成 100 万个随机数
- 计算数组总和
- 对比 JS 和 WASM 的执行时间

### 预期结果
- WASM 在大规模数值计算上应该比 JS 快
- 数据传输使用零拷贝，无性能损失
- Worker 不阻塞主线程

## 技术要点

### Worker 创建
```typescript
const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module'
});
```

### WASM 初始化（在 Worker 中）
```typescript
import init, { sum_array } from '../../rust-hello-wasm/pkg/rust_hello_wasm.js';
await init();
```

### 零拷贝传输
```typescript
// 传输后 testArray 在主线程中不可用
worker.postMessage(
    { type: 'sum', data: testArray },
    [testArray.buffer]  // Transferable
);
```

## 生产环境构建

```bash
npm run build
npm run preview
```

## 注意事项

1. **WASM 路径**: Worker 需要正确引用 `../../rust-hello-wasm/pkg/`
2. **Vite 配置**: 需要 `vite-plugin-wasm` 和 `vite-plugin-top-level-await`
3. **TypeScript**: Worker 需要 `/// <reference lib="webworker" />` 声明
4. **数据传输**: 使用 Transferable Objects 避免大数组复制
