# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web3 Tycoon is a Sui blockchain-based Monopoly game with voxel-style 3D graphics (Minecraft-inspired), focusing on client development with blockchain integration.

**Current Development Status**:
- Cocos Creator 3.8.7 client with voxel rendering system is the primary deliverable
- Move smart contracts have been implemented with core game logic
- Multiplayer servers are planned but not yet implemented

## Key Technologies

- **Frontend**: Cocos Creator 3.8.7 with TypeScript + Voxel rendering system
- **Blockchain**: Sui Network with Move smart contracts (implemented in `move/tycoon/`)
- **Wallet Integration**: Sui TypeScript SDK (@mysten/sui) + Wallet Standard (@mysten/wallet-standard)
- **Asset Generation**: OpenAI DALL-E 3 / Google Gemini dual-engine AIGC pipeline
- **UI Framework**: FairyGUI integration for complex interfaces
- **Resource System**: Minecraft-style resource pack architecture
- **Planned**: Node.js backend for multiplayer

## Development Commands

### Cocos Creator Client
```bash
cd client/tycoon_cocos
npm install                   # Install dependencies

# Development via Cocos Creator 3.8.7 GUI
# No CLI build commands - use Creator interface
```

### Move Smart Contracts
```bash
cd move/tycoon
sui move build                # Build contracts
sui move test                 # Run all tests
sui move test --filter <name> # Run specific test
sui client publish --gas-budget 500000000  # Deploy to testnet
```

### Asset Generation Tool
```bash
cd tools/asset-generator
npm install

# Core generation
npm run generate              # Generate all assets (~100+ items)
npm run generate:tiles        # Map tiles and buildings
npm run generate:ui           # UI elements
npm run generate:characters   # Player characters
npm run generate:dice         # Web3-themed dice

# Cost optimization
npm run generate:gpt          # Use cheaper gpt-image-1
npm run generate:free         # Free Gemini model (gemini-2.5-flash)
npm run generate:fast         # Quick 10-asset test
npm run generate:sample       # Sample from each category
npm run print:prompts         # Export prompts only

# Utilities
npm run clean                 # Clean outputs
npm test                      # Test tool readiness
```

### VSCode Extension
```bash
cd tools/md-paste-image-extension
npm install
npm run lint
npm run test
```

### 构建脚本

#### 自动化构建
```bash
cd client/tycoon_cocos
bash build.sh  # 完整的自动化构建流程
# 流程：环境检查 → npm依赖 → 清理 → 构建 → 验证
```

#### 手动修复 Sui SDK 兼容性
```bash
node scripts/fix-sui-modules.js  # 修复 @mysten/sui 模块
node scripts/copy-esm-to-libs.js # 生成 ESM import-map
node scripts/copy-logo.js        # 构建后复制 logo
```

## CI/CD 和部署

### GitHub Actions 工作流

项目配置了两个自动部署工作流：

**deploy-cloudflare.yml** - Cloudflare Pages 部署
- 触发条件: push 到 `main` 或 `dev` 分支，且 `client/tycoon_cocos/build/web-mobile/**` 有变化
- 部署目标: Cloudflare Pages
- 需要配置的 GitHub Secrets:
  - `CLOUDFLARE_API_TOKEN` - Cloudflare API 令牌
  - `CLOUDFLARE_ACCOUNT_ID` - Cloudflare 账户 ID
  - `CLOUDFLARE_PROJECT_NAME` - 项目名称

**deploy-cdn.yml** - Walrus 去中心化存储部署
- 触发条件: 同上
- 部署目标: Cloudflare Pages (CDN) + Walrus Sites
- 使用相同的 Secrets

### 部署流程

1. **本地构建**: 在 Cocos Creator 3.8.7 中构建为 web-mobile 平台
2. **提交构建**: 将 `build/web-mobile/` 目录提交到 Git
3. **自动部署**: GitHub Actions 检测到变化后自动部署
4. **访问地址**:
   - 生产环境 (main): https://cdn.web3tycoon.com
   - 预览环境 (dev): https://{commit-sha}.pages.dev

### 手动触发部署

可以通过 GitHub Actions 界面手动触发部署（workflow_dispatch）。

## Architecture Overview

### Core System Architecture

The project uses a sophisticated component-based architecture with voxel rendering:

```typescript
// Core Managers (Singleton pattern)
core/
├── GameInitializer.ts      // Phased initialization system with lifecycle management
└── GameSession.ts          // Game session state and lifecycle tracking

config/
├── ConfigLoader.ts         // JSON configuration loading system
├── GameSettings.ts         // Game settings and constants
└── SuiEnvConfigManager.ts  // Sui network environment configuration

map/
├── MapManager.ts           // Dynamic map loading with MapConfig
├── GameMap.ts              // Map logic with tile/building systems
└── MapTile.ts              // Individual tile components

voxel/
├── VoxelWorld.ts           // Main voxel world controller
├── VoxelRenderer.ts        // Mesh generation and rendering
├── VoxelChunk.ts           // Chunk-based world management
├── VoxelInteractionManager.ts // Ray-casting and block interaction
├── resource_pack/          // Minecraft-style resource loading
└── lighting/               // Voxel lighting system with AO

camera/
├── CameraManager.ts        // Multi-mode camera controller
├── VoxelCameraController.ts // Voxel-specific camera
└── CameraDebugger.ts       // Camera debugging tools

ui/
├── UIManager.ts            // FairyGUI-based UI management
├── game/UIEditor.ts        // Map editor interface
├── game/UIInGame.ts        // Main game HUD
└── game/UIWallet.ts        // Wallet connection UI

role/
├── RoleManager.ts          // Character and player management
├── Player.ts               // Player entity
├── NPC.ts                  // NPC entity
└── Actor.ts                // Base actor class

card/
├── CardManager.ts          // Card system management
└── cards/                  // Individual card implementations

sui/
├── managers/SuiManager.ts  // Main Sui integration manager
├── types/                  // TypeScript types matching Move contracts
├── events/                 // Event indexing and processing
├── interactions/           // Contract interaction wrappers
├── pathfinding/            // BFS pathfinding for game board
└── utils/                  // Keystore, crypto, error translation

events/
├── EventBus.ts             // Global event system (composite pattern)
├── EventTypes.ts           // Centralized event type definitions
└── Blackboard.ts           // Shared state management (key-value store)

skill/
└── SkillManager.ts         // Skill system management
```

### Move Contract Architecture

```move
// Core modules with clear separation
sources/
├── tycoon.move      // Package init
├── admin.move       // Admin capabilities
├── types.move       // Constants and helpers
├── map.move         // Map templates and tiles
├── cards.move       // Card mechanics
├── events.move      // Aggregated events
└── game.move        // Core game logic

// Key patterns:
- Object Capabilities (AdminCap, Seat, TurnCap)
- Aggregated Events (UseCardActionEvent, RollAndStepActionEvent)
- Buff System with exclusive timing
- Property ownership via tables
```

### Voxel System Architecture (Critical Component)

```typescript
// Voxel components hierarchy
VoxelSystem.ts              // Main voxel system controller
├── VoxelRenderer.ts        // Mesh generation and rendering
├── VoxelChunk.ts           // Chunk-based world management
├── VoxelInteraction.ts     // Ray-casting and block interaction
└── Web3BlockTypes.ts       // Web3-themed block definitions

// Resource pack system (Minecraft-style)
resource_pack/
├── pack.mcmeta             // Pack metadata
├── assets/web3/            // Web3-themed resources
│   ├── textures/block/     // Block textures
│   └── models/             // Block models (JSON format)
```

### Map System Architecture

**核心架构重构（2024-10）**：Tile和Building完全分离

```typescript
// Tile系统：简单路径抽象（y=0层）
MapTile.ts                  // 纯路径tile，管理tileId和邻居关系
  - 数据：tileId, buildingId, w/n/e/s (4方向邻居)
  - 类型：EMPTY_LAND, LOTTERY, HOSPITAL, CHANCE等
  - 无地产业务逻辑（owner/price/rent已移除）

// Building系统：复杂业务实体（y=0.5层PaperActor）
GameMap._buildingRegistry   // Map<key, BuildingInfo>管理所有建筑
  - BuildingInfo：position, size, direction, buildingId, entranceTileIds
  - 1x1/2x2建筑，朝向0-3（南东北西，CCW）
  - 与entrance tiles通过ID关联

// 关键关系：
- Tile → Building: tile.buildingId指向关联的building
- Building → Tile: building.entranceTileIds[0,1]指向入口tiles
- Tile邻居：tile.w/n/e/s存储4方向相邻tile的ID
- 编号算法：DFS遍历从hospital开始分配tileId

// 容器节点结构：
TilesContainer    // 所有tiles
ObjectsContainer  // 旧物体系统（待整合）
ActorsRoot        // NPC PaperActors
BuildingsRoot     // Building PaperActors
DecorationsRoot   // 装饰物体素节点
```

### Overlay系统架构（2024-10新增）

```typescript
// 多层overlay渲染系统
BlockOverlayManager.ts      // 在block表面叠加视觉效果
  - 参数化faces控制：可选渲染6个面的任意组合
  - 多层支持：layerIndex + inflate分层避免z-fight
  - 用途：数字编号、方向箭头、装饰贴花

// Layer使用规划：
Layer 0:  Tile编号（白色背景）
Layer 1:  Building编号（金色背景）
Layer 10: Building关联图标
Layer 11: Entrance tile边框
Layer 20: Tile邻居方向字母（W/N/E/S）

// 关键实现：
NumberTextureGenerator.ts   // Canvas2D动态生成数字/字母纹理
  - 支持缓存避免重复生成
  - customText优先级高于prefix+num
  - 纹理缓存键包含customText避免冲突
```

### Event System Architecture

```typescript
// Global event bus with debugging
EventBus.getInstance()
  .on(EventTypes.Map.BlockPlaced, handler)
  .emit(EventTypes.UI.MapElementSelected, data);

// Event flow: Input → Interaction → Map → UI
// All events defined in EventTypes.ts with TypeScript support

// Sui blockchain events (for indexing)
SuiEventIndexer.ts          // Event indexing system
SuiEventTypes.ts            // Event type definitions
SuiEventCursor.ts           // Event cursor management
```

### UI System Architecture

```typescript
// FairyGUI integration
UIManager.ts                // Central UI controller
├── UIBase.ts               // Base class for all UI panels
├── game/                   // Game UI components
│   ├── UIEditor.ts         // Map editor interface
│   ├── UIMapElement.ts     // Block selection panel
│   ├── UIInGame.ts         // Main game HUD
│   ├── UIMapSelect.ts      // Map selection screen
│   ├── UIModeSelect.ts     // Game mode selection
│   └── UIWallet.ts         // Wallet connection interface
└── FGUIProject/            // FairyGUI project files
    └── assets/
        ├── InGame/         // In-game UI elements
        ├── MapSelect/      // Map selection UI
        ├── ModeSelect/     // Mode selection UI
        └── Common/         // Shared UI components
```

## Project Structure

```
web3-tycoon/
├── client/
│   └── tycoon_cocos/       # Active Cocos Creator 3.8.7 project
│       ├── assets/
│       │   ├── scripts/    # TypeScript game logic
│       │   ├── resources/  # Game resources
│       │   └── prefabs/    # Reusable game objects
│       ├── FGUIProject/    # FairyGUI source project
│       └── package.json    # Dependencies
│
├── move/
│   └── tycoon/             # Move smart contracts
│       ├── sources/        # Contract source files
│       ├── tests/          # Contract tests
│       └── Move.toml       # Move package config
│
├── tools/
│   ├── asset-generator/    # AIGC asset generation
│   │   ├── assets_config.js # 100+ prompt templates
│   │   └── generators/     # OpenAI/Gemini handlers
│   └── md-paste-image-extension/ # VSCode helper
│
├── docs/                   # Comprehensive documentation
│   ├── design/            # Game design documents
│   ├── tech/              # Technical architecture
│   └── api/               # API documentation
│
└── server/                # Minimal (planned for future)
```

## Critical Development Notes

### Voxel System Specifics
- Uses custom shader for voxel rendering (voxel-block.effect, voxel-overlay.effect等)
- Chunk-based world management for performance
- Supports runtime block placement/removal
- Web3-themed blocks (empty_land, lottery, hospital等)
- Resource pack system for texture management（**完全独立，不依赖minecraft资源**）
- Block models defined in JSON (Minecraft-style)
- 模板系统：web3:block/cube_all, web3:block/cross, web3:block/cube_column
- Overlay双mesh渲染：支持在block表面叠加多层透明效果

### Code Conventions (from .cursorrules)
- **Code**: English only for all code
- **Comments**: Chinese with English technical terms
- **Git Commits**: Chinese format `类型(范围): 简洁描述`
- **Communication**: Always use Chinese when talking to users
- **File Naming**: English with kebab_case
- **TypeScript**: Target ES2020, strict mode off, allowSyntheticDefaultImports enabled
- **Move**: Follow Sui Move best practices

### FairyGUI Integration
- Design in FGUIProject using FairyGUI editor
- Export to `assets/resources/ui/`
- Load via UIManager with package management
- All UI components extend UIBase class
- Packages: InGame, MapSelect, ModeSelect, Common

### Map Editor Mode
- Toggle edit mode via GameMap.isEditMode
- Real-time block placement with voxel preview
- Auto-save with debouncing (1s delay)
- UIEditor provides block selection interface
- Support for Web3-themed blocks from resource pack

## Important Files

### Core Entry Points
- `client/tycoon_cocos/assets/scripts/core/GameInitializer.ts` - Game startup sequence
- `client/tycoon_cocos/assets/scripts/map/MapManager.ts` - Map system controller
- `client/tycoon_cocos/assets/scripts/voxel/VoxelSystem.ts` - Voxel rendering core
- `client/tycoon_cocos/assets/scripts/ui/core/UIManager.ts` - UI system controller
- `move/tycoon/sources/game.move` - Main game logic contract

### Configuration
- `client/tycoon_cocos/assets/resources/data/maps/test_map.json` - Test map configuration
- `client/tycoon_cocos/assets/resources/voxel/resource_pack/pack.mcmeta` - Resource pack meta
- `client/tycoon_cocos/package.json` - Client dependencies
- `client/tycoon_cocos/tsconfig.json` - TypeScript configuration
- `move/tycoon/Move.toml` - Move package configuration

### Asset Generation
- `tools/asset-generator/assets_config.js` - AIGC prompts (100+ templates)
- `tools/asset-generator/.env` - API keys configuration

## 关键构建脚本说明

### Sui SDK 兼容性处理

Cocos Creator 的 Rollup 打包系统与 @mysten/sui 的 ES6 模块存在兼容性问题。项目通过以下机制解决：

#### fix-sui-modules.js (postinstall hook)

**位置**: `client/tycoon_cocos/scripts/fix-sui-modules.js`

**问题**:
- Cocos Creator 打包时，@mysten/sui 的 ES6 模块导入被破坏
- `resolveTransactionPlugin` 函数引用丢失
- MapIterator 对象无法正确处理

**解决方案**:
- 在 `npm install` 后自动运行 (package.json postinstall hook)
- 修补 `node_modules/@mysten/sui/dist/esm/transactions/Transaction.js`:
  1. 添加 `resolveTransactionPlugin` 的 fallback 逻辑
  2. 转换 MapIterator → Array
- 修补 `node_modules/@mysten/sui/dist/esm/transactions/resolve.js`:
  1. 确保函数正确导出

#### copy-esm-to-libs.js

**功能**:
- 将 8 个 npm 包的 ESM 模块复制到 `libs/` 目录
- 生成 `preview-template/import-map.json` 用于浏览器 import-map
- 包含的包: @mysten/sui, @mysten/wallet-standard, @noble/curves 等

#### rollup-guard 扩展

**位置**: `client/tycoon_cocos/extensions/rollup-guard/`

**功能**: Cocos Creator 自定义扩展，处理 Rollup 打包过程

**配置选项** (在 build_config/*.json 中):
- `retargetES2020`: 是否重新目标化到 ES2020
- `externalizeMysten`: 是否外部化 @mysten 依赖（设为 false 避免重复）

### 构建配置文件

#### build_config/web-mobile.json
- **用途**: Cloudflare Pages 部署配置
- **平台**: web-mobile
- **关键设置**: `md5Cache: true`, `sourceMaps: false`, `orientation: landscape`

#### build_config/web-walrus.json
- **用途**: Walrus 去中心化存储部署配置
- **服务器**: https://cdn.web3tycoon.com/
- **其他配置**: 同 web-mobile

### build.sh 自动化脚本

**位置**: `client/tycoon_cocos/build.sh`

**功能**: 完整的自动化构建流程

**执行步骤**:
1. 检查 Cocos Creator 3.8.7 安装路径
2. 检查项目路径和 package.json
3. 安装/更新 npm 依赖（智能检测）
4. 清理旧的构建目录
5. 跳过 TypeScript 检查（Creator 构建时处理）
6. 执行 Cocos Creator CLI 构建
7. 验证构建结果（检查 index.html、显示大小）

**构建参数**:
```bash
platform=web-desktop
debug=false
sourceMaps=OFF
md5Cache=false
inlineEnums=true
mergeStartScene=false
optimizeHotUpdate=false
```

## Development Workflow

### Game Initialization Sequence
The game follows a phased initialization managed by GameInitializer:

1. **CONFIG_LOADING**: Load JSON configurations via ConfigLoader
2. **MANAGERS_INIT**: Initialize core managers (MapManager, RoleManager, UIManager, SuiManager)
3. **SYSTEMS_INIT**: Initialize subsystems (EventBus, Blackboard, GameSession)
4. **GAME_READY**: Game ready for interaction

All managers follow singleton pattern and are accessed via static `getInstance()`.

### Primary Development Workflow
1. **Cocos Creator GUI**: Open `client/tycoon_cocos` in Cocos Creator 3.8.7 (REQUIRED for builds)
2. **TypeScript Editing**: Use any IDE, but asset management must be done in Creator
3. **Contract Development**: Edit Move files in `move/tycoon/sources/`, run `sui move test` frequently
4. **Voxel Editing**: Use map editor mode via UIEditor interface (toggle in-game)
5. **UI Design**: Edit in FGUIProject using FairyGUI editor, export to `resources/ui/`
6. **Asset Generation**: Use `tools/asset-generator` for AIGC texture generation
7. **Testing**:
   - Client: Use Creator preview (F5), check console for debug logs
   - Contracts: Run `sui move test` or `sui move test --filter <name>` in `move/tycoon/`
   - Type checking: `npx tsc -p client/tycoon_cocos/tsconfig.json --noEmit`

## Current Implementation Status

### ✅ Implemented
- Complete voxel rendering system with custom shaders
- Map editor with real-time block placement
- FairyGUI-based UI system with multiple screens
- Event-driven architecture
- Resource pack system (Minecraft-style)
- AIGC asset pipeline
- Move smart contracts with core game logic
- Card system with buffs
- Property ownership and toll system
- Turn-based game mechanics

### 🚧 In Progress
- Client-blockchain integration (Sui SDK integrated, wallet UI implemented)
- Player movement animations
- Card visual effects
- Sound system
- Sui event indexing and synchronization

### 📋 Planned
- Multiplayer backend (Node.js)
- Advanced game modes
- Tournament system

## Notes for Claude Code

### Communication and Style
- **请使用中文和用户对话** - Always communicate in Chinese
- **Keep commits concise** - Simple Chinese descriptions using format `类型(范围): 简洁描述`
- **Don't auto-commit** - User will review and commit manually

### Development Priorities
- **Focus on client development** - Client is the primary deliverable
- **Avoid over-engineering** - 只实现核心功能，保持代码简洁
- **Bug fixes**: 尽量使用KISS原则
- **Refactoring**: 不需要向后兼容，以保持设计架构最优为优先
- 生成代码时，没有我的指示，不要添加多余的fallback机制，让错误能够早点可见

### Cocos Creator Specifics
- **Asset Management**: MUST be done through Cocos Creator GUI, not file system operations
- **TypeScript Target**: DO NOT modify `tsconfig.json` target (ES2020) - Cocos Creator has specific requirements
- **Library/Temp Folders**: Never edit `library/` or `temp/` - these are auto-generated
- **资源加载**: Use `resources.load()` callback style (no `loadAsync()`), wrap in Promise if needed

### 构建系统特殊处理
- **Sui SDK 兼容性**: 项目使用 postinstall hook 自动修复 @mysten/sui 模块兼容性问题
- **双构建配置**: web-mobile (Cloudflare) 和 web-walrus (去中心化存储) 两套配置
- **rollup-guard 扩展**: 必须启用以确保 Rollup 正确打包 Sui SDK
- **import-map 生成**: copy-esm-to-libs.js 自动生成浏览器 ESM 模块映射
- **自动化脚本**: build.sh 提供完整的构建流程，包含环境检查和依赖管理

### Voxel System Guidelines
- **Voxel system is core** - Not just UI, but fundamental to gameplay
- **Resource pack independence**: web3 resource pack is fully self-contained, no minecraft dependencies
- **Overlay system**: Use `BlockOverlayManager` with faces parameter, layerIndex for z-ordering
- **Node naming**: Follow conventions - Tiles: `T_x_z`, Buildings: `B_size_x_z`
- **Colliders**: All BoxCollider xz scale = 1, adjust y for flat (0.1) vs cubic (1) volumes

### Move Contract Development
- **See move/tycoon/CLAUDE.md** for detailed contract-specific guidance
- **Move 2024 Edition syntax**:
  - Vector: 使用新语法 `v[i]` 索引、`.push_back()` 方法
  - Table: 保持函数式调用 `table::borrow()` 以示区分
  - Option: 需要前缀 `option::some()`, `option::none()`
  - 复杂类型优先使用引用避免复制
- **Random in Move**: 一个交易使用一个 RandomGenerator，避免多次创建
- **Tile/Property separation**: Tiles are pure navigation nodes, Properties are economic entities

### Sui Integration
- **TypeScript types** in `sui/types/` mirror Move contract structures exactly
- **Event processing** via `sui/events/` with cursor-based polling
- **Contract interactions** wrapped in `sui/interactions/` for type safety
- **Pathfinding logic** matches Move contract's BFS implementation to save gas
- **Keystore**: Use `KeystoreConfig` and `CryptoUtils` for password-protected keypair storage

### Architecture Patterns
- **Singleton managers**: All managers use `getInstance()` pattern
- **Event-driven**: Use EventBus for cross-component communication
- **Phased initialization**: GameInitializer manages startup sequence
- **State management**: Blackboard for shared game state (key-value store)

### Debugging Tips
- **Console logs**: Use `console.log('[ManagerName]', ...)` with component prefix
- **Event debugging**: EventBus has built-in logging capabilities
- **Camera debugging**: CameraDebugger component for camera state visualization
- **Voxel debugging**: Use overlay system to visualize tile/building IDs and relationships

### Additional Resources
- **AGENTS.md**: Repository guidelines and conventions
- **client/tycoon_cocos/CLAUDE.md**: Client-specific detailed guidance
- **move/tycoon/CLAUDE.md**: Move contract development guidelines

## 关键架构决策记录

### Tile vs Building分离（2024-10）
- **Tile**: 纯路径节点，只存储tileId、buildingId、4方向邻居(w/n/e/s)
- **Building**: 在_buildingRegistry管理，存储position、direction、entranceTileIds
- **关联计算**: `calculateBuildingEntrances()`建立tile↔building双向关联
- **邻居计算**: `calculateTileNeighbors()`计算并校验tile的4方向邻居一致性

### 朝向系统（Cocos左手坐标系）
- **Cocos特性**: Y轴旋转从上方俯视是逆时针CCW
- **Direction定义**: 0=南(+z), 1=东(+x), 2=北(-z), 3=西(-x)
- **旋转角度**: direction * 90° (0°→90°→180°→270°为CCW)
- **点击切换**: 0→1→2→3→0 (南→东→北→西)

### Overlay渲染系统
- **实现方式**: 双Mesh方式，独立节点使用voxel-overlay.effect
- **faces参数**: 数组指定要渲染的面，不硬编码（如[OverlayFace.UP]）
- **inflate机制**: 沿法线膨胀避免z-fight，多层递增0.001
- **纹理生成**: Canvas2D动态生成，缓存键必须包含customText
- **重要**: `resources.load()`回调方式，无`loadAsync()`，需Promise封装

### 资源包独立性
- **web3资源包完全自包含**: 删除了minecraft资源依赖
- **模板模型**: web3:block/cube_all, web3:block/cross, web3:block/cube_column
- **所有web3 model的parent引用**: 必须指向web3命名空间，不能指向minecraft

### 价格计算同步（客户端↔Move）
- **PriceCalculator.ts** 必须与 **game.move** 保持完全一致
- 涉及函数对应关系：
  - `calculatePriceIndex()` → `calculate_price_index()` (game.move:2625-2629)
  - `calculateSingleTileRent()` → `calculate_single_tile_rent()` (game.move:2634-2649)
  - `calculateTempleBonus()` → `calculate_temple_bonus()` (game.move:2653-2673)
  - `calculateToll()` → `calculate_toll()` (game.move:2681-2725)
  - `calculateBuildingPrice()` → `calculate_building_price()` (game.move:2760-2830)
- **修改Move端价格算法时，必须同步更新 PriceCalculator.ts！**

### 节点命名规范
- **Tile**: `T_x_z` (如 `T_-2_-10`)
- **Building**: `B_size_x_z` (如 `B_1x1_5_3`, `B_2x2_10_8`)
- **简洁清晰**: 包含坐标信息，便于层级面板调试

### 碰撞器配置
- **所有BoxCollider的xz scale统一为1**
- Tile: `(1, 0.1, 1)` - 扁平
- NPC/Decoration: `(1, 0.1, 1)` - 扁平，用于点击
- Object: `(1, 1, 1)` - 立体
- 修改完以后不需要帮我stage，我会check以后自己操作
- 在我没有明确要求的情况下，一般不需要生成md文档