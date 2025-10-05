import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { Blackboard } from "../../events/Blackboard";
import * as fgui from "fairygui-cc";
import { _decorator, SpriteFrame, Rect, Size, assetManager, Sprite, Texture2D, ImageAsset } from 'cc';
import { GButton, GObject } from "fairygui-cc";
import { VoxelSystem } from "../../voxel/VoxelSystem";
import { UIManager, UILayer } from "../core/UIManager";



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

    // WalletList组件引用
    private m_walletListComponent: fgui.GComponent | null = null;

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

        // 清理WalletList
        this._closeWalletList();

        // 调用父类解绑
        super.unbindEvents();
    }

    private _onConnectClick(): void {
        console.log("[UIWallet] Connect clicked");

        const suiWallets = this.getSuiWallets();

        // 创建并显示WalletList
        this._showWalletList(suiWallets);
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

        //选出所有的sui钱包
        const suiWallets = this._filterSuiWallets(wallets);
        console.log("suiWallets length: ", suiWallets.length);
        console.log("suiWallets: ", suiWallets);

        return suiWallets;
    }

    /**
     * 显示钱包列表
     */
    private _showWalletList(suiWallets: Wallet[]): void {
        // 如果已经有WalletList在显示，先关闭
        if (this.m_walletListComponent) {
            this._closeWalletList();
        }

        // 创建WalletList组件
        this.m_walletListComponent = fgui.UIPackage.createObject("Common", "WalletList").asCom;
        if (!this.m_walletListComponent) {
            console.error("[UIWallet] Failed to create WalletList component");
            return;
        }

        // 获取wallets列表
        const walletsList = this.m_walletListComponent.getChild("wallets") as fgui.GList;
        if (!walletsList) {
            console.error("[UIWallet] Failed to get wallets list from WalletList component");
            return;
        }

        // 设置列表数据
        walletsList.numItems = suiWallets.length;

        // 填充每个item
        for (let i = 0; i < suiWallets.length; i++) {
            const wallet = suiWallets[i];
            const item = walletsList.getChildAt(i).asCom;

            // 设置title
            const titleText = item.getChild("title") as fgui.GTextField;
            if (titleText) {
                titleText.text = wallet.name;
            }

            // 设置icon
            const iconLoader = item.getChild("icon") as fgui.GLoader;
            if (iconLoader && wallet.icon) {
                this._loadWalletIcon(wallet.icon, iconLoader);
            }

            // 添加点击事件
            item.onClick(() => this._onWalletItemClick(wallet), this);
        }

        // 添加到POPUP层并居中显示
        const popupLayer = UIManager.instance.getLayer(UILayer.POPUP);
        if (!popupLayer) {
            console.error("[UIWallet] POPUP layer not found");
            return;
        }

        popupLayer.addChild(this.m_walletListComponent);

        // 居中显示
        const groot = fgui.GRoot.inst;
        const x = (groot.width - this.m_walletListComponent.width) / 2;
        const y = (groot.height - this.m_walletListComponent.height) / 2;
        this.m_walletListComponent.setPosition(x, y);

        console.log(`[UIWallet] WalletList displayed with ${suiWallets.length} wallets`);
    }

    /**
     * 加载钱包图标
     */
    private _loadWalletIcon(iconDataURL: string, iconLoader: fgui.GLoader): void {
        this.createSpriteFrameFromDataURL(iconDataURL, (err, spriteFrame) => {
            if (err || !spriteFrame) {
                console.error("[UIWallet] Failed to load wallet icon:", err);
                return;
            }

            iconLoader.texture = spriteFrame;
        });
    }

    /**
     * 关闭钱包列表
     */
    private _closeWalletList(): void {
        if (this.m_walletListComponent) {
            this.m_walletListComponent.removeFromParent();
            this.m_walletListComponent.dispose();
            this.m_walletListComponent = null;
        }
    }

    /**
     * 钱包item点击事件
     */
    private async _onWalletItemClick(wallet: Wallet): Promise<void> {
        console.log(`[UIWallet] Wallet clicked: ${wallet.name}`);

        try {
            // 调用钱包连接
            const accounts = await wallet.features['standard:connect'].connect();
            console.log(`[UIWallet] Connected to ${wallet.name}, accounts:`, accounts);

            // 关闭WalletList
            this._closeWalletList();

            // 显示连接成功通知
            UINotification.success(`已连接到 ${wallet.name}`);

            // 监听钱包变化
            wallet.features['standard:events'].on('change', this._onWalletChange.bind(this));

        } catch (error) {
            console.error(`[UIWallet] Failed to connect to ${wallet.name}:`, error);
            UINotification.error(`连接 ${wallet.name} 失败`);
        }
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
     * 从 data URL 创建 SpriteFrame（callback方式）
     * @param dataURL - base64 图片数据或远程 URL
     * @param callback - 回调函数 (err, spriteFrame)
     */
    private createSpriteFrameFromDataURL(dataURL: string, callback: (err: Error | null, spriteFrame: SpriteFrame | null) => void): void {
        assetManager.loadRemote<ImageAsset>(dataURL, { ext: '.png' }, (err, imageAsset) => {
            if (err) {
                console.error('[UIWallet] assetManager.loadRemote failed:', err);
                callback(err, null);
                return;
            }

            const tex = new Texture2D();
            tex.image = imageAsset;

            const sf = new SpriteFrame();
            sf.texture = tex;

            callback(null, sf);
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