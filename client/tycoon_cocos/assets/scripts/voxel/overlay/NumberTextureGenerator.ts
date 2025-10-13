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
}

