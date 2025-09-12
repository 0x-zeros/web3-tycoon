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
     * @param modelChain 模型继承链（可选，用于获取原始 elements 定义）
     * @returns 元素数组
     */
    static synthesizeElementsByTemplate(
        template: string, 
        resolvedTextures: Record<string, TextureInfo>,
        modelChain?: Array<{ rel: string; ns: string; json: any }>
    ): ElementDef[] {

        // console.log('synthesizeElementsByTemplate', template, modelChain);

        // Minecraft 规则：elements 不做跨 parent 合并
        // 如果子模型有 elements，完全覆盖父模型
        // 如果子模型没有 elements，才继承父模型的 elements
        // modelChain 是从子到父的顺序，所以从前往后遍历，找到第一个有 elements 的模型
        if (modelChain && modelChain.length > 0) {
            for (const model of modelChain) {
                if (model.json?.elements) {
                    console.log(`[TemplateProcessor] 使用模型 ${model.rel} 的 elements`);
                    return this.parseElements(model.json.elements);
                }
            }
        }
        
        switch (template) {
            case 'cube_all':
                return this.generateCubeAll();
            case 'cube_column':
                return this.generateCubeColumn();
            case 'cube_bottom_top':
                return this.generateCubeBottomTop();
            case 'cross':
            case 'tinted_cross':
                return this.generateCross();
            case 'orientable':
                return this.generateOrientable();
            case 'cube':
                return this.generateCube();
            case 'builtin':
                return this.generateBuiltin();
            default:
                return this.generateFallback();
        }
    }
    
    /**
     * 解析原始 elements 数据
     */
    private static parseElements(elements: any[]): ElementDef[] {
        return elements.map(element => {
            const faces: ElementFace[] = [];
            
            if (element.faces) {
                for (const dir in element.faces) {
                    if (!element.faces.hasOwnProperty(dir)) continue;
                    const face = element.faces[dir];
                    const faceData = face as any;
                    // 从 texture 字段提取 textureKey（去掉 # 前缀）
                    const textureKey = faceData.texture?.startsWith('#') 
                        ? faceData.texture.substring(1) 
                        : faceData.texture;
                    
                    faces.push({
                        dir: dir as any,
                        uv: faceData.uv || [0, 0, 16, 16],
                        textureKey,
                        cullface: faceData.cullface,
                        rotation: faceData.rotation,
                        tintindex: faceData.tintindex
                    });
                }
            }
            
            const result: ElementDef = {
                from: element.from || [0, 0, 0],
                to: element.to || [16, 16, 16],
                faces
            };
            
            if (element.rotation) {
                result.rotation = element.rotation;
            }
            
            if (element.shade !== undefined) {
                result.shade = element.shade;
            }
            
            return result;
        });
    }
    
    /**
     * 生成 cube_all 模板（所有面使用相同纹理）
     */
    private static generateCubeAll(): ElementDef[] {
        const textureKey = 'all';  // cube_all 模板使用 'all' 作为 key
        
        const faces: ElementFace[] = [
            { dir: 'north', uv: [0, 0, 16, 16], textureKey },
            { dir: 'south', uv: [0, 0, 16, 16], textureKey },
            { dir: 'east', uv: [0, 0, 16, 16], textureKey },
            { dir: 'west', uv: [0, 0, 16, 16], textureKey },
            { dir: 'up', uv: [0, 0, 16, 16], textureKey },
            { dir: 'down', uv: [0, 0, 16, 16], textureKey }
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
    private static generateCubeColumn(): ElementDef[] {
        // cube_column 模板使用 'side' 和 'end' 作为 key
        const faces: ElementFace[] = [
            { dir: 'north', uv: [0, 0, 16, 16], textureKey: 'side' },
            { dir: 'south', uv: [0, 0, 16, 16], textureKey: 'side' },
            { dir: 'east', uv: [0, 0, 16, 16], textureKey: 'side' },
            { dir: 'west', uv: [0, 0, 16, 16], textureKey: 'side' },
            { dir: 'up', uv: [0, 0, 16, 16], textureKey: 'end' },
            { dir: 'down', uv: [0, 0, 16, 16], textureKey: 'end' }
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
    private static generateCubeBottomTop(): ElementDef[] {
        // cube_bottom_top 模板使用 'side', 'top', 'bottom' 作为 key
        const faces: ElementFace[] = [
            { dir: 'north', uv: [0, 0, 16, 16], textureKey: 'side' },
            { dir: 'south', uv: [0, 0, 16, 16], textureKey: 'side' },
            { dir: 'east', uv: [0, 0, 16, 16], textureKey: 'side' },
            { dir: 'west', uv: [0, 0, 16, 16], textureKey: 'side' },
            { dir: 'up', uv: [0, 0, 16, 16], textureKey: 'top' },
            { dir: 'down', uv: [0, 0, 16, 16], textureKey: 'bottom' }
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
    private static generateCross(): ElementDef[] {
        // cross 模板使用 'cross' 作为 key
        const textureKey = 'cross';
        
        return [
            // 第一个平面 (从 NW 到 SE)
            {
                from: [0.8, 0, 8],
                to: [15.2, 16, 8],
                shade: false,
                faces: [
                    { dir: 'north', uv: [0, 0, 16, 16], textureKey },
                    { dir: 'south', uv: [0, 0, 16, 16], textureKey }
                ]
            },
            // 第二个平面 (从 NE 到 SW)
            {
                from: [8, 0, 0.8],
                to: [8, 16, 15.2],
                shade: false,
                faces: [
                    { dir: 'west', uv: [0, 0, 16, 16], textureKey },
                    { dir: 'east', uv: [0, 0, 16, 16], textureKey }
                ]
            }
        ];
    }
    
    /**
     * 生成 orientable 模板（可定向的方块，如熔炉）
     */
    private static generateOrientable(): ElementDef[] {
        // orientable 模板使用 'front', 'side', 'top'/'end', 'bottom'/'end' 作为 key
        // 默认使用 'end' 作为顶部和底部的 key
        const topKey = 'top';
        const bottomKey = 'bottom';
        
        const faces: ElementFace[] = [
            { dir: 'north', uv: [0, 0, 16, 16], textureKey: 'front' },
            { dir: 'south', uv: [0, 0, 16, 16], textureKey: 'side' },
            { dir: 'east', uv: [0, 0, 16, 16], textureKey: 'side' },
            { dir: 'west', uv: [0, 0, 16, 16], textureKey: 'side' },
            { dir: 'up', uv: [0, 0, 16, 16], textureKey: topKey },
            { dir: 'down', uv: [0, 0, 16, 16], textureKey: bottomKey }
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
    private static generateCube(): ElementDef[] {
        // cube 模板每个面使用对应的 key
        const faces: ElementFace[] = [
            { dir: 'north', uv: [0, 0, 16, 16], textureKey: 'north' },
            { dir: 'south', uv: [0, 0, 16, 16], textureKey: 'south' },
            { dir: 'east', uv: [0, 0, 16, 16], textureKey: 'east' },
            { dir: 'west', uv: [0, 0, 16, 16], textureKey: 'west' },
            { dir: 'up', uv: [0, 0, 16, 16], textureKey: 'up' },
            { dir: 'down', uv: [0, 0, 16, 16], textureKey: 'down' }
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
            { dir: 'north', uv: [0, 0, 16, 16], textureKey: 'missing' },
            { dir: 'south', uv: [0, 0, 16, 16], textureKey: 'missing' },
            { dir: 'east', uv: [0, 0, 16, 16], textureKey: 'missing' },
            { dir: 'west', uv: [0, 0, 16, 16], textureKey: 'missing' },
            { dir: 'up', uv: [0, 0, 16, 16], textureKey: 'missing' },
            { dir: 'down', uv: [0, 0, 16, 16], textureKey: 'missing' }
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