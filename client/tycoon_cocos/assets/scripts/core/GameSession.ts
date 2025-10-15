/**
 * GameSession类 - 游戏会话管理器
 *
 * 对应Move端的Game对象，管理一局游戏的核心状态和流程
 *
 * ==================== 重要架构说明 ====================
 *
 * 【Game 对象 vs GameSession 的使用】
 *
 * 1. Game 对象（sui/types/game.ts）
 *    - 只在游戏开始时查询一次（SuiManager.loadGameScene）
 *    - 用于初始化 GameSession（loadFromMoveGame）
 *    - 之后除了各种 ID（gameId, templateMapId 等），其他字段都会过时
 *    - **不应该**在游戏过程中重新查询和使用
 *
 * 2. GameSession（本类）
 *    - 游戏过程中的**唯一权威数据源**
 *    - 通过链上事件保持同步：
 *      * RollAndStepActionEvent → 更新 round, turn, 玩家位置/现金等
 *      * UseCardActionEvent → 更新 buffs, cards 等
 *      * 其他事件...
 *    - 所有 UI 组件和游戏逻辑都应该使用 GameSession 的数据
 *    - 所有游戏交易（buildXxxTx）都从 GameSession 获取参数
 *
 * 3. 为什么不重新查询 Game？
 *    - 减少 RPC 请求，降低延迟
 *    - 事件已包含所有变化的数据，无需重复查询
 *    - 事件驱动更新更实时，避免查询延迟导致的状态不一致
 *
 * 【正确的使用方式】
 *
 * ✅ 正确：
 *   ```typescript
 *   const session = Blackboard.instance.get("currentGameSession");
 *   const gameId = session.getGameId();
 *   const round = session.getRound();
 *   const player = session.getMyPlayer();
 *   SuiManager.instance.rollAndStep(session, path);
 *   ```
 *
 * ❌ 错误：
 *   ```typescript
 *   const game = await SuiManager.instance.getGameState(gameId);  // 不要这样做
 *   const round = game.round;  // game 的数据已经过时
 *   ```
 *
 * 【事件驱动更新】
 *
 * GameSession 的数据更新流程：
 *   链上事件 → EventIndexer → Handler → session.setXxx()
 *
 * 例如：
 *   - RollAndStepActionEvent → session.setRound(), session.setTurn()
 *   - UseCardActionEvent → session 更新 player buffs/cards
 *
 * ==================================================
 *
 * 职责：
 * - 游戏状态管理（status, round, turn）
 * - 玩家列表管理（对应Move的players vector）
 * - NPC管理（对应Move的npc_on Table）
 * - 回合控制和决策管理
 * - Seat 缓存（当前游戏的座位）
 *
 * 不包含：
 * - Map相关的tile、building管理（由GameMap负责）
 *
 * @author Web3 Tycoon Team
 * @version 2.0.0
 */

import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';
import type { Game, Player as MovePlayer, NpcInst, NpcInst as MoveNpcInst, Tile, Seat } from '../sui/types/game';
import type { MapTemplate } from '../sui/types/map';
import { GameStatus, PendingDecision, INVALID_TILE_ID, NO_OWNER } from '../sui/types/constants';
import { Player } from '../role/Player';
import { NPC } from '../role/NPC';
import { GameData } from '../sui/models/GameData';
import { GameTile } from '../game/models/GameTile';
import { GameBuilding } from '../game/models/GameBuilding';
import { MapManager } from '../map/MapManager';
import { SuiManager } from '../sui/managers/SuiManager';
import { IdFormatter } from '../ui/utils/IdFormatter';
import { Vec3 } from 'cc';

/**
 * 待决策信息接口
 */
export interface PendingDecisionInfo {
    /** 决策类型 */
    type: PendingDecision;
    /** 相关的地块ID */
    tileId: number;
    /** 相关金额（如租金、购买价格等） */
    amount: bigint;
}

/**
 * GameSession 类
 * 对应 Move 端的 Game 结构
 */
export class GameSession {

    // ========================= 游戏基础信息 =========================

    /** 游戏ID */
    private _gameId: string = '';

    /** 游戏状态 */
    private _status: GameStatus = GameStatus.READY;

    /** 地图模板ID */
    private _templateMapId: string = '';

    /** 当前游戏的 Seat（我的座位） */
    private _mySeat: Seat | null = null;

    // ========================= 回合系统 =========================

    /** 当前轮次（所有玩家各行动一次为一轮） */
    private _round: number = 0;

    /** 轮内回合（0到player_count-1） */
    private _turn: number = 0;

    /** 当前活跃玩家索引 */
    private _activePlayerIndex: number = 0;

    /** 是否已掷骰 */
    private _hasRolled: boolean = false;

    // ========================= 玩家和NPC =========================

    /** 玩家列表（对应Move的players vector） */
    private _players: Player[] = [];

    /** 我的玩家（当前客户端连接的玩家） */
    private _myPlayer: Player | null = null;

    /** 我的玩家索引 */
    private _myPlayerIndex: number = -1;

    /** NPC列表 */
    private _npcs: NPC[] = [];

    // ========================= 待决策状态 =========================

    /** 待决策信息 */
    private _pendingDecision: PendingDecisionInfo | null = null;

    // ========================= 地图相关数据 =========================

    /** 地图模板 */
    private _mapTemplate: MapTemplate | null = null;

    /** GameData 配置 */
    private _gameData: GameData | null = null;

    /** Tile 逻辑数据列表 */
    private _tiles: GameTile[] = [];

    /** Building 逻辑数据列表 */
    private _buildings: GameBuilding[] = [];

    /** GameMap 组件引用 */
    private _gameMap: any = null;  // GameMap 类型（避免循环依赖）

    // ========================= 配置 =========================

    /** 最大轮数（0表示无限） */
    private _maxRounds: number = 0;

    /** 物价提升天数 */
    private _priceRiseDays: number = 15;

    /** 胜利者地址 */
    private _winner: string | null = null;

    // ========================= 构造和初始化 =========================

    constructor() {
        console.log('[GameSession] GameSession 实例创建');
    }

    /**
     * 从 Move Game 对象加载数据
     * @param game Move 端的 Game 对象
     * @param template MapTemplate 数据
     * @param gameData GameData 配置数据
     */
    public async loadFromMoveGame(
        game: Game,
        template: MapTemplate,
        gameData: GameData
    ): Promise<void> {
        console.log('[GameSession] 从 Move 数据加载游戏会话');
        console.log('  Game ID:', game.id);
        // console.log('  Template tiles:', template.tiles_static.size);
        // console.log('  Template buildings:', template.buildings_static.size);


        // 1. 保存引用
        this._mapTemplate = template;
        this._gameData = gameData;

        // 2. 基础信息
        this._gameId = game.id;
        this._status = game.status;
        this._templateMapId = game.template_map_id;

        // 3. 回合系统
        this._round = game.round;
        this._turn = game.turn;
        this._activePlayerIndex = game.active_idx;
        this._hasRolled = game.has_rolled;

        // 4. 配置
        this._maxRounds = game.max_rounds;
        this._priceRiseDays = game.price_rise_days;
        this._winner = game.winner || null;

        // 5. 合并地图数据
        console.log('[GameSession] 合并地图数据...');
        this._tiles = this.mergeTiles(template, game);
        this._buildings = this.mergeBuildings(template, game);
        console.log(`[GameSession] 合并完成：${this._tiles.length} tiles, ${this._buildings.length} buildings`);

        // 6. 加载玩家和 NPC
        this.loadPlayers(game.players);
        this.loadNPCs(game.npc_on, game.tiles);

        // 7. 识别我的玩家（通过当前连接的地址）
        this.identifyMyPlayer();

        // 8. 加载待决策状态
        this.loadPendingDecision(game);


        //数据加载完成
        console.log('[GameSession] ');
        // 立即发送 GameStart 事件，触发 -> UIInGame 的切换
        // UIInGame 在GameSession 数据填充好了再开始初始化（因为UI里很多地方都需要GameSession的数据）
        console.log('[GameSession] 数据加载完成， 发送 GameStart 事件，触发 -> UIInGame 的切换。');
        console.log('[GameSession]  GameSession:', this);
        console.log('[GameSession]  Game:', game);
        console.log('[GameSession]  Template:', template);
        console.log('[GameSession]  GameData:', gameData);
        
        EventBus.emit(EventTypes.Game.GameStart, {
            mode: 'play',
            source: 'chain_game',
        });

        // 8. 加载游戏地图（调用 MapManager）
        console.log('[GameSession] 开始加载游戏地图...');
        await this.loadGameMap();

        console.log('[GameSession] 游戏会话加载完成', {
            gameId: this._gameId,
            status: this._status,
            round: this._round,
            turn: this._turn,
            playerCount: this._players.length,
            tileCount: this._tiles.length,
            buildingCount: this._buildings.length,
            npcCount: this._npcs.length
        });

        // 9. 触发加载完成事件
        EventBus.emit(EventTypes.Game.SessionLoaded, {
            session: this,
            game: game
        });

        // 10. 刷新玩家资产（获取最新 Seat）
        console.log('[GameSession] 刷新玩家资产...');
        const { SuiManager } = await import('../sui/managers/SuiManager');
        await SuiManager.instance.loadPlayerAssets();
        console.log('[GameSession] 玩家资产已刷新');

        // 11. 缓存当前游戏的 Seat
        const playerAssets = SuiManager.instance.playerAssets;
        if (playerAssets) {
            this._mySeat = playerAssets.findSeatByGame(this._gameId);

            if (this._mySeat) {
                console.log('[GameSession] 当前游戏 Seat 已缓存:', this._mySeat.id);
            } else {
                console.warn('[GameSession] 未找到当前游戏的 Seat');
            }
        }
    }

    /**
     * 加载玩家列表
     */
    private loadPlayers(movePlayers: MovePlayer[]): void {
        // 清空现有玩家
        this._players = [];

        // 创建或更新玩家对象
        movePlayers.forEach((movePlayer, index) => {
            const player = new Player();
            player.loadFromMovePlayer(movePlayer, index);
            this._players.push(player);
        });

        console.log(`[GameSession] 加载 ${this._players.length} 个玩家`);
    }

    /**
     * 加载NPC
     */
    private loadNPCs(npcList: NpcInst[], tiles: Tile[]): void {
        // 清空现有NPC
        this._npcs = [];

        tiles.forEach((tile, tileId) => {
            const npcOn = tile.npc_on;  //地块上的NPC索引（65535表示无NPC，其他值为game.npc_on的index
            if (npcOn !== 65535 && npcOn < npcList.length) {
                const moveNpc = npcList[npcOn];
                if (moveNpc) {
                    const npc = new NPC();
                    npc.loadFromMoveNPC(moveNpc, tileId);  // ✅ 传入 tileId
                    this._npcs.push(npc);  // ✅ 使用 push
                }
            }
        });

        console.log(`[GameSession] 加载 ${this._npcs.length} 个NPC`);
    }

    /**
     * 识别我的玩家（通过当前连接的地址）
     */
    private identifyMyPlayer(): void {
        const currentAddress = SuiManager.instance.currentAddress;

        if (!currentAddress) {
            console.warn('[GameSession] No current address, cannot identify my player');
            return;
        }

        // 【调试日志】详细输出玩家识别过程
        console.log('[GameSession] identifyMyPlayer DEBUG:', {
            currentAddress: currentAddress,
            currentAddressShort: IdFormatter.shortenAddress(currentAddress),
            playerCount: this._players.length,
            players: this._players.map((p, i) => ({
                index: i,
                address: p.getOwner(),
                addressShort: IdFormatter.shortenAddress(p.getOwner()),
                match: p.getOwner() === currentAddress
            }))
        });

        // 查找匹配地址的玩家
        const myPlayerIndex = this._players.findIndex(p => p.getOwner() === currentAddress);

        if (myPlayerIndex >= 0) {
            this._myPlayer = this._players[myPlayerIndex];
            this._myPlayerIndex = myPlayerIndex;

            console.log('[GameSession] My player identified:');
            console.log('  Player index:', myPlayerIndex);
            console.log('  Address:', IdFormatter.shortenAddress(currentAddress));
        } else {
            console.warn('[GameSession] My player not found in game');
            console.warn('  Current address:', currentAddress);
            console.warn('  Game players:', this._players.map(p => p.getOwner()));
        }
    }

    /**
     * 加载待决策状态
     */
    private loadPendingDecision(game: Game): void {
        if (game.pending_decision !== PendingDecision.NONE) {
            // 使用 setPendingDecision()，会自动发射 DecisionPending 事件
            this.setPendingDecision({
                type: game.pending_decision,
                tileId: game.decision_tile,
                amount: game.decision_amount
            });
        } else {
            this._pendingDecision = null;
        }
    }

    // ========================= 地图数据合并 =========================

    /**
     * 合并 Tiles 数据
     */
    private mergeTiles(template: MapTemplate, game: Game): GameTile[] {
        const tiles: GameTile[] = [];

        template.tiles_static.forEach((tileStatic, tileId) => {
            const gameTile = game.tiles[tileId];
            const tile = GameTile.merge(tileStatic, gameTile, tileId);
            tiles.push(tile);
        });

        console.log(`[GameSession] 合并了 ${tiles.length} 个 Tiles`);
        return tiles;
    }

    /**
     * 合并 Buildings 数据
     */
    private mergeBuildings(template: MapTemplate, game: Game): GameBuilding[] {
        const buildings: GameBuilding[] = [];

        template.buildings_static.forEach((buildingStatic, buildingId) => {
            const gameBuilding = game.buildings[buildingId];
            const building = GameBuilding.merge(
                buildingStatic,
                gameBuilding,
                buildingId,
                template
            );
            buildings.push(building);
        });

        console.log(`[GameSession] 合并了 ${buildings.length} 个 Buildings`);
        return buildings;
    }

    /**
     * 加载游戏地图（调用 MapManager）
     */
    private async loadGameMap(): Promise<void> {
        console.log('[GameSession] 加载游戏地图...');

        // // 动态导入 MapManager（避免循环依赖）
        // const { MapManager } = await import('../map/MapManager');
        const mapManager = MapManager.getInstance();

        if (!mapManager) {
            throw new Error('[GameSession] MapManager not found');
        }

        // 调用 MapManager 创建并加载地图
        this._gameMap = await mapManager.loadGameMapFromSession(this);

        console.log('[GameSession] 游戏地图加载完成');

        // 初始化 Tile 顶部中心点（从 GameMap 的 tile 节点获取）
        this._initializeTileCenters();
    }

    /**
     * 初始化 Tile 顶部中心点
     * 从 GameMap 的 tile 节点获取世界坐标并缓存
     */
    private _initializeTileCenters(): void {
        if (!this._gameMap) {
            console.warn('[GameSession] GameMap not found, skip tile centers initialization');
            return;
        }

        // 遍历所有 tiles
        this._tiles.forEach((gameTile, tileId) => {
            // 从 GameMap 获取 tile 节点的世界坐标
            const tileNode = this._gameMap.getTileNode?.(tileId);
            if (tileNode) {
                const worldPos = tileNode.getWorldPosition().clone();
                // Voxel block 的 position 是角落，中心点需要 +0.5
                worldPos.x += 0.5;  // X 轴中心
                worldPos.y += 0.5;  // Y 轴顶部
                worldPos.z += 0.5;  // Z 轴中心
                gameTile.setWorldCenter(worldPos);
            } else {
                // Fallback：使用 tile 的 x, y 坐标计算（假设每个 tile 是 1x1）
                const worldPos = new Vec3(
                    gameTile.x + 0.5,  // X 中心
                    0.5,               // Y 顶部
                    gameTile.y + 0.5   // Z 中心
                );
                gameTile.setWorldCenter(worldPos);
                console.warn(`[GameSession] Tile ${tileId} 节点未找到，使用计算坐标`);
            }
        });

        console.log(`[GameSession] 已初始化 ${this._tiles.length} 个 Tile 的顶部中心点`);
    }

    // ========================= 回合控制 =========================

    /**
     * 开始回合
     */
    public startTurn(): void {
        console.log(`[GameSession] 开始回合 (Round ${this._round}, Turn ${this._turn})`);

        const activePlayer = this.getActivePlayer();
        if (!activePlayer) {
            console.warn('[GameSession] 无活跃玩家');
            return;
        }

        // 重置回合状态
        this._hasRolled = false;

        // 触发回合开始事件
        EventBus.emit(EventTypes.Game.TurnStart, {
            session: this,
            player: activePlayer,
            round: this._round,
            turn: this._turn
        });
    }

    /**
     * 结束回合
     */
    public endTurn(): void {
        console.log(`[GameSession] 结束回合 (Round ${this._round}, Turn ${this._turn})`);

        const activePlayer = this.getActivePlayer();

        // 触发回合结束事件
        EventBus.emit(EventTypes.Game.TurnEnd, {
            session: this,
            player: activePlayer,
            round: this._round,
            turn: this._turn
        });

        // 进入下一个玩家回合（在链上交易后由 loadFromMoveGame 更新）
    }

    /**
     * 切换到下一个玩家（本地预测，实际以链上为准）
     *
     * @deprecated 不应该使用本地预测，容易导致状态不一致
     *             应该通过事件同步 Move 端的状态，使用 setRound() 和 setTurn()
     */
    public nextPlayer(): void {
        console.warn('[GameSession] nextPlayer() is deprecated, use setRound()/setTurn() with chain event data');

        const playerCount = this._players.length;
        if (playerCount === 0) return;

        // 使用 setTurn() 统一处理 turn、round、activePlayerIndex 和 hasRolled
        const nextTurn = this._turn + 1;
        this.setTurn(nextTurn);

        console.log(`[GameSession] 切换到下一个玩家: Player ${this._activePlayerIndex}`);
    }

    /**
     * 设置已掷骰状态
     */
    public setRolled(rolled: boolean): void {
        this._hasRolled = rolled;
    }

    /**
     * 设置轮次（只在有变化时触发事件）
     *
     * @param round 新的轮次
     */
    public setRound(round: number): void {
        if (this._round === round) {
            return;  // 无变化，直接返回
        }

        const oldRound = this._round;
        this._round = round;

        console.log(`[GameSession] 轮次变化: ${oldRound} -> ${round}`);

        EventBus.emit(EventTypes.Game.RoundChanged, {
            session: this,
            oldRound,
            newRound: round
        });
    }

    /**
     * 设置轮内回合（只在有变化时触发事件）
     *
     * @param turn 新的轮内回合（0 到 player_count-1）
     */
    public setTurn(turn: number): void {
        const playerCount = this._players.length;

        // 安全检查：如果没有玩家，直接返回
        if (playerCount === 0) {
            console.warn('[GameSession] Cannot set turn: no players in game');
            return;
        }

        // 检测是否会发生轮次切换（turn >= playerCount 表示会进入下一轮）
        const originalTurn = turn;

        // 关键：对玩家数量取模，确保 turn 在 [0, playerCount) 范围内
        // 匹配 Move 合约的 advance_turn 逻辑：game.active_idx = ((game.active_idx + 1) % player_count)
        turn = turn % playerCount;

        // 匹配 Move 合约逻辑：if (game.active_idx == 0) { game.round++; }
        // 如果取模后回到0（且原值 >= playerCount），说明进入新一轮
        if (turn === 0 && originalTurn >= playerCount) {
            console.log(`[GameSession] 检测到轮次切换 (turn从${originalTurn}变为${turn})`);
            this.setRound(this._round + 1);
        }

        if (this._turn === turn && this._activePlayerIndex === turn) {
            return;  // 无变化，直接返回
        }

        const oldTurn = this._turn;
        const oldActiveIdx = this._activePlayerIndex;

        this._turn = turn;
        this._activePlayerIndex = turn;  // activePlayerIndex 就是 turn
        this._hasRolled = false;  // 新回合重置掷骰状态

        console.log(`[GameSession] 回合变化: Turn ${oldTurn} -> ${turn}, ActivePlayer: ${oldActiveIdx} -> ${turn}`);

        const activePlayer = this.getActivePlayer();

        EventBus.emit(EventTypes.Game.TurnChanged, {
            session: this,
            oldPlayerIndex: oldActiveIdx,
            newPlayerIndex: turn,
            activePlayer: activePlayer,
            isMyTurn: this.isMyTurn()
        });
    }

    // ========================= 决策管理 =========================

    /**
     * 设置待决策状态
     */
    public setPendingDecision(decision: PendingDecisionInfo | null): void {
        this._pendingDecision = decision;

        if (decision) {
            console.log('[GameSession] 设置待决策', decision);
            EventBus.emit(EventTypes.Game.DecisionPending, {
                session: this,
                decision: decision
            });
        } else {
            console.log('[GameSession] 清除待决策');
            EventBus.emit(EventTypes.Game.DecisionCleared, {
                session: this
            });
        }
    }

    /**
     * 清除待决策状态
     */
    public clearPendingDecision(): void {
        this.setPendingDecision(null);
    }

    /**
     * 检查是否有待决策
     */
    public hasPendingDecision(): boolean {
        return this._pendingDecision !== null;
    }

    // ========================= 玩家管理 =========================

    /**
     * 获取当前活跃玩家
     */
    public getActivePlayer(): Player | null {
        if (this._activePlayerIndex >= 0 && this._activePlayerIndex < this._players.length) {
            return this._players[this._activePlayerIndex];
        }
        return null;
    }

    /**
     * 根据索引获取玩家
     */
    public getPlayerByIndex(index: number): Player | null {
        if (index >= 0 && index < this._players.length) {
            return this._players[index];
        }
        return null;
    }

    /**
     * 根据地址获取玩家
     */
    public getPlayerByAddress(address: string): Player | null {
        return this._players.find(p => p.getOwner() === address) || null;
    }

    /**
     * 获取所有玩家
     */
    public getAllPlayers(): Player[] {
        return [...this._players];
    }

    /**
     * 获取玩家数量
     */
    public getPlayerCount(): number {
        return this._players.length;
    }

    /**
     * 获取我的玩家（当前客户端连接的玩家）
     */
    public getMyPlayer(): Player | null {
        return this._myPlayer;
    }

    /**
     * 获取我的玩家索引
     */
    public getMyPlayerIndex(): number {
        return this._myPlayerIndex;
    }

    /**
     * 是否是我的回合
     */
    public isMyTurn(): boolean {
        return this._myPlayerIndex === this._activePlayerIndex;
    }

    // ========================= NPC管理 =========================

    /**
     * 添加NPC
     */
    public addNPC(npc: NPC): void {
        this._npcs.push(npc);
        console.log(`[GameSession] 添加NPC到地块 ${npc.getTileId()}`);

        EventBus.emit(EventTypes.Game.NPCSpawned, {
            session: this,
            tileId: npc.getTileId(),
            npc: npc
        });
    }

    /**
     * 移除NPC（根据 tileId）
     */
    public removeNPC(tileId: number): void {
        const index = this._npcs.findIndex(npc => npc.getTileId() === tileId);
        if (index >= 0) {
            const npc = this._npcs[index];
            this._npcs.splice(index, 1);
            console.log(`[GameSession] 移除地块 ${tileId} 上的NPC`);

            EventBus.emit(EventTypes.Game.NPCRemoved, {
                session: this,
                tileId: tileId,
                npc: npc
            });
        }
    }

    /**
     * 获取指定地块上的NPC
     */
    public getNPCAtTile(tileId: number): NPC | null {
        return this._npcs.find(npc => npc.getTileId() === tileId) || null;
    }

    /**
     * 根据索引获取NPC
     */
    public getNPCByIndex(index: number): NPC | null {
        return this._npcs[index] || null;
    }

    /**
     * 获取所有NPC
     */
    public getAllNPCs(): NPC[] {
        return [...this._npcs];
    }

    /**
     * 检查地块是否有NPC
     */
    public hasNPC(tileId: number): boolean {
        return this._npcs.some(npc => npc.getTileId() === tileId);
    }

    /**
     * 获取NPC数量
     */
    public getNPCCount(): number {
        return this._npcs.length;
    }

    // ========================= Building管理 =========================

    /**
     * 更新建筑数据（owner、level和可选的buildingType）并触发渲染更新
     * @param buildingId 建筑ID
     * @param owner 新的拥有者索引
     * @param level 新的等级
     * @param buildingType 可选的建筑类型（用于2x2建筑lv0->lv1时设置类型）
     */
    public updateBuilding(buildingId: number, owner: number, level: number, buildingType?: number): void {
        const building = this._buildings[buildingId];

        if (!building) {
            console.warn(`[GameSession] 建筑不存在: ${buildingId}`);
            return;
        }

        const oldOwner = building.owner;
        const oldLevel = building.level;
        const oldBuildingType = building.buildingType;

        // 1. 创建新的 GameBuilding（因为字段是 readonly）
        const newBuilding = new GameBuilding(
            building.buildingId,
            building.x,
            building.y,
            building.size,
            building.price,
            building.chainPrevId,
            building.chainNextId,
            owner,  // 新owner
            level,  // 新level
            buildingType ?? building.buildingType,  // 新buildingType或保持原值
            building.blockId,
            building.direction,
            building.entranceTileIds
        );

        // 2. 维护 originalOwner（关键！）
        if (oldOwner !== NO_OWNER) {
            // 如果之前有主，记录为 originalOwner
            newBuilding.originalOwner = oldOwner;
        } else if (building.originalOwner !== NO_OWNER) {
            // 如果之前无主但有 originalOwner，保持
            newBuilding.originalOwner = building.originalOwner;
        } else if (owner !== NO_OWNER) {
            // 如果是首次有主，设置 originalOwner
            newBuilding.originalOwner = owner;
        }

        this._buildings[buildingId] = newBuilding;

        console.log(`[GameSession] 建筑数据更新: Building ${buildingId}, Owner: ${oldOwner}->${owner}, Level: ${oldLevel}->${level}, BuildingType: ${oldBuildingType}->${newBuilding.buildingType}, OriginalOwner: ${newBuilding.originalOwner}`);

        // 3. 触发渲染更新（通过GameMap）
        if (this._gameMap && this._gameMap.updateBuildingRender) {
            const updatedBuilding = this._buildings[buildingId];
            this._gameMap.updateBuildingRender(
                buildingId,
                updatedBuilding.x,
                updatedBuilding.y,
                owner,
                level
            );
        }

        // 4. 触发建筑更新事件
        EventBus.emit(EventTypes.Game.BuildingChanged, {
            session: this,
            buildingId,
            oldOwner,
            newOwner: owner,
            oldLevel,
            newLevel: level
        });
    }

    // ========================= 游戏状态管理 =========================

    /**
     * 设置游戏状态
     */
    public setStatus(status: GameStatus): void {
        const oldStatus = this._status;
        this._status = status;

        console.log(`[GameSession] 游戏状态变化: ${oldStatus} -> ${status}`);

        EventBus.emit(EventTypes.Game.StatusChanged, {
            session: this,
            oldStatus: oldStatus,
            newStatus: status
        });
    }

    /**
     * 检查游戏是否处于准备状态
     */
    public isReady(): boolean {
        return this._status === GameStatus.READY;
    }

    /**
     * 检查游戏是否进行中
     */
    public isActive(): boolean {
        return this._status === GameStatus.ACTIVE;
    }

    /**
     * 检查游戏是否已结束
     */
    public isEnded(): boolean {
        return this._status === GameStatus.ENDED;
    }

    /**
     * 设置胜利者
     */
    public setWinner(winner: string | null): void {
        this._winner = winner;

        if (winner) {
            console.log('[GameSession] 游戏胜利者:', winner);
            EventBus.emit(EventTypes.Game.GameEnded, {
                session: this,
                winner: winner
            });
        }
    }

    // ========================= 访问器 =========================

    public getGameId(): string { return this._gameId; }
    public getStatus(): GameStatus { return this._status; }
    public getTemplateMapId(): string { return this._templateMapId; }
    public getMySeat(): Seat | null { return this._mySeat; }

    public getRound(): number { return this._round; }
    public getTurn(): number { return this._turn; }
    public getActivePlayerIndex(): number { return this._activePlayerIndex; }
    public hasRolled(): boolean { return this._hasRolled; }

    public getPendingDecision(): PendingDecisionInfo | null { return this._pendingDecision; }

    public getMaxRounds(): number { return this._maxRounds; }
    public getPriceRiseDays(): number { return this._priceRiseDays; }
    public getWinner(): string | null { return this._winner; }

    // 地图相关访问器
    public getMapTemplate(): MapTemplate | null { return this._mapTemplate; }
    public getGameData(): GameData | null { return this._gameData; }
    public getTiles(): GameTile[] { return [...this._tiles]; }
    public getBuildings(): GameBuilding[] { return [...this._buildings]; }
    public getGameMap(): any { return this._gameMap; }

    public getTileByIndex(index: number): GameTile | null {
        return this._tiles[index] || null;
    }

    public getBuildingByIndex(index: number): GameBuilding | null {
        return this._buildings[index] || null;
    }

    /**
     * 根据 tileId 获取对应的 building
     * @param tileId Tile ID
     * @returns 包含该 tileId 作为入口的 building，如果没有则返回 null
     */
    public getBuildingByTileId(tileId: number): GameBuilding | null {
        // 遍历所有建筑，查找 entranceTileIds 包含该 tileId 的建筑
        return this._buildings.find(building =>
            building.entranceTileIds.includes(tileId)
        ) || null;
    }

    /**
     * 获取 Tile 的世界中心点（顶部）
     * @param tileId Tile ID
     * @returns 世界坐标中心点，如果未缓存则返回 null
     */
    public getTileWorldCenter(tileId: number): Vec3 | null {
        const tile = this._tiles[tileId];
        return tile?.getWorldCenter() || null;
    }

    // ========================= 调试方法 =========================

    /**
     * 调试输出游戏会话信息
     */
    public debugInfo(): string {
        const info = [
            `GameID: ${this._gameId}`,
            `Status: ${this._status}`,
            `Round: ${this._round}`,
            `Turn: ${this._turn}`,
            `ActivePlayer: ${this._activePlayerIndex}`,
            `Players: ${this._players.length}`,
            `NPCs: ${this._npcs.length}`,
            `HasRolled: ${this._hasRolled}`,
            `PendingDecision: ${this._pendingDecision ? this._pendingDecision.type : 'None'}`
        ];

        return `[GameSession] ${info.join(', ')}`;
    }

    /**
     * 退出游戏清理（由 UIManager.exitGame() 调用）
     *
     * 职责：
     * - 卸载 GameMap（调用 MapManager）
     * - 重置 GameSession 状态
     * - 清理 Blackboard
     * - 发射 GameExit 事件（仅通知，不控制 UI）
     *
     * 注意：不负责 UI 显示/隐藏，由 UIManager 统一处理
     */
    public exitGameCleanup(): void {
        console.log('[GameSession] 开始清理游戏状态');

        // 1. 卸载 GameMap（如果有）
        if (this._gameMap) {
            const mapManager = MapManager.getInstance();
            if (mapManager) {
                mapManager.unloadCurrentMap();
                console.log('[GameSession] GameMap 已卸载');
            }
        }

        // 2. 重置 GameSession 状态
        this.reset();

        // 3. 清理 Blackboard 中的 currentGameSession
        Blackboard.instance.set('currentGameSession', null);
        console.log('[GameSession] Blackboard 已清理');

        // 4. 发射游戏退出事件（仅通知）
        EventBus.emit(EventTypes.Game.GameExit, {
            source: 'game_session'
        });

        console.log('[GameSession] 游戏状态清理完成');
    }

    /**
     * 重置游戏会话
     */
    public reset(): void {
        console.log('[GameSession] 重置游戏会话');

        this._gameId = '';
        this._status = GameStatus.READY;
        this._templateMapId = '';
        this._round = 0;
        this._turn = 0;
        this._activePlayerIndex = 0;
        this._hasRolled = false;
        this._players = [];
        this._myPlayer = null;
        this._myPlayerIndex = -1;
        this._mySeat = null;
        this._npcs = [];
        this._pendingDecision = null;
        this._maxRounds = 0;
        this._priceRiseDays = 15;
        this._winner = null;

        // 清理地图数据
        this._mapTemplate = null;
        this._gameData = null;
        this._tiles = [];
        this._buildings = [];
        this._gameMap = null;

        EventBus.emit(EventTypes.Game.SessionReset, {
            session: this
        });
    }

    /**
     * 销毁游戏会话
     */
    public destroy(): void {
        console.log('[GameSession] 销毁游戏会话');

        // 清理玩家
        this._players.forEach(player => player.destroy());
        this._players = [];

        // 清理NPC
        this._npcs.forEach(npc => npc.destroy());
        this._npcs = [];

        EventBus.emit(EventTypes.Game.SessionDestroyed, {
            session: this
        });
    }
}
