/**
 * RollAndStepHandler - RollAndStepActionEvent 事件处理器
 *
 * 职责：
 * 1. 监听链上的 RollAndStepActionEvent 事件
 * 2. 更新 GameSession 数据（玩家位置、现金等）
 * 3. 创建 RollAndStepAction 播放实例
 * 4. 触发动画播放
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import type { EventMetadata } from '../types';
import type { RollAndStepActionEvent, StopEffect } from '../types/RollAndStepEvent';
import { EventType } from '../types';
import { RollAndStepAction } from '../actions/RollAndStepAction';
import { EventBus } from '../../../events/EventBus';
import { EventTypes } from '../../../events/EventTypes';
import { Blackboard } from '../../../events/Blackboard';
import { UINotification } from '../../../ui/utils/UINotification';
import { DecisionType, StopType } from '../../types/constants';
import { getCardName } from '../../types/cards';
import type { Player } from '../../types/game';

/**
 * RollAndStepHandler 类
 */
export class RollAndStepHandler {
    /** 单例实例 */
    private static _instance: RollAndStepHandler | null = null;

    /** 当前播放的 action */
    private currentAction: RollAndStepAction | null = null;

    /** 当前 GameSession（缓存，避免重复获取） */
    private currentSession: any = null;

    private constructor() {
        console.log('[RollAndStepHandler] Handler 创建');
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): RollAndStepHandler {
        if (!RollAndStepHandler._instance) {
            RollAndStepHandler._instance = new RollAndStepHandler();
        }
        return RollAndStepHandler._instance;
    }

    /**
     * 初始化（注册事件监听）
     */
    public initialize(): void {
        console.log('[RollAndStepHandler] 初始化事件监听');

        // 监听 ROLL_AND_STEP_ACTION 事件（由 EventIndexer 触发）
        // TODO: 实际实现时需要从 EventIndexer 监听
        // EventBus.on(EventTypes.Move.RollAndStepAction, this.handleEvent.bind(this));
    }

    /**
     * 处理 RollAndStepActionEvent 事件
     *
     * @param metadata 事件元数据
     */
    public async handleEvent(metadata: EventMetadata<RollAndStepActionEvent>): Promise<void> {
        console.log('[RollAndStepHandler] 收到 RollAndStepActionEvent', metadata);

        const event = metadata.data;

        try {
            // 获取并缓存 GameSession
            this.currentSession = Blackboard.instance.get<any>("currentGameSession");
            if (!this.currentSession) {
                console.warn('[RollAndStepHandler] GameSession not found');
                return;
            }

            // 0. 为所有客户端（包括观战者和非当前玩家）显示骰子动画
            // 这个事件会触发 DiceController 显示骰子动画
            const diceCount = event.dice_values?.length || 1;
            EventBus.emit(EventTypes.Dice.ShowDiceAnimation, {
                diceCount: diceCount,
                diceValues: event.dice_values,
                playerAddress: event.player
            });

            console.log('[RollAndStepHandler] 发送骰子动画事件（所有客户端）:', {
                diceCount,
                values: event.dice_values,
                player: event.player
            });

            // 1. 发送链上骰子结果，让骰子动画停在正确的值
            // 骰子动画在 dice 点击时就开始播放（循环动画）
            // 收到链上真实值后，让动画停止在该值
            // 现在返回 dice_values 数组，每个骰子有独立的值
            EventBus.emit(EventTypes.Dice.RollResult, {
                values: event.dice_values,  // 每颗骰子的值数组（长度1-3）
                source: 'chain'
            });

            console.log('[RollAndStepHandler] 发送骰子结果:', event.dice_values);

            // TODO: DiceController 需要监听 Dice.RollResult 事件
            // 在收到后停止循环动画，播放减速到目标值的动画

            // 1. 更新 GameSession 数据
            await this.updateGameSession(event);

            // 2. 创建 RollAndStepAction 播放实例
            const action = new RollAndStepAction(
                event,
                this.currentSession,  // 传递缓存的 session
                {
                    stepDelay: 400,        // 每步延迟 400ms（缩短间隔）
                    autoPlay: true,        // 自动播放
                    playbackSpeed: 1.0     // 正常速度
                }
            );

            // 3. 注册回调
            action
                .onStepStart(async (step, index) => {
                    console.log(`[RollAndStepHandler] Step ${index} 开始`, step);
                    await this.handleStepStart(step, index, event);
                })
                .onStepComplete(async (step, index) => {
                    console.log(`[RollAndStepHandler] Step ${index} 完成`, step);
                    await this.handleStepComplete(step, index, event);
                })
                .onComplete(async () => {
                    console.log('[RollAndStepHandler] 播放完成');
                    await this.handlePlaybackComplete(event);
                })
                .onError((error) => {
                    console.error('[RollAndStepHandler] 播放错误', error);
                    this.handlePlaybackError(error, event);
                });

            // 4. 保存当前 action
            this.currentAction = action;

            // 5. 开始播放
            await action.play();

        } catch (error) {
            console.error('[RollAndStepHandler] 处理事件失败', error);
            // TODO: 触发错误事件
        }
    }

    /**
     * 更新 GameSession 数据
     *
     * 根据事件更新玩家的最终位置、现金等
     *
     * @param event RollAndStepActionEvent
     */
    private async updateGameSession(event: RollAndStepActionEvent): Promise<void> {
        console.log('[RollAndStepHandler] 更新 GameSession 数据');

        // 使用缓存的 GameSession
        const session = this.currentSession;

        // 找到对应的玩家
        const player = session.getPlayerByAddress(event.player);
        if (!player) {
            console.warn('[RollAndStepHandler] 玩家未找到', event.player);
            return;
        }

        // TODO: 从链上重新获取完整的 Game 数据
        // 完整的状态同步机制（推荐在播放完成后执行）：
        //
        // const { SuiManager } = await import('../../managers/SuiManager');
        // const updatedGame = await SuiManager.instance.getGameState(event.game);
        //
        // if (!updatedGame) {
        //     console.error('[RollAndStepHandler] Failed to get updated game state');
        //     return;
        // }
        //
        // // 获取当前玩家的索引
        // const playerIndex = player.getPlayerIndex();
        //
        // // 更新玩家数据（从 Move Player 重新加载）
        // player.loadFromMovePlayer(updatedGame.players[playerIndex], playerIndex);
        //
        // // 更新 GameSession 的其他状态
        // const template = session.getMapTemplate();
        // const gameData = session.getGameData();
        //
        // if (template && gameData) {
        //     await session.loadFromMoveGame(updatedGame, template, gameData);
        // }
        //
        // console.log('[RollAndStepHandler] GameSession 状态同步完成');

        // 目前使用轻量级更新（仅日志）
        const totalDice = event.dice_values?.reduce((a, b) => a + b, 0) || 0;
        console.log('[RollAndStepHandler] 更新玩家位置', {
            from: event.from,
            to: event.end_pos,
            diceValues: event.dice_values,
            totalSteps: totalDice,
            steps: event.steps.length
        });

        // 注意：实际的数据更新应该在链上查询后进行
        // 动画播放期间可以使用事件数据进行乐观更新
        // 播放完成后再从链上获取权威状态
    }

    /**
     * 处理步骤开始
     */
    private async handleStepStart(
        step: any,
        index: number,
        event: RollAndStepActionEvent
    ): Promise<void> {
        // 使用缓存的 GameSession
        const session = this.currentSession;

        const player = session.getPlayerByAddress(event.player);
        if (!player) return;

        // 如果 from = to，说明被冰冻，跳过移动动画
        if (step.from_tile === step.to_tile) {
            console.log('[RollAndStepHandler] 玩家被冰冻，原地停留');
            UINotification.info('被冰冻了，无法移动！', '冰冻');
            return;
        }

        // 获取目标 tile 的顶部中心点
        const targetCenter = session.getTileWorldCenter(step.to_tile);

        // 触发玩家移动动画（根据玩家索引使用不同动画）
        try {
            await player.moveTo({
                targetTileId: step.to_tile,
                steps: 1,
                path: [step.to_tile],
                targetPosition: targetCenter,  // Tile 顶部中心点
                playerIndex: player.getPlayerIndex()  // 玩家索引（用于选择动画）
            });

            console.log(`[RollAndStepHandler] 玩家移动完成: ${step.from_tile} -> ${step.to_tile}`);
        } catch (error) {
            console.error('[RollAndStepHandler] 玩家移动失败', error);
        }
    }

    /**
     * 处理步骤完成
     */
    private async handleStepComplete(
        step: any,
        index: number,
        event: RollAndStepActionEvent
    ): Promise<void> {
        // 使用缓存的 GameSession
        const session = this.currentSession;
        const player = session.getPlayerByAddress(event.player);

        // ✅ 更新玩家位置到最新的 tile（修复掷骰子使用过时位置的问题）
        if (player) {
            // 如果 from == to（冻结/原地停留），不更新 lastTileId
            // 原因：Move 端冻结时也不更新 last_tile_id，需保持同步
            const updateLastTile = step.from_tile !== step.to_tile;
            player.setPos(step.to_tile, updateLastTile);
            console.log(`[RollAndStepHandler] 玩家位置已更新: ${step.from_tile} -> ${step.to_tile}${!updateLastTile ? ' (冻结，lastTile不变)' : ''}`);
        }

        // 处理停留效果（如收租、奖金等）
        if (step.stop_effect) {
            console.log('[RollAndStepHandler] 处理停留效果', step.stop_effect);

            // TODO: 显示停留效果 UI
            // 根据 stop_type 显示不同的 UI 效果：
            //
            // - StopType.BUILDING_TOLL (1): 支付过路费
            //   显示：租金飞字动画，从玩家飞向地产所有者
            //   金额：step.stop_effect.amount
            //   所有者：step.stop_effect.owner
            //
            // - StopType.BUILDING_NO_RENT (2): 免租通过
            //   显示：免租提示（"使用免租卡，免费通过"）
            //
            // - StopType.HOSPITAL (3): 送往医院
            //   显示：医院提示，停留回合数
            //   回合数：step.stop_effect.turns
            //
            // - StopType.BONUS (5): 获得奖金
            //   显示：奖金飞字动画（金币特效）
            //   金额：step.stop_effect.amount
            //
            // - StopType.FEE (6): 支付罚款
            //   显示：罚款飞字动画（负数）
            //   金额：step.stop_effect.amount
            //
            // - StopType.CARD_STOP (7): 卡片停留
            //   显示：卡牌获取动画
            //   卡牌：step.stop_effect.card_gains
            //
            // - StopType.BUILDING_UNOWNED (8): 无主建筑（可购买）
            //   显示：购买提示 UI（触发待决策状态）
            //   价格：step.stop_effect.amount
            //   等级：step.stop_effect.level

            // 处理停留获得的卡牌（stop_type = CARD_STOP）
            if (step.stop_effect.card_gains && step.stop_effect.card_gains.length > 0) {
                if (player) {
                    // 1. 添加卡牌到玩家数据
                    for (const cardDraw of step.stop_effect.card_gains) {
                        // Sui SDK 解析的结构体数据在 fields 字段中
                        const fields = (cardDraw as any).fields || cardDraw;
                        player.addCard(fields.kind, fields.count);
                    }

                    // 2. 构建卡片列表（最多3张用于显示）
                    const cards: number[] = [];

                    for (const cardDraw of step.stop_effect.card_gains) {
                        const fields = (cardDraw as any).fields || cardDraw;
                        const count = fields.count;

                        // 将卡牌kind重复添加count次，直到达到3张上限
                        for (let i = 0; i < count && cards.length < 3; i++) {
                            cards.push(fields.kind);
                        }
                    }

                    // 3. 构建消息文本
                    const cardNames = step.stop_effect.card_gains
                        .map(c => {
                            const fields = (c as any).fields || c;
                            return `${getCardName(fields.kind)} x${fields.count}`;
                        })
                        .join(', ');

                    // 4. 显示通知
                    UINotification.info(`获得: ${cardNames}`, '卡牌', 4000, 'center', {
                        playerIndex: player.getPlayerIndex(),
                        cards: cards  // 最多3张
                    });
                }
            }

            // 免租通过提示
            if (step.stop_effect.stop_type === StopType.BUILDING_NO_RENT) {
                UINotification.info('免租通过', undefined, 2000, 'center');
            }

            // 土地神抢地提示
            if (step.stop_effect.stop_type === StopType.LAND_SEIZE) {
                UINotification.info('土地神附身，免费占有地产！', '土地神', 3000, 'center');
            }

            // 卡片商店
            if (step.stop_effect.stop_type === StopType.CARD_SHOP) {
                // 使用地址比较（比对象引用比较更可靠）
                import('../../managers/SuiManager').then(({ SuiManager }) => {
                    const myAddress = SuiManager.instance.currentAddress;
                    console.log('[RollAndStepHandler] CardShop:', {
                        eventPlayer: event.player,
                        myAddress: myAddress,
                        isMyAction: event.player === myAddress
                    });

                    if (myAddress && event.player === myAddress) {
                        import('../../../ui/core/UIManager').then(({ UIManager }) => {
                            UIManager.instance.showUI('CardShop', { parentUIName: 'InGame' });
                        }).catch(err => {
                            console.error('[RollAndStepHandler] 打开卡片商店失败', err);
                        });
                    }
                }).catch(err => {
                    console.error('[RollAndStepHandler] 加载 SuiManager 失败', err);
                });
            }

            // 处理 NPC 触发的 Buff（土地神等）
            if (step.stop_effect.npc_buff) {
                const npcBuff = step.stop_effect.npc_buff;
                const buffName = this._getBuffName(npcBuff.buff_type);
                UINotification.info(`获得 ${buffName}！`, 'NPC祝福', 3000, 'center');

                // 根据 target 地址查找目标玩家（可能不是当前行动玩家）
                const targetPlayer = npcBuff.target
                    ? session.getPlayerByAddress(npcBuff.target)
                    : player;  // fallback 到当前玩家

                if (targetPlayer) {
                    targetPlayer.addBuff({
                        kind: npcBuff.buff_type,
                        last_active_round: npcBuff.last_active_round ?? 0,
                        value: BigInt(0),
                        spawn_index: 0xFFFF  // 从事件中无法获取，使用默认值
                    });
                }

                // Buff 型 NPC（土地神、福神）触发后会被消耗，需要移除
                // stop_effect.tile_id 就是当前停留格，也是 NPC 所在位置
                session.removeNPC(step.stop_effect.tile_id);
                console.log('[RollAndStepHandler] Buff NPC 已消耗并删除:', step.stop_effect.tile_id);
            }
        }

        // 处理 NPC 交互
        if (step.npc_event) {
            console.log('[RollAndStepHandler] 处理 NPC 交互', step.npc_event);

            // 1. 显示 NPC 事件中文描述
            const description = this._getNpcEventDescription(step.npc_event);
            UINotification.info(description, 'NPC事件');

            // 2. ✅ 检查是否被送往医院（炸弹或恶犬）
            const NpcResult = { NONE: 0, SEND_HOSPITAL: 1, BARRIER_STOP: 2 };
            if (step.npc_event.result === NpcResult.SEND_HOSPITAL) {
                // 设置玩家的医院回合数
                if (player) {
                    // ⚠️ 注意：此值需与 Move types::DEFAULT_HOSPITAL_TURNS() 保持一致
                    // 当前链上值为 2，如需修改请同步更新
                    const DEFAULT_HOSPITAL_TURNS = 2;
                    player.setInHospitalTurns(DEFAULT_HOSPITAL_TURNS);
                    console.log('[RollAndStepHandler] 玩家被送往医院，设置住院回合数:', DEFAULT_HOSPITAL_TURNS);
                }
            }

            // 3. 如果 NPC 被消耗，删除
            if (step.npc_event.consumed) {
                const session = this.currentSession;

                // 从 GameSession 删除（内部会调用 gameMap.removeNPCActor 清理渲染）
                session.removeNPC(step.npc_event.tile_id);

                console.log('[RollAndStepHandler] NPC 已消耗并删除:', step.npc_event.tile_id);
            }

            // TODO: 播放 NPC 交互动画
            // 根据 NPC result 播放不同动画：
            //
            // - NpcResult.SEND_HOSPITAL (1): 送往医院
            //   动画：炸弹爆炸特效 + 玩家被击飞
            //   目标：step.npc_event.result_tile（医院位置）
            //
            // - NpcResult.BARRIER_STOP (2): 路障阻挡
            //   动画：路障震动 + 玩家被弹回
            //   效果：停止前进，剩余步数作废
            //
            // 如果 consumed === true，播放 NPC 消耗动画（消失特效）
        }

        // 处理路过获得的卡牌
        if (step.pass_draws && step.pass_draws.length > 0) {
            console.log('[RollAndStepHandler] 处理路过卡牌', step.pass_draws);

            if (player) {
                // 1. 添加卡牌到玩家数据
                for (const cardDraw of step.pass_draws) {
                    player.addCard(cardDraw.kind, cardDraw.count);
                }

                // 2. 构建卡片列表（最多3张用于显示）
                const cards: number[] = [];

                for (const cardDraw of step.pass_draws) {
                    // 将卡牌kind重复添加count次，直到达到3张上限
                    for (let i = 0; i < cardDraw.count && cards.length < 3; i++) {
                        cards.push(cardDraw.kind);
                    }
                }

                // 3. 构建消息文本
                const cardNames = step.pass_draws
                    .map(c => `${getCardName(c.kind)} x${c.count}`)
                    .join(', ');

                // 4. 显示通知
                UINotification.info(`获得: ${cardNames}`, '卡牌', 4000, 'center', {
                    playerIndex: player.getPlayerIndex(),
                    cards: cards  // 最多3张
                });
            }
        }
    }

    /**
     * 处理播放完成
     */
    private async handlePlaybackComplete(event: RollAndStepActionEvent): Promise<void> {
        console.log('[RollAndStepHandler] 所有步骤播放完成');

        // 使用缓存的 GameSession
        const session = this.currentSession;

        // ✅ 清除玩家的next_tile_id（移动完成后，强制步骤已使用）
        const player = session?.getPlayerByAddress(event.player);
        if (player && player.getNextTileId() !== 65535) {
            player.setNextTileId(65535);
            console.log('[RollAndStepHandler] next_tile_id已清除（移动完成）');
        }

        if (session) {
            // 1. 检查事件是否属于当前游戏
            if (event.game !== session.getGameId()) {
                console.warn('[RollAndStepHandler] Event game mismatch, ignoring', {
                    eventGame: event.game,
                    currentGame: session.getGameId()
                });
                return;
            }

            // 2. 更新 round（但暂不切换 turn，等决策检查完成后再切换）
            session.setRound(event.round);

            console.log('[RollAndStepHandler] Round 已同步（from event）', {
                round: event.round,
                turn_will_be: event.turn_in_round
            });
        }

        // 处理现金变动
        if (event.cash_changes && event.cash_changes.length > 0) {
            console.log('[RollAndStepHandler] 处理现金变动', event.cash_changes);

            for (const change of event.cash_changes) {
                const player = session.getPlayerByAddress(change.player);
                if (player) {
                    // 确保 amount 是 BigInt 类型（防止 JSON 解析时类型丢失）
                    const amount = BigInt(change.amount);

                    // 更新玩家现金（根据 is_debit）
                    const newCash = change.is_debit
                        ? player.getCash() - amount
                        : player.getCash() + amount;

                    // 调用 Player.setCash 会自动触发 EventTypes.Player.CashChange 事件
                    player.setCash(newCash);

                    // 显示现金变动Notification
                    // 观战模式：显示所有玩家的现金变动（带玩家标识）
                    // 正常模式：只显示自己的现金变动
                    const isSpectator = this.currentSession?.isSpectatorMode() || false;
                    const myPlayer = this.currentSession?.getMyPlayer();
                    if (isSpectator || (myPlayer && player === myPlayer)) {
                        const prefix = isSpectator ? `玩家${player.getPlayerIndex() + 1} ` : '';
                        const text = change.is_debit ? `${prefix}-${amount}` : `${prefix}+${amount}`;
                        UINotification.info(text, undefined, 2000, 'center');
                        console.log('[RollAndStepHandler] 显示现金变动:', text);
                    }

                    console.log('[RollAndStepHandler] 玩家现金已更新', {
                        player: change.player,
                        isDebit: change.is_debit,
                        amount: amount.toString(),
                        newCash: newCash.toString(),
                        reason: change.reason
                    });
                }
            }
        }

        // ✅ 处理建筑更新（从最后一个step的StopEffect获取building_decision）
        const lastStep = event.steps[event.steps.length - 1];
        if (lastStep && lastStep.stop_effect) {
            const stopEffect = lastStep.stop_effect;

            // 检查是否有建筑决策信息
            if (stopEffect.building_decision) {
                await this._handleBuildingUpdate(stopEffect.building_decision, event.player, session);
            }
        }

        // 处理Hospital状态（从最后一个step的StopEffect获取）
        if (lastStep && lastStep.stop_effect) {
            const stopEffect = lastStep.stop_effect;
            const player = session.getPlayerByAddress(event.player);

            if (player && stopEffect.turns !== null && stopEffect.turns !== undefined) {
                // StopType.HOSPITAL = 3
                if (stopEffect.stop_type === 3) {
                    // 住院
                    player.setInHospitalTurns(stopEffect.turns);
                    console.log('[RollAndStepHandler] 玩家进入医院', {
                        player: event.player,
                        turns: stopEffect.turns
                    });
                }
            }
        }

        // 清除当前 action
        this.currentAction = null;

        // 触发完成事件
        EventBus.emit(EventTypes.Game.PlayerMove, {
            player: event.player,
            from: event.from,
            to: event.end_pos,
            steps: event.steps.length
        });

        // 检查是否需要瞬移（最后一步的 to_tile vs end_pos）
        await this._handleTeleportIfNeeded(event);

        // ✅ 检查是否有待决策状态（在切换回合之前）
        await this._handleDecisionIfNeeded(event);

        // ✅ 最后才切换回合（确保决策检查时 isMyTurn() 仍为 true）
        if (session) {
            const pendingDecisionType = lastStep?.stop_effect?.pending_decision;
            const hasPendingDecision = pendingDecisionType !== undefined &&
                pendingDecisionType !== DecisionType.NONE;

            if (hasPendingDecision) {
                console.log('[RollAndStepHandler] 检测到待决策，跳过回合推进', {
                    pendingDecisionType
                });
            } else {
                await session.advance_turn(event.turn_in_round);

                console.log('[RollAndStepHandler] Turn 已同步（from event）', {
                    round: event.round,
                    turn: event.turn_in_round
                });
            }
        }
    }

    /**
     * 检查并处理玩家瞬移
     */
    private async _handleTeleportIfNeeded(event: RollAndStepActionEvent): Promise<void> {
        const lastStep = event.steps[event.steps.length - 1];

        if (!lastStep || lastStep.to_tile === event.end_pos) {
            return; // 无需瞬移
        }

        console.log('[RollAndStepHandler] 检测到玩家瞬移', {
            lastTile: lastStep.to_tile,
            endPos: event.end_pos,
            reason: '遇到炸弹/恶犬等 NPC'
        });

        // 瞬移玩家到 end_pos
        const session = this.currentSession;
        const player = session.getPlayerByAddress(event.player);

        if (player) {
            // ✅ 更新玩家逻辑位置（修复瞬移后位置不同步）
            // 传入 false 表示瞬移，不更新 lastTile（保持为正常移动的最后位置）
            player.setPos(event.end_pos, false);

            const targetCenter = session.getTileWorldCenter(event.end_pos);

            // 使用 teleport 参数瞬移（无动画）
            await player.moveTo({
                targetTileId: event.end_pos,
                steps: 0,
                targetPosition: targetCenter,
                teleport: true
            });

            console.log('[RollAndStepHandler] 玩家已瞬移到:', event.end_pos);
        }
    }

    /**
     * 处理播放错误
     */
    private handlePlaybackError(error: Error, event: RollAndStepActionEvent): void {
        console.error('[RollAndStepHandler] 播放错误', error, event);

        // 清除当前 action
        this.currentAction = null;

        // TODO: 显示错误提示
        // UINotification.error(`动作播放失败: ${error.message}`);
    }

    /**
     * 获取当前播放的 action
     */
    public getCurrentAction(): RollAndStepAction | null {
        return this.currentAction;
    }

    /**
     * 是否正在播放
     */
    public isPlaying(): boolean {
        return this.currentAction !== null && this.currentAction.isPlaying();
    }

    /**
     * 停止当前播放
     */
    public stopCurrentAction(): void {
        if (this.currentAction) {
            this.currentAction.stop();
            this.currentAction = null;
        }
    }

    // ==================== 决策处理 ====================

    /**
     * 检查并处理待决策状态
     */
    private async _handleDecisionIfNeeded(event: RollAndStepActionEvent): Promise<void> {
        const lastStep = event.steps[event.steps.length - 1];
        const stopEffect = lastStep?.stop_effect;

        // 检查是否需要决策
        if (!stopEffect ||
            stopEffect.pending_decision === undefined ||
            stopEffect.pending_decision === DecisionType.NONE) {
            return; // 无需决策
        }

        console.log('[RollAndStepHandler] 检测到待决策', {
            decisionType: stopEffect.pending_decision,
            amount: stopEffect.decision_amount
        });

        // 使用缓存的 GameSession
        const session = this.currentSession;

        // 只有轮到我的玩家时才显示决策UI
        const myPlayer = session.getMyPlayer();
        if (!myPlayer) {
            console.warn('[RollAndStepHandler] My player not found, skip decision UI');
            return;
        }

        const eventPlayer = session.getPlayerByAddress(event.player);
        if (eventPlayer !== myPlayer) {
            console.log('[RollAndStepHandler] Not my turn, skip decision UI', {
                eventPlayer: event.player,
                myPlayer: myPlayer.getOwner()
            });
            return;
        }

        const player = session.getActivePlayer();
        if (!player) {
            console.warn('[RollAndStepHandler] Active player not found');
            return;
        }

        // 更新 GameSession 状态（会自动发射 DecisionPending 事件）
        // UIInGame 会监听该事件并显示决策对话框
        session.setPendingDecision({
            type: stopEffect.pending_decision,
            tileId: stopEffect.decision_tile,  // 使用正确的 decision_tile 字段
            amount: BigInt(stopEffect.decision_amount)
        });

        console.log('[RollAndStepHandler] 已设置待决策状态，UIInGame 将显示对话框', {
            type: stopEffect.pending_decision,
            tileId: stopEffect.decision_tile,
            amount: stopEffect.decision_amount.toString()
        });
    }

    // ==================== 辅助方法 ====================

    /**
     * 处理建筑更新（从 building_decision）
     * 在玩家移动动画完成后调用，确保视觉协调
     */
    private async _handleBuildingUpdate(
        buildingDecision: any,
        playerAddress: string,
        session: any
    ): Promise<void> {
        const player = session.getPlayerByAddress(playerAddress);
        if (!player) {
            console.warn('[RollAndStepHandler] Player not found for building update');
            return;
        }

        // ✅ 从 BuildingDecisionInfo 获取完整信息
        const buildingId = buildingDecision.building_id;
        const newOwner = player.getPlayerIndex();
        const newLevel = buildingDecision.new_level;
        const buildingType = buildingDecision.building_type;

        console.log('[RollAndStepHandler] 更新建筑状态（from building_decision）', {
            buildingId,
            owner: newOwner,
            level: newLevel,
            buildingType,
            decisionType: buildingDecision.decision_type,
            amount: buildingDecision.amount?.toString() || 'N/A',
            tileId: buildingDecision.tile_id
        });

        // 更新建筑（会自动触发渲染）
        session.updateBuilding(buildingId, newOwner, newLevel, buildingType);

        console.log('[RollAndStepHandler] 建筑状态已更新');
    }

    /**
     * 获取 NPC 事件的中文描述
     */
    private _getNpcEventDescription(npcEvent: any): string {
        const npcName = this._getNpcKindName(npcEvent.kind);

        const NpcResult = { NONE: 0, SEND_HOSPITAL: 1, BARRIER_STOP: 2 };

        if (npcEvent.result === NpcResult.SEND_HOSPITAL) {
            return `遇到${npcName}！被送往医院`;
        } else if (npcEvent.result === NpcResult.BARRIER_STOP) {
            return `遇到${npcName}！前进受阻`;
        } else {
            return `遇到${npcName}`;
        }
    }

    /**
     * NPC 类型中文名称
     */
    private _getNpcKindName(kind: number): string {
        switch (kind) {
            case 20: return '路障';
            case 21: return '炸弹';
            case 22: return '恶犬';
            case 23: return '土地神';
            case 24: return '财神';
            case 25: return '福神';
            case 26: return '穷神';
            default: return 'NPC';
        }
    }

    /**
     * Buff 类型中文名称
     */
    private _getBuffName(buffType: number): string {
        switch (buffType) {
            case 1: return '遥控骰子';      // BUFF_MOVE_CTRL
            case 2: return '冰冻';          // BUFF_FROZEN
            case 3: return '免租';          // BUFF_RENT_FREE
            case 4: return '土地神附身';    // BUFF_LAND_BLESSING
            case 5: return '福神祝福';      // BUFF_FORTUNE
            case 6: return '机车';          // BUFF_LOCOMOTIVE
            default: return `效果(${buffType})`;
        }
    }

    /**
     * 销毁
     */
    public destroy(): void {
        this.stopCurrentAction();
        this.currentSession = null;
        RollAndStepHandler._instance = null;
        console.log('[RollAndStepHandler] Handler 销毁');
    }
}

// 导出单例访问器
export const rollAndStepHandler = {
    get instance(): RollAndStepHandler {
        return RollAndStepHandler.getInstance();
    }
};
