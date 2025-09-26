/**
 * Tycoon事件系统使用示例
 * 展示如何集成和使用新的事件索引和处理系统
 */

import { Component, _decorator } from 'cc';
import { tycoonEventIndexer } from './TycoonEventIndexer';
import { tycoonEventProcessor } from './TycoonEventProcessor';
import { EventBus } from '../events/EventBus';
import {
    TycoonEventType,
    GameCreatedEvent,
    RollAndStepActionEvent,
    UseCardActionEvent,
    RoundEndedEvent,
    SuiTycoonEvent
} from './TycoonEventTypes';
import {
    STOP_TYPE,
    CARD_KIND,
    NPC_KIND,
    getStopTypeDescription
} from './TycoonEventConstants';

const { ccclass, property } = _decorator;

/**
 * Tycoon事件系统集成示例
 */
@ccclass('TycoonEventExample')
export class TycoonEventExample extends Component {

    /** 游戏包ID（需要替换为实际部署的包ID） */
    @property({ displayName: '游戏包ID' })
    private packageId: string = '0x123...';  // 替换为实际包ID

    /** 网络类型 */
    @property({ displayName: '网络类型' })
    private network: string = 'testnet';

    /** 是否自动开始 */
    @property({ displayName: '自动开始' })
    private autoStart: boolean = false;

    /** 当前游戏ID */
    private _currentGameId?: string;

    /** 当前玩家地址 */
    private _playerAddress?: string;

    protected onLoad(): void {
        // 初始化事件系统
        this._initializeEventSystem();

        // 注册事件监听器
        this._registerEventListeners();

        // 如果配置了自动开始
        if (this.autoStart && this.packageId !== '0x123...') {
            this.startEventIndexing();
        }
    }

    protected onDestroy(): void {
        // 停止索引
        tycoonEventIndexer.stopIndexing();

        // 移除事件监听
        this._removeEventListeners();
    }

    /**
     * 初始化事件系统
     */
    private _initializeEventSystem(): void {
        // 1. 初始化事件索引器
        tycoonEventIndexer.initialize({
            packageId: this.packageId,
            network: this.network,
            debug: true,
            pollingInterval: 2000  // 2秒轮询一次
        });

        // 2. 配置事件处理器
        tycoonEventProcessor.configure({
            enableAnimations: true,
            animationSpeed: 1.0,
            debug: true
        });

        console.log('[TycoonExample] 事件系统已初始化');
    }

    /**
     * 开始事件索引
     */
    public async startEventIndexing(): Promise<void> {
        try {
            // 开始索引链上事件
            await tycoonEventIndexer.startIndexing();
            console.log('[TycoonExample] 开始索引游戏事件');
        } catch (error) {
            console.error('[TycoonExample] 启动索引失败:', error);
        }
    }

    /**
     * 停止事件索引
     */
    public stopEventIndexing(): void {
        tycoonEventIndexer.stopIndexing();
        console.log('[TycoonExample] 已停止事件索引');

        // 打印统计信息
        const stats = tycoonEventIndexer.getEventStats();
        console.log('[TycoonExample] 事件统计:', stats);
    }

    /**
     * 设置当前游戏
     */
    public setCurrentGame(gameId: string, playerAddress: string): void {
        this._currentGameId = gameId;
        this._playerAddress = playerAddress;

        // 设置处理器的当前游戏
        tycoonEventProcessor.setCurrentGame(gameId, playerAddress);

        // 添加游戏过滤器，只处理当前游戏的事件
        tycoonEventIndexer.addEventFilter({
            gameId: gameId
        });

        console.log('[TycoonExample] 设置当前游戏:', gameId);
    }

    /**
     * 注册事件监听器
     */
    private _registerEventListeners(): void {
        // 监听所有Tycoon事件
        EventBus.on('tycoon:event', this._onTycoonEvent.bind(this));

        // 监听游戏创建事件
        EventBus.on(`tycoon:event:${TycoonEventType.GameCreated}`,
            this._onGameCreated.bind(this));

        // 监听移动聚合事件
        EventBus.on(`tycoon:event:${TycoonEventType.RollAndStepAction}`,
            this._onRollAndStep.bind(this));

        // 监听卡牌使用事件
        EventBus.on(`tycoon:event:${TycoonEventType.UseCardAction}`,
            this._onUseCard.bind(this));

        // 监听破产事件
        EventBus.on(`tycoon:event:${TycoonEventType.Bankrupt}`,
            this._onPlayerBankrupt.bind(this));

        // 监听轮次结束事件
        EventBus.on(`tycoon:event:${TycoonEventType.RoundEnded}`,
            this._onRoundEnded.bind(this));
    }

    /**
     * 移除事件监听器
     */
    private _removeEventListeners(): void {
        EventBus.off('tycoon:event', this._onTycoonEvent.bind(this));
        EventBus.off(`tycoon:event:${TycoonEventType.GameCreated}`,
            this._onGameCreated.bind(this));
        EventBus.off(`tycoon:event:${TycoonEventType.RollAndStepAction}`,
            this._onRollAndStep.bind(this));
        EventBus.off(`tycoon:event:${TycoonEventType.UseCardAction}`,
            this._onUseCard.bind(this));
        EventBus.off(`tycoon:event:${TycoonEventType.Bankrupt}`,
            this._onPlayerBankrupt.bind(this));
        EventBus.off(`tycoon:event:${TycoonEventType.RoundEnded}`,
            this._onRoundEnded.bind(this));
    }

    /**
     * 处理所有Tycoon事件
     */
    private _onTycoonEvent(event: SuiTycoonEvent): void {
        console.log(`[TycoonExample] 收到事件 ${event.type}:`, event.data);

        // 根据事件类型分发处理
        switch (event.type) {
            case TycoonEventType.GameCreated:
                tycoonEventProcessor.processGameCreated(event.data);
                break;

            case TycoonEventType.GameStarted:
                tycoonEventProcessor.processGameStarted(event.data);
                break;

            case TycoonEventType.PlayerJoined:
                tycoonEventProcessor.processPlayerJoined(event.data);
                break;

            case TycoonEventType.RollAndStepAction:
                tycoonEventProcessor.processRollAndStepAction(event.data);
                break;

            case TycoonEventType.UseCardAction:
                tycoonEventProcessor.processUseCardAction(event.data);
                break;

            case TycoonEventType.GameEnded:
                tycoonEventProcessor.processGameEnded(event.data);
                break;

            case TycoonEventType.RoundEnded:
                tycoonEventProcessor.processRoundEnded(event.data);
                break;
        }
    }

    /**
     * 处理游戏创建事件
     */
    private _onGameCreated(event: GameCreatedEvent): void {
        console.log('[TycoonExample] 游戏已创建:', {
            gameId: event.game,
            creator: event.creator,
            maxPlayers: event.max_players,
            templateId: event.template_id
        });

        // 如果是自己创建的游戏，自动设置为当前游戏
        if (event.creator === this._playerAddress) {
            this.setCurrentGame(event.game, this._playerAddress!);
        }
    }

    /**
     * 处理移动聚合事件
     */
    private _onRollAndStep(event: RollAndStepActionEvent): void {
        console.log('[TycoonExample] 玩家移动事件:', {
            player: event.player,
            dice: event.dice,
            from: event.from.toString(),
            to: event.end_pos.toString(),
            steps: event.steps.length
        });

        // 解析移动步骤
        for (const step of event.steps) {
            console.log(`  步骤 ${step.step_index}:`, {
                from: step.from_tile.toString(),
                to: step.to_tile.toString(),
                remaining: step.remaining_steps
            });

            // 检查停留效果
            if (step.stop_effect) {
                const stopType = step.stop_effect.stop_type;
                console.log(`    停留效果: ${getStopTypeDescription(stopType as any)}`);

                // 处理特殊停留效果
                switch (stopType) {
                    case STOP_TYPE.PROPERTY_TOLL:
                        console.log(`    支付租金: ${step.stop_effect.amount}`);
                        break;

                    case STOP_TYPE.PROPERTY_UNOWNED:
                        console.log(`    可购买地产，价格: ${step.stop_effect.amount}`);
                        break;

                    case STOP_TYPE.HOSPITAL:
                        console.log(`    进入医院 ${step.stop_effect.turns} 回合`);
                        break;

                    case STOP_TYPE.PRISON:
                        console.log(`    进入监狱 ${step.stop_effect.turns} 回合`);
                        break;
                }
            }

            // 检查NPC事件
            if (step.npc_event) {
                console.log(`    触发NPC:`, {
                    kind: step.npc_event.kind,
                    result: step.npc_event.result,
                    consumed: step.npc_event.consumed
                });
            }

            // 检查抽卡
            if (step.pass_draws.length > 0) {
                for (const draw of step.pass_draws) {
                    console.log(`    抽取卡牌:`, {
                        kind: draw.kind,
                        count: draw.count.toString(),
                        isPass: draw.is_pass
                    });
                }
            }
        }

        // 处理现金变动
        if (event.cash_changes.length > 0) {
            console.log('  现金变动:');
            for (const change of event.cash_changes) {
                const sign = change.is_debit ? '-' : '+';
                console.log(`    ${change.player}: ${sign}${change.amount}`);
            }
        }
    }

    /**
     * 处理卡牌使用事件
     */
    private _onUseCard(event: UseCardActionEvent): void {
        console.log('[TycoonExample] 使用卡牌:', {
            player: event.player,
            cardKind: event.kind,
            target: event.target_addr || event.target_tile?.toString()
        });

        // 根据卡牌类型处理
        switch (event.kind) {
            case CARD_KIND.MOVE_CTRL:
                console.log('  使用遥控骰子');
                break;

            case CARD_KIND.BARRIER:
                console.log('  放置路障');
                break;

            case CARD_KIND.BOMB:
                console.log('  放置炸弹');
                break;

            case CARD_KIND.FREEZE:
                console.log('  冻结玩家');
                break;

            case CARD_KIND.RENT_FREE:
                console.log('  激活免租');
                break;
        }

        // 显示NPC变更
        if (event.npc_changes.length > 0) {
            console.log('  NPC变更:');
            for (const change of event.npc_changes) {
                console.log(`    地块 ${change.tile_id}: ${change.action}`);
            }
        }

        // 显示Buff变更
        if (event.buff_changes.length > 0) {
            console.log('  Buff变更:');
            for (const change of event.buff_changes) {
                console.log(`    玩家 ${change.target}: Buff ${change.buff_type}`);
            }
        }
    }

    /**
     * 处理破产事件
     */
    private _onPlayerBankrupt(event: any): void {
        console.log('[TycoonExample] 玩家破产:', {
            player: event.player,
            debt: event.debt.toString(),
            creditor: event.creditor
        });
    }

    /**
     * 处理轮次结束事件
     */
    private _onRoundEnded(event: RoundEndedEvent): void {
        console.log('[TycoonExample] 轮次结束:', {
            gameId: event.game,
            round: event.round,
            npcKind: event.npc_kind,
            tileId: event.tile_id
        });

        // 如果生成了NPC（npc_kind不为0）
        if (event.npc_kind !== 0) {
            const npcName = this._getNPCName(event.npc_kind);
            console.log(`[TycoonExample] 新的${npcName}出现在地块${event.tile_id}!`);

            // 这里可以触发视觉效果
            // 例如：在地图上显示NPC生成动画
            // this._showNPCSpawnEffect(event.tile_id, event.npc_kind);
        }
    }

    /**
     * 获取NPC名称
     */
    private _getNPCName(npcKind: number): string {
        switch (npcKind) {
            case NPC_KIND.BARRIER:
                return '路障';
            case NPC_KIND.BOMB:
                return '炸弹';
            case NPC_KIND.DOG:
                return '狗狗';
            default:
                return 'NPC';
        }
    }

    // ===== 测试方法 =====

    /**
     * 模拟移动事件（用于测试）
     */
    public simulateMovementEvent(): void {
        const mockEvent: RollAndStepActionEvent = {
            game: this._currentGameId || 'test_game',
            player: this._playerAddress || 'test_player',
            turn: 1n,
            dice: 6,
            dir: 1,  // 顺时针
            from: 0n,
            steps: [
                {
                    step_index: 0,
                    from_tile: 0n,
                    to_tile: 1n,
                    remaining_steps: 5,
                    pass_draws: [],
                    npc_event: undefined,
                    stop_effect: undefined
                },
                {
                    step_index: 5,
                    from_tile: 5n,
                    to_tile: 6n,
                    remaining_steps: 0,
                    pass_draws: [],
                    npc_event: undefined,
                    stop_effect: {
                        tile_id: 6n,
                        tile_kind: 1,  // PROPERTY
                        stop_type: STOP_TYPE.PROPERTY_UNOWNED,
                        amount: 5000n,
                        owner: undefined,
                        level: undefined,
                        turns: undefined,
                        card_gains: []
                    }
                }
            ],
            cash_changes: [],
            end_pos: 6n
        };

        // 处理模拟事件
        tycoonEventProcessor.processRollAndStepAction(mockEvent);
    }

    /**
     * 显示当前统计
     */
    public showStatistics(): void {
        const stats = tycoonEventIndexer.getEventStats();
        console.log('[TycoonExample] 事件统计:', stats);

        const indexingStatus = suiEventIndexer.getIndexingStatus();
        console.log('[TycoonExample] 索引状态:', indexingStatus);
    }
}

/**
 * 使用说明：
 *
 * 1. 将此组件添加到场景中的节点
 * 2. 填写正确的packageId（从publish.sh部署后获得）
 * 3. 选择网络类型（testnet/devnet/mainnet）
 * 4. 运行场景，组件会自动初始化事件系统
 * 5. 调用startEventIndexing()开始监听链上事件
 * 6. 事件会自动通过EventBus分发到游戏系统
 *
 * 集成建议：
 * - 在GameManager中集成TycoonEventIndexer和TycoonEventProcessor
 * - 在UI层监听EventBus事件更新界面
 * - 使用TycoonEventConstants中的常量进行类型判断
 * - 参考TycoonEventTypes中的类型定义处理事件数据
 */