# DeFi Verifier - DeFi存款验证模块

## 概述

DeFi Verifier 是一个用于验证用户在Sui生态DeFi协议中存款的Move模块。主要用于游戏奖励系统，检测用户是否持有指定DeFi协议的存款凭证（如Scallop的MarketCoin）。

## 核心设计理念

### 1. 解耦设计
- **游戏模块**：完全不需要了解DeFi协议细节，只调用统一接口
- **DeFi Passport**：封装所有DeFi协议类型、地址等细节
- **两包分离**：游戏逻辑与DeFi验证逻辑完全隔离

### 2. 泛型接口
- 使用泛型`<CoinType>`让调用方无需导入DeFi类型
- 运行时通过`type_name`字符串匹配白名单
- 返回`u8`类型方便未来扩展（0=无效, 1=有效, 2+=VIP等级等）

### 3. 易扩展
- 新增协议只需添加新的checker模块
- 白名单维护在各checker内部
- 不影响现有代码

## 已部署配置（Sui Mainnet）

### DeFi Verifier
- **Package ID**: `0x74d8b5609fa69f7b61b427ee58babaaba09b44adef47f412ad51ad50dfe6cc60`
- **状态**: ✅ 已部署并测试通过

### 支持的协议

#### ✅ Scallop Protocol - SCALLOP_USDC
- **类型**: `0x854950aa624b1df59fe64e630b2ba7c550642e9342267a33061d59fb31582da5::scallop_usdc::SCALLOP_USDC`
- **接口**: `verify_defi_coin<T>(coin: &Coin<T>)`
- **架构**: 对象所有权（用户持有sUSDC Coin）
- **测试**: ✅ 通过

#### ✅ Navi Protocol - USDC存款
- **Package**: `0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f`
- **Storage**: `0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe`
- **Asset ID**: `10` (USDC)
- **接口**: `verify_navi_usdc(storage, ctx)`
- **架构**: 中心化账簿（余额记录在Storage）
- **测试**: ✅ 通过

## 使用方式

### 游戏模块调用示例

```move
module tycoon::game {
    use defi_verifier::defi_verifier;
    use sui::coin::Coin;

    /// 游戏奖励函数：完全不知道DeFi细节
    public entry fun claim_defi_activity_reward<CoinType>(
        user_coin: &Coin<CoinType>,  // 泛型T，不知道具体类型
        game_state: &mut GameState,
        ctx: &mut TxContext
    ) {
        // 验证DeFi存款
        let score = defi_verifier::verify_defi_coin(user_coin);

        if (score > 0) {
            // 发放奖励（score可作为倍数）
            mint_reward(tx_context::sender(ctx), score, ctx);
        }
    }
}
```

### 前端PTB调用示例

```typescript
import { Transaction } from '@mysten/sui/transactions';

// 1. 获取用户的Scallop MarketCoin
const coins = await client.getOwnedObjects({
    owner: userAddress,
    filter: {
        StructType: '0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf::reserve::MarketCoin<0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN>'
    }
});

// 2. 构造交易，每个coin单独调用
for (const coin of coins.data) {
    const tx = new Transaction();
    tx.moveCall({
        target: `${gamePackage}::game::claim_defi_activity_reward`,
        typeArguments: [coin.data.type],  // 完整类型
        arguments: [tx.object(coin.data.objectId)]
    });

    await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx
    });
}
```

## 返回值约定

| 返回值 | 含义 | 说明 |
|--------|------|------|
| 0 | 无效 | 不是支持的DeFi存款类型 或 余额为0 |
| 1 | 有效存款 | 是支持的DeFi存款 且 余额 > 0 |
| 2+ | 未来扩展 | 预留给VIP等级、大额存款奖励等 |

## 模块结构

```
defi_verifier/
├── sources/
│   ├── defi_verifier.move       # 对外统一接口（唯一导出）
│   ├── scallop_checker.move     # Scallop协议适配器（已实现）
│   ├── navi_checker.move        # Navi协议适配器（待实现）
│   └── bucket_checker.move      # Bucket协议适配器（待实现）
├── tests/
│   └── defi_verifier_tests.move # 完整测试覆盖
└── Move.toml                    # 包配置
```

## 测试

### 主网测试（已通过）

```bash
cd ../cli
npm run test:defi <测试地址>
```

使用`devInspectTransactionBlock`进行只读测试，不消耗gas。

### 测试结果

✅ **所有功能测试通过**：
- Scallop USDC验证：返回1（有效存款）
- Navi USDC验证：返回1（有效存款）
- Navi任意资产验证：返回1
- 普通SUI Coin：返回0（正确）

### 注意事项

⚠️ 由于Navi使用native实现，`sui move test`无法运行本地单元测试。
所有验证需要在主网环境测试。

## 关键技术要点

### 1. type_name格式
- `type_name::into_string()`返回**不带`0x`前缀**的ASCII字符串
- 示例：`854950aa...::scallop_usdc::SCALLOP_USDC`（注意无0x）

### 2. 两种验证架构
- **Scallop**: 对象所有权，检查`Coin<T>`类型
- **Navi**: 中心化账簿，查询`Storage`

### 3. 返回值约定
- `0`: 无存款或无效类型
- `1`: 有USDC存款
- `2+`: 预留扩展

## 游戏集成示例

```move
module tycoon::game {
    use defi_verifier::defi_verifier;
    use lending_core::storage::Storage as NaviStorage;
    use sui::coin::Coin;

    /// Scallop奖励：验证sUSDC Coin
    public entry fun claim_scallop_reward<T>(
        coin: &Coin<T>,
        game_state: &mut GameState,
        ctx: &mut TxContext
    ) {
        let score = defi_verifier::verify_defi_coin(coin);
        if (score > 0) {
            mint_reward(ctx.sender(), score, ctx);
        }
    }

    /// Navi奖励：验证Storage中的USDC余额
    public entry fun claim_navi_reward(
        navi_storage: &mut NaviStorage,
        game_state: &mut GameState,
        ctx: &mut TxContext
    ) {
        let score = defi_verifier::verify_navi_usdc(navi_storage, ctx);
        if (score > 0) {
            mint_reward(ctx.sender(), score, ctx);
        }
    }
}

## 部署记录

- **初次部署**: 2025-10-21
- **当前版本**: v1.0
- **测试网络**: Sui Mainnet
- **测试状态**: ✅ Scallop + Navi 全部通过

---

**Created by**: Web3 Tycoon Team
