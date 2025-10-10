/**
 * Player类 - 玩家角色
 * 
 * 包含玩家特有的属性和行为逻辑
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Role } from './Role';
import { RoleType, RoleAttribute, RoleState, NPCType } from './RoleTypes';

/**
 * 玩家类型枚举
 */
export enum PlayerType {
    HUMAN = 'human',        // 人类玩家
    AI_EASY = 'ai_easy',    // 简单AI
    AI_NORMAL = 'ai_normal', // 普通AI
    AI_HARD = 'ai_hard'     // 困难AI
}

/**
 * 玩家统计数据接口
 */
export interface PlayerStatistics {
    /** 游戏局数 */
    gamesPlayed: number;
    /** 胜利次数 */
    wins: number;
    /** 移动总步数 */
    totalSteps: number;
    /** 使用卡牌次数 */
    cardsUsed: number;
    /** 购买房产次数 */
    propertiesBought: number;
    /** 支付租金总额 */
    totalRentPaid: number;
    /** 收到租金总额 */
    totalRentReceived: number;
    /** 破产次数 */
    bankruptcyCount: number;
    /** 监狱次数 */
    jailCount: number;
    /** 最高资产 */
    maxWealth: number;
}

/**
 * 玩家财务状态接口
 */
export interface PlayerFinancialStatus {
    /** 现金 */
    cash: number;
    /** 房产价值 */
    propertyValue: number;
    /** 总资产 */
    totalAssets: number;
    /** 债务 */
    debt: number;
    /** 收入 */
    income: {
        rent: number;        // 租金收入
        salary: number;      // 过起点工资
        bonus: number;       // 奖金
        other: number;       // 其他收入
    };
    /** 支出 */
    expenses: {
        rent: number;        // 租金支出
        tax: number;         // 税费
        fine: number;        // 罚款
        cardCost: number;    // 卡牌费用
        other: number;       // 其他支出
    };
}

/**
 * 房产数据接口
 */
export interface PropertyData {
    /** 房产ID */
    id: number;
    /** 房产名称 */
    name: string;
    /** 购买价格 */
    purchasePrice: number;
    /** 当前价值 */
    currentValue: number;
    /** 房屋数量 */
    houses: number;
    /** 是否有酒店 */
    hasHotel: boolean;
    /** 房产组 */
    group: string;
    /** 地块ID */
    tileId: number;
}

/**
 * 玩家类
 * 继承自Role，包含玩家特有的属性和行为
 */
export class Player extends Role {
    
    // ========================= 玩家特有属性 =========================
    
    /** 玩家类型 */
    protected m_playerType: PlayerType = PlayerType.HUMAN;
    
    /** 是否AI控制 */
    protected m_bIsAI: boolean = false;
    
    /** 回合顺序 */
    protected m_iTurnOrder: number = 0;
    
    /** VIP等级 */
    protected m_iVipLevel: number = 0;
    
    /** 公会ID */
    protected m_iGuildId: number = 0;
    
    /** 是否准备就绪 */
    protected m_bReady: boolean = false;

    // ========================= 游戏相关数据 =========================
    
    /** 拥有的房产 */
    protected m_properties: PropertyData[] = [];
    
    /** 玩家统计数据 */
    protected m_statistics: PlayerStatistics;
    
    /** 财务状态 */
    protected m_financialStatus: PlayerFinancialStatus;
    
    /** 连续掷出双数次数（监狱相关） */
    protected m_consecutiveDoubles: number = 0;
    
    /** 本回合是否已掷骰 */
    protected m_hasRolledDice: boolean = false;
    
    /** 本回合移动次数 */
    protected m_movesThisTurn: number = 0;
    
    // ========================= 特殊状态 =========================
    
    /** 监狱回合数 */
    protected m_jailTurns: number = 0;
    
    /** 是否拥有出狱卡 */
    protected m_hasGetOutOfJailCard: boolean = false;
    
    /** 破产状态 */
    protected m_bBankrupt: boolean = false;
    
    /** 免租回合数（某些卡牌效果） */
    protected m_freeRentTurns: number = 0;
    
    // ========================= 构造和初始化 =========================
    
    constructor() {
        super();
        this.m_eType = RoleType.PLAYER;
        this.initializePlayerData();
    }
    
    /**
     * 初始化玩家数据
     */
    protected initializePlayerData(): void {
        // 初始化统计数据
        this.m_statistics = {
            gamesPlayed: 0,
            wins: 0,
            totalSteps: 0,
            cardsUsed: 0,
            propertiesBought: 0,
            totalRentPaid: 0,
            totalRentReceived: 0,
            bankruptcyCount: 0,
            jailCount: 0,
            maxWealth: 0
        };
        
        // 初始化财务状态
        this.m_financialStatus = {
            cash: 15000, // 初始资金
            propertyValue: 0,
            totalAssets: 15000,
            debt: 0,
            income: {
                rent: 0,
                salary: 0,
                bonus: 0,
                other: 0
            },
            expenses: {
                rent: 0,
                tax: 0,
                fine: 0,
                cardCost: 0,
                other: 0
            }
        };
        
        // 设置玩家默认属性
        this.setAttr(RoleAttribute.MONEY, 15000);
        this.setAttr(RoleAttribute.TURN_ORDER, 0);
    }

    // ========================= 房产管理 =========================
    
    /**
     * 购买房产
     */
    public buyProperty(propertyData: PropertyData): boolean {
        // 检查资金是否足够
        if (this.getAttr(RoleAttribute.MONEY) < propertyData.purchasePrice) {
            console.log(`[Player] ${this.m_strName} 资金不足，无法购买房产: ${propertyData.name}`);
            return false;
        }
        
        // 扣除金钱
        this.addAttr(RoleAttribute.MONEY, -propertyData.purchasePrice);
        
        // 添加房产
        this.m_properties.push(propertyData);
        this.setAttr(RoleAttribute.PROPERTIES_COUNT, this.m_properties.length);
        
        // 更新财务状态
        this.m_financialStatus.cash = this.getAttr(RoleAttribute.MONEY);
        this.m_financialStatus.propertyValue += propertyData.currentValue;
        this.updateTotalAssets();
        
        // 更新统计
        this.m_statistics.propertiesBought++;
        this.m_financialStatus.expenses.other += propertyData.purchasePrice;
        
        // 触发购买房产事件
        this.emit('property-bought', {
            player: this,
            property: propertyData
        });
        
        console.log(`[Player] ${this.m_strName} 购买房产: ${propertyData.name}, 价格: ${propertyData.purchasePrice}`);
        return true;
    }
    
    /**
     * 出售房产
     */
    public sellProperty(propertyId: number): boolean {
        const propertyIndex = this.m_properties.findIndex(p => p.id === propertyId);
        if (propertyIndex < 0) {
            console.warn(`[Player] 房产不存在: ${propertyId}`);
            return false;
        }
        
        const property = this.m_properties[propertyIndex];
        const sellPrice = Math.floor(property.currentValue * 0.9); // 90%价格出售
        
        // 增加金钱
        this.addAttr(RoleAttribute.MONEY, sellPrice);
        
        // 移除房产
        this.m_properties.splice(propertyIndex, 1);
        this.setAttr(RoleAttribute.PROPERTIES_COUNT, this.m_properties.length);
        
        // 更新财务状态
        this.m_financialStatus.cash = this.getAttr(RoleAttribute.MONEY);
        this.m_financialStatus.propertyValue -= property.currentValue;
        this.m_financialStatus.income.other += sellPrice;
        this.updateTotalAssets();
        
        // 触发出售房产事件
        this.emit('property-sold', {
            player: this,
            property: property,
            sellPrice: sellPrice
        });
        
        console.log(`[Player] ${this.m_strName} 出售房产: ${property.name}, 价格: ${sellPrice}`);
        return true;
    }
    
    /**
     * 获取拥有的房产
     */
    public getProperties(): PropertyData[] {
        return [...this.m_properties];
    }
    
    /**
     * 根据地块ID查找房产
     */
    public getPropertyByTileId(tileId: number): PropertyData | null {
        return this.m_properties.find(p => p.tileId === tileId) || null;
    }
    
    // ========================= 财务管理 =========================
    
    /**
     * 支付金钱
     */
    public payMoney(amount: number, category: string = 'other'): boolean {
        if (amount <= 0) return true;
        
        const currentMoney = this.getAttr(RoleAttribute.MONEY);
        if (currentMoney < amount) {
            // 资金不足，尝试抵押房产或破产
            console.log(`[Player] ${this.m_strName} 资金不足，需要: ${amount}, 拥有: ${currentMoney}`);
            return this.handleInsufficientFunds(amount, category);
        }
        
        // 扣除金钱
        this.addAttr(RoleAttribute.MONEY, -amount);
        
        // 更新财务状态
        this.m_financialStatus.cash = this.getAttr(RoleAttribute.MONEY);
        this.updateExpenses(category, amount);
        this.updateTotalAssets();
        
        return true;
    }
    
    /**
     * 收取金钱
     */
    public receiveMoney(amount: number, category: string = 'other'): void {
        if (amount <= 0) return;
        
        // 增加金钱
        this.addAttr(RoleAttribute.MONEY, amount);
        
        // 更新财务状态
        this.m_financialStatus.cash = this.getAttr(RoleAttribute.MONEY);
        this.updateIncome(category, amount);
        this.updateTotalAssets();
    }
    
    /**
     * 处理资金不足情况
     */
    protected handleInsufficientFunds(amount: number, category: string): boolean {
        // 资金不足，直接破产
        this.goBankrupt();
        return false;
    }
    
    /**
     * 破产处理
     */
    protected goBankrupt(): void {
        this.m_bBankrupt = true;
        this.setAttr(RoleAttribute.BANKRUPT, 1);
        this.setState(RoleState.BANKRUPT);
        
        // 更新统计
        this.m_statistics.bankruptcyCount++;
        
        // 触发破产事件
        this.emit('player-bankrupt', { player: this });
        
        console.log(`[Player] ${this.m_strName} 破产了！`);
    }
    
    // ========================= 回合管理 =========================
    
    /**
     * 开始回合
     */
    public startTurn(): void {
        this.m_hasRolledDice = false;
        this.m_movesThisTurn = 0;
        this.m_consecutiveDoubles = 0;
        
        // 处理监狱状态
        if (this.isInJail()) {
            this.m_jailTurns--;
            if (this.m_jailTurns <= 0) {
                this.exitJail();
            }
        }
        
        // 处理免租状态
        if (this.m_freeRentTurns > 0) {
            this.m_freeRentTurns--;
        }
        
        // 触发回合开始事件
        this.emit('turn-start', { player: this });
        
        console.log(`[Player] ${this.m_strName} 开始回合`);
    }
    
    /**
     * 结束回合
     */
    public endTurn(): void {
        // 更新统计
        this.m_statistics.totalSteps += this.m_movesThisTurn;
        
        // 触发回合结束事件
        this.emit('turn-end', {
            player: this,
            moves: this.m_movesThisTurn,
            diceRolled: this.m_hasRolledDice
        });
        
        console.log(`[Player] ${this.m_strName} 结束回合`);
    }
    
    // ========================= 监狱系统 =========================
    
    /**
     * 进入监狱
     */
    public goToJail(): void {
        this.m_jailTurns = 3; // 监狱3回合
        this.setAttr(RoleAttribute.JAIL_TURNS, this.m_jailTurns);
        this.setState(RoleState.JAILED);
        
        // 移动到监狱地块（通常是地块10）
        this.setCurrentTileId(10);
        
        // 更新统计
        this.m_statistics.jailCount++;
        
        // 触发进入监狱事件
        this.emit('player-jailed', { player: this });
        
        console.log(`[Player] ${this.m_strName} 被关进监狱`);
    }
    
    /**
     * 离开监狱
     */
    public exitJail(): void {
        this.m_jailTurns = 0;
        this.setAttr(RoleAttribute.JAIL_TURNS, 0);
        this.setState(RoleState.IDLE);
        
        // 触发离开监狱事件
        this.emit('player-exit-jail', { player: this });
        
        console.log(`[Player] ${this.m_strName} 出狱了`);
    }
    
    /**
     * 使用出狱卡
     */
    public useGetOutOfJailCard(): boolean {
        if (!this.m_hasGetOutOfJailCard || !this.isInJail()) {
            return false;
        }
        
        this.m_hasGetOutOfJailCard = false;
        this.exitJail();
        
        console.log(`[Player] ${this.m_strName} 使用出狱卡出狱`);
        return true;
    }
    
    // ========================= AI相关 =========================
    
    /**
     * 设置AI类型
     */
    public setAI(isAI: boolean, playerType: PlayerType = PlayerType.AI_NORMAL): void {
        this.m_bIsAI = isAI;
        this.m_playerType = playerType;
        
        console.log(`[Player] ${this.m_strName} 设置为${isAI ? 'AI' : '人类'}玩家 (${playerType})`);
    }
    
    /**
     * 是否AI控制
     */
    public isAI(): boolean {
        return this.m_bIsAI;
    }
    
    /**
     * 获取AI决策（子类可重写）
     */
    public makeAIDecision(situation: string, options: any[]): any {
        if (!this.m_bIsAI) {
            return null;
        }
        
        // 简单的AI决策逻辑
        switch (this.m_playerType) {
            case PlayerType.AI_EASY:
                return this.makeEasyAIDecision(situation, options);
            case PlayerType.AI_NORMAL:
                return this.makeNormalAIDecision(situation, options);
            case PlayerType.AI_HARD:
                return this.makeHardAIDecision(situation, options);
            default:
                return options[0]; // 默认选择第一个选项
        }
    }
    
    protected makeEasyAIDecision(situation: string, options: any[]): any {
        // 简单AI：随机选择
        return options[Math.floor(Math.random() * options.length)];
    }
    
    protected makeNormalAIDecision(situation: string, options: any[]): any {
        // 普通AI：简单的策略逻辑
        return options[0]; // 暂时简化
    }
    
    protected makeHardAIDecision(situation: string, options: any[]): any {
        // 困难AI：复杂的策略逻辑
        return options[0]; // 暂时简化
    }
    
    // ========================= 辅助方法 =========================
    
    /**
     * 更新总资产
     */
    protected updateTotalAssets(): void {
        this.m_financialStatus.totalAssets = 
            this.m_financialStatus.cash + 
            this.m_financialStatus.propertyValue - 
            this.m_financialStatus.debt;
        
        // 更新最高资产记录
        if (this.m_financialStatus.totalAssets > this.m_statistics.maxWealth) {
            this.m_statistics.maxWealth = this.m_financialStatus.totalAssets;
        }
    }
    
    /**
     * 更新收入统计
     */
    protected updateIncome(category: string, amount: number): void {
        switch (category) {
            case 'rent':
                this.m_financialStatus.income.rent += amount;
                this.m_statistics.totalRentReceived += amount;
                break;
            case 'salary':
                this.m_financialStatus.income.salary += amount;
                break;
            case 'bonus':
                this.m_financialStatus.income.bonus += amount;
                break;
            default:
                this.m_financialStatus.income.other += amount;
                break;
        }
    }
    
    /**
     * 更新支出统计
     */
    protected updateExpenses(category: string, amount: number): void {
        switch (category) {
            case 'rent':
                this.m_financialStatus.expenses.rent += amount;
                this.m_statistics.totalRentPaid += amount;
                break;
            case 'tax':
                this.m_financialStatus.expenses.tax += amount;
                break;
            case 'fine':
                this.m_financialStatus.expenses.fine += amount;
                break;
            case 'card':
                this.m_financialStatus.expenses.cardCost += amount;
                break;
            default:
                this.m_financialStatus.expenses.other += amount;
                break;
        }
    }
    
    // ========================= 状态检查 =========================
    
    /**
     * 是否准备就绪
     */
    public isReady(): boolean {
        return this.m_bReady;
    }
    
    /**
     * 设置准备状态
     */
    public setReady(ready: boolean): void {
        this.m_bReady = ready;
        this.emit('player-ready-changed', { player: this, ready: ready });
    }
    
    /**
     * 是否可以购买房产
     */
    public canBuyProperty(price: number): boolean {
        return !this.m_bBankrupt && 
               !this.isInJail() && 
               this.getAttr(RoleAttribute.MONEY) >= price;
    }
    
    /**
     * 是否有免租效果
     */
    public hasFreeRent(): boolean {
        return this.m_freeRentTurns > 0;
    }
    
    // ========================= 访问器 =========================
    
    public getPlayerType(): PlayerType { return this.m_playerType; }
    public getTurnOrder(): number { return this.m_iTurnOrder; }
    public setTurnOrder(order: number): void { 
        this.m_iTurnOrder = order;
        this.setAttr(RoleAttribute.TURN_ORDER, order);
    }
    
    public getVipLevel(): number { return this.m_iVipLevel; }
    public setVipLevel(level: number): void { 
        this.m_iVipLevel = level;
        this.setAttr(RoleAttribute.VIP_LEVEL, level);
    }
    
    public getStatistics(): PlayerStatistics { return { ...this.m_statistics }; }
    public getFinancialStatus(): PlayerFinancialStatus { 
        // 更新实时数据
        this.m_financialStatus.cash = this.getAttr(RoleAttribute.MONEY);
        this.updateTotalAssets();
        return { ...this.m_financialStatus };
    }
    
    public hasGetOutOfJailCard(): boolean { return this.m_hasGetOutOfJailCard; }
    public setGetOutOfJailCard(has: boolean): void { this.m_hasGetOutOfJailCard = has; }
    
    // ========================= 重写方法 =========================
    
    /**
     * 重写属性变化回调
     */
    protected onAttributeChanged(attr: RoleAttribute, oldValue: number, newValue: number): void {
        super.onAttributeChanged(attr, oldValue, newValue);
        
        // 玩家特有的属性变化处理
        switch (attr) {
            case RoleAttribute.MONEY:
                this.m_financialStatus.cash = newValue;
                this.updateTotalAssets();
                break;
            case RoleAttribute.JAIL_TURNS:
                this.m_jailTurns = newValue;
                break;
        }
    }
    
    /**
     * 重写重置方法
     */
    public reset(): void {
        super.reset();
        
        // 重置玩家特有数据
        this.m_bIsAI = false;
        this.m_playerType = PlayerType.HUMAN;
        this.m_iTurnOrder = 0;
        this.m_iVipLevel = 0;
        this.m_bReady = false;
        this.m_properties.length = 0;
        this.m_jailTurns = 0;
        this.m_hasGetOutOfJailCard = false;
        this.m_bBankrupt = false;
        this.m_freeRentTurns = 0;
        this.m_consecutiveDoubles = 0;
        this.m_hasRolledDice = false;
        this.m_movesThisTurn = 0;

        // 重新初始化数据
        this.initializePlayerData();

        console.log(`[Player] 玩家重置完成: ${this.m_strName}`);
    }
    
    /**
     * 重写调试信息
     */
    public debugInfo(): string {
        const baseInfo = super.debugInfo();
        const playerInfo = [
            `类型: ${this.m_playerType}`,
            `AI: ${this.m_bIsAI}`,
            `回合: ${this.m_iTurnOrder}`,
            `现金: ${this.getAttr(RoleAttribute.MONEY)}`,
            `房产: ${this.m_properties.length}`,
            `监狱: ${this.m_jailTurns}`,
            `破产: ${this.m_bBankrupt}`
        ];
        
        return `${baseInfo}, ${playerInfo.join(', ')}`;
    }
}