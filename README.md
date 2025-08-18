# Web3 Tycoon 🎲

> 基于Sui区块链的创新大富翁游戏，融合经典玩法与DeFi机制

[![Sui](https://img.shields.io/badge/Sui-Network-blue)](https://sui.io/)
[![Move](https://img.shields.io/badge/Language-Move-green)](https://move-language.github.io/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue)](https://www.typescriptlang.org/)
[![Cocos Creator](https://img.shields.io/badge/Engine-Cocos%20Creator-orange)](https://www.cocos.com/creator)

## 🎯 项目概述

Web3 Tycoon 是一款参考大富翁10、11等经典游戏的Web3区块链游戏。项目将传统大富翁的核心玩法与现代DeFi机制相结合，创造一个真正有价值的区块链游戏生态系统。

**核心特色：**
- 🎮 经典大富翁玩法 + Web3创新
- 🏦 多DeFi协议深度集成 (Bucket + Scallop + Navi)
- 🖼️ NFT资产化的游戏道具
- 🗳️ 社区治理决定游戏发展
- 💰 Play-to-Earn可持续经济模型

## 📁 项目结构

```
web3-tycoon/
├── contracts/          # Move智能合约
│   ├── sources/        # 合约源代码
│   ├── tests/          # 合约测试
│   └── scripts/        # 部署脚本
├── server/             # 后端服务
│   ├── matchmaking/    # 匹配服务
│   ├── api/            # API接口
│   └── database/       # 数据管理
├── client/             # 客户端
│   ├── console-demo/   # 控制台Demo
│   ├── cocos-project/  # Cocos Creator项目
│   └── shared/         # 共享代码
├── docs/               # 项目文档
│   ├── design/         # 设计文档
│   ├── tech/           # 技术文档
│   └── api/            # API文档
├── tools/              # 开发工具
│   ├── map-editor/     # 地图编辑器
│   └── asset-generator/# AI资源生成
└── assets/             # 游戏资源
    ├── sprites/        # 精灵图
    ├── models/         # 3D模型
    ├── audio/          # 音频文件
    └── maps/           # 地图数据
```

## 🛣️ 开发路线图

### Phase 1: 基础架构 (第1-2周)
- [x] ✅ 项目结构搭建
- [x] ✅ 开发计划制定  
- [x] ✅ 游戏机制分析
- [x] ✅ 技术架构设计
- [ ] Move合约框架开发
- [ ] TypeScript控制台Demo

### Phase 2: 核心功能 (第3-4周)
- [ ] 完整游戏循环实现
- [ ] 多人匹配系统
- [ ] NFT系统集成
- [ ] 基础UI界面

### Phase 3: DeFi集成 (第5-6周)
- [ ] Bucket Protocol数据存储
- [ ] Scallop Protocol借贷功能
- [ ] Navi Protocol流动性挖矿
- [ ] 经济模型优化

### Phase 4: 客户端完善 (第7-8周)
- [ ] Cocos Creator图形客户端
- [ ] AI生成美术资源集成
- [ ] 性能优化和测试
- [ ] 黑客松提交准备

## 🏗️ 技术栈

### 区块链层
- **Sui Network** - 主要区块链平台
- **Move Language** - 智能合约开发
- **Sui TypeScript SDK** - 客户端集成

### 服务器层  
- **Node.js + TypeScript** - 服务器开发
- **WebSocket** - 实时通信
- **Redis** - 缓存管理
- **PostgreSQL** - 数据持久化

### 客户端层
- **Cocos Creator** - 游戏引擎
- **TypeScript** - 开发语言
- **控制台Demo** - 快速原型

### DeFi集成
- **Bucket Protocol** - 去中心化数据存储
- **Scallop Protocol** - 借贷和流动性
- **Navi Protocol** - 流动性挖矿和治理

## 🎮 游戏特色

### 创新玩法
- **地产NFT化**：每块地产都是独特的NFT资产
- **DeFi借贷**：使用地产作为抵押品获得贷款
- **流动性挖矿**：质押游戏代币获得额外奖励
- **社区治理**：玩家投票决定游戏规则和发展方向

### 经济模型
- **TYCO (游戏币)** - 游戏内流通货币，用于购买地产和支付费用
- **TYCOON (治理币)** - 治理代币，用于社区投票和质押挖矿
- **双代币循环** - 游戏收益 ↔️ DeFi收益，形成可持续经济循环

## 🚀 快速开始

### 环境要求
- Node.js 18+
- Sui CLI
- TypeScript 4.9+
- Cocos Creator 3.8+

### 安装依赖
```bash
# 克隆项目
git clone https://github.com/your-org/web3-tycoon.git
cd web3-tycoon

# 安装服务器依赖
cd server && npm install

# 安装客户端依赖  
cd ../client/console-demo && npm install

# 安装工具依赖
cd ../../tools/map-editor && npm install
```

### 运行Demo
```bash
# 启动控制台Demo
cd client/console-demo
npm run dev

# 启动匹配服务器
cd server/matchmaking  
npm run dev

# 部署Move合约（测试网）
cd contracts
sui move publish --gas-budget 20000000
```

## 📚 文档

- [项目总览](docs/project-overview.md) - 项目愿景和核心概念
- [开发计划](docs/development-plan.md) - 详细的8周开发计划
- [游戏设计](docs/design/game-analysis.md) - 大富翁游戏机制分析
- [技术架构](docs/tech/architecture.md) - 完整的系统架构设计
- [多赛道集成](docs/design/hackathon-integration.md) - DeFi协议集成方案
- [项目结构](docs/project-structure.md) - 详细的文件组织说明

## 🎨 美术风格

### 视觉风格
- **整体风格**：Low Poly + 卡通渲染
- **色彩方案**：明亮鲜艳，高饱和度
- **UI设计**：扁平化 + 微动效

### AI生成Prompt示例
```
地产建筑：
"Cute low poly house, cartoon style, bright colors, 
isometric view, simple geometry, game asset"

角色设计：
"Chibi character, businessman outfit, cartoon style, 
3D render, bright lighting, game character"

卡片设计：
"Magic card frame, fantasy style, golden border, 
game UI element, transparent background"
```

## 🤝 参与贡献

我们欢迎社区贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何参与项目开发。

### 贡献方式
- 🐛 报告Bug或提出改进建议
- 💡 提交新功能想法
- 🔧 提交代码改进
- 📖 完善项目文档
- 🎨 提供美术资源

## 🏆 黑客松赛道

本项目参与以下赛道竞争：
- **Sui赛道** (必选) - 创新使用Sui区块链特性
- **Bucket赛道** - 去中心化数据存储应用
- **Scallop赛道** - 游戏化借贷机制创新  
- **Navi赛道** - 流动性挖矿和治理集成

### 技术挑战与解决方案

#### Sui性能和Gas费优化
- **挑战**：大富翁游戏逻辑复杂，可能导致高Gas费
- **解决方案**：
  - 批量操作减少交易数量
  - 状态压缩优化存储
  - 混合链上链下架构
  - 预计算和缓存机制

#### 地图编辑器设计
- **需求**：支持策划手动编辑和AI生成
- **实现**：
  - 基于JSON的地图数据结构
  - 可视化编辑界面
  - AI辅助地图生成
  - 多主题地图支持

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源许可证。

## 📞 联系我们

- **GitHub Issues**: [提交问题或建议](https://github.com/your-org/web3-tycoon/issues)
- **Discord**: [加入社区讨论](https://discord.gg/web3tycoon)
- **Email**: team@web3tycoon.game

---

<div align="center">

**🎲 Web3 Tycoon - 让DeFi变得简单有趣，让游戏创造真实价值！🎲**

[开始游戏](https://play.web3tycoon.game) • [查看文档](docs/) • [加入社区](https://discord.gg/web3tycoon)

</div>