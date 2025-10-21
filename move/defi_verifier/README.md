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

## 已支持的协议

### ✅ Scallop Protocol
- **MarketCoin<USDC>** - USDC存款凭证
- **MarketCoin<SUI>** - SUI存款凭证
- **MarketCoin<USDT>** - USDT存款凭证

验证逻辑：
- Package地址：`0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf`
- 模块标识：`::reserve::MarketCoin`
- 资产类型：`::usdc::USDC`, `::sui::SUI`, `::usdt::USDT`

### 🚧 待实现
- **Navi Protocol** - nToken系列
- **Bucket Protocol** - sUSDB等

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

```bash
# 运行所有测试
sui move test

# 运行特定测试
sui move test --filter test_verify_scallop_usdc

# 查看测试覆盖率
sui move test --coverage
```

### 测试用例覆盖

✅ 10个测试全部通过：

1. **test_scallop_market_coin_usdc** - MarketCoin类型识别
2. **test_verify_scallop_usdc_valid** - USDC有效存款
3. **test_verify_scallop_zero_balance** - 零余额返回0
4. **test_verify_non_scallop** - 非Scallop类型返回0
5. **test_verify_scallop_sui** - SUI支持
6. **test_verify_scallop_usdt** - USDT支持
7. **test_verify_wrong_package** - 错误package地址
8. **test_verify_wrong_module** - 错误模块名
9. **test_verify_unsupported_asset** - 不支持的资产
10. **test_string_contains_basic** - 字符串匹配基础

## 技术要点

### 1. 类型检查机制

使用`std::type_name`获取类型的字符串表示：
```move
let type_name = type_name::with_defining_ids<CoinType>();
let type_str = type_name::into_string(type_name);
// 例如: "0xefe8b36d...::reserve::MarketCoin<0xabc::usdc::USDC>"
```

### 2. 字符串匹配

自实现字符串包含检查（因Move标准库未提供）：
```move
fun string_contains(haystack: &String, needle: &String): bool {
    // 朴素字符串匹配算法 O(n*m)
    // 足够简单有效，无需复杂算法
}
```

### 3. ASCII vs UTF-8

- `type_name::into_string()` 返回 `std::ascii::String`
- 所有checker统一使用`ascii::String`避免类型转换

### 4. 可见性设计

- `public fun verify_defi_coin<T>()` - 唯一对外接口
- `public(package) fun check()` - Checker内部函数
- `fun string_contains()` - 私有辅助函数

## 添加新协议支持

### 步骤1：创建checker模块

```move
// sources/new_protocol_checker.move
module defi_verifier::new_protocol_checker {
    use std::ascii::String;

    const PROTOCOL_PACKAGE: vector<u8> = b"0x...";
    const TOKEN_MODULE: vector<u8> = b"::module::Token";

    public(package) fun check(type_str: &String, balance: u64): u8 {
        if (balance == 0) { return 0 };
        if (is_valid_type(type_str)) { return 1 };
        0
    }

    fun is_valid_type(type_str: &String): bool {
        // 实现类型检查逻辑
    }
}
```

### 步骤2：集成到主接口

```move
// sources/defi_verifier.move
use defi_verifier::new_protocol_checker;

public fun verify_defi_coin<CoinType>(coin: &Coin<CoinType>): u8 {
    // ...
    let new_score = new_protocol_checker::check(&type_str, balance);
    score = max(score, new_score);
    // ...
}
```

### 步骤3：添加测试

```move
// tests/defi_verifier_tests.move
#[test]
fun test_verify_new_protocol() {
    let type_str = ascii::string(b"0x...::module::Token<...>");
    let score = defi_verifier::test_verify_type_string(type_str, 100);
    assert!(score == 1, 0);
}
```

## 注意事项

### 1. PTB层需要类型

虽然Move代码层面实现了解耦，但Sui的PTB（Programmable Transaction Block）在构造交易时**必须指定完整类型参数**。这是Sui Move的技术限制，无法避免。

前端需要：
- 知道用户持有的DeFi对象类型（通过RPC查询）
- 在`typeArguments`中传入完整类型字符串

### 2. 字符串匹配性能

当前使用朴素字符串匹配算法 O(n*m)，对于类型名（通常<200字符）完全够用。如果未来需要优化，可以考虑：
- KMP算法
- 哈希匹配
- 前缀树

### 3. 白名单维护

Package地址硬编码在各checker模块中。如果协议升级导致地址变更，需要：
- 更新常量
- 重新部署defi_verifier包
- 或使用动态配置（需要额外的Registry机制）

## 未来扩展方向

### 1. 动态配置

添加Registry机制，支持运行时更新白名单：
```move
struct WhitelistRegistry {
    protocols: vector<ProtocolConfig>
}
```

### 2. 分数系统

基于存款金额返回不同分数：
- 1: 有存款
- 2: 中等金额（如 >100 USDC）
- 3: 大额存款（如 >1000 USDC）

### 3. 组合验证

支持"至少持有N个协议存款"等复杂逻辑：
```move
public fun verify_multiple(coins: vector<&Coin<?>>) : u8
```

## License

MIT

## 贡献

欢迎提交PR添加新协议支持！

---

**Created by**: Claude Code
**Date**: 2025-10-21
