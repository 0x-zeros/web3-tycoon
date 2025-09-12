/**
 * Resource Pack 解析系统主入口
 */

// 导出所有类型
export * from './types';

// 导出工具函数
export * from './utils';

// 导出主要类
export { ResourceLoader } from './ResourceLoader';
export { TemplateProcessor } from './TemplateProcessor';
export { BlockParser } from './BlockParser';

// 导入必要的类型和类
import { BlockParser } from './BlockParser';
import { ParsedBlockData, ParseOptions } from './types';

// 全局单例实例
let globalParser: BlockParser | null = null;

/**
 * 获取全局 BlockParser 实例
 * @param options 解析选项（仅在首次创建时生效）
 * @returns BlockParser 实例
 */
export function getGlobalBlockParser(options?: ParseOptions): BlockParser {
    if (!globalParser) {
        globalParser = new BlockParser(options);
    }
    return globalParser;
}

/**
 * 便捷的解析函数
 * @param blockId 方块ID
 * @param options 解析选项
 * @returns 解析后的方块数据
 */
export async function parseBlock(blockId: string, options?: ParseOptions): Promise<ParsedBlockData> {
    const parser = options ? new BlockParser(options) : getGlobalBlockParser();
    return parser.parseBlock(blockId);
}

/**
 * 批量解析方块
 * @param blockIds 方块ID数组
 * @param options 解析选项
 * @returns 解析后的方块数据数组
 */
export async function parseBlocks(blockIds: string[], options?: ParseOptions): Promise<ParsedBlockData[]> {
    const parser = options ? new BlockParser(options) : getGlobalBlockParser();
    const results: ParsedBlockData[] = [];
    
    for (const blockId of blockIds) {
        try {
            const data = await parser.parseBlock(blockId);
            results.push(data);
        } catch (error) {
            console.error(`[parseBlocks] 解析失败: ${blockId}`, error);
        }
    }
    
    return results;
}

/**
 * 预加载常用方块
 * @param options 解析选项
 */
export async function preloadCommonBlocks(options?: ParseOptions): Promise<void> {
    const commonBlocks = [
        // Minecraft 常用方块
        'minecraft:stone',
        'minecraft:grass_block',
        'minecraft:dirt',
        'minecraft:cobblestone',
        'minecraft:oak_planks',
        'minecraft:oak_log',
        'minecraft:sand',
        'minecraft:glass',
        'minecraft:oak_leaves',
        'minecraft:water',
        'minecraft:lava',
        'minecraft:glowstone',
        
        // Web3 方块
        'web3:empty_land',
        'web3:property',
        'web3:hospital',
        'web3:chance',
        'web3:bonus',
        'web3:fee',
        'web3:card',
        'web3:news',
        'web3:land_god',
        'web3:wealth_god',
        'web3:fortune_god',
        'web3:dog',
        'web3:poverty_god',
        'web3:roadblock',
        'web3:bomb'
    ];
    
    console.log('[preloadCommonBlocks] 开始预加载常用方块...');
    const startTime = Date.now();
    
    await parseBlocks(commonBlocks, options);
    
    const elapsed = Date.now() - startTime;
    console.log(`[preloadCommonBlocks] 预加载完成，耗时 ${elapsed}ms`);
}

/**
 * 清除全局缓存
 */
export function clearGlobalCache(): void {
    if (globalParser) {
        globalParser.clearCache();
    }
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats(): any {
    if (globalParser) {
        return globalParser.getCacheStats();
    }
    return { blockstates: 0, models: 0, textures: 0 };
}

// 默认导出
export default {
    getGlobalBlockParser,
    parseBlock,
    parseBlocks,
    preloadCommonBlocks,
    clearGlobalCache,
    getCacheStats
};