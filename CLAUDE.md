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

Two-layer map system with voxel integration:

```typescript
// Layer 0 (y=0): Ground tiles
MapTile.ts                  // Base tile class
├── PropertyTile.ts         // Purchasable properties
├── ChanceTile.ts           // Chance cards
└── StartTile.ts            // Starting position

// Layer 1 (y=1): Objects
MapObject.ts                // Base object class
├── Building.ts             // Buildings on properties
└── Decoration.ts           // Decorative objects

// Voxel integration
- Tiles and objects are rendered as voxels
- Support for multi-block structures
- Real-time block placement/removal in edit mode
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
- Uses custom shader for voxel rendering
- Chunk-based world management for performance
- Supports runtime block placement/removal
- Web3-themed blocks (empty_land, building variants, etc.)
- Resource pack system for texture management
- Block models defined in JSON (Minecraft-style)

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