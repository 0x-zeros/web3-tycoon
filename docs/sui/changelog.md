# Sui 模块更新日志

## 2025-10-06 - v2.0.0 重大架构升级

### 🎉 新增功能

#### 1. 统一管理器（SuiManager）
- ✅ 单例模式管理所有 Sui 交互
- ✅ 自动初始化（GameInitializer 集成）
- ✅ 状态管理（currentAddress, currentSeat）
- ✅ 调试日志支持

#### 2. 签名器抽象（SignerProvider）
- ✅ 统一签名接口
- ✅ WalletSigner - 浏览器钱包签名（推荐）
- ✅ KeypairSigner - 本地密钥对签名（测试）
- ✅ 无缝切换签名方式

#### 3. 查询服务（QueryService）
- ✅ getGameData() - 查询 GameData 共享对象
- ✅ getReadyGames() - 查询所有 STATUS_READY 游戏
- ✅ getMapTemplates() - 查询地图模板列表
- ✅ getPlayerSeats() - 查询玩家 Seat
- ✅ 智能解析和过滤

#### 4. 配置管理
- ✅ SuiConfig 接口定义
- ✅ 从 env.localnet.ts 自动加载配置
- ✅ 网络 RPC URL 自动解析
- ✅ 支持自定义 RPC

#### 5. 高级 API
- ✅ getAvailableGames() - 智能排序（自己创建的优先）
- ✅ createGame() - 创建游戏并返回详情
- ✅ joinGame() - 加入游戏并保存 Seat
- ✅ startGame() - 开始游戏并解析事件
- ✅ publishMapTemplate() - 发布地图模板

### 🔄 重构更新

#### 交互类重构
- ✅ GameInteraction 添加 `build*Tx()` 方法
- ✅ MapAdminInteraction 添加 `buildUploadMapTemplateTx()`
- ✅ 旧方法标记为 `@deprecated`（保持兼容）

#### UI 集成
- ✅ UIWallet 自动设置/清除 SuiManager 签名器
- ✅ GameInitializer 自动初始化 SuiManager
- ✅ UIManager 新增 WALLET Layer (250)
- ✅ Wallet UI 独立化（持久显示）

### 📝 文档更新

- ✅ INTEGRATION_EXAMPLE.md - 完整的集成示例
- ✅ ARCHITECTURE.md - 详细的架构设计文档
- ✅ README.md - 更新为新架构
- ✅ CHANGELOG.md - 本文档

### 🐛 问题修复

- ✅ 修复 `GameInteraction is not defined` 错误
  - 在 `interactions/index.ts` 中添加显式导入
  - 确保所有类型正确导出

### 📦 新增文件

```
sui/
├── config/
│   ├── SuiConfig.ts          ✨ 新增
│   └── index.ts              ✨ 新增
├── signers/
│   ├── SignerProvider.ts     ✨ 新增
│   ├── WalletSigner.ts       ✨ 新增
│   ├── KeypairSigner.ts      ✨ 新增
│   └── index.ts              ✨ 新增
├── managers/
│   ├── SuiManager.ts         ✨ 新增（500+ 行）
│   └── index.ts              ✨ 新增
├── services/
│   ├── QueryService.ts       ✨ 新增（300+ 行）
│   └── index.ts              ✨ 新增
├── interactions/
│   ├── game.ts               🔄 更新（添加 build*Tx 方法）
│   ├── mapAdmin.ts           🔄 更新（添加 build*Tx 方法）
│   └── index.ts              🔄 更新（添加显式导入）
├── INTEGRATION_EXAMPLE.md    ✨ 新增
├── ARCHITECTURE.md           ✨ 新增
├── CHANGELOG.md              ✨ 新增（本文件）
└── README.md                 🔄 更新
```

### 📈 代码统计

- 新增代码：约 1500+ 行
- 更新文件：5 个
- 新增文件：13 个
- 新增文档：3 个

---

## 💡 使用示例

### 游戏创建流程

```typescript
// 1. 用户连接钱包
// UIWallet 自动调用：
SuiManager.instance.setWalletSigner(wallet, account);

// 2. 查询可加入的游戏
const games = await SuiManager.instance.getAvailableGames();
// 返回：最多 6 个游戏，自己创建的排第一位

// 3. 创建新游戏
const {gameId, seatId} = await SuiManager.instance.createGame({
    template_map_id: '0x...',
    max_players: 4
});

// 4. 加入游戏
const {seatId, playerIndex} = await SuiManager.instance.joinGame(gameId);

// 5. 开始游戏
await SuiManager.instance.startGame(gameId, mapTemplateId);
```

### 地图发布流程

```typescript
// 1. 构建地图数据
const mapTemplate = buildMapTemplateFromEditor();

// 2. 发布到链上
const {templateId, txHash} = await SuiManager.instance.publishMapTemplate(mapTemplate);

console.log(`地图已发布，ID: ${templateId}`);
```

---

## 🎯 迁移指南

### 从旧 API 迁移

**旧方式（直接使用 TycoonGameClient）：**
```typescript
const client = TycoonGameClient.create(config);
const keypair = Ed25519Keypair.fromSecretKey(...);
const result = await client.game.createGame(config, keypair);
```

**新方式（使用 SuiManager）：**
```typescript
// 初始化在 GameInitializer 中自动完成
// 签名器在 UIWallet 中自动设置
const result = await SuiManager.instance.createGame(config);
```

**优势：**
- 无需手动管理 SuiClient
- 无需手动管理 Keypair
- 统一的错误处理
- 自动状态管理

---

## ⚡ 性能提升

### 查询优化

**优化前：**
- 每次查询都创建新的 SuiClient
- 没有缓存机制
- 顺序查询游戏详情

**优化后：**
- 单例 SuiClient 复用
- 并行查询游戏详情（Promise.all）
- 智能排序和限制数量

### 签名优化

**优化前：**
- 每次签名都要传递 keypair
- UI 层直接操作钱包 API

**优化后：**
- SignerProvider 统一管理
- UI 层只调用 SuiManager
- 自动错误处理和重试

---

## 🔐 安全考虑

### 1. 私钥管理

- ✅ KeypairSigner 仅用于测试环境
- ✅ 生产环境使用 WalletSigner
- ✅ 私钥永远不会暴露给前端代码

### 2. 交易确认

- ✅ 钱包会弹出确认窗口
- ✅ 用户可以查看交易详情
- ✅ 用户可以拒绝签名

### 3. 配置管理

- ✅ Package ID 和 GameData ID 从配置文件读取
- ✅ 支持多环境配置（localnet/testnet/mainnet）
- ✅ AdminCap ID 可选（普通用户不需要）

---

## 🎊 致谢

感谢 Sui 官方团队提供优秀的 TypeScript SDK 和 Wallet Standard！

---

**版本：v2.0.0**
**发布日期：2025-10-06**
**作者：Web3 Tycoon Team**
