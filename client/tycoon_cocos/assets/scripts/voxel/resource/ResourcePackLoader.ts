import { resources } from 'cc';
import { JsonAsset, Texture2D } from 'cc';

export interface ResourceIndex {
    blockstates: Map<string, BlockStateData>;
    models: Map<string, ModelData>;
    textures: Map<string, string>; // key -> resource path
}

export interface BlockStateData {
    variants: { [key: string]: BlockStateVariant | BlockStateVariant[] };
}

export interface BlockStateVariant {
    model: string;
    x?: number;
    y?: number;
    z?: number;
    uvlock?: boolean;
    weight?: number;
}

export interface ModelData {
    parent?: string;
    ambientocclusion?: boolean;
    display?: { [key: string]: any };
    textures?: { [key: string]: string };
    elements?: ElementData[];
}

export interface ElementData {
    from: number[];
    to: number[];
    rotation?: {
        origin: number[];
        axis: string;
        angle: number;
        rescale?: boolean;
    };
    shade?: boolean;
    faces: { [face: string]: FaceData };
}

export interface FaceData {
    uv?: number[];
    texture: string;
    cullface?: string;
    rotation?: number;
    tintindex?: number;
}

export class ResourcePackLoader {
    private resourcePackPath: string;
    private index: ResourceIndex;
    private loaded: boolean = false;

    constructor(resourcePackPath: string = 'voxel/default') {
        this.resourcePackPath = resourcePackPath;
        this.index = {
            blockstates: new Map(),
            models: new Map(),
            textures: new Map()
        };
    }

    async load(): Promise<ResourceIndex> {
        if (this.loaded) {
            return this.index;
        }

        console.log('[ResourcePackLoader] 开始加载资源包:', this.resourcePackPath);

        try {
            await this.loadBlockStates();
            await this.loadModels();
            await this.indexTextures();
            
            this.loaded = true;
            console.log('[ResourcePackLoader] 资源包加载完成');
            console.log('- BlockStates:', this.index.blockstates.size);
            console.log('- Models:', this.index.models.size);
            console.log('- Textures:', this.index.textures.size);
            
            return this.index;
        } catch (error) {
            console.error('[ResourcePackLoader] 资源包加载失败:', error);
            throw error;
        }
    }

    private async loadBlockStates(): Promise<void> {
        const blockstateNames = [
            'stone', 'oak_log', 'oak_planks', 'grass_block', 'dirt',
            'sand', 'cobblestone', 'glass', 'oak_leaves',
            'dandelion', 'poppy', 'short_grass', 'fern'
        ];

        for (const name of blockstateNames) {
            try {
                const path = `${this.resourcePackPath}/assets/minecraft/blockstates/${name}`;
                const jsonAsset = await this.loadJsonAsset(path);
                if (jsonAsset) {
                    this.index.blockstates.set(`minecraft:${name}`, jsonAsset);
                    console.log(`[ResourcePackLoader] 已加载 blockstate: minecraft:${name}`);
                }
            } catch (error) {
                console.warn(`[ResourcePackLoader] 无法加载 blockstate: ${name}`, error);
            }
        }
    }

    private async loadModels(): Promise<void> {
        // 加载基础模板模型
        const templateModels = [
            'cube_all', 'cube_column', 'cross', 'cube',
            'cube_bottom_top', 'orientable', 'orientable_with_bottom', 'cube_column_horizontal'
        ];

        for (const template of templateModels) {
            try {
                const path = `${this.resourcePackPath}/assets/minecraft/models/block/${template}`;
                const jsonAsset = await this.loadJsonAsset(path);
                if (jsonAsset) {
                    this.index.models.set(`minecraft:block/${template}`, jsonAsset);
                }
            } catch (error) {
                console.warn(`[ResourcePackLoader] 无法加载模板模型: ${template}`);
            }
        }

        // 加载具体方块模型
        const blockModels = [
            'stone', 'stone_mirrored', 'oak_log', 'oak_log_horizontal', 'oak_planks', 'grass_block',
            'dirt', 'sand', 'cobblestone', 'glass', 'oak_leaves',
            'dandelion', 'poppy', 'short_grass', 'fern'
        ];

        for (const model of blockModels) {
            try {
                const path = `${this.resourcePackPath}/assets/minecraft/models/block/${model}`;
                const jsonAsset = await this.loadJsonAsset(path);
                if (jsonAsset) {
                    this.index.models.set(`minecraft:block/${model}`, jsonAsset);
                    console.log(`[ResourcePackLoader] 已加载 model: minecraft:block/${model}`);
                }
            } catch (error) {
                console.warn(`[ResourcePackLoader] 无法加载模型: ${model}`, error);
            }
        }
    }

    private async indexTextures(): Promise<void> {
        // 基于已加载的 models 解析并建立纹理索引
        let count = 0;
        this.index.textures.clear();

        this.index.models.forEach((model, modelId) => {
            if (!model || !model.textures) return;

            // 1) 为每个 textures 条目建立直达索引
            for (const [key, value] of Object.entries(model.textures)) {
                const fullTexId = this.normalizeTextureId(value); // e.g. minecraft:block/grass_block_top
                const tailName = fullTexId.replace('minecraft:block/', '');
                const resourcePath = `${this.resourcePackPath}/assets/minecraft/textures/block/${tailName}`;
                if (!this.index.textures.has(fullTexId)) {
                    this.index.textures.set(fullTexId, resourcePath);
                    count++;
                }

                // 2) 方便通过 "模型名_键" 访问（例如 grass_block_top）
                const modelName = modelId.replace('minecraft:block/', '');
                const aliasId = `minecraft:block/${modelName}_${key}`;
                if (!this.index.textures.has(aliasId)) {
                    this.index.textures.set(aliasId, resourcePath);
                    count++;
                }
            }

            // 3) 给模型名本身增加聚合别名（选择一个合理默认：side > top > all > 任意一项）
            const aggregateId = modelId; // e.g. minecraft:block/grass_block
            if (!this.index.textures.has(aggregateId)) {
                const preferred = this.pickPreferredTexture(model.textures);
                if (preferred) {
                    const fullTexId = this.normalizeTextureId(preferred);
                    const tailName = fullTexId.replace('minecraft:block/', '');
                    const resourcePath = `${this.resourcePackPath}/assets/minecraft/textures/block/${tailName}`;
                    this.index.textures.set(aggregateId, resourcePath);
                    count++;
                }
            }
        });

        console.log(`[ResourcePackLoader] 已解析并索引纹理: ${count}`);
    }

    /** 将多种写法规范化为 minecraft:block/<name> */
    private normalizeTextureId(value: string): string {
        if (!value) return 'minecraft:block/missingno';
        // 去掉可能的前缀 '#'
        if (value.startsWith('#')) {
            // 此类引用应由调用方用别名解析，这里简单返回去掉 '#'
            value = value.substring(1);
        }
        // 常见写法："minecraft:block/xxx" | "block/xxx" | "minecraft:xxx" | "xxx"
        if (value.startsWith('minecraft:block/')) return value;
        if (value.startsWith('block/')) return `minecraft:block/${value.substring('block/'.length)}`;
        if (value.startsWith('minecraft:')) return `minecraft:block/${value.substring('minecraft:'.length)}`;
        return `minecraft:block/${value}`;
    }

    /** 选择一个最合适的聚合贴图（side > top > all > 第一个）*/
    private pickPreferredTexture(textures: { [key: string]: string } | undefined): string | null {
        if (!textures) return null;
        const order = ['side', 'top', 'all', 'front', 'north', 'east', 'south', 'west', 'up', 'down'];
        for (const k of order) {
            if (textures[k]) return textures[k];
        }
        const firstKey = Object.keys(textures)[0];
        return firstKey ? textures[firstKey] : null;
    }

    private async loadJsonAsset(path: string): Promise<any> {
        return new Promise((resolve, reject) => {
            resources.load(path, JsonAsset, (err, asset) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(asset.json);
            });
        });
    }

    async loadTexture(texturePath: string): Promise<Texture2D | null> {
        const resourcePath = this.index.textures.get(texturePath);
        if (!resourcePath) {
            console.warn(`[ResourcePackLoader] 纹理路径未找到: ${texturePath}`);
            return null;
        }

        //https://docs.cocos.com/creator/3.8/manual/zh/asset/dynamic-load-resources.html#%E5%8A%A0%E8%BD%BD-spriteframe-%E6%88%96-texture2d
        //图片设置为 sprite-frame 或 texture 或其他图片类型后，将会在 资源管理器 中生成一个对应类型的资源。但如果直接加载 test_assets/image，得到的类型将会是 ImageAsset。你必须指定路径到具体的子资源
        // 即添加后缀 /texture 或者 /spriteFrame
        return new Promise((resolve, reject) => {
            resources.load(resourcePath + '/texture', Texture2D, (err, texture) => {
                if (err) {
                    console.warn(`[ResourcePackLoader] 纹理加载失败: ${resourcePath}`, err);
                    resolve(null);
                    return;
                }
                
                // 设置最近邻采样
                texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
                resolve(texture);
            });
        });
    }

    getBlockState(blockId: string): BlockStateData | undefined {
        return this.index.blockstates.get(blockId);
    }

    getModel(modelId: string): ModelData | undefined {
        return this.index.models.get(modelId);
    }

    hasTexture(texturePath: string): boolean {
        return this.index.textures.has(texturePath);
    }

    isLoaded(): boolean {
        return this.loaded;
    }

    getResourceIndex(): ResourceIndex {
        return this.index;
    }
}

// 全局单例
let globalResourcePackLoader: ResourcePackLoader | null = null;

export function getGlobalResourcePackLoader(): ResourcePackLoader {
    if (!globalResourcePackLoader) {
        globalResourcePackLoader = new ResourcePackLoader();
    }
    return globalResourcePackLoader;
}