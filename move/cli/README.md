# Web3 Tycoon Move CLI

这是一个用于 Web3 Tycoon 游戏的 TypeScript CLI 工具，提供了与 Sui 区块链交互的功能。

## 🚀 功能特性

- **多网络支持**: 支持 localnet、devnet、testnet、mainnet
- **游戏功能**: 掷骰子、铸造代币、游戏交互
- **Sui 集成**: 完整的 Sui SDK 集成
- **类型安全**: 完整的 TypeScript 支持

## 📁 项目结构

```
move/cli/
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript 配置
├── src/
│   ├── index.ts          # 主入口文件
│   ├── config/           # 网络配置
│   │   ├── config.ts     # 配置管理
│   │   ├── env.localnet.ts
│   │   ├── env.devnet.ts
│   │   ├── env.testnet.ts
│   │   └── env.mainnet.ts
│   ├── utils/            # 工具函数
│   │   ├── sui_utils.ts  # Sui 相关工具
│   │   ├── constants.ts  # 常量定义
│   │   └── index.ts      # 工具导出
│   ├── mint_coin.ts      # 铸造代币功能
│   ├── roll_the_dice.ts  # 掷骰子游戏
│   └── simple_roll.ts    # 简单掷骰子
└── README.md
```

## 🛠️ 安装和设置

### 1. 安装依赖

```bash
cd move/cli
npm install
```

### 2. 配置 Sui 钱包

确保你的 Sui 钱包已配置：

```bash
# 检查钱包状态
sui client active-address

# 如果还没有钱包，创建一个
sui client new-address ed25519
```

### 3. 编译项目

```bash
npm run build
```

## 🎮 使用方法

### 基本命令

```bash
# 运行主程序
npm start [network]

# 铸造代币
npm run mint_coin [network]

# 掷骰子游戏
npm run roll_the_dice [network]

# 简单掷骰子
npm run simple_roll [network]
```

### 网络参数

- `localnet` - 本地网络 (默认)
- `devnet` - 开发网络
- `testnet` - 测试网络
- `mainnet` - 主网络

### 示例

```bash
# 在本地网络运行掷骰子游戏
npm run roll_the_dice localnet

# 在开发网络铸造代币
npm run mint_coin devnet

# 运行主程序
npm start testnet
```

## 🔧 配置说明

### 网络配置

每个网络都有对应的配置文件：

- `env.localnet.ts` - 本地网络配置
- `env.devnet.ts` - 开发网络配置
- `env.testnet.ts` - 测试网络配置
- `env.mainnet.ts` - 主网络配置

### 环境变量

可以通过环境变量覆盖配置：

```bash
export PACKAGE_ID="your_package_id"
export TREASURY_CAP="your_treasury_cap"
```

## 📝 开发说明

### 添加新功能

1. 在 `src/` 目录下创建新的 TypeScript 文件
2. 在 `package.json` 中添加对应的脚本
3. 更新 `src/utils/` 中的工具函数

### 调试

```bash
# 使用 ts-node 直接运行
npx ts-node src/your_script.ts localnet

# 启用详细日志
DEBUG=* npm start localnet
```

## 🚨 注意事项

1. **钱包安全**: 确保你的私钥安全，不要提交到版本控制
2. **网络配置**: 确保网络配置正确，特别是合约地址
3. **Gas 费用**: 注意 Gas 费用，建议先在测试网络测试
4. **版本兼容**: 确保 Sui SDK 版本与网络兼容

## 🔗 相关链接

- [Sui 官方文档](https://docs.sui.io/)
- [Sui TypeScript SDK](https://sdk.mystenlabs.com/typescript)
- [Web3 Tycoon 项目](https://github.com/your-repo/web3-tycoon)

## 📄 许可证

ISC License
