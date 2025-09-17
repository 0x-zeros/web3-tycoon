/**
 * Sui 链上事件类型定义
 * 定义游戏合约可能发出的各种事件
 */

/**
 * 游戏核心事件
 */
export interface GameCreatedEvent {
    gameId: string;
    creator: string;
    maxPlayers: number;
    mapConfig: any;
    timestamp: number;
}

export interface GameStartedEvent {
    gameId: string;
    players: string[];
    startingPlayer: string;
    timestamp: number;
}

export interface GameEndedEvent {
    gameId: string;
    winner: string;
    finalScores: Record<string, number>;
    duration: number;
    timestamp: number;
}

/**
 * 玩家动作事件
 */
export interface PlayerJoinedEvent {
    gameId: string;
    player: string;
    playerIndex: number;
    timestamp: number;
}

export interface DiceRolledEvent {
    gameId: string;
    player: string;
    diceValue: number;
    newPosition: number;
    timestamp: number;
}

export interface PlayerMovedEvent {
    gameId: string;
    player: string;
    fromPosition: number;
    toPosition: number;
    passedStart: boolean;
    timestamp: number;
}

export interface PlayerBankruptEvent {
    gameId: string;
    player: string;
    reason: string;
    timestamp: number;
}

/**
 * 地产交易事件
 */
export interface PropertyPurchasedEvent {
    gameId: string;
    player: string;
    propertyId: string;
    price: number;
    position: number;
    timestamp: number;
}

export interface PropertyUpgradedEvent {
    gameId: string;
    player: string;
    propertyId: string;
    upgradeLevel: number;
    upgradeCost: number;
    timestamp: number;
}

export interface PropertyMortgagedEvent {
    gameId: string;
    player: string;
    propertyId: string;
    mortgageValue: number;
    timestamp: number;
}

export interface PropertyRedeemedEvent {
    gameId: string;
    player: string;
    propertyId: string;
    redemptionCost: number;
    timestamp: number;
}

export interface RentPaidEvent {
    gameId: string;
    payer: string;
    owner: string;
    propertyId: string;
    rentAmount: number;
    timestamp: number;
}

/**
 * 卡片事件
 */
export interface ChanceCardDrawnEvent {
    gameId: string;
    player: string;
    cardId: string;
    cardType: 'chance' | 'community';
    effect: string;
    timestamp: number;
}

export interface CardEffectAppliedEvent {
    gameId: string;
    player: string;
    cardId: string;
    effectType: string;
    effectValue: any;
    timestamp: number;
}

/**
 * 金钱交易事件
 */
export interface MoneyTransferEvent {
    gameId: string;
    from: string;
    to: string;
    amount: number;
    reason: string;
    timestamp: number;
}

export interface TaxPaidEvent {
    gameId: string;
    player: string;
    taxAmount: number;
    taxType: string;
    timestamp: number;
}

export interface SalaryCollectedEvent {
    gameId: string;
    player: string;
    salaryAmount: number;
    timestamp: number;
}

/**
 * DeFi 相关事件
 */
export interface PropertyStakedEvent {
    gameId: string;
    player: string;
    propertyId: string;
    stakingPool: string;
    expectedReward: number;
    timestamp: number;
}

export interface StakingRewardClaimedEvent {
    gameId: string;
    player: string;
    propertyId: string;
    rewardAmount: number;
    timestamp: number;
}

export interface LoanTakenEvent {
    gameId: string;
    player: string;
    loanAmount: number;
    interestRate: number;
    collateral: string[];
    timestamp: number;
}

export interface LoanRepaidEvent {
    gameId: string;
    player: string;
    loanId: string;
    repaidAmount: number;
    timestamp: number;
}

/**
 * NFT 相关事件
 */
export interface PropertyNFTMintedEvent {
    gameId: string;
    player: string;
    propertyId: string;
    nftId: string;
    metadata: any;
    timestamp: number;
}

export interface PropertyNFTTransferredEvent {
    gameId: string;
    from: string;
    to: string;
    propertyId: string;
    nftId: string;
    timestamp: number;
}

/**
 * 特殊位置事件
 */
export interface JailEnteredEvent {
    gameId: string;
    player: string;
    reason: 'landed' | 'card' | 'dice';
    timestamp: number;
}

export interface JailExitedEvent {
    gameId: string;
    player: string;
    method: 'dice' | 'payment' | 'card';
    timestamp: number;
}

export interface FreeParkingCollectedEvent {
    gameId: string;
    player: string;
    collectedAmount: number;
    timestamp: number;
}

/**
 * 事件类型枚举
 */
export enum SuiEventType {
    // 游戏核心
    GameCreated = 'GameCreated',
    GameStarted = 'GameStarted',
    GameEnded = 'GameEnded',

    // 玩家动作
    PlayerJoined = 'PlayerJoined',
    DiceRolled = 'DiceRolled',
    PlayerMoved = 'PlayerMoved',
    PlayerBankrupt = 'PlayerBankrupt',

    // 地产交易
    PropertyPurchased = 'PropertyPurchased',
    PropertyUpgraded = 'PropertyUpgraded',
    PropertyMortgaged = 'PropertyMortgaged',
    PropertyRedeemed = 'PropertyRedeemed',
    RentPaid = 'RentPaid',

    // 卡片
    ChanceCardDrawn = 'ChanceCardDrawn',
    CardEffectApplied = 'CardEffectApplied',

    // 金钱
    MoneyTransfer = 'MoneyTransfer',
    TaxPaid = 'TaxPaid',
    SalaryCollected = 'SalaryCollected',

    // DeFi
    PropertyStaked = 'PropertyStaked',
    StakingRewardClaimed = 'StakingRewardClaimed',
    LoanTaken = 'LoanTaken',
    LoanRepaid = 'LoanRepaid',

    // NFT
    PropertyNFTMinted = 'PropertyNFTMinted',
    PropertyNFTTransferred = 'PropertyNFTTransferred',

    // 特殊位置
    JailEntered = 'JailEntered',
    JailExited = 'JailExited',
    FreeParkingCollected = 'FreeParkingCollected'
}

/**
 * 通用事件包装器
 */
export interface SuiGameEvent<T = any> {
    /** 事件类型 */
    type: SuiEventType;
    /** 事件数据 */
    data: T;
    /** 区块高度 */
    blockHeight?: number;
    /** 交易哈希 */
    txHash?: string;
    /** 事件ID */
    eventId?: string;
    /** 时间戳 */
    timestamp: number;
}