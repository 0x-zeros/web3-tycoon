import { Component, _decorator } from 'cc';
import { suiEventIndexer } from './SuiEventIndexer';
import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';
import {
    DiceRolledEvent,
    PropertyPurchasedEvent,
    RentPaidEvent,
    GameStartedEvent,
    PlayerMovedEvent
} from './SuiEventTypes';

const { ccclass, property } = _decorator;

/**
 * Sui 事件索引器使用示例
 * 展示如何配置和使用事件索引器来监听链上游戏事件
 */
@ccclass('SuiEventIndexerExample')
export class SuiEventIndexerExample extends Component {

    /** 游戏合约包ID（需要替换为实际的包ID） */
    @property({ displayName: '游戏合约包ID' })
    private gamePackageId: string = '0x0000000000000000000000000000000000000000000000000000000000000000';

    /** 游戏核心模块名 */
    @property({ displayName: '游戏核心模块名' })
    private gameCoreModule: string = 'game_core';

    /** 地产模块名 */
    @property({ displayName: '地产模块名' })
    private propertyModule: string = 'property';

    /** 网络类型 */
    @property({
        type: String,
        displayName: '网络类型',
        tooltip: 'mainnet, testnet, devnet 或自定义 RPC URL'
    })
    private network: string = 'testnet';

    /** 是否自动开始 */
    @property({ displayName: '自动开始索引' })
    private autoStart: boolean = false;

    /** 追踪器ID列表 */
    private _trackerIds: string[] = [];

    protected onLoad(): void {
        // 配置索引器
        this._configureIndexer();

        // 注册事件监听
        this._registerEventListeners();

        // 注册链上事件类型
        this._registerChainEvents();

        // 如果设置了自动开始，则启动索引
        if (this.autoStart) {
            this.startIndexing();
        }
    }

    protected onDestroy(): void {
        // 停止索引
        suiEventIndexer.stopIndexing();

        // 取消注册所有事件
        for (const trackerId of this._trackerIds) {
            suiEventIndexer.unregisterEventType(trackerId);
        }

        // 移除事件监听
        this._removeEventListeners();
    }

    /**
     * 配置索引器
     */
    private _configureIndexer(): void {
        suiEventIndexer.configure({
            network: this.network as any,
            pollingInterval: 2000, // 2秒轮询一次
            batchSize: 50, // 每批最多50个事件
            debug: true // 开启调试日志
        });

        console.log(`[Example] 索引器已配置: ${this.network}`);
    }

    /**
     * 注册链上事件类型
     */
    private _registerChainEvents(): void {
        // 注册游戏开始事件
        const gameStartedId = suiEventIndexer.registerEventType({
            packageId: this.gamePackageId,
            moduleName: this.gameCoreModule,
            eventType: 'GameStarted',
            parser: (event) => {
                const data = event.parsedJson as any;
                return {
                    gameId: data?.game_id,
                    players: data?.players || [],
                    startingPlayer: data?.starting_player,
                    timestamp: event.timestampMs
                } as GameStartedEvent;
            },
            eventBusKey: EventTypes.SuiChain.GameStarted
        });
        this._trackerIds.push(gameStartedId);

        // 注册骰子投掷事件
        const diceRolledId = suiEventIndexer.registerEventType({
            packageId: this.gamePackageId,
            moduleName: this.gameCoreModule,
            eventType: 'DiceRolled',
            parser: (event) => {
                const data = event.parsedJson as any;
                return {
                    gameId: data?.game_id,
                    player: data?.player,
                    diceValue: data?.dice_value,
                    newPosition: data?.new_position,
                    timestamp: event.timestampMs
                } as DiceRolledEvent;
            },
            eventBusKey: EventTypes.SuiChain.DiceRolled
        });
        this._trackerIds.push(diceRolledId);

        // 注册玩家移动事件
        const playerMovedId = suiEventIndexer.registerEventType({
            packageId: this.gamePackageId,
            moduleName: this.gameCoreModule,
            eventType: 'PlayerMoved',
            parser: (event) => {
                const data = event.parsedJson as any;
                return {
                    gameId: data?.game_id,
                    player: data?.player,
                    fromPosition: data?.from_position,
                    toPosition: data?.to_position,
                    passedStart: data?.passed_start || false,
                    timestamp: event.timestampMs
                } as PlayerMovedEvent;
            },
            eventBusKey: EventTypes.SuiChain.PlayerMoved
        });
        this._trackerIds.push(playerMovedId);

        // 注册地产购买事件
        const propertyPurchasedId = suiEventIndexer.registerEventType({
            packageId: this.gamePackageId,
            moduleName: this.propertyModule,
            eventType: 'PropertyPurchased',
            parser: (event) => {
                const data = event.parsedJson as any;
                return {
                    gameId: data?.game_id,
                    player: data?.player,
                    propertyId: data?.property_id,
                    price: Number(data?.price || 0),
                    position: data?.position,
                    timestamp: event.timestampMs
                } as PropertyPurchasedEvent;
            },
            eventBusKey: EventTypes.SuiChain.PropertyPurchased
        });
        this._trackerIds.push(propertyPurchasedId);

        // 注册租金支付事件
        const rentPaidId = suiEventIndexer.registerEventType({
            packageId: this.gamePackageId,
            moduleName: this.propertyModule,
            eventType: 'RentPaid',
            parser: (event) => {
                const data = event.parsedJson as any;
                return {
                    gameId: data?.game_id,
                    payer: data?.payer,
                    owner: data?.owner,
                    propertyId: data?.property_id,
                    rentAmount: Number(data?.rent_amount || 0),
                    timestamp: event.timestampMs
                } as RentPaidEvent;
            },
            eventBusKey: EventTypes.SuiChain.RentPaid
        });
        this._trackerIds.push(rentPaidId);

        console.log(`[Example] 已注册 ${this._trackerIds.length} 个事件类型`);
    }

    /**
     * 注册事件监听器
     */
    private _registerEventListeners(): void {
        // 监听游戏开始
        EventBus.on(EventTypes.SuiChain.GameStarted, this._onGameStarted, this);

        // 监听骰子投掷
        EventBus.on(EventTypes.SuiChain.DiceRolled, this._onDiceRolled, this);

        // 监听玩家移动
        EventBus.on(EventTypes.SuiChain.PlayerMoved, this._onPlayerMoved, this);

        // 监听地产购买
        EventBus.on(EventTypes.SuiChain.PropertyPurchased, this._onPropertyPurchased, this);

        // 监听租金支付
        EventBus.on(EventTypes.SuiChain.RentPaid, this._onRentPaid, this);

        // 监听索引器错误
        EventBus.on(EventTypes.SuiChain.IndexerError, this._onIndexerError, this);

        console.log('[Example] 事件监听器已注册');
    }

    /**
     * 移除事件监听器
     */
    private _removeEventListeners(): void {
        EventBus.off(EventTypes.SuiChain.GameStarted, this._onGameStarted, this);
        EventBus.off(EventTypes.SuiChain.DiceRolled, this._onDiceRolled, this);
        EventBus.off(EventTypes.SuiChain.PlayerMoved, this._onPlayerMoved, this);
        EventBus.off(EventTypes.SuiChain.PropertyPurchased, this._onPropertyPurchased, this);
        EventBus.off(EventTypes.SuiChain.RentPaid, this._onRentPaid, this);
        EventBus.off(EventTypes.SuiChain.IndexerError, this._onIndexerError, this);
    }

    /**
     * 开始索引
     */
    public async startIndexing(): Promise<void> {
        try {
            await suiEventIndexer.startIndexing();
            console.log('[Example] 索引已启动');

            // 发送索引器启动事件
            EventBus.emit(EventTypes.SuiChain.IndexerStarted, {
                network: this.network,
                trackers: this._trackerIds.length
            });
        } catch (error) {
            console.error('[Example] 启动索引失败:', error);
        }
    }

    /**
     * 停止索引
     */
    public stopIndexing(): void {
        suiEventIndexer.stopIndexing();
        console.log('[Example] 索引已停止');

        // 发送索引器停止事件
        EventBus.emit(EventTypes.SuiChain.IndexerStopped);
    }

    /**
     * 获取索引状态
     */
    public logIndexingStatus(): void {
        const status = suiEventIndexer.getIndexingStatus();
        console.log('[Example] 索引状态:', {
            正在索引: status.isIndexing,
            已处理事件: status.eventsProcessed,
            最后索引时间: status.lastIndexTime,
            追踪事件类型: status.trackedEventTypes,
            错误次数: status.errorCount,
            当前游标: status.currentCursor
        });
    }

    /**
     * 添加自定义事件类型
     */
    public addCustomEventType(
        moduleName: string,
        eventType: string,
        eventBusKey: string
    ): string {
        const trackerId = suiEventIndexer.registerEventType({
            packageId: this.gamePackageId,
            moduleName: moduleName,
            eventType: eventType,
            parser: (event) => {
                // 默认解析器，直接返回 parsedJson
                return {
                    ...event.parsedJson,
                    timestamp: event.timestampMs
                };
            },
            eventBusKey: eventBusKey
        });

        this._trackerIds.push(trackerId);
        console.log(`[Example] 添加自定义事件类型: ${trackerId}`);
        return trackerId;
    }

    // ==================== 事件处理函数 ====================

    private _onGameStarted(event: GameStartedEvent): void {
        console.log('[链上事件] 游戏开始:', {
            游戏ID: event.gameId,
            玩家数量: event.players.length,
            起始玩家: event.startingPlayer
        });

        // 这里可以更新游戏UI或状态
    }

    private _onDiceRolled(event: DiceRolledEvent): void {
        console.log('[链上事件] 骰子投掷:', {
            玩家: event.player,
            点数: event.diceValue,
            新位置: event.newPosition
        });

        // 播放骰子动画，更新玩家位置等
    }

    private _onPlayerMoved(event: PlayerMovedEvent): void {
        console.log('[链上事件] 玩家移动:', {
            玩家: event.player,
            从: event.fromPosition,
            到: event.toPosition,
            经过起点: event.passedStart
        });

        // 移动玩家棋子，如果经过起点则发放奖金
    }

    private _onPropertyPurchased(event: PropertyPurchasedEvent): void {
        console.log('[链上事件] 地产购买:', {
            玩家: event.player,
            地产ID: event.propertyId,
            价格: event.price,
            位置: event.position
        });

        // 更新地产所有权显示
    }

    private _onRentPaid(event: RentPaidEvent): void {
        console.log('[链上事件] 租金支付:', {
            付款方: event.payer,
            收款方: event.owner,
            地产: event.propertyId,
            金额: event.rentAmount
        });

        // 显示租金动画，更新玩家余额显示
    }

    private _onIndexerError(error: any): void {
        console.error('[链上事件] 索引器错误:', error);

        // 可以显示错误提示或尝试重连
    }
}

/**
 * 使用说明：
 *
 * 1. 将此组件添加到场景中的任意节点
 * 2. 在属性检查器中设置正确的包ID和模块名
 * 3. 选择网络类型（testnet/mainnet/devnet）
 * 4. 如果需要自动开始，勾选"自动开始索引"
 * 5. 运行游戏即可开始监听链上事件
 *
 * 代码使用：
 * ```typescript
 * // 获取组件实例
 * const indexerExample = this.getComponent(SuiEventIndexerExample);
 *
 * // 手动开始索引
 * await indexerExample.startIndexing();
 *
 * // 停止索引
 * indexerExample.stopIndexing();
 *
 * // 查看状态
 * indexerExample.logIndexingStatus();
 *
 * // 添加自定义事件
 * indexerExample.addCustomEventType('custom_module', 'CustomEvent', 'custom_event_key');
 * ```
 */