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

```bash
wasm-pack build --target web
```

构建产物在 `pkg/` 目录：
- `rust_hello_wasm_bg.wasm` - WASM 二进制文件
- `rust_hello_wasm.js` - JavaScript 绑定代码
- `rust_hello_wasm.d.ts` - TypeScript 类型定义

### 构建优化版本

```bash
wasm-pack build --target web --release
```

## 开发模式

```bash
wasm-pack build --target web --dev
```

开发模式编译更快，但生成的 WASM 文件更大。

## 使用示例

```javascript
import init, { greet, sum_array } from './pkg/rust_hello_wasm.js';

// 初始化 WASM 模块
await init();

// 调用函数
console.log(greet('Claude'));  // "Hello from Rust, Claude!"

const arr = new Float32Array([1.0, 2.0, 3.0]);
console.log(sum_array(arr));   // 6.0
```

## 性能说明

WASM 在以下场景有优势：
- ✅ 大量数值计算（数组运算、矩阵计算等）
- ✅ CPU 密集型算法（寻路、物理模拟等）
- ❌ 频繁的 JS↔WASM 调用（有开销）
- ❌ 简单的 DOM 操作（JS 更快）
