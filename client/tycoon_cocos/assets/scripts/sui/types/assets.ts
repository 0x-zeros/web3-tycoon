/**
 * 钱包资产类型定义
 * 包括 Coins、NFTs、DeFi 资产等
 */

/**
 * Seat NFT 信息
 */
export interface SeatNFT {
    /** Object ID */
    objectId: string;
    /** 游戏 ID */
    gameId: string;
    /** 玩家索引 */
    playerIndex: number;
    /** 玩家地址 */
    player: string;
}

/**
 * Map Template Creator NFT 信息（预留）
 */
export interface MapTemplateNFT {
    /** Object ID */
    objectId: string;
    /** 模板 ID */
    templateId: number;
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
 * 玩家资产汇总
 */
export interface PlayerAssets {
    /** SUI 余额 */
    suiBalance: bigint;
    /** 拥有的 Seat NFTs */
    seats: SeatNFT[];
    /** 拥有的 Map Template NFTs */
    mapTemplateNFTs: MapTemplateNFT[];
    /** DeFi 相关资产 */
    defiAssets: DeFiAssets;
    /** 缓存时间戳 */
    timestamp: number;
}
