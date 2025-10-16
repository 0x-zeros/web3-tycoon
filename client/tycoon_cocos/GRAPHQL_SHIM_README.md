# GraphQL Shim 解决方案说明

## 问题背景

Cocos Creator 3.8.7 在构建时遇到 GraphQL 依赖的 ES 模块兼容性问题：

```
Error: 'print' is not exported by file:///...node_modules/graphql/index.mjs
```

**根本原因**：
- `@mysten/sui@1.38.0` 将 `graphql` 作为运行时依赖（dependencies）
- 即使项目只使用 JSON-RPC 功能（`client`/`transactions`/`keypairs`），不使用 GraphQL
- Cocos Creator 的 Rollup 构建系统无法正确处理 GraphQL 的混合模块格式（CommonJS + ES Module）

## 解决方案

使用"空壳 shim"替换 GraphQL 依赖，在编译期完全绕过 GraphQL 模块解析。

### 实施步骤

#### 1. 创建 GraphQL Shim

**文件**: `assets/scripts/shims/graphql.ts`

这是一个假的 graphql 模块，导出常见的 GraphQL 符号（`parse`, `print`, `Kind` 等），所有函数调用时会抛出错误，便于调试是否有代码意外使用了 GraphQL。

#### 2. 配置 TypeScript 路径映射

**修改**: `tsconfig.json`

添加 `paths` 配置，将所有 `graphql` 相关的 import 重定向到 shim：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "graphql": ["assets/scripts/shims/graphql.ts"],
      "graphql/*": ["assets/scripts/shims/graphql.ts"],
      "gql.tada": ["assets/scripts/shims/graphql.ts"],
      "@graphql-typed-document-node/core": ["assets/scripts/shims/graphql.ts"]
    }
  }
}
```

#### 3. 清理缓存并重新构建

```bash
# 运行清理脚本
./clean-build-cache.sh

# 或手动清理
rm -rf temp library build
```

然后在 Cocos Creator 编辑器中重新打开项目并执行构建。

## 工作原理

1. **编译期替换**：TypeScript 编译时，所有 `import ... from 'graphql'` 都会被重定向到 shim
2. **Rollup 打包**：Rollup 只会看到 shim 文件，不会尝试解析真实的 graphql 模块
3. **调试保护**：如果有代码意外调用 GraphQL 函数，会抛出明确的错误信息

## 验证方式

### 1. 编辑器预览

在 Cocos Creator 编辑器中点击"预览"，确认游戏功能正常。

### 2. 构建测试

执行 Web 或其他平台的构建，检查构建日志：

- ✅ **成功**：构建完成，无 GraphQL 相关错误
- ❌ **失败**：如果仍有错误，查看下方的"故障排查"

### 3. 运行时验证

如果构建成功，运行游戏并测试 Sui 相关功能：
- 钱包连接
- 交易签名
- 链上查询

如果抛出 `[shim/graphql] XXX was called` 错误，说明有代码意外使用了 GraphQL，需要检查代码。

## 故障排查

### 问题 1：构建时仍报 GraphQL 错误

**可能原因**：Cocos Creator 的 Rollup 不识别 tsconfig.json 的 `paths` 配置

**解决方案**：
1. 检查 Cocos Creator 版本是否支持 TypeScript paths
2. 尝试重启 Cocos Creator 编辑器
3. 检查 `tsconfig.json` 的 `baseUrl` 是否为 `"."`
4. 如果问题持续，可能需要使用更底层的方案（如 npm overrides 或 pnpm）

### 问题 2：运行时抛出 `[shim/graphql] XXX was called`

**原因**：有代码调用了 GraphQL 函数

**解决方案**：
1. 查看错误堆栈，定位是哪个文件调用了 GraphQL
2. 检查是否误用了 `@mysten/sui/graphql` 模块
3. 如果是 `@mysten/sui` 内部调用，可能需要更新 SDK 版本或使用其他方案

### 问题 3：TypeScript 类型错误

**原因**：shim 的类型定义不完整

**解决方案**：
1. 打开 `assets/scripts/shims/graphql.ts`
2. 根据错误信息补充缺失的类型或函数导出
3. 参考真实 graphql 包的类型定义（`node_modules/graphql/index.d.ts`）

## 依赖的模块

本项目**只使用**以下 `@mysten/sui` 子模块（不依赖 GraphQL）：

- ✅ `@mysten/sui/client` - SuiClient（JSON-RPC）
- ✅ `@mysten/sui/transactions` - Transaction
- ✅ `@mysten/sui/keypairs/ed25519` - Ed25519Keypair
- ✅ `@mysten/sui/bcs` - BCS 序列化
- ✅ `@mysten/sui/faucet` - Faucet 工具

**不使用**：
- ❌ `@mysten/sui/graphql` - GraphQL 查询（已被 shim 替换）

## 维护说明

### 更新 @mysten/sui 版本

在更新 `@mysten/sui` 版本后：

1. 检查新版本是否仍将 `graphql` 作为依赖
2. 如果依然存在，继续使用 shim 方案
3. 如果新版本已移除 GraphQL 依赖，可以删除 shim 和 tsconfig.json 的 paths 配置

### 扩展 Shim

如果遇到新的 GraphQL 相关错误，可能需要在 shim 中添加更多导出：

```typescript
// assets/scripts/shims/graphql.ts

// 添加新的类型
export type NewGraphQLType = unknown;

// 添加新的函数
export const newGraphQLFunction = (..._args: any[]): never => {
  throw new Error('[shim/graphql] newGraphQLFunction() was called but GraphQL is disabled');
};
```

## 参考资料

- [Cocos Creator 3.8 模块规范](https://docs.cocos.com/creator/3.8/manual/en/scripting/modules/spec.html)
- [Cocos Creator 外部模块使用](https://docs.cocos.com/creator/3.8/manual/en/scripting/modules/example.html)
- [@mysten/sui TypeScript SDK](https://sdk.mystenlabs.com)

## 总结

这个方案通过在编译期替换 GraphQL 依赖，彻底解决了 Cocos Creator 构建时的 ES 模块兼容性问题。只要项目不使用 GraphQL 功能，这个方案就是安全且高效的。
