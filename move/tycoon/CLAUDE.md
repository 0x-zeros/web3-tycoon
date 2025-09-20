# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web3 Tycoon Move contracts implement a blockchain-based Monopoly game on Sui Network. The contracts handle game logic, player management, property ownership, card mechanics, and economic systems entirely on-chain.

## Development Commands

### Building and Testing
```bash
# Build the Move package
sui move build

# Run all tests
sui move test

# Run specific test file
sui move test --filter <test_name>

# Run tests with coverage
sui move test --coverage

# Build with specific network config
sui move build --skip-fetch-latest-git-deps
```

### Deployment
```bash
# Deploy to testnet
sui client publish --gas-budget 500000000

# Deploy to specific environment
sui client publish --gas-budget 500000000 --env <env_name>
```

### Development Tools
```bash
# Check for linter warnings
sui move build 2>&1 | grep warning

# Format Move code (if formatter available)
sui move format

# Generate documentation
sui move doc
```

## Architecture Overview

### Module Structure

The game is organized into focused modules with clear separation of concerns:

```
sources/
├── tycoon.move      # Package definition and init
├── admin.move       # Admin capabilities and map registry management
├── types.move       # All type constants and helper functions
├── map.move         # Map templates, tiles, and pathfinding logic
├── cards.move       # Card catalog and card mechanics
├── events.move      # Event definitions and aggregated event system
└── game.move        # Core game logic, player management, turn system
```

### Core Design Patterns

#### 1. Object Capabilities Pattern
- **AdminCap**: Controls map registration and admin functions
- **Seat**: Player's proof of joining a game
- **TurnCap**: Authorization to take actions during a turn
- Each capability is a unique object that provides specific permissions

#### 2. Aggregated Event System
Instead of emitting many granular events, the system uses two main aggregated events:
- **UseCardActionEvent**: Captures all effects of using a card
- **RollAndStepActionEvent**: Captures entire movement sequence with all side effects

This reduces indexing complexity and provides complete action context in single events.

#### 3. Buff System Architecture
Unified vector-based buff storage with exclusive semantics:
```move
struct BuffEntry {
    kind: u8,                  // Buff type from types module
    first_inactive_turn: u64,  // Exclusive: buff active when current_turn < first_inactive_turn
    value: u64                 // Payload (e.g., dice override value)
}
```

#### 4. Map System
- **MapTemplate**: Immutable map definition with tiles and connections
- **MapRegistry**: Shared object storing all registered map templates
- Supports both sequential (cw/ccw) and adjacency-based pathfinding
- Tiles have types (property, hospital, prison, etc.) with specific behaviors

### Key Game Mechanics

#### Turn System
1. Player mints a TurnCap when it's their turn
2. TurnCap authorizes actions (roll dice, use cards, buy properties)
3. Turn ends by consuming the TurnCap
4. Game automatically advances to next non-bankrupt player

#### Property System
- Properties tracked in `owner_of` and `level_of` tables
- Owner index (`owner_index`) for efficient player property lookup
- Automatic toll collection with rent-free buff support
- Property upgrades increase toll exponentially

#### Movement System
- Supports directional (clockwise/counter-clockwise) movement
- BFS-based adjacency pathfinding for complex maps
- NPC obstacles (barriers, bombs, dogs) affect movement
- Step-by-step movement with events at each tile

#### Economic System
- Bankruptcy handling with property release
- Cash transfer tracking via CashDelta in events
- Configurable starting cash and property prices

### Testing Strategy

Test files in `tests/` provide comprehensive coverage:
- **utils.move**: Test helpers for game setup and assertions
- **game_basic.move**: Core game flow tests
- **cards_basic.move**: Card usage scenarios
- **movement_npc.move**: Movement and NPC interaction tests
- **economy.move**: Economic mechanics and bankruptcy

Test helpers follow naming convention `test_*` or `assert_*` for clarity.

### Code Conventions

#### Naming
- Constants: `UPPER_SNAKE_CASE` (e.g., `BUFF_RENT_FREE`)
- Functions: `snake_case` (e.g., `apply_buff`)
- Structs: `PascalCase` (e.g., `BuffEntry`)
- Test functions: `test_<scenario>` (e.g., `test_bankruptcy_flow`)

#### Error Codes
Organized by category with clear prefixes:
- 1xxx: Player-related errors
- 2xxx: Tile/property errors
- 3xxx: Map template errors
- 4xxx: Movement errors
- 5xxx: Card errors
- 6xxx: Game state errors
- 7xxx: Economic errors
- 8xxx: NPC errors

#### Comments
- Chinese comments for complex logic explanation
- English for struct fields and function signatures
- TODO/FIXME markers for known issues

### Important Implementation Details

#### Buff Timing
All buffs use exclusive `first_inactive_turn` semantics:
- `first_inactive_turn = turn + 1`: Active this turn only
- `first_inactive_turn = turn + 2`: Active this and next turn
- Buffs expire when `current_turn >= first_inactive_turn`

#### Event Collection Pattern
Complex operations use collector pattern:
1. Create mutable vectors for collecting events
2. Pass collectors through operation functions
3. Emit single aggregated event at the end

#### Table vs Vector Trade-offs
- **Tables**: Used for sparse mappings (owner_of, level_of, players)
- **Vectors**: Used for ordered data (join_order, buffs)
- Consider gas costs when choosing between them

### Current Limitations

1. **Simplifications for hackathon timeline**:
   - BFS pathfinding returns simplified results
   - Lottery/chance tiles have TODO markers
   - Some card effects not fully implemented

2. **Gas optimization opportunities**:
   - Module splitting suggested for game.move (>1900 lines)
   - Event aggregation reduces emissions but increases computation

3. **Known TODOs**:
   - See `/Users/zero/dev/sui/web3-tycoon/move/仍需关注.md` for non-blocking improvements
   - Lottery system implementation pending
   - Advanced pathfinding optimizations available

### Module Dependencies

```
tycoon (package init)
    ↓
types (constants)
    ↓
admin → map
    ↓     ↓
cards   events
    ↓     ↓
    game (orchestrates all)
```

Circular dependencies are avoided through careful module organization.