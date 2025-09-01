import { Node, Label, Sprite, ProgressBar, _decorator } from "cc";
import { UIBase } from "../core/UIBase";
import { UIButton } from "../components/UIButton";
import { EventBus } from "../events/EventBus";
import { EventTypes } from "../events/EventTypes";
import { Blackboard } from "../events/Blackboard";

const { ccclass, property } = _decorator;

/**
 * 游戏HUD界面 - 显示玩家信息、游戏状态等
 */
@ccclass('GameHUD')
export class GameHUD extends UIBase {
    // 玩家信息区域
    @property(Label)
    playerNameLabel: Label | null = null;

    @property(Label)
    playerMoneyLabel: Label | null = null;

    @property(Label)
    playerLevelLabel: Label | null = null;

    @property(Sprite)
    playerAvatar: Sprite | null = null;

    // 游戏状态区域
    @property(Label)
    roundLabel: Label | null = null;

    @property(Label)
    turnLabel: Label | null = null;

    @property(Label)
    timeLabel: Label | null = null;

    // 功能按钮区域
    @property(UIButton)
    pauseButton: UIButton | null = null;

    @property(UIButton)
    settingsButton: UIButton | null = null;

    @property(UIButton)
    bagButton: UIButton | null = null;

    @property(UIButton)
    diceButton: UIButton | null = null;

    // 进度条
    @property(ProgressBar)
    playerHpBar: ProgressBar | null = null;

    @property(ProgressBar)
    playerExpBar: ProgressBar | null = null;

    // 状态指示器
    @property(Node)
    statusIndicators: Node | null = null;

    // 小地图
    @property(Node)
    miniMap: Node | null = null;

    /** 当前玩家数据 */
    private _playerData: any = null;
    /** 游戏状态数据 */
    private _gameState: any = null;
    /** 计时器ID */
    private _timerInterval: number | null = null;

    /**
     * 初始化UI
     */
    protected onInit(): void {
        this._setupComponents();
        this._setupDefaultValues();
        this._startTimer();
    }

    /**
     * 设置组件
     */
    private _setupComponents(): void {
        // 自动获取玩家信息相关组件
        if (!this.playerNameLabel) {
            this.playerNameLabel = this.node.getChildByPath("PlayerInfo/NameLabel")?.getComponent(Label);
        }

        if (!this.playerMoneyLabel) {
            this.playerMoneyLabel = this.node.getChildByPath("PlayerInfo/MoneyLabel")?.getComponent(Label);
        }

        if (!this.playerLevelLabel) {
            this.playerLevelLabel = this.node.getChildByPath("PlayerInfo/LevelLabel")?.getComponent(Label);
        }

        if (!this.playerAvatar) {
            this.playerAvatar = this.node.getChildByPath("PlayerInfo/Avatar")?.getComponent(Sprite);
        }

        // 自动获取游戏状态相关组件
        if (!this.roundLabel) {
            this.roundLabel = this.node.getChildByPath("GameStatus/RoundLabel")?.getComponent(Label);
        }

        if (!this.turnLabel) {
            this.turnLabel = this.node.getChildByPath("GameStatus/TurnLabel")?.getComponent(Label);
        }

        if (!this.timeLabel) {
            this.timeLabel = this.node.getChildByPath("GameStatus/TimeLabel")?.getComponent(Label);
        }

        // 自动获取按钮组件
        if (!this.pauseButton) {
            const pauseNode = this.node.getChildByPath("Buttons/PauseButton");
            if (pauseNode) {
                this.pauseButton = pauseNode.getComponent(UIButton);
            }
        }

        if (!this.settingsButton) {
            const settingsNode = this.node.getChildByPath("Buttons/SettingsButton");
            if (settingsNode) {
                this.settingsButton = settingsNode.getComponent(UIButton);
            }
        }

        if (!this.bagButton) {
            const bagNode = this.node.getChildByPath("Buttons/BagButton");
            if (bagNode) {
                this.bagButton = bagNode.getComponent(UIButton);
            }
        }

        if (!this.diceButton) {
            const diceNode = this.node.getChildByPath("Buttons/DiceButton");
            if (diceNode) {
                this.diceButton = diceNode.getComponent(UIButton);
            }
        }

        // 自动获取进度条组件
        if (!this.playerHpBar) {
            this.playerHpBar = this.node.getChildByPath("PlayerInfo/HpBar")?.getComponent(ProgressBar);
        }

        if (!this.playerExpBar) {
            this.playerExpBar = this.node.getChildByPath("PlayerInfo/ExpBar")?.getComponent(ProgressBar);
        }

        // 自动获取其他组件
        if (!this.statusIndicators) {
            this.statusIndicators = this.node.getChildByName("StatusIndicators");
        }

        if (!this.miniMap) {
            this.miniMap = this.node.getChildByName("MiniMap");
        }
    }

    /**
     * 设置默认值
     */
    private _setupDefaultValues(): void {
        // 设置按钮文本和ID
        if (this.pauseButton) {
            this.pauseButton.text = "暂停";
            this.pauseButton.buttonId = "pause";
        }

        if (this.settingsButton) {
            this.settingsButton.text = "设置";
            this.settingsButton.buttonId = "settings";
        }

        if (this.bagButton) {
            this.bagButton.text = "背包";
            this.bagButton.buttonId = "bag";
        }

        if (this.diceButton) {
            this.diceButton.text = "投掷";
            this.diceButton.buttonId = "dice";
        }

        // 设置默认显示值
        this._updatePlayerDisplay();
        this._updateGameStatusDisplay();
    }

    /**
     * 绑定UI事件
     */
    protected bindEvents(): void {
        // 绑定按钮事件
        if (this.pauseButton) {
            this.pauseButton.setClickCallback(() => this.onPauseClick());
        }

        if (this.settingsButton) {
            this.settingsButton.setClickCallback(() => this.onSettingsClick());
        }

        if (this.bagButton) {
            this.bagButton.setClickCallback(() => this.onBagClick());
        }

        if (this.diceButton) {
            this.diceButton.setClickCallback(() => this.onDiceClick());
        }

        // 监听玩家数据变化
        Blackboard.instance.watch("playerMoney", this.onPlayerMoneyChange, this);
        Blackboard.instance.watch("playerLevel", this.onPlayerLevelChange, this);
        Blackboard.instance.watch("playerHp", this.onPlayerHpChange, this);
        Blackboard.instance.watch("playerExp", this.onPlayerExpChange, this);

        // 监听游戏状态变化
        Blackboard.instance.watch("currentRound", this.onRoundChange, this);
        Blackboard.instance.watch("currentTurn", this.onTurnChange, this);
        Blackboard.instance.watch("gameTime", this.onGameTimeChange, this);

        // 监听游戏事件
        EventBus.onEvent(EventTypes.Game.GamePause, this.onGamePause, this);
        EventBus.onEvent(EventTypes.Game.GameResume, this.onGameResume, this);
        EventBus.onEvent(EventTypes.Game.TurnStart, this.onTurnStart, this);
        EventBus.onEvent(EventTypes.Game.TurnEnd, this.onTurnEnd, this);

        // 监听骰子事件
        EventBus.onEvent(EventTypes.Dice.StartRoll, this.onDiceStart, this);
        EventBus.onEvent(EventTypes.Dice.RollComplete, this.onDiceComplete, this);
    }

    /**
     * 解绑UI事件
     */
    protected unbindEvents(): void {
        // 解绑按钮事件
        if (this.pauseButton) {
            this.pauseButton.setClickCallback(null as any);
        }
        if (this.settingsButton) {
            this.settingsButton.setClickCallback(null as any);
        }
        if (this.bagButton) {
            this.bagButton.setClickCallback(null as any);
        }
        if (this.diceButton) {
            this.diceButton.setClickCallback(null as any);
        }

        // 解绑数据监听
        Blackboard.instance.unwatchTarget(this);
        EventBus.offTarget(this);
    }

    /**
     * 暂停按钮点击
     */
    private onPauseClick(): void {
        EventBus.emitEvent(EventTypes.UI.ShowPauseMenu);
        EventBus.emitEvent(EventTypes.Game.GamePause);
    }

    /**
     * 设置按钮点击
     */
    private onSettingsClick(): void {
        EventBus.emitEvent(EventTypes.UI.ShowSettings, { source: "game_hud" });
    }

    /**
     * 背包按钮点击
     */
    private onBagClick(): void {
        EventBus.emitEvent(EventTypes.UI.OpenBag, { source: "game_hud" });
    }

    /**
     * 投掷按钮点击
     */
    private onDiceClick(): void {
        if (this.diceButton?.interactable) {
            EventBus.emitEvent(EventTypes.UI.ShowDice);
            EventBus.emitEvent(EventTypes.Dice.StartRoll);
        }
    }

    /**
     * 玩家金钱变化
     */
    private onPlayerMoneyChange(money: number): void {
        if (this.playerMoneyLabel) {
            this.playerMoneyLabel.string = this._formatMoney(money);
        }
        
        // 播放金钱变化动画
        this._playMoneyChangeAnimation(money);
    }

    /**
     * 玩家等级变化
     */
    private onPlayerLevelChange(level: number): void {
        if (this.playerLevelLabel) {
            this.playerLevelLabel.string = `Lv.${level}`;
        }
    }

    /**
     * 玩家血量变化
     */
    private onPlayerHpChange(hp: number): void {
        if (this.playerHpBar) {
            const maxHp = Blackboard.instance.get<number>("playerMaxHp", 100);
            this.playerHpBar.progress = hp / maxHp;
        }
    }

    /**
     * 玩家经验变化
     */
    private onPlayerExpChange(exp: number): void {
        if (this.playerExpBar) {
            const maxExp = Blackboard.instance.get<number>("playerMaxExp", 1000);
            this.playerExpBar.progress = exp / maxExp;
        }
    }

    /**
     * 回合变化
     */
    private onRoundChange(round: number): void {
        if (this.roundLabel) {
            this.roundLabel.string = `回合: ${round}`;
        }
    }

    /**
     * 玩家回合变化
     */
    private onTurnChange(turn: string): void {
        if (this.turnLabel) {
            this.turnLabel.string = `当前: ${turn}`;
        }
    }

    /**
     * 游戏时间变化
     */
    private onGameTimeChange(time: number): void {
        if (this.timeLabel) {
            this.timeLabel.string = this._formatTime(time);
        }
    }

    /**
     * 游戏暂停事件
     */
    private onGamePause(): void {
        if (this.pauseButton) {
            this.pauseButton.text = "继续";
        }
        this._stopTimer();
    }

    /**
     * 游戏恢复事件
     */
    private onGameResume(): void {
        if (this.pauseButton) {
            this.pauseButton.text = "暂停";
        }
        this._startTimer();
    }

    /**
     * 回合开始事件
     */
    private onTurnStart(data: any): void {
        if (this.diceButton) {
            this.diceButton.interactable = true;
            this.diceButton.text = "投掷";
        }
    }

    /**
     * 回合结束事件
     */
    private onTurnEnd(data: any): void {
        if (this.diceButton) {
            this.diceButton.interactable = false;
            this.diceButton.text = "等待";
        }
    }

    /**
     * 骰子开始投掷
     */
    private onDiceStart(): void {
        if (this.diceButton) {
            this.diceButton.showLoading("投掷中...");
        }
    }

    /**
     * 骰子投掷完成
     */
    private onDiceComplete(data: any): void {
        if (this.diceButton) {
            this.diceButton.hideLoading("投掷");
            this.diceButton.interactable = false;
        }
    }

    /**
     * 更新玩家显示
     */
    private _updatePlayerDisplay(): void {
        const playerName = Blackboard.instance.get<string>("playerName", "玩家");
        const playerMoney = Blackboard.instance.get<number>("playerMoney", 0);
        const playerLevel = Blackboard.instance.get<number>("playerLevel", 1);

        if (this.playerNameLabel) {
            this.playerNameLabel.string = playerName;
        }

        if (this.playerMoneyLabel) {
            this.playerMoneyLabel.string = this._formatMoney(playerMoney);
        }

        if (this.playerLevelLabel) {
            this.playerLevelLabel.string = `Lv.${playerLevel}`;
        }

        // 更新进度条
        this.onPlayerHpChange(Blackboard.instance.get<number>("playerHp", 100));
        this.onPlayerExpChange(Blackboard.instance.get<number>("playerExp", 0));
    }

    /**
     * 更新游戏状态显示
     */
    private _updateGameStatusDisplay(): void {
        const currentRound = Blackboard.instance.get<number>("currentRound", 1);
        const currentTurn = Blackboard.instance.get<string>("currentTurn", "你");

        this.onRoundChange(currentRound);
        this.onTurnChange(currentTurn);
    }

    /**
     * 格式化金钱显示
     */
    private _formatMoney(money: number): string {
        if (money >= 1000000) {
            return `${(money / 1000000).toFixed(1)}M`;
        } else if (money >= 1000) {
            return `${(money / 1000).toFixed(1)}K`;
        }
        return money.toString();
    }

    /**
     * 格式化时间显示
     */
    private _formatTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }

    /**
     * 播放金钱变化动画
     */
    private _playMoneyChangeAnimation(newMoney: number): void {
        // 可以在这里添加金钱变化的视觉效果
        // 比如数字滚动、颜色变化等
        console.log(`[GameHUD] Money changed to: ${newMoney}`);
    }

    /**
     * 开始计时器
     */
    private _startTimer(): void {
        if (this._timerInterval) {
            this._stopTimer();
        }

        this._timerInterval = window.setInterval(() => {
            const currentTime = Blackboard.instance.get<number>("gameTime", 0);
            Blackboard.instance.set("gameTime", currentTime + 1);
        }, 1000);
    }

    /**
     * 停止计时器
     */
    private _stopTimer(): void {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
    }

    /**
     * 显示前回调
     */
    protected onBeforeShow(data: any): void {
        this._updatePlayerDisplay();
        this._updateGameStatusDisplay();
        this._startTimer();
    }

    /**
     * 隐藏后回调
     */
    protected onAfterHide(): void {
        this._stopTimer();
    }

    /**
     * 组件销毁时调用
     */
    protected onDestroy(): void {
        super.onDestroy();
        this._stopTimer();
    }
}