import { Node, Label, _decorator } from "cc";
import { UIBase } from "../core/UIBase";
import { UIButton } from "../components/UIButton";
import { EventBus } from "../events/EventBus";
import { EventTypes } from "../events/EventTypes";
import { Blackboard } from "../events/Blackboard";

const { ccclass, property } = _decorator;

/**
 * 主菜单UI界面
 */
@ccclass('MainMenuUI')
export class MainMenuUI extends UIBase {
    @property(UIButton)
    startGameButton: UIButton | null = null;

    @property(UIButton)
    settingsButton: UIButton | null = null;

    @property(UIButton)
    quitGameButton: UIButton | null = null;

    @property(Label)
    titleLabel: Label | null = null;

    @property(Label)
    versionLabel: Label | null = null;

    @property(Node)
    backgroundNode: Node | null = null;

    /**
     * 初始化UI
     */
    protected onInit(): void {
        this._setupComponents();
        this._setupDefaultValues();
    }

    /**
     * 设置组件
     */
    private _setupComponents(): void {
        // 自动获取组件
        if (!this.startGameButton) {
            const startNode = this.node.getChildByPath("StartGameButton") ||
                             this.node.getChildByPath("Buttons/StartGameButton");
            if (startNode) {
                this.startGameButton = startNode.getComponent(UIButton);
            }
        }

        if (!this.settingsButton) {
            const settingsNode = this.node.getChildByPath("SettingsButton") ||
                                this.node.getChildByPath("Buttons/SettingsButton");
            if (settingsNode) {
                this.settingsButton = settingsNode.getComponent(UIButton);
            }
        }

        if (!this.quitGameButton) {
            const quitNode = this.node.getChildByPath("QuitGameButton") ||
                            this.node.getChildByPath("Buttons/QuitGameButton");
            if (quitNode) {
                this.quitGameButton = quitNode.getComponent(UIButton);
            }
        }

        if (!this.titleLabel) {
            const titleNode = this.node.getChildByPath("Title") ||
                             this.node.getChildByPath("TitleLabel");
            if (titleNode) {
                this.titleLabel = titleNode.getComponent(Label);
            }
        }

        if (!this.versionLabel) {
            const versionNode = this.node.getChildByPath("VersionLabel") ||
                               this.node.getChildByPath("Version");
            if (versionNode) {
                this.versionLabel = versionNode.getComponent(Label);
            }
        }

        if (!this.backgroundNode) {
            this.backgroundNode = this.node.getChildByName("Background") ||
                                 this.node.getChildByName("Bg");
        }
    }

    /**
     * 设置默认值
     */
    private _setupDefaultValues(): void {
        // 设置标题
        if (this.titleLabel) {
            this.titleLabel.string = "Web3 Tycoon";
        }

        // 设置版本信息
        if (this.versionLabel) {
            this.versionLabel.string = "v1.0.0";
        }

        // 设置按钮文本
        if (this.startGameButton) {
            this.startGameButton.text = "开始游戏";
            this.startGameButton.buttonId = "start_game";
        }

        if (this.settingsButton) {
            this.settingsButton.text = "设置";
            this.settingsButton.buttonId = "settings";
        }

        if (this.quitGameButton) {
            this.quitGameButton.text = "退出游戏";
            this.quitGameButton.buttonId = "quit_game";
        }
    }

    /**
     * 绑定UI事件
     */
    protected bindEvents(): void {
        // 绑定按钮点击事件
        if (this.startGameButton) {
            this.startGameButton.setClickCallback(() => this.onStartGameClick());
        }

        if (this.settingsButton) {
            this.settingsButton.setClickCallback(() => this.onSettingsClick());
        }

        if (this.quitGameButton) {
            this.quitGameButton.setClickCallback(() => this.onQuitGameClick());
        }

        // 监听游戏状态变化
        EventBus.onEvent(EventTypes.Game.GameStart, this.onGameStart, this);
        EventBus.onEvent(EventTypes.Game.GameEnd, this.onGameEnd, this);

        // 监听玩家数据变化
        Blackboard.instance.watch("playerName", this.onPlayerNameChange, this);
        Blackboard.instance.watch("gameVersion", this.onVersionChange, this);
    }

    /**
     * 解绑UI事件
     */
    protected unbindEvents(): void {
        if (this.startGameButton) {
            this.startGameButton.setClickCallback(null as any);
        }

        if (this.settingsButton) {
            this.settingsButton.setClickCallback(null as any);
        }

        if (this.quitGameButton) {
            this.quitGameButton.setClickCallback(null as any);
        }

        // 解绑事件监听
        EventBus.offTarget(this);
        Blackboard.instance.unwatchTarget(this);
    }

    /**
     * 显示前回调
     */
    protected onBeforeShow(data: any): void {
        // 可以在这里播放背景音乐
        EventBus.emitEvent(EventTypes.Audio.PlayBGM, { 
            musicPath: "audio/bgm/main_menu",
            loop: true 
        });

        // 检查是否有玩家数据
        this._checkPlayerData();
    }

    /**
     * 显示后回调
     */
    protected onAfterShow(data: any): void {
        // 可以播放UI显示动画
        this._playShowAnimation();
    }

    /**
     * 开始游戏按钮点击
     */
    private onStartGameClick(): void {
        // 发送开始游戏事件
        EventBus.emitEvent(EventTypes.UI.StartGame, {
            source: "main_menu"
        });

        // 可以在这里显示加载界面
        this.startGameButton!.showLoading("启动中...");

        // 模拟加载延迟
        setTimeout(() => {
            this.startGameButton!.hideLoading("开始游戏");
            
            // 隐藏主菜单，显示游戏界面
            EventBus.emitEvent(EventTypes.Game.GameStart, {
                gameMode: "single_player"
            });
        }, 2000);
    }

    /**
     * 设置按钮点击
     */
    private onSettingsClick(): void {
        // 发送打开设置界面事件
        EventBus.emitEvent(EventTypes.UI.ShowSettings, {
            source: "main_menu"
        });
    }

    /**
     * 退出游戏按钮点击
     */
    private onQuitGameClick(): void {
        // 显示确认对话框
        // UIDialog.showConfirm("确定要退出游戏吗？", "退出确认")
        //     .then((result) => {
        //         if (result === DialogResult.Yes) {
        //             // 退出游戏逻辑
        //             this._quitGame();
        //         }
        //     });

        // 暂时直接退出
        console.log("[MainMenuUI] Quit game requested");
        EventBus.emitEvent(EventTypes.System.AppBackground);
    }

    /**
     * 游戏开始事件处理
     */
    private onGameStart(data: any): void {
        console.log("[MainMenuUI] Game started:", data);
        
        // 隐藏主菜单
        this.hide();
        
        // 停止背景音乐
        EventBus.emitEvent(EventTypes.Audio.StopBGM);
    }

    /**
     * 游戏结束事件处理
     */
    private onGameEnd(data: any): void {
        console.log("[MainMenuUI] Game ended:", data);
        
        // 显示主菜单
        this.show();
        
        // 恢复背景音乐
        EventBus.emitEvent(EventTypes.Audio.PlayBGM, { 
            musicPath: "audio/bgm/main_menu",
            loop: true 
        });
    }

    /**
     * 玩家名称变化处理
     */
    private onPlayerNameChange(playerName: string): void {
        if (playerName && this.titleLabel) {
            this.titleLabel.string = `欢迎回来, ${playerName}`;
        }
    }

    /**
     * 版本信息变化处理
     */
    private onVersionChange(version: string): void {
        if (version && this.versionLabel) {
            this.versionLabel.string = version;
        }
    }

    /**
     * 检查玩家数据
     */
    private _checkPlayerData(): void {
        // 从黑板系统获取玩家数据
        const playerName = Blackboard.instance.get<string>("playerName");
        const lastPlayTime = Blackboard.instance.get<number>("lastPlayTime");

        if (playerName) {
            this.onPlayerNameChange(playerName);
        }

        if (lastPlayTime) {
            const now = Date.now();
            const diff = now - lastPlayTime;
            const hours = Math.floor(diff / (1000 * 60 * 60));
            
            if (hours > 24) {
                // 显示欢迎回来消息
                console.log(`[MainMenuUI] Welcome back after ${hours} hours`);
            }
        }

        // 更新最后游戏时间
        Blackboard.instance.set("lastPlayTime", Date.now(), true);
    }

    /**
     * 播放显示动画
     */
    private _playShowAnimation(): void {
        // 可以在这里添加UI显示动画
        // 比如按钮从下方滑入、标题渐现等
        console.log("[MainMenuUI] Playing show animation");
    }

    /**
     * 退出游戏
     */
    private _quitGame(): void {
        // 保存游戏数据
        Blackboard.instance.set("lastExitTime", Date.now(), true);
        
        // 发送退出事件
        EventBus.emitEvent(EventTypes.System.AppBackground);
        
        console.log("[MainMenuUI] Game quit");
    }

    /**
     * 刷新UI显示
     */
    protected onRefresh(data: any): void {
        this._checkPlayerData();
    }
}