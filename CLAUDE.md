# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web3 Tycoon is a Sui blockchain-based Monopoly game with voxel-style 3D graphics (Minecraft-inspired). This is an 8-week hackathon project with ~1.5 months remaining, focusing on rapid client development with blockchain integration.

**Current Development Status**:
- Cocos Creator 3.8.7 client with voxel rendering system is the primary deliverable
- Move smart contracts have been implemented with core game logic
- Multiplayer servers are planned but not yet implemented

## Key Technologies

- **Frontend**: Cocos Creator 3.8.7 with TypeScript + Voxel rendering system
- **Blockchain**: Sui Network with Move smart contracts (implemented in `move/tycoon/`)
- **Asset Generation**: OpenAI DALL-E 3 / Google Gemini dual-engine AIGC pipeline
- **UI Framework**: FairyGUI integration for complex interfaces
- **Resource System**: Minecraft-style resource pack architecture
- **Planned**: Node.js backend for multiplayer, DeFi protocol integrations (Bucket, Scallop, Navi)

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

## Architecture Overview

### Core System Architecture

The project uses a sophisticated component-based architecture with voxel rendering:

```typescript
// Core Managers (Singleton pattern)
GameInitializer.ts          // Phased initialization system
MapManager.ts               // Dynamic map loading with MapConfig
VoxelSystem.ts              // Voxel rendering and chunk management
CameraManager.ts            // Multi-mode camera (isometric/top/follow)
UIManager.ts                // FairyGUI-based UI management
EventBus.ts                 // Global event system (composite pattern)
RoleManager.ts              // Character and player management
CardManager.ts              // Card system management
SkillManager.ts             // Skill system management
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

### Hackathon Time Constraints
- **剩余时间**: ~1.5个月，时间极其紧张
- **优先级**: 客户端功能 > UI完善 > 区块链集成 > DeFi功能
- **开发策略**: 只实现核心功能，避免过度工程化

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
- **TypeScript**: Target ES2015, strict mode off
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

## Development Workflow

1. **Primary Development**: Open `client/tycoon_cocos` in Cocos Creator 3.8.7
2. **Contract Development**: Edit Move files in `move/tycoon/sources/`, run tests frequently
3. **Voxel Editing**: Use map editor mode with UIEditor interface
4. **UI Design**: Edit in FGUIProject, export to resources/ui/
5. **Asset Generation**: Use asset-generator for new textures/sprites
6. **Testing**:
   - Client: Use Creator preview, check console for debug logs
   - Contracts: Run `sui move test` in move/tycoon/

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
- Client-blockchain integration
- Player movement animations
- Card visual effects
- Sound system

### 📋 Planned
- Multiplayer backend (Node.js)
- DeFi protocol integrations (Bucket, Scallop, Navi)
- Advanced game modes
- Tournament system

## Notes for Claude Code

- **请使用中文和用户对话** - Always communicate in Chinese
- **Focus on client development** - Client is the primary deliverable
- **Voxel system is core** - Not just UI, but fundamental to gameplay
- **Time is critical** - 黑客松项目，避免过度设计
- **Don't auto-commit** - User will review and commit manually
- **Keep commits concise** - Simple Chinese descriptions
- **Bug fixes**: 尽量使用KISS原则
- **Refactoring**: 不需要向后兼容，以保持设计架构最优为优先
- **Move contracts**: See move/tycoon/CLAUDE.md for contract-specific guidance
- **Move 2024 Edition语法规范**:
  - Vector: 使用新语法 `v[i]` 索引、`.push_back()` 方法
  - Table: 保持函数式调用 `table::borrow()` 以示区分
  - Option: 需要前缀 `option::some()`, `option::none()`
  - 复杂类型优先使用引用避免复制
- **Random in Move**: 一个交易使用一个 RandomGenerator，避免多次创建
- 生成代码时，没有我的指示，不要添加多余的fallback机制，让错误能够早点可见
- 不要修改cocos的TypeScript的target，因为cocos不支持

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

### 节点命名规范
- **Tile**: `T_x_z` (如 `T_-2_-10`)
- **Building**: `B_size_x_z` (如 `B_1x1_5_3`, `B_2x2_10_8`)
- **简洁清晰**: 包含坐标信息，便于层级面板调试

### 碰撞器配置
- **所有BoxCollider的xz scale统一为1**
- Tile: `(1, 0.1, 1)` - 扁平
- NPC/Decoration: `(1, 0.1, 1)` - 扁平，用于点击
- Object: `(1, 1, 1)` - 立体