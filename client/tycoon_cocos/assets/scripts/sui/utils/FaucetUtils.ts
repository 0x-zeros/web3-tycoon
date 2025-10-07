/**
 * Sui Faucet 工具
 * 用于请求测试网的 SUI 代币
 */

/**
 * Faucet API 响应类型
 */
interface FaucetResponse {
    transferredGasObjects?: Array<{
        amount: number;
        id: string;
    }>;
    error?: string;
}

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
    // Faucet API URLs
    const faucetUrls: Record<string, string> = {
        localnet: 'http://127.0.0.1:9123/gas',
        devnet: 'https://faucet.devnet.sui.io/gas',
        testnet: 'https://faucet.testnet.sui.io/gas'
    };

    const url = faucetUrls[network];
    if (!url) {
        console.error(`[Faucet] Unknown network: ${network}`);
        return false;
    }

    console.log(`[Faucet] Requesting SUI from ${network} faucet...`);
    console.log(`  Recipient: ${address}`);
    console.log(`  Faucet URL: ${url}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                FixedAmountRequest: {
                    recipient: address
                }
            })
        });

        if (!response.ok) {
            console.error(`[Faucet] Request failed: ${response.status} ${response.statusText}`);
            return false;
        }

        const result: FaucetResponse = await response.json();

        if (result.error) {
            console.error(`[Faucet] Error: ${result.error}`);
            return false;
        }

        if (result.transferredGasObjects && result.transferredGasObjects.length > 0) {
            const totalAmount = result.transferredGasObjects.reduce(
                (sum, obj) => sum + obj.amount,
                0
            );

            console.log('[Faucet] ✓ Request successful');
            console.log(`  Received: ${totalAmount / 1_000_000_000} SUI`);
            console.log(`  Objects: ${result.transferredGasObjects.length}`);

            return true;
        }

        console.warn('[Faucet] No gas objects transferred');
        return false;

    } catch (error) {
        console.error('[Faucet] Request error:', error);
        return false;
    }
}
