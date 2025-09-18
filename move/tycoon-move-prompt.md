# Prompt.md — Sui Move 实现规范（Tycoon / 大富翁11风）

> 目标：生成一个 **Sui Move** 包（包名：`tycoon`），支持多人全链对局，采用“**地图模板（静态） × 对局态（动态）**”分层。请按下述接口一次性产出**可编译**的骨架代码与基础逻辑，并附带**Move 单测**。

---

## 0) 包与依赖

- **包名**：`tycoon`
  ```

- **代码结构建议**（可合并模块，但请保持职责清晰）：
  - `sources/types.move`：常量/枚举/错误码/工具
  - `sources/map.move`：地图模板与注册表（静态，不可变）
  - `sources/events.move`：事件定义与 emit
  - `sources/game.move`：共享对局对象与**回合/移动核心**
  - `sources/cards.move`：卡牌目录与效果应用（先做最小集）
  - `sources/admin.move`：模板上链/运维辅助（也可并入 `map.move`）

> 要求：给出**完整源码**，能 `sui move build` 通过；测试可用 `sui move test` 运行。

---

## 1) 核心规则（必须按此语义实现）

### 1.1 回合循环（两阶段）
- **回合开始：状态检查**
  - 若玩家处于**监狱**或**医院**（剩余回合数 > 0），**整回合跳过**（计数 −1），发 `SkipTurnEvent`，切换下家。
- **否则进入两阶段**
  1. **A1 卡牌阶段**：当前玩家可**连续使用任意张卡**（不限数量）。效果可叠加，优先级见 1.3。
  2. **A2 掷骰与逐步移动**：若有“遥控骰”则使用覆盖点数；否则随机（1–6）。对点数 N 执行 **逐步判定**。

### 1.2 “每一步”的判定顺序（严格执行，任何“终止型事件”将结束整段移动，余步作废）
1. **冻结**：若本回合被冻结 → **不移动**，停留在原地并触发“原地**停留事件**”，结束移动。
2. **炸弹 / 狗狗**（检查下一格 `next` 是否这两类机关/NPC）：
   - 移动到 `next`，**直接送医院**（或入惩罚状态），**不触发该格 tile 事件**，余步作废；机关默认**触发即消费**（可配置覆盖）。
3. **路障**（若 `next` 为路障）：
   - 移动到 `next`，**停止移动**（余步清零），并触发该格**停留事件**；路障被消费（可配置）。
4. **正常经过 / 停留**：
   - 非最后一步 → **经过**：仅当该格为 `CARD/LOTTERY` 时触发“发卡/抽奖”；其余不触发。
   - 最后一步 → **停留**：按地块类型触发停留事件（见 1.4）。

> **优先级**：冻结 ＞ 炸弹/狗狗 ＞ 路障 ＞ 经过/停留。  
> **规则**：“经过只触发卡/彩票”，其它地块只在**停留**时触发。

### 1.3 卡牌与 Buff 的优先级（当回合生效）
1) 回合级/持续负面：监狱、医院、冻结  
2) 防御类：免租等  
3) 掷骰相关：遥控骰（覆盖点数）、加减点（如实现）  
4) 路面机关放置：路障/炸弹/狗狗（**每格最多一个**）

### 1.4 Tile 事件（停留 vs 经过）
- **经过**：仅 `CARD/LOTTERY` 触发发卡/抽奖。
- **停留**：
  - `PROPERTY`：无主可买；有主且非自己 → 按公式收过路费（受 Buff/免租影响）。
  - `HOSPITAL/PRISON`：赋予“停留 N 回合”。
  - `CHANCE/BONUS/FEE`：即时加减钱或发卡。
  - `NEWS`：全体或单体的全局事件。
  - `CARD`：停留也可发卡（概率/数量可与“经过”不同）。

### 1.5 方向、顺/逆时针与分叉
- 模板提供 `cw_next[tile]` / `ccw_next[tile]`；分叉节点也**预定义默认出口**。
- 本次移动方向确定顺序：`FORCED_CW/CCW(k)`（来自道具/随机，优先）→ 玩家 `dir_pref`（`AUTO` 视为 `CW`）。
- 可选：一次性“路线意图 RouteIntent”（在分叉时按序选择出口）；未提供则走默认。

---

## 2) 数据模型（分层设计）

### 2.1 `map.move` — 地图模板（静态，不随对局变化）
```move
struct TileStatic has store {
    x: u16, y: u16,
    kind: u8,    // TileKind
    size: u8,    // 1x1 or 2x2
    price: u64,
    base_toll: u64,
    special: u64 // 额外参数位
}

struct MapTemplate has store {
    id: u64, version: u64,
    width: u16, height: u16, tile_count: u64,
    tiles_static: table::Table<u64 /*tile_id*/, TileStatic>,
    adj: table::Table<u64 /*tile_id*/, vector<u64> /*neighbors*/>,
    cw_next: table::Table<u64, u64>,
    ccw_next: table::Table<u64, u64>,
    ring_id: table::Table<u64, u16>,
    ring_idx: table::Table<u64, u32>,
    hospital_ids: vector<u64>,
    prison_ids: vector<u64>,
    shop_ids: vector<u64>,
    news_ids: vector<u64>,
    digest: vector<u8> // 模板摘要哈希
}

struct MapRegistry has key, store { id: UID, templates: table::Table<u64, MapTemplate> }
```
- 入口：
  - `create_registry(&signer): MapRegistry`
  - `publish_template(&mut MapRegistry, MapTemplate)`（只写入，不可修改，保持不可变）
  - `get_template(&MapRegistry, id: u64) -> &MapTemplate`

### 2.2 `types.move` — 常量/枚举/错误
- **枚举（以整数常量表示）**
  - `TileKind`：EMPTY(0)/PROPERTY(1)/HOSPITAL(2)/CHANCE(3)/BONUS(4)/FEE(5)/CARD(6)/NEWS(7)
  - `Size`：1x1/2x2；`Level`：0..4
  - `NpcKind`：BARRIER(20)/BOMB(21)/DOG(22)（最小集先实现这三个）
  - `CardKind`：MOVE_CTRL(1)/BARRIER(2)/BOMB(10)/RENT_FREE(20)/FREEZE(30)
  - `Phase`：ROLL(1)/MOVE(2)/SETTLE(3)/MANAGE(4)/EVENTS(5)/END(6)
  - `DirMode`：AUTO(0)/CW(1)/CCW(2)/FORCED_CW(3)/FORCED_CCW(4)
- **错误码（aborts）**
  - `ERR_NOT_ACTIVE_PLAYER`, `ERR_WRONG_PHASE`, `ERR_NO_TURN_CAP`,
    `ERR_TILE_OCCUPIED_BY_NPC`, `ERR_TEMPLATE_NOT_FOUND`, `ERR_INVALID_MOVE`,
    `ERR_CARD_NOT_OWNED`, `ERR_HAND_LIMIT`, `ERR_CAP_EXPIRED`,
    `ERR_JOIN_FULL`, `ERR_ALREADY_STARTED`, `ERR_GAME_ENDED`,
    `ERR_POS_MISMATCH`, `ERR_NO_SUCH_TILE`, `ERR_UNREACHABLE`

### 2.3 `game.move` — 对局态（动态，可变）
```move
struct Config has store {
    trigger_card_on_pass: bool,
    trigger_lottery_on_pass: bool,
    npc_cap: u16,
    max_players: u8,
    max_turns: option::Option<u64>,
    bomb_to_hospital: bool,
    dog_to_hospital: bool,
    barrier_consumed_on_stop: bool
}

struct Player has store {
    owner: address,
    pos: u64, // tile_id
    cash: u64,
    in_prison_turns: u8,
    in_hospital_turns: u8,
    frozen_until_turn: option::Option<u64>,
    rent_free_until_turn: option::Option<u64>,
    bankrupt: bool,
    cards: table::Table<u16 /*CardKind*/, u64 /*count*/>,
    dir_pref: u8 /*DirMode*/,
    roll_override: option::Option<u8>
}

struct NpcInst has store { kind: u8 /*NpcKind*/, expires_at_turn: option::Option<u64>, consumable: bool }

struct Seat has key { id: UID, game_id: ID, player: address }
struct TurnCap has key { id: UID, game_id: ID, player: address, turn: u64 }

struct Game has key, store {
    id: UID,
    status: u8, // 0=ready,1=active,2=ended
    created_at_ms: u64,
    template_id: u64,
    template_digest: vector<u8>,

    players: table::Table<address, Player>,
    join_order: vector<address>,

    turn: u64,
    active_idx: u8,
    phase: u8,

    owner_of: table::Table<u64 /*tile_id*/, address>,
    level_of: table::Table<u64, u8>,
    npc_on: table::Table<u64, NpcInst>,

    config: Config,
    rng_nonce: u64
}
```

- **不变式**：
  - `|players| ≤ max_players`；`active_idx < |join_order|`
  - `npc_on`：同一 `tile_id` 不允许重复（每格最多一个）
  - `level_of[tile]>0` 时必须存在 `owner_of[tile]`
  - `template_digest` 与注册表中模板一致（创建对局时校验）

### 2.4 `events.move` — 事件（供前端/索引器订阅）
```move
struct RollEvent has drop, store { game: ID, player: address, dice: u8, from: u64, to: u64 }
struct MoveEvent has drop, store { game: ID, player: address, from: u64, to: u64 }
struct TollEvent has drop, store { game: ID, payer: address, owner: address, tile_id: u64, level: u8, amount: u64 }
struct BuyEvent has drop, store { game: ID, buyer: address, tile_id: u64, price: u64 }
struct UpgradeEvent has drop, store { game: ID, owner: address, tile_id: u64, from_lv: u8, to_lv: u8, cost: u64 }
struct CardGainEvent has drop, store { game: ID, player: address, kind: u16, delta: u64 }
struct CardUseEvent has drop, store { game: ID, player: address, kind: u16, target: option::Option<address>, tile_id: option::Option<u64> }
struct NpcSpawnEvent has drop, store { game: ID, tile_id: u64, kind: u8, by_player: option::Option<address> }
struct BombOrDogHitEvent has drop, store { game: ID, player: address, tile_id: u64, kind: u8 }
struct SendToHospitalEvent has drop, store { game: ID, player: address, hospital_tile: u64 }
struct BarrierStopEvent has drop, store { game: ID, player: address, tile_id: u64 }
struct SkipTurnEvent has drop, store { game: ID, player: address, reason: u8 } // 1=prison,2=hospital
struct EndTurnEvent has drop, store { game: ID, player: address, turn: u64 }
```

---

## 3) 入口函数（签名与语义）

> 除工具函数外全部使用 `public entry fun`；实现必要的前置校验（活跃玩家、阶段、TurnCap 等）。

### 3.1 模板注册
- `create_registry(&signer): MapRegistry`
- `publish_template(&mut MapRegistry, MapTemplate)`
- `get_template(&MapRegistry, id: u64) -> &MapTemplate`（只读）

### 3.2 建局 / 入座 / 开局
- `create_game(creator: &signer, reg: &MapRegistry, template_id: u64, cfg: Config): (Game, Seat)`
  - 校验 `template_digest`
- `join(game: &mut Game, player: &signer): Seat`（未开始时加入；写入 `join_order`）
- `start(game: &mut Game /* 可限定房主或全体就绪 */)`

### 3.3 回合令牌
- `mint_turncap(game: &mut Game, seat: &Seat, clock: &Clock): TurnCap`
  - 只发给**当前回合**的活跃玩家；phase 进入 ROLL 前。

### 3.4 卡牌阶段
- `use_card(game: &mut Game, cap: &TurnCap, kind: u16, target: option::Option<address>, tile: option::Option<u64>)`
  - 至少实现：
    - `MOVE_CTRL`：将 `player.roll_override = Some(x)`（x 作为函数参数或在卡内约定）
    - `BARRIER` / `BOMB`：在 `tile` 放置；要求该格**无其他 NPC**，并受 `npc_cap` 限制
    - `RENT_FREE`：设置 `rent_free_until_turn = Some(game.turn)`
    - `FREEZE`：让目标 `frozen_until_turn = Some(game.turn)`（“目标本回合冻结”）

### 3.5 掷骰与逐步移动
- `roll_and_step(game: &mut Game, cap: TurnCap, dir_intent: option::Option<u8 /*DirMode*/>, clock: &Clock)`
  - `dice = player.roll_override.unwrap_or(rand1_6(game, clock))`
  - 对 N 步按 **1.2 判定顺序**逐步执行；产生相应事件
  - **经过**：仅在 `CARD/LOTTERY` 发卡/抽奖
  - **停留**：按地块类型结算（买地/升级/过路费/奖励/费用/新闻/医院等）

### 3.6 结回合
- `end_turn(game: &mut Game, cap: TurnCap)`
  - 清理“当回合” Buff（`roll_override`/`rent_free_until_turn==turn` 等）
  - 推进 `turn` / `active_idx`，`phase` 重置

> **RNG**：提供可替换的 `rand1_6(game, clock): u8`（基于 `rng_nonce` + `Clock::timestamp_ms` 的简易方案）；源码注释说明：生产请替换为可验证随机/预言机。

---

## 4) 经济公式（先给简版实现）

- **过路费**：`toll(level) = base_toll * M[level]`（给出 `M[0..4]` 的合理数组），再乘以 `TileBuff * PlayerBuff`（先设 1.0）。
- **升级成本**：`cost(level) = price * (0.6 + 0.5 * level)`（向下取整）。
- **免租**：`rent_free_until_turn >= current_turn` 时 `toll = 0`。

---

## 5) 并发与性能（实现要点）

- **Game 小而稳**；大映射用 `table::Table`：`owner_of`、`level_of`、`npc_on`、`players`。
- 一次移动仅写：玩家位置、最多 1 个 NPC 表项、（若停留地产）则现金变动/过路费事件。
- **单格仅 1 个 NPC/机关**：使用 `table::contains` 保障。
- 模板只读，来自 `MapRegistry`；对局中不复制大型结构。

---

## 6) 单元测试（tests/*.move，至少 5 个 e2e）

1. **回合跳过**：玩家在医院 2 回合，连续 `mint_turncap → end_turn` 两次，验证两次 `SkipTurnEvent` 与计数递减。
2. **路障停止**：A 放路障，B 掷出 3，第二步命中路障→`BarrierStopEvent`，并触发该格停留事件，余步作废。
3. **炸弹送医**：A 放炸弹，B 掷出 2 命中→`SendToHospitalEvent`，余步作废，**不触发 tile 停留事件**。
4. **经过仅发卡**：连续行走穿过卡片格且非最后一步→仅 `CardGainEvent`；落到卡片格（最后一步）→再次发卡。
5. **遥控骰**：先 `use_card(MOVE_CTRL)` 设为 3，后 `roll_and_step` 的 `dice==3`。

---

## 7) 最小示例地图（用于测试）

- 一个 8 格环：`tile_id 0..7`；其中：`tile 2 = CARD`，`tile 5 = HOSPITAL`，其余为 `PROPERTY`。
- `cw_next[i] = (i+1) % 8`；`ccw_next[i] = (i+7) % 8`。
- `price/base_toll` 给定常量数组。测试中创建一个 `MapRegistry` 并注册该模板。

---

## 8) 可交付物

- 完整可编译的 `sources/*.move` 与 `Move.toml`
- `tests/*.move` 覆盖上面的 5 个用例
- 清晰注释：哪些是占位实现（RNG/更多卡牌/价格系数），哪些是可配置项
- 导出所有关键事件，便于前端/索引器订阅

---

### 实现备注（供代码生成器参考）
- 遵循 Sui 对象模型：`Game/Seat/TurnCap` 使用 `key` 能力；模板注册表 `MapRegistry` 也用 `key`。
- 使用 `0x2`：`object`, `transfer`, `table`, `clock`, `event`。
- 尽量在**内部工具函数**里拆“单步判定”，保持 `roll_and_step` 清晰。
- 注释“冻结/炸弹/狗狗/路障”的**终止语义**与**是否消费**，并受 `Config` 控制。
