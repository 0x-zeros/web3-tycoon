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
 * DeFi 资产信息（预留）
 */
export interface DeFiAssets {
    /**
     * Bucket Protocol 相关资产
     * 用途：去中心化数据存储、地图模板存储
     * 预留字段：
     * - bucketBalance: 在 Bucket 中存储的数据量
     * - storageNFTs: 存储凭证 NFT
     */
    bucketAssets?: {
        // TODO: 定义 Bucket Protocol 资产结构
        balance?: bigint;
        storageNFTs?: any[];
    };

    /**
     * Scallop Protocol 相关资产
     * 用途：借贷协议、地产抵押借贷
     * 预留字段：
     * - deposits: 存款资产
     * - borrows: 借款资产
     * - collateral: 抵押品
     */
    scallopAssets?: {
        // TODO: 定义 Scallop Protocol 资产结构
        deposits?: any[];
        borrows?: any[];
        collateral?: any[];
    };

    /**
     * Navi Protocol 相关资产
     * 用途：流动性挖矿、质押奖励
     * 预留字段：
     * - stakedAmount: 质押数量
     * - rewards: 待领取奖励
     * - lpTokens: LP Token 余额
     */
    naviAssets?: {
        // TODO: 定义 Navi Protocol 资产结构
        stakedAmount?: bigint;
        rewards?: bigint;
        lpTokens?: any[];
    };
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

    /** DeFi 相关资产 */
    private _defiAssets: DeFiAssets;

    /** 缓存时间戳 */
    private _timestamp: number;

    constructor(
        suiBalance: bigint = 0n,
        seats: Seat[] = [],
        mapTemplateNFTs: MapTemplateNFT[] = [],
        defiAssets: DeFiAssets = {}
    ) {
        this._suiBalance = suiBalance;
        this._seats = seats;
        this._mapTemplateNFTs = mapTemplateNFTs;
        this._defiAssets = defiAssets;
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

    public get defiAssets(): DeFiAssets {
        return this._defiAssets;
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
        return this._seats.find(s => s.game === gameId) || null;
    }

    /**
     * 根据玩家索引查找 Seat
     */
    public findSeatByPlayerIndex(gameId: string, playerIndex: number): Seat | null {
        return this._seats.find(s =>
            s.game === gameId && s.player_index === playerIndex
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
        return this._seats.some(s => s.game === gameId);
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
