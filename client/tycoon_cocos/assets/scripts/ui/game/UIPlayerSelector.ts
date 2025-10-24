/**
 * UIPlayerSelector - 玩家选择器
 *
 * 用于选择目标玩家（如冰冻卡）
 * 临时实现：自动选择第一个玩家
 * TODO: 使用FairyGUI创建完整的选择界面
 *
 * @author Web3 Tycoon Team
 */

import { GameInitializer } from '../../core/GameInitializer';
import { UIMessage } from '../utils/UIMessage';

/**
 * 玩家选择器 - 用于选择目标玩家（如冰冻卡）
 */
export class UIPlayerSelector {
    /**
     * 显示玩家选择对话框
     * @param excludeMyself 是否排除自己
     * @returns 选中的玩家索引，取消返回null
     */
    async showPlayerSelection(excludeMyself: boolean = true): Promise<number | null> {
        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            console.error('[UIPlayerSelector] GameSession未初始化');
            return null;
        }

        const allPlayers = session.getAllPlayers();
        const myPlayerIndex = session.getMyPlayerIndex();

        const selectablePlayers = allPlayers
            .map((player, index) => ({ player, index }))
            .filter(({ index }) => !excludeMyself || index !== myPlayerIndex);

        if (selectablePlayers.length === 0) {
            await UIMessage.warning('没有可选择的玩家');
            return null;
        }

        console.log('[UIPlayerSelector] 可选玩家:', selectablePlayers.map(p => ({
            index: p.index,
            owner: p.player.owner,
            cash: p.player.cash
        })));

        // TODO: 使用FairyGUI创建玩家选择弹窗
        // 临时实现：自动选择第一个玩家
        const selected = selectablePlayers[0];
        console.log(`[UIPlayerSelector] 自动选择玩家 ${selected.index}`);

        return selected.index;
    }
}
