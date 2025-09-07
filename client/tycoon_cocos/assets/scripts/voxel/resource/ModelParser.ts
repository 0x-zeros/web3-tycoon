import { ModelData, ElementData, FaceData, ResourcePackLoader } from './ResourcePackLoader';

export interface ResolvedModel {
    elements: ResolvedElement[];
    textures: Map<string, string>; // #key -> minecraft:block/texture_name
    ambientocclusion: boolean;
    display: { [key: string]: any };
    parent?: string;
}

export interface ResolvedElement {
    from: [number, number, number];
    to: [number, number, number];
    rotation?: {
        origin: [number, number, number];
        axis: 'x' | 'y' | 'z';
        angle: number;
        rescale: boolean;
    };
    shade: boolean;
    faces: Map<string, ResolvedFace>;
}

export interface ResolvedFace {
    uv: [number, number, number, number];
    texture: string; // 已解析的纹理路径
    cullface?: string;
    rotation: number; // 0, 90, 180, 270
    tintindex?: number;
}

export enum ModelTemplate {
    CUBE_ALL = 'minecraft:block/cube_all',
    CUBE_COLUMN = 'minecraft:block/cube_column',
    CROSS = 'minecraft:block/cross',
    CUBE = 'minecraft:block/cube',
    ORIENTABLE = 'minecraft:block/orientable'
}

export class ModelParser {
    private resourceLoader: ResourcePackLoader;
    private modelCache: Map<string, ResolvedModel> = new Map();

    constructor(resourceLoader: ResourcePackLoader) {
        this.resourceLoader = resourceLoader;
    }

    /**
     * 解析模型，处理继承链和纹理引用
     * @param modelId 模型ID
     * @returns 解析后的模型
     */
    async parseModel(modelId: string): Promise<ResolvedModel | null> {
        // 检查缓存
        if (this.modelCache.has(modelId)) {
            return this.modelCache.get(modelId)!;
        }

        const rawModel = this.resourceLoader.getModel(modelId);
        if (!rawModel) {
            console.warn(`[ModelParser] 模型未找到: ${modelId}`);
            return this.createFallbackModel();
        }

        try {
            const resolvedModel = await this.resolveModel(rawModel, modelId);
            this.modelCache.set(modelId, resolvedModel);
            return resolvedModel;
        } catch (error) {
            console.error(`[ModelParser] 模型解析失败: ${modelId}`, error);
            return this.createFallbackModel();
        }
    }

    /**
     * 递归解析模型，处理父模型继承
     * @param modelData 模型数据
     * @param modelId 当前模型ID
     * @param visited 已访问的模型（防止循环引用）
     * @returns 解析后的模型
     */
    private async resolveModel(
        modelData: ModelData, 
        modelId: string, 
        visited: Set<string> = new Set()
    ): Promise<ResolvedModel> {
        
        if (visited.has(modelId)) {
            console.warn(`[ModelParser] 检测到循环引用: ${modelId}`);
            return this.createFallbackModel();
        }
        visited.add(modelId);

        let resolvedModel: ResolvedModel = {
            elements: [],
            textures: new Map(),
            ambientocclusion: modelData.ambientocclusion !== false,
            display: modelData.display || {},
            parent: modelData.parent
        };

        // 处理父模型继承
        if (modelData.parent) {
            const parentModel = await this.resolveModel(
                this.resourceLoader.getModel(modelData.parent) || {},
                modelData.parent,
                visited
            );
            
            // 继承父模型的属性
            resolvedModel.elements = [...parentModel.elements];
            resolvedModel.textures = new Map(parentModel.textures);
            resolvedModel.ambientocclusion = parentModel.ambientocclusion;
            resolvedModel.display = { ...parentModel.display, ...resolvedModel.display };
        }

        // 处理当前模型的纹理
        if (modelData.textures) {
            this.resolveTextures(modelData.textures, resolvedModel.textures);
        }

        // 处理元素（如果有的话，会覆盖父模型的元素）
        if (modelData.elements && modelData.elements.length > 0) {
            resolvedModel.elements = this.resolveElements(modelData.elements, resolvedModel.textures);
        }
        // 如果没有元素但有父模型是模板，生成对应的几何体
        else if (modelData.parent && this.isTemplate(modelData.parent)) {
            resolvedModel.elements = this.generateTemplateElements(modelData.parent, resolvedModel.textures);
        }

        return resolvedModel;
    }

    /**
     * 解析纹理引用，处理 #key 引用
     * @param textureData 纹理数据
     * @param targetMap 目标纹理映射
     */
    private resolveTextures(textureData: { [key: string]: string }, targetMap: Map<string, string>): void {
        // 先添加所有直接引用的纹理
        for (const [key, value] of Object.entries(textureData)) {
            if (!value.startsWith('#')) {
                // 直接纹理引用
                const normalizedTexture = this.normalizeTexturePath(value);
                targetMap.set(`#${key}`, normalizedTexture);
            }
        }

        // 解析间接引用（#key 引用其他 #key）
        let maxIterations = 10; // 防止无限循环
        let hasUnresolved = true;

        while (hasUnresolved && maxIterations > 0) {
            hasUnresolved = false;
            maxIterations--;

            for (const [key, value] of Object.entries(textureData)) {
                if (value.startsWith('#')) {
                    const referencedTexture = targetMap.get(value);
                    if (referencedTexture) {
                        targetMap.set(`#${key}`, referencedTexture);
                    } else {
                        hasUnresolved = true;
                    }
                }
            }
        }
    }

    /**
     * 解析元素数据
     * @param elementsData 元素数据数组
     * @param textureMap 纹理映射
     * @returns 解析后的元素数组
     */
    private resolveElements(elementsData: ElementData[], textureMap: Map<string, string>): ResolvedElement[] {
        return elementsData.map(element => this.resolveElement(element, textureMap));
    }

    /**
     * 解析单个元素
     * @param elementData 元素数据
     * @param textureMap 纹理映射
     * @returns 解析后的元素
     */
    private resolveElement(elementData: ElementData, textureMap: Map<string, string>): ResolvedElement {
        const resolvedElement: ResolvedElement = {
            from: elementData.from as [number, number, number],
            to: elementData.to as [number, number, number],
            shade: elementData.shade !== false,
            faces: new Map()
        };

        // 处理旋转
        if (elementData.rotation) {
            resolvedElement.rotation = {
                origin: elementData.rotation.origin as [number, number, number],
                axis: elementData.rotation.axis as 'x' | 'y' | 'z',
                angle: elementData.rotation.angle,
                rescale: elementData.rotation.rescale !== false
            };
        }

        // 处理面
        for (const [faceName, faceData] of Object.entries(elementData.faces)) {
            resolvedElement.faces.set(faceName, this.resolveFace(faceData, textureMap, elementData.from, elementData.to));
        }

        return resolvedElement;
    }

    /**
     * 解析面数据
     * @param faceData 面数据
     * @param textureMap 纹理映射
     * @param from 元素起点
     * @param to 元素终点
     * @returns 解析后的面
     */
    private resolveFace(faceData: FaceData, textureMap: Map<string, string>, from: number[], to: number[]): ResolvedFace {
        // 解析纹理引用
        let texture = textureMap.get(faceData.texture) || faceData.texture;
        if (!texture || texture.startsWith('#')) {
            texture = 'minecraft:block/missing'; // 使用缺失纹理
        }

        // 计算默认UV
        let uv: [number, number, number, number];
        if (faceData.uv) {
            uv = faceData.uv as [number, number, number, number];
        } else {
            // 根据面和元素尺寸自动计算UV
            uv = this.calculateDefaultUV(from, to);
        }

        return {
            uv,
            texture: this.normalizeTexturePath(texture),
            cullface: faceData.cullface,
            rotation: this.normalizeRotation(faceData.rotation || 0),
            tintindex: faceData.tintindex
        };
    }

    /**
     * 生成模板几何体
     * @param templateId 模板ID
     * @param textureMap 纹理映射
     * @returns 元素数组
     */
    private generateTemplateElements(templateId: string, textureMap: Map<string, string>): ResolvedElement[] {
        switch (templateId) {
            case ModelTemplate.CUBE_ALL:
                return this.generateCubeAllElements(textureMap);
            case ModelTemplate.CUBE_COLUMN:
                return this.generateCubeColumnElements(textureMap);
            case ModelTemplate.CROSS:
                return this.generateCrossElements(textureMap);
            default:
                console.warn(`[ModelParser] 不支持的模板: ${templateId}`);
                return this.generateCubeAllElements(textureMap);
        }
    }

    /**
     * 生成 cube_all 几何体（所有面使用相同纹理）
     */
    private generateCubeAllElements(textureMap: Map<string, string>): ResolvedElement[] {
        // 查找#all纹理变量，在纹理映射中key带#前缀
        const texture = textureMap.get('#all') || 'minecraft:block/missing';
        console.log(`[ModelParser] generateCubeAllElements: 使用纹理 ${texture}, textureMap:`, textureMap);
        
        const faces = new Map<string, ResolvedFace>();

        const faceNames = ['north', 'south', 'east', 'west', 'up', 'down'];
        for (const faceName of faceNames) {
            faces.set(faceName, {
                uv: [0, 0, 16, 16],
                texture,
                rotation: 0
            });
        }

        return [{
            from: [0, 0, 0],
            to: [16, 16, 16],
            shade: true,
            faces
        }];
    }

    /**
     * 生成 cube_column 几何体（顶底面和侧面使用不同纹理）
     */
    private generateCubeColumnElements(textureMap: Map<string, string>): ResolvedElement[] {
        const sideTexture = textureMap.get('#side') || 'minecraft:block/missing';
        const endTexture = textureMap.get('#end') || 'minecraft:block/missing';
        console.log(`[ModelParser] generateCubeColumnElements: side=${sideTexture}, end=${endTexture}`);
        
        const faces = new Map<string, ResolvedFace>();
        
        // 侧面
        ['north', 'south', 'east', 'west'].forEach(faceName => {
            faces.set(faceName, {
                uv: [0, 0, 16, 16],
                texture: sideTexture,
                rotation: 0
            });
        });

        // 顶底面
        ['up', 'down'].forEach(faceName => {
            faces.set(faceName, {
                uv: [0, 0, 16, 16],
                texture: endTexture,
                rotation: 0
            });
        });

        return [{
            from: [0, 0, 0],
            to: [16, 16, 16],
            shade: true,
            faces
        }];
    }

    /**
     * 生成 cross 几何体（两个交叉的平面）
     */
    private generateCrossElements(textureMap: Map<string, string>): ResolvedElement[] {
        const texture = textureMap.get('#cross') || 'minecraft:block/missing';
        console.log(`[ModelParser] generateCrossElements: 使用纹理 ${texture}`);

        return [
            // 第一个平面 (从 NW 到 SE)
            {
                from: [0.8, 0, 8],
                to: [15.2, 16, 8],
                shade: false,
                faces: new Map([
                    ['north', { uv: [0, 0, 16, 16], texture, rotation: 0 }],
                    ['south', { uv: [0, 0, 16, 16], texture, rotation: 0 }]
                ])
            },
            // 第二个平面 (从 NE 到 SW)
            {
                from: [8, 0, 0.8],
                to: [8, 16, 15.2],
                shade: false,
                faces: new Map([
                    ['west', { uv: [0, 0, 16, 16], texture, rotation: 0 }],
                    ['east', { uv: [0, 0, 16, 16], texture, rotation: 0 }]
                ])
            }
        ];
    }

    /**
     * 计算默认UV坐标
     */
    private calculateDefaultUV(from: number[], to: number[]): [number, number, number, number] {
        return [0, 0, 16, 16]; // 简化实现，使用全纹理
    }

    /**
     * 标准化纹理路径
     */
    private normalizeTexturePath(texturePath: string): string {
        if (texturePath.includes(':')) {
            return texturePath;
        }
        return `minecraft:block/${texturePath}`;
    }

    /**
     * 标准化旋转角度
     */
    private normalizeRotation(rotation: number): number {
        const validRotations = [0, 90, 180, 270];
        return validRotations.includes(rotation) ? rotation : 0;
    }

    /**
     * 检查是否为内置模板
     */
    private isTemplate(modelId: string): boolean {
        return Object.values(ModelTemplate).includes(modelId as ModelTemplate);
    }

    /**
     * 创建降级模型（紫黑方格立方体）
     */
    private createFallbackModel(): ResolvedModel {
        return {
            elements: this.generateCubeAllElements(new Map([['#all', 'minecraft:block/missing']])),
            textures: new Map([['#all', 'minecraft:block/missing']]),
            ambientocclusion: true,
            display: {}
        };
    }

    /**
     * 清除缓存
     */
    clearCache(): void {
        this.modelCache.clear();
    }

    /**
     * 获取缓存统计
     */
    getCacheStats(): { size: number; keys: string[] } {
        return {
            size: this.modelCache.size,
            keys: Array.from(this.modelCache.keys())
        };
    }
}