import { BlockStateData, BlockStateVariant } from './ResourcePackLoader';

export interface ResolvedBlockState {
    modelId: string;
    rotation: {
        x: number;
        y: number;
        z: number;
    };
    uvlock: boolean;
    weight: number;
}

export class BlockStateParser {
    
    /**
     * 解析方块状态，返回默认变体或第一个可用变体
     * @param blockStateData blockstates JSON 数据
     * @param properties 方块属性（暂时不支持，使用默认）
     * @returns 解析后的方块状态
     */
    static parseBlockState(
        blockStateData: BlockStateData, 
        properties: { [key: string]: string } = {}
    ): ResolvedBlockState | null {
        
        if (!blockStateData || !blockStateData.variants) {
            console.warn('[BlockStateParser] 无效的方块状态数据');
            return null;
        }

        // 查找匹配的变体，优先使用空字符串（默认变体）
        let selectedVariant: BlockStateVariant | null = null;
        
        // 1. 尝试空字符串键（默认变体）
        if (blockStateData.variants['']) {
            const defaultVariant = blockStateData.variants[''];
            selectedVariant = Array.isArray(defaultVariant) ? defaultVariant[0] : defaultVariant;
        } 
        // 2. 如果没有默认变体，取第一个可用的
        else {
            const firstKey = Object.keys(blockStateData.variants)[0];
            if (firstKey) {
                const firstVariant = blockStateData.variants[firstKey];
                selectedVariant = Array.isArray(firstVariant) ? firstVariant[0] : firstVariant;
            }
        }

        if (!selectedVariant) {
            console.warn('[BlockStateParser] 未找到可用的方块变体');
            return null;
        }

        return this.parseVariant(selectedVariant);
    }

    /**
     * 解析具体的变体配置
     * @param variant 变体数据
     * @returns 解析后的方块状态
     */
    private static parseVariant(variant: BlockStateVariant): ResolvedBlockState {
        const modelId = this.normalizeModelId(variant.model);
        
        return {
            modelId,
            rotation: {
                x: variant.x || 0,
                y: variant.y || 0,
                z: variant.z || 0
            },
            uvlock: variant.uvlock || false,
            weight: variant.weight || 1
        };
    }

    /**
     * 标准化模型ID，确保格式正确
     * @param modelId 原始模型ID
     * @returns 标准化后的模型ID
     */
    private static normalizeModelId(modelId: string): string {
        // 如果已经包含命名空间，直接返回
        if (modelId.includes(':')) {
            return modelId;
        }

        // 如果以 block/ 开头，添加 minecraft 命名空间
        if (modelId.startsWith('block/')) {
            return `minecraft:${modelId}`;
        }

        // 否则假设是 minecraft:block/ 的简写
        return `minecraft:block/${modelId}`;
    }

    /**
     * 从多个加权变体中随机选择一个
     * @param variants 变体数组
     * @returns 选中的变体
     */
    static selectWeightedVariant(variants: BlockStateVariant[]): BlockStateVariant {
        if (variants.length === 1) {
            return variants[0];
        }

        // 计算总权重
        let totalWeight = 0;
        for (const variant of variants) {
            totalWeight += variant.weight || 1;
        }

        // 随机选择
        let randomWeight = Math.random() * totalWeight;
        for (const variant of variants) {
            randomWeight -= variant.weight || 1;
            if (randomWeight <= 0) {
                return variant;
            }
        }

        // fallback 到第一个
        return variants[0];
    }

    /**
     * 检查方块状态是否支持指定的属性组合
     * @param blockStateData 方块状态数据
     * @param properties 属性映射
     * @returns 是否支持
     */
    static supportsProperties(
        blockStateData: BlockStateData,
        properties: { [key: string]: string }
    ): boolean {
        // 简化实现：如果有默认变体则支持
        return blockStateData.variants && blockStateData.variants[''] !== undefined;
    }

    /**
     * 获取方块状态支持的所有属性键
     * @param blockStateData 方块状态数据
     * @returns 属性键数组
     */
    static getSupportedProperties(blockStateData: BlockStateData): string[] {
        const properties: Set<string> = new Set();

        for (const variantKey of Object.keys(blockStateData.variants)) {
            if (variantKey === '') continue; // 跳过默认变体

            // 解析属性键（如 "facing=north,half=top"）
            const keyPairs = variantKey.split(',');
            for (const keyPair of keyPairs) {
                const [key] = keyPair.split('=');
                if (key) {
                    properties.add(key.trim());
                }
            }
        }

        return Array.from(properties);
    }

    /**
     * 创建降级方块状态（紫黑方格）
     * @returns 降级方块状态
     */
    static createFallbackBlockState(): ResolvedBlockState {
        return {
            modelId: 'minecraft:block/cube_all',
            rotation: { x: 0, y: 0, z: 0 },
            uvlock: false,
            weight: 1
        };
    }

    /**
     * 验证方块状态数据的有效性
     * @param blockStateData 方块状态数据
     * @returns 是否有效
     */
    static validateBlockState(blockStateData: any): blockStateData is BlockStateData {
        if (!blockStateData || typeof blockStateData !== 'object') {
            return false;
        }

        if (!blockStateData.variants || typeof blockStateData.variants !== 'object') {
            return false;
        }

        // 检查至少有一个变体
        const variantKeys = Object.keys(blockStateData.variants);
        if (variantKeys.length === 0) {
            return false;
        }

        // 检查变体格式
        for (const key of variantKeys) {
            const variant = blockStateData.variants[key];
            if (Array.isArray(variant)) {
                for (const v of variant) {
                    if (!this.validateVariant(v)) {
                        return false;
                    }
                }
            } else {
                if (!this.validateVariant(variant)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * 验证单个变体的有效性
     * @param variant 变体数据
     * @returns 是否有效
     */
    private static validateVariant(variant: any): variant is BlockStateVariant {
        if (!variant || typeof variant !== 'object') {
            return false;
        }

        if (!variant.model || typeof variant.model !== 'string') {
            return false;
        }

        // 可选字段验证
        if (variant.x !== undefined && typeof variant.x !== 'number') {
            return false;
        }
        if (variant.y !== undefined && typeof variant.y !== 'number') {
            return false;
        }
        if (variant.z !== undefined && typeof variant.z !== 'number') {
            return false;
        }

        return true;
    }
}