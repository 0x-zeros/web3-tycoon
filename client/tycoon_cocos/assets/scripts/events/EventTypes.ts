import { Collider, Node, PhysicsRayResult} from "cc";

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
        /** 显示地图选择界面 */
        ShowMapSelect: "ui_show_map_select",
        /** UI管理器状态变化 */
        ManagerStateChange: "ui_manager_state_change",
        /** 按钮点击 */
        ButtonClick: "ui_button_click",
        /** 面板关闭 */
        PanelClose: "ui_panel_close",
        /** 地图元素选中 */
        MapElementSelected: "ui_map_element_selected",
        /** 切换地图元素UI显示 */
        ToggleMapElement: "ui_toggle_map_element",
        /** 屏幕尺寸变化 */
        ScreenSizeChanged: "ui_screen_size_changed"
    },

    /** 地图相关事件 */
    Map: {
        /** 所有地块被清除 */
        AllBlocksCleared: "map_all_blocks_cleared",
        /** 地块放置 */
        BlockPlaced: "map_block_placed",
        /** 地块移除 */
        BlockRemoved: "map_block_removed",
        /** 地图编辑模式切换 */
        EditModeToggled: "map_edit_mode_toggled",
        /** 编辑器模式变化 */
        EditModeChanged: "map_edit_mode_changed",
        /** NPC生成 */
        NpcSpawned: "map_npc_spawned"
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
        /** 游戏结束（新名称） */
        GameEnded: "game_ended",
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
        TurnEnd: "game_turn_end",
        /** 轮次结束 */
        RoundEnded: "game_round_ended",
        /** 显示游戏详情 */
        ShowGameDetail: "game_show_game_detail",

        // GameSession 相关事件
        /** GameSession 加载完成 */
        SessionLoaded: "game_session_loaded",
        /** GameSession 重置 */
        SessionReset: "game_session_reset",
        /** GameSession 销毁 */
        SessionDestroyed: "game_session_destroyed",
        /** 游戏状态变化 */
        StatusChanged: "game_status_changed",
        /** 待决策状态 */
        DecisionPending: "game_decision_pending",
        /** 决策已清除 */
        DecisionCleared: "game_decision_cleared",
        /** NPC 生成 */
        NPCSpawned: "game_npc_spawned",
        /** NPC 移除 */
        NPCRemoved: "game_npc_removed",

        // 地图相关事件
        /** 地图被选择 */
        MapSelected: "game_map_selected",
        /** 地图加载完成 */
        MapLoaded: "game_map_loaded",
        /** 地图卸载 */
        MapUnloaded: "game_map_unloaded",
        /** 地图加载失败 */
        MapLoadFailed: "game_map_load_failed",
        /** 地图配置更新 */
        MapConfigUpdated: "game_map_config_updated",
        /** 请求切换地图 */
        RequestMapChange: "game_request_map_change",
        /** 地面点击 */
        GroundClicked: "game_ground_clicked",

        // RollAndStepAction 播放控制事件
        /** 动作播放开始 */
        ActionPlaybackStart: "game_action_playback_start",
        /** 动作播放暂停 */
        ActionPlaybackPaused: "game_action_playback_paused",
        /** 动作播放恢复 */
        ActionPlaybackResumed: "game_action_playback_resumed",
        /** 动作播放停止 */
        ActionPlaybackStopped: "game_action_playback_stopped",
        /** 动作播放完成 */
        ActionPlaybackComplete: "game_action_playback_complete",
        /** 动作播放错误 */
        ActionPlaybackError: "game_action_playback_error",
        /** 步骤开始 */
        ActionStepStart: "game_action_step_start",
        /** 步骤完成 */
        ActionStepComplete: "game_action_step_complete",

        // 游戏动作效果事件
        /** 卡牌获得 */
        CardDrawn: "game_card_drawn",
        /** NPC 交互 */
        NPCInteraction: "game_npc_interaction",
        /** 地块停留效果 */
        TileStopEffect: "game_tile_stop_effect",

        // 回合状态变化事件
        /** 轮次变化 */
        RoundChanged: "game_round_changed",
        /** 回合变化（玩家切换） */
        TurnChanged: "game_turn_changed"
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
        LevelUp: "player_level_up",
        /** 掷骰子 */
        DiceRolled: "player_dice_rolled",
        /** 玩家移动 */
        Moved: "player_moved"
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

    /** 角色相关事件 */
    Role: {
        /** 角色生成 */
        Spawned: "role_spawned",
        /** 角色创建 */
        Created: "role_created",
        /** 角色销毁 */
        Destroyed: "role_destroyed",
        /** 属性变化 */
        AttributeChange: "role_attribute_change",
        /** 状态变化 */
        StateChange: "role_state_change",
        /** 位置变化 */
        PositionChange: "role_position_change",
        /** Actor绑定 */
        ActorBind: "role_actor_bind",
        /** Actor解绑 */
        ActorUnbind: "role_actor_unbind",
        /** 角色初始化 */
        Initialized: "role_initialized",
        /** 角色重置 */
        Reset: "role_reset"
    },

    /** 技能相关事件 */
    Skill: {
        /** 技能使用 */
        Used: "skill_used",
        /** 冷却开始 */
        CooldownStart: "skill_cooldown_start",
        /** 冷却结束 */
        CooldownEnd: "skill_cooldown_end",
        /** 效果生效 */
        EffectApplied: "skill_effect_applied",
        /** 技能升级 */
        LevelUp: "skill_level_up",
        /** 技能学习 */
        Learned: "skill_learned",
        /** 技能失败 */
        Failed: "skill_failed",
        /** 技能中断 */
        Interrupted: "skill_interrupted"
    },

    /** NPC相关事件 */
    NPC: {
        /** NPC生成 */
        Spawned: "npc_spawned",
        /** NPC触发 */
        Triggered: "npc_triggered",
        /** 效果生效 */
        EffectApplied: "npc_effect_applied",
        /** NPC过期 */
        Expired: "npc_expired",
        /** NPC移除 */
        Removed: "npc_removed",
        /** NPC状态变化 */
        StateChange: "npc_state_change",
        /** NPC交互 */
        Interact: "npc_interact"
    },

    /** 骰子相关事件 */
    Dice: {
        /** 开始投掷 */
        StartRoll: "dice_start_roll",
        /** 投掷结果 */
        RollResult: "dice_roll_result",
        /** 投掷完成 */
        RollComplete: "dice_roll_complete",
        /** 设置启用/禁用状态 */
        SetEnabled: "dice_set_enabled"
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
        LanguageChange: "system_language_change",
        /** 相机模式变化 */
        CameraModeChanged: "system_camera_mode_changed"
    },

    /** Sui 链上事件 */
    SuiChain: {
        // 游戏核心事件
        /** 游戏创建 */
        GameCreated: "sui_chain_game_created",
        /** 游戏开始 */
        GameStarted: "sui_chain_game_started",
        /** 游戏结束 */
        GameEnded: "sui_chain_game_ended",

        // 玩家动作事件
        /** 玩家加入 */
        PlayerJoined: "sui_chain_player_joined",
        /** 骰子投掷 */
        DiceRolled: "sui_chain_dice_rolled",
        /** 玩家移动 */
        PlayerMoved: "sui_chain_player_moved",
        /** 玩家破产 */
        PlayerBankrupt: "sui_chain_player_bankrupt",

        // 地产交易事件
        /** 地产购买 */
        PropertyPurchased: "sui_chain_property_purchased",
        /** 地产升级 */
        PropertyUpgraded: "sui_chain_property_upgraded",
        /** 地产抵押 */
        PropertyMortgaged: "sui_chain_property_mortgaged",
        /** 地产赎回 */
        PropertyRedeemed: "sui_chain_property_redeemed",
        /** 支付租金 */
        RentPaid: "sui_chain_rent_paid",

        // 卡片事件
        /** 抽取机会卡 */
        ChanceCardDrawn: "sui_chain_chance_card_drawn",
        /** 卡片效果应用 */
        CardEffectApplied: "sui_chain_card_effect_applied",

        // 金钱交易事件
        /** 金钱转账 */
        MoneyTransfer: "sui_chain_money_transfer",
        /** 支付税金 */
        TaxPaid: "sui_chain_tax_paid",
        /** 收取薪水 */
        SalaryCollected: "sui_chain_salary_collected",

        // DeFi 相关事件
        /** 地产质押 */
        PropertyStaked: "sui_chain_property_staked",
        /** 领取质押奖励 */
        StakingRewardClaimed: "sui_chain_staking_reward_claimed",
        /** 贷款 */
        LoanTaken: "sui_chain_loan_taken",
        /** 还款 */
        LoanRepaid: "sui_chain_loan_repaid",

        // NFT 相关事件
        /** 地产NFT铸造 */
        PropertyNFTMinted: "sui_chain_property_nft_minted",
        /** 地产NFT转移 */
        PropertyNFTTransferred: "sui_chain_property_nft_transferred",

        // 特殊位置事件
        /** 进入监狱 */
        JailEntered: "sui_chain_jail_entered",
        /** 离开监狱 */
        JailExited: "sui_chain_jail_exited",
        /** 免费停车场收集 */
        FreeParkingCollected: "sui_chain_free_parking_collected",

        // 索引器系统事件
        /** 事件已索引 */
        EventIndexed: "sui_chain_event_indexed",
        /** 索引器错误 */
        IndexerError: "sui_chain_indexer_error",
        /** 索引器启动 */
        IndexerStarted: "sui_chain_indexer_started",
        /** 索引器停止 */
        IndexerStopped: "sui_chain_indexer_stopped"
    },

    /** Sui 客户端事件（数据同步、缓存更新） */
    Sui: {
        /** 数据预加载完成 */
        DataPreloaded: "sui_data_preloaded",
        /** 游戏列表更新 */
        GamesListUpdated: "sui_games_list_updated",
        /** 地图模板列表更新 */
        MapTemplatesUpdated: "sui_map_templates_updated",
        /** 新游戏创建（客户端通知） */
        NewGameCreated: "sui_new_game_created"
    },

    /** Move 链上事件（由 EventIndexer 转发） */
    Move: {
        /** 游戏创建事件 */
        GameCreated: "move_game_created",
        /** 玩家加入事件 */
        PlayerJoined: "move_player_joined",
        /** 游戏开始事件 */
        GameStarted: "move_game_started",
        /** 游戏结束事件 */
        GameEnded: "move_game_ended",
        /** 地图模板发布事件 */
        MapTemplatePublished: "move_map_template_published"
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
    /** 命中的节点 */
    node?: Node;
    /** 命中的碰撞器 */
    collider?: Collider;
    /** 射线检测结果 */
    rayResult?: PhysicsRayResult;
    /** 事件时间戳 */
    timestamp: number;
}