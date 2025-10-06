/**
 * 资产查询服务
 * 封装玩家资产查询逻辑（Coins、NFTs、DeFi 资产等）
 */

import { SuiClient, SuiObjectResponse } from '@mysten/sui/client';
import type { SeatNFT, MapTemplateNFT, DeFiAssets, CoinInfo } from '../types/assets';

/**
 * 资产服务类
 */
export class AssetService {
    constructor(
        private client: SuiClient,
        private packageId: string
    ) {}

    // ============ SUI Coins 查询 ============

    /**
     * 获取 SUI 余额（所有 Coin<SUI> 的总和）
     * @param address 钱包地址
     * @returns SUI 余额（单位：MIST，1 SUI = 10^9 MIST）
     */
    async getSuiBalance(address: string): Promise<bigint> {
        try {
            const balance = await this.client.getBalance({
                owner: address,
                coinType: '0x2::sui::SUI'
            });

            console.log(`[AssetService] SUI balance for ${address}:`, balance.totalBalance);
            return BigInt(balance.totalBalance);

        } catch (error) {
            console.error('[AssetService] Failed to get SUI balance:', error);
            return 0n;
        }
    }

    /**
     * 获取所有 Coin 对象
     * @param address 钱包地址
     * @param coinType Coin 类型（默认 SUI）
     * @returns Coin 信息列表
     */
    async getAllCoins(address: string, coinType: string = '0x2::sui::SUI'): Promise<CoinInfo[]> {
        try {
            const response = await this.client.getAllCoins({
                owner: address,
                coinType
            });

            return response.data.map(coin => ({
                objectId: coin.coinObjectId,
                coinType: coin.coinType,
                balance: BigInt(coin.balance),
                version: coin.version
            }));

        } catch (error) {
            console.error('[AssetService] Failed to get all coins:', error);
            return [];
        }
    }

    // ============ Game NFTs 查询 ============

    /**
     * 获取玩家拥有的 Seat NFT
     * @param address 钱包地址
     * @returns Seat NFT 列表
     */
    async getPlayerSeats(address: string): Promise<SeatNFT[]> {
        try {
            const response = await this.client.getOwnedObjects({
                owner: address,
                filter: {
                    StructType: `${this.packageId}::game::Seat`
                },
                options: {
                    showContent: true,
                    showType: true
                }
            });

            const seats: SeatNFT[] = [];

            for (const obj of response.data) {
                const seat = this._parseSeatNFT(obj);
                if (seat) {
                    seats.push(seat);
                }
            }

            console.log(`[AssetService] Found ${seats.length} Seat NFTs for ${address}`);
            return seats;

        } catch (error) {
            console.error('[AssetService] Failed to get seats:', error);
            return [];
        }
    }

    /**
     * 获取 Map Template Creator NFT（预留）
     * @param address 钱包地址
     * @returns Map Template NFT 列表
     */
    async getMapTemplateNFTs(address: string): Promise<MapTemplateNFT[]> {
        // TODO: 实现 Map Template Creator NFT 查询
        // 需要等待 Move 合约实现 Creator NFT 系统
        //
        // 预期实现：
        // const response = await this.client.getOwnedObjects({
        //     owner: address,
        //     filter: {
        //         StructType: `${this.packageId}::map::TemplateCreatorNFT`
        //     }
        // });

        console.log('[AssetService] Map Template NFTs query not implemented yet');
        return [];
    }

    // ============ DeFi 资产查询（预留）============

    /**
     * 获取 DeFi 相关资产
     * @param address 钱包地址
     * @returns DeFi 资产信息
     */
    async getDeFiAssets(address: string): Promise<DeFiAssets> {
        console.log('[AssetService] DeFi assets query not implemented yet');

        // TODO: 集成 Bucket Protocol
        // 用途：去中心化数据存储、地图模板存储
        // const bucketAssets = await this._getBucketAssets(address);

        // TODO: 集成 Scallop Protocol
        // 用途：借贷协议、地产抵押借贷功能
        // const scallopAssets = await this._getScallopAssets(address);

        // TODO: 集成 Navi Protocol
        // 用途：流动性挖矿、质押奖励系统
        // const naviAssets = await this._getNaviAssets(address);

        return {
            bucketAssets: undefined,
            scallopAssets: undefined,
            naviAssets: undefined
        };
    }

    /**
     * 获取 Bucket Protocol 资产（预留）
     * @param address 钱包地址
     */
    private async _getBucketAssets(address: string): Promise<any> {
        // TODO: 实现 Bucket Protocol 资产查询
        // 参考：https://bucket.io/docs
        //
        // 可能包括：
        // - 存储空间余额
        // - 存储凭证 NFT
        // - 已上传的地图模板数据
        return null;
    }

    /**
     * 获取 Scallop Protocol 资产（预留）
     * @param address 钱包地址
     */
    private async _getScallopAssets(address: string): Promise<any> {
        // TODO: 实现 Scallop Protocol 资产查询
        // 参考：https://scallop.io/docs
        //
        // 可能包括：
        // - 存款资产（sTokens）
        // - 借款资产
        // - 抵押品（地产 NFT）
        // - 健康因子
        return null;
    }

    /**
     * 获取 Navi Protocol 资产（预留）
     * @param address 钱包地址
     */
    private async _getNaviAssets(address: string): Promise<any> {
        // TODO: 实现 Navi Protocol 资产查询
        // 参考：https://naviprotocol.io/docs
        //
        // 可能包括：
        // - 质押的 LP Token
        // - 待领取奖励
        // - 流动性挖矿收益
        // - veNAVI 治理代币
        return null;
    }

    // ============ 私有辅助方法 ============

    /**
     * 解析 Seat NFT
     */
    private _parseSeatNFT(response: SuiObjectResponse): SeatNFT | null {
        if (response.data?.content?.dataType !== 'moveObject') {
            return null;
        }

        try {
            const fields = response.data.content.fields as any;

            return {
                objectId: response.data.objectId,
                gameId: fields.game || '',
                playerIndex: Number(fields.player_index) || 0,
                player: fields.player || ''
            };
        } catch (error) {
            console.error('[AssetService] Failed to parse Seat NFT:', error);
            return null;
        }
    }

    /**
     * 格式化 SUI 数量（MIST → SUI）
     * @param mist MIST 数量（1 SUI = 10^9 MIST）
     * @param decimals 小数位数（默认 2）
     * @returns 格式化后的字符串（如 "123.45"）
     */
    public static formatSuiAmount(mist: bigint, decimals: number = 2): string {
        const sui = Number(mist) / 1_000_000_000;
        return sui.toFixed(decimals);
    }

    /**
     * 缩短地址显示
     * @param address 完整地址
     * @returns 缩略地址（如 "0x1234...5678"）
     */
    public static shortenAddress(address: string): string {
        if (!address || address.length < 10) return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
}
