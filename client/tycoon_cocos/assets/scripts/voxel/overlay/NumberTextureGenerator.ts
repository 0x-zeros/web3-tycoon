/**
 * 数字纹理生成器
 *
 * 使用Canvas2D动态生成包含数字的Texture2D
 * 支持缓存以提高性能
 *
 * @author Web3 Tycoon Team
 */

import { Texture2D, ImageAsset } from 'cc';

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
        // 生成缓存键（包含主要参数）
        const prefix = options?.prefix || '';
        const bgColor = options?.bgColor || 'default';
        const customText = options?.customText || '';

        // 缓存键：customText优先，否则用prefix+num
        const cacheKey = customText
            ? `custom_${customText}_${bgColor}`
            : `${prefix}${num}_${bgColor}`;

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
        ctx.fillStyle = textColor;
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, size / 2, size / 2);

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
            case 7: return '#E3F2FD';     // 新闻（灰色背景）：浅蓝，资讯感
            default: return '#FFFFFF';    // 默认：白色
        }
    }
}

