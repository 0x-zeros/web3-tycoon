/**
 * Player类 - 玩家角色
 *
 * 对应 Move 端的 Player 结构
 * 只保留 extends Role，所有游戏逻辑数据来自 Move 链
 *
 * @author Web3 Tycoon Team
 * @version 2.0.0
 */

import { Role } from './Role';
import { RoleType, RoleAttribute, RoleState } from './RoleTypes';
import type { Player as MovePlayer, BuffEntry as MoveBuffEntry, CardEntry } from '../sui/types/game';
import { INVALID_TILE_ID } from '../sui/types/constants';
import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';
import { IdFormatter } from '../ui/utils/IdFormatter';
import { Card } from '../card/Card';

/**
 * Player 类
 * 继承自 Role，包含 Move 端对应的玩家数据
 */
export class Player extends Role {

    // ========================= Move 端对应字段 =========================

    /** 玩家地址（对应 Move Player.owner） */
    protected _owner: string = '';

    /** 玩家索引（在 players vector 中的位置） */
    protected _playerIndex: number = 0;

    /** 当前位置（tile_id，对应 Move Player.pos） */
    protected _pos: number = 0;

    /** 现金（对应 Move Player.cash） */
    protected _cash: bigint = BigInt(0);

    /** 破产状态（对应 Move Player.bankrupt） */
    protected _bankrupt: boolean = false;

    /** 监狱剩余回合数（对应 Move Player.in_prison_turns） */
    protected _inPrisonTurns: number = 0;

    /** 医院剩余回合数（对应 Move Player.in_hospital_turns） */
    protected _inHospitalTurns: number = 0;

    /** 上一个 tile_id（用于避免回头，对应 Move Player.last_tile_id） */
    protected _lastTileId: number = INVALID_TILE_ID;

    /** 下一步强制目标 tile（对应 Move Player.next_tile_id） */
    protected _nextTileId: number = INVALID_TILE_ID;

    /** 土地庙等级列表（对应 Move Player.temple_levels） */
    protected _templeLevels: number[] = [];

    /** Buff 列表（对应 Move Player.buffs） */
    protected _buffs: MoveBuffEntry[] = [];

    /** 卡牌列表（客户端 Card 对象） */
    protected _cards: Card[] = [];

    // ========================= 构造和初始化 =========================

    constructor() {
        super();
        this.m_eType = RoleType.PLAYER;
        console.log('[Player] Player 实例创建');
    }

    /**
     * 从 Move Player 对象加载数据
     * @param movePlayer Move 端的 Player 对象
     * @param playerIndex 玩家索引
     */
    public loadFromMovePlayer(movePlayer: MovePlayer, playerIndex: number): void {
        console.log('[Player] 从 Move Player 加载数据', movePlayer);

        // 基础信息
        this._owner = movePlayer.owner;
        this._playerIndex = playerIndex;
        this.m_oId = `player_${playerIndex}_${IdFormatter.shortenAddress(movePlayer.owner)}`;
        this.m_strName = `玩家 ${playerIndex + 1}`;

        // Move 端字段
        this._pos = movePlayer.pos;
        this._cash = movePlayer.cash;
        this._bankrupt = movePlayer.bankrupt;
        this._inPrisonTurns = movePlayer.in_prison_turns;
        this._inHospitalTurns = movePlayer.in_hospital_turns;
        this._lastTileId = movePlayer.last_tile_id;
        this._nextTileId = movePlayer.next_tile_id;
        this._templeLevels = [...movePlayer.temple_levels];

        // 加载 Buffs
        this.loadBuffs(movePlayer.buffs);

        // 加载卡牌
        this.loadCards(movePlayer.cards);

        // 同步到 Role 基类属性
        this.setAttr(RoleAttribute.MONEY, Number(movePlayer.cash));
        this.setAttr(RoleAttribute.POSITION, movePlayer.pos);
        this.setAttr(RoleAttribute.JAIL_TURNS, movePlayer.in_prison_turns);
        this.setAttr(RoleAttribute.BANKRUPT, movePlayer.bankrupt ? 1 : 0);

        // 设置当前地块ID
        this.setCurrentTileId(movePlayer.pos);

        // 设置状态
        if (this._bankrupt) {
            this.setState(RoleState.BANKRUPT);
        } else if (this.isInPrison()) {
            this.setState(RoleState.JAILED);
        } else {
            this.setState(RoleState.IDLE);
        }

        console.log('[Player] 玩家数据加载完成', {
            owner: this._owner,
            index: this._playerIndex,
            pos: this._pos,
            cash: this._cash.toString(),
            bankrupt: this._bankrupt,
            buffsCount: this._buffs.length,
            cardsCount: this._cards.length
        });

        // 触发玩家数据加载事件
        EventBus.emit(EventTypes.Role.Initialized, {
            roleId: this.m_oId,
            role: this,
            playerIndex: this._playerIndex
        });
    }

    /**
     * 加载 Buffs
     */
    private loadBuffs(moveBuffs: MoveBuffEntry[]): void {
        this._buffs = moveBuffs.map(buff => ({
            kind: buff.kind,
            last_active_round: buff.last_active_round,
            value: buff.value,
            spawn_index: buff.spawn_index
        }));

        console.log(`[Player] 加载 ${this._buffs.length} 个 Buff`);
    }

    /**
     * 加载卡牌（将 CardEntry[] 转换为 Card[]）
     */
    private loadCards(moveCards: CardEntry[]): void {
        this._cards = moveCards.map(entry => Card.fromEntry(entry.kind, entry.count));

        console.log(`[Player] 加载 ${this._cards.length} 种卡牌`);
    }

    // ========================= Buff 管理 =========================

    /**
     * 检查是否有激活的 Buff
     * @param buffKind Buff 类型
     * @param currentRound 当前轮次
     */
    public hasActiveBuff(buffKind: number, currentRound: number): boolean {
        return this._buffs.some(buff =>
            buff.kind === buffKind && currentRound <= buff.last_active_round
        );
    }

    /**
     * 获取指定类型的 Buff
     */
    public getBuff(buffKind: number): MoveBuffEntry | null {
        return this._buffs.find(buff => buff.kind === buffKind) || null;
    }

    /**
     * 获取所有 Buffs
     */
    public getAllBuffs(): MoveBuffEntry[] {
        return [...this._buffs];
    }

    /**
     * 检查是否有任何激活的 Buff
     */
    public hasAnyActiveBuff(currentRound: number): boolean {
        return this._buffs.some(buff => currentRound <= buff.last_active_round);
    }

    // ========================= 卡牌管理 =========================

    /**
     * 获取指定卡牌的数量
     */
    public getCardCount(cardKind: number): number {
        const card = this._cards.find(c => c.kind === cardKind);
        return card ? card.count : 0;
    }

    /**
     * 获取所有卡牌
     */
    public getAllCards(): Card[] {
        return [...this._cards];
    }

    /**
     * 检查是否拥有指定卡牌
     */
    public hasCard(cardKind: number): boolean {
        return this.getCardCount(cardKind) > 0;
    }

    /**
     * 获取卡牌总数
     */
    public getTotalCardCount(): number {
        return this._cards.reduce((sum, card) => sum + card.count, 0);
    }

    // ========================= 状态查询 =========================

    /**
     * 是否在监狱
     */
    public isInPrison(): boolean {
        return this._inPrisonTurns > 0;
    }

    /**
     * 是否在医院
     */
    public isInHospital(): boolean {
        return this._inHospitalTurns > 0;
    }

    /**
     * 是否可以行动
     */
    public canAct(): boolean {
        return !this._bankrupt && !this.isInPrison() && !this.isInHospital();
    }

    /**
     * 是否破产
     */
    public isBankrupt(): boolean {
        return this._bankrupt;
    }

    /**
     * 是否有强制目标 tile
     */
    public hasNextTile(): boolean {
        return this._nextTileId !== INVALID_TILE_ID;
    }

    // ========================= 访问器 =========================

    public getOwner(): string { return this._owner; }
    public getPlayerIndex(): number { return this._playerIndex; }

    public getPos(): number { return this._pos; }
    public getCash(): bigint { return this._cash; }
    public getBankrupt(): boolean { return this._bankrupt; }

    public getInPrisonTurns(): number { return this._inPrisonTurns; }
    public getInHospitalTurns(): number { return this._inHospitalTurns; }

    public getLastTileId(): number { return this._lastTileId; }
    public getNextTileId(): number { return this._nextTileId; }

    public getTempleLevels(): number[] { return [...this._templeLevels]; }

    // PaperActor 关联方法继承自 Role 基类
    // setPaperActor(), getPaperActor()

    // ========================= 重写方法 =========================

    /**
     * 重写重置方法
     */
    public reset(): void {
        super.reset();

        // 重置玩家数据
        this._owner = '';
        this._playerIndex = 0;
        this._pos = 0;
        this._cash = BigInt(0);
        this._bankrupt = false;
        this._inPrisonTurns = 0;
        this._inHospitalTurns = 0;
        this._lastTileId = INVALID_TILE_ID;
        this._nextTileId = INVALID_TILE_ID;
        this._templeLevels = [];
        this._buffs = [];
        this._cards = [];

        // _paperActor 由 Role.reset() 处理

        console.log('[Player] 玩家重置完成');
    }

    /**
     * 重写调试信息
     */
    public debugInfo(): string {
        const baseInfo = super.debugInfo();
        const playerInfo = [
            `Owner: ${IdFormatter.shortenAddress(this._owner)}`,
            `Index: ${this._playerIndex}`,
            `Pos: ${this._pos}`,
            `Cash: ${this._cash.toString()}`,
            `Bankrupt: ${this._bankrupt}`,
            `Prison: ${this._inPrisonTurns}`,
            `Hospital: ${this._inHospitalTurns}`,
            `Buffs: ${this._buffs.length}`,
            `Cards: ${this._cards.length}`
        ];

        return `${baseInfo}, ${playerInfo.join(', ')}`;
    }
}
