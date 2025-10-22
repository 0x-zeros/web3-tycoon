import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });
const coinId = '0xe953fbf42b4e2cb987e31d79ade4880fcdab8184ceaf7e261b99a74dff9506fe';

async function main() {
    const obj = await client.getObject({
        id: coinId,
        options: { showType: true, showContent: true }
    });
    
    console.log('对象类型:', obj.data?.type);
    console.log('内容:', obj.data?.content);
}

main().catch(console.error);
