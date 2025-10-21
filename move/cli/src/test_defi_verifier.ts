/**
 * DeFi Verifier 测试脚本 - Sui Mainnet Only
 *
 * 功能：
 * 1. 连接Sui主网
 * 2. 查询用户持有的Scallop MarketCoin对象
 * 3. 调用defi_verifier::verify_defi_coin验证DeFi存款
 * 4. 测试边界情况（普通Coin应该返回0）
 *
 * 用法：
 * npm run test:defi
 */

import { Transaction } from '@mysten/sui/transactions';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { get_keypair_from_keystore } from './utils';
import { networkConfig } from './config/config';

// ========== 配置常量 ==========

// Sui主网RPC URL
const suiRpcUrl = networkConfig.url;

// DeFi Verifier Package ID（需要部署后更新）
const DEFI_VERIFIER_PACKAGE = networkConfig.variables.defiVerifierPackageId;

// Scallop Protocol Package（用于识别MarketCoin）
const SCALLOP_PACKAGE = networkConfig.variables.scallopPackageId;

// ========== 主函数 ==========

async function main() {
    console.log('========================================');
    console.log('DeFi Verifier 测试工具 (Sui Mainnet)');
    console.log('========================================\n');

    console.log('网络配置:');
    console.log('  RPC URL:', suiRpcUrl);
    console.log('  DeFi Verifier Package:', DEFI_VERIFIER_PACKAGE);
    console.log('  Scallop Package:', SCALLOP_PACKAGE);
    console.log('');

    // 1. 获取keypair
    const keypair = get_keypair_from_keystore();
    const address = keypair.getPublicKey().toSuiAddress();
    console.log('钱包地址:', address);

    // 2. 连接主网
    const client = new SuiClient({ url: suiRpcUrl });

    // 3. 查询账户余额
    const balance = await client.getBalance({ owner: address });
    console.log('账户余额:', balance.totalBalance, 'MIST');
    console.log('');

    // 4. 查询Scallop MarketCoin对象
    console.log('========================================');
    console.log('查询Scallop MarketCoin对象...');
    console.log('========================================\n');

    const marketCoins = await queryScallopMarketCoins(client, address);

    if (marketCoins.length === 0) {
        console.log('⚠️  未发现Scallop MarketCoin对象');
        console.log('提示：请先在Scallop协议中存款以获取MarketCoin');
        console.log('');
    } else {
        console.log(`✅ 发现 ${marketCoins.length} 个MarketCoin对象\n`);

        // 5. 验证每个MarketCoin
        for (let i = 0; i < marketCoins.length; i++) {
            const coin = marketCoins[i];
            await testVerifyDefiCoin(client, keypair, coin, i + 1);
        }
    }

    // 6. 测试边界情况：普通SUI Coin应该返回0
    console.log('========================================');
    console.log('边界测试：验证普通SUI Coin');
    console.log('========================================\n');

    await testVerifyNormalCoin(client, keypair, address);

    console.log('========================================');
    console.log('测试完成！');
    console.log('========================================\n');
}

// ========== 辅助函数 ==========

/**
 * 查询用户持有的Scallop MarketCoin对象
 */
async function queryScallopMarketCoins(client: SuiClient, address: string) {
    try {
        const response = await client.getOwnedObjects({
            owner: address,
            options: {
                showType: true,
                showContent: true,
                showDisplay: true,
            },
        });

        // 过滤出MarketCoin对象
        const marketCoins = response.data.filter((obj: any) => {
            const type = obj.data?.type;
            if (!type) return false;

            // 检查是否包含Scallop的MarketCoin标识
            return (
                type.includes(SCALLOP_PACKAGE) &&
                type.includes('::reserve::MarketCoin')
            );
        });

        // 打印找到的对象
        marketCoins.forEach((coin: any, index: number) => {
            console.log(`MarketCoin #${index + 1}:`);
            console.log(`  对象ID: ${coin.data.objectId}`);
            console.log(`  类型: ${coin.data.type}`);

            // 尝试获取余额信息
            if (coin.data.content && 'fields' in coin.data.content) {
                const fields = coin.data.content.fields as any;
                if (fields.balance) {
                    console.log(`  余额: ${fields.balance}`);
                }
            }
            console.log('');
        });

        return marketCoins;
    } catch (error) {
        console.error('❌ 查询MarketCoin失败:', error);
        return [];
    }
}

/**
 * 测试验证DeFi Coin
 */
async function testVerifyDefiCoin(
    client: SuiClient,
    keypair: Ed25519Keypair,
    coinObj: any,
    index: number
) {
    console.log(`----------------------------------------`);
    console.log(`测试 #${index}: 验证MarketCoin`);
    console.log(`----------------------------------------`);

    const objectId = coinObj.data.objectId;
    const coinType = coinObj.data.type;

    console.log('对象ID:', objectId);
    console.log('类型:', coinType);
    console.log('');

    try {
        // 构造PTB调用verify_defi_coin
        const tx = new Transaction();

        // 提取泛型参数（MarketCoin的完整类型）
        // 例如: 0x...::reserve::MarketCoin<0x...::usdc::USDC>
        const typeArg = coinType.split('::coin::Coin<')[1]?.replace('>', '');

        if (!typeArg) {
            console.log('❌ 无法解析类型参数');
            return;
        }

        console.log('泛型参数:', typeArg);

        // 调用verify_defi_coin
        const result = tx.moveCall({
            target: `${DEFI_VERIFIER_PACKAGE}::defi_verifier::verify_defi_coin`,
            arguments: [tx.object(objectId)],
            typeArguments: [typeArg],
        });

        // 使用devInspect进行只读调用（不消耗gas）
        tx.setSender(keypair.getPublicKey().toSuiAddress());
        const dryRunResult = await client.devInspectTransactionBlock({
            sender: keypair.getPublicKey().toSuiAddress(),
            transactionBlock: tx,
        });

        console.log('调用结果:');
        console.log('  状态:', dryRunResult.effects.status.status);

        // 解析返回值
        if (dryRunResult.results && dryRunResult.results.length > 0) {
            const returnValues = dryRunResult.results[0].returnValues;
            if (returnValues && returnValues.length > 0) {
                // 第一个返回值是u8
                const scoreBytes = returnValues[0][0];
                const score = scoreBytes[0]; // u8的值
                console.log('  验证分数:', score);

                if (score === 1) {
                    console.log('  ✅ 验证成功！这是有效的DeFi存款');
                } else if (score === 0) {
                    console.log('  ❌ 验证失败：不是支持的DeFi类型或余额为0');
                } else {
                    console.log(`  🌟 验证成功（特殊分数: ${score}）`);
                }
            }
        }

        // 打印事件（如果有）
        if (dryRunResult.events && dryRunResult.events.length > 0) {
            console.log('触发事件:');
            dryRunResult.events.forEach((event: any, i: number) => {
                console.log(`  事件 #${i + 1}:`, event.type);
                console.log(`  内容:`, event.parsedJson);
            });
        }

        console.log('');
    } catch (error) {
        console.error('❌ 验证失败:', error);
        console.log('');
    }
}

/**
 * 测试验证普通SUI Coin（应该返回0）
 */
async function testVerifyNormalCoin(
    client: SuiClient,
    keypair: Ed25519Keypair,
    address: string
) {
    try {
        // 查询用户的SUI Coin
        const response = await client.getCoins({
            owner: address,
            coinType: '0x2::sui::SUI',
            limit: 1,
        });

        if (response.data.length === 0) {
            console.log('⚠️  账户没有SUI Coin，跳过测试');
            return;
        }

        const suiCoin = response.data[0];
        console.log('测试对象:', suiCoin.coinObjectId);
        console.log('类型: 0x2::sui::SUI');
        console.log('余额:', suiCoin.balance);
        console.log('');

        // 构造PTB
        const tx = new Transaction();

        tx.moveCall({
            target: `${DEFI_VERIFIER_PACKAGE}::defi_verifier::verify_defi_coin`,
            arguments: [tx.object(suiCoin.coinObjectId)],
            typeArguments: ['0x2::sui::SUI'],
        });

        // 只读调用
        tx.setSender(keypair.getPublicKey().toSuiAddress());
        const dryRunResult = await client.devInspectTransactionBlock({
            sender: keypair.getPublicKey().toSuiAddress(),
            transactionBlock: tx,
        });

        console.log('调用结果:');
        console.log('  状态:', dryRunResult.effects.status.status);

        // 解析返回值
        if (dryRunResult.results && dryRunResult.results.length > 0) {
            const returnValues = dryRunResult.results[0].returnValues;
            if (returnValues && returnValues.length > 0) {
                const scoreBytes = returnValues[0][0];
                const score = scoreBytes[0];
                console.log('  验证分数:', score);

                if (score === 0) {
                    console.log('  ✅ 正确！普通SUI Coin返回0（不是DeFi存款）');
                } else {
                    console.log(
                        `  ⚠️  异常！普通SUI Coin不应该返回非0值: ${score}`
                    );
                }
            }
        }

        console.log('');
    } catch (error) {
        console.error('❌ 测试失败:', error);
        console.log('');
    }
}

// ========== 运行 ==========

main().catch((error) => {
    console.error('\n❌ 程序异常:', error);
    process.exit(1);
});
