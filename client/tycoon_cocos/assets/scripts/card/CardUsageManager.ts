/**
 * CardUsageManager - 卡片使用管理器
 *
 * 统一管理所有卡片的使用流程
 * 根据卡片类型调用相应的选择器并构建参数
 *
 * @author Web3 Tycoon Team
 */

import { Card } from './Card';
import { UICardTileSelector } from '../ui/game/UICardTileSelector';
import { UIPlayerSelector } from '../ui/game/UIPlayerSelector';
import { UIMessage } from '../ui/utils/UIMessage';
import { GameInitializer } from '../core/GameInitializer';
import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';
import { BFSPathfinder } from '../sui/pathfinding/BFSPathfinder';
import { MapGraph } from '../sui/pathfinding/MapGraph';
import { PathExtender } from '../sui/pathfinding/PathExtender';

/**
 * 卡片使用管理器
 */
export class CardUsageManager {
    private static _instance: CardUsageManager;
    private tileSelector: UICardTileSelector;
    private playerSelector: UIPlayerSelector;

    private constructor() {
        this.tileSelector = new UICardTileSelector();
        this.playerSelector = new UIPlayerSelector();
    }

    static get instance(): CardUsageManager {
        if (!this._instance) {
            this._instance = new CardUsageManager();
        }
        return this._instance;
    }

    /**
     * 使用卡片（主入口）
     */
    async useCard(card: Card): Promise<void> {
        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            await UIMessage.error('游戏会话未初始化');
            return;
        }

        if (!session.isMyTurn()) {
            await UIMessage.warning('不是你的回合');
            return;
        }

        // 检查是否已掷骰
        if (session.hasRolled && session.hasRolled()) {
            await UIMessage.warning('本回合已掷骰，无法使用卡片');
            return;
        }

        // 检查是否有待决策
        if (session.getPendingDecision()) {
            await UIMessage.warning('有待决策事项，请先处理');
            return;
        }

        try {
            console.log(`[CardUsageManager] 使用卡片: ${card.name} (kind=${card.kind})`);

            if (card.canUseDirectly()) {
                // 直接使用（免租卡、转向卡）
                await this.handleDirectCard(card);
            } else if (card.needsTileTarget()) {
                // 需要选择tile
                await this.handleTileSelectionCard(card);
            } else if (card.needsPlayerTarget()) {
                // 需要选择玩家
                await this.handlePlayerSelectionCard(card);
            }
        } catch (error: any) {
            console.error('[CardUsageManager] 使用卡片失败:', error);
            await UIMessage.error(error.message || '使用卡片失败');
        }
    }

    /**
     * 处理直接使用的卡片
     */
    private async handleDirectCard(card: Card): Promise<void> {
        console.log(`[CardUsageManager] 直接使用卡片: ${card.name}`);
        const params: number[] = [];
        await this.callUseCard(card.kind, params);
    }

    /**
     * 处理需要选择tile的卡片
     */
    private async handleTileSelectionCard(card: Card): Promise<void> {
        const session = GameInitializer.getInstance()?.getGameSession();
        const myPlayer = session?.getMyPlayer();
        if (!myPlayer) {
            console.error('[CardUsageManager] 无法获取当前玩家');
            return;
        }

        const currentPos = myPlayer.getPos();
        console.log(`[CardUsageManager] 当前玩家位置: ${currentPos}`);

        // 显示tile选择界面
        const selectedTile = await this.tileSelector.showTileSelection(card, currentPos);

        if (selectedTile === null) {
            console.log('[CardUsageManager] 用户取消选择');
            return;
        }

        console.log(`[CardUsageManager] 用户选择tile: ${selectedTile}`);

        // 构建参数
        const params = await this.buildTileCardParams(card, currentPos, selectedTile);

        if (params.length === 0) {
            await UIMessage.error('无法计算卡片参数');
            return;
        }

        console.log(`[CardUsageManager] ${card.name} 参数:`, params);

        // 调用合约
        await this.callUseCard(card.kind, params);
    }

    /**
     * 处理需要选择玩家的卡片
     */
    private async handlePlayerSelectionCard(card: Card): Promise<void> {
        console.log(`[CardUsageManager] 选择目标玩家: ${card.name}`);

        // 显示玩家选择界面
        const selectedPlayerIndex = await this.playerSelector.showPlayerSelection(true);

        if (selectedPlayerIndex === null) {
            console.log('[CardUsageManager] 用户取消选择');
            return;
        }

        console.log(`[CardUsageManager] 用户选择玩家: ${selectedPlayerIndex}`);

        const params = [selectedPlayerIndex];

        console.log(`[CardUsageManager] ${card.name} 参数:`, params);

        // 调用合约
        await this.callUseCard(card.kind, params);
    }

    /**
     * 构建tile卡片的参数
     */
    private async buildTileCardParams(
        card: Card,
        currentPos: number,
        selectedTile: number
    ): Promise<number[]> {
        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            console.error('[CardUsageManager] GameSession未初始化');
            return [];
        }

        const mapTemplate = session.getMapTemplate();
        if (!mapTemplate) {
            console.error('[CardUsageManager] MapTemplate未初始化');
            return [];
        }

        const graph = new MapGraph(mapTemplate);
        const pathfinder = new BFSPathfinder(graph);

        if (card.isRemoteControlCard()) {
            // 遥控骰子: params = [target_player_index, dice1, dice2, ...]
            const myPlayerIndex = session?.getMyPlayerIndex() || 0;

            // 计算路径
            const maxRange = card.getMaxRange();
            const bfsResult = pathfinder.search(currentPos, maxRange);
            const pathInfo = pathfinder.getPathTo(bfsResult, selectedTile);

            if (!pathInfo) {
                console.error('[CardUsageManager] 无法计算到目标的路径');
                return [];
            }

            // 保存计算好的路径，供后续投掷骰子使用
            session.setPendingRemoteDicePath(pathInfo.path);

            const steps = pathInfo.distance;
            console.log(`[CardUsageManager] 遥控骰子: 距离=${steps}步, 路径=${pathInfo.path}`);

            // 拆分为多个骰子值（每个1-6）
            const diceValues = this.splitIntoDiceValues(steps);
            console.log(`[CardUsageManager] 遥控骰子: 骰子值=${diceValues}`);

            return [myPlayerIndex, ...diceValues];

        } else if (card.isCleanseCard()) {
            // 净化卡: params = [tile1, tile2, ..., tile10]
            const extender = new PathExtender(graph);
            const result = extender.extendPath(currentPos, selectedTile, card.getMaxRange());

            if (!result.success) {
                console.error('[CardUsageManager] 路径延伸失败:', result.error);
                return [];
            }

            console.log(`[CardUsageManager] 净化卡: 路径长度=${result.fullPath.length}`);
            console.log(`[CardUsageManager] 净化卡路径:`, result.fullPath);

            // 返回完整路径（去掉起点）
            return result.fullPath.slice(1);

        } else if (card.isSimpleNpcCard()) {
            // 简单NPC放置卡: params = [tile_id]
            console.log(`[CardUsageManager] NPC放置卡: tile=${selectedTile}`);
            return [selectedTile];
        }

        console.warn('[CardUsageManager] 未知的tile卡片类型');
        return [];
    }

    /**
     * 调用use_card合约
     */
    private async callUseCard(kind: number, params: number[]): Promise<void> {
        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) throw new Error('游戏会话未初始化');

        const gameId = session.getGameId();
        const mySeat = session.getMySeat();
        const mapTemplateId = session.getTemplateMapId();

        if (!gameId || !mySeat || !mapTemplateId) {
            throw new Error('缺少游戏、座位或地图信息');
        }

        const seatId = mySeat.id;

        console.log('[CardUsageManager] 调用use_card合约:', {
            gameId,
            seatId,
            mapTemplateId,
            kind,
            params
        });

        // 动态导入CardInteraction
        const { CardInteraction } = await import('../sui/interactions/CardInteraction');
        const result = await CardInteraction.useCard(gameId, seatId, mapTemplateId, kind, params);

        if (result.success) {
            await UIMessage.success('卡片使用成功');
            console.log('[CardUsageManager] 卡片使用成功, digest:', result.digest);
            // 触发事件刷新UI
            EventBus.emit(EventTypes.Card.UseCard, { kind, params });
        } else {
            throw new Error(result.message || '交易失败');
        }
    }

    /**
     * 将步数拆分为多个骰子值（每个1-6）
     * 用于遥控骰子参数构建
     */
    private splitIntoDiceValues(steps: number): number[] {
        const dice: number[] = [];
        let remaining = steps;

        while (remaining > 0) {
            if (remaining >= 6) {
                dice.push(6);
                remaining -= 6;
            } else {
                dice.push(remaining);
                remaining = 0;
            }
        }

        return dice;
    }
}
