/**
 * 数字纹理生成器
 *
 * 使用Canvas2D动态生成包含数字的Texture2D
 * 支持缓存以提高性能
 *
 * @author Web3 Tycoon Team
 */

import { Texture2D, ImageAsset } from 'cc';
import { BuildingType } from '../../sui/types/constants';
import { PlayerColors } from '../../utils/PlayerColors';

/**
 * 数字纹理生成选项
 */
export interface NumberTextureOptions {
    /** 纹理尺寸（正方形，默认64）*/
    size?: number;
    /** 字体大小（默认42）*/
    fontSize?: number;
    /** 背景颜色（CSS格式，默认半透明白色）*/
    bgColor?: string;
    /** 文字颜色（CSS格式，默认黑色）*/
    textColor?: string;
    /** 是否显示边框（默认true）*/
    withBorder?: boolean;
    /** 文字前缀（如 "T" 或 "B"）*/
    prefix?: string;
    /** 圆角半径（默认6）*/
    borderRadius?: number;
    /** 自定义文字（优先级高于prefix+num）*/
    customText?: string;
}

/**
 * 数字纹理生成器
 */
export class NumberTextureGenerator {
    // 纹理缓存（key: 缓存键, value: Texture2D）
    private static cache: Map<string, Texture2D> = new Map();

    /**
     * 获取数字纹理（带缓存）
     *
     * @param num 要显示的数字
     * @param options 生成选项
     * @returns Texture2D
     */
    static getNumberTexture(
        num: number,
        options?: NumberTextureOptions
    ): Texture2D {
        // 生成缓存键（包含主要参数，包括 textColor 以区分不同 owner）
        const prefix = options?.prefix || '';
        const bgColor = options?.bgColor || 'default';
        const textColor = options?.textColor || 'default';
        const customText = options?.customText || '';

        // 缓存键：包含 textColor 以确保不同 owner 的纹理不会被复用
        const cacheKey = customText
            ? `custom_${customText}_${bgColor}_${textColor}`
            : `${prefix}${num}_${bgColor}_${textColor}`;

        // 检查缓存
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        // 生成新纹理
        const texture = this.generateTexture(num, options);
        this.cache.set(cacheKey, texture);

        // console.log(`[NumberTextureGenerator] Generated texture for ${prefix}${num}, cache size: ${this.cache.size}`);
        return texture;
    }

    /**
     * 生成数字纹理
     *
     * @param num 数字
     * @param options 选项
     * @returns Texture2D
     */
    private static generateTexture(
        num: number,
        options?: NumberTextureOptions
    ): Texture2D {
        const size = options?.size || 64;
        const fontSize = options?.fontSize || 42;
        const bgColor = options?.bgColor || 'rgba(255, 255, 255, 0.85)';
        const textColor = options?.textColor || '#000';
        const withBorder = options?.withBorder !== false;
        const prefix = options?.prefix || '';
        const borderRadius = options?.borderRadius || 6;

        // 创建Canvas
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        // 清空画布（透明背景）
        ctx.clearRect(0, 0, size, size);

        // 绘制圆角背景
        ctx.fillStyle = bgColor;
        this.drawRoundRect(ctx, 2, 2, size - 4, size - 4, borderRadius);
        ctx.fill();

        // 绘制边框（可选）
        if (withBorder) {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 2;
            this.drawRoundRect(ctx, 2, 2, size - 4, size - 4, borderRadius);
            ctx.stroke();
        }

        // 绘制文字（优先级: customText > prefix+num > num）
        const text = options?.customText ||
                     (prefix ? `${prefix}${num}` : num.toString());

        // 判断是否需要多行显示（检测空格）
        const lines = text.includes(' ') ? text.split(' ') : [text];
        const lineHeight = fontSize * 1.2;  // 行间距系数
        const totalHeight = lines.length * lineHeight;

        ctx.fillStyle = textColor;
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 垂直居中：从中心点向上偏移半个总高度，然后逐行绘制
        const startY = size / 2 - totalHeight / 2 + lineHeight / 2;

        lines.forEach((line, index) => {
            const y = startY + index * lineHeight;
            ctx.fillText(line, size / 2, y);
        });

        // 转换为Cocos Texture2D
        const image = new ImageAsset();
        image.reset({
            _data: canvas,
            width: size,
            height: size,
            format: Texture2D.PixelFormat.RGBA8888,
            _compressed: false
        });

        const texture = new Texture2D();
        texture.image = image;

        return texture;
    }

    /**
     * 绘制圆角矩形路径
     *
     * @param ctx Canvas上下文
     * @param x 起始X
     * @param y 起始Y
     * @param w 宽度
     * @param h 高度
     * @param r 圆角半径
     */
    private static drawRoundRect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number
    ): void {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    /**
     * 清除缓存
     * 注意：会销毁所有缓存的Texture2D对象
     */
    static clearCache(): void {
        this.cache.forEach(texture => {
            if (texture && texture.isValid) {
                texture.destroy();
            }
        });
        this.cache.clear();
        console.log('[NumberTextureGenerator] Cache cleared');
    }

    /**
     * 获取缓存统计
     */
    static getCacheStats(): { count: number; keys: string[] } {
        return {
            count: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    /**
     * 生成字母纹理（方向标记专用）
     *
     * @param letter 字母（如 "W", "N", "E", "S"）
     * @returns Texture2D
     */
    static getLetterTexture(letter: string): Texture2D {
        return this.getNumberTexture(0, {
            size: 64,
            fontSize: 36,
            bgColor: 'rgba(100, 200, 255, 0.85)',  // 蓝色背景
            textColor: '#FFF',  // 白色字母
            withBorder: true,
            customText: letter
        });
    }

    /**
     * 生成 NPC 名字纹理
     * 用于在 NPC block 顶部显示名字
     *
     * @param npcName NPC 中文名字（如 "路障"、"财神" 等）
     * @returns Texture2D
     */
    static getNPCNameTexture(npcName: string): Texture2D {
        // 根据字数调整字体大小
        const fontSize = npcName.length === 2 ? 22 : 18;

        // 根据 NPC 类型获取文字颜色
        const textColor = this.getNPCTextColor(npcName);

        return this.getNumberTexture(0, {
            size: 64,
            fontSize: fontSize,           // 动态字体大小
            bgColor: 'rgba(0, 0, 0, 0)',  // 透明背景
            textColor: textColor,         // 动态文字颜色
            withBorder: true,             // 有边框
            borderRadius: 4,
            customText: npcName
        });
    }

    /**
     * 获取地块类型纹理
     * 根据 Web3TileType 生成带类型名称和颜色的纹理
     *
     * @param typeId Web3TileType 枚举值
     * @returns Texture2D
     */
    static getTileTypeTexture(typeId: number): Texture2D {
        // 获取类型名称和颜色
        const typeName = this.getTileTypeName(typeId);
        const bgColor = this.getTileTypeColor(typeId);
        const textColor = this.getTileTypeTextColor(typeId);  // 根据类型获取文字颜色

        // 根据类型调整字体大小
        // 金额类型（奖励4、费用5）使用更小的字体
        const fontSize = (typeId === 4 || typeId === 5) ? 18 : 22;

        return this.getNumberTexture(0, {
            size: 64,
            fontSize: fontSize,  // 动态字体大小
            bgColor: bgColor,
            textColor: textColor,  // 动态文字颜色
            withBorder: true,  // 显示边框
            borderRadius: 4,
            customText: typeName
        });
    }

    /**
     * 获取地块类型名称
     *
     * @param typeId Web3TileType
     * @returns 中文名称
     */
    private static getTileTypeName(typeId: number): string {
        switch (typeId) {
            case 0: return '空地';
            case 1: return '乐透';
            case 2: return '医院';
            case 3: return '机会';
            case 4: return '+2000';  // 奖励：显示金额
            case 5: return '-2000';  // 费用：显示金额
            // case 4: return '奖励';
            // case 5: return '费用';
            case 6: return '卡片';
            case 7: return '新闻';
            case 8: return '卡片商店';   // 卡片商店：简称 卡店
            default: return '未知';
        }
    }

    /**
     * 获取地块类型背景颜色（从贴图颜色提取，半透明）
     *
     * @param typeId Web3TileType
     * @returns CSS rgba 颜色字符串
     */
    private static getTileTypeColor(typeId: number): string {
        // 测试：背景全透明，只显示文字
        return 'rgba(0, 0, 0, 0)';  // 完全透明

        // ===== 原颜色方案（从贴图提取）=====
        // switch (typeId) {
        //     case 0: return 'rgba(128, 128, 128, 0.7)';   // 空地：灰色（但不会显示）
        //     case 1: return 'rgba(230, 230, 230, 0.7)';   // 乐透：白色/浅色
        //     case 2: return 'rgba(60, 150, 60, 0.7)';     // 医院：绿色
        //     case 3: return 'rgba(50, 80, 130, 0.7)';     // 机会：深蓝色
        //     case 4: return 'rgba(180, 250, 180, 0.7)';   // 奖励：浅绿色
        //     case 5: return 'rgba(230, 200, 80, 0.7)';    // 费用：黄色
        //     case 6: return 'rgba(230, 230, 230, 0.7)';   // 卡片：白色/浅色
        //     case 7: return 'rgba(100, 100, 100, 0.7)';   // 新闻：灰色
        //     default: return 'rgba(255, 255, 255, 0.7)';  // 默认：白色
        // }
    }

    /**
     * 获取地块类型文字颜色（根据背景自适应，每种类型专属颜色）
     *
     * @param typeId Web3TileType
     * @returns CSS 颜色字符串
     */
    private static getTileTypeTextColor(typeId: number): string {
        switch (typeId) {
            case 1: return '#4A4A4A';     // 乐透（白色背景）：深灰，稳重
            case 2: return '#FFFFFF';     // 医院（绿色背景）：白色，清晰
            case 3: return '#00E5FF';     // 机会（深蓝背景）：亮青色，与图片色系一致
            case 4: return '#2E7D32';     // 奖励（浅绿背景）：深绿，正向提示
            case 5: return '#FF6F00';     // 费用（黄色背景）：深橙，警示但不严肃
            case 6: return '#5E35B1';     // 卡片（白色背景）：紫色，神秘稀有
            case 7: return '#FFD700';     // 新闻（灰色背景）：金黄，醒目
            case 8: return '#FF69B4';     // 卡片商店（粉色）：购物感
            default: return '#FFFFFF';    // 默认：白色
        }
    }

    /**
     * 获取 NPC 文字颜色（根据 NPC block 背景自适应）
     *
     * @param npcName NPC 中文名字
     * @returns CSS 颜色字符串
     */
    private static getNPCTextColor(npcName: string): string {
        switch (npcName) {
            case '路障':   return '#FFD700';  // 绿色背景 → 金黄，警示醒目
            case '炸弹':   return '#FF6F00';  // 深灰背景 → 深橙，危险感
            case '恶犬':   return '#FFEB3B';  // 棕灰背景 → 亮黄，威胁感
            case '福神':   return '#4A4A4A';  // 浅蓝背景 → 深灰，清晰
            case '土地神': return '#4A4A4A';  // 浅蓝背景 → 深灰，清晰
            case '穷神':   return '#FFD700';  // 深灰背景 → 金黄，醒目
            case '财神':   return '#4A4A4A';  // 浅紫蓝背景 → 深灰，清晰
            default:       return '#FFFFFF';  // 默认白色
        }
    }

    /**
     * 生成建筑标签纹理（空地/等级/类型）
     *
     * @param level 建筑等级（0-5）
     * @param owner 拥有者索引（255=无主，0-3=玩家）
     * @param size 建筑大小（1或2，默认1）
     * @param buildingType 建筑类型（0=无类型，20-24=各类型，默认0）
     * @returns Texture2D
     */
    static getBuildingLabelTexture(
        level: number,
        owner: number,
        size: number = 1,
        buildingType: number = 0
    ): Texture2D {
        const text = this.getBuildingLevelText(level, size, buildingType);
        const textColor = this.getBuildingOwnerColor(owner);

        // 动态字体大小：2x2长文本（两行）用16px，其他用20px
        const fontSize = (size === 2 && buildingType > 0) ? 16 : 20;

        return this.getNumberTexture(0, {
            size: 64,
            fontSize: fontSize,
            bgColor: 'rgba(0, 0, 0, 0)',  // 透明背景
            textColor: textColor,          // 根据 owner 动态颜色
            withBorder: true,
            borderRadius: 4,
            customText: text
        });
    }

    /**
     * 获取建筑等级文字
     *
     * @param level 建筑等级（0-5）
     * @param size 建筑大小（1或2）
     * @param buildingType 建筑类型（0=无类型）
     * @returns 等级文字（如"空地"、"1级"、"1级 土地庙"）
     */
    private static getBuildingLevelText(
        level: number,
        size: number = 1,
        buildingType: number = 0
    ): string {
        // Level 0: 所有建筑都显示"空地"
        if (level === 0) {
            return '空地';
        }

        // 1x1建筑: 只显示等级
        if (size === 1) {
            return `${level}级`;
        }

        // 2x2建筑: level >= 1 时必然有类型，显示"X级 类型名"
        if (size === 2) {
            const typeName = this.getBuildingTypeDisplayName(buildingType);
            // 防御性检查：如果类型名为空（理论上不应该发生），只返回等级
            if (!typeName) {
                return `${level}级`;
            }
            return `${level}级 ${typeName}`;
        }

        // 兜底
        return `${level}级`;
    }

    /**
     * 获取建筑类型的显示名称
     *
     * @param buildingType BuildingType枚举值
     * @returns 中文类型名称
     */
    private static getBuildingTypeDisplayName(buildingType: number): string {
        switch (buildingType) {
            case BuildingType.TEMPLE:      return '土地庙';
            case BuildingType.RESEARCH:    return '研究所';
            case BuildingType.OIL:         return '石油公司';
            case BuildingType.COMMERCIAL:  return '商业中心';
            case BuildingType.HOTEL:       return '大饭店';
            default:                        return '';  // 返回空字符串（作为防御）
        }
    }

    /**
     * 获取建筑拥有者颜色（高对比度配色，适配浅蓝色背景）
     *
     * @param owner 拥有者索引
     * @returns CSS 颜色字符串
     */
    private static getBuildingOwnerColor(owner: number): string {
        return PlayerColors.getBuildingOwnerHex(owner);
    }

    // ========================= 价格纹理生成 =========================

    /**
     * 价格类型枚举
     */
    static PriceType = {
        RENT: 'rent',           // 租金（红色）
        UPGRADE: 'upgrade',     // 升级价格（蓝色）
        BUY: 'buy',             // 购买价格（绿色）
        BONUS: 'bonus',         // 奖励（金色）
        FEE: 'fee'              // 费用（橙色）
    } as const;

    /**
     * 价格信息接口
     */
    static PriceInfo: { type: string; amount: bigint }[] = [];

    /**
     * 获取价格类型的颜色
     */
    private static getPriceTypeColor(type: string): string {
        switch (type) {
            case this.PriceType.RENT:    return '#FF5252';  // 红色
            case this.PriceType.UPGRADE: return '#2196F3';  // 蓝色
            case this.PriceType.BUY:     return '#4CAF50';  // 绿色
            case this.PriceType.BONUS:   return '#FFD700';  // 金色
            case this.PriceType.FEE:     return '#FF9800';  // 橙色
            default:                     return '#FFFFFF';  // 白色
        }
    }

    /**
     * 获取价格类型的前缀
     */
    private static getPriceTypePrefix(type: string): string {
        switch (type) {
            case this.PriceType.RENT:    return '租';
            case this.PriceType.UPGRADE: return '升';
            case this.PriceType.BUY:     return '购';
            case this.PriceType.BONUS:   return '+';
            case this.PriceType.FEE:     return '-';
            default:                     return '';
        }
    }

    /**
     * 格式化金额（简短形式）
     */
    private static formatShortAmount(amount: bigint): string {
        const num = Number(amount);
        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(1)}M`;
        } else if (num >= 10000) {
            return `${(num / 1000).toFixed(0)}K`;
        } else if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K`;
        }
        return num.toString();
    }

    /**
     * 生成价格纹理（支持多行、不同颜色）
     *
     * @param prices 价格信息数组 [{ type: 'rent'|'upgrade'|'buy'|'bonus'|'fee', amount: bigint }]
     * @param options 可选配置
     * @returns Texture2D
     */
    static getPriceTexture(
        prices: Array<{ type: string; amount: bigint }>,
        options?: {
            size?: number;
            fontSize?: number;
        }
    ): Texture2D {
        const size = options?.size || 64;
        const fontSize = options?.fontSize || 14;

        // 生成缓存键（包含所有价格信息）
        const priceKey = prices.map(p => `${p.type}:${p.amount}`).join('|');
        const cacheKey = `price_${priceKey}_${size}_${fontSize}`;

        // 检查缓存
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        // 创建Canvas
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        // 清空画布（透明背景）
        ctx.clearRect(0, 0, size, size);

        // 绘制半透明黑色背景（提高可读性）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.drawRoundRect(ctx, 2, 2, size - 4, size - 4, 4);
        ctx.fill();

        // 计算行高和起始位置
        const lineHeight = fontSize * 1.3;
        const totalHeight = prices.length * lineHeight;
        const startY = size / 2 - totalHeight / 2 + lineHeight / 2;

        // 绘制每行价格
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        prices.forEach((price, index) => {
            const y = startY + index * lineHeight;
            const color = this.getPriceTypeColor(price.type);
            const prefix = this.getPriceTypePrefix(price.type);
            const amountStr = this.formatShortAmount(price.amount);

            // 绘制文字（带描边提高可读性）
            const text = `${prefix}${amountStr}`;

            // 描边
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.strokeText(text, size / 2, y);

            // 填充
            ctx.fillStyle = color;
            ctx.fillText(text, size / 2, y);
        });

        // 转换为Cocos Texture2D
        const image = new ImageAsset();
        image.reset({
            _data: canvas,
            width: size,
            height: size,
            format: Texture2D.PixelFormat.RGBA8888,
            _compressed: false
        });

        const texture = new Texture2D();
        texture.image = image;

        // 缓存
        this.cache.set(cacheKey, texture);

        return texture;
    }

    /**
     * 生成建筑价格纹理（根据建筑状态自动计算显示内容）
     *
     * @param hasOwner 是否有主人
     * @param rentAmount 租金（有主人时显示）
     * @param buyAmount 购买价格（无主人时显示）
     * @param upgradeAmount 升级价格（可升级时显示，0表示不显示）
     * @param options 可选配置
     * @returns Texture2D
     */
    static getBuildingPriceTexture(
        hasOwner: boolean,
        rentAmount: bigint,
        buyAmount: bigint,
        upgradeAmount: bigint,
        options?: {
            size?: number;
            fontSize?: number;
        }
    ): Texture2D {
        const prices: Array<{ type: string; amount: bigint }> = [];

        if (hasOwner) {
            // 有主人：显示租金
            if (rentAmount > 0) {
                prices.push({ type: this.PriceType.RENT, amount: rentAmount });
            }
        } else {
            // 无主人：显示购买价格
            if (buyAmount > 0) {
                prices.push({ type: this.PriceType.BUY, amount: buyAmount });
            }
        }

        // 可升级时显示升级价格
        if (upgradeAmount > 0) {
            prices.push({ type: this.PriceType.UPGRADE, amount: upgradeAmount });
        }

        // 如果没有要显示的价格，返回空纹理
        if (prices.length === 0) {
            return this.getNumberTexture(0, {
                size: options?.size || 64,
                bgColor: 'rgba(0, 0, 0, 0)',
                customText: ''
            });
        }

        return this.getPriceTexture(prices, options);
    }

    /**
     * 生成特殊地块金额纹理（奖励/费用）
     *
     * @param isBonus 是否为奖励（true=奖励，false=费用）
     * @param amount 金额
     * @param options 可选配置
     * @returns Texture2D
     */
    static getSpecialTileAmountTexture(
        isBonus: boolean,
        amount: bigint,
        options?: {
            size?: number;
            fontSize?: number;
        }
    ): Texture2D {
        const type = isBonus ? this.PriceType.BONUS : this.PriceType.FEE;
        return this.getPriceTexture([{ type, amount }], {
            size: options?.size || 64,
            fontSize: options?.fontSize || 18
        });
    }
}

