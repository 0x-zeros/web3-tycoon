#!/usr/bin/env node
/**
 * Web3 Tycoon AIGC美术资源批量生成工具
 * 使用DALL-E 3 API自动生成游戏所需的所有美术资源
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();

// 导入资源配置
const { ASSET_CONFIGS, CATEGORIES } = require('./assets_config.js');

class AIAssetGenerator {
    constructor(options = {}) {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        // 模型与生成参数（可通过CLI或ENV覆盖）- 先定义这些参数
        this.model = options.model || process.env.IMAGE_MODEL || 'dall-e-3';
        this.size = options.size || process.env.IMAGE_SIZE || '1024x1024';
        this.quality = options.quality || process.env.IMAGE_QUALITY || 'standard';
        this.responseFormat = options.responseFormat || process.env.IMAGE_RESPONSE_FORMAT || 'url';
        this.background = options.background || process.env.IMAGE_BACKGROUND; // e.g., 'transparent'
        this.style = options.style || process.env.IMAGE_STYLE; // e.g., 'vivid' | 'natural'
        
        // 然后定义依赖于 this.model 的路径
        this.baseOutputDir = './output';
        this.logDir = './logs';
        this.modelOutputDir = path.join(this.baseOutputDir, this.model);
        
        // 成本估算（可通过ENV或CLI覆盖），默认根据模型与质量给出估算值
        this.modelCosts = {
            'dall-e-3': { standard: 0.04, hd: 0.08 },
            // gpt-image-1 采用 low/medium/high 质量层级
            'gpt-image-1': { low: 0.01, medium: 0.02, high: 0.04 }
        };
        const envCost = process.env.IMAGE_COST_PER_IMAGE ? Number(process.env.IMAGE_COST_PER_IMAGE) : undefined;
        this.costPerImage = options.costPerImage !== undefined ? Number(options.costPerImage) : envCost;
        this.stats = {
            total: 0,
            success: 0,
            failed: 0,
            cost: 0
        };
        
        this.initDirectories();
    }

    /**
     * 初始化输出目录
     */
    initDirectories() {
        [this.baseOutputDir, this.logDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        // 为当前模型创建输出目录
        if (!fs.existsSync(this.modelOutputDir)) {
            fs.mkdirSync(this.modelOutputDir, { recursive: true });
        }
        // 为每个资源类别创建子目录（当前模型）
        Object.keys(CATEGORIES).forEach(category => {
            const categoryDir = path.join(this.modelOutputDir, category);
            if (!fs.existsSync(categoryDir)) {
                fs.mkdirSync(categoryDir, { recursive: true });
            }
        });
    }

    /**
     * 生成单个资源
     */
    async generateSingleAsset(description, category, filename, retryCount = 0, overrides = {}) {
        const maxRetries = 3;
        
        try {
            console.log(`🎨 生成中: ${description}`);
            
            // 构建完整的prompt
            const fullPrompt = this.buildPrompt(description, category);
            
            // gpt-image-1 使用 quality: 'low' | 'medium' | 'high'；兼容老参数 hd/standard
            const useModel = overrides.model || this.model;
            const useSize = overrides.size || this.size;
            const useQuality = overrides.quality || this.quality;
            const useResponseFormat = overrides.responseFormat || this.responseFormat;
            const useBackground = overrides.background || this.background;
            const useStyle = overrides.style || this.style;

            let apiQuality = useQuality;
            if (useModel === 'gpt-image-1') {
                const mapOldToNew = { hd: 'high', standard: 'medium' };
                apiQuality = mapOldToNew[apiQuality] || apiQuality; // 默认为传入值
                if (!['low', 'medium', 'high'].includes(apiQuality)) {
                    apiQuality = 'medium';
                }
            }

            const requestBody = {
                model: useModel,
                prompt: fullPrompt,
                size: useSize,
                quality: apiQuality,
                n: 1,
                response_format: useResponseFormat
            };
            if (useBackground) {
                requestBody.background = useBackground; // 'transparent' to remove bg (png)
            }
            if (useStyle) {
                requestBody.style = useStyle; // 'vivid' | 'natural'
            }

            const response = await this.openai.images.generate(requestBody);

            const imageData = response.data[0];
            const imageUrl = imageData.url;
            const filepath = path.join(this.modelOutputDir, category, filename);
            
            if (imageUrl) {
                await this.downloadImage(imageUrl, filepath);
            } else if (imageData.b64_json) {
                await this.writeBase64Image(imageData.b64_json, filepath);
            } else {
                throw new Error('No image data returned');
            }
            
            this.stats.success++;
            // 根据模型和质量计算成本（估算），可被覆盖
            let cost;
            if (this.costPerImage !== undefined && !Number.isNaN(this.costPerImage)) {
                cost = this.costPerImage;
            } else {
                const modelCostTable = this.modelCosts[useModel] || this.modelCosts['dall-e-3'];
                let costKey = 'standard';
                if (useModel === 'dall-e-3') {
                    costKey = (useQuality === 'hd') ? 'hd' : 'standard';
                } else if (useModel === 'gpt-image-1') {
                    costKey = apiQuality; // low/medium/high
                }
                cost = modelCostTable[costKey];
            }
            this.stats.cost += cost;
            
            console.log(`✅ 完成: ${filename}`);
            this.logSuccess(description, filename, fullPrompt);
            
            return true;
            
        } catch (error) {
            console.log(`❌ 失败: ${description} - ${error.message}`);
            
            if (retryCount < maxRetries && error.status !== 400) {
                console.log(`🔄 重试 ${retryCount + 1}/${maxRetries}: ${description}`);
                await this.sleep(2000); // 等待2秒后重试
                return this.generateSingleAsset(description, category, filename, retryCount + 1);
            }
            
            this.stats.failed++;
            this.logError(description, error.message);
            return false;
        }
    }

    /**
     * 采样生成：每类别最多生成2张。
     * 第一张使用 dall-e-3 standard；第二张（如有）使用 gpt-image-1 low。
     */
    async generateSamplePreview() {
        console.log('🔎 Sample 模式：每类别最多生成2张，模型分别为 DALL·E 3 standard 与 GPT-IMAGE-1 low\n');
        const startTime = Date.now();
        const categories = Object.keys(ASSET_CONFIGS);
        for (const categoryName of categories) {
            const category = ASSET_CONFIGS[categoryName] || [];
            if (category.length === 0) continue;

            console.log(`📂 类别: ${categoryName} (共 ${category.length} 项)，将生成 ${Math.min(2, category.length)} 张`);
            const take = Math.min(2, category.length);

            // 第一张：dall-e-3 standard
            const asset0 = category[0];
            const filename0 = `${categoryName}_${String(1).padStart(3, '0')}_${this.toEnglishSlug(asset0.name, categoryName)}.png`;
            this.stats.total++;
            await this.generateSingleAsset(asset0.description, categoryName, filename0, 0, {
                model: 'dall-e-3',
                quality: 'standard',
                size: '1024x1024',
                responseFormat: 'url'
            });

            // 第二张：gpt-image-1 low（仅当该类别至少2项）
            if (take >= 2) {
                const asset1 = category[1];
                const filename1 = `${categoryName}_${String(2).padStart(3, '0')}_${this.toEnglishSlug(asset1.name, categoryName)}.png`;
                this.stats.total++;
                await this.generateSingleAsset(asset1.description, categoryName, filename1, 0, {
                    model: 'gpt-image-1',
                    quality: 'low',
                    size: '1024x1024',
                    responseFormat: 'url'
                });
            } else {
                console.log(`ℹ️  ${categoryName} 只有1项，已只生成1张。`);
            }
            console.log('');
        }

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000 / 60; // 分钟
        this.generateFinalReport(duration);
    }

    /**
     * 单模型采样：每类别最多生成2张，全部使用当前选择的模型与质量
     */
    async generateSamplePerModel() {
        console.log(`🔎 Sample(单模型) 模式：每类别最多生成2张，统一模型=${this.model}，质量=${this.quality}，尺寸=${this.size}\n`);
        const startTime = Date.now();
        const categories = Object.keys(ASSET_CONFIGS);
        for (const categoryName of categories) {
            const category = ASSET_CONFIGS[categoryName] || [];
            if (category.length === 0) continue;

            const take = Math.min(2, category.length);
            console.log(`📂 类别: ${categoryName} (共 ${category.length} 项)，将生成 ${take} 张`);

            for (let i = 0; i < take; i++) {
                const asset = category[i];
                const idx = String(i + 1).padStart(3, '0');
                const filename = `${categoryName}_${idx}_${this.toEnglishSlug(asset.name, categoryName)}.png`;
                this.stats.total++;
                await this.generateSingleAsset(asset.description, categoryName, filename, 0, {
                    model: this.model,
                    quality: this.quality,
                    size: this.size,
                    responseFormat: this.responseFormat,
                    background: this.background,
                    style: this.style
                });
            }

            if (take < 2) {
                console.log(`ℹ️  ${categoryName} 只有1项，已只生成1张。`);
            }
            console.log('');
        }

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000 / 60; // 分钟
        this.generateFinalReport(duration);
    }

    /**
     * 构建完整的提示词
     */
    buildPrompt(description, category) {
        const baseStyle = "Studio Ghibli style game asset, 吉卜力风格游戏美术资源";
        const ghibliStyle = "soft watercolor painting, warm lighting, pastoral countryside, magical realism";
        const backgroundStyle = "clean white background, professional game asset";
        const qualityModifiers = "highly detailed, dreamy atmosphere, cozy and inviting";
        
        // 根据类别添加特定的风格指导
        const categoryStyles = {
            tiles: "isometric view, 2D sprite for game use, Monopoly game tile, complete building exterior, Howl's Moving Castle architecture style",
            ui: "hand-drawn UI elements, organic curves, nature-inspired design, soft gradients",
            icons: "cute icon design, Totoro-style simplicity, natural materials, 128x128 suitable",
            cards: "magical card design, fairy tale borders, enchanted forest themes, mystical glow",
            characters: "Ghibli character design, friendly expressions, countryside clothing, endearing personalities",
            dice: "dice texture for 3D cube, cryptocurrency icons as dots, seamless UV mapping, cube texture layout"
        };

        const categoryStyle = categoryStyles[category] || "";
        
        return `${baseStyle}, ${description}, ${categoryStyle}, ${ghibliStyle}, ${qualityModifiers}, ${backgroundStyle}`;
    }

    /**
     * 将中文名称转换为英文slug（与地图命名风格一致）
     */
    toEnglishSlug(name, category) {
        // 仅针对tiles提供详细映射；其他类别可按需扩展
        const tilesMap = {
            '起点地块': 'start',
            '监狱地块': 'jail',
            '免费停车': 'free-parking',
            '去监狱': 'go-to-jail',
            '机会地块': 'chance',
            '命运地块': 'fate',
            '所得税': 'income-tax',
            '奢侈税': 'luxury-tax',
            '火车站1': 'station-1',
            '火车站2': 'station-2',
            '火车站3': 'station-3',
            '火车站4': 'station-4',
            '电力公司': 'electric-company',
            '自来水厂': 'water-company',
            // 红色地产
            '红色地产房屋L1': 'red-property-house-l1',
            '红色地产房屋L2': 'red-property-house-l2',
            '红色地产别墅L3': 'red-property-villa-l3',
            '红色地产酒店L4': 'red-property-hotel-l4',
            '红色地产摩天楼L5': 'red-property-skyscraper-l5',
            // 蓝色地产
            '蓝色地产房屋L1': 'blue-property-house-l1',
            '蓝色地产房屋L2': 'blue-property-house-l2',
            '蓝色地产豪宅L3': 'blue-property-mansion-l3',
            '蓝色地产度假村L4': 'blue-property-resort-l4',
            '蓝色地产海景大厦L5': 'blue-property-seaview-tower-l5',
            // 绿色地产
            '绿色地产房屋L1': 'green-property-house-l1',
            '绿色地产房屋L2': 'green-property-house-l2',
            '绿色地产庄园L3': 'green-property-manor-l3',
            '绿色地产环保酒店L4': 'green-property-eco-hotel-l4',
            '绿色地产生态塔L5': 'green-property-eco-tower-l5',
            // 黄色地产
            '黄色地产房屋L1': 'yellow-property-house-l1',
            '黄色地产房屋L2': 'yellow-property-house-l2',
            '黄色地产商务楼L3': 'yellow-property-business-tower-l3',
            '黄色地产五星酒店L4': 'yellow-property-5star-hotel-l4',
            '黄色地产金融大厦L5': 'yellow-property-financial-tower-l5'
        };
        const uiMap = {
            '主菜单背景': 'main-menu-background',
            '游戏界面背景': 'gameplay-background',
            '设置界面背景': 'settings-background',
            '信息面板框架': 'info-panel-frame',
            '属性卡片框架': 'property-card-frame',
            '交易对话框': 'trade-dialog',
            '玩家状态面板': 'player-status-panel',
            '排行榜背景': 'leaderboard-background',
            '主要操作按钮': 'primary-button',
            '次要操作按钮': 'secondary-button',
            '危险操作按钮': 'danger-button',
            '成功确认按钮': 'success-button',
            '加载进度条': 'loading-progress-bar',
            '玩家血条UI': 'player-health-bar',
            '经验值进度条': 'experience-progress-bar',
            '倒计时器界面': 'countdown-ui'
        };
        const iconsMap = {
            '金币图标': 'coin-icon',
            '钻石图标': 'diamond-icon',
            '代币图标': 'token-icon',
            'NFT徽章图标': 'nft-badge-icon',
            '骰子图标': 'dice-icon',
            '卡牌图标': 'card-icon',
            '技能书图标': 'skill-book-icon',
            '成就奖杯图标': 'trophy-icon',
            '设置齿轮图标': 'settings-gear-icon',
            '帮助问号图标': 'help-question-icon',
            '音效开关图标': 'sound-toggle-icon',
            '全屏切换图标': 'fullscreen-toggle-icon',
            '好友列表图标': 'friends-list-icon',
            '聊天消息图标': 'chat-message-icon',
            '排行榜图标': 'leaderboard-icon',
            '分享链接图标': 'share-link-icon',
            '在线状态图标': 'online-status-icon',
            '离线状态图标': 'offline-status-icon',
            '加载旋转图标': 'loading-spinner-icon',
            '警告提示图标': 'warning-icon'
        };
        const cardsMap = {
            '攻击技能卡': 'attack-skill-card',
            '防御技能卡': 'defense-skill-card',
            '辅助技能卡': 'support-skill-card',
            '特殊技能卡': 'special-skill-card',
            '消耗道具卡': 'consumable-item-card',
            '永久道具卡': 'permanent-item-card',
            '装备道具卡': 'equipment-item-card',
            '收藏道具卡': 'collectible-item-card',
            '机会事件卡': 'chance-event-card',
            '命运事件卡': 'fate-event-card',
            '危机事件卡': 'crisis-event-card',
            '奖励事件卡': 'reward-event-card',
            '升级光效纹理': 'level-up-effect-texture',
            '购买成功特效': 'purchase-success-effect',
            '技能释放特效': 'skill-cast-effect',
            '金币收集特效': 'coin-collect-effect'
        };
        const charactersMap = {
            '经典绅士棋子': 'classic-gentleman-piece',
            '现代商务棋子': 'modern-business-piece',
            '科技极客棋子': 'tech-geek-piece',
            '时尚达人棋子': 'fashionista-piece',
            '运动健将棋子': 'athlete-piece',
            '艺术家棋子': 'artist-piece',
            '探险家棋子': 'explorer-piece',
            '学者教授棋子': 'scholar-professor-piece',
            '银行经理NPC': 'bank-manager-npc',
            '拍卖师NPC': 'auctioneer-npc',
            '律师顾问NPC': 'lawyer-advisor-npc',
            '建筑师NPC': 'architect-npc'
        };
        const dictByCategory = {
            tiles: tilesMap,
            ui: uiMap,
            icons: iconsMap,
            cards: cardsMap,
            characters: charactersMap
        };
        const dict = dictByCategory[category];
        if (dict && dict[name]) {
            return dict[name];
        }
        // 通用英文slug回退：将空白替换为破折号并移除非字母数字
        const basic = String(name)
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9\-]/g, '-')
            .replace(/-+/g, '-');
        return basic || 'item';
    }

    /**
     * 下载图片到本地
     */
    downloadImage(url, filepath) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(filepath);
            
            https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
                
                file.on('error', (err) => {
                    fs.unlink(filepath, () => {}); // 删除失败的文件
                    reject(err);
                });
                
            }).on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * 将base64图片写入本地
     */
    writeBase64Image(b64, filepath) {
        return new Promise((resolve, reject) => {
            try {
                const buffer = Buffer.from(b64, 'base64');
                fs.writeFile(filepath, buffer, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * 批量生成指定类别的资源
     */
    async generateCategory(categoryName) {
        const category = ASSET_CONFIGS[categoryName];
        if (!category) {
            console.log(`❌ 未找到类别: ${categoryName}`);
            return;
        }

        console.log(`\n🚀 开始生成 ${categoryName} 类别，共 ${category.length} 项资源\n`);

        for (let i = 0; i < category.length; i++) {
            const asset = category[i];
            const englishSlug = this.toEnglishSlug(asset.name, categoryName);
            const filename = `${categoryName}_${String(i + 1).padStart(3, '0')}_${englishSlug}.png`;
            
            this.stats.total++;
            
            await this.generateSingleAsset(asset.description, categoryName, filename);
            
            // API限制：避免过快请求
            if (i < category.length - 1) {
                await this.sleep(1000);
            }
            
            // 显示进度
            const progress = ((i + 1) / category.length * 100).toFixed(1);
            console.log(`📊 ${categoryName} 进度: ${progress}% (${i + 1}/${category.length})\n`);
        }

        console.log(`🎉 ${categoryName} 类别生成完成！\n`);
    }

    /**
     * 生成所有资源
     */
    async generateAll() {
        console.log('🎮 Web3 Tycoon AIGC美术资源生成工具启动\n');
        
        const startTime = Date.now();
        
        // 按优先级顺序生成各类别资源
        const generationOrder = ['tiles', 'ui', 'icons', 'cards', 'characters'];
        
        for (const categoryName of generationOrder) {
            if (ASSET_CONFIGS[categoryName]) {
                await this.generateCategory(categoryName);
            }
        }
        
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000 / 60; // 分钟
        
        this.generateFinalReport(duration);
    }

    /**
     * 生成指定数量的核心资源（快速原型）
     */
    async generateCore(count = 20) {
        console.log(`🚀 生成核心资源 (${count}张) 用于快速原型\n`);
        
        // 从各类别中选择最重要的资源
        const coreAssets = this.selectCoreAssets(count);
        
        for (let i = 0; i < coreAssets.length; i++) {
            const asset = coreAssets[i];
            const englishSlug = this.toEnglishSlug(asset.name, 'tiles');
            const filename = `core_${String(i + 1).padStart(2, '0')}_${englishSlug}.png`;
            
            this.stats.total++;
            
            await this.generateSingleAsset(asset.description, 'tiles', filename);
            
            if (i < coreAssets.length - 1) {
                await this.sleep(1000);
            }
        }
        
        console.log('🎉 核心资源生成完成！');
    }

    /**
     * 选择核心资源
     */
    selectCoreAssets(count) {
        const coreAssets = [];
        
        // 优先级排序：地块 > UI > 图标 > 其他
        const priorities = {
            tiles: 0.4,
            ui: 0.3,
            icons: 0.2,
            cards: 0.1
        };
        
        Object.entries(priorities).forEach(([category, ratio]) => {
            const categoryAssets = ASSET_CONFIGS[category] || [];
            const takeCount = Math.floor(count * ratio);
            
            coreAssets.push(...categoryAssets.slice(0, takeCount));
        });
        
        return coreAssets.slice(0, count);
    }

    /**
     * 生成最终报告
     */
    generateFinalReport(duration) {
        const report = {
            timestamp: new Date().toISOString(),
            duration: `${duration.toFixed(1)} 分钟`,
            stats: this.stats,
            estimatedCost: `$${this.stats.cost.toFixed(2)}`,
            outputDirectory: path.resolve(this.baseOutputDir),
            categories: Object.keys(ASSET_CONFIGS).map(cat => ({
                name: cat,
                count: ASSET_CONFIGS[cat].length
            }))
        };

        // 保存报告到JSON文件
        const reportPath = path.join(this.logDir, `generation_report_${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // 控制台输出报告
        console.log('\n' + '='.repeat(50));
        console.log('🎨 AIGC美术资源生成完成报告');
        console.log('='.repeat(50));
        console.log(`⏱️  总耗时: ${report.duration}`);
        console.log(`✅ 成功生成: ${this.stats.success} 张`);
        console.log(`❌ 生成失败: ${this.stats.failed} 张`);
        console.log(`📊 成功率: ${(this.stats.success / this.stats.total * 100).toFixed(1)}%`);
        console.log(`💰 预估成本: ${report.estimatedCost}`);
        console.log(`📁 输出目录: ${report.outputDirectory}`);
        console.log(`📋 详细报告: ${reportPath}`);
        console.log('='.repeat(50));
        console.log('🚀 资源已准备就绪，可以导入到Cocos Creator中使用！');
    }

    /**
     * 记录成功生成
     */
    logSuccess(description, filename, prompt) {
        const logPath = path.join(this.logDir, 'success.log');
        const logEntry = `${new Date().toISOString()} - SUCCESS - ${filename} - ${description}\n`;
        fs.appendFileSync(logPath, logEntry);
    }

    /**
     * 记录错误
     */
    logError(description, error) {
        const logPath = path.join(this.logDir, 'errors.log');
        const logEntry = `${new Date().toISOString()} - ERROR - ${description} - ${error}\n`;
        fs.appendFileSync(logPath, logEntry);
    }

    /**
     * 清理文件名
     */
    sanitizeFilename(name) {
        return name.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_').replace(/_+/g, '_');
    }

    /**
     * 延迟函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 命令行参数处理
async function main() {
    const rawArgs = process.argv.slice(2);

    // 解析可选参数：--model, --size, --quality, --cost
    const { flags, args } = parseFlags(rawArgs);

    const generator = new AIAssetGenerator({
        model: flags.model,
        size: flags.size,
        quality: flags.quality,
        costPerImage: flags.cost
    });

    // 检查API密钥
    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ 错误: 未找到OPENAI_API_KEY环境变量');
        console.log('请复制 .env.example 到 .env 并配置你的API密钥');
        process.exit(1);
    }

    try {
        if (args.length === 0) {
            // 默认生成所有资源
            await generator.generateAll();
        } else if (args[0] === 'core') {
            // 生成核心资源用于快速原型
            const count = parseInt(args[1]) || 20;
            await generator.generateCore(count);
        } else if (args[0] === 'sample') {
            // 每类别采样生成2张（dall-e-3 standard 与 gpt-image-1 low）
            await generator.generateSamplePreview();
        } else if (args[0] === 'single-sample') {
            // 单模型采样：每类别最多2张，使用当前模型设置
            await generator.generateSamplePerModel();
        } else if (args[0] === 'category') {
            // 生成特定类别
            const categoryName = args[1];
            if (!categoryName) {
                console.error('❌ 错误: 请指定要生成的类别名称');
                console.log('可用类别:', Object.keys(ASSET_CONFIGS).join(', '));
                process.exit(1);
            }
            await generator.generateCategory(categoryName);
        } else {
            console.log('用法:');
            console.log('  node asset_generator.js                                  # 生成所有资源');
            console.log('  node asset_generator.js core [数量]                      # 生成核心资源 (默认20张)');
            console.log('  node asset_generator.js sample                           # 每类别采样2张 (dall-e-3 standard + gpt-image-1 low)');
            console.log('  node asset_generator.js single-sample                    # 每类别采样2张（单一模型与质量）');
            console.log('  node asset_generator.js category [类别名]                # 生成特定类别');
            console.log('');
            console.log('可选参数:');
            console.log('  --model <dall-e-3|gpt-image-1>             选择图像模型 (默认 dall-e-3)');
            console.log('  --size <WxH>                               图片尺寸 (默认 1024x1024)');
            console.log('  --quality <standard|hd|low|medium|high>    生成质量 (默认 standard; gpt-image-1: low/medium/high)');
            console.log('  --responseFormat <url|b64_json>            响应格式 (默认 url)');
            console.log('  --background <transparent|...>             背景选项 (gpt-image-1 支持 transparent)');
            console.log('  --style <vivid|natural>                    风格选项 (gpt-image-1 可选)');
            console.log('  --cost <number>                            成本估算覆盖（每张美元）');
            console.log('');
            console.log('可用类别:', Object.keys(ASSET_CONFIGS).join(', '));
        }
    } catch (error) {
        console.error('❌ 生成过程中发生错误:', error.message);
        process.exit(1);
    }
}

/**
 * 解析命令行标志参数
 */
function parseFlags(argv) {
    const flags = {};
    const rest = [];
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token.startsWith('--')) {
            const eqIndex = token.indexOf('=');
            if (eqIndex !== -1) {
                const key = token.slice(2, eqIndex);
                const value = token.slice(eqIndex + 1);
                flags[key] = value;
            } else {
                const key = token.slice(2);
                const next = argv[i + 1];
                if (next && !next.startsWith('--')) {
                    flags[key] = next;
                    i++;
                } else {
                    flags[key] = true;
                }
            }
        } else {
            rest.push(token);
        }
    }
    return { flags, args: rest };
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(console.error);
}

module.exports = AIAssetGenerator;