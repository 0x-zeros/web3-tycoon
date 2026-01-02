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
import { Vec3 } from 'cc';
import { Blackboard } from '../events/Blackboard';
import * as DirectionUtils from '../utils/DirectionUtils';

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
        this.setAttr(RoleAttribute.BANKRUPT, movePlayer.bankrupt ? 1 : 0);

        // 设置当前地块ID
        this.setCurrentTileId(movePlayer.pos);

        // 设置状态
        if (this._bankrupt) {
            this.setState(RoleState.BANKRUPT);
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

    /**
     * 添加单个Buff
     * @param buff Buff数据
     */
    public addBuff(buff: MoveBuffEntry): void {
        // 检查是否已存在相同kind的buff
        const existingIndex = this._buffs.findIndex(b => b.kind === buff.kind);

        if (existingIndex >= 0) {
            // 替换现有buff（通常更新last_active_round）
            this._buffs[existingIndex] = { ...buff };
            console.log(`[Player] 更新Buff: kind=${buff.kind}, last_active_round=${buff.last_active_round}`);
        } else {
            // 新增buff
            this._buffs.push({ ...buff });
            console.log(`[Player] 添加Buff: kind=${buff.kind}, last_active_round=${buff.last_active_round}`);
        }

        // 触发Buff添加事件
        EventBus.emit(EventTypes.Player.BuffAdded, {
            playerId: this.m_oId,
            playerIndex: this._playerIndex,
            buff: buff
        });
    }

    /**
     * 删除指定类型的Buff
     * @param buffKind Buff类型
     * @returns 是否成功删除
     */
    public removeBuff(buffKind: number): boolean {
        const index = this._buffs.findIndex(b => b.kind === buffKind);

        if (index >= 0) {
            const removedBuff = this._buffs[index];
            this._buffs.splice(index, 1);

            console.log(`[Player] 删除Buff: kind=${buffKind}`);

            // 触发Buff删除事件
            EventBus.emit(EventTypes.Player.BuffRemoved, {
                playerId: this.m_oId,
                playerIndex: this._playerIndex,
                buffKind: buffKind,
                removedBuff: removedBuff
            });

            return true;
        }

        console.warn(`[Player] Buff不存在: kind=${buffKind}`);
        return false;
    }

    /**
     * 批量更新Buff列表
     * @param buffs 新的Buff列表
     */
    public updateBuffs(buffs: MoveBuffEntry[]): void {
        this._buffs = buffs.map(buff => ({ ...buff }));

        console.log(`[Player] 批量更新Buffs: count=${buffs.length}`);

        // 触发Buff列表更新事件
        EventBus.emit(EventTypes.Player.BuffsUpdated, {
            playerId: this.m_oId,
            playerIndex: this._playerIndex,
            buffs: this._buffs
        });
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

    /**
     * 添加卡牌
     * @param cardKind 卡牌类型
     * @param count 数量
     */
    public addCard(cardKind: number, count: number): void {
        const existingIndex = this._cards.findIndex(c => c.kind === cardKind);

        if (existingIndex >= 0) {
            // 已有该类型卡牌，创建新Card替换（因为count是readonly）
            const oldCount = this._cards[existingIndex].count;
            this._cards[existingIndex] = Card.fromEntry(cardKind, oldCount + count);
        } else {
            // 新卡牌类型
            this._cards.push(Card.fromEntry(cardKind, count));
        }

        console.log(`[Player] 添加卡牌: kind=${cardKind}, count=${count}`);

        // 触发卡牌变化事件
        EventBus.emit(EventTypes.Player.CardChange, {
            playerId: this.m_oId,
            cardKind,
            count,
            totalCount: this.getTotalCardCount()
        });
    }

    /**
     * 删除卡牌（带事件触发）
     * @param cardKind 卡牌类型
     * @param count 数量（默认1）
     * @returns 是否成功删除
     */
    public removeCard(cardKind: number, count: number = 1): boolean {
        const cardIndex = this._cards.findIndex(c => c.kind === cardKind);

        if (cardIndex < 0 || this._cards[cardIndex].count < count) {
            console.warn(`[Player] 卡牌不足: kind=${cardKind}, have=${this._cards[cardIndex]?.count || 0}, need=${count}`);
            return false;
        }

        const oldCount = this._cards[cardIndex].count;
        const newCount = oldCount - count;

        // 如果数量为0，从数组移除；否则创建新Card替换
        if (newCount === 0) {
            this._cards.splice(cardIndex, 1);
        } else {
            this._cards[cardIndex] = Card.fromEntry(cardKind, newCount);
        }

        console.log(`[Player] 删除卡牌: kind=${cardKind}, count=${count}, remaining=${newCount}`);

        // 触发卡牌删除事件
        EventBus.emit(EventTypes.Player.CardRemoved, {
            playerId: this.m_oId,
            playerIndex: this._playerIndex,
            cardKind,
            count,
            remainingCount: newCount
        });

        return true;
    }

    // ========================= 状态查询 =========================

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
        return !this._bankrupt && !this.isInHospital();
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

    /**
     * 设置玩家位置（带事件触发和属性同步）
     * @param tileId 新的位置（tile_id）
     * @param updateLastTile 是否更新 last_tile_id（默认 true）
     *        - true: 正常移动，更新 lastTile 为移动前的位置
     *        - false: 瞬移（如遇到炸弹），不更新 lastTile
     */
    public setPos(tileId: number, updateLastTile: boolean = true): void {
        const oldPos = this._pos;

        // ✅ 更新 last_tile_id 为移动前的位置（模拟 Move 合约逻辑）
        if (updateLastTile) {
            this._lastTileId = oldPos;
        }

        // 更新当前位置
        this._pos = tileId;

        // 同步到 Role 基类属性
        this.setAttr(RoleAttribute.POSITION, tileId);

        // 更新当前地块ID
        this.setCurrentTileId(tileId);

        console.log(`[Player] 位置变化: ${oldPos} -> ${tileId}${updateLastTile ? `, lastTile: ${this._lastTileId}` : ' (瞬移，lastTile不变)'}`);

        // 触发位置变化事件
        EventBus.emit(EventTypes.Player.PositionChanged, {
            playerId: this.m_oId,
            playerIndex: this._playerIndex,
            oldPos,
            newPos: tileId
        });
    }

    public getCash(): bigint { return this._cash; }
    public getBankrupt(): boolean { return this._bankrupt; }

    /**
     * 更新现金（带事件触发和UI同步）
     * @param cash 新的现金数量
     */
    public setCash(cash: bigint): void {
        const oldCash = this._cash;
        this._cash = cash;

        // 同步到Role基类属性
        this.setAttr(RoleAttribute.MONEY, Number(cash));

        console.log(`[Player] 现金变化: ${oldCash} -> ${cash}`);

        // 触发现金变化事件
        EventBus.emit(EventTypes.Player.CashChange, {
            playerId: this.m_oId,
            playerIndex: this._playerIndex,
            oldCash,
            newCash: cash,
            delta: cash - oldCash
        });
    }

    /**
     * 设置破产状态
     * @param bankrupt 是否破产
     */
    public setBankrupt(bankrupt: boolean): void {
        const oldBankrupt = this._bankrupt;
        this._bankrupt = bankrupt;

        // 同步到Role基类属性
        this.setAttr(RoleAttribute.BANKRUPT, bankrupt ? 1 : 0);

        // 更新状态
        if (bankrupt) {
            this.setState(RoleState.BANKRUPT);
        } else {
            this.setState(RoleState.IDLE);
        }

        console.log(`[Player] 破产状态变化: ${oldBankrupt} -> ${bankrupt}`);

        // 触发状态变化事件
        EventBus.emit(EventTypes.Player.StatusChange, {
            playerId: this.m_oId,
            playerIndex: this._playerIndex,
            statusType: 'bankrupt',
            oldValue: oldBankrupt ? 1 : 0,
            newValue: bankrupt ? 1 : 0
        });
    }

    public getInHospitalTurns(): number { return this._inHospitalTurns; }

    /**
     * 设置医院剩余回合数
     * @param turns 剩余回合数
     */
    public setInHospitalTurns(turns: number): void {
        const oldTurns = this._inHospitalTurns;
        this._inHospitalTurns = turns;

        // 更新状态
        if (turns > 0) {
            this.setState(RoleState.IDLE); // 医院状态暂时用IDLE，可以考虑新增状态
        } else if (!this._bankrupt && turns === 0) {
            this.setState(RoleState.IDLE);
        }

        console.log(`[Player] 医院回合变化: ${oldTurns} -> ${turns}`);

        // 触发状态变化事件
        EventBus.emit(EventTypes.Player.StatusChange, {
            playerId: this.m_oId,
            playerIndex: this._playerIndex,
            statusType: 'hospital',
            oldValue: oldTurns,
            newValue: turns
        });
    }

    public getLastTileId(): number { return this._lastTileId; }
    public getNextTileId(): number { return this._nextTileId; }

    /**
     * 设置下一步强制目标tile
     * @param tileId 目标tile_id（65535表示无强制）
     */
    public setNextTileId(tileId: number): void {
        const oldValue = this._nextTileId;
        this._nextTileId = tileId;

        console.log(`[Player] next_tile_id变化: ${oldValue} -> ${tileId}`);

        // 触发事件
        EventBus.emit(EventTypes.Player.StatusChange, {
            playerId: this.m_oId,
            playerIndex: this._playerIndex,
            statusType: 'next_tile_id',
            oldValue: oldValue,
            newValue: tileId
        });
    }

    public getTempleLevels(): number[] { return [...this._templeLevels]; }

    // ========================= PaperActor 关联方法 =========================

    /**
     * 重写 setPaperActor，在设置 PaperActor 时自动更新朝向
     */
    public setPaperActor(actor: any | null): void {
        super.setPaperActor(actor);

        // PaperActor 创建完成后，立即更新朝向
        if (actor) {
            const session = Blackboard.instance.get<any>("currentGameSession");
            if (session) {
                this.updatePaperActorDirection(session);
            } else {
                console.warn('[Player] GameSession not found, skip direction update');
            }
        }
    }

    // getPaperActor() 继承自 Role 基类

    // ========================= PaperActor 朝向管理 =========================

    /**
     * 更新PaperActor朝向
     * 根据next_tile_id和last_tile_id计算并设置朝向
     * @param session GameSession实例，用于获取tile位置
     */
    public updatePaperActorDirection(session: any): void {
        const paperActor = this.getPaperActor();
        if (!paperActor) {
            return;
        }

        // 使用 DirectionUtils 计算方向
        const direction = DirectionUtils.calculatePlayerDirection(
            this._pos,
            this._lastTileId,
            this._nextTileId,
            (tileId) => session.getTileWorldCenter(tileId)
        );

        if (direction === null) {
            // 无法计算方向，不更新
            return;
        }

        // 设置到PaperActor
        paperActor.setDirection(direction);

        console.log(`[Player] 更新朝向: pos=${this._pos}, last=${this._lastTileId}, next=${this._nextTileId}, direction=${direction}`);
    }

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
            `Hospital: ${this._inHospitalTurns}`,
            `Buffs: ${this._buffs.length}`,
            `Cards: ${this._cards.length}`
        ];

        return `${baseInfo}, ${playerInfo.join(', ')}`;
    }
}
