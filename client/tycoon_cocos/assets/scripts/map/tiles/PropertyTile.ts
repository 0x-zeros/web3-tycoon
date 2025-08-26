/**
 * 地产地块
 * 
 * 可购买、建设、收租的地产地块，是大富翁游戏的核心地块类型
 * 支持购买、建设房屋、收取租金、抵押等完整的地产功能
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component, Color, Node, Label, MeshRenderer } from 'cc';
import { MapTile, TileInteractionResult } from '../core/MapTile';
import { MapTileData, TileType, PropertyData, PropertyGroup } from '../types/MapTypes';
import { PlayerData, GameEventType } from '../types/GameTypes';

const { ccclass, property } = _decorator;

/**
 * 建筑类型枚举
 */
enum BuildingType {
    /** 空地 */
    EMPTY = 0,
    /** 房屋1-4级 */
    HOUSE_1 = 1,
    HOUSE_2 = 2,
    HOUSE_3 = 3,
    HOUSE_4 = 4,
    /** 酒店 */
    HOTEL = 5
}

/**
 * 地产交互选项
 */
interface PropertyInteractionOptions {
    /** 是否可以购买 */
    canPurchase: boolean;
    /** 是否可以建设 */
    canBuild: boolean;
    /** 是否可以出售 */
    canSell: boolean;
    /** 是否可以抵押 */
    canMortgage: boolean;
    /** 是否需要支付租金 */
    needPayRent: boolean;
    /** 当前租金金额 */
    currentRent: number;
}

/**
 * 地产地块实现类
 * 提供完整的地产购买、建设、租金收取功能
 */
@ccclass('PropertyTile')
export class PropertyTile extends MapTile {
    
    // ========================= 编辑器属性 =========================
    
    @property({ displayName: "地产价格", tooltip: "购买此地产的价格" })
    public purchasePrice: number = 100;
    
    @property({ displayName: "基础租金", tooltip: "空地状态下的租金" })
    public baseRent: number = 10;
    
    @property({ displayName: "建房费用", tooltip: "建设每栋房屋的费用" })
    public houseCost: number = 50;
    
    @property({ displayName: "酒店费用", tooltip: "建设酒店的费用" })
    public hotelCost: number = 200;
    
    @property({ displayName: "抵押价值", tooltip: "抵押时可获得的金额" })
    public mortgageValue: number = 50;
    
    @property({ displayName: "地产组", tooltip: "所属的地产颜色组" })
    public propertyGroupName: string = 'brown';
    
    @property({ displayName: "显示建筑", tooltip: "是否显示建筑物3D模型" })
    public showBuildings: boolean = true;
    
    @property({ displayName: "建筑容器", type: Node, tooltip: "用于放置建筑模型的父节点" })
    public buildingsContainer: Node | null = null;
    
    @property({ displayName: "价格标签", type: Label, tooltip: "显示地产价格的标签" })
    public priceLabel: Label | null = null;
    
    @property({ displayName: "拥有者标签", type: Label, tooltip: "显示地产拥有者的标签" })
    public ownerLabel: Label | null = null;
    
    // ========================= 私有属性 =========================
    
    /** 地产数据 */
    private _propertyData: PropertyData | null = null;
    
    /** 租金等级表 */
    private _rentLevels: number[] = [];
    
    /** 建筑物节点列表 */
    private _buildingNodes: Node[] = [];
    
    /** 是否正在交互中 */
    private _isInteracting: boolean = false;
    
    // ========================= 抽象方法实现 =========================
    
    /**
     * 获取地块类型
     */
    public get tileType(): TileType {
        return TileType.PROPERTY;
    }
    
    /**
     * 地块初始化
     * @param tileData 地块数据
     */
    protected onTileInitialized(tileData: MapTileData): void {
        if (!tileData.propertyData) {
            console.error('[PropertyTile] 地产地块缺少地产数据');
            return;
        }
        
        this._propertyData = tileData.propertyData;
        
        // 更新属性
        this.purchasePrice = this._propertyData.price;
        this.baseRent = this._propertyData.rent[0];
        this.houseCost = this._propertyData.buildCost;
        this.hotelCost = this._propertyData.hotelCost;
        this._rentLevels = [...this._propertyData.rent];
        
        // 设置抵押价值为购买价格的一半
        this.mortgageValue = Math.floor(this.purchasePrice * 0.5);
        
        // 初始化UI
        this.updatePropertyUI();
        
        // 初始化建筑显示
        this.updateBuildingDisplay();
        
        console.log(`[PropertyTile] 地产地块初始化完成: ${this.tileName}, 价格: ${this.purchasePrice}`);
    }
    
    /**
     * 玩家停留处理
     * 根据地产状态处理购买、租金等逻辑
     * @param player 停留的玩家
     */
    protected async onPlayerLandOn(player: PlayerData): Promise<TileInteractionResult> {
        if (!this._propertyData || this._isInteracting) {
            return {
                success: false,
                message: '地产数据错误或正在交互中',
                events: []
            };
        }
        
        this._isInteracting = true;
        
        try {
            console.log(`[PropertyTile] 玩家 ${player.nickname} 停留在地产 ${this.tileName}`);
            
            // 检查交互选项
            const options = this.getInteractionOptions(player);
            
            if (options.needPayRent) {
                // 需要支付租金
                return await this.handleRentPayment(player, options.currentRent);
            } else if (options.canPurchase) {
                // 可以购买
                return await this.handlePurchaseOption(player);
            } else if (this._propertyData.ownerId === player.id) {
                // 自己的地产，可以建设
                return await this.handleOwnerOptions(player);
            } else {
                // 其他情况（如被抵押的地产）
                return {
                    success: true,
                    message: `这是 ${this.getOwnerName()} 的地产，但目前被抵押中`,
                    events: [],
                    blockMovement: false
                };
            }
        } finally {
            this._isInteracting = false;
        }
    }
    
    // ========================= 地产交互处理 =========================
    
    /**
     * 获取交互选项
     * @param player 当前玩家
     */
    private getInteractionOptions(player: PlayerData): PropertyInteractionOptions {
        if (!this._propertyData) {
            return {
                canPurchase: false,
                canBuild: false,
                canSell: false,
                canMortgage: false,
                needPayRent: false,
                currentRent: 0
            };
        }
        
        const isOwner = this._propertyData.ownerId === player.id;
        const isUnowned = this._propertyData.ownerId === null;
        const isMortgaged = this._propertyData.isMortgaged;
        
        let currentRent = 0;
        if (!isOwner && !isUnowned && !isMortgaged) {
            currentRent = this.calculateCurrentRent();
        }
        
        return {
            canPurchase: isUnowned && player.financialStatus.cash >= this.purchasePrice,
            canBuild: isOwner && !isMortgaged && this.canBuildMore(),
            canSell: isOwner && this._propertyData.buildingLevel > 0,
            canMortgage: isOwner && !isMortgaged && this._propertyData.buildingLevel === 0,
            needPayRent: !isOwner && !isUnowned && !isMortgaged,
            currentRent: currentRent
        };
    }
    
    /**
     * 处理租金支付
     * @param player 支付租金的玩家
     * @param rentAmount 租金金额
     */
    private async handleRentPayment(player: PlayerData, rentAmount: number): Promise<TileInteractionResult> {
        if (!this._propertyData) {
            return { success: false, message: '地产数据错误', events: [] };
        }
        
        // 检查玩家是否有免租卡效果
        const hasFreeRentStatus = player.statusEffects.some(effect => 
            effect.type === 'free_rent' && effect.remainingTurns !== 0
        );
        
        if (hasFreeRentStatus) {
            // 消耗免租状态
            this.consumeFreeRentStatus(player);
            
            return {
                success: true,
                message: `使用免租卡，免费通过 ${this.tileName}！`,
                events: [{
                    eventId: `rent_free_${Date.now()}`,
                    type: GameEventType.CARD_USE,
                    timestamp: Date.now(),
                    turnNumber: 0,
                    actorPlayerId: player.id,
                    targetPlayerId: this._propertyData.ownerId!,
                    affectedTileId: this._propertyData ? this.getTileData()?.id : undefined,
                    parameters: { originalRent: rentAmount, cardType: 'free_rent' },
                    description: `${player.nickname} 使用免租卡通过 ${this.tileName}`,
                    result: { rentPaid: 0 }
                }],
                moneyChange: 0,
                blockMovement: false
            };
        }
        
        // 检查玩家余额
        if (player.financialStatus.cash < rentAmount) {
            // 余额不足，可能需要抵押或破产
            return {
                success: false,
                message: `余额不足！需要支付租金 ${rentAmount}，但只有 ${player.financialStatus.cash}`,
                needUserInput: true,
                events: [],
                blockMovement: true
            };
        }
        
        // 支付租金
        player.financialStatus.cash -= rentAmount;
        player.financialStatus.expenses.rent += rentAmount;
        player.statistics.totalRentPaid += rentAmount;
        
        // 地产拥有者收取租金
        // TODO: 这里需要通过GameManager获取地产拥有者对象
        // const owner = gameManager.getPlayer(this._propertyData.ownerId!);
        // owner.financialStatus.cash += rentAmount;
        // owner.financialStatus.income.rent += rentAmount;
        // owner.statistics.totalRentCollected += rentAmount;
        
        const events = [{
            eventId: `rent_payment_${Date.now()}`,
            type: GameEventType.RENT_PAYMENT,
            timestamp: Date.now(),
            turnNumber: 0,
            actorPlayerId: player.id,
            targetPlayerId: this._propertyData.ownerId!,
            affectedTileId: this.getTileData()?.id,
            parameters: {
                amount: rentAmount,
                propertyName: this.tileName,
                buildingLevel: this._propertyData.buildingLevel
            },
            description: `${player.nickname} 向 ${this.getOwnerName()} 支付租金 ${rentAmount}`,
            result: { tenantBalance: player.financialStatus.cash }
        }];
        
        return {
            success: true,
            message: `支付租金 ${rentAmount} 给 ${this.getOwnerName()}`,
            events: events,
            moneyChange: -rentAmount,
            blockMovement: false
        };
    }
    
    /**
     * 处理购买选项
     * @param player 要购买的玩家
     */
    private async handlePurchaseOption(player: PlayerData): Promise<TileInteractionResult> {
        if (!this._propertyData) {
            return { success: false, message: '地产数据错误', events: [] };
        }
        
        // 这里应该弹出购买确认对话框，让玩家选择是否购买
        // 为了MVP简化，我们假设玩家总是选择购买（如果有钱的话）
        
        if (player.financialStatus.cash < this.purchasePrice) {
            return {
                success: false,
                message: `资金不足！需要 ${this.purchasePrice}，但只有 ${player.financialStatus.cash}`,
                events: [],
                blockMovement: false
            };
        }
        
        // 执行购买
        return await this.purchaseProperty(player);
    }
    
    /**
     * 处理地产拥有者选项
     * @param player 地产拥有者
     */
    private async handleOwnerOptions(player: PlayerData): Promise<TileInteractionResult> {
        // 地产拥有者停留在自己的地产上
        // 可以选择建设、出售建筑等
        
        const options = this.getInteractionOptions(player);
        
        const availableActions: string[] = [];
        if (options.canBuild) availableActions.push('建设');
        if (options.canSell) availableActions.push('出售建筑');
        if (options.canMortgage) availableActions.push('抵押');
        
        return {
            success: true,
            message: `这是你的地产！可用操作: ${availableActions.join(', ')}`,
            needUserInput: availableActions.length > 0,
            events: [],
            blockMovement: false
        };
    }
    
    // ========================= 地产操作方法 =========================
    
    /**
     * 购买地产
     * @param player 购买者
     */
    public async purchaseProperty(player: PlayerData): Promise<TileInteractionResult> {
        if (!this._propertyData || this._propertyData.ownerId !== null) {
            return { success: false, message: '地产不可购买', events: [] };
        }
        
        if (player.financialStatus.cash < this.purchasePrice) {
            return { success: false, message: '资金不足', events: [] };
        }
        
        // 扣除购买费用
        player.financialStatus.cash -= this.purchasePrice;
        player.financialStatus.expenses.property += this.purchasePrice;
        player.statistics.propertiesPurchased++;
        
        // 设置地产拥有者
        this._propertyData.ownerId = player.id;
        player.ownedPropertyIds.push(this.getTileData()!.id);
        
        // 更新地产价值
        player.financialStatus.propertyValue += this.purchasePrice;
        
        // 更新UI
        this.updatePropertyUI();
        
        const events = [{
            eventId: `property_purchase_${Date.now()}`,
            type: GameEventType.PROPERTY_PURCHASE,
            timestamp: Date.now(),
            turnNumber: 0,
            actorPlayerId: player.id,
            affectedTileId: this.getTileData()?.id,
            parameters: {
                propertyName: this.tileName,
                price: this.purchasePrice,
                propertyGroup: this._propertyData.group
            },
            description: `${player.nickname} 购买了 ${this.tileName}`,
            result: { newBalance: player.financialStatus.cash }
        }];
        
        console.log(`[PropertyTile] 玩家 ${player.nickname} 购买了地产 ${this.tileName}`);
        
        return {
            success: true,
            message: `成功购买 ${this.tileName}！花费 ${this.purchasePrice}`,
            events: events,
            moneyChange: -this.purchasePrice,
            blockMovement: false
        };
    }
    
    /**
     * 建设建筑
     * @param player 建设者（必须是地产拥有者）
     * @param buildingType 建筑类型
     */
    public async buildBuilding(player: PlayerData, buildingType: BuildingType = BuildingType.HOUSE_1): Promise<TileInteractionResult> {
        if (!this._propertyData || this._propertyData.ownerId !== player.id) {
            return { success: false, message: '只有地产拥有者才能建设', events: [] };
        }
        
        if (this._propertyData.isMortgaged) {
            return { success: false, message: '抵押中的地产不能建设', events: [] };
        }
        
        if (!this.canBuildMore()) {
            return { success: false, message: '无法再建设更多建筑', events: [] };
        }
        
        const buildCost = this.getBuildCost(buildingType);
        if (player.financialStatus.cash < buildCost) {
            return { success: false, message: `资金不足，需要 ${buildCost}`, events: [] };
        }
        
        // 扣除建设费用
        player.financialStatus.cash -= buildCost;
        player.financialStatus.expenses.building += buildCost;
        player.statistics.buildingsConstructed++;
        
        // 升级建筑等级
        this._propertyData.buildingLevel++;
        
        // 更新建筑价值
        player.financialStatus.buildingValue += buildCost;
        
        // 更新显示
        this.updateBuildingDisplay();
        this.updatePropertyUI();
        
        const events = [{
            eventId: `building_construction_${Date.now()}`,
            type: GameEventType.BUILDING_CONSTRUCTION,
            timestamp: Date.now(),
            turnNumber: 0,
            actorPlayerId: player.id,
            affectedTileId: this.getTileData()?.id,
            parameters: {
                propertyName: this.tileName,
                buildingType: BuildingType[buildingType],
                buildCost: buildCost,
                newLevel: this._propertyData.buildingLevel
            },
            description: `${player.nickname} 在 ${this.tileName} 建设了 ${BuildingType[buildingType]}`,
            result: { newBalance: player.financialStatus.cash }
        }];
        
        console.log(`[PropertyTile] 玩家 ${player.nickname} 在 ${this.tileName} 建设了建筑`);
        
        return {
            success: true,
            message: `成功建设 ${BuildingType[buildingType]}！花费 ${buildCost}`,
            events: events,
            moneyChange: -buildCost,
            blockMovement: false
        };
    }
    
    /**
     * 抵押地产
     * @param player 地产拥有者
     */
    public async mortgageProperty(player: PlayerData): Promise<TileInteractionResult> {
        if (!this._propertyData || this._propertyData.ownerId !== player.id) {
            return { success: false, message: '只有地产拥有者才能抵押', events: [] };
        }
        
        if (this._propertyData.isMortgaged) {
            return { success: false, message: '地产已经被抵押', events: [] };
        }
        
        if (this._propertyData.buildingLevel > 0) {
            return { success: false, message: '有建筑的地产无法抵押，请先出售建筑', events: [] };
        }
        
        // 获得抵押金
        player.financialStatus.cash += this.mortgageValue;
        this._propertyData.isMortgaged = true;
        
        // 更新UI
        this.updatePropertyUI();
        
        return {
            success: true,
            message: `${this.tileName} 已抵押，获得 ${this.mortgageValue}`,
            events: [],
            moneyChange: this.mortgageValue,
            blockMovement: false
        };
    }
    
    // ========================= 计算和工具方法 =========================
    
    /**
     * 计算当前租金
     */
    private calculateCurrentRent(): number {
        if (!this._propertyData || this._propertyData.isMortgaged) {
            return 0;
        }
        
        const baseRent = this._rentLevels[this._propertyData.buildingLevel] || this.baseRent;
        
        // TODO: 检查垄断加成
        // 如果玩家拥有同色组的所有地产，租金加倍
        const hasMonopoly = this.checkMonopoly();
        
        return hasMonopoly && this._propertyData.buildingLevel === 0 ? baseRent * 2 : baseRent;
    }
    
    /**
     * 检查是否形成垄断
     */
    private checkMonopoly(): boolean {
        // TODO: 这里需要通过GameManager检查同色组的其他地产
        // 简化实现：假设没有垄断
        return false;
    }
    
    /**
     * 检查是否可以建设更多建筑
     */
    private canBuildMore(): boolean {
        return this._propertyData !== null && 
               this._propertyData.buildingLevel < 5 && // 最大5级（酒店）
               !this._propertyData.isMortgaged;
    }
    
    /**
     * 获取建设费用
     */
    private getBuildCost(buildingType: BuildingType): number {
        switch (buildingType) {
            case BuildingType.HOTEL:
                return this.hotelCost;
            default:
                return this.houseCost;
        }
    }
    
    /**
     * 获取地产拥有者名称
     */
    private getOwnerName(): string {
        if (!this._propertyData || !this._propertyData.ownerId) {
            return '无主';
        }
        
        // TODO: 通过GameManager获取玩家昵称
        return `玩家${this._propertyData.ownerId}`;
    }
    
    /**
     * 消耗免租状态
     */
    private consumeFreeRentStatus(player: PlayerData): void {
        const freeRentEffect = player.statusEffects.find(effect => 
            effect.type === 'free_rent' && effect.remainingTurns !== 0
        );
        
        if (freeRentEffect) {
            if (freeRentEffect.remainingTurns > 0) {
                freeRentEffect.remainingTurns--;
            }
            
            // 如果是一次性效果，直接移除
            if (freeRentEffect.remainingTurns === 0) {
                const index = player.statusEffects.indexOf(freeRentEffect);
                if (index !== -1) {
                    player.statusEffects.splice(index, 1);
                }
            }
        }
    }
    
    // ========================= UI更新方法 =========================
    
    /**
     * 更新地产UI显示
     */
    private updatePropertyUI(): void {
        // 更新价格标签
        if (this.priceLabel) {
            if (this._propertyData?.ownerId) {
                this.priceLabel.string = this._propertyData.isMortgaged ? '抵押' : '已售';
            } else {
                this.priceLabel.string = `$${this.purchasePrice}`;
            }
        }
        
        // 更新拥有者标签
        if (this.ownerLabel) {
            this.ownerLabel.string = this.getOwnerName();
        }
        
        // 更新地块颜色
        this.updateTileColor();
    }
    
    /**
     * 更新地块颜色
     */
    private updateTileColor(): void {
        if (!this._propertyData) {
            return;
        }
        
        let color = this.baseColor.clone();
        
        if (this._propertyData.ownerId) {
            // 已被购买的地产
            if (this._propertyData.isMortgaged) {
                // 被抵押：灰色
                color = new Color(100, 100, 100, 255);
            } else {
                // 正常拥有：使用拥有者的颜色
                // TODO: 从GameManager获取玩家颜色
                color = new Color(150, 200, 150, 255); // 临时绿色
            }
        }
        
        // 应用颜色
        this._renderState.baseColor = color;
        this.updateVisualAppearance();
    }
    
    /**
     * 更新建筑显示
     */
    private updateBuildingDisplay(): void {
        if (!this.showBuildings || !this.buildingsContainer || !this._propertyData) {
            return;
        }
        
        // 清除现有建筑
        this._buildingNodes.forEach(node => {
            if (node && node.isValid) {
                node.destroy();
            }
        });
        this._buildingNodes = [];
        
        // 根据建筑等级创建新建筑
        this.createBuildingModels(this._propertyData.buildingLevel);
    }
    
    /**
     * 创建建筑模型
     * @param level 建筑等级
     */
    private createBuildingModels(level: number): void {
        // TODO: 根据建筑等级创建3D模型
        // 这里需要使用Cocos Creator的3D模型系统
        
        console.log(`[PropertyTile] 创建建筑模型，等级: ${level}`);
        
        // 实现提示：
        // 1. 根据等级决定建筑类型（1-4级房屋，5级酒店）
        // 2. 实例化对应的预制件
        // 3. 设置位置和缩放
        // 4. 添加到buildingsContainer
        // 5. 保存到_buildingNodes数组
    }
    
    // ========================= 公共方法 =========================
    
    /**
     * 获取地产数据
     */
    public getPropertyData(): PropertyData | null {
        return this._propertyData;
    }
    
    /**
     * 检查是否被指定玩家拥有
     */
    public isOwnedBy(playerId: string): boolean {
        return this._propertyData?.ownerId === playerId;
    }
    
    /**
     * 检查是否无主
     */
    public isUnowned(): boolean {
        return this._propertyData?.ownerId === null;
    }
    
    /**
     * 检查是否被抵押
     */
    public isMortgaged(): boolean {
        return this._propertyData?.isMortgaged || false;
    }
    
    /**
     * 获取当前租金（用于UI显示）
     */
    public getCurrentRent(): number {
        return this.calculateCurrentRent();
    }
    
    /**
     * 获取建筑等级
     */
    public getBuildingLevel(): number {
        return this._propertyData?.buildingLevel || 0;
    }
    
    /**
     * 获取地产详细信息
     */
    public getPropertyInfo(): {
        name: string;
        price: number;
        owner: string;
        buildingLevel: number;
        currentRent: number;
        isMortgaged: boolean;
        canPurchase: boolean;
    } {
        return {
            name: this.tileName,
            price: this.purchasePrice,
            owner: this.getOwnerName(),
            buildingLevel: this.getBuildingLevel(),
            currentRent: this.getCurrentRent(),
            isMortgaged: this.isMortgaged(),
            canPurchase: this.isUnowned()
        };
    }
}