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
- 🖼️ NFT资产化的游戏道具
- 🗳️ 社区治理决定游戏发展
- 💰 Play-to-Earn可持续经济模型

## 📁 项目结构

```
web3-tycoon/
├── move/               # Move智能合约
├── server/             # 后端服务
├── client/             # 客户端
│   ├── tycoon_cocos/  # Cocos Creator项目
├── docs/               # 项目文档
│   ├── design/         # 设计文档
│   ├── tech/           # 技术文档
│   └── api/            # API文档
├── tools/              # 开发工具
│   ├── map-editor/     # 地图编辑器
│   └── asset-generator/# AI资源生成
└── assets/             # 项目相关资源
```

## 🛣️ 开发路线图

### Phase 1: 基础架构 (第1-2周)
- [x] ✅ 项目结构搭建
- [x] ✅ 开发计划制定  
- [x] ✅ 游戏机制分析
- [x] ✅ 技术架构设计
- [ ] Cocos Creator客户端基础
- [ ] 地图编辑器等工具


### Phase 2: 核心功能 (第3-5周)
- [ ] Move合约框架开发
- [ ] 完整游戏循环实现
- [ ] 多人匹配系统
- [ ] NFT系统集成
- [ ] 基础UI界面

### Phase 3: 客户端完善 (第6-8周)
- [ ] 客户端继续开发完善
- [ ] AI生成美术资源集成
- [ ] 简单网站的制作和发布
- [ ] 性能优化和测试
- [ ] 黑客松提交准备

## 🏗️ 技术栈

### 区块链层
- **Sui Network** - 主要区块链平台
- **Move Language** - 智能合约开发
- **Sui TypeScript SDK** - 客户端集成

### 服务器层  
- 联机匹配（待定）


### 客户端层
- **Cocos Creator** - 游戏引擎
- **TypeScript** - 开发语言
- **控制台Demo** - 快速原型


## 🎮 游戏特色

### 创新玩法
- **地产NFT化**：每块地产都是独特的NFT资产
- **DeFi借贷**：使用地产作为抵押品获得贷款 ？
- **流动性挖矿**：质押游戏代币获得额外奖励
- **社区治理**：玩家投票决定游戏规则和发展方向

### 经济模型
- 待定

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


### 技术挑战与解决方案

#### Sui性能和Gas费优化
- **挑战**：大富翁游戏逻辑复杂，可能导致高Gas费
- **解决方案**：
  - 待定

#### 地图编辑器设计
- **需求**：支持策划手动编辑和AI生成
- **实现**：
  - 基于JSON的地图数据结构
  - 可视化编辑界面
  - AI辅助地图生成
  - 多主题地图支持


---

<div align="center">

**🎲 Web3 Tycoon - 让DeFi变得简单有趣，让游戏创造真实价值！🎲**

[开始游戏](https://www.web3tycoon.com) • [查看文档](docs/) • [加入社区]

</div>