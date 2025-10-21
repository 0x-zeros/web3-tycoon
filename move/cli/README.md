# DeFi Verifier Test CLI

DeFi存款验证工具 - Sui主网专用

## 功能

用于测试Sui主网上的DeFi存款验证功能，检测用户是否持有支持的DeFi协议存款凭证。

### 支持的协议

- ✅ **Scallop Protocol** - SCALLOP_USDC (sUSDC)
- ✅ **Navi Protocol** - USDC存款（通过Storage查询）
- 🚧 Bucket Protocol - sUSDB等（待实现）

### 核心功能

1. **自动查询**：扫描用户地址的Scallop MarketCoin对象
2. **智能验证**：调用defi_verifier合约验证DeFi存款
3. **详细报告**：显示对象ID、类型、余额、验证分数
4. **边界测试**：验证普通Coin（如SUI）应该返回0

## 安装

```bash
npm install
```

## 使用方法

### 前置条件

1. **Sui Keystore**：确保 `~/.sui/sui_config/sui.keystore` 存在
2. **主网账户**：账户需要有一些SUI用于查询
3. **DeFi存款**（可选）：如果要测试成功案例，需要在Scallop等协议中有存款

### 运行测试

```bash
npm run test:defi
```

### 配置

在 `src/config/env.mainnet.ts` 中配置：

```typescript
const env = {
    // DeFi Verifier Package ID（部署后更新）
    defiVerifierPackageId: '0x...',

    // Scallop Protocol Package ID
    scallopPackageId: '0xefe8b36d...',
};
```

## 输出示例

```
========================================
DeFi Verifier 测试工具 (Sui Mainnet)
========================================

网络配置:
  RPC URL: https://fullnode.mainnet.sui.io:443
  DeFi Verifier Package: 0x...
  Scallop Package: 0xefe8b36d...

钱包地址: 0x123...
账户余额: 1000000000 MIST

========================================
查询Scallop MarketCoin对象...
========================================

✅ 发现 2 个MarketCoin对象

MarketCoin #1:
  对象ID: 0xabc...
  类型: 0xefe8b36d...::reserve::MarketCoin<0x...::usdc::USDC>
  余额: 100000000

----------------------------------------
测试 #1: 验证MarketCoin
----------------------------------------
对象ID: 0xabc...
类型: 0xefe8b36d...::reserve::MarketCoin<0x...::usdc::USDC>

泛型参数: 0xefe8b36d...::reserve::MarketCoin<0x...::usdc::USDC>
调用结果:
  状态: success
  验证分数: 1
  ✅ 验证成功！这是有效的DeFi存款

========================================
边界测试：验证普通SUI Coin
========================================

测试对象: 0xdef...
类型: 0x2::sui::SUI
余额: 1000000000

调用结果:
  状态: success
  验证分数: 0
  ✅ 正确！普通SUI Coin返回0（不是DeFi存款）

========================================
测试完成！
========================================
```

## 项目结构

```
cli/
├── src/
│   ├── test_defi_verifier.ts    # 主测试脚本
│   ├── config/
│   │   ├── config.ts            # 主网配置
│   │   └── env.mainnet.ts       # 主网环境变量
│   └── utils/
│       ├── sui_utils.ts         # Sui工具函数
│       └── index.ts             # 工具导出
├── package.json
├── tsconfig.json
└── README.md
```

## 测试用例

### 1. 基础测试
- ✅ 连接Sui主网
- ✅ 读取keystore
- ✅ 显示账户余额

### 2. Scallop USDC查询
- ✅ 查询所有Scallop USDC (sUSDC)对象
- ✅ 显示对象详情（ID、类型、余额）
- ✅ 验证sUSDC返回1（有效存款）

### 3. Navi USDC验证
- ✅ 调用verify_navi_usdc检测USDC存款
- ✅ 调用verify_navi_any检测任意资产

### 4. 边界情况
- ✅ 验证普通SUI Coin返回0
- ✅ 账户没有DeFi存款的情况

## 开发

### 编译

```bash
npm run build
```

### 添加新协议支持

1. 在 `env.mainnet.ts` 添加新协议的package ID
2. 在 `test_defi_verifier.ts` 添加查询和验证逻辑
3. 运行测试验证

## 注意事项

### 1. DeFi Verifier部署

当前defi_verifier还未部署到主网。部署步骤：

```bash
cd move/defi_verifier
sui client publish --gas-budget 500000000
# 获取package ID后更新到env.mainnet.ts
```

### 2. 测试账户准备

如果账户没有DeFi存款，可以：

**Scallop**:
1. 访问 [Scallop App](https://scallop.io/)
2. 连接钱包并在主网存入USDC
3. 获得sUSDC后再运行测试

**Navi**:
1. 访问 [Navi App](https://naviprotocol.io/)
2. 连接钱包并在主网供应(Supply) USDC
3. 存款成功后再运行测试

### 3. Gas费用

- 查询操作（`getOwnedObjects`等）：免费
- `devInspectTransactionBlock`：免费（只读调用）
- 不需要实际执行交易，不消耗gas

## 技术栈

- **TypeScript**: 类型安全的开发体验
- **@mysten/sui**: Sui TypeScript SDK v1.38.0
- **ts-node**: 直接运行TypeScript
- **Node.js**: v18+

## License

MIT

## 相关链接

- [Sui Documentation](https://docs.sui.io/)
- [Scallop Protocol](https://scallop.io/)
- [Sui Explorer](https://suivision.xyz/)
- [DeFi Verifier源码](../defi_verifier/)

---

**Created by**: Web3 Tycoon Team
**Last Updated**: 2025-10-21
