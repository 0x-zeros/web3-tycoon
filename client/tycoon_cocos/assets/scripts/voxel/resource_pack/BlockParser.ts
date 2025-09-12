/**
 * 核心方块解析器
 */

import { 
    ParsedBlockData, 
    NamespacedId, 
    TextureInfo, 
    ElementDef,
    ElementFace,
    ModelElement,
    ModelFace,
    CombinedJson,
    ParseOptions
} from './types';
import { 
    parseNamespacedId, 
    parseModelOrTexRef, 
    normalizeTexturePath,
    pickDefaultVariant,
    mergeTextures,
    buildResourcePath
} from './utils';
import { ResourceLoader } from './ResourceLoader';
import { TemplateProcessor } from './TemplateProcessor';

export class BlockParser {
    private loader: ResourceLoader;
    private options: ParseOptions;
    
    constructor(options?: ParseOptions) {
        this.options = {
            rootDir: options?.rootDir || 'voxel/resource_pack',
            searchRoots: options?.searchRoots || [],
            defaultNamespace: options?.defaultNamespace || 'minecraft'
        };
        
        // 设置搜索根目录
        if (this.options.searchRoots.length === 0) {
            this.options.searchRoots = [this.options.rootDir];
        }
        
        this.loader = new ResourceLoader(this.options.rootDir, this.options.searchRoots);
    }
    
    /**
     * 解析方块
     * @param blockId 方块ID
     * @returns 解析后的方块数据
     */
    async parseBlock(blockId: string): Promise<ParsedBlockData> {
        console.log(`[BlockParser] 开始解析方块: ${blockId}`);
        
        // 1. 解析命名空间ID
        const id = parseNamespacedId(blockId, this.options.defaultNamespace);
        const shortId = id.path;
        
        // 2. 加载 blockstate
        const blockstateResult = await this.loadBlockState(id);
        
        // 3. 选择变体
        let modelRef = 'minecraft:block/cube_all';
        let rotationY: 0 | 90 | 180 | 270 = 0;
        
        if (blockstateResult?.json) {
            const variantInfo = pickDefaultVariant(blockstateResult.json.variants);
            if (variantInfo) {
                modelRef = variantInfo.variant.model || modelRef;
                rotationY = variantInfo.variant.y || 0;
            }
        }
        
        // 4. 解析模型链
        const modelChainResult = await this.resolveModelChain(modelRef, id.ns);
        const { modelChain, texturesDict } = modelChainResult;
        
        // 5. 解析纹理
        const resolvedTextures = await this.resolveTextures(texturesDict, id.ns);
        
        // 6. 生成元素
        const template = TemplateProcessor.detectTemplate(modelChain);
        let elements: ElementDef[] = [];
        
        if (modelChain.length > 0 && modelChain[0].json?.elements) {
            // 使用自定义元素
            elements = this.normalizeElements(modelChain[0].json.elements, resolvedTextures);
        } else {
            // 使用模板生成
            elements = TemplateProcessor.synthesizeElementsByTemplate(template, resolvedTextures);
        }
        
        // 7. 收集纹理列表
        const textures = Object.values(resolvedTextures);
        
        // 8. 构建调试信息
        const combinedJson: CombinedJson = {
            blockstate: blockstateResult?.json,
            models: modelChain,
            texturesDict,
            resolvedTextures
        };
        
        // 9. 返回结果
        const result: ParsedBlockData = {
            id,
            shortId,
            rotationY,
            modelTemplate: template as any,
            elements,
            textures,
            debug: {
                blockstatePath: blockstateResult?.rel,
                modelChainPaths: modelChain.map(m => m.rel),
                combinedJson
            }
        };
        
        console.log(`[BlockParser] 解析完成: ${blockId}`, {
            template,
            textureCount: textures.length,
            elementCount: elements.length
        });
        
        return result;
    }
    
    /**
     * 加载 blockstate
     */
    private async loadBlockState(id: NamespacedId): Promise<{ json: any; rel: string } | null> {
        const rel = buildResourcePath(id.ns, 'blockstates', null, id.path);
        const result = await this.loader.loadJsonFromRoots(rel);
        
        if (result) {
            return { json: result.json, rel: result.rel };
        }
        
        console.warn(`[BlockParser] BlockState 未找到: ${id.ns}:${id.path}`);
        return null;
    }
    
    /**
     * 解析模型继承链
     */
    private async resolveModelChain(
        initialModelRef: string, 
        initialNs: string
    ): Promise<{ modelChain: any[]; texturesDict: Record<string, string> }> {
        const modelChain: any[] = [];
        const texturesDict: Record<string, string> = {};
        const visited = new Set<string>();
        
        let currentNs = initialNs;
        let modelRef: string | undefined = initialModelRef;
        
        while (modelRef) {
            // 防止循环引用
            if (visited.has(modelRef)) {
                console.warn(`[BlockParser] 检测到循环引用: ${modelRef}`);
                break;
            }
            visited.add(modelRef);
            
            // 解析模型引用
            const info = parseModelOrTexRef(modelRef, currentNs, 'model');
            
            // 处理内置模型
            if (info.builtin) {
                modelChain.push({
                    rel: `builtin:${info.name}`,
                    ns: 'builtin',
                    json: { parent: `builtin/${info.name}` }
                });
                
                // 某些内置模型可以映射到实际模型
                const resolvedBuiltin = TemplateProcessor.resolveBuiltin(info.name);
                if (resolvedBuiltin) {
                    modelRef = resolvedBuiltin;
                    currentNs = 'minecraft';
                    continue;
                } else {
                    break;
                }
            }
            
            // 加载模型
            const modelRel = buildResourcePath(info.ns, 'models', info.domain || 'block', info.name);
            const modelData = await this.loader.loadJsonFromRoots(modelRel);
            
            if (!modelData) {
                console.warn(`[BlockParser] 模型未找到: ${modelRel}`);
                break;
            }
            
            modelChain.push({
                rel: modelRel,
                ns: info.ns,
                json: modelData.json
            });
            
            // 合并纹理（子级覆盖父级）
            if (modelData.json.textures) {
                Object.assign(texturesDict, modelData.json.textures);
            }
            
            // 继续处理父模型
            modelRef = modelData.json.parent;
            currentNs = info.ns;
        }
        
        return { modelChain, texturesDict };
    }
    
    /**
     * 解析纹理映射
     */
    private async resolveTextures(
        texturesDict: Record<string, string>,
        currentNs: string
    ): Promise<Record<string, TextureInfo>> {
        const resolved: Record<string, TextureInfo> = {};
        const maxIterations = 10;
        
        // 第一遍：解析直接引用
        for (const [key, value] of Object.entries(texturesDict)) {
            if (!value.startsWith('#')) {
                const textureInfo = await this.resolveTextureRef(value, currentNs);
                resolved[key] = textureInfo;
            }
        }
        
        // 多次迭代解析变量引用
        for (let i = 0; i < maxIterations; i++) {
            let hasUnresolved = false;
            
            for (const [key, value] of Object.entries(texturesDict)) {
                if (value.startsWith('#')) {
                    const refKey = value.substring(1);
                    if (resolved[refKey]) {
                        resolved[key] = { ...resolved[refKey], key };
                    } else if (texturesDict[refKey] && !texturesDict[refKey].startsWith('#')) {
                        // 尝试解析引用的纹理
                        const textureInfo = await this.resolveTextureRef(texturesDict[refKey], currentNs);
                        resolved[key] = { ...textureInfo, key };
                    } else {
                        hasUnresolved = true;
                    }
                }
            }
            
            if (!hasUnresolved) break;
        }
        
        return resolved;
    }
    
    /**
     * 解析单个纹理引用
     */
    private async resolveTextureRef(value: string, currentNs: string): Promise<TextureInfo> {
        const info = parseModelOrTexRef(value, currentNs, 'texture');
        const ns = info.ns || currentNs;
        const domain = info.domain || 'block';
        const name = info.name;
        
        // 构建相对路径
        const rel = buildResourcePath(ns, 'textures', domain, name);
        
        // 检查资源是否存在
        const exists = await this.loader.checkResourceExists(rel);
        
        return {
            key: '',
            id: `${ns}:${domain}/${name}`,
            ns,
            domain,
            name,
            rel,
            missing: !exists,
            source: exists ? 'resourcepack' : 'unknown'
        };
    }
    
    /**
     * 标准化元素数据
     */
    private normalizeElements(
        elements: ModelElement[], 
        resolvedTextures: Record<string, TextureInfo>
    ): ElementDef[] {
        return elements.map(element => this.normalizeElement(element, resolvedTextures));
    }
    
    /**
     * 标准化单个元素
     */
    private normalizeElement(
        element: ModelElement, 
        resolvedTextures: Record<string, TextureInfo>
    ): ElementDef {
        const faces: ElementFace[] = [];
        
        if (element.faces) {
            for (const [dir, face] of Object.entries(element.faces)) {
                faces.push(this.normalizeFace(dir, face, resolvedTextures));
            }
        }
        
        const result: ElementDef = {
            from: element.from,
            to: element.to,
            faces
        };
        
        if (element.rotation) {
            result.rotation = element.rotation;
        }
        
        if (element.shade !== undefined) {
            result.shade = element.shade;
        }
        
        return result;
    }
    
    /**
     * 标准化面数据
     */
    private normalizeFace(
        dir: string, 
        face: ModelFace, 
        resolvedTextures: Record<string, TextureInfo>
    ): ElementFace {
        let textureKey: string | undefined;
        let textureRel: string | undefined;
        
        // 解析纹理引用
        if (face.texture.startsWith('#')) {
            const key = face.texture.substring(1);
            const textureInfo = resolvedTextures[key];
            if (textureInfo) {
                textureKey = key;
                textureRel = textureInfo.rel;
            } else {
                textureRel = 'minecraft:block/missing';
            }
        } else {
            // 直接纹理路径
            textureRel = normalizeTexturePath(face.texture);
        }
        
        const result: ElementFace = {
            dir: dir as any,
            uv: face.uv || [0, 0, 16, 16],
            textureKey,
            textureRel
        };
        
        if (face.rotation !== undefined) {
            result.rotation = face.rotation as any;
        }
        
        if (face.cullface) {
            result.cullface = face.cullface;
        }
        
        if (face.tintindex !== undefined) {
            result.tintindex = face.tintindex;
        }
        
        return result;
    }
    
    /**
     * 清除缓存
     */
    clearCache(): void {
        this.loader.clearCache();
    }
    
    /**
     * 获取缓存统计
     */
    getCacheStats(): any {
        return this.loader.getCacheStats();
    }
}