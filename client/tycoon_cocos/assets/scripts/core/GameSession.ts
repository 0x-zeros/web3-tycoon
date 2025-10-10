/**
 * GameSession类 - 游戏会话管理器
 *
 * 对应Move端的Game对象，管理一局游戏的核心状态和流程
 *
 * 职责：
 * - 游戏状态管理（status, round, turn）
 * - 玩家列表管理（对应Move的players vector）
 * - NPC管理（对应Move的npc_on Table）
 * - 回合控制和决策管理
 *
 * 不包含：
 * - Map相关的tile、building管理（由GameMap负责）
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';
import type { Game, Player as MovePlayer, NpcInst as MoveNpcInst } from '../sui/types/game';
import { GameStatus, PendingDecision, INVALID_TILE_ID } from '../sui/types/constants';
import { Player } from '../role/Player';
import { NPC } from '../role/NPC';

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

    /** NPC映射（tileId -> NPC） */
    private _npcs: Map<number, NPC> = new Map();

    // ========================= 待决策状态 =========================

    /** 待决策信息 */
    private _pendingDecision: PendingDecisionInfo | null = null;

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
     */
    public loadFromMoveGame(game: Game): void {
        console.log('[GameSession] 从 Move Game 加载数据', game);

        //todo 保存 game 为变量

        // 基础信息
        this._gameId = game.id;
        this._status = game.status;
        this._templateMapId = game.template_map_id;

        // 回合系统
        this._round = game.round;
        this._turn = game.turn;
        this._activePlayerIndex = game.active_idx;
        this._hasRolled = game.has_rolled;

        // 配置
        this._maxRounds = game.max_rounds;
        this._priceRiseDays = game.price_rise_days;
        this._winner = game.winner || null;

        // 加载玩家列表
        this.loadPlayers(game.players);

        // 加载NPC
        this.loadNPCs(game.npc_on);

        // 加载待决策状态
        this.loadPendingDecision(game);

        console.log('[GameSession] 数据加载完成', {
            gameId: this._gameId,
            status: this._status,
            round: this._round,
            turn: this._turn,
            playerCount: this._players.length,
            npcCount: this._npcs.size
        });

        // 触发加载完成事件
        EventBus.emit(EventTypes.Game.SessionLoaded, {
            session: this,
            game: game
        });
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
    private loadNPCs(npcMap: Map<number, MoveNpcInst>): void {
        // 清空现有NPC
        this._npcs.clear();

        // 创建或更新NPC对象
        npcMap.forEach((moveNpc, tileId) => {
            const npc = new NPC();
            npc.loadFromMoveNPC(moveNpc);
            this._npcs.set(tileId, npc);
        });

        console.log(`[GameSession] 加载 ${this._npcs.size} 个NPC`);
    }

    /**
     * 加载待决策状态
     */
    private loadPendingDecision(game: Game): void {
        if (game.pending_decision !== PendingDecision.NONE) {
            this._pendingDecision = {
                type: game.pending_decision,
                tileId: game.decision_tile,
                amount: game.decision_amount
            };
            console.log('[GameSession] 待决策状态加载', this._pendingDecision);
        } else {
            this._pendingDecision = null;
        }
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
     */
    public nextPlayer(): void {
        const playerCount = this._players.length;
        if (playerCount === 0) return;

        this._turn = (this._turn + 1) % playerCount;

        // 如果一轮结束，增加轮次
        if (this._turn === 0) {
            this._round++;
            console.log(`[GameSession] 轮次增加: ${this._round}`);
        }

        this._activePlayerIndex = this._turn;
        this._hasRolled = false;

        console.log(`[GameSession] 切换到下一个玩家: Player ${this._activePlayerIndex}`);
    }

    /**
     * 设置已掷骰状态
     */
    public setRolled(rolled: boolean): void {
        this._hasRolled = rolled;
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

    // ========================= NPC管理 =========================

    /**
     * 添加NPC
     */
    public addNPC(tileId: number, npc: NPC): void {
        this._npcs.set(tileId, npc);
        console.log(`[GameSession] 添加NPC到地块 ${tileId}`);

        EventBus.emit(EventTypes.Game.NPCSpawned, {
            session: this,
            tileId: tileId,
            npc: npc
        });
    }

    /**
     * 移除NPC
     */
    public removeNPC(tileId: number): void {
        const npc = this._npcs.get(tileId);
        if (npc) {
            this._npcs.delete(tileId);
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
    public getNPC(tileId: number): NPC | null {
        return this._npcs.get(tileId) || null;
    }

    /**
     * 获取所有NPC
     */
    public getAllNPCs(): Map<number, NPC> {
        return new Map(this._npcs);
    }

    /**
     * 检查地块是否有NPC
     */
    public hasNPC(tileId: number): boolean {
        return this._npcs.has(tileId);
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

    public getRound(): number { return this._round; }
    public getTurn(): number { return this._turn; }
    public getActivePlayerIndex(): number { return this._activePlayerIndex; }
    public hasRolled(): boolean { return this._hasRolled; }

    public getPendingDecision(): PendingDecisionInfo | null { return this._pendingDecision; }

    public getMaxRounds(): number { return this._maxRounds; }
    public getPriceRiseDays(): number { return this._priceRiseDays; }
    public getWinner(): string | null { return this._winner; }

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
            `NPCs: ${this._npcs.size}`,
            `HasRolled: ${this._hasRolled}`,
            `PendingDecision: ${this._pendingDecision ? this._pendingDecision.type : 'None'}`
        ];

        return `[GameSession] ${info.join(', ')}`;
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
        this._npcs.clear();
        this._pendingDecision = null;
        this._maxRounds = 0;
        this._priceRiseDays = 15;
        this._winner = null;

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
        this._npcs.clear();

        EventBus.emit(EventTypes.Game.SessionDestroyed, {
            session: this
        });
    }
}
