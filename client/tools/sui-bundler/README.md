# Sui SDK System.register Bundler

将 Sui SDK 打包为 System.register 格式，供 Cocos Creator 使用。

## 为什么需要这个工具？

Cocos Creator 使用 SystemJS 加载模块，原生 ESM 在 SystemJS 中会报错。将 Sui SDK 预打包为 System.register 格式可以：

- ✅ 避免被 Cocos Creator 的构建管线处理（BigInt 降级等问题）
- ✅ 保留 ES2020+ 语法（BigInt、** 运算符）
- ✅ 单文件加载，不需要复杂的 import-map 配置
- ✅ Preview 和 Build 模式都能正常工作

## 使用方法

### 1. 安装依赖

```bash
cd client/tools/sui-bundler
npm install
```

### 2. 构建

```bash
npm run build
```

输出：`dist/sui.system.js`

### 3. 构建并复制（一键）

```bash
npm run build:copy
```

自动复制到：
- `../../tycoon_cocos/preview-template/libs/sui.system.js`
- `../../tycoon_cocos/build-templates/web-mobile/libs/sui.system.js`
- `../../tycoon_cocos/build-templates/web-desktop/libs/sui.system.js`

### 4. 在模板中引用

**Preview 模式（preview-template/index.ejs）：**
```html
<script src="/libs/sui.system.js"></script>
```

**Build 模式（build-templates/web-*/index.html）：**
```html
<script src="./libs/sui.system.js"></script>
```

### 5. 业务代码中使用

```typescript
// 动态加载（Preview 模式）
const sui = await System.import('/libs/sui.system.js');
const { SuiClient } = sui;

// 动态加载（Build 模式）
const sui = await System.import('./libs/sui.system.js');
const { SuiClient } = sui;
```

## 导出的 API

- `@mysten/sui/client` - SuiClient, getFullnodeUrl 等
- `@mysten/sui/transactions` - Transaction
- `@mysten/sui/keypairs/ed25519` - Ed25519Keypair
- `@mysten/sui/bcs` - BCS 序列化
- `@mysten/sui/utils` - 工具函数
- `@mysten/sui/faucet` - Faucet 工具
- `@mysten/wallet-standard` - Wallet Standard

## 配置说明

### Rollup 配置（rollup.config.mjs）

- `format: "system"` - SystemJS 格式
- `inlineDynamicImports: true` - 单文件输出
- `generatedCode.preset: "es2020"` - 保留 ES2020+ 语法
- `terser.ecma: 2020` - 压缩时保留 BigInt/**

### 入口文件（src/index.ts）

只导出实际使用的 API，减少最终体积。如需添加新的导出，编辑此文件。

## 故障排除

### 构建错误

如果构建失败，检查：
- Node.js 版本 >= 18
- npm install 是否成功
- TypeScript 编译错误

### 运行时错误

如果浏览器报错，检查：
- `sui.system.js` 是否正确复制到 libs/
- `<script>` 标签是否在 main.js 之前
- System.import() 路径是否正确（Preview 用 `/libs/`，Build 用 `./libs/`）

### BigInt 错误

如果仍然有 BigInt 错误，检查：
- Rollup 配置的 `generatedCode.preset` 是否为 "es2020"
- Terser 配置的 `ecma` 是否为 2020
- 浏览器是否支持 ES2020（Chrome 85+, Safari 14+）
