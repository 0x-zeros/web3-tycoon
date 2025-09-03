/**
 * 游戏事件类型定义
 * 统一管理所有游戏事件，便于维护和避免事件名冲突
 */
export const EventTypes = {
    /** UI相关事件 */
    UI: {
        /** 开始游戏 */
        StartGame: "ui_start_game",
        /** 打开背包 */
        OpenBag: "ui_open_bag", 
        /** 显示玩家信息 */
        ShowPlayerInfo: "ui_show_player_info",
        /** 显示地产卡片 */
        ShowPropertyCard: "ui_show_property_card",
        /** 显示骰子界面 */
        ShowDice: "ui_show_dice",
        /** 隐藏骰子界面 */
        HideDice: "ui_hide_dice",
        /** 显示主菜单 */
        ShowMainMenu: "ui_show_main_menu",
        /** 显示设置界面 */
        ShowSettings: "ui_show_settings",
        /** 显示暂停菜单 */
        ShowPauseMenu: "ui_show_pause_menu",
        /** UI管理器状态变化 */
        ManagerStateChange: "ui_manager_state_change",
        /** 按钮点击 */
        ButtonClick: "ui_button_click",
        /** 面板关闭 */
        PanelClose: "ui_panel_close"
    },

    /** 游戏逻辑事件 */
    Game: {
        /** 玩家死亡 */
        PlayerDead: "game_player_dead",
        /** 敌人被击杀 */
        EnemyKilled: "game_enemy_killed",
        /** 游戏开始 */
        GameStart: "game_start",
        /** 游戏结束 */
        GameEnd: "game_end",
        /** 游戏暂停 */
        GamePause: "game_pause",
        /** 游戏恢复 */
        GameResume: "game_resume",
        /** 关卡完成 */
        LevelComplete: "game_level_complete",
        /** 分数变化 */
        ScoreChange: "game_score_change",
        /** 玩家移动 */
        PlayerMove: "game_player_move",
        /** 回合开始 */
        TurnStart: "game_turn_start",
        /** 回合结束 */
        TurnEnd: "game_turn_end"
    },

    /** 地产相关事件 */
    Property: {
        /** 地产购买 */
        Purchase: "property_purchase",
        /** 地产出售 */
        Sell: "property_sell", 
        /** 地产升级 */
        Upgrade: "property_upgrade",
        /** 收租 */
        CollectRent: "property_collect_rent",
        /** 地产信息更新 */
        InfoUpdate: "property_info_update"
    },

    /** 玩家相关事件 */
    Player: {
        /** 金钱变化 */
        MoneyChange: "player_money_change",
        /** 位置变化 */
        PositionChange: "player_position_change",
        /** 状态变化 */
        StatusChange: "player_status_change",
        /** 获得道具 */
        GetItem: "player_get_item",
        /** 使用道具 */
        UseItem: "player_use_item",
        /** 等级提升 */
        LevelUp: "player_level_up"
    },

    /** 卡片相关事件 */
    Card: {
        /** 抽取卡片 */
        DrawCard: "card_draw",
        /** 使用卡片 */
        UseCard: "card_use",
        /** 卡片效果生效 */
        CardEffect: "card_effect",
        /** 获得新卡片 */
        GetNewCard: "card_get_new"
    },

    /** 骰子相关事件 */
    Dice: {
        /** 开始投掷 */
        StartRoll: "dice_start_roll",
        /** 投掷结果 */
        RollResult: "dice_roll_result",
        /** 投掷完成 */
        RollComplete: "dice_roll_complete"
    },

    /** 音效相关事件 */
    Audio: {
        /** 播放音效 */
        PlaySFX: "audio_play_sfx",
        /** 播放背景音乐 */
        PlayBGM: "audio_play_bgm",
        /** 停止音效 */
        StopSFX: "audio_stop_sfx",
        /** 停止背景音乐 */
        StopBGM: "audio_stop_bgm",
        /** 音量变化 */
        VolumeChange: "audio_volume_change"
    },

    /** 网络相关事件 */
    Network: {
        /** 连接成功 */
        Connected: "network_connected",
        /** 连接断开 */
        Disconnected: "network_disconnected", 
        /** 连接错误 */
        ConnectionError: "network_connection_error",
        /** 接收到消息 */
        MessageReceived: "network_message_received",
        /** 发送消息 */
        MessageSent: "network_message_sent"
    },

    /** 区块链相关事件 */
    Blockchain: {
        /** 钱包连接 */
        WalletConnected: "blockchain_wallet_connected",
        /** 钱包断开 */
        WalletDisconnected: "blockchain_wallet_disconnected",
        /** 交易确认 */
        TransactionConfirmed: "blockchain_transaction_confirmed",
        /** 交易失败 */
        TransactionFailed: "blockchain_transaction_failed",
        /** 余额更新 */
        BalanceUpdate: "blockchain_balance_update",
        /** NFT获得 */
        NFTReceived: "blockchain_nft_received"
    },

    /** 系统相关事件 */
    System: {
        /** 应用进入后台 */
        AppBackground: "system_app_background",
        /** 应用进入前台 */
        AppForeground: "system_app_foreground",
        /** 内存警告 */
        MemoryWarning: "system_memory_warning",
        /** 设置变化 */
        SettingsChange: "system_settings_change",
        /** 语言变化 */
        LanguageChange: "system_language_change"
    },

    /** 3D输入事件 - 通过UI3DInteractionManager转发到3D系统 */
    Input3D: {
        /** 鼠标按下 */
        MouseDown: "input3d_mouse_down",
        /** 鼠标抬起 */
        MouseUp: "input3d_mouse_up", 
        /** 鼠标移动 */
        MouseMove: "input3d_mouse_move",
        /** 鼠标滚轮 */
        MouseWheel: "input3d_mouse_wheel",
        /** 触摸开始 */
        TouchStart: "input3d_touch_start",
        /** 触摸移动 */
        TouchMove: "input3d_touch_move",
        /** 触摸结束 */
        TouchEnd: "input3d_touch_end",
        /** 触摸取消 */
        TouchCancel: "input3d_touch_cancel",
        /** 射线检测命中 */
        RaycastHit: "input3d_raycast_hit",
        /** 射线检测未命中 */
        RaycastMiss: "input3d_raycast_miss"
    }
};

/**
 * 事件数据接口定义
 */
export interface EventData {
    /** 事件类型 */
    type: string;
    /** 事件数据 */
    data?: any;
    /** 事件时间戳 */
    timestamp?: number;
    /** 事件来源 */
    source?: string;
}

/**
 * 事件监听器接口
 */
export interface EventListener<T = any> {
    (data: T): void;
}

/**
 * 事件监听器配置
 */
export interface EventListenerConfig {
    /** 监听器函数 */
    listener: EventListener;
    /** 监听目标(用于自动解绑) */
    target?: any;
    /** 是否只监听一次 */
    once?: boolean;
    /** 监听器优先级(数字越大优先级越高) */
    priority?: number;
}

/**
 * 3D输入事件数据接口
 */
export interface Input3DEventData {
    /** 事件类型 */
    type: string;
    /** 屏幕坐标X */
    screenX: number;
    /** 屏幕坐标Y */
    screenY: number;
    /** UI坐标X（适配分辨率后） */
    uiX?: number;
    /** UI坐标Y（适配分辨率后） */
    uiY?: number;
    /** 鼠标按键（仅鼠标事件有效） */
    button?: number;
    /** 触摸ID（仅触摸事件有效） */
    touchId?: number;
    /** 滚轮增量（仅滚轮事件有效） */
    scrollDelta?: { x: number; y: number };
    /** 原始事件对象 */
    originalEvent?: any;
    /** 事件时间戳 */
    timestamp: number;
}

/**
 * 射线检测结果事件数据
 */
export interface RaycastEventData {
    /** 射线起点 */
    rayOrigin: { x: number; y: number; z: number };
    /** 射线方向 */
    rayDirection: { x: number; y: number; z: number };
    /** 射线距离 */
    rayDistance: number;
    /** 是否命中 */
    hit: boolean;
    /** 命中点（如果命中） */
    hitPoint?: { x: number; y: number; z: number };
    /** 命中的节点名称 */
    hitNodeName?: string;
    /** 事件时间戳 */
    timestamp: number;
}