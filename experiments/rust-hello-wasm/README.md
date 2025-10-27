# rust-hello-wasm

最简单的 Rust→WASM 示例项目。

## 功能

- `greet(name)`: 简单字符串处理
- `sum_array(arr)`: 数组求和（性能测试）
- `multiply_array(arr, factor)`: 数组元素乘以常数

## 构建

### 安装 wasm-pack（首次）

```bash
cargo install wasm-pack
```

### 构建 WASM

**标准 Web 环境（Vite/Webpack）**：
```bash
wasm-pack build --target web --release
```

**Cocos Creator 集成（推荐）**：
```bash
wasm-pack build --target no-modules --release
```

构建产物在 `pkg/` 目录：
- `rust_hello_wasm_bg.wasm` - WASM 二进制文件
- `rust_hello_wasm.js` - JavaScript 绑定代码
- `rust_hello_wasm.d.ts` - TypeScript 类型定义

### Target 选择说明

| Target | 适用场景 | 模块系统 |
|--------|---------|---------|
| `web` | Vite, Webpack 等现代打包工具 | ES Module |
| `no-modules` | 传统浏览器, Cocos Creator | 全局对象 |
| `bundler` | Webpack/Rollup 深度集成 | CommonJS |

**Cocos Creator 必须使用 `no-modules`**，因为 Cocos 打包系统对 ES Module 支持不完整。

### 开发模式

```bash
wasm-pack build --target no-modules --dev
```

开发模式编译更快，但生成的 WASM 文件更大。

## 使用示例

### Web 环境（ES Module）

```javascript
import init, { greet, sum_array } from './pkg/rust_hello_wasm.js';

// 初始化 WASM 模块
await init();

// 调用函数
console.log(greet('Claude'));  // "Hello from Rust, Claude!"

const arr = new Float32Array([1.0, 2.0, 3.0]);
console.log(sum_array(arr));   // 6.0
```

### no-modules 环境（Cocos Creator）

```typescript
// 1. 加载 glue code (暴露全局 wasm_bindgen)
<script src="assets/wasm/rust_hello_wasm.js"></script>

// 2. 加载 WASM 二进制
const wasmBuffer = await fetch('assets/wasm/rust_hello_wasm_bg.wasm')
    .then(r => r.arrayBuffer());

// 3. 初始化
await wasm_bindgen(wasmBuffer);

// 4. 调用函数（通过全局对象）
const result = wasm_bindgen.sum_array(new Float32Array([1, 2, 3]));
console.log(result);  // 6.0
```

### Cocos Creator 集成

详见 `../../client/tycoon_cocos/assets/scripts/wasm/README.md`

快速步骤：
1. 构建 WASM: `wasm-pack build --target no-modules --release`
2. 复制文件到 Cocos 项目
3. 使用 `WasmManager` 单例管理

```typescript
import { WasmManager } from './wasm/WasmManager';

const wasm = WasmManager.getInstance();
await wasm.initialize();
const sum = wasm.sumArray(new Float32Array([1, 2, 3]));
```

## 性能说明

WASM 在以下场景有优势：
- ✅ 大量数值计算（数组运算、矩阵计算等）
- ✅ CPU 密集型算法（寻路、物理模拟等）
- ❌ 频繁的 JS↔WASM 调用（有开销）
- ❌ 简单的 DOM 操作（JS 更快）
