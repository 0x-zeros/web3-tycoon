/**
 * 体素方块目录系统
 * 为UI提供友好的方块查询和管理接口
 */

import { VoxelBlockRegistry, BlockRegistry, BlockInfo, BlockCategory } from './VoxelBlockRegistry';

export interface BlockCatalogItem extends BlockInfo {
    icon: string;               // 图标路径
    description?: string;       // 详细描述
    tags: string[];            // 搜索标签
    available: boolean;        // 是否可用
    unlocked: boolean;         // 是否解锁（游戏机制）
}

export interface BlockCategoryInfo {
    category: BlockCategory;
    displayName: string;
    description: string;
    icon: string;
    blocks: BlockCatalogItem[];
    sortOrder: number;
}

export interface BlockSearchOptions {
    query?: string;            // 搜索关键词
    category?: BlockCategory;  // 分类筛选
    tags?: string[];          // 标签筛选
    available?: boolean;      // 可用性筛选
    unlocked?: boolean;       // 解锁状态筛选
    sortBy?: 'name' | 'category' | 'recent' | 'popular'; // 排序方式
    limit?: number;           // 结果数量限制
}

export interface BlockUsageStats {
    blockId: string;
    usageCount: number;
    lastUsed: number;
    isFavorite: boolean;
}

/**
 * 方块目录管理器
 * 提供UI友好的方块查询和管理功能
 */
export class VoxelBlockCatalog {
    private registry: VoxelBlockRegistry;
    private usageStats: Map<string, BlockUsageStats> = new Map();
    private favorites: Set<string> = new Set();
    private recentlyUsed: string[] = [];
    private maxRecentItems: number = 20;
    
    // 分类配置
    private categoryConfig: Map<BlockCategory, {
        displayName: string;
        description: string;
        icon: string;
        sortOrder: number;
    }> = new Map();
    
    constructor(registry?: VoxelBlockRegistry) {
        this.registry = registry || BlockRegistry;
        this.initializeCategoryConfig();
        this.loadUserData();
    }
    
    /**
     * 初始化分类配置
     */
    private initializeCategoryConfig(): void {
        this.categoryConfig.set(BlockCategory.BUILDING, {
            displayName: '建筑材料',
            description: '用于建造结构的方块',
            icon: 'ui/icons/category_building.png',
            sortOrder: 1
        });
        
        this.categoryConfig.set(BlockCategory.NATURAL, {
            displayName: '天然方块',
            description: '自然生成的方块',
            icon: 'ui/icons/category_natural.png',
            sortOrder: 2
        });
        
        this.categoryConfig.set(BlockCategory.DECORATION, {
            displayName: '装饰方块',
            description: '装饰用的方块和植物',
            icon: 'ui/icons/category_decoration.png',
            sortOrder: 3
        });
        
        this.categoryConfig.set(BlockCategory.REDSTONE, {
            displayName: '红石电路',
            description: '红石和机械装置',
            icon: 'ui/icons/category_redstone.png',
            sortOrder: 4
        });
        
        this.categoryConfig.set(BlockCategory.TRANSPORTATION, {
            displayName: '交通运输',
            description: '铁路和交通相关方块',
            icon: 'ui/icons/category_transport.png',
            sortOrder: 5
        });
        
        this.categoryConfig.set(BlockCategory.MISCELLANEOUS, {
            displayName: '杂项',
            description: '其他类型的方块',
            icon: 'ui/icons/category_misc.png',
            sortOrder: 99
        });
        
        this.categoryConfig.set(BlockCategory.LIQUID, {
            displayName: '流体',
            description: '液体方块',
            icon: 'ui/icons/category_liquid.png',
            sortOrder: 6
        });
    }
    
    /**
     * 获取所有方块的目录项
     */
    getAllBlocks(): BlockCatalogItem[] {
        const blocks = this.registry.getAllBlocks();
        return blocks.map(block => this.createCatalogItem(block));
    }
    
    /**
     * 根据分类获取方块
     */
    getBlocksByCategory(category: BlockCategory): BlockCatalogItem[] {
        const blocks = this.registry.getBlocksByCategory(category);
        return blocks.map(block => this.createCatalogItem(block));
    }
    
    /**
     * 搜索方块
     */
    searchBlocks(options: BlockSearchOptions): BlockCatalogItem[] {
        let results = this.getAllBlocks();
        
        // 关键词筛选
        if (options.query && options.query.trim()) {
            const query = options.query.toLowerCase();
            results = results.filter(block => 
                block.displayName.toLowerCase().includes(query) ||
                block.id.toLowerCase().includes(query) ||
                block.tags.some(tag => tag.toLowerCase().includes(query)) ||
                (block.description && block.description.toLowerCase().includes(query))
            );
        }
        
        // 分类筛选
        if (options.category) {
            results = results.filter(block => block.category === options.category);
        }
        
        // 标签筛选
        if (options.tags && options.tags.length > 0) {
            results = results.filter(block => 
                options.tags!.some(tag => block.tags.includes(tag))
            );
        }
        
        // 可用性筛选
        if (options.available !== undefined) {
            results = results.filter(block => block.available === options.available);
        }
        
        // 解锁状态筛选
        if (options.unlocked !== undefined) {
            results = results.filter(block => block.unlocked === options.unlocked);
        }
        
        // 排序
        this.sortBlocks(results, options.sortBy || 'name');
        
        // 限制结果数量
        if (options.limit && options.limit > 0) {
            results = results.slice(0, options.limit);
        }
        
        return results;
    }
    
    /**
     * 获取分类信息
     */
    getCategories(): BlockCategoryInfo[] {
        const categories: BlockCategoryInfo[] = [];
        
        for (const [category, config] of this.categoryConfig) {
            const blocks = this.getBlocksByCategory(category);
            if (blocks.length > 0) {
                categories.push({
                    category,
                    displayName: config.displayName,
                    description: config.description,
                    icon: config.icon,
                    blocks,
                    sortOrder: config.sortOrder
                });
            }
        }
        
        // 按排序顺序排列
        categories.sort((a, b) => a.sortOrder - b.sortOrder);
        return categories;
    }
    
    /**
     * 获取收藏的方块
     */
    getFavoriteBlocks(): BlockCatalogItem[] {
        const favoriteIds = Array.from(this.favorites);
        const blocks: BlockCatalogItem[] = [];
        
        for (const blockId of favoriteIds) {
            const blockInfo = this.registry.getBlock(blockId);
            if (blockInfo) {
                blocks.push(this.createCatalogItem(blockInfo, true));
            }
        }
        
        return blocks;
    }
    
    /**
     * 获取最近使用的方块
     */
    getRecentlyUsedBlocks(): BlockCatalogItem[] {
        const blocks: BlockCatalogItem[] = [];
        
        for (const blockId of this.recentlyUsed) {
            const blockInfo = this.registry.getBlock(blockId);
            if (blockInfo) {
                blocks.push(this.createCatalogItem(blockInfo));
            }
        }
        
        return blocks;
    }
    
    /**
     * 获取热门方块（基于使用统计）
     */
    getPopularBlocks(limit: number = 10): BlockCatalogItem[] {
        const statsArray = Array.from(this.usageStats.values())
            .sort((a, b) => b.usageCount - a.usageCount)
            .slice(0, limit);
            
        const blocks: BlockCatalogItem[] = [];
        for (const stats of statsArray) {
            const blockInfo = this.registry.getBlock(stats.blockId);
            if (blockInfo) {
                blocks.push(this.createCatalogItem(blockInfo));
            }
        }
        
        return blocks;
    }
    
    /**
     * 记录方块使用
     */
    recordBlockUsage(blockId: string): void {
        // 更新使用统计
        const stats = this.usageStats.get(blockId) || {
            blockId,
            usageCount: 0,
            lastUsed: 0,
            isFavorite: this.favorites.has(blockId)
        };
        
        stats.usageCount++;
        stats.lastUsed = Date.now();
        this.usageStats.set(blockId, stats);
        
        // 更新最近使用列表
        const existingIndex = this.recentlyUsed.indexOf(blockId);
        if (existingIndex >= 0) {
            this.recentlyUsed.splice(existingIndex, 1);
        }
        
        this.recentlyUsed.unshift(blockId);
        
        // 限制最近使用列表长度
        if (this.recentlyUsed.length > this.maxRecentItems) {
            this.recentlyUsed = this.recentlyUsed.slice(0, this.maxRecentItems);
        }
        
        this.saveUserData();
    }
    
    /**
     * 添加到收藏
     */
    addToFavorites(blockId: string): boolean {
        if (!this.registry.exists(blockId)) return false;
        
        this.favorites.add(blockId);
        
        // 更新统计信息
        const stats = this.usageStats.get(blockId);
        if (stats) {
            stats.isFavorite = true;
        }
        
        this.saveUserData();
        return true;
    }
    
    /**
     * 从收藏中移除
     */
    removeFromFavorites(blockId: string): boolean {
        const removed = this.favorites.delete(blockId);
        
        // 更新统计信息
        const stats = this.usageStats.get(blockId);
        if (stats) {
            stats.isFavorite = false;
        }
        
        if (removed) {
            this.saveUserData();
        }
        return removed;
    }
    
    /**
     * 检查是否为收藏
     */
    isFavorite(blockId: string): boolean {
        return this.favorites.has(blockId);
    }
    
    /**
     * 获取方块使用统计
     */
    getBlockStats(blockId: string): BlockUsageStats | null {
        return this.usageStats.get(blockId) || null;
    }
    
    /**
     * 创建目录项
     */
    private createCatalogItem(blockInfo: BlockInfo, isFavorite?: boolean): BlockCatalogItem {
        const stats = this.usageStats.get(blockInfo.id);
        
        return {
            ...blockInfo,
            icon: this.registry.getBlockIcon(blockInfo.id),
            description: this.getBlockDescription(blockInfo.id),
            tags: this.getBlockTags(blockInfo.id),
            available: this.isBlockAvailable(blockInfo.id),
            unlocked: this.isBlockUnlocked(blockInfo.id)
        };
    }
    
    /**
     * 获取方块描述
     */
    private getBlockDescription(blockId: string): string {
        // 这里可以从配置文件或数据库加载描述
        const descriptions: Record<string, string> = {
            'minecraft:stone': '最基础的建筑材料，坚固耐用。',
            'minecraft:dirt': '种植植物的基础土壤。',
            'minecraft:grass_block': '长满青草的土块，适合建造自然景观。',
            'minecraft:sand': '可以受重力影响下落的方块。',
            'minecraft:cobblestone': '石头的粗糙版本，常用于建筑。',
            'minecraft:oak_log': '橡木原木，可以制作木板。',
            'minecraft:oak_planks': '处理过的木材，建筑的好材料。',
            'minecraft:glass': '透明的建筑材料，可以制作窗户。',
            'minecraft:glowstone': '发光的方块，可以照亮周围。',
            // ... 更多描述
        };
        
        return descriptions[blockId] || '';
    }
    
    /**
     * 获取方块标签
     */
    private getBlockTags(blockId: string): string[] {
        const tagMap: Record<string, string[]> = {
            'minecraft:stone': ['建筑', '基础', '坚固'],
            'minecraft:dirt': ['自然', '种植', '土壤'],
            'minecraft:grass_block': ['自然', '草地', '绿色'],
            'minecraft:sand': ['自然', '重力', '黄色'],
            'minecraft:cobblestone': ['建筑', '石头', '粗糙'],
            'minecraft:oak_log': ['木材', '自然', '原木'],
            'minecraft:oak_planks': ['建筑', '木材', '处理'],
            'minecraft:glass': ['透明', '建筑', '玻璃'],
            'minecraft:glowstone': ['光源', '发光', '照明'],
            'minecraft:dandelion': ['植物', '花朵', '装饰'],
            'minecraft:poppy': ['植物', '花朵', '红色'],
            'minecraft:short_grass': ['植物', '草', '装饰'],
        };
        
        return tagMap[blockId] || [];
    }
    
    /**
     * 检查方块是否可用
     */
    private isBlockAvailable(blockId: string): boolean {
        // 这里可以添加游戏逻辑，比如某些方块需要特定条件才能使用
        return true; // 目前所有方块都可用
    }
    
    /**
     * 检查方块是否解锁
     */
    private isBlockUnlocked(blockId: string): boolean {
        // 这里可以添加解锁逻辑
        return true; // 目前所有方块都解锁
    }
    
    /**
     * 排序方块列表
     */
    private sortBlocks(blocks: BlockCatalogItem[], sortBy: string): void {
        switch (sortBy) {
            case 'name':
                blocks.sort((a, b) => a.displayName.localeCompare(b.displayName));
                break;
                
            case 'category':
                blocks.sort((a, b) => {
                    const configA = this.categoryConfig.get(a.category);
                    const configB = this.categoryConfig.get(b.category);
                    const orderA = configA ? configA.sortOrder : 999;
                    const orderB = configB ? configB.sortOrder : 999;
                    
                    if (orderA !== orderB) return orderA - orderB;
                    return a.displayName.localeCompare(b.displayName);
                });
                break;
                
            case 'recent':
                blocks.sort((a, b) => {
                    const indexA = this.recentlyUsed.indexOf(a.id);
                    const indexB = this.recentlyUsed.indexOf(b.id);
                    
                    if (indexA === -1 && indexB === -1) return 0;
                    if (indexA === -1) return 1;
                    if (indexB === -1) return -1;
                    return indexA - indexB;
                });
                break;
                
            case 'popular':
                blocks.sort((a, b) => {
                    const statsA = this.usageStats.get(a.id);
                    const statsB = this.usageStats.get(b.id);
                    const countA = statsA ? statsA.usageCount : 0;
                    const countB = statsB ? statsB.usageCount : 0;
                    return countB - countA;
                });
                break;
        }
    }
    
    /**
     * 加载用户数据
     */
    private loadUserData(): void {
        try {
            // 从localStorage或其他存储加载数据
            const savedData = localStorage.getItem('voxel-block-catalog-data');
            if (savedData) {
                const data = JSON.parse(savedData);
                
                if (data.favorites) {
                    this.favorites = new Set(data.favorites);
                }
                
                if (data.recentlyUsed) {
                    this.recentlyUsed = data.recentlyUsed;
                }
                
                if (data.usageStats) {
                    this.usageStats = new Map(Object.entries(data.usageStats));
                }
            }
        } catch (error) {
            console.warn('[VoxelBlockCatalog] 加载用户数据失败:', error);
        }
    }
    
    /**
     * 保存用户数据
     */
    private saveUserData(): void {
        try {
            const data = {
                favorites: Array.from(this.favorites),
                recentlyUsed: this.recentlyUsed,
                usageStats: Object.fromEntries(this.usageStats)
            };
            
            localStorage.setItem('voxel-block-catalog-data', JSON.stringify(data));
        } catch (error) {
            console.warn('[VoxelBlockCatalog] 保存用户数据失败:', error);
        }
    }
    
    /**
     * 清除用户数据
     */
    clearUserData(): void {
        this.favorites.clear();
        this.recentlyUsed = [];
        this.usageStats.clear();
        
        try {
            localStorage.removeItem('voxel-block-catalog-data');
        } catch (error) {
            console.warn('[VoxelBlockCatalog] 清除用户数据失败:', error);
        }
    }
    
    /**
     * 获取目录统计信息
     */
    getCatalogStats() {
        const categories = this.getCategories();
        
        return {
            totalBlocks: this.getAllBlocks().length,
            totalCategories: categories.length,
            favoriteCount: this.favorites.size,
            recentCount: this.recentlyUsed.length,
            categoryStats: categories.map(cat => ({
                category: cat.category,
                displayName: cat.displayName,
                blockCount: cat.blocks.length
            }))
        };
    }
}

// 导出默认实例
export const BlockCatalog = new VoxelBlockCatalog();

// 导出便捷函数
export function searchBlocks(options: BlockSearchOptions): BlockCatalogItem[] {
    return BlockCatalog.searchBlocks(options);
}

export function getBlockCategories(): BlockCategoryInfo[] {
    return BlockCatalog.getCategories();
}

export function getFavoriteBlocks(): BlockCatalogItem[] {
    return BlockCatalog.getFavoriteBlocks();
}

export function getRecentBlocks(): BlockCatalogItem[] {
    return BlockCatalog.getRecentlyUsedBlocks();
}

export function recordBlockUsage(blockId: string): void {
    BlockCatalog.recordBlockUsage(blockId);
}