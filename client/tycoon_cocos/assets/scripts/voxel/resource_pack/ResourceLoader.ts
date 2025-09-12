/**
 * Resource Pack 资源加载器
 */

import { resources, JsonAsset, Texture2D } from 'cc';
import { BlockStateData, ModelData, ResourceCache } from './types';

export class ResourceLoader {
    private rootDir: string;
    private searchRoots: string[];
    private cache: ResourceCache;
    
    constructor(rootDir: string = 'voxel/resource_pack', searchRoots?: string[]) {
        this.rootDir = rootDir;
        this.searchRoots = searchRoots || [rootDir];
        this.cache = {
            blockstates: new Map(),
            models: new Map(),
            textures: new Map()
        };
    }
    
    /**
     * 从搜索根目录加载 JSON 资源
     * @param relPath 相对路径
     * @returns JSON 数据和元信息
     */
    async loadJsonFromRoots(relPath: string): Promise<{ json: any; rel: string; foundRootIndex: number } | null> {
        for (let i = 0; i < this.searchRoots.length; i++) {
            const root = this.searchRoots[i];
            const fullPath = `${root}/${relPath}`;
            // console.log('root:', root);
            // console.log('relPath:', relPath);
            // console.log('fullPath:', fullPath);
            
            try {
                const json = await this.loadJson(fullPath);
                if (json) {
                    return {
                        json,
                        rel: relPath,
                        foundRootIndex: i
                    };
                }
            } catch (error) {
                // 继续尝试下一个根目录
                continue;
            }
        }
        
        console.warn(`[ResourceLoader] 未找到资源: ${relPath}`);
        return null;
    }
    
    /**
     * 加载 JSON 资源
     * @param path 资源路径（不含 .json 后缀）
     * @returns JSON 数据
     */
    private async loadJson(path: string): Promise<any> {
        // 去掉可能的 .json 后缀
        if (path.endsWith('.json')) {
            path = path.substring(0, path.length - 5);
        }
        
        return new Promise((resolve, reject) => {
            // console.log('loadJson, path:', path);
            resources.load(path, JsonAsset, (err, asset) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(asset.json);
            });
        });
    }
    
    /**
     * 加载 BlockState
     * @param ns 命名空间
     * @param name 方块名称
     * @returns BlockState 数据
     */
    async loadBlockState(ns: string, name: string): Promise<BlockStateData | null> {
        const cacheKey = `${ns}:${name}`;
        
        // 检查缓存
        if (this.cache.blockstates.has(cacheKey)) {
            return this.cache.blockstates.get(cacheKey)!;
        }
        
        const relPath = `assets/${ns}/blockstates/${name}.json`;
        const result = await this.loadJsonFromRoots(relPath);
        
        if (result) {
            this.cache.blockstates.set(cacheKey, result.json);
            return result.json;
        }
        
        return null;
    }
    
    /**
     * 加载 Model
     * @param ns 命名空间
     * @param domain 域（如 'block', 'item'）
     * @param name 模型名称
     * @returns Model 数据
     */
    async loadModel(ns: string, domain: string, name: string): Promise<ModelData | null> {
        const cacheKey = `${ns}:${domain}/${name}`;
        
        // 检查缓存
        if (this.cache.models.has(cacheKey)) {
            return this.cache.models.get(cacheKey)!;
        }
        
        const relPath = `assets/${ns}/models/${domain}/${name}.json`;
        const result = await this.loadJsonFromRoots(relPath);
        
        if (result) {
            this.cache.models.set(cacheKey, result.json);
            return result.json;
        }
        
        return null;
    }
    
    /**
     * 加载纹理
     * @param ns 命名空间
     * @param domain 域（如 'block', 'item'）
     * @param name 纹理名称
     * @returns 纹理对象
     */
    async loadTexture(ns: string, domain: string, name: string): Promise<Texture2D | null> {
        const cacheKey = `${ns}:${domain}/${name}`;
        
        // 检查缓存中是否有路径
        let texturePath = this.cache.textures.get(cacheKey);
        
        if (!texturePath) {
            // 构建纹理路径
            texturePath = `${this.rootDir}/assets/${ns}/textures/${domain}/${name}`;
            this.cache.textures.set(cacheKey, texturePath);
        }
        
        return new Promise((resolve) => {
            // 加载纹理，需要添加 /texture 后缀
            resources.load(texturePath + '/texture', Texture2D, (err, texture) => {
                if (err) {
                    console.warn(`[ResourceLoader] 纹理加载失败: ${texturePath}`, err);
                    resolve(null);
                    return;
                }
                
                // 设置最近邻采样
                texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
                resolve(texture);
            });
        });
    }
    
    /**
     * 检查资源是否存在
     * @param relPath 相对路径
     * @returns 是否存在
     */
    async checkResourceExists(relPath: string): Promise<boolean> {
        for (const root of this.searchRoots) {
            const fullPath = `${root}/${relPath}`;
            
            try {
                // 尝试加载资源来检查是否存在
                const exists = await new Promise<boolean>((resolve) => {
                    resources.load(fullPath, (err) => {
                        resolve(!err);
                    });
                });
                
                if (exists) {
                    return true;
                }
            } catch {
                continue;
            }
        }
        
        return false;
    }
    
    /**
     * 清除缓存
     */
    clearCache(): void {
        this.cache.blockstates.clear();
        this.cache.models.clear();
        this.cache.textures.clear();
    }
    
    /**
     * 获取缓存统计
     */
    getCacheStats(): { blockstates: number; models: number; textures: number } {
        return {
            blockstates: this.cache.blockstates.size,
            models: this.cache.models.size,
            textures: this.cache.textures.size
        };
    }
    
    /**
     * 设置搜索根目录
     * @param roots 搜索根目录列表
     */
    setSearchRoots(roots: string[]): void {
        this.searchRoots = roots;
    }
    
    /**
     * 获取根目录
     */
    getRootDir(): string {
        return this.rootDir;
    }
    
    /**
     * 获取搜索根目录
     */
    getSearchRoots(): string[] {
        return [...this.searchRoots];
    }
}