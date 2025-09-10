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
    // （已弃用）目录全量扫描，启动慢。改为仅按需解析与懒索引。
    // private fullScan: boolean = false;

    constructor(resourcePackPath: string = 'voxel/default', _options?: { fullScan?: boolean }) {
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
            // 加载 minecraft 资源
            await this.loadBlockStates();
            await this.loadModels();
            
            // 加载 web3 资源包
            await this.loadWeb3Resources();
            
            // 索引所有纹理
            await this.indexTextures();
            // 扫描纹理目录以补全索引（特别是 web3 纹理）
            await this.indexTexturesFromDirectory();
            
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
        // 精简：不扫描目录，仅加载常用列表，减少启动开销
        const common = [
            'stone', 'oak_log', 'oak_planks', 'grass_block', 'dirt',
            'sand', 'cobblestone', 'glass', 'oak_leaves',
            'dandelion', 'poppy', 'short_grass', 'fern', 'glowstone'
        ];
        for (const name of common) {
            await this.tryLoadBlockStateByName(name);
        }
    }

    private async tryLoadBlockStateByName(name: string): Promise<void> {
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

    /**
     * 加载 Web3 资源包
     */
    private async loadWeb3Resources(): Promise<void> {
        console.log('[ResourcePackLoader] 开始加载 Web3 资源包');
        
        // Web3 方块列表
        const web3Blocks = [
            'empty_land', 'property', 'hospital', 'chance', 
            'bonus', 'fee', 'card', 'news',
            'land_god', 'wealth_god', 'fortune_god', 
            'dog', 'poverty_god', 'roadblock', 'bomb'
        ];
        
        // 加载 blockstates
        for (const name of web3Blocks) {
            await this.tryLoadWeb3BlockState(name);
        }
        
        // 加载 models
        for (const name of web3Blocks) {
            await this.tryLoadWeb3Model(name);
        }
        
        console.log('[ResourcePackLoader] Web3 资源包加载完成');
    }
    
    private async tryLoadWeb3BlockState(name: string): Promise<void> {
        try {
            const path = `voxel/web3/assets/web3/blockstates/${name}`;
            const jsonAsset = await this.loadJsonAsset(path);
            if (jsonAsset) {
                this.index.blockstates.set(`web3:${name}`, jsonAsset);
                console.log(`[ResourcePackLoader] 已加载 Web3 blockstate: web3:${name}`);
            }
        } catch (error) {
            console.warn(`[ResourcePackLoader] 无法加载 Web3 blockstate: ${name}`, error);
        }
    }
    
    private async tryLoadWeb3Model(name: string): Promise<void> {
        try {
            const path = `voxel/web3/assets/web3/models/block/${name}`;
            const jsonAsset = await this.loadJsonAsset(path);
            if (jsonAsset) {
                this.index.models.set(`web3:block/${name}`, jsonAsset);
                console.log(`[ResourcePackLoader] 已加载 Web3 model: web3:block/${name}`);
            }
        } catch (error) {
            console.warn(`[ResourcePackLoader] 无法加载 Web3 model: ${name}`, error);
        }
    }

    private async loadModels(): Promise<void> {
        // 精简：不扫描目录，仅加载常用模板与常用方块模型
        const templates = [
            'cube_all', 'cube_column', 'cross', 'cube',
            'cube_bottom_top', 'orientable', 'orientable_with_bottom', 'cube_column_horizontal',
            'block', 'leaves', 'tinted_cross'
        ];
        const commons = [
            'stone', 'stone_mirrored', 'oak_log', 'oak_log_horizontal', 'oak_planks', 'grass_block',
            'dirt', 'sand', 'cobblestone', 'glass', 'oak_leaves', 'dandelion', 'poppy', 'short_grass', 'fern',
            'glowstone'
        ];
        for (const name of [...templates, ...commons]) {
            await this.tryLoadModelByName(name);
        }
    }

    private async tryLoadModelByName(name: string): Promise<void> {
        try {
            const path = `${this.resourcePackPath}/assets/minecraft/models/block/${name}`;
            const jsonAsset = await this.loadJsonAsset(path);
            if (jsonAsset) {
                this.index.models.set(`minecraft:block/${name}`, jsonAsset);
                console.log(`[ResourcePackLoader] 已加载 model: minecraft:block/${name}`);
            }
        } catch (error) {
            console.warn(`[ResourcePackLoader] 无法加载模型: ${name}`, error);
        }
    }

    private async indexTextures(): Promise<void> {
        // 基于已加载的 models 解析并建立纹理索引
        let count = 0;
        this.index.textures.clear();

        this.index.models.forEach((model, modelId) => {
            if (!model || !model.textures) return;

            // 1) 为每个 textures 条目建立直达索引
            for (const key in model.textures) {
                if (!Object.prototype.hasOwnProperty.call(model.textures, key)) continue;
                const value = (model.textures as any)[key];
                const fullTexId = this.normalizeTextureId(value); // e.g. minecraft:block/grass_block_top 或 web3:block/empty_land
                
                // 解析命名空间和路径
                const colonIndex = fullTexId.indexOf(':');
                const namespace = colonIndex > 0 ? fullTexId.substring(0, colonIndex) : 'minecraft';
                const pathAfterNamespace = fullTexId.substring(colonIndex + 1);
                const tailName = pathAfterNamespace.replace('block/', '');
                
                // 根据命名空间构建正确的资源路径
                const resourcePath = namespace === 'web3'
                    ? `voxel/web3/assets/web3/textures/block/${tailName}`
                    : `${this.resourcePackPath}/assets/${namespace}/textures/block/${tailName}`;
                
                if (!this.index.textures.has(fullTexId)) {
                    this.index.textures.set(fullTexId, resourcePath);
                    // 额外添加常见别名，避免路径不规范导致找不到
                    this.index.textures.set(tailName, resourcePath);
                    this.index.textures.set(`block/${tailName}`, resourcePath);
                    this.index.textures.set(`${namespace}:${tailName}`, resourcePath);
                    count++;
                }

                // 2) 方便通过 "模型名_键" 访问（例如 grass_block_top）
                const modelNamespaceIndex = modelId.indexOf(':');
                const modelNamespace = modelNamespaceIndex > 0 ? modelId.substring(0, modelNamespaceIndex) : 'minecraft';
                const modelPath = modelId.substring(modelNamespaceIndex + 1);
                const modelName = modelPath.replace('block/', '');
                const aliasId = `${modelNamespace}:block/${modelName}_${key}`;
                if (!this.index.textures.has(aliasId)) {
                    this.index.textures.set(aliasId, resourcePath);
                    count++;
                }
            }

            // 3) 给模型名本身增加聚合别名（选择一个合理默认：side > top > all > 任意一项）
            const aggregateId = modelId; // e.g. minecraft:block/grass_block 或 web3:block/empty_land
            if (!this.index.textures.has(aggregateId)) {
                const preferred = this.pickPreferredTexture(model.textures);
                if (preferred) {
                    const fullTexId = this.normalizeTextureId(preferred);
                    // 解析命名空间
                    const colonIndex = fullTexId.indexOf(':');
                    const namespace = colonIndex > 0 ? fullTexId.substring(0, colonIndex) : 'minecraft';
                    const pathAfterNamespace = fullTexId.substring(colonIndex + 1);
                    const tailName = pathAfterNamespace.replace('block/', '');
                    
                    // 根据命名空间构建正确的资源路径
                    const resourcePath = namespace === 'web3'
                        ? `voxel/web3/assets/web3/textures/block/${tailName}`
                        : `${this.resourcePackPath}/assets/${namespace}/textures/block/${tailName}`;
                        
                    this.index.textures.set(aggregateId, resourcePath);
                    count++;
                }
            }
        });

        console.log(`[ResourcePackLoader] 已解析并索引纹理: ${count}`);
    }

    /** 扫描纹理目录，补全所有可用纹理索引（包括 overlay 等未被模型直接引用的项） */
    private async indexTexturesFromDirectory(): Promise<void> {
        // 扫描 minecraft 纹理
        await this.indexTexturesFromNamespace('minecraft');
        // 扫描 web3 纹理
        await this.indexTexturesFromNamespace('web3');
    }
    
    private async indexTexturesFromNamespace(namespace: string): Promise<void> {
        const dir = namespace === 'minecraft' 
            ? `${this.resourcePackPath}/assets/${namespace}/textures/block`
            : `voxel/web3/assets/${namespace}/textures/block`;
            
        const dirInfo: any = (resources as any).getDirWithPath ? (resources as any).getDirWithPath(dir) : null;
        const paths: string[] = Array.isArray(dirInfo) ? dirInfo.map((i: any) => i.path) : (dirInfo?.paths || []);
        let added = 0;

        for (let p of paths) {
            // 目录扫描可能返回子资源（/texture 或 /spriteFrame），统一回退到基路径
            p = this.normalizeBaseResourcePath(p);
            const name = p.split('/').pop()!; // e.g. grass_block_side_overlay 或 empty_land
            const resourcePath = `${dir}/${name}`;
            const fullKey = `${namespace}:block/${name}`;
            if (!this.index.textures.has(fullKey)) {
                this.index.textures.set(fullKey, resourcePath);
                this.index.textures.set(name, resourcePath);
                this.index.textures.set(`block/${name}`, resourcePath);
                this.index.textures.set(`${namespace}:${name}`, resourcePath);
                added++;
            }
        }

        if (added > 0) {
            console.log(`[ResourcePackLoader] ${namespace} 纹理目录索引补全: +${added}`);
        }
    }

    /** 将多种写法规范化为 namespace:block/<name> */
    private normalizeTextureId(value: string): string {
        if (!value) return 'minecraft:block/missingno';
        // 去掉可能的前缀 '#'
        if (value.startsWith('#')) {
            // 此类引用应由调用方用别名解析，这里简单返回去掉 '#'
            value = value.substring(1);
        }
        
        // 支持 web3 命名空间
        if (value.startsWith('web3:block/')) return value;
        if (value.startsWith('web3:')) {
            return `web3:block/${value.substring('web3:'.length)}`;
        }
        
        // 支持其他自定义命名空间（格式：namespace:xxx）
        const colonIndex = value.indexOf(':');
        if (colonIndex > 0 && colonIndex < value.length - 1) {
            const namespace = value.substring(0, colonIndex);
            const path = value.substring(colonIndex + 1);
            // 如果已经包含 block/ 路径，直接返回
            if (path.startsWith('block/')) {
                return value;
            }
            // 否则添加 block/ 路径
            return `${namespace}:block/${path}`;
        }
        
        // 默认使用 minecraft 命名空间
        if (value.startsWith('block/')) return `minecraft:block/${value.substring('block/'.length)}`;
        return `minecraft:block/${value}`;
    }

    /**
     * 规范化目录项路径，去掉末尾的子资源后缀（如 /texture, /spriteFrame）
     */
    private normalizeBaseResourcePath(path: string): string {
        if (!path) return path;
        if (path.endsWith('/texture') || path.endsWith('/spriteFrame')) {
            return path.substring(0, path.lastIndexOf('/'));
        }
        return path;
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
        // 归一化查询键，并为常见写法提供容错
        const normalized = this.normalizeTextureId(texturePath);
        
        // 尝试多种格式查找纹理
        const resourcePath = this.index.textures.get(normalized)
            || this.index.textures.get(texturePath)
            || this.index.textures.get(texturePath.replace(/^web3:/, 'web3:block/'))
            || this.index.textures.get(texturePath.replace(/^minecraft:/, 'minecraft:block/'))
            || this.index.textures.get(texturePath.replace(/^block\//, 'minecraft:block/'))
            || this.index.textures.get(texturePath.replace(/^minecraft:block\//, 'minecraft:block/'))
            || this.index.textures.get(texturePath.replace(/^web3:block\//, 'web3:block/'));
            
        if (!resourcePath) {
            console.warn(`[ResourcePackLoader] 纹理路径未找到: ${texturePath} (normalized: ${normalized})`);
            // 列出可用的纹理键帮助调试
            if (texturePath.startsWith('web3:')) {
                console.log('[ResourcePackLoader] 可用的 web3 纹理:');
                this.index.textures.forEach((value, key) => {
                    if (key.startsWith('web3:')) {
                        console.log(`  - ${key} => ${value}`);
                    }
                });
            }
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