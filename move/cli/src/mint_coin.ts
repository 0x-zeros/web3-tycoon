import { Transaction } from '@mysten/sui/transactions';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { get_keypair_from_keystore, get_newly_created_object, get_transaction_events } from './utils';
import { createNetworkConfig, getExplorerUrl, NetworkType } from './config/config';

//从命令行参数获取该值，默认localnet
const env = process.argv[2] || 'localnet';
console.log('env:', env);

const networkConfig = createNetworkConfig(env as NetworkType);
const suiRpcUrl = networkConfig.url;
const PACKAGE_ID = networkConfig.variables.packageId;

const COIN_TYPE = networkConfig.variables.coinType;
const TREASURY_CAP = networkConfig.variables.treasuryCap;



async function main(){

    console.log('suiRpcUrl:', suiRpcUrl);
    console.log('PACKAGE_ID:', PACKAGE_ID);
    console.log('COIN_TYPE:', COIN_TYPE);
    console.log('TREASURY_CAP:', TREASURY_CAP);
    console.log('--------------------------------');

    const keypair = get_keypair_from_keystore();

    const publicKey = keypair.getPublicKey();
    const address = publicKey.toSuiAddress();
    console.log('Wallet Address:', address);

    const client = new SuiClient({ url: suiRpcUrl });
    let balance = await client.getBalance({ owner: address });
    console.log('Account Balance:', balance);

    let newobjectId = await mint_coin(client, keypair, address);
    console.log('newobjectId:', newobjectId);

    const url = networkConfig.variables.explorer(newobjectId!);
    console.log('url:', url);

    const url2 = networkConfig.variables.explorer_suiscan(newobjectId!);
    console.log('url2:', url2);
}


async function mint_coin(client: SuiClient, keypair: Ed25519Keypair, to_address: string){
    const tx = new Transaction();
    tx.moveCall({
                target: `0x2::coin::mint_and_transfer`,
                arguments: [tx.object(TREASURY_CAP), tx.pure.u64(100000000), tx.pure.address(to_address)],
                typeArguments: [COIN_TYPE]
            });
    const result = await client.signAndExecuteTransaction({signer: keypair,transaction: tx,});
    console.log('mint_coin tx:', result);

    //wait
    //https://sdk.mystenlabs.com/typescript/sui-client
    const transaction = await client.waitForTransaction({
        digest: result.digest,
        options: {
            showEffects: true,
            showObjectChanges: true
        },
    });

    let newobjectId = await get_newly_created_object(suiRpcUrl, result.digest);
    return newobjectId;
}



//run
main().catch(console.error);
