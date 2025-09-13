# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web3 Tycoon is a Sui blockchain-based Monopoly game with voxel-style 3D graphics (Minecraft-inspired). This is an 8-week hackathon project with ~1.5 months remaining, focusing on rapid client development with planned blockchain integration.

**Current Development Reality**: The Cocos Creator 3.8.7 client with voxel rendering is the primary deliverable. Blockchain/Move contracts and multiplayer servers are planned but not yet implemented.

## Key Technologies

- **Frontend**: Cocos Creator 3.8.7 with TypeScript + Voxel rendering system
- **Asset Generation**: OpenAI DALL-E 3 / Google Gemini dual-engine AIGC pipeline
- **UI Framework**: FairyGUI integration for complex interfaces
- **Resource System**: Minecraft-style resource pack architecture
- **Planned**: Sui Network (Move contracts), Node.js backend, DeFi integrations

## Development Commands

### Cocos Creator Client
```bash
cd client/tycoon_cocos
npm install                   # Install dependencies

# Development via Cocos Creator 3.8.7 GUI
# No CLI build commands - use Creator interface
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
npm run generate:free         # Free Gemini model
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

### Voxel System Architecture (Critical Component)

The game features a complete voxel-based map system:

```typescript
// Voxel components hierarchy
VoxelSystem.ts              // Main voxel system controller
├── VoxelRenderer.ts        // Mesh generation and rendering
├── VoxelChunk.ts           // Chunk-based world management
├── VoxelShader.ts          // Custom shader for voxel rendering
├── VoxelInteraction.ts     // Ray-casting and block interaction
└── Web3BlockTypes.ts       // Web3-themed block definitions

// Resource pack system (Minecraft-style)
resource_pack/
├── pack.mcmeta             // Pack metadata
├── assets/web3/            // Web3-themed resources
│   ├── textures/block/     // Block textures
│   └── models/             // Block models
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
```

### UI System Architecture

```typescript
// FairyGUI integration
UIManager.ts                // Central UI controller
├── UIBase.ts               // Base class for all UI panels
├── game/                   // Game UI components
│   ├── UIEditor.ts         // Map editor interface
│   ├── UIMapElement.ts     // Block selection panel
│   └── UIGameMain.ts       // Main game HUD
└── FGUIProject/            // FairyGUI project files
```

## Project Structure

```
client/tycoon_cocos/        # Active Cocos Creator 3.8.7 project
├── assets/
│   ├── scripts/            # TypeScript game logic
│   │   ├── core/           # Core systems and managers
│   │   ├── map/            # Map and tile system
│   │   ├── voxel/          # Voxel rendering system
│   │   ├── ui/             # UI components
│   │   └── events/         # Event system
│   ├── resources/
│   │   ├── voxel/          # Voxel resources and textures
│   │   │   └── resource_pack/  # Minecraft-style pack
│   │   ├── data/           # JSON configs and maps
│   │   └── ui/             # FairyGUI exports
│   └── prefabs/            # Reusable game objects
├── FGUIProject/            # FairyGUI source project
└── package.json            # Dependencies

tools/
├── asset-generator/        # AIGC asset generation
│   ├── assets_config.js    # 100+ prompt templates
│   └── generators/         # OpenAI/Gemini handlers
└── md-paste-image-extension/  # VSCode helper

docs/                       # Comprehensive documentation
server/                     # Minimal (memo.md only)
move/                       # Not implemented yet
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
- Web3-themed blocks (empty_land, building variants)
- Resource pack system for texture management

### Code Conventions (from .cursorrules)
- **Code**: English only for all code
- **Comments**: Chinese with English technical terms
- **Git Commits**: Chinese format `类型(范围): 简洁描述`
- **Communication**: Always use Chinese when talking to users
- **File Naming**: English with kebab_case
- **TypeScript**: Target ES2015, strict mode off

### FairyGUI Integration
- Design in FGUIProject using FairyGUI editor
- Export to `assets/resources/ui/`
- Load via UIManager with package management
- All UI components extend UIBase class

### Map Editor Mode
- Toggle edit mode via GameMap.isEditMode
- Real-time block placement with voxel preview
- Auto-save with debouncing (1s delay)
- UIEditor provides block selection interface

## Important Files

### Core Entry Points
- `assets/scripts/core/GameInitializer.ts` - Game startup sequence
- `assets/scripts/map/MapManager.ts` - Map system controller
- `assets/scripts/voxel/VoxelSystem.ts` - Voxel rendering core
- `assets/scripts/ui/core/UIManager.ts` - UI system controller

### Configuration
- `assets/resources/data/maps/test_map.json` - Test map configuration
- `assets/resources/voxel/resource_pack/pack.mcmeta` - Resource pack meta
- `package.json` - Project dependencies
- `tsconfig.json` - TypeScript configuration

### Asset Generation
- `tools/asset-generator/assets_config.js` - AIGC prompts
- `tools/asset-generator/.env` - API keys configuration

## Development Workflow

1. **Primary Development**: Open `client/tycoon_cocos` in Cocos Creator 3.8.7
2. **Voxel Editing**: Use map editor mode with UIEditor interface
3. **UI Design**: Edit in FGUIProject, export to resources/ui/
4. **Asset Generation**: Use asset-generator for new textures/sprites
5. **Testing**: Use Creator preview, check console for debug logs

## Current Implementation Status

### ✅ Implemented
- Complete voxel rendering system with custom shaders
- Map editor with real-time block placement
- FairyGUI-based UI system
- Event-driven architecture
- Resource pack system
- AIGC asset pipeline

### 🚧 In Progress  
- Game logic (property ownership, turns)
- Player movement and animations
- Card system implementation

### 📋 Planned
- Sui blockchain integration
- Move smart contracts
- Multiplayer backend
- DeFi protocol integrations

## Notes for Claude Code

- **请使用中文和用户对话** - Always communicate in Chinese
- **Focus on client development** - Blockchain is future phase
- **Voxel system is core** - Not just UI, but fundamental to gameplay
- **Time is critical** - 黑客松项目，避免过度设计
- **Don't auto-commit** - User will review and commit manually
- **Keep commits concise** - Simple Chinese descriptions
- fix bug的时候尽量kiss原则
- 重构的时候不需要向后兼容，以保持设计架构最优为优先