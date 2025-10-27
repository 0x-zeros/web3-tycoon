# Cocos Creator WASM 集成

本目录包含 Rust WASM 在 Cocos Creator 中的集成代码。

## 文件说明

- `WasmManager.ts` - WASM 模块管理器（单例模式）
- `WasmTest.ts` - 测试组件，演示 JS vs WASM 性能对比

## 使用步骤

### 1. 构建 WASM 模块

```bash
cd experiments/rust-hello-wasm
wasm-pack build --target no-modules --release
```

**重要**：必须使用 `--target no-modules`，Cocos Creator 对标准 ES Module 支持不完整。

### 2. 复制 WASM 文件到项目

```bash
cp pkg/rust_hello_wasm_bg.wasm ../../client/tycoon_cocos/assets/wasm/
cp pkg/rust_hello_wasm.js ../../client/tycoon_cocos/assets/wasm/
```

### 3. 在 Cocos Creator 中使用

#### 方式1：使用 WasmTest 组件（推荐用于测试）

1. 在场景中创建一个节点
2. 添加 `WasmTest` 组件
3. 分配 UI 组件：
   - `statusLabel`: 显示状态的 Label
   - `resultLabel`: 显示结果的 Label
   - `testButton`: 触发测试的 Button
4. 运行场景，点击按钮测试

#### 方式2：直接使用 WasmManager

```typescript
import { WasmManager } from './wasm/WasmManager';

// 初始化 WASM
const wasmManager = WasmManager.getInstance();
await wasmManager.initialize();

// 调用 WASM 函数
const result = wasmManager.sumArray(new Float32Array([1, 2, 3]));
console.log('Sum:', result);  // 6
```

## API 参考

### WasmManager

**单例模式**，统一管理 WASM 模块的生命周期。

#### 初始化

```typescript
const wasmManager = WasmManager.getInstance();
const success = await wasmManager.initialize();
```

#### 检查状态

```typescript
if (wasmManager.isInitialized) {
    // WASM 已就绪
}
```

#### 调用 WASM 函数

```typescript
// 问候函数
const greeting = wasmManager.greet('Claude');
// "Hello from Rust, Claude!"

// 数组求和
const arr = new Float32Array([1.0, 2.0, 3.0]);
const sum = wasmManager.sumArray(arr);
// 6.0

// 数组乘以常数（原地修改）
wasmManager.multiplyArray(arr, 2.0);
// arr 现在是 [2.0, 4.0, 6.0]
```

#### 直接访问 WASM 模块

```typescript
const wasm = wasmManager.wasmModule;
// wasm.sum_array(), wasm.greet() 等
```

## 打包测试

### 1. 在 Cocos Creator 中构建

1. 菜单：项目 → 构建发布
2. 平台：Web Mobile / Web Desktop
3. 目标路径：`build/web-mobile/`
4. 点击"构建"

### 2. 本地测试

```bash
cd client/tycoon_cocos/build/web-mobile
npx serve .
```

打开浏览器访问 `http://localhost:3000`，测试 WASM 功能。

## 性能说明

### 预期性能提升

- **数组求和**（100万数字）：2-3x 加速
- **复杂算法**（矩阵运算、寻路等）：更显著的提升

### 注意事项

1. **浮点数精度**：
   - WASM 使用 `f32`，JS 使用 `f64`
   - 大量计算会有累积误差（通常 < 0.001%）
   - 这是正常现象，不影响实际应用

2. **数据传输开销**：
   - 小数组（< 1000 元素）可能 JS 更快
   - 大数组（> 10000 元素）WASM 优势明显
   - 复杂算法比简单计算更适合 WASM

3. **初始化时间**：
   - WASM 模块需要加载和编译（~10-50ms）
   - 在游戏启动时初始化，避免运行时加载

## 技术细节

### no-modules 模式

```typescript
// 1. 加载 glue code (暴露全局 wasm_bindgen 函数)
<script src="assets/wasm/rust_hello_wasm.js"></script>

// 2. 加载 WASM 二进制
const wasmBuffer = await fetch('assets/wasm/rust_hello_wasm_bg.wasm')
    .then(r => r.arrayBuffer());

// 3. 初始化
await wasm_bindgen(wasmBuffer);

// 4. 调用函数
const result = wasm_bindgen.sum_array(array);
```

### 为什么使用 no-modules？

- ✅ Cocos Creator 打包系统对 ES Module 支持不完整
- ✅ 全局对象模式更可控，兼容性更好
- ✅ 可以手动控制 WASM 加载时机和方式
- ✅ 打包后更稳定

## 故障排除

### WASM 加载失败

**检查**：
1. `assets/wasm/` 目录是否存在
2. WASM 文件是否正确复制
3. 浏览器控制台的错误信息

**解决**：
- 确保路径正确：`assets/wasm/rust_hello_wasm_bg.wasm`
- 检查文件大小（应该 > 10KB）
- 清除浏览器缓存重试

### 打包后无法加载

**检查**：
1. 构建配置是否包含 `assets/wasm/` 目录
2. MIME type 是否正确（`application/wasm`）

**解决**：
- 在 Cocos Creator 中确认 wasm 文件被包含在构建中
- 检查服务器 MIME type 配置

### 性能没有提升

**可能原因**：
1. 测试数据太小（< 1000 元素）
2. 数据传输开销超过计算节省
3. 浏览器未启用 WASM 优化

**建议**：
- 使用更大的测试数据（> 100万）
- 测试复杂算法而非简单运算
- 使用现代浏览器（Chrome/Firefox/Safari 最新版）

## 下一步

集成成功后，可以考虑：

1. **体素网格生成优化** - Greedy Meshing 算法 Rust 实现
2. **寻路算法加速** - A*/Dijkstra Rust 版本
3. **物理计算** - 碰撞检测、刚体模拟
4. **数据处理** - 大量游戏数据的批处理

查看 `experiments/rust-hello-wasm/` 了解如何添加新的 WASM 函数。
