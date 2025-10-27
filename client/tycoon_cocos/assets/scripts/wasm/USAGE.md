# WASM 双模式使用指南

本文档说明如何在 Cocos Creator 中使用 Rust WASM 的主线程和 Worker 双模式。

## 📁 文件说明

- `WasmManager.ts` - 主线程 WASM 管理器（同步调用）
- `WasmWorkerManager.ts` - Worker WASM 管理器（异步调用）
- `WasmWorker.ts` - Worker 内部代码（不直接调用）
- `UIWasmTest.ts` - FairyGUI 测试组件

## 🎯 使用场景

### 主线程模式（WasmManager）

**适用场景**：
- ✅ 快速计算（< 10ms）
- ✅ 需要立即返回结果
- ✅ 频繁调用的小任务

**优势**：
- 无通信开销
- 立即返回
- 代码简单

**劣势**：
- 大计算会卡顿 UI

### Worker 模式（WasmWorkerManager）

**适用场景**：
- ✅ 大量计算（> 50ms）
- ✅ 可以接受异步
- ✅ 需要保持 UI 流畅

**优势**：
- 不阻塞主线程
- UI 保持流畅
- 适合后台处理

**劣势**：
- 有通信开销（~1-2ms）
- 异步 API（Promise）
- 稍复杂

## 🚀 快速开始

### 1. 主线程模式

```typescript
import { WasmManager } from './wasm/WasmManager';

// 初始化（只需一次）
const wasm = WasmManager.getInstance();
await wasm.initialize();  // Web 平台加载 WASM，其他平台自动 fallback

// 调用函数（同步）
const arr = new Float32Array([1, 2, 3]);
const sum = wasm.sumArray(arr);  // 立即返回
console.log(sum);  // 6

// 检查是否使用 WASM
console.log('使用 WASM:', wasm.usingWasm);  // Web: true, Native: false
```

### 2. Worker 模式

```typescript
import { WasmWorkerManager } from './wasm/WasmWorkerManager';

// 初始化（只需一次）
const worker = WasmWorkerManager.getInstance();
await worker.initialize();  // Web 平台创建 Worker，其他平台自动 fallback

// 调用函数（异步）
const arr = new Float32Array([1, 2, 3]);
const sum = await worker.sumArray(arr);  // Promise
console.log(sum);  // 6

// 检查是否使用 Worker
console.log('使用 Worker:', worker.usingWorker);  // Web: true, Native: false
```

## 🎨 在 UI 中使用

### FairyGUI 组件绑定（参考 UIWasmTest）

```typescript
import { UIBase } from '../core/UIBase';
import { WasmManager } from '../../wasm/WasmManager';
import { WasmWorkerManager } from '../../wasm/WasmWorkerManager';

export class UIWasmTest extends UIBase {
    private btnMain!: fgui.GButton;
    private btnWorker!: fgui.GButton;

    protected onInit(): void {
        this.btnMain = this._view.getChild('btn_main').asButton;
        this.btnWorker = this._view.getChild('btn_worker').asButton;

        this.btnMain.onClick(this.onMainTest, this);
        this.btnWorker.onClick(this.onWorkerTest, this);
    }

    private async onMainTest() {
        const wasm = WasmManager.getInstance();
        await wasm.initialize();

        const arr = new Float32Array(1_000_000);
        for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.random();
        }

        const start = performance.now();
        const sum = wasm.sumArray(arr);
        const elapsed = performance.now() - start;

        console.log(`主线程: ${sum}, 耗时: ${elapsed}ms`);
    }

    private async onWorkerTest() {
        const worker = WasmWorkerManager.getInstance();
        await worker.initialize();

        const arr = new Float32Array(1_000_000);
        for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.random();
        }

        const start = performance.now();
        const sum = await worker.sumArray(arr);
        const elapsed = performance.now() - start;

        console.log(`Worker: ${sum}, 耗时: ${elapsed}ms`);
    }
}
```

## 🌍 平台兼容性

### Web 平台

| 模式 | 实现 | 性能 |
|------|------|------|
| 主线程 | WASM | 2-3x 快 |
| Worker | Worker + WASM | 2-3x 快（不阻塞） |

### 其他平台（Native/小游戏）

| 模式 | 实现 | 性能 |
|------|------|------|
| 主线程 | JS fallback | 基准性能 |
| Worker | JS fallback（主线程） | 基准性能 |

**自动 fallback**：
- 代码无需修改
- API 完全一致
- 功能正常，只是没有性能提升

## 📊 性能对比

### 测试：100万随机数求和

**Web 平台**：
- JS（基准）: ~10-15ms
- WASM（主线程）: ~4-6ms → **2.5x 快**
- WASM（Worker）: ~5-7ms (含通信) → **2x 快 + 不卡 UI**

**通信开销**：
- Worker 模式比主线程慢 1-2ms（通信开销）
- 但 UI 保持流畅，值得

## ⚠️ 注意事项

### 1. 初始化

```typescript
// ✅ 正确：启动时初始化一次
async start() {
    await WasmManager.getInstance().initialize();
    await WasmWorkerManager.getInstance().initialize();
}

// ❌ 错误：每次调用都初始化
async onClick() {
    await WasmManager.getInstance().initialize();  // 重复初始化，浪费时间
}
```

### 2. 数据传输

```typescript
// Worker 模式：零拷贝传输
const arr = new Float32Array(1_000_000);
const sum = await worker.sumArray(arr);
// 注意：arr 在 Worker 返回前不可用（所有权转移）

// 主线程模式：无此问题
const arr = new Float32Array(1_000_000);
const sum = wasm.sumArray(arr);
// arr 立即可用
```

### 3. 错误处理

```typescript
try {
    const wasm = WasmManager.getInstance();
    const success = await wasm.initialize();

    if (!success) {
        console.log('使用 JS fallback');
    }

    const result = wasm.sumArray(arr);  // 无论是否 WASM 都能工作
} catch (error) {
    console.error('WASM 调用失败:', error);
}
```

## 🧪 测试步骤

### 1. 在 Cocos Creator 中

1. 打开 `ModeSelect` 场景
2. 找到包含 `wasm_worker_test` 组件的节点
3. 添加 `UIWasmTest` 脚本组件
4. 运行场景（F5）
5. 点击 `btn_main` 测试主线程
6. 点击 `btn_worker` 测试 Worker
7. 查看结果和性能对比

### 2. 打包测试

1. 构建发布 → Web Mobile
2. 本地服务器：`npx serve build/web-mobile`
3. 浏览器访问，重复上述测试
4. 确认打包后功能正常

## 🔧 添加新的 WASM 函数

### 1. 在 Rust 中添加

```rust
// experiments/rust-hello-wasm/src/lib.rs
#[wasm_bindgen]
pub fn matrix_multiply(a: &[f32], b: &[f32], size: usize) -> Vec<f32> {
    // 实现...
}
```

### 2. 重新构建

```bash
cd experiments/rust-hello-wasm
./build-and-copy.sh
```

### 3. 在 WasmManager 中封装

```typescript
// WasmManager.ts
public matrixMultiply(a: Float32Array, b: Float32Array, size: number): Float32Array {
    if (this._wasmAvailable && this._wasmModule) {
        return this._wasmModule.matrix_multiply(a, b, size);
    } else {
        // JS fallback
        return this.matrixMultiplyJS(a, b, size);
    }
}
```

### 4. 在 WasmWorker 中添加消息处理

```typescript
// WasmWorker.ts
if (type === 'matrix_multiply') {
    const { a, b, size } = data;
    const result = wasmModule.matrix_multiply(a, b, size);
    self.postMessage({ type: 'result', id, result });
}
```

### 5. 在 WasmWorkerManager 中添加 API

```typescript
// WasmWorkerManager.ts
public async matrixMultiply(a: Float32Array, b: Float32Array, size: number): Promise<Float32Array> {
    if (this._workerAvailable) {
        const { result } = await this.sendRequest('matrix_multiply', { a, b, size });
        return result;
    } else {
        return this.matrixMultiplyJS(a, b, size);
    }
}
```

## 📚 相关文档

- `README.md` - WASM 集成总体说明
- `experiments/COCOS_WASM_INTEGRATION.md` - 完整集成指南
- `experiments/rust-hello-wasm/README.md` - Rust 构建说明
