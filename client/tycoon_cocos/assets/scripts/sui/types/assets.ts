/**
 * 钱包资产类型定义
 * 包括 Coins、NFTs、DeFi 资产等
 */

import type { Seat } from './game';

/**
 * Map Template Creator NFT 信息（预留）
 */
export interface MapTemplateNFT {
    /** Object ID */
    objectId: string;
    /** 模板 ID */
    templateId: string;
    /** 模板名称 */
    name: string;
    /** 创建者地址 */
    creator: string;
}

/**
 * Coin 信息
 */
export interface CoinInfo {
    /** Coin Object ID */
    objectId: string;
    /** Coin 类型（如 0x2::sui::SUI） */
    coinType: string;
    /** 余额 */
    balance: bigint;
    /** 版本 */
    version: string;
}

/**
 * 玩家资产管理类
 * 统一管理玩家的所有链上资产
 */
export class PlayerAssets {
    /** SUI 余额 */
    private _suiBalance: bigint;

    /** 拥有的 Seat */
    private _seats: Seat[];

    /** 拥有的 Map Template NFTs */
    private _mapTemplateNFTs: MapTemplateNFT[];

    /** 缓存时间戳 */
    private _timestamp: number;

    constructor(
        suiBalance: bigint = 0n,
        seats: Seat[] = [],
        mapTemplateNFTs: MapTemplateNFT[] = []
    ) {
        this._suiBalance = suiBalance;
        this._seats = seats;
        this._mapTemplateNFTs = mapTemplateNFTs;
        this._timestamp = Date.now();
    }

    // ===== 访问器（返回引用，无需复制） =====

    public get suiBalance(): bigint {
        return this._suiBalance;
    }

    public get seats(): Seat[] {
        return this._seats;
    }

    public get mapTemplateNFTs(): MapTemplateNFT[] {
        return this._mapTemplateNFTs;
    }

    public get timestamp(): number {
        return this._timestamp;
    }

    // ===== 更新方法（只允许在特定场景调用） =====

    public setSuiBalance(balance: bigint): void {
        this._suiBalance = balance;
        this._timestamp = Date.now();
    }

    public setSeats(seats: Seat[]): void {
        this._seats = seats;
        this._timestamp = Date.now();
    }

    // ===== Seat 辅助方法 =====

    /**
     * 根据游戏 ID 查找 Seat
     */
    public findSeatByGame(gameId: string): Seat | null {
        // console.log('[PlayerAssets] findSeatByGame, gameId: ', gameId);
        // console.log('[PlayerAssets] findSeatByGame, this._seats: ', this._seats);
        return this._seats.find(s => s.game_id === gameId) || null;
    }

    /**
     * 根据玩家索引查找 Seat
     */
    public findSeatByPlayerIndex(gameId: string, playerIndex: number): Seat | null {
        return this._seats.find(s =>
            s.game_id === gameId && s.player_index === playerIndex
        ) || null;
    }

    /**
     * 获取 Seat 数量
     */
    public getSeatCount(): number {
        return this._seats.length;
    }

    /**
     * 检查是否有指定游戏的 Seat
     */
    public hasSeatForGame(gameId: string): boolean {
        return this._seats.some(s => s.game_id === gameId);
    }

    // ===== 调试方法 =====

    public debugInfo(): string {
        return [
            `SUI: ${this._suiBalance.toString()}`,
            `Seats: ${this._seats.length}`,
            `Templates: ${this._mapTemplateNFTs.length}`,
            `Age: ${Date.now() - this._timestamp}ms`
        ].join(', ');
    }
}
