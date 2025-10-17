# Web3 Tycoon 🎲

> 基于 Sui 区块链的全链上 3D 大富翁游戏

[![Sui](https://img.shields.io/badge/Sui-Network-blue)](https://sui.io/)
[![Move](https://img.shields.io/badge/Language-Move-green)](https://move-language.github.io/)
[![Cocos Creator](https://img.shields.io/badge/Engine-Cocos%20Creator%203.8.7-orange)](https://www.cocos.com/creator)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue)](https://www.typescriptlang.org/)

## 🎯 项目概述

Web3 Tycoon 是一款 **完全链上的 3D 大富翁游戏**，将经典桌游玩法与 Sui 区块链技术深度融合。所有游戏逻辑运行在 Move 智能合约中，确保公平透明。玩家在 Web3 主题的虚拟世界中投资地产、收集卡牌、体验 DeFi 机制，在游戏中学习区块链知识。

**核心特色：**
- ⛓️ **完全链上游戏逻辑** - 所有游戏状态和规则由 Move 智能合约管理
- 🎲 **经典大富翁玩法** - 投资地产、收取租金、策略决策
- 🔐 **Sui 原生随机数** - 使用 Sui Random 对象确保公平性
- 🎨 **AIGC 美术资源** - 基于 OpenAI DALL-E 3 的自动化资源生成
- 🌐 **去中心化部署** - Cloudflare Pages + Walrus Sites 双重部署

## 🎮 游戏特色

### 🎲 游戏机制

**基础玩法**
- 掷骰子移动，落地触发事件（购买地产、支付租金、抽取卡牌）
- 地产升级系统（1-5级），租金随等级递增
- 多样化卡牌系统（机会、命运、技能卡）
- 破产机制与胜利条件

**链上游戏特性**
- **完全链上逻辑**：所有游戏规则在 Move 合约中执行
- **链上随机数**：使用 Sui 原生 `Random` 对象确保公平掷骰
- **事件驱动**：通过聚合事件实现客户端状态同步
- **Object Capabilities**：基于 Sui 对象模型的权限管理

**Web3 主题**
- **地块类型**：空地、医院、彩票站、机会点等 Web3 主题建筑
- **DeFi 体验**：模拟 Bucket、Scallop、Navi 等协议交互
- **资产管理**：地产升级、租金收取、资金流动完全透明

### 🖼️ 3D 渲染

采用 **Cocos Creator 3D 引擎** + **体素风格渲染**（Demo 阶段）

- 3D 游戏世界与角色
- Web3 主题的建筑和地块
- 温暖水彩画风 + 加密货币图标
- AIGC 批量生成一致性资源

## 🏗️ 技术架构

### 客户端架构

**Cocos Creator 3.8.7 + TypeScript**

```
client/tycoon_cocos/assets/scripts/
├── core/
│   └── GameInitializer.ts        # 游戏初始化管理
├── voxel/                         # 体素渲染系统 ⭐
│   ├── VoxelRenderer.ts           # Mesh 生成与渲染
│   ├── VoxelChunk.ts              # Chunk 管理
│   ├── VoxelInteractionManager.ts # 射线交互
│   ├── resource_pack/             # Minecraft 风格资源包
│   └── lighting/                  # 光照系统（AO）
├── map/
│   ├── MapManager.ts              # 地图管理（动态加载）
│   ├── GameMap.ts                 # 游戏逻辑（Tile + Building）
│   └── MapTile.ts                 # 地块组件
├── role/
│   ├── RoleManager.ts             # 角色管理
│   ├── Player.ts                  # 玩家实体
│   └── Actor.ts                   # 基础 Actor（PaperActor）
├── card/
│   ├── CardManager.ts             # 卡牌系统
│   └── cards/                     # 卡牌实现
├── ui/
│   ├── UIManager.ts               # FairyGUI 管理
│   └── game/                      # 游戏 UI 界面
├── camera/
│   ├── CameraManager.ts           # 多模式相机控制
│   └── VoxelCameraController.ts   # 体素相机
├── sui/                           # Sui 集成 ⭐
│   ├── types/                     # TypeScript 类型（匹配 Move）
│   ├── events/                    # 事件索引与处理
│   ├── interactions/              # 合约交互封装
│   └── pathfinding/               # BFS 寻路（匹配链上逻辑）
└── events/
    ├── EventBus.ts                # 全局事件总线
    └── Blackboard.ts              # 共享状态管理
```

**核心系统设计**

1. **Sui 集成系统** ⭐
   - TypeScript 类型与 Move 合约完全对齐
   - 事件索引与状态同步（支持历史回放）
   - BFS 寻路算法匹配链上逻辑
   - Wallet Standard 钱包集成

2. **地图系统**
   - **Tile 系统**：路径节点管理 tileId 和邻居关系
   - **Building 系统**：业务实体（1x1/2x2 建筑）
   - DFS 编号算法（从 Hospital 开始分配 tileId）
   - JSON 配置驱动的地图加载

3. **3D 渲染** (Demo 阶段)
   - 体素风格渲染系统
   - 自定义资源包支持
   - 多层 Overlay（编号、方向、装饰）

4. **UI 系统**
   - FairyGUI 集成（复杂界面编辑器）
   - 游戏内 HUD、地图选择、钱包连接
   - 事件驱动的 UI 更新

### 区块链架构

**Sui Network + Move Language**

```
move/tycoon/sources/
├── tycoon.move           # Package 初始化
├── admin.move            # 管理员权限（AdminCap）
├── types.move            # 常量与辅助函数
├── map.move              # 地图模板与 Tile 定义
├── cards.move            # 卡牌机制（Buff 系统）
├── events.move           # 聚合事件（UseCardActionEvent 等）
└── game.move             # 核心游戏逻辑 ⭐

move/tycoon/tests/        # 完整的合约测试
```

**核心设计模式** ⭐

1. **Object Capabilities**
   - `AdminCap`：管理员权限对象
   - `Seat`：玩家座位对象（绑定玩家身份）
   - 基于 Sui 对象模型的细粒度权限控制

2. **事件驱动架构**
   - **聚合事件**：`RollAndStepActionEvent`, `UseCardActionEvent` 等
   - **客户端同步**：通过事件索引获取游戏状态
   - **历史回溯**：支持状态重放和调试
   - **离线友好**：客户端可从任意事件恢复状态

3. **Buff 系统**
   - 互斥时机（BeforeRollDice, AfterStep 等）
   - 自动触发和清理机制
   - 支持复杂的卡牌效果组合

4. **随机数系统**
   - 使用 Sui 原生 `Random` 对象
   - 一次交易一个 `RandomGenerator`
   - 链上可验证的公平性保证

### 资源生成流程

**AIGC Pipeline**

```
tools/asset-generator/
├── assets_config.js      # 100+ Prompt 模板
├── generators/
│   ├── openai.js         # OpenAI DALL-E 3 / GPT-Image-1
│   └── gemini.js         # Google Gemini (免费备选)
└── scripts/
    ├── generate.js       # 批量生成脚本
    └── optimize.js       # 图像优化
```

**生成命令**
```bash
npm run generate              # 生成所有资源
npm run generate:tiles        # 地块和建筑
npm run generate:ui           # UI 元素
npm run generate:free         # 使用免费 Gemini 模型
```

### 部署架构

**双重部署方案**

1. **Cloudflare Pages**（主要）
   - GitHub Actions 自动部署
   - 全球 CDN 加速
   - dev 分支 → Preview，main 分支 → Production

2. **Walrus Sites**（去中心化备份）
   - 存储在 Walrus 分布式网络
   - 排除 assets 目录节省成本
   - 使用 `prepare-deploy.sh` 脚本准备文件

## 📁 项目结构

```
web3-tycoon/
├── client/
│   ├── tycoon_cocos/              # Cocos Creator 3.8.7 项目 ⭐
│   │   ├── assets/scripts/        # TypeScript 游戏逻辑
│   │   ├── assets/resources/      # 游戏资源（地图、Voxel 资源包）
│   │   ├── FGUIProject/           # FairyGUI UI 项目
│   │   └── build/web-mobile/      # Web 构建产物
│   └── tools/
│       └── walrus/                # Walrus Sites 部署工具
│           ├── prepare-deploy.sh  # 部署准备脚本
│           └── site-builder       # Walrus 站点构建器
├── move/
│   └── tycoon/                    # Move 智能合约 ⭐
│       ├── sources/               # 合约源码
│       └── tests/                 # 合约测试
├── tools/
│   ├── asset-generator/           # AIGC 资源生成 ⭐
│   └── md-paste-image-extension/  # VSCode 辅助工具
├── docs/                          # 项目文档
│   ├── design/                    # 游戏设计文档
│   ├── tech/                      # 技术架构文档
│   └── DEPLOYMENT.md              # 部署指南
└── .github/workflows/
    └── deploy-cloudflare.yml      # CI/CD 配置
```

## 🚀 快速开始

### 环境要求

- **Node.js** 18+
- **Sui CLI** (最新版)
- **Cocos Creator** 3.8.7
- **TypeScript** 5.0+

### 克隆项目

```bash
git clone https://github.com/your-org/web3-tycoon.git
cd web3-tycoon
```

### 客户端开发

```bash
# 1. 安装依赖
cd client/tycoon_cocos
npm install

# 2. 在 Cocos Creator 中打开项目
# 打开 Cocos Creator 3.8.7 → 打开项目 → 选择 client/tycoon_cocos

# 3. 运行游戏
# 在 Cocos Creator 中点击预览按钮
```

### 合约开发

```bash
cd move/tycoon

# 构建合约
sui move build

# 运行测试
sui move test

# 部署到测试网
sui client publish --gas-budget 500000000
```

### 资源生成

```bash
cd tools/asset-generator
npm install

# 配置 API Key
cp .env.example .env
# 编辑 .env 填入 OPENAI_API_KEY

# 生成资源
npm run generate:sample    # 生成示例
npm run generate           # 生成全部
```

### 部署到 Cloudflare Pages

详细步骤请查看 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

```bash
# 1. 在 Cocos Creator 中构建 Web Mobile 版本

# 2. 提交构建产物
git add client/tycoon_cocos/build/web-mobile
git commit -m "build(web): 更新构建"
git push origin dev

# 3. GitHub Actions 自动部署到 Cloudflare Pages
```

### 部署到 Walrus Sites

```bash
cd client/tools/walrus

# 1. 准备部署文件（排除 assets）
./prepare-deploy.sh

# 2. 部署到 Walrus
./site-builder deploy web-mobile --epochs 5
```

## 📚 文档

### 设计文档
- [游戏机制分析](docs/design/game-analysis.md) - 大富翁玩法拆解
- [黑客松赛道集成](docs/design/hackathon-integration.md) - DeFi 协议集成

### 技术文档
- [架构设计](docs/tech/architecture.md) - 系统架构设计
- [Sui SDK 集成](docs/tech/sui-integration.md) - Sui 集成方案
- [部署指南](docs/DEPLOYMENT.md) - Cloudflare + Walrus 部署

### 项目管理
- [项目结构](docs/project-structure.md) - 文件组织说明
- [开发计划](docs/development-plan.md) - 8 周开发路线

## 🛠️ 开发工具

### 地图编辑器
- 集成在游戏内（UIEditor）
- 实时块放置和预览
- 自动保存（1s 防抖）
- 支持 Web3 主题块选择

### AIGC 资源生成
- OpenAI DALL-E 3 / GPT-Image-1
- Google Gemini 2.5 Flash（免费）
- 批量生成 + 一致性保证
- 成本优化（gpt-image-1 降低 95% 成本）

## 🎯 技术亮点

### 1. 完全链上的 3D 游戏 ⭐⭐⭐
- **所有游戏逻辑在链上**：Move 智能合约实现完整游戏规则
- **客户端仅负责渲染**：3D 客户端作为状态展示层
- **事件驱动同步**：通过 Sui 事件实现客户端状态同步
- **链上随机数**：使用 Sui Random 对象保证公平性
- **可验证性**：所有游戏操作可审计和重放

### 2. Move 2024 Edition 最佳实践
- **新语法**：Vector `v[i]`、`.push_back()` 等 2024 新特性
- **Object Capabilities**：`AdminCap`, `Seat` 基于对象的权限管理
- **事件驱动**：聚合事件实现客户端状态同步
- **随机数**：一次交易一个 `RandomGenerator` 的最佳实践

### 3. TypeScript 与 Move 深度对齐
- **类型对齐**：TS 类型定义与 Move 合约结构一致
- **BFS 寻路**：客户端寻路算法匹配链上逻辑
- **事件索引**：完整的事件处理和状态恢复系统
- **Wallet 集成**：Wallet Standard 标准钱包接入

### 4. 去中心化部署
- **Cloudflare Pages**：全球 CDN 加速 + GitHub Actions 自动部署
- **Walrus Sites**：去中心化存储备份
- **双重保障**：确保游戏长期可访问

## 🏆 项目状态

**当前进度**：黑客松项目（剩余 1.5 个月）

✅ **已完成**
- **Move 智能合约**：完整游戏逻辑（地产、卡牌、Buff、随机数）
- **事件驱动架构**：聚合事件 + 客户端状态同步
- **3D 客户端**：Cocos Creator 3D 游戏世界（Demo 阶段）
- **地图系统**：Tile + Building 分离架构
- **AIGC 资源生成**：OpenAI DALL-E 3 批量生成
- **双重部署**：Cloudflare Pages + Walrus Sites

🚧 **进行中**
- 客户端-区块链深度集成
- 玩家移动动画和游戏流程
- UI 完善和交互优化

📋 **计划中**
- 多人游戏房间系统
- DeFi 协议深度集成
- NFT 资产铸造

## 📖 开发规范

### 代码规范
- **代码**：全英文
- **注释**：中文 + 英文技术术语
- **Commit**：中文格式 `类型(范围): 简洁描述`
- **文件命名**：英文 + kebab_case

### TypeScript
- Target: ES2015
- Strict: Off（Cocos Creator 限制）

### Move
- Edition: 2024
- 遵循 Sui Move 最佳实践
- 一个交易一个 RandomGenerator

## 🤝 参与贡献

欢迎参与项目开发！

### 贡献方式
- 🐛 报告 Bug
- 💡 提出新功能想法
- 🔧 提交代码改进
- 📖 完善文档
- 🎨 提供美术资源

### 联系方式
- GitHub Issues
- Discord 社区（待建）

## 📄 许可证

MIT License

---

<div align="center">

**🎲 Web3 Tycoon - 在游戏中学习 Web3，在 DeFi 中获得乐趣！🎲**

[开始游戏](https://web3-tycoon.pages.dev) • [查看文档](docs/) • [智能合约](move/tycoon/)

Made with ❤️ by Web3 Tycoon Team

</div>
