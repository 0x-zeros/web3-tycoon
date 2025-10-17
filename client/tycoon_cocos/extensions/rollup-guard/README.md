# Rollup Guard - Cocos Creator 构建扩展

## 简介

Rollup Guard 是一个 Cocos Creator 3.8 构建扩展，用于解决 Web 平台构建时 `node_modules` 被错误转译导致的运行时错误。

### 解决的问题

1. **node_modules 被 Babel 转译**：`@mysten/sui` 和 `@mysten/wallet-standard` 等现代化的 npm 包已编译为 ES2020+，不应再次转译
2. **BigInt 指数运算符被错误降级**：`2n ** 64n` 被转译为 `Math.pow(2n, 64n)` 导致运行时错误（Math.pow 不支持 BigInt）

### 技术方案

基于 **后处理 + Import Map** 的策略：

1. **onAfterBuild 后处理**：使用 Terser 以 `ecma: 2020` 重新压缩输出 JS，保留 BigInt 和 `**` 运算符
2. **Import Map 外部化**：将 `@mysten/*` 包复制为独立的 ESM 文件，通过 Import Map 让浏览器原生加载，完全跳过打包/转译流程
3. **自定义 build-template**：覆盖 `index.html`，注入 `<script type="importmap">`

## 安装和使用

### 1. 安装依赖

```bash
cd extensions/rollup-guard
npm install
```

### 2. 编译扩展

```bash
npm run build
```

编译后会在 `dist/` 目录生成 JavaScript 文件。

### 3. 启用扩展

1. 打开 Cocos Creator 3.8.7
2. 菜单：**Extension → Extension Manager**
3. 切换到 **Project** 标签页
4. 找到 `rollup-guard` 扩展
5. 点击启用（Enable）

如果已经启用过，修改源代码后需要点击 **Reload** 按钮重新加载。

### 4. 配置构建选项

在 **Build** 面板中，选择 **web-desktop** 或 **web-mobile** 平台后，会看到扩展提供的选项：

- ✅ **重压缩为 ES2020+（保留 BigInt/**）** - 默认启用
  - 使用 Terser 以 ES2020 重新压缩输出 JS，防止 BigInt 和 ** 被降级

- ✅ **外部化 @mysten/*（Import Map）** - 默认启用
  - 将 @mysten 包作为原生 ESM 加载，完全跳过打包/转译

### 5. 重新构建项目

1. 配置好选项后，点击 **Build**
2. 构建过程中会看到扩展的日志输出：

```
[rollup-guard] ==========================================
[rollup-guard] onAfterBuild - 开始后处理...
[rollup-guard] Platform: web-mobile
[rollup-guard] Output: /path/to/build/web-mobile
[rollup-guard] 配置: retargetES2020 = true
[rollup-guard] 配置: externalizeMysten = true
[rollup-guard] 开始以 ES2020 重新压缩输出 JS...
[rollup-guard] 找到 X 个 JS 文件需要处理
[rollup-guard] ✓ 重新压缩完成，处理了 X 个文件
[rollup-guard] 开始复制 @mysten/* ESM 文件...
[rollup-guard]   ✓ @mysten/sui/client -> libs/_mysten_sui_client.js
[rollup-guard]   ✓ @mysten/sui/transactions -> libs/_mysten_sui_transactions.js
[rollup-guard]   ✓ @mysten/wallet-standard -> libs/_mysten_wallet-standard.js
[rollup-guard] ✓ Import Map 已写入
[rollup-guard] ✓ 后处理完成
[rollup-guard] ==========================================
```

### 6. 验证构建结果

构建完成后，检查输出目录：

```
build/web-mobile/  (或 web-desktop)
├── index.html              # 引入了 importmap.json
├── importmap.json          # Import Map 配置
├── libs/                   # 外部化的 ESM 文件
│   ├── _mysten_sui_client.js
│   ├── _mysten_sui_transactions.js
│   ├── _mysten_wallet-standard.js
│   └── ...
├── src/
│   └── project.js          # 已用 ES2020 重新压缩
└── ...
```

打开 `index.html` 验证：
- 包含 `<script type="importmap" src="./importmap.json"></script>`

打开 `importmap.json` 验证：
```json
{
  "imports": {
    "@mysten/sui/client": "./libs/_mysten_sui_client.js",
    "@mysten/sui/transactions": "./libs/_mysten_sui_transactions.js",
    ...
  }
}
```

## 工作原理

### 为什么不能直接修改内部 Rollup/Babel 配置？

根据 Cocos Creator 官方文档：**构建钩子接收的 options 是副本，无法直接影响内部打包参数**。

因此，我们采用**后处理（post-process）**策略：

1. 让 Cocos Creator 正常构建（可能会错误转译 node_modules）
2. 在 `onAfterBuild` 钩子中，对输出的 JS 文件重新处理
3. 使用 Terser 以 `ecma: 2020` 重新压缩，确保 BigInt 和 `**` 不被降级

### Import Map 的优势

将 `@mysten/*` 包作为独立的 ESM 文件：
- ✅ 浏览器直接加载原始 ESM，不经过 Rollup/Babel 转译
- ✅ 完全绕过"node_modules 被转译"的问题
- ✅ 保留所有现代语法（BigInt、`**`、顶层 await 等）
- ✅ 符合 Web 标准，兼容性好（Chrome 89+, Safari 15+, Firefox 108+）

## 故障排查

### 如果看到 "未找到 @mysten/sui ESM 文件" 警告

检查 `node_modules/@mysten/sui/package.json` 的 `exports` 字段，确认实际的 ESM 入口路径。

当前配置假设路径为：
```
node_modules/@mysten/sui/dist/esm/client/index.js
node_modules/@mysten/sui/dist/esm/transactions/index.js
...
```

如果路径不同，修改 `src/hooks/index.ts` 中的 `mapping` 对象。

### 如果仍然出现 BigInt 错误

1. 检查构建日志，确认扩展是否正确执行
2. 检查 `importmap.json` 是否正确生成
3. 检查浏览器控制台是否有 Import Map 加载错误
4. 确认使用的浏览器支持 Import Map（建议使用最新版 Chrome/Edge）

### 如果 Import Map 不起作用

某些浏览器可能需要额外配置。建议：
- 使用 Chrome 89+ 或 Edge 89+
- 检查 `index.html` 中的 `<script type="importmap">` 是否在其他脚本之前加载

## 开发

### 目录结构

```
extensions/rollup-guard/
├── package.json          # 扩展元数据和依赖
├── tsconfig.json         # TypeScript 配置
├── README.md             # 本文档
├── src/
│   ├── builder.ts        # 平台配置和面板选项
│   └── hooks/
│       └── index.ts      # 构建钩子实现（后处理逻辑）
└── dist/                 # 编译输出（npm run build）
    ├── builder.js
    └── hooks/
        └── index.js
```

### 监听模式（开发时）

```bash
npm run watch
```

修改源代码后自动重新编译。重新编译后需要在 Cocos Creator 中重新加载扩展（Extension Manager → Reload）。

## 配合的其他文件

### build-templates/

项目根目录下的 `build-templates/` 目录包含自定义的 HTML 模板：

```
build-templates/
├── web-mobile/
│   └── index.html        # 移动端 HTML 模板（包含 Import Map）
└── web-desktop/
    └── index.html        # 桌面端 HTML 模板（包含 Import Map）
```

Cocos Creator 会在构建时自动使用这些模板覆盖默认的 `index.html`。

### tsconfig.json（项目级别）

确保项目的 `tsconfig.json` 也设置为 ES2020：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020", "DOM"]
  }
}
```

这样可以避免源代码在编译时就被降级。

## 技术参考

- [Cocos Creator 3.8 - Extending Build Process](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/custom-build-plugin.html)
- [Rollup Plugin Babel - Exclude node_modules](https://github.com/rollup/plugins/tree/master/packages/babel#exclude)
- [Solana Wallet Adapter - BigInt Issue](https://solana.stackexchange.com/questions/2552/react-native-build-error-when-installing-solana-wallet-adapter-module-parse-fa)
- [MDN - Import Maps](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap)

## License

MIT
