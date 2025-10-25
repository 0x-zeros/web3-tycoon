/**
 * CardInteraction - 卡片合约交互
 *
 * 封装use_card合约调用
 * 构建PTB (Programmable Transaction Block)
 *
 * @author Web3 Tycoon Team
 */

import { Transaction } from '@mysten/sui/transactions';
import { SuiManager } from '../managers/SuiManager';

/**
 * 交易结果
 */
export interface TransactionResult {
    success: boolean;
    message: string;
    digest?: string;
}

/**
 * 卡片合约交互
 */
export class CardInteraction {
    /**
     * 调用use_card合约函数
     *
     * entry fun use_card(
     *     game: &mut Game,
     *     seat: &Seat,
     *     kind: u8,
     *     params: vector<u16>,
     *     game_data: &GameData,
     *     map: &map::MapTemplate,
     *     ctx: &mut TxContext
     * )
     */
    static async useCard(
        gameId: string,
        seatId: string,
        mapTemplateId: string,
        cardKind: number,
        params: number[]
    ): Promise<TransactionResult> {
        try {
            console.log('[CardInteraction] 调用use_card:', {
                gameId,
                seatId,
                mapTemplateId,
                cardKind,
                params
            });

            const tx = this.buildUseCardTransaction(gameId, seatId, mapTemplateId, cardKind, params);

            // 执行交易
            const result = await SuiManager.instance.signAndExecuteTransaction(tx);

            console.log('[CardInteraction] 交易成功:', result.digest);

            return {
                success: true,
                message: '卡片使用成功',
                digest: result.digest
            };
        } catch (error: any) {
            console.error('[CardInteraction] useCard失败:', error);
            return {
                success: false,
                message: error.message || '使用卡片失败'
            };
        }
    }

    /**
     * 构建use_card交易
     */
    private static buildUseCardTransaction(
        gameId: string,
        seatId: string,
        mapTemplateId: string,
        cardKind: number,
        params: number[]
    ): Transaction {
        const tx = new Transaction();
        const config = SuiManager.instance.config;

        if (!config) {
            throw new Error('SuiManager配置未初始化');
        }

        // 获取必要的对象
        const packageId = config.packageId;
        const gameDataId = config.gameDataId;

        if (!packageId || !gameDataId) {
            throw new Error('缺少必要的配置: packageId, gameDataId');
        }

        console.log('[CardInteraction] 构建交易:', {
            packageId,
            gameDataId,
            mapTemplateId,
            cardKind,
            paramsLength: params.length
        });

        // 调用use_card
        tx.moveCall({
            target: `${packageId}::game::use_card`,
            arguments: [
                tx.object(gameId),
                tx.object(seatId),
                tx.pure.u8(cardKind),
                tx.pure.vector('u16', params),
                tx.object(gameDataId),
                tx.object(mapTemplateId)
            ]
        });

        return tx;
    }
}
