# Cocos Creator WASM 集成完整指南

本文档说明如何将 Rust WASM 集成到 Cocos Creator 项目中，并进行打包测试。

## 🎯 目标

- ✅ 在 Cocos Creator 中运行 Rust WASM
- ✅ 验证开发环境功能
- ✅ 测试打包后的运行
- ✅ 评估性能提升

## 📁 文件结构

```
experiments/
├── rust-hello-wasm/              # Rust WASM 源码
│   ├── src/lib.rs                # Rust 代码
│   ├── pkg/                      # 构建产物
│   └── build-and-copy.sh         # 一键构建脚本
└── COCOS_WASM_INTEGRATION.md     # 本文档

client/tycoon_cocos/
└── assets/
    ├── wasm/                     # WASM 文件
    │   ├── rust_hello_wasm_bg.wasm
    │   ├── rust_hello_wasm.js
    │   └── rust_hello_wasm.d.ts
    └── scripts/wasm/             # 集成代码
        ├── WasmManager.ts        # WASM 管理器
        ├── WasmTest.ts           # 测试组件
        └── README.md             # 详细文档
```

## 🚀 快速开始

### 1. 构建 WASM 模块

```bash
cd experiments/rust-hello-wasm
./build-and-copy.sh
```

这个脚本会：
- 使用 `wasm-pack build --target no-modules --release` 构建
- 复制生成的文件到 Cocos Creator 项目
- 显示文件信息

**手动构建（如果需要）**：
```bash
cd experiments/rust-hello-wasm
wasm-pack build --target no-modules --release
cp pkg/*.{wasm,js,d.ts} ../../client/tycoon_cocos/assets/wasm/
```

### 2. 在 Cocos Creator 中测试

#### 方式 A：使用测试组件（推荐）

1. **打开 Cocos Creator 3.8.7**
2. **打开项目**：`client/tycoon_cocos`
3. **创建测试场景**（或使用现有场景）：
   - 创建空节点命名为 "WasmTestNode"
   - 添加 `WasmTest` 组件
4. **设置 UI**：
   - 创建 Label 节点 → 赋值给 `statusLabel`
   - 创建 Label 节点 → 赋值给 `resultLabel`
   - 创建 Button 节点 → 赋值给 `testButton`
5. **运行场景**（F5 或点击预览按钮）
6. **点击测试按钮**，查看结果

#### 方式 B：代码调用

在任意 TypeScript 脚本中：

```typescript
import { WasmManager } from './wasm/WasmManager';

async start() {
    const wasm = WasmManager.getInstance();
    await wasm.initialize();

    // 测试求和
    const arr = new Float32Array(1_000_000);
    for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.random();
    }

    const result = wasm.sumArray(arr);
    console.log('WASM 求和结果:', result);
}
```

### 3. 打包测试

#### 3.1 在 Cocos Creator 中构建

1. **菜单**：项目 → 构建发布
2. **配置**：
   - 平台：Web Mobile（或 Web Desktop）
   - 目标路径：`build/web-mobile/`
   - 调试模式：取消勾选（测试发布版本）
3. **点击"构建"**，等待完成

#### 3.2 本地测试打包结果

```bash
cd client/tycoon_cocos/build/web-mobile
npx serve .
```

或者使用 Python：
```bash
python3 -m http.server 8000
```

**访问**：打开浏览器访问 `http://localhost:3000`（或 8000）

**测试**：
- 点击测试按钮
- 查看浏览器控制台（F12）
- 确认 WASM 正常加载和运行

## 🔍 验证清单

### 开发环境

- [ ] WASM 文件成功复制到 `assets/wasm/`
- [ ] Cocos Creator 预览无错误
- [ ] WasmTest 组件加载成功
- [ ] 点击按钮显示测试结果
- [ ] 控制台显示性能数据
- [ ] WASM 比 JS 快 2-3 倍

### 打包环境

- [ ] 构建成功无错误
- [ ] `build/web-mobile/assets/wasm/` 包含 WASM 文件
- [ ] 本地服务器正常启动
- [ ] 浏览器访问无错误
- [ ] WASM 功能正常
- [ ] 性能与开发环境一致

## 📊 预期性能

**测试环境**：Chrome 浏览器，100万随机数求和

| 环境 | JS 耗时 | WASM 耗时 | 性能提升 |
|------|--------|-----------|---------|
| 开发（预览） | ~10-15ms | ~4-6ms | 2-3x |
| 打包（发布） | ~10-15ms | ~4-6ms | 2-3x |

**注意**：
- 浮点数精度误差 < 0.001%（正常）
- 小数组（< 1000）优势不明显
- 复杂算法提升更显著

## 🛠 技术要点

### 为什么使用 no-modules？

| 对比项 | web | no-modules |
|-------|-----|-----------|
| 模块系统 | ES Module | 全局对象 |
| Cocos 兼容性 | ⚠️ 可能有问题 | ✅ 完全兼容 |
| 加载方式 | `import` | `<script>` + `ArrayBuffer` |
| 初始化 | `await init()` | `await wasm_bindgen(buffer)` |
| 打包稳定性 | ⚠️ 不确定 | ✅ 稳定 |

**结论**：Cocos Creator 的打包系统对 ES Module 支持不完整，`no-modules` 更可靠。

### WasmManager 设计

**单例模式**：
- 全局唯一实例
- 统一管理 WASM 生命周期
- 避免重复加载

**加载流程**：
1. 加载 `rust_hello_wasm.js` → 暴露全局 `wasm_bindgen`
2. 加载 `rust_hello_wasm_bg.wasm` → 获取 `ArrayBuffer`
3. 调用 `wasm_bindgen(buffer)` → 初始化 WASM
4. 通过 `wasm_bindgen.sum_array()` 等调用函数

**API 封装**：
- `initialize()` - 异步初始化
- `greet(name)` - 类型安全的包装
- `sumArray(arr)` - 类型安全的包装
- `wasmModule` - 直接访问原始 WASM 对象

## 🐛 常见问题

### 1. WASM 加载失败

**症状**：控制台报错 `Failed to load WASM`

**解决**：
```bash
# 检查文件是否存在
ls -la client/tycoon_cocos/assets/wasm/

# 重新构建和复制
cd experiments/rust-hello-wasm
./build-and-copy.sh

# 在 Cocos Creator 中刷新资源
```

### 2. 打包后 404 错误

**症状**：打包后访问 WASM 文件 404

**解决**：
1. 检查构建配置是否包含 `assets/wasm/`
2. 查看 `build/web-mobile/assets/wasm/` 是否有文件
3. 如果没有，手动复制：
   ```bash
   cp -r client/tycoon_cocos/assets/wasm client/tycoon_cocos/build/web-mobile/assets/
   ```

### 3. 性能没有提升

**可能原因**：
- 测试数据太小（< 1000 元素）
- 浏览器未启用 WASM 优化
- 数据传输开销过大

**建议**：
- 使用更大的测试数据（> 100万）
- 使用现代浏览器（Chrome/Firefox 最新版）
- 测试复杂算法而非简单运算

### 4. TypeScript 类型错误

**症状**：`WasmManager` 导入错误

**解决**：
```bash
# 确保 Cocos Creator 已刷新资源
# 或重启 Cocos Creator
```

## 📝 下一步

集成成功后，可以考虑：

### 1. 体素网格生成优化

**目标**：将 Greedy Meshing 算法移植到 Rust

**预期**：10-20x 性能提升（复杂算法）

**实现**：
1. 在 `rust-hello-wasm/src/lib.rs` 添加网格生成函数
2. 重新构建：`./build-and-copy.sh`
3. 在 `WasmManager` 中添加对应 API

### 2. 寻路算法加速

**目标**：A* / Dijkstra Rust 实现

**预期**：5-10x 性能提升

### 3. 物理计算

**目标**：碰撞检测、刚体模拟

### 4. 数据处理

**目标**：大量游戏数据批处理

## 📚 参考资料

- **WasmManager 文档**：`client/tycoon_cocos/assets/scripts/wasm/README.md`
- **Rust 源码**：`experiments/rust-hello-wasm/src/lib.rs`
- **wasm-bindgen 文档**：https://rustwasm.github.io/wasm-bindgen/
- **Cocos Creator 文档**：https://docs.cocos.com/creator/3.8/

## ✅ 成功标准

完成以下所有项即为集成成功：

- [x] WASM 在开发环境正常运行
- [x] 性能测试显示 2-3x 提升
- [ ] 打包后功能正常
- [ ] 打包后性能保持
- [ ] 无控制台错误
- [ ] 用户体验流畅

---

**祝测试顺利！** 🎉

有问题查看详细文档或控制台错误信息。
