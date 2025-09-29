/**
 * Resource Pack 解析系统使用示例
 */

import { _decorator, Component, Node } from 'cc';
import { 
    parseBlock, 
    parseBlocks, 
    preloadCommonBlocks, 
    getCacheStats,
    BlockParser,
    ParsedBlockData 
} from './index';

const { ccclass, property } = _decorator;

@ccclass('ResourcePackExample')
export class ResourcePackExample extends Component {
    
    /**
     * 示例1: 解析单个方块
     */
    async example1_parseSingleBlock() {
        console.log('=== 示例1: 解析单个方块 ===');
        
        // 解析 Minecraft 方块
        //const stoneData = await parseBlock('stone');

        // const stoneData = await parseBlock('minecraft:oak_planks');
        // console.log('Stone 方块数据:', stoneData);
        // console.log('- ID:', stoneData.id);
        // console.log('- 模板类型:', stoneData.modelTemplate);
        // console.log('- 纹理数量:', stoneData.textures.length);
        // console.log('- 元素数量:', stoneData.elements.length);
        
        // 解析带命名空间的方块
        const grassData = await parseBlock('minecraft:grass_block');
        console.log('Grass Block 方块数据:', grassData);

        const hospital = await parseBlock('web3:hospital');
        console.log('Hospital Block 方块数据:', hospital);

        // const poppyData = await parseBlock('minecraft:poppy');
        // console.log('Poppy Block 方块数据:', poppyData);
        
        // // 解析 Web3 方块
        // const propertyData = await parseBlock('web3:property_tile');
        // console.log('Web3 Property 方块数据:', propertyData);
    }
    
    /**
     * 示例2: 批量解析方块
     */
    async example2_parseMultipleBlocks() {
        console.log('=== 示例2: 批量解析方块 ===');
        
        const blockIds = [
            'minecraft:stone',
            'minecraft:oak_log',
            'minecraft:oak_planks',
            'web3:empty_land',
            'web3:hospital'
        ];
        
        const results = await parseBlocks(blockIds);
        
        for (const data of results) {
            console.log(`- ${data.id.ns}:${data.id.path}`);
            console.log(`  模板: ${data.modelTemplate}`);
            console.log(`  纹理: ${data.textures.map(t => t.name).join(', ')}`);
        }
    }
    
    /**
     * 示例3: 使用自定义配置
     */
    async example3_customConfig() {
        console.log('=== 示例3: 使用自定义配置 ===');
        
        // 创建自定义解析器
        const parser = new BlockParser({
            rootDir: 'voxel/resource_pack',
            searchRoots: [
                'voxel/resource_pack',
                'voxel/default'
            ],
            defaultNamespace: 'web3'  // 默认使用 web3 命名空间
        });
        
        // 使用自定义解析器
        const data = await parser.parseBlock('empty_land');  // 将默认解析为 web3:empty_land
        console.log('Empty Land 数据:', data);
    }
    
    /**
     * 示例4: 预加载常用方块
     */
    async example4_preloadBlocks() {
        console.log('=== 示例4: 预加载常用方块 ===');
        
        // 预加载前的缓存状态
        console.log('预加载前缓存:', getCacheStats());
        
        // 执行预加载
        await preloadCommonBlocks();
        
        // 预加载后的缓存状态
        console.log('预加载后缓存:', getCacheStats());
    }
    
    /**
     * 示例5: 访问解析细节
     */
    async example5_parseDetails() {
        console.log('=== 示例5: 访问解析细节 ===');
        
        const data = await parseBlock('minecraft:oak_planks');
        
        // 访问调试信息
        console.log('BlockState 路径:', data.debug.blockstatePath);
        console.log('模型继承链:', data.debug.modelChainPaths);
        console.log('纹理映射:', data.debug.combinedJson.texturesDict);
        
        // 访问元素信息
        for (const element of data.elements) {
            console.log('元素:', {
                from: element.from,
                to: element.to,
                faces: element.faces.length
            });
            
            // 访问面信息
            for (const face of element.faces) {
                console.log(`  面 ${face.dir}:`, {
                    uv: face.uv,
                    texture: face.textureRel
                });
            }
        }
    }
    
    /**
     * 示例6: 处理 Web3 特殊方块
     */
    async example6_web3Blocks() {
        console.log('=== 示例6: Web3 特殊方块 ===');
        
        const web3Blocks = [
            'web3:land_god',      // 土地公
            'web3:wealth_god',    // 财神
            'web3:fortune_god',   // 福神
            'web3:poverty_god',   // 衰神
            'web3:dog',          // 恶犬
            'web3:roadblock',    // 路障
            'web3:bomb'          // 炸弹
        ];
        
        for (const blockId of web3Blocks) {
            const data = await parseBlock(blockId);
            console.log(`${blockId}:`, {
                template: data.modelTemplate,
                textures: data.textures.map(t => t.name),
                rotationY: data.rotationY
            });
        }
    }
    
    /**
     * 示例7: 错误处理
     */
    async example7_errorHandling() {
        console.log('=== 示例7: 错误处理 ===');
        
        try {
            // 尝试解析不存在的方块
            const data = await parseBlock('minecraft:non_existent_block');
            console.log('解析结果:', data);
            
            // 即使方块不存在，系统也会返回降级数据
            if (data.textures.some(t => t.missing)) {
                console.log('检测到缺失的纹理');
            }
            
        } catch (error) {
            console.error('解析失败:', error);
        }
    }
    
    /**
     * 运行所有示例
     */
    async runAllExamples() {
        console.log('========== Resource Pack 解析系统示例 ==========');
        
        await this.example1_parseSingleBlock();
        // await this.example2_parseMultipleBlocks();
        // await this.example3_customConfig();
        // await this.example4_preloadBlocks();
        // await this.example5_parseDetails();//
        // await this.example6_web3Blocks();
        // await this.example7_errorHandling();
        
        console.log('========== 所有示例运行完成 ==========');
    }
    
    start() {
        // 在组件启动时运行示例
        this.runAllExamples().catch(error => {
            console.error('示例运行失败:', error);
        });
    }
}

/**
 * 工具函数：将 ParsedBlockData 转换为简化的描述
 */
export function describeBlock(data: ParsedBlockData): string {
    const parts: string[] = [];
    
    parts.push(`方块: ${data.id.ns}:${data.id.path}`);
    parts.push(`模板: ${data.modelTemplate}`);
    parts.push(`纹理数: ${data.textures.length}`);
    parts.push(`元素数: ${data.elements.length}`);
    
    if (data.rotationY) {
        parts.push(`旋转: ${data.rotationY}°`);
    }
    
    return parts.join(', ');
}

/**
 * 工具函数：验证解析结果
 */
export function validateParsedData(data: ParsedBlockData): boolean {
    // 检查基本字段
    if (!data.id || !data.id.ns || !data.id.path) {
        console.error('缺少 ID 信息');
        return false;
    }
    
    if (!data.elements || data.elements.length === 0) {
        console.error('缺少元素信息');
        return false;
    }
    
    // 检查元素
    for (const element of data.elements) {
        if (!element.from || !element.to) {
            console.error('元素缺少位置信息');
            return false;
        }
        
        if (!element.faces || element.faces.length === 0) {
            console.error('元素缺少面信息');
            return false;
        }
    }
    
    return true;
}
