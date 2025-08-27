/**
 * Web3 Tycoon游戏美术资源配置文件
 * 定义了所有需要AI生成的美术资源类型和描述
 */

// 资源类别定义
const CATEGORIES = {
    tiles: '地图瓦片和建筑',
    ui: '用户界面元素', 
    icons: '图标和小型UI元素',
    cards: '卡片和特效',
    characters: '角色和棋子'
};

// 地图瓦片和建筑资源
const TILES_CONFIG = [
    // 特殊地块
    { name: '起点地块', description: '吉卜力风格起点格子，温暖的绿色草地，木制GO标牌，小花朵装饰，柔和光照' },
    { name: '监狱地块', description: '吉卜力风格监狱，石制城堡风格，藤蔓覆盖的围墙，童话般的塔楼，温馨而不阴森' },
    { name: '免费停车', description: '吉卜力风格停车场，乡村小径风格，木制停车标志，周围有小草和野花' },
    { name: '去监狱', description: '吉卜力风格路标，手绘木牌指向监狱，森林小径风格，温暖色调' },
    
    // 功能地块
    { name: '机会地块', description: '机会格子，金色问号，发光效果，神秘感，幸运色彩' },
    { name: '命运地块', description: '命运格子，银色感叹号，星星装饰，魔法光环' },
    { name: '所得税', description: '所得税格子，红色税务图标，计算器symbol，严肃配色' },
    { name: '奢侈税', description: '奢侈税格子，紫色钻石图标，豪华装饰，高端质感' },
    
    // 交通设施
    { name: '火车站1', description: '火车站地块，蒸汽火车，月台设施，复古设计，等距建筑' },
    { name: '火车站2', description: '现代火车站，高铁列车，玻璃站房，科技感设计' },
    { name: '火车站3', description: '地铁站入口，地下标志，城市风格，现代简约' },
    { name: '火车站4', description: '高架轻轨站，未来设计，悬浮轨道，科幻色彩' },
    
    // 公用事业
    { name: '电力公司', description: '电力公司建筑，电塔图标，闪电标志，黄色配色，工业风格' },
    { name: '自来水厂', description: '自来水厂，水滴图标，蓝色主调，管道元素，清洁感' },
    
    // 房产等级 - 红色地产群  
    { name: '红色地产房屋L1', description: '吉卜力风格红色小屋，木质童话屋，红色尖顶，烟囱冒烟，温馨可爱' },
    { name: '红色地产房屋L2', description: '吉卜力风格红砖小楼，欧式乡村风格，红色瓦片屋顶，窗台花箱' },
    { name: '红色地产别墅L3', description: '吉卜力风格红色庄园，英式田园别墅，玫瑰花园，石径小路' },
    { name: '红色地产酒店L4', description: '吉卜力风格红色城堡酒店，童话城堡设计，塔楼和旗帜，梦幻浪漫' },
    { name: '红色地产摩天楼L5', description: '吉卜力风格红色天空之城，悬浮岛屿建筑，云朵环绕，魔法色彩' },
    
    // 蓝色地产群  
    { name: '蓝色地产房屋L1', description: '蓝色地产小屋，海洋风格，蓝色调，清新设计，等级1' },
    { name: '蓝色地产房屋L2', description: '蓝色地产联排别墅，地中海风格，蓝白配色，等级2' },
    { name: '蓝色地产豪宅L3', description: '蓝色地产豪宅，泳池配套，奢华设计，等级3' },
    { name: '蓝色地产度假村L4', description: '蓝色地产度假酒店，海滨风情，棕榈树装饰，等级4' },
    { name: '蓝色地产海景大厦L5', description: '蓝色地产海景摩天楼，波浪造型，海洋主题，等级5' },
    
    // 绿色地产群
    { name: '绿色地产房屋L1', description: '绿色地产生态小屋，环保材料，植物覆盖，等级1' },
    { name: '绿色地产房屋L2', description: '绿色地产花园洋房，绿色屋顶，太阳能板，等级2' },
    { name: '绿色地产庄园L3', description: '绿色地产生态庄园，大片绿地，可持续设计，等级3' },
    { name: '绿色地产环保酒店L4', description: '绿色地产环保度假酒店，垂直花园，生态建筑，等级4' },
    { name: '绿色地产生态塔L5', description: '绿色地产生态摩天塔，螺旋绿化，未来环保，等级5' },
    
    // 黄色地产群
    { name: '黄色地产房屋L1', description: '黄色地产温馨小屋，暖色调，家庭友好，等级1' },
    { name: '黄色地产房屋L2', description: '黄色地产公寓楼，现代设计，金黄外墙，等级2' },
    { name: '黄色地产商务楼L3', description: '黄色地产商务中心，专业外观，金属质感，等级3' },
    { name: '黄色地产五星酒店L4', description: '黄色地产豪华酒店，金碧辉煌，奢华装饰，等级4' },
    { name: '黄色地产金融大厦L5', description: '黄色地产金融摩天楼，黄金配色，权威象征，等级5' }
];

// 用户界面元素
const UI_CONFIG = [
    // 主界面背景
    { name: '主菜单背景', description: 'Web3 Tycoon主菜单背景，科技城市天际线，紫色渐变天空，区块链元素' },
    { name: '游戏界面背景', description: '游戏中界面背景，棋盘桌面质感，木纹纹理，温馨照明效果' },
    { name: '设置界面背景', description: '设置菜单背景，深色科技风格，几何图案，现代简约' },
    
    // 面板和框架
    { name: '信息面板框架', description: '游戏信息面板，半透明背景，圆角边框，现代UI设计' },
    { name: '属性卡片框架', description: '房产属性卡片背景，立体边框，渐变效果，专业外观' },
    { name: '交易对话框', description: '交易确认对话框，重要提示样式，安全配色，清晰布局' },
    { name: '玩家状态面板', description: '玩家信息显示面板，头像框架，资产显示，个性化设计' },
    { name: '排行榜背景', description: '游戏排行榜背景，竞技色彩，奖杯装饰，胜利氛围' },
    
    // 按钮设计
    { name: '主要操作按钮', description: '主要功能按钮，紫色渐变，发光效果，现代扁平' },
    { name: '次要操作按钮', description: '次要功能按钮，灰色调，简洁设计，功能明确' },
    { name: '危险操作按钮', description: '危险操作按钮，红色警告色，谨慎设计，安全提示' },
    { name: '成功确认按钮', description: '成功确认按钮，绿色积极色，完成感，正面反馈' },
    
    // 进度和状态
    { name: '加载进度条', description: '游戏加载进度条，渐变填充，动态效果，现代设计' },
    { name: '玩家血条UI', description: '玩家生命值显示条，红色到绿色渐变，清晰可读' },
    { name: '经验值进度条', description: '经验值进度条，蓝色发光，升级提示，成长感' },
    { name: '倒计时器界面', description: '游戏倒计时器，数字显示，紧迫感设计，时间提醒' }
];

// 图标和小型UI元素
const ICONS_CONFIG = [
    // 货币和资源
    { name: '金币图标', description: '游戏金币图标，立体金属质感，发光效果，财富象征' },
    { name: '钻石图标', description: 'premium钻石图标，多面切割，彩虹反光，稀有感' },
    { name: '代币图标', description: 'Web3代币图标，区块链风格，加密货币，科技感' },
    { name: 'NFT徽章图标', description: 'NFT收藏品徽章，独特标识，数字资产，认证感' },
    
    // 游戏功能
    { name: '骰子图标', description: '游戏骰子图标，六面骰子，动态感，游戏核心元素' },
    { name: '卡牌图标', description: '游戏卡牌图标，扑克牌样式，策略元素，精美设计' },
    { name: '技能书图标', description: '技能学习图标，魔法书样式，知识象征，成长元素' },
    { name: '成就奖杯图标', description: '成就奖杯图标，金色质感，胜利象征，荣誉感' },
    
    // 系统功能  
    { name: '设置齿轮图标', description: '设置功能图标，机械齿轮，精密设计，功能性强' },
    { name: '帮助问号图标', description: '帮助信息图标，友好问号，辅助功能，易于理解' },
    { name: '音效开关图标', description: '音效控制图标，扬声器样式，音量可视化，直观操作' },
    { name: '全屏切换图标', description: '全屏模式图标，屏幕扩展，视觉清晰，功能明确' },
    
    // 社交功能
    { name: '好友列表图标', description: '好友系统图标，人物剪影，社交网络，友好互动' },
    { name: '聊天消息图标', description: '聊天功能图标，对话气泡，沟通工具，实时交流' },
    { name: '排行榜图标', description: '排行榜功能图标，排名列表，竞争元素，激励设计' },
    { name: '分享链接图标', description: '分享功能图标，连接符号，传播工具，社交扩散' },
    
    // 状态指示
    { name: '在线状态图标', description: '在线状态指示器，绿色圆点，连接稳定，状态清晰' },
    { name: '离线状态图标', description: '离线状态指示器，灰色圆点，断开提示，状态明确' },
    { name: '加载旋转图标', description: '加载状态图标，旋转动画，等待提示，处理中状态' },
    { name: '警告提示图标', description: '警告信息图标，注意符号，重要提示，安全提醒' }
];

// 卡片和特效
const CARDS_CONFIG = [
    // 技能卡片
    { name: '攻击技能卡', description: '攻击系技能卡片，红色火焰边框，战斗图案，力量象征' },
    { name: '防御技能卡', description: '防御系技能卡片，蓝色盾牌边框，保护图案，安全象征' },
    { name: '辅助技能卡', description: '辅助系技能卡片，绿色治疗边框，支持图案，恢复象征' },
    { name: '特殊技能卡', description: '特殊系技能卡片，紫色魔法边框，神秘图案，稀有象征' },
    
    // 道具卡片
    { name: '消耗道具卡', description: '消耗型道具卡片，黄色边框，使用提示，一次性道具' },
    { name: '永久道具卡', description: '永久型道具卡片，金色边框，持续效果，珍贵道具' },
    { name: '装备道具卡', description: '装备类道具卡片，银色边框，装备图案，强化道具' },
    { name: '收藏道具卡', description: '收藏品道具卡片，彩虹边框，收集要素，稀有收藏' },
    
    // 事件卡片
    { name: '机会事件卡', description: '机会事件卡片背景，金色幸运设计，正面事件，好运象征' },
    { name: '命运事件卡', description: '命运事件卡片背景，银色神秘设计，随机事件，未知感' },
    { name: '危机事件卡', description: '危机事件卡片背景，红色警告设计，负面事件，挑战感' },
    { name: '奖励事件卡', description: '奖励事件卡片背景，绿色庆祝设计，奖励获得，成功感' },
    
    // 特效纹理
    { name: '升级光效纹理', description: '升级特效纹理，金色光芒四射，成长庆祝，进步象征' },
    { name: '购买成功特效', description: '购买成功特效纹理，绿色确认光效，交易完成，满足感' },
    { name: '技能释放特效', description: '技能释放特效纹理，多彩魔法光环，能力展示，华丽效果' },
    { name: '金币收集特效', description: '金币收集特效纹理，黄色闪闪发光，财富积累，收获感' }
];

// 角色和棋子
const CHARACTERS_CONFIG = [
    // 玩家棋子设计
    { name: '经典绅士棋子', description: 'Q版绅士角色棋子，经典大富翁风格，礼帽西装，优雅气质' },
    { name: '现代商务棋子', description: 'Q版商务人士棋子，现代职业装，自信表情，成功人士' },
    { name: '科技极客棋子', description: 'Q版程序员棋子，休闲装扮，眼镜配饰，科技达人' },
    { name: '时尚达人棋子', description: 'Q版时尚角色棋子，潮流服装，个性造型，时尚前沿' },
    { name: '运动健将棋子', description: 'Q版运动员棋子，运动装备，健康活力，积极向上' },
    { name: '艺术家棋子', description: 'Q版艺术家棋子，文艺气质，创意装扮，灵感无限' },
    { name: '探险家棋子', description: 'Q版探险家棋子，户外装备，勇敢精神，冒险家' },
    { name: '学者教授棋子', description: 'Q版学者棋子，学术气质，书卷气息，智慧象征' },
    
    // NPC角色设计
    { name: '银行经理NPC', description: 'Q版银行经理角色，专业形象，金融专家，可信赖感' },
    { name: '拍卖师NPC', description: 'Q版拍卖师角色，主持人气质，拍卖槌道具，专业拍卖' },
    { name: '律师顾问NPC', description: 'Q版律师角色，法律专业，严谨形象，法律咨询' },
    { name: '建筑师NPC', description: 'Q版建筑师角色，设计师气质，创造力强，建筑专家' }
];

// 导出配置
const ASSET_CONFIGS = {
    tiles: TILES_CONFIG,
    ui: UI_CONFIG, 
    icons: ICONS_CONFIG,
    cards: CARDS_CONFIG,
    characters: CHARACTERS_CONFIG
};

module.exports = {
    ASSET_CONFIGS,
    CATEGORIES,
    
    // 便捷访问单个配置
    TILES_CONFIG,
    UI_CONFIG,
    ICONS_CONFIG,
    CARDS_CONFIG,
    CHARACTERS_CONFIG
};