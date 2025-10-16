# Cocos Creator 构建问题修复总结

## 问题 1: GraphQL 依赖兼容性

### 错误信息
```
Error: 'print' is not exported by file:///...node_modules/graphql/index.mjs
```

### 解决方案
使用 **GraphQL Shim** 方案，在编译期替换 graphql 依赖。

### 修改文件
1. ✅ `assets/scripts/shims/graphql.ts` - 空壳 GraphQL 模块
2. ✅ `tsconfig.json` - 添加 paths 映射
3. ✅ `clean-build-cache.sh` - 缓存清理脚本

### 详细说明
参见 `GRAPHQL_SHIM_README.md`

---

## 问题 2: 循环依赖

### 错误信息
```
Circular dependency: UIManager.ts -> UIWallet.ts -> UIManager.ts
```

### 发现的循环依赖（共3个）

1. **Role ↔ Actor**（已部分解决）
2. **ActorConfig ↔ PaperActor**
3. **核心系统大循环**:
   ```
   GameInitializer → GameSession → SuiManager 
   → BankruptHandler → UIManager → UIInGame → GameInitializer
   ```

### 解决方案

#### 方案 A: 抽取共享类型
- 创建 `role/ActorTypes.ts` - 放置 ActorType 枚举
- 扩展 `ui/core/UITypes.ts` - 放置 UILayer、UIConfig 等

#### 方案 B: 使用 `import type`
- UIManager 对 UI 组件使用 `import type`
- 实例化时使用字符串组件名

#### 方案 C: 单例访问 + `declare` 声明
- Handlers 使用 `declare const UIManager: any;`
- UI 组件从 Blackboard 获取 GameSession

### 修改文件（14个）

#### 新建
1. ✅ `role/ActorTypes.ts`

#### Role 层（2）
2. ✅ `role/ActorConfig.ts`
3. ✅ `role/PaperActor.ts`

#### UI 层（10）
4. ✅ `ui/core/UITypes.ts`
5. ✅ `ui/core/UIManager.ts`
6. ✅ `ui/game/UIWallet.ts`
7. ✅ `ui/game/UIInGame.ts`
8. ✅ `ui/game/UIInGameInfo.ts`
9. ✅ `ui/game/UIInGameDebug.ts`
10. ✅ `ui/game/UIInGameCards.ts`
11. ✅ `ui/game/UIInGamePlayer.ts`
12. ✅ `ui/game/UIInGameDice.ts`
13. ✅ `ui/game/UIInGameBuildingSelect.ts`

#### Sui 层（2）
14. ✅ `sui/events/handlers/BankruptHandler.ts`
15. ✅ `sui/events/handlers/GameEndedHandler.ts`

### 详细说明
参见 `CIRCULAR_DEPENDENCY_FIX.md`

---

## 后续操作

### 1. 清理缓存（必须）

```bash
./clean-build-cache.sh
```

### 2. 重新构建

1. 在 Cocos Creator 编辑器中重新打开项目
2. 等待编译完成
3. 执行构建测试

### 3. 预期结果

✅ 构建成功，不再出现以下错误：
- GraphQL 模块导出错误
- 循环依赖警告

✅ 编辑器预览正常

✅ 游戏功能正常：
- UI 系统
- 钱包连接
- Sui 集成
- 事件处理

---

## 技术总结

### GraphQL Shim 原理

```
你的代码
  ↓ import '@mysten/sui/client'
  ↓ (TypeScript 编译)
  ↓ tsconfig paths: graphql → shims/graphql.ts
  ↓ (Rollup 打包)
  ✅ 不再解析 node_modules/graphql
  ✅ 构建成功
```

### 循环依赖解决原理

```
修改前:
UIManager.ts ← import ← UIWallet.ts ← import ← UIManager.ts  ❌

修改后:
UIManager.ts ← import type ← UIWallet.ts
                              ↓ declare UIManager
                              ✅ 运行时单例访问
```

### 关键技术点

1. **TypeScript paths 映射**：编译期重定向模块
2. **import type**：仅导入类型，编译后擦除
3. **declare 声明**：告知 TypeScript 运行时存在的对象
4. **Blackboard 模式**：共享状态存储，减少直接依赖
5. **字符串组件查找**：利用 Cocos 的组件注册机制

---

## 故障排查

### 如果构建仍失败

1. **检查 tsconfig.json 的 paths 配置**
   - 确保 `baseUrl` 为 `"."`
   - 检查路径是否正确

2. **清理更彻底**
   ```bash
   rm -rf temp library build node_modules/.cache
   rm -rf node_modules
   npm install
   ```

3. **检查组件装饰器**
   - 确保所有 UI 组件都有 `@ccclass('ClassName')` 装饰器
   - 字符串名称与类名一致

4. **查看详细错误**
   - 在 Cocos Creator 的构建日志中查找具体错误
   - 如果提到 "graphql"，检查 shim 导出
   - 如果提到 "circular dependency"，检查是否还有其他循环依赖

---

## 维护建议

1. **添加新 UI 组件时**：
   - 从 UITypes 导入 UILayer
   - 不要从 UIManager 导入 UI 组件类
   - 使用 Blackboard 获取共享数据

2. **更新 @mysten/sui 时**：
   - 检查是否仍需要 GraphQL shim
   - 如果新版本移除了 graphql 依赖，可以删除 shim

3. **代码审查**：
   - 警惕 `import` 语句，避免创建新的循环依赖
   - 优先使用事件总线和 Blackboard 进行模块间通信

