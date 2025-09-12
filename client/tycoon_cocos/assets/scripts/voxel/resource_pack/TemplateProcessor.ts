/**
 * 模板处理器 - 处理 Minecraft 内置模型模板
 */

import { ElementDef, ElementFace, TextureInfo } from './types';

export class TemplateProcessor {
    
    /**
     * 检测模型模板类型
     * @param modelChain 模型继承链
     * @returns 模板类型
     */
    static detectTemplate(modelChain: Array<{ rel: string; ns: string; json: any }>): string {
        if (modelChain.length === 0) {
            return 'unsupported';
        }
        
        // 查找最顶层的父模型
        const rootModel = modelChain[modelChain.length - 1];
        const rootPath = rootModel.rel;
        
        // 检查内置模型
        if (rootPath.startsWith('builtin:')) {
            const builtinName = rootPath.substring('builtin:'.length);
            switch (builtinName) {
                case 'cross':
                    return 'cross';
                case 'generated':
                    return 'builtin';
                case 'entity':
                    return 'builtin';
                case 'missing':
                    return 'builtin';
                default:
                    return 'builtin';
            }
        }
        
        // 检查常见模板
        if (rootPath.includes('cube_all')) {
            return 'cube_all';
        } else if (rootPath.includes('cube_column')) {
            return 'cube_column';
        } else if (rootPath.includes('cube_bottom_top')) {
            return 'cube_bottom_top';
        } else if (rootPath.includes('cross')) {
            return 'cross';
        } else if (rootPath.includes('tinted_cross')) {
            return 'tinted_cross';
        } else if (rootPath.includes('orientable')) {
            return 'orientable';
        } else if (rootPath.includes('cube')) {
            return 'cube';
        }
        
        // 如果有自定义元素，返回 elements
        const topModel = modelChain[0];
        if (topModel.json && topModel.json.elements && topModel.json.elements.length > 0) {
            return 'elements';
        }
        
        return 'unsupported';
    }
    
    /**
     * 根据模板生成元素
     * @param template 模板类型
     * @param resolvedTextures 解析后的纹理映射
     * @returns 元素数组
     */
    static synthesizeElementsByTemplate(template: string, resolvedTextures: Record<string, TextureInfo>): ElementDef[] {
        switch (template) {
            case 'cube_all':
                return this.generateCubeAll(resolvedTextures);
            case 'cube_column':
                return this.generateCubeColumn(resolvedTextures);
            case 'cube_bottom_top':
                return this.generateCubeBottomTop(resolvedTextures);
            case 'cross':
            case 'tinted_cross':
                return this.generateCross(resolvedTextures);
            case 'orientable':
                return this.generateOrientable(resolvedTextures);
            case 'cube':
                return this.generateCube(resolvedTextures);
            case 'builtin':
                return this.generateBuiltin();
            default:
                return this.generateFallback();
        }
    }
    
    /**
     * 生成 cube_all 模板（所有面使用相同纹理）
     */
    private static generateCubeAll(textures: Record<string, TextureInfo>): ElementDef[] {
        const texture = textures['all'] || textures[Object.keys(textures)[0]];
        const textureRel = texture ? texture.rel : 'minecraft:block/missing';
        
        const faces: ElementFace[] = [
            { dir: 'north', uv: [0, 0, 16, 16], textureRel },
            { dir: 'south', uv: [0, 0, 16, 16], textureRel },
            { dir: 'east', uv: [0, 0, 16, 16], textureRel },
            { dir: 'west', uv: [0, 0, 16, 16], textureRel },
            { dir: 'up', uv: [0, 0, 16, 16], textureRel },
            { dir: 'down', uv: [0, 0, 16, 16], textureRel }
        ];
        
        return [{
            from: [0, 0, 0],
            to: [16, 16, 16],
            shade: true,
            faces
        }];
    }
    
    /**
     * 生成 cube_column 模板（顶底面和侧面使用不同纹理）
     */
    private static generateCubeColumn(textures: Record<string, TextureInfo>): ElementDef[] {
        const sideTexture = textures['side'];
        const endTexture = textures['end'];
        
        const sideRel = sideTexture ? sideTexture.rel : 'minecraft:block/missing';
        const endRel = endTexture ? endTexture.rel : 'minecraft:block/missing';
        
        const faces: ElementFace[] = [
            { dir: 'north', uv: [0, 0, 16, 16], textureRel: sideRel },
            { dir: 'south', uv: [0, 0, 16, 16], textureRel: sideRel },
            { dir: 'east', uv: [0, 0, 16, 16], textureRel: sideRel },
            { dir: 'west', uv: [0, 0, 16, 16], textureRel: sideRel },
            { dir: 'up', uv: [0, 0, 16, 16], textureRel: endRel },
            { dir: 'down', uv: [0, 0, 16, 16], textureRel: endRel }
        ];
        
        return [{
            from: [0, 0, 0],
            to: [16, 16, 16],
            shade: true,
            faces
        }];
    }
    
    /**
     * 生成 cube_bottom_top 模板
     */
    private static generateCubeBottomTop(textures: Record<string, TextureInfo>): ElementDef[] {
        const topTexture = textures['top'];
        const bottomTexture = textures['bottom'];
        const sideTexture = textures['side'];
        
        const topRel = topTexture ? topTexture.rel : 'minecraft:block/missing';
        const bottomRel = bottomTexture ? bottomTexture.rel : 'minecraft:block/missing';
        const sideRel = sideTexture ? sideTexture.rel : 'minecraft:block/missing';
        
        const faces: ElementFace[] = [
            { dir: 'north', uv: [0, 0, 16, 16], textureRel: sideRel },
            { dir: 'south', uv: [0, 0, 16, 16], textureRel: sideRel },
            { dir: 'east', uv: [0, 0, 16, 16], textureRel: sideRel },
            { dir: 'west', uv: [0, 0, 16, 16], textureRel: sideRel },
            { dir: 'up', uv: [0, 0, 16, 16], textureRel: topRel },
            { dir: 'down', uv: [0, 0, 16, 16], textureRel: bottomRel }
        ];
        
        return [{
            from: [0, 0, 0],
            to: [16, 16, 16],
            shade: true,
            faces
        }];
    }
    
    /**
     * 生成 cross 模板（两个交叉的平面）
     */
    private static generateCross(textures: Record<string, TextureInfo>): ElementDef[] {
        const crossTexture = textures['cross'] || textures[Object.keys(textures)[0]];
        const textureRel = crossTexture ? crossTexture.rel : 'minecraft:block/missing';
        
        return [
            // 第一个平面 (从 NW 到 SE)
            {
                from: [0.8, 0, 8],
                to: [15.2, 16, 8],
                shade: false,
                faces: [
                    { dir: 'north', uv: [0, 0, 16, 16], textureRel },
                    { dir: 'south', uv: [0, 0, 16, 16], textureRel }
                ]
            },
            // 第二个平面 (从 NE 到 SW)
            {
                from: [8, 0, 0.8],
                to: [8, 16, 15.2],
                shade: false,
                faces: [
                    { dir: 'west', uv: [0, 0, 16, 16], textureRel },
                    { dir: 'east', uv: [0, 0, 16, 16], textureRel }
                ]
            }
        ];
    }
    
    /**
     * 生成 orientable 模板（可定向的方块，如熔炉）
     */
    private static generateOrientable(textures: Record<string, TextureInfo>): ElementDef[] {
        const frontTexture = textures['front'];
        const sideTexture = textures['side'];
        const topTexture = textures['top'] || textures['end'];
        const bottomTexture = textures['bottom'] || textures['end'];
        
        const frontRel = frontTexture ? frontTexture.rel : 'minecraft:block/missing';
        const sideRel = sideTexture ? sideTexture.rel : 'minecraft:block/missing';
        const topRel = topTexture ? topTexture.rel : 'minecraft:block/missing';
        const bottomRel = bottomTexture ? bottomTexture.rel : 'minecraft:block/missing';
        
        const faces: ElementFace[] = [
            { dir: 'north', uv: [0, 0, 16, 16], textureRel: frontRel },
            { dir: 'south', uv: [0, 0, 16, 16], textureRel: sideRel },
            { dir: 'east', uv: [0, 0, 16, 16], textureRel: sideRel },
            { dir: 'west', uv: [0, 0, 16, 16], textureRel: sideRel },
            { dir: 'up', uv: [0, 0, 16, 16], textureRel: topRel },
            { dir: 'down', uv: [0, 0, 16, 16], textureRel: bottomRel }
        ];
        
        return [{
            from: [0, 0, 0],
            to: [16, 16, 16],
            shade: true,
            faces
        }];
    }
    
    /**
     * 生成 cube 模板（每个面可以有不同纹理）
     */
    private static generateCube(textures: Record<string, TextureInfo>): ElementDef[] {
        const northTexture = textures['north'];
        const southTexture = textures['south'];
        const eastTexture = textures['east'];
        const westTexture = textures['west'];
        const upTexture = textures['up'];
        const downTexture = textures['down'];
        
        const faces: ElementFace[] = [
            { dir: 'north', uv: [0, 0, 16, 16], textureRel: northTexture ? northTexture.rel : 'minecraft:block/missing' },
            { dir: 'south', uv: [0, 0, 16, 16], textureRel: southTexture ? southTexture.rel : 'minecraft:block/missing' },
            { dir: 'east', uv: [0, 0, 16, 16], textureRel: eastTexture ? eastTexture.rel : 'minecraft:block/missing' },
            { dir: 'west', uv: [0, 0, 16, 16], textureRel: westTexture ? westTexture.rel : 'minecraft:block/missing' },
            { dir: 'up', uv: [0, 0, 16, 16], textureRel: upTexture ? upTexture.rel : 'minecraft:block/missing' },
            { dir: 'down', uv: [0, 0, 16, 16], textureRel: downTexture ? downTexture.rel : 'minecraft:block/missing' }
        ];
        
        return [{
            from: [0, 0, 0],
            to: [16, 16, 16],
            shade: true,
            faces
        }];
    }
    
    /**
     * 生成内置模型（如 missing, generated 等）
     */
    private static generateBuiltin(): ElementDef[] {
        // 返回一个简单的立方体作为占位
        return this.generateFallback();
    }
    
    /**
     * 生成降级模型（紫黑方格）
     */
    private static generateFallback(): ElementDef[] {
        const faces: ElementFace[] = [
            { dir: 'north', uv: [0, 0, 16, 16], textureRel: 'minecraft:block/missing' },
            { dir: 'south', uv: [0, 0, 16, 16], textureRel: 'minecraft:block/missing' },
            { dir: 'east', uv: [0, 0, 16, 16], textureRel: 'minecraft:block/missing' },
            { dir: 'west', uv: [0, 0, 16, 16], textureRel: 'minecraft:block/missing' },
            { dir: 'up', uv: [0, 0, 16, 16], textureRel: 'minecraft:block/missing' },
            { dir: 'down', uv: [0, 0, 16, 16], textureRel: 'minecraft:block/missing' }
        ];
        
        return [{
            from: [0, 0, 0],
            to: [16, 16, 16],
            shade: true,
            faces
        }];
    }
    
    /**
     * 处理内置模型引用
     * @param builtinName 内置模型名称
     * @returns 等价的父模型路径
     */
    static resolveBuiltin(builtinName: string): string | null {
        switch (builtinName) {
            case 'cross':
                return 'minecraft:block/cross';
            case 'generated':
                return null; // 物品模型，不处理
            case 'entity':
                return null; // 实体模型，不处理
            case 'missing':
                return null; // 缺失模型，使用降级
            default:
                return null;
        }
    }
}