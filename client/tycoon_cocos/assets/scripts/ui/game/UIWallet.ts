import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { Blackboard } from "../../events/Blackboard";
import * as fgui from "fairygui-cc";
import { _decorator, SpriteFrame, Rect, Size, assetManager, Sprite, Texture2D, ImageAsset } from 'cc';
import { GButton, GObject } from "fairygui-cc";
import { VoxelSystem } from "../../voxel/VoxelSystem";



import { bcs } from '@mysten/sui/bcs';
import {fromHex, toHex} from '@mysten/bcs';
import { SuiClient } from '@mysten/sui/client';
import { getWallets, IdentifierArray, IdentifierRecord, Wallet, WalletAccount } from '@mysten/wallet-standard';
import { UINotification } from "../utils/UINotification";


const { ccclass } = _decorator;

/**
 * 钱包界面 - 玩家查看钱包
 * 参考 https://docs.sui.io/standards/wallet-standard
 */
@ccclass('UIWallet')
export class UIWallet extends UIBase {

    private m_btn_wallet:fgui.GButton;   
    private m_btn_connect:fgui.GButton;
    private m_btn_disconnect:fgui.GButton;

    /**
     * 初始化回调
     */
    protected onInit(): void {
        this._setupComponents();
    }

    /**
     * 设置组件引用
     */
    private _setupComponents(): void {

        this.m_btn_wallet = this.getButton("btn_wallet");
        this.m_btn_connect = this.getButton("btn_connect");
        this.m_btn_disconnect = this.getButton("btn_disconnect");
    }
    
    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        // 绑定按钮点击事件
        if (this.m_btn_wallet) {
            this.m_btn_wallet.onClick(this._onWalletClick, this);
        }
        
        if (this.m_btn_connect) {
            this.m_btn_connect.onClick(this._onConnectClick, this);
        }

        if (this.m_btn_disconnect) {
            this.m_btn_disconnect.onClick(this._onDisconnectClick, this);
        }
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {

        // 解绑按钮点击事件
        if (this.m_btn_wallet) {
            this.m_btn_wallet.offClick(this._onWalletClick, this);
        }

        if (this.m_btn_connect) {
            this.m_btn_connect.offClick(this._onConnectClick, this);
        }

        if (this.m_btn_disconnect) {
            this.m_btn_disconnect.offClick(this._onDisconnectClick, this);
        }

        // 调用父类解绑
        super.unbindEvents();
    }

    private _onConnectClick(): void {
        console.log("[UIWallet] Connect clicked");

        const suiWallets = this.getSuiWallets();
        // console.log("suiWallets: ", suiWallets);

        //todo 使用suiWallets， Fairygui的Commmon的WalletList， 显示sui钱包列表

    }

    private _onDisconnectClick(): void {
        console.log("[UIWallet] Disconnect clicked");
    }

    /**
     * 钱包点击事件
     */
    private _onWalletClick(): void {
        console.log("[UIWallet] Wallet clicked");

        // UINotification.setAnchor("center");
        // UINotification.info("连接成功");
        // UINotification.warning("余额不足", "警告", 3000);
        // UINotification.error("网络错误", "");
      

        // this.testSuiClient();
    }

    private async testSuiClient(): Promise<void> {

        const DEV_NET_URL = 'https://fullnode.testnet.sui.io:443';
        const client = new SuiClient({ url: DEV_NET_URL });

        const {data, error} = await client.getObject({
            id: '0x8',
            options: {
                showBcs: true,
                showContent: true,
            }
        });

        console.log("wallet data: ", data);
        console.log("wallet error: ", error);

        // this.m_data.text = JSON.stringify(data);
    }

    private getSuiWallets(): Wallet[] {
        const wallets = getWallets().get();
        console.log("wallets length: ", wallets.length);
        console.log("getWallets: ", wallets);
        // for (const wallet of wallets) {
        //     console.log(`wallet index: ${wallets.indexOf(wallet)}, wallet name: ${wallet.name}, wallet icon: ${wallet.icon}`);
        //     console.log(wallet);
        // }

        //选出所有的sui钱包
        const suiWallets = this._filterSuiWallets(wallets);
        console.log("suiWallets length: ", suiWallets.length);
        console.log("suiWallets: ", suiWallets);

        // for (const wallet of suiWallets) {
        //     console.log(`wallet index: ${suiWallets.indexOf(wallet)}, wallet name: ${wallet.name}, wallet icon: ${wallet.icon}`);
        //     console.log(wallet);
        // }

        return suiWallets;

        //todo 显示sui钱包列表

        // //find wallet by name
        // const wallet = wallets.find((wallet) => wallet.name === "Suiet");//"Suiet"
        // if (wallet) {
        //     this.logWallet(wallet);
        // }
    }

    private _filterSuiWallets(wallets: readonly Wallet[]): Wallet[] {
        // return wallets.filter((wallet) => wallet.name === "Suiet");

        return wallets.filter((wallet) => {
            return typeof wallet.features['sui:signTransaction']?.['signTransaction'] === 'function';
        });

        // wallet.features['sui:signTransaction'].signTransaction({
        //     transaction: <Transaction>,
        //     account: <WalletAccount>
        //   })


        // const client: SuiClient
        // client.executeTransactionBlock({
        //     transactionBlock: bytes,
        //     signature: signature,
        //     options: {}
        // })
    }



    /**
     * 从 data URL 创建 SpriteFrame（异步加载）
     * @param dataURL - base64 图片数据或远程 URL
     * @returns Promise<SpriteFrame | null>
     */
    private async createSpriteFrameFromDataURL(dataURL: string): Promise<SpriteFrame | null> {
        return new Promise((resolve, reject) => {
            assetManager.loadRemote<ImageAsset>(dataURL, { ext: '.png' }, (err, imageAsset) => {
                if (err) {
                    console.error('[UIWallet] assetManager.loadRemote failed:', err);
                    reject(err);
                    return;
                }

                const tex = new Texture2D();
                tex.image = imageAsset;

                const sf = new SpriteFrame();
                sf.texture = tex;

                resolve(sf);
            });
        });
    }

    

    private async logWallet(wallet: Wallet): Promise<void> {
        // console.log('logWallet: ', wallet);
        console.log(`logWallet wallet ${wallet.name}: icon: ${wallet.icon}, accounts: ${wallet.accounts.length}`);
        for (let i = 0; i < wallet.accounts.length; i++) {
            const account: WalletAccount = wallet.accounts[i];
            console.log(`account ${i}: address: ${account.address}, publicKey: ${account.publicKey}`);
            console.log(account);
        }



        // 好像并不需要检测？
        // if (wallet.accounts.length < 1) {
        //     await wallet.features['standard:connect'].connect();
        // }
        // else {
        //     await wallet.features['standard:disconnect'].disconnect();
        // }


        //This call returns a function that can be called to unsubscribe from listening to the events.
        const unsubscribe = wallet.features['standard:events'].on('change', this._onWalletChange.bind(this));
        //unsubscribe();//on destroy


        //connect() 一次以后才能获取到wallet.accounts, 不然都是[]
        const accounts = await wallet.features['standard:connect'].connect();
        console.log(`after connect, accounts:`, accounts);





        //todo
        //or sui:signAndExecuteTransaction
        //wallet.features['sui:signTransaction'].signTransaction({
        // transaction: <Transaction>,
        // account: <WalletAccount>
        // })
    }

    //event:
    //{
        // accounts: WalletAccount[],
        // chains: IdentifierArray,
        // features: IdentifierRecord<unknown>
    //  }
    private _onWalletChange(event: { accounts: WalletAccount[], chains: IdentifierArray, features: IdentifierRecord<unknown> }): void {
        console.log('onWalletChange: ', event);
    }

}