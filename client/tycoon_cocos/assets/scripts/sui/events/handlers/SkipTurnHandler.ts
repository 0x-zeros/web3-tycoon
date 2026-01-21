/**
 * SkipTurnHandler - 跳过回合事件处理器
 */

import type { EventMetadata } from '../types';
import type { SkipTurnEvent } from '../types';
import { EventBus } from '../../../events/EventBus';
import { Blackboard } from '../../../events/Blackboard';
import { UINotification } from '../../../ui/utils/UINotification';
import { IdFormatter } from '../../../ui/utils/IdFormatter';

export class SkipTurnHandler {
    private static _instance: SkipTurnHandler | null = null;

    public static getInstance(): SkipTurnHandler {
        if (!SkipTurnHandler._instance) {
            SkipTurnHandler._instance = new SkipTurnHandler();
        }
        return SkipTurnHandler._instance;
    }

    public async handleEvent(metadata: EventMetadata<SkipTurnEvent>): Promise<void> {
        const event = metadata.data;

        // 更新 GameSession turn
        const session = Blackboard.instance.get<any>("currentGameSession");
        if (session) {
            session.setRound(event.round);
            await session.advance_turn(event.turn);

            // 更新玩家的hospital状态（通过索引）
            const player = session.getPlayerByIndex(event.player);
            if (player && event.remaining_turns !== null && event.remaining_turns !== undefined) {
                // reason: 2=医院
                player.setInHospitalTurns(event.remaining_turns);
                console.log('[SkipTurnHandler] 更新医院剩余回合', {
                    playerIndex: event.player,
                    remainingTurns: event.remaining_turns
                });
            }
        }

        // 显示通知
        UINotification.info(
            `玩家 ${event.player + 1} 在医院，还需休息 ${event.remaining_turns} 天`,
            '跳过回合'
        );
    }
}

export const skipTurnHandler = {
    get instance(): SkipTurnHandler {
        return SkipTurnHandler.getInstance();
    }
};
