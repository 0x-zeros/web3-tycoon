# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web3 Tycoon is a blockchain-based Monopoly game implemented on Sui Network. The Move contracts handle all game logic on-chain including player management, property ownership, card mechanics, NPCs, and economic systems.

## Development Commands

### Building and Testing
```bash
# Build the Move package
sui move build

# Run all tests
sui move test

# Run specific test
sui move test --filter <test_name>

# Run tests with coverage
sui move test --coverage

# Build without fetching dependencies
sui move build --skip-fetch-latest-git-deps

# Check compilation errors
sui move build 2>&1 | grep "error\[E"

# Check warnings
sui move build 2>&1 | grep "warning\[W"
```

### Deployment
```bash
# Deploy to testnet
sui client publish --gas-budget 500000000

# Deploy to specific environment
sui client publish --gas-budget 500000000 --env <env_name>
```

## Architecture Overview

### Module Structure

```
sources/
├── tycoon.move (296 lines)   # Package init, GameData container, global configs
├── admin.move (372 lines)    # AdminCap, map/card registration
├── types.move (124 lines)    # All type constants and helper functions
├── map.move (710 lines)      # Map templates, tiles, properties, pathfinding
├── cards.move (606 lines)    # Card catalog, draw mechanics, player inventory
├── events.move (511 lines)   # Aggregated event system
└── game.move (3527 lines)    # Core game logic, turn system, player management
```

### Recent Architectural Change: Tile/Property Separation

**IMPORTANT**: The codebase recently underwent a major refactoring to separate Tiles (navigation nodes) from Properties (economic entities):

- **Tiles**: Pure 1x1 path nodes for player movement and NPC placement
  - Only contains `npc_on` field for NPC tracking
  - Used for pathfinding and movement logic

- **Properties**: Separate economic entities that can span multiple tiles
  - Contains `owner` and `level` fields
  - Linked to tiles via `property_id` in TileStatic
  - Multiple tiles can share same `property_id` (e.g., large buildings with multiple entrances)
  - `NO_PROPERTY` constant (0xFFFF) indicates non-property tiles

Key structures:
```move
// In map.move
struct TileStatic {
    property_id: u16,  // NO_PROPERTY (65535) for non-property tiles
    // ... navigation fields
}

struct PropertyStatic {
    kind: u8,
    size: u8,
    price: u64,
    base_toll: u64
}

// In game.move
struct Tile {
    npc_on: u8  // Only NPC tracking
}

struct Property {
    owner: u8,  // NO_OWNER (255) for unowned
    level: u8   // 0-5 levels
}

struct Game {
    tiles: vector<Tile>,
    properties: vector<Property>,
    // ...
}
```

### Core Design Patterns

#### 1. Object Capabilities Pattern
- **AdminCap**: One-time witness pattern, controls admin functions
- **Seat**: Player's proof of participation, required for all game actions
- **GameData**: Shared object containing all game configuration

#### 2. Aggregated Event System
Instead of many granular events, uses aggregated events to reduce indexing complexity:
- **RollAndStepActionEvent**: Complete movement sequence with all effects
- **UseCardActionEvent**: Card usage with all consequences
- Events collect CashDelta, StepEffect, CardDrawItem details

#### 3. Turn System Flow
```
roll_and_step → pending_decision → resolve_decision → end_turn
                     ↓                    ↓
              DECISION_BUY_PROPERTY    buy_property
              DECISION_UPGRADE_PROPERTY upgrade_property
              DECISION_PAY_RENT        decide_rent_payment
```

#### 4. Buff System
Buffs use exclusive timing with `first_inactive_turn`:
- Active when: `current_turn < first_inactive_turn`
- Common buffs: MOVE_CTRL (dice control), FROZEN (skip turn), RENT_FREE (免租)

### Key Implementation Details

#### Property Price Calculation
Properties use a complex pricing model with:
- Base price from PropertyStatic
- Price index based on game round (物价指数)
- Level-based multipliers for upgrades
- Special handling for large properties vs small properties

#### Chain Property Detection
Adjacent properties owned by same player form chains:
- Uses tile adjacency (still tile-based after refactoring)
- Multiplies toll based on chain length
- Only applies to small (1x1) properties

#### NPC System
NPCs spawn on tiles and affect movement:
- Barriers: Stop movement
- Bombs: Send to hospital, consume NPC
- Dogs: Force directional change
- Beneficial NPCs: Land God, Wealth God, Fortune God
- Spawn weights configured in GameData

#### Pathfinding
Two movement modes:
- Sequential: Follow cw/ccw connections
- Adjacency: BFS-based pathfinding for complex maps
- Path choices provided by client for forks

### Testing Approach

Test files in `tests/`:
- `utils.move`: Helper functions for test setup
- `game_basic.move`: Core game flow
- `cards_basic.move`: Card mechanics
- `movement_npc.move`: Movement and NPC interactions
- `economy.move`: Economic mechanics and bankruptcy

### Error Code Ranges
- 1xxx: Player errors (e.g., 1001 EPlayerNotFound)
- 2xxx: Tile/property errors (e.g., 2001 ETileOccupiedByNpc)
- 3xxx: Map errors (e.g., 3001 ETemplateNotFound)
- 4xxx: Movement errors (e.g., 4001 EInvalidPath)
- 5xxx: Card errors (e.g., 5001 ECardNotFound)
- 6xxx: Game state errors (e.g., 6001 EGameNotActive)
- 7xxx: Economic errors (e.g., 7001 EInsufficientFunds)
- 8xxx: NPC errors (e.g., 8001 ENpcNotFound)

### Common Development Tasks

#### Adding New Tile Types
1. Add constant in `types.move` (e.g., `TILE_NEW_TYPE()`)
2. Handle in `handle_tile_stop` in `game.move`
3. Update event types in `events.move` if needed

#### Adding New Cards
1. Add card type in `types.move` (e.g., `CARD_NEW()`)
2. Register in `cards.move` catalog
3. Implement effect in `use_card` function in `game.move`

#### Modifying Map Templates
1. Use `admin::register_template` with AdminCap
2. Define tiles with proper property_id assignments
3. Set up navigation (cw/ccw or adj connections)

### Current Limitations and TODOs

1. **Incomplete Features**:
   - Lottery system (TILE_LOTTERY)
   - Chance events (TILE_CHANCE)
   - News events (TILE_NEWS)
   - Shop functionality (TILE_SHOP)

2. **Gas Optimization Needed**:
   - game.move is very large (3527 lines)
   - Consider splitting into smaller modules

3. **Pathfinding Simplifications**:
   - BFS returns simplified results for hackathon timeline
   - Advanced optimizations available but not implemented

### Module Dependencies

```
tycoon (init, GameData container)
    ↓
types (constants, helpers)
    ↓
admin ← map (templates, tiles, properties)
    ↓     ↓
cards   events (aggregated events)
    ↓     ↓
    game (orchestrates everything)
```

### Important Notes

- Chinese comments explain complex business logic
- English used for function signatures and struct fields
- NO_OWNER constant is 255 (u8 max)
- NO_PROPERTY constant is 65535 (u16 max)
- Price calculations use ×100 to avoid floating point
- All monetary values in smallest unit (no decimals)