# Rollup Guard - Cocos Creator 构建扩展

## 简介

Rollup Guard 是一个 Cocos Creator 3.8 构建扩展，用于优化 Sui SDK 的加载顺序。

### 解决的问题

**错误**：`Uncaught ReferenceError: System is not defined`

**原因**：
- `sui.system.js` 使用 `System.register()` API
- 如果在 `<head>` 中通过 `<script src>` 直接加载，会在 `system.bundle.js` 之前执行
- 此时 `System` 对象尚未定义，导致运行时错误

### 技术方案

**使用 System.import() 链式调用**：

```javascript
// 原来的方式（会报错）
<script src="./libs/sui.system.js"></script>  <!-- System 还未定义 -->
<script src="src/system.bundle.js"></script>   <!-- 提供 System 对象 -->
<script>
    System.import('./index.js').catch(console.error);
</script>

// 改为链式调用（正确）
<script src="src/system.bundle.js"></script>   <!-- 先加载，提供 System 对象 -->
<script>
    // Sui SDK (System.register 格式，必须在应用入口 index.js 之前加载)
    System.import('./libs/sui.system.js')       <!-- 通过 System.import 加载 -->
      .then(() => System.import('./index.js'))  <!-- 再加载应用入口 -->
      .catch(console.error);
</script>
```

**优势**：
- ✅ 显式控制加载顺序，确保 `System` 对象先定义
- ✅ 使用 Promise 链保证 `sui.system.js` 完全加载后再启动应用
- ✅ 符合 SystemJS 的最佳实践
- ✅ 自动化处理，无需手动修改每个构建产物

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

### 4. 重新构建项目

1. 点击 **Project → Build**
2. 选择 **web-desktop** 或 **web-mobile** 平台
3. 点击 **Build**
4. 构建过程中会看到扩展的日志输出：

```
[rollup-guard] ==========================================
[rollup-guard] onAfterBuild - Sui System Loader
[rollup-guard] Platform: web-mobile
[rollup-guard] Output: /path/to/build/web-mobile
[rollup-guard] 修改 sui.system.js 加载顺序...
[rollup-guard]   ✓ 已删除独立的 sui.system.js 脚本标签
[rollup-guard]   ✓ 已修改为链式调用: sui.system.js -> ./index.b5968.js
[rollup-guard] ✓ sui.system.js 加载顺序已优化
[rollup-guard] ✓ 处理完成
[rollup-guard] ==========================================
```

### 5. 验证构建结果

构建完成后，打开 `build/web-mobile/index.html`（或 `web-desktop/index.html`），查找以下代码：

```html
<script src="src/system.bundle.543e6.js" charset="utf-8"> </script>
<script src="src/import-map.dd101.json" type="systemjs-importmap" charset="utf-8"> </script>

<script>
    // Sui SDK (System.register 格式，必须在应用入口 index.js 之前加载)
    System.import('./libs/sui.system.js')
      .then(() => System.import('./index.b5968.js'))
      .catch(console.error)
</script>
```

**关键点**：
- ✅ `system.bundle.js` 在前
- ✅ `sui.system.js` 通过 `System.import()` 加载
- ✅ 应用入口通过 `.then()` 链式加载

### 6. 浏览器测试

打开浏览器访问 `index.html`，检查控制台：
- ✅ 没有 `System is not defined` 错误
- ✅ `SuiManager` 正常初始化
- ✅ 游戏正常运行

## 工作原理

### onAfterBuild 钩子

扩展在 Cocos Creator 构建完成后自动执行 `onAfterBuild` 钩子：

1. **检测平台**：只处理 `web-desktop` 和 `web-mobile` 平台
2. **查找 index.html**：读取构建输出目录中的 `index.html`
3. **删除独立脚本标签**：移除 `<script src="./libs/sui.system.js"></script>`（如果存在）
4. **修改 System.import() 调用**：将原有的 `System.import('./index.xxx.js')` 改为链式调用
5. **保存文件**：写回修改后的 HTML

### 正则表达式匹配

```typescript
// 匹配独立的 sui.system.js 脚本标签
const suiScriptRegex = /<script[^>]*src=["']\.\/libs\/sui\.system\.js["'][^>]*><\/script>\s*/gi;

// 匹配 System.import() 调用
const systemImportRegex = /System\.import\(['"]([^'"]+)['"]\)(\.catch\([^)]+\))?/g;
```

### 幂等性

扩展支持多次运行：
- 如果已经修改过（检测到 `System.import('./libs/sui.system.js')`），则跳过
- 避免重复处理导致代码错误

## 故障排查

### 如果构建后仍然出现 "System is not defined"

1. **检查扩展是否启用**：
   - Extension Manager → Project → 确认 `rollup-guard` 状态为 Enabled

2. **查看构建日志**：
   - 确认是否输出 `[rollup-guard] ✓ 已修改为链式调用` 日志
   - 如果没有日志，说明扩展未执行

3. **手动检查 index.html**：
   - 打开 `build/web-mobile/index.html`
   - 确认是否包含 `System.import('./libs/sui.system.js')`

4. **重新编译扩展**：
   ```bash
   cd extensions/rollup-guard
   npm run build
   ```
   然后在 Cocos Creator 中 Reload 扩展

### 如果扩展编译失败

```bash
# 清理并重新安装依赖
cd extensions/rollup-guard
rm -rf node_modules package-lock.json
npm install

# 重新编译
npm run build
```

### 如果 Cocos Creator 无法识别扩展

检查 `package.json` 中的关键字段：
```json
{
  "name": "rollup-guard",
  "main": "./dist/builder.js",
  "contributions": {
    "builder": "./dist/builder.js"
  }
}
```

确认 `dist/builder.js` 文件存在。

## 开发

### 目录结构

```
extensions/rollup-guard/
├── package.json          # 扩展元数据和依赖
├── tsconfig.json         # TypeScript 配置
├── README.md             # 本文档
├── src/
│   ├── builder.ts        # 平台配置
│   └── hooks/
│       └── index.ts      # 构建钩子实现（核心逻辑）
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

### 核心代码

主要逻辑在 `src/hooks/index.ts` 中的 `injectSuiSystemLoader()` 函数：

```typescript
function injectSuiSystemLoader(outDir: string): void {
    const indexPath = path.join(outDir, 'index.html');
    let html = fs.readFileSync(indexPath, 'utf-8');

    // 1. 删除独立的 sui.system.js 脚本标签
    html = html.replace(suiScriptRegex, '');

    // 2. 修改 System.import() 为链式调用
    const match = systemImportRegex.exec(html);
    if (match) {
        const entryFile = match[1];
        html = html.replace(match[0], `System.import('./libs/sui.system.js')
      .then(() => System.import('${entryFile}'))
      .catch(console.error)`);
    }

    fs.writeFileSync(indexPath, html, 'utf-8');
}
```

## 技术参考

- [Cocos Creator 3.8 - Extending Build Process](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/custom-build-plugin.html)
- [SystemJS - Import API](https://github.com/systemjs/systemjs/blob/main/docs/api.md#systemimportmodulename--normalizedparentname---promisemodule)
- [Sui TypeScript SDK](https://sdk.mystenlabs.com/typescript)

## 版本历史

### 2.0.0 (2025-01-17)
- 完全重写为 Sui System Loader
- 移除 ES2020 重压缩功能
- 移除 Import Map 外部化功能
- 专注于解决 `System is not defined` 问题

### 1.0.0 (2024)
- 原始版本（ES2020 + Import Map）

## License

MIT
