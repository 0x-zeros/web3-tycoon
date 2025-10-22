# DeFi Verifier Stub

## 用途

Testnet/Devnet/Localnet环境的stub实现，用于tycoon包编译。

## 说明

- **仅包含接口定义**：`defi_proof`模块的热土豆struct
- **无实际验证逻辑**：不包含Scallop/Navi检测
- **无外部依赖**：不需要Navi lending_core等
- **与mainnet版本接口兼容**

## 使用

### Testnet tycoon配置

```toml
# tycoon/Move.toml (testnet)
[dependencies]
defi_verifier = { local = "../defi_verifier_stub" }

[addresses]
defi_verifier = "0x0"  # 或testnet部署地址
```

### Mainnet tycoon配置

```toml
# tycoon/Move.toml (mainnet)
[dependencies]
defi_verifier = { local = "../defi_verifier" }

[addresses]
defi_verifier = "0x2377de485d8fc4d4f0e8e2e93f36b02ea30c6e3118a2af86b5839984867f14ce"
```

## 文件

```
defi_verifier_stub/
├── Move.toml           # 包配置（无依赖）
└── sources/
    └── defi_proof.move # 热土豆定义（32行）
```

---

**Status**: ✅ 可用于testnet编译
