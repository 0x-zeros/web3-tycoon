/**
 * Sui Faucet 工具
 * 使用官方 SDK 的 requestSuiFromFaucetV2
 *
 * Localnet: 需要运行 sui-test-validator --with-faucet
 * 文档: https://docs.sui.io/guides/developer/getting-started/local-network
 */

import { loadSuiFaucet } from '../loader';

/**
 * 从 Sui Faucet 请求测试币
 * @param address 接收地址
 * @param network 网络类型
 * @returns 是否成功
 */
export async function requestSuiFromFaucet(
    address: string,
    network: 'localnet' | 'devnet' | 'testnet'
): Promise<boolean> {
    console.log(`[Faucet] Requesting SUI from ${network} faucet...`);
    console.log(`  Recipient: ${address}`);

    try {
        // 动态加载并使用官方 SDK 的 requestSuiFromFaucetV2
        const { getFaucetHost, requestSuiFromFaucetV2 } = await loadSuiFaucet();
        const host = getFaucetHost(network);
        console.log(`  Faucet host: ${host}`);

        const result = await requestSuiFromFaucetV2({
            host,
            recipient: address
        });

        console.log('[Faucet] ✓ Request successful');
        console.log('  Result:', result);

        return true;

    } catch (error) {
        console.error('[Faucet] Request failed:', error);

        // 给出友好提示
        if (network === 'localnet') {
            console.log('[Faucet] 提示：确保 sui-test-validator 正在运行');
            console.log('  启动命令：RUST_LOG="off,sui_node=info" sui-test-validator --with-faucet');
            console.log('  或：sui start --with-faucet');
        } else if (network === 'testnet') {
            console.log('[Faucet] 提示：Testnet faucet 可能有限流');
            console.log('  建议使用 Web UI: https://faucet.sui.io');
        }

        return false;
    }
}
