# Web3 Tycoon 项目结构

## 项目概述
基于Sui区块链的Web3大富翁游戏，参考大富翁10、11等经典游戏，为期2个月的黑客松项目。

## 技术栈
- **区块链**: Sui + Move语言
- **服务端**: Node.js/TypeScript（多人匹配）
- **客户端**: Cocos Creator (TypeScript)
- **集成赛道**: Sui + Bucket + Scallop + Navi

## 项目目录结构

```
web3-tycoon/
├── README.md                           # 项目主文档
├── .gitignore                         # Git忽略文件
├── package.json                       # 根目录package.json
├── 
├── contracts/                         # Move智能合约
│   ├── Move.toml                      # Move项目配置
│   ├── sources/                       # Move源代码
│   │   ├── game.move                  # 游戏主逻辑
│   │   ├── player.move               # 玩家管理
│   │   ├── board.move                # 地图/棋盘
│   │   ├── property.move             # 房产系统
│   │   ├── token.move                # 游戏代币
│   │   ├── nft.move                  # NFT道具/卡牌
│   │   ├── defi_integration.move     # DeFi集成（Bucket/Scallop/Navi）
│   │   └── utils.move                # 工具函数
│   ├── tests/                        # Move测试
│   └── scripts/                      # 部署脚本
│
├── server/                           # 后端服务
│   ├── package.json
│   ├── matchmaking/                  # 多人匹配服务
│   │   ├── src/
│   │   ├── websocket.ts             # WebSocket服务
│   │   └── room-manager.ts          # 房间管理
│   ├── api/                         # API服务
│   │   ├── routes/
│   │   └── middleware/
│   └── database/                    # 数据库相关
│       ├── models/
│       └── migrations/
│
├── client/                          # 客户端
│   ├── console-demo/                # TypeScript控制台Demo
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── game-engine.ts       # 游戏引擎
│   │   │   ├── board-renderer.ts    # 地图渲染
│   │   │   ├── player-manager.ts    # 玩家管理
│   │   │   └── sui-client.ts        # Sui链交互
│   │   └── dist/
│   ├── cocos-project/               # Cocos Creator项目（后期）
│   │   ├── assets/
│   │   ├── build/
│   │   └── settings/
│   └── shared/                      # 共享代码
│       ├── types/                   # TypeScript类型定义
│       ├── constants/               # 常量定义
│       └── utils/                   # 工具函数
│
├── docs/                            # 文档
│   ├── design/                      # 设计文档
│   │   ├── game-design.md           # 游戏设计文档
│   │   ├── tokenomics.md            # 代币经济学
│   │   ├── user-stories.md          # 用户故事
│   │   └── art-style.md             # 美术风格指南
│   ├── tech/                        # 技术文档
│   │   ├── architecture.md          # 系统架构
│   │   ├── move-contracts.md        # Move合约设计
│   │   ├── client-architecture.md   # 客户端架构
│   │   └── deployment.md            # 部署文档
│   └── api/                         # API文档
│       └── server-api.md            # 服务端API
│
├── tools/                           # 开发工具
│   ├── map-editor/                  # 地图编辑器
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── editor.ts            # 编辑器主程序
│   │   │   ├── map-generator.ts     # AI地图生成
│   │   │   └── export-utils.ts      # 导出工具
│   │   └── maps/                    # 地图文件
│   └── asset-generator/             # AI资源生成工具
│       ├── prompts/                 # AI生成提示词
│       ├── scripts/                 # 生成脚本
│       └── generated/               # 生成的资源
│
└── assets/                          # 游戏资源
    ├── sprites/                     # 2D精灵图
    │   ├── characters/              # 角色
    │   ├── buildings/               # 建筑
    │   ├── ui/                      # UI元素
    │   └── effects/                 # 特效
    ├── models/                      # 3D模型（如需要）
    ├── audio/                       # 音频
    │   ├── bgm/                     # 背景音乐
    │   └── sfx/                     # 音效
    └── maps/                        # 地图数据
        ├── classic.json             # 经典地图
        ├── fantasy.json             # 奇幻地图
        └── modern.json              # 现代地图
```

## 开发阶段规划

### 第一阶段（第1-2周）：基础架构
1. Move合约基础框架
2. TypeScript控制台Demo
3. 基础地图编辑器

### 第二阶段（第3-4周）：核心功能
1. 游戏核心逻辑
2. 多人匹配系统
3. 基础UI

### 第三阶段（第5-6周）：DeFi集成
1. Bucket Protocol集成（数据桶存储）
2. Scallop Protocol集成（借贷机制）
3. Navi Protocol集成（流动性挖矿）

### 第四阶段（第7-8周）：优化和部署
1. Cocos Creator客户端
2. 性能优化
3. 测试和部署

## DeFi赛道集成方案

### Bucket Protocol
- 游戏数据存储和管理
- 游戏状态的去中心化存储

### Scallop Protocol
- 房产抵押借贷系统
- 玩家可以抵押房产获得流动资金

### Navi Protocol
- 游戏内流动性挖矿
- 奖励池和代币分发机制
