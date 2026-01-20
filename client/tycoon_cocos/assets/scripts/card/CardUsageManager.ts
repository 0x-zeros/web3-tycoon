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
import { UICardBuildingSelector } from '../ui/game/UICardBuildingSelector';
import { UIMessage } from '../ui/utils/UIMessage';
import { UINotification } from '../ui/utils/UINotification';
import { GameInitializer } from '../core/GameInitializer';
import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';
import { BFSPathfinder } from '../sui/pathfinding/BFSPathfinder';
import { MapGraph } from '../sui/pathfinding/MapGraph';
import { PathExtender } from '../sui/pathfinding/PathExtender';
import { INVALID_TILE_ID, CardKind } from '../sui/types/constants';
import { UISummonNpc } from '../ui/game/UISummonNpc';

/**
 * 卡片使用管理器
 */
export class CardUsageManager {
    private static _instance: CardUsageManager;
    private tileSelector: UICardTileSelector;
    private playerSelector: UIPlayerSelector;
    private buildingSelector: UICardBuildingSelector;

    /** 当前正在使用的卡片（用于检测再次点击取消） */
    private currentUsingCard: Card | null = null;

    private constructor() {
        this.tileSelector = new UICardTileSelector();
        this.playerSelector = new UIPlayerSelector();
        this.buildingSelector = new UICardBuildingSelector();
    }

    static get instance(): CardUsageManager {
        if (!this._instance) {
            this._instance = new CardUsageManager();
        }
        return this._instance;
    }

    /**
     * 清除当前使用的卡牌状态（供外部调用）
     */
    public clearCurrentCard(): void {
        this.currentUsingCard = null;
    }

    /**
     * 使用卡片（主入口）
     */
    async useCard(card: Card): Promise<void> {
        // 检查是否正在选择tile目标（遥控骰子等）
        if (UICardTileSelector.isSelecting()) {
            // 如果再次点击同一张卡（需要tile目标的卡），则取消选择
            if (this.currentUsingCard &&
                this.currentUsingCard.kind === card.kind &&
                card.needsTileTarget()) {
                console.log('[CardUsageManager] 再次点击同一张卡，取消使用');
                UICardTileSelector.cancelSelection();
                this.currentUsingCard = null;
                return;
            }
        }

        // 检查是否正在选择玩家目标（冰冻卡等）
        if (UIPlayerSelector.isSelecting()) {
            // 如果再次点击同一张卡（需要玩家目标的卡），则取消选择
            if (this.currentUsingCard &&
                this.currentUsingCard.kind === card.kind &&
                card.needsPlayerTarget()) {
                console.log('[CardUsageManager] 再次点击同一张卡，取消使用');
                UIPlayerSelector.cancelSelection();
                this.currentUsingCard = null;
                return;
            }
        }

        // 检查是否正在选择建筑目标（建造卡、改建卡等）
        if (UICardBuildingSelector.isSelecting()) {
            // 如果再次点击同一张卡（需要建筑目标的卡），则取消选择
            if (this.currentUsingCard &&
                this.currentUsingCard.kind === card.kind &&
                card.needsBuildingTarget()) {
                console.log('[CardUsageManager] 再次点击同一张卡，取消使用');
                UICardBuildingSelector.cancelSelection();
                this.currentUsingCard = null;
                return;
            }
        }

        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            await UIMessage.error('游戏会话未初始化');
            return;
        }

        // 观战模式检查
        if (session.isSpectatorMode()) {
            UINotification.warning('观战模式下无法使用卡牌', undefined, undefined, 'center');
            return;
        }

        if (!session.isMyTurn()) {
            UINotification.warning('不是你的回合', undefined, undefined, 'center');
            return;
        }

        // 检查是否有待决策（优先级最高）
        if (session.getPendingDecision()) {
            UINotification.warning('有待决策事项，请先处理', undefined, undefined, 'center');
            return;
        }

        // 检查是否已掷骰
        if (session.hasRolled && session.hasRolled()) {
            UINotification.warning('本回合已掷骰，无法使用卡片', undefined, undefined, 'center');
            return;
        }

        try {
            console.log(`[CardUsageManager] 使用卡片: ${card.name} (kind=${card.kind}, targetType=${card.targetType})`);
            this.currentUsingCard = card;  // 记录当前使用的卡片

            if (card.canUseDirectly()) {
                // 直接使用（免租卡、转向卡）
                await this.handleDirectCard(card);
            } else if (card.isSummonCard()) {
                // 召唤卡：先选NPC再选tile
                await this.handleSummonCard(card);
            } else if (card.needsMultipleTargets()) {
                // 需要多个目标（如瞬移卡：先选玩家再选地块）
                await this.handleMultiTargetCard(card);
            } else if (card.needsPlayerTarget()) {
                // 只需要选择玩家
                await this.handlePlayerSelectionCard(card);
            } else if (card.needsTileTarget()) {
                // 只需要选择tile
                await this.handleTileSelectionCard(card);
            } else if (card.needsBuildingTarget()) {
                // 需要选择建筑
                await this.handleBuildingSelectionCard(card);
            }
        } catch (error: any) {
            console.error('[CardUsageManager] 使用卡片失败:', error);
            await UIMessage.error(error.message || '使用卡片失败');
        } finally {
            this.currentUsingCard = null;  // 清除记录
        }
    }

    /**
     * 处理召唤卡（先选NPC再选tile）
     */
    private async handleSummonCard(card: Card): Promise<void> {
        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            await UIMessage.error('游戏会话未初始化');
            return;
        }

        // 1. 显示NPC选择对话框
        console.log('[CardUsageManager] 召唤卡: 选择NPC类型');
        const npcKind = await UISummonNpc.show();

        if (npcKind === null) {
            console.log('[CardUsageManager] 用户取消选择NPC');
            return;
        }

        console.log(`[CardUsageManager] 选中NPC类型: kind=${npcKind}`);

        // 2. 显示tile选择界面（全地图选择，额外过滤已有NPC的格子）
        console.log('[CardUsageManager] 召唤卡: 选择目标地块');
        const myPlayer = session.getMyPlayer();
        if (!myPlayer) {
            console.error('[CardUsageManager] 无法获取当前玩家');
            return;
        }

        const currentPos = myPlayer.getPos();
        const selectedTile = await this.tileSelector.showTileSelectionForSummon(card, currentPos);

        if (selectedTile === null) {
            console.log('[CardUsageManager] 用户取消选择地块');
            return;
        }

        console.log(`[CardUsageManager] 选中地块: tileId=${selectedTile}`);

        // 3. 构建参数并调用合约
        // 召唤卡参数: [tile_id, npc_kind]
        const params = [selectedTile, npcKind];

        console.log(`[CardUsageManager] 召唤卡参数:`, params);

        // 获取NPC名称用于显示
        const npcNames: { [key: number]: string } = {
            20: '路障',
            21: '炸弹',
            22: '恶犬',
            23: '土地神',
            24: '财神',
            25: '福神',
            26: '穷神'
        };
        const npcName = npcNames[npcKind] || `NPC(${npcKind})`;

        await this.callUseCard(card.kind, params, card.name, `Tile ${selectedTile} 放置${npcName}`);
    }

    /**
     * 处理需要多个目标的卡片（如瞬移卡：先选玩家再选地块）
     */
    private async handleMultiTargetCard(card: Card): Promise<void> {
        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            await UIMessage.error('游戏会话未初始化');
            return;
        }

        const params: number[] = [];
        let targetDesc = '';

        // 按顺序处理各目标类型：Player → Tile → Building

        // 1. 选择玩家（如果需要）
        if (card.needsPlayerTarget()) {
            console.log(`[CardUsageManager] ${card.name}: 选择目标玩家`);
            const playerIndex = await this.playerSelector.showPlayerSelection(false);
            if (playerIndex === null) {
                console.log('[CardUsageManager] 用户取消选择玩家');
                return;
            }
            params.push(playerIndex);

            const targetPlayer = session.getPlayerByIndex(playerIndex);
            targetDesc = targetPlayer?.getName() || `玩家${playerIndex + 1}`;
            console.log(`[CardUsageManager] 选中玩家: ${targetDesc} (index=${playerIndex})`);
        }

        // 2. 选择地块（如果需要）
        if (card.needsTileTarget()) {
            console.log(`[CardUsageManager] ${card.name}: 选择目标地块`);

            // 对于瞬移卡，目标地块范围是全地图（不限制范围）
            const selectedTile = await this.tileSelector.showTileSelection(card, 0);
            if (selectedTile === null) {
                console.log('[CardUsageManager] 用户取消选择地块');
                return;
            }

            // 瞬移卡参数：[player_index, tile_id]
            params.push(selectedTile);
            targetDesc += ` → Tile ${selectedTile}`;
            console.log(`[CardUsageManager] 选中地块: ${selectedTile}`);
        }

        // 3. 选择建筑（如果需要）
        if (card.needsBuildingTarget()) {
            console.log(`[CardUsageManager] ${card.name}: 选择目标建筑`);

            const buildingId = await this.buildingSelector.showBuildingSelection(card);
            if (buildingId === null) {
                console.log('[CardUsageManager] 用户取消选择建筑');
                return;
            }

            params.push(buildingId);
            targetDesc += ` → Building #${buildingId}`;
            console.log(`[CardUsageManager] 选中建筑: ${buildingId}`);
        }

        console.log(`[CardUsageManager] ${card.name} 参数:`, params);
        await this.callUseCard(card.kind, params, card.name, targetDesc);
    }

    /**
     * 处理需要选择建筑的卡片
     */
    private async handleBuildingSelectionCard(card: Card): Promise<void> {
        console.log(`[CardUsageManager] 建筑选择卡片: ${card.name}`);

        const buildingId = await this.buildingSelector.showBuildingSelection(card);
        if (buildingId === null) {
            console.log('[CardUsageManager] 用户取消选择建筑');
            return;
        }

        console.log(`[CardUsageManager] 选中建筑: ${buildingId}`);

        const params = [buildingId];
        await this.callUseCard(card.kind, params, card.name, `Building #${buildingId}`);
    }

    /**
     * 处理直接使用的卡片
     */
    private async handleDirectCard(card: Card): Promise<void> {
        console.log(`[CardUsageManager] 直接使用卡片: ${card.name}`);
        const params: number[] = [];
        await this.callUseCard(card.kind, params, card.name);
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

        // 计算路径，获取第一步的tile用于更新朝向
        const mapTemplate = session?.getMapTemplate();
        if (mapTemplate) {
            const graph = new MapGraph(mapTemplate);
            const pathfinder = new BFSPathfinder(graph);
            const lastTileId = myPlayer.getLastTileId() ?? INVALID_TILE_ID;
            const maxRange = card.getMaxRange();

            const pathInfo = pathfinder.findPathWithConstraints(
                currentPos,
                selectedTile,
                maxRange,
                { lastTileId, allowBacktrackFirstStep: true }
            );

            if (pathInfo && pathInfo.path.length > 1) {
                // path[0] 是当前位置，path[1] 是第一步要走的tile
                const firstStepTile = pathInfo.path[1];
                myPlayer.setNextTileId(firstStepTile);
                console.log(`[CardUsageManager] 设置nextTileId为第一步: ${firstStepTile}`);
            }
        }

        // 构建参数
        const params = await this.buildTileCardParams(card, currentPos, selectedTile);

        if (params.length === 0) {
            await UIMessage.error('无法计算卡片参数');
            return;
        }

        console.log(`[CardUsageManager] ${card.name} 参数:`, params);

        // 调用合约
        await this.callUseCard(card.kind, params, card.name, `Tile ${selectedTile}`);
    }

    /**
     * 处理需要选择玩家的卡片
     */
    private async handlePlayerSelectionCard(card: Card): Promise<void> {
        console.log(`[CardUsageManager] 选择目标玩家: ${card.name}`);

        // 显示玩家选择界面（冰冻卡不排除自己，可以对自己使用）
        const selectedPlayerIndex = await this.playerSelector.showPlayerSelection(false);

        if (selectedPlayerIndex === null) {
            console.log('[CardUsageManager] 用户取消选择');
            return;
        }

        console.log(`[CardUsageManager] 用户选择玩家: ${selectedPlayerIndex}`);

        const params = [selectedPlayerIndex];

        // 获取目标玩家名称
        const session = GameInitializer.getInstance()?.getGameSession();
        const targetPlayer = session?.getPlayerByIndex(selectedPlayerIndex);
        const targetName = targetPlayer?.getName() || `玩家${selectedPlayerIndex + 1}`;

        // 冰冻卡相关提示
        const currentRound = session?.getRound() || 0;
        const myPlayerIndex = session?.getMyPlayerIndex() || 0;

        if (card.kind === CardKind.FREEZE) {
            // 提示冰冻生效回合（与Move端逻辑一致）
            // - 目标在自己之前行动（target < player）：下一Round生效
            // - 目标在自己之后行动（target >= player，包括自己）：当前Round生效
            const effectiveRound = selectedPlayerIndex < myPlayerIndex
                ? currentRound + 1
                : currentRound;
            const roundDesc = effectiveRound === currentRound ? '本回合' : '下一回合';
            UINotification.info(
                `${targetName}将在${roundDesc}被冻结（停在原地）`,
                undefined,
                3000,
                'rightbottom'
            );
        }

        console.log(`[CardUsageManager] ${card.name} 参数:`, params);

        // 调用合约
        await this.callUseCard(card.kind, params, card.name, targetName);
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
            const myPlayer = session.getMyPlayer();
            const lastTileId = myPlayer?.getLastTileId() ?? INVALID_TILE_ID;

            // 计算路径
            const maxRange = card.getMaxRange();
            const pathInfo = pathfinder.findPathWithConstraints(
                currentPos,
                selectedTile,
                maxRange,
                { lastTileId, allowBacktrackFirstStep: true }
            );

            if (!pathInfo) {
                console.error('[CardUsageManager] 无法计算到目标的路径');
                return [];
            }

            // 保存计算好的路径，供后续投掷骰子使用（去掉起点，只保留步进的tile）
            session.setPendingRemoteDicePath(pathInfo.path.slice(1));

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
    private async callUseCard(kind: number, params: number[], cardName: string, targetDesc?: string): Promise<void> {
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
            const msg = targetDesc ? `对${targetDesc}使用了${cardName}` : `使用了${cardName}`;
            UINotification.success(msg, undefined, undefined, 'center');
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
