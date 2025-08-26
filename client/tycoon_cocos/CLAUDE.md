# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains a shooting game called "射击达人" (Shooting Expert) that is being migrated from Cocos Creator 2.x to 3.x. There are two main directories:

- `fyf_cocos/` - Original game source code using Cocos Creator 2.x (JavaScript)
- `sjdr_cocos_v3/` - Migrated version using Cocos Creator 3.8 (TypeScript) - **this is the active project**

The migration from 2.x to 3.x involves significant API changes and language migration from JavaScript to TypeScript.

## Development Environment

**Primary Project**: Always work in `sjdr_cocos_v3/` directory unless specifically asked to reference the original code in `fyf_cocos/`.

The project uses:
- Cocos Creator 3.8.7
- TypeScript
- Import-2x plugin for migration assistance

## Critical API Migration Patterns

When working with this codebase, be aware of these key API changes from Cocos 2.x to 3.x:

### Import System
- **2.x**: `const config = require('config')` and global `cc` namespace  
- **3.x**: `import { _decorator, Component, find, director } from 'cc'`

### Component Definition
- **2.x**: `cc.Class({ extends: cc.Component })`
- **3.x**: `@ccclass('ClassName') export class ClassName extends Component`

### Node Properties
- **2.x**: `this.node.width`, `this.node.height`
- **3.x**: `this.node.getContentSize().width`, `this.node.getContentSize().height`

### Vector Creation
- **2.x**: `cc.v2(x, y)`
- **3.x**: `v2(x, y)` (must import from 'cc')

### Node Finding
- **2.x**: `cc.find(path, parent)`
- **3.x**: `find(path, parent)` (must import from 'cc')

### Game Director
- **2.x**: `cc.game.addPersistRootNode()`
- **3.x**: `director.addPersistRootNode()`

## Project Architecture

### Core System Components
- `Game.ts` - Main game controller and global initialization
- `Player.ts` - Player data and progression management  
- `PlayScene.ts` - Main gameplay scene controller

### Scene Management
The game uses a scene-based architecture located in `assets/scripts/scene/`:
- `Scene.ts` - Base scene management
- `play/` - Gameplay scenes (Play, Playground, Actor management)
- `Award.ts`, `Pause.ts`, `Setting.ts` - UI scenes
- `loading/Loading.ts` - Loading screen

### Game Systems
- **Actor System**: `scene/play/Actor.ts` + `actorManager.ts` - Enemy/object management
- **Skill System**: `scene/play/skill.ts` + `skillManager.ts` - Player abilities
- **Physics**: `common/physics.ts` + `common/math.ts` - Custom physics and math utilities
- **Audio**: `common/AudioManager.ts` - Sound management
- **Assets**: `common/Asset.ts` + `common/Pool.ts` - Resource loading and pooling

### Global Game State
The project uses a global `game` object (defined in `Game.ts`) that contains:
- Configuration data
- Scene management
- Asset management  
- Audio system references
- Player data

## Language and Localization

The project includes Chinese language support with:
- Comments and commit messages should be in Chinese
- Code should be in English
- Internationalization system in `assets/scripts/i18n/`

## Common Issues and Patterns

When fixing migration issues, look for:
1. Incorrect node size access (`node.width` vs `getContentSize().width`)
2. Missing imports from 'cc' module
3. Old `cc.*` API usage that needs updating
4. Component references that need TypeScript typing

## File Structure Notes

- Game configuration: `assets/data/config.ts`
- Third-party libraries: `assets/scripts/3rd/` (Tween, underscore)
- Shader system: `assets/scripts/shader/`
- Common utilities: `assets/scripts/common/`

## Development Context

This is an active migration project where the 2.x version serves as reference but all development should target the 3.x TypeScript version in `sjdr_cocos_v3/`. The migration plan and known issues are documented in `bug_fix_plan_fixed.md`.