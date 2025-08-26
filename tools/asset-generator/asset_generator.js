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
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        this.baseOutputDir = './output';
        this.logDir = './logs';
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

        // 为每个资源类别创建子目录
        Object.keys(CATEGORIES).forEach(category => {
            const categoryDir = path.join(this.baseOutputDir, category);
            if (!fs.existsSync(categoryDir)) {
                fs.mkdirSync(categoryDir, { recursive: true });
            }
        });
    }

    /**
     * 生成单个资源
     */
    async generateSingleAsset(description, category, filename, retryCount = 0) {
        const maxRetries = 3;
        
        try {
            console.log(`🎨 生成中: ${description}`);
            
            // 构建完整的prompt
            const fullPrompt = this.buildPrompt(description, category);
            
            const response = await this.openai.images.generate({
                model: "dall-e-3",
                prompt: fullPrompt,
                size: "1024x1024",
                quality: "standard",
                n: 1,
            });

            const imageUrl = response.data[0].url;
            const filepath = path.join(this.baseOutputDir, category, filename);
            
            await this.downloadImage(imageUrl, filepath);
            
            this.stats.success++;
            this.stats.cost += 0.04; // DALL-E 3标准质量成本
            
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
     * 构建完整的提示词
     */
    buildPrompt(description, category) {
        const baseStyle = "游戏美术资源，卡通风格，Web3 Tycoon大富翁游戏";
        const backgroundStyle = "干净的白色背景，专业游戏资产";
        const qualityModifiers = "高质量，细节丰富，色彩鲜艳";
        
        // 根据类别添加特定的风格指导
        const categoryStyles = {
            tiles: "等距视角，大富翁地块，蓝紫色和金色配色方案",
            ui: "现代UI设计，扁平风格，紫色渐变效果，发光边框",
            icons: "图标设计，立体感，128x128像素适用，简洁明了",
            cards: "卡牌游戏风格，装饰性边框，魔法光效，稀有度展示",
            characters: "Q版角色设计，友好表情，多彩服装，识别度高"
        };

        const categoryStyle = categoryStyles[category] || "";
        
        return `${baseStyle}，${description}，${categoryStyle}，${qualityModifiers}，${backgroundStyle}`;
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
            const filename = `${categoryName}_${String(i + 1).padStart(3, '0')}_${this.sanitizeFilename(asset.name)}.png`;
            
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
            const filename = `core_${String(i + 1).padStart(2, '0')}_${this.sanitizeFilename(asset.name)}.png`;
            
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
    const args = process.argv.slice(2);
    const generator = new AIAssetGenerator();

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
            console.log('  node asset_generator.js                    # 生成所有资源');
            console.log('  node asset_generator.js core [数量]        # 生成核心资源 (默认20张)');
            console.log('  node asset_generator.js category [类别名]  # 生成特定类别');
            console.log('');
            console.log('可用类别:', Object.keys(ASSET_CONFIGS).join(', '));
        }
    } catch (error) {
        console.error('❌ 生成过程中发生错误:', error.message);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(console.error);
}

module.exports = AIAssetGenerator;