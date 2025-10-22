/// DeFi奖励模块
///
/// 负责处理DeFi验证凭证（热土豆）并发放游戏奖励
///
/// 功能：
/// - 接收defi_verifier返回的热土豆凭证
/// - 验证并消费凭证
/// - 发放游戏奖励（cash + buff）
/// - Emit事件通知客户端
module tycoon::defi_rewards {
    use sui::event;
    use sui::object;
    use defi_verifier::defi_proof;
    use tycoon::game::{Self, Game};
    use tycoon::types;

    // ====== 事件定义 ======

    /// DeFi奖励激活事件
    ///
    /// 客户端监听此事件以更新UI
    public struct DefiRewardActivated has copy, drop {
        /// 游戏ID
        game_id: address,
        /// 玩家地址
        player: address,
        /// 玩家索引
        player_index: u8,
        /// 协议名称
        protocol: vector<u8>,  // b"Navi" 或 b"Scallop"
        /// 发放的cash（首次2000，重复0）
        cash_rewarded: u64,
        /// 收益倍数（150 = 1.5x）
        income_multiplier: u64,
        /// 是否已激活过
        already_activated: bool,
    }

    // ====== 错误码 ======

    /// 玩家不在游戏中
    const EPlayerNotInGame: u64 = 9002;

    // ====== 奖励常量 ======

    /// 首次激活发放的cash
    const REWARD_CASH: u64 = 2000;

    /// 收益倍数（150 = 1.5x）
    const INCOME_MULTIPLIER: u64 = 150;

    // ====== 公开接口 ======

    /// 激活Navi DeFi奖励
    ///
    /// 用户通过PTB先调用defi_verifier::verify_navi_with_proof获得NaviProof
    /// 然后在同一PTB中调用此函数消费热土豆
    ///
    /// 奖励内容：
    /// - 立即获得2000 cash
    /// - 获得永久1.5x收益加成buff（BUFF_NAVI_INCOME_BOOST）
    ///
    /// 防重复：
    /// - 如果玩家已有BUFF_NAVI_INCOME_BOOST，不重复发放cash和buff
    /// - 但仍然emit event（already_activated=true）
    ///
    /// # 参数
    /// - game: 游戏对象
    /// - navi_proof: Navi验证凭证（热土豆，来自defi_verifier）
    /// - ctx: 交易上下文
    ///
    /// 注意：由于热土豆参数，不能使用entry（PTB仍可调用）
    public fun activate_navi_reward(
        game: &mut Game,
        navi_proof: defi_proof::NaviProof,
        ctx: &TxContext
    ) {
        let user = ctx.sender();

        // 消费热土豆
        defi_proof::consume_navi_proof(navi_proof);

        // 查找player索引
        let player_index = game::find_player_index(game, user);
        assert!(player_index != 255, EPlayerNotInGame);

        // 应用奖励（返回是否首次激活）
        let newly_activated = game::apply_defi_reward(
            game,
            player_index,
            types::BUFF_NAVI_INCOME_BOOST(),
            ctx
        );

        // Emit事件（无论是否首次都emit）
        event::emit(DefiRewardActivated {
            game_id: object::uid_to_address(game::game_uid(game)),
            player: user,
            player_index,
            protocol: b"Navi",
            cash_rewarded: if (newly_activated) { REWARD_CASH } else { 0 },
            income_multiplier: INCOME_MULTIPLIER,
            already_activated: !newly_activated,
        });
    }

    /// 激活Scallop DeFi奖励
    ///
    /// 用户通过PTB先调用defi_verifier::verify_scallop_with_proof获得ScallopProof
    /// 然后在同一PTB中调用此函数消费热土豆
    ///
    /// 奖励内容同activate_navi_reward
    ///
    /// # 参数
    /// - game: 游戏对象
    /// - scallop_proof: Scallop验证凭证（热土豆）
    /// - ctx: 交易上下文
    ///
    /// 注意：由于热土豆参数，不能使用entry（PTB仍可调用）
    public fun activate_scallop_reward(
        game: &mut Game,
        scallop_proof: defi_proof::ScallopProof,
        ctx: &TxContext
    ) {
        let user = ctx.sender();

        // 消费热土豆
        defi_proof::consume_scallop_proof(scallop_proof);

        // 查找player
        let player_index = game::find_player_index(game, user);
        assert!(player_index != 255, EPlayerNotInGame);

        // 应用奖励
        let newly_activated = game::apply_defi_reward(
            game,
            player_index,
            types::BUFF_SCALLOP_INCOME_BOOST(),
            ctx
        );

        // Emit事件
        event::emit(DefiRewardActivated {
            game_id: object::uid_to_address(game::game_uid(game)),
            player: user,
            player_index,
            protocol: b"Scallop",
            cash_rewarded: if (newly_activated) { REWARD_CASH } else { 0 },
            income_multiplier: INCOME_MULTIPLIER,
            already_activated: !newly_activated,
        });
    }
}
