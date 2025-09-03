/**
 * SkillManager - 技能管理器
 * 
 * 负责技能的加载、创建、管理和查询
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component, resources, JsonAsset } from 'cc';
import { Skill } from './Skill';
import { 
    SkillConfig, 
    SkillManagerConfig, 
    SkillQuery, 
    SkillType, 
    SkillEffectType,
    SkillTargetType
} from './SkillTypes';

const { ccclass, property } = _decorator;

/**
 * 技能缓存接口
 */
interface SkillCache {
    /** 技能实例 */
    skill: Skill;
    /** 创建时间 */
    createTime: number;
    /** 最后访问时间 */
    lastAccessTime: number;
    /** 访问次数 */
    accessCount: number;
}

/**
 * 技能统计信息接口
 */
interface SkillStatistics {
    /** 总技能数 */
    totalSkills: number;
    /** 按类型分组的技能数 */
    skillsByType: { [type: string]: number };
    /** 按效果类型分组的技能数 */
    skillsByEffect: { [effect: string]: number };
    /** 缓存命中率 */
    cacheHitRate: number;
    /** 加载时间 */
    loadTime: number;
}

/**
 * 技能管理器
 * 负责技能系统的全局管理
 */
@ccclass('SkillManager')
export class SkillManager extends Component {
    
    // ========================= 单例模式 =========================
    
    private static _instance: SkillManager | null = null;
    
    public static get instance(): SkillManager {
        return SkillManager._instance!;
    }
    
    // ========================= 编辑器属性 =========================
    
    @property({ displayName: "技能配置文件路径", tooltip: "JSON格式的技能配置文件路径" })
    public skillConfigPath: string = 'data/configs/skills';
    
    @property({ displayName: "启用技能缓存", tooltip: "是否启用技能实例缓存" })
    public enableCache: boolean = true;
    
    @property({ displayName: "缓存大小", tooltip: "最大缓存技能数量" })
    public maxCacheSize: number = 100;
    
    @property({ displayName: "缓存过期时间", tooltip: "缓存过期时间（秒）" })
    public cacheExpireTime: number = 300; // 5分钟
    
    @property({ displayName: "启用调试模式", tooltip: "输出详细的调试信息" })
    public debugMode: boolean = false;
    
    // ========================= 私有属性 =========================
    
    /** 技能配置映射表 */
    private m_skillConfigs: Map<number, SkillConfig> = new Map();
    
    /** 技能实例缓存 */
    private m_skillCache: Map<number, SkillCache> = new Map();
    
    /** 按名称索引的技能映射 */
    private m_skillsByName: Map<string, SkillConfig> = new Map();
    
    /** 按类型分组的技能 */
    private m_skillsByType: Map<SkillType, SkillConfig[]> = new Map();
    
    /** 按效果类型分组的技能 */
    private m_skillsByEffect: Map<SkillEffectType, SkillConfig[]> = new Map();
    
    /** 管理器配置 */
    private m_config: SkillManagerConfig = {
        configPath: 'data/configs/skills',
        enableUpgrade: true,
        enableLearning: true,
        globalCooldown: 1.0,
        maxActiveSkills: 10
    };
    
    /** 是否已初始化 */
    private m_initialized: boolean = false;
    
    /** 加载状态 */
    private m_loadingPromise: Promise<boolean> | null = null;
    
    /** 统计信息 */
    private m_statistics: SkillStatistics = {
        totalSkills: 0,
        skillsByType: {},
        skillsByEffect: {},
        cacheHitRate: 0,
        loadTime: 0
    };
    
    /** 缓存访问计数 */
    private m_cacheHits: number = 0;
    private m_cacheMisses: number = 0;
    
    // ========================= 生命周期方法 =========================
    
    protected onLoad(): void {
        if (SkillManager._instance) {
            console.warn('[SkillManager] 技能管理器实例已存在，销毁重复实例');
            this.destroy();
            return;
        }
        
        SkillManager._instance = this;
        this.initializeManager();
    }
    
    protected start(): void {
        // 延迟初始化，确保其他系统准备就绪
        this.scheduleOnce(() => {
            this.loadSkillConfigs();
        }, 0.1);
    }
    
    protected onDestroy(): void {
        this.cleanup();
        if (SkillManager._instance === this) {
            SkillManager._instance = null;
        }
    }
    
    protected update(dt: number): void {
        // 定期清理过期缓存
        this.cleanExpiredCache();
    }
    
    // ========================= 初始化方法 =========================
    
    /**
     * 初始化管理器
     */
    private initializeManager(): void {
        // 更新配置
        this.m_config.configPath = this.skillConfigPath;
        
        // 初始化分组映射
        for (const skillType of Object.values(SkillType)) {
            this.m_skillsByType.set(skillType, []);
        }
        
        for (const effectType of Object.values(SkillEffectType)) {
            this.m_skillsByEffect.set(effectType, []);
        }
        
        console.log('[SkillManager] 技能管理器初始化完成');
    }
    
    /**
     * 加载技能配置
     */
    public async loadSkillConfigs(): Promise<boolean> {
        if (this.m_loadingPromise) {
            return this.m_loadingPromise;
        }
        
        this.m_loadingPromise = this.doLoadSkillConfigs();
        return this.m_loadingPromise;
    }
    
    /**
     * 执行技能配置加载
     */
    private async doLoadSkillConfigs(): Promise<boolean> {
        const startTime = Date.now();
        
        try {
            console.log(`[SkillManager] 开始加载技能配置: ${this.skillConfigPath}`);
            
            // 加载JSON配置文件
            const jsonAsset = await this.loadJsonAsset(this.skillConfigPath);
            if (!jsonAsset) {
                throw new Error('技能配置文件加载失败');
            }
            
            const configData = jsonAsset.json;
            if (!configData) {
                throw new Error('技能配置文件加载失败');
            }
            
            // 支持两种格式：直接数组或包含skills字段的对象
            let skillsArray;
            if (Array.isArray(configData)) {
                // 直接是技能数组
                skillsArray = configData;
            } else if (configData.skills && Array.isArray(configData.skills)) {
                // 包含skills字段的对象
                skillsArray = configData.skills;
            } else {
                throw new Error('技能配置文件格式错误：期待数组或包含skills字段的对象');
            }
            
            // 解析技能配置
            await this.parseSkillConfigs(skillsArray);
            
            // 构建索引
            this.buildSkillIndices();
            
            // 更新统计信息
            this.updateStatistics(Date.now() - startTime);
            
            this.m_initialized = true;
            
            console.log(`[SkillManager] 技能配置加载完成，共加载 ${this.m_skillConfigs.size} 个技能`);
            return true;
            
        } catch (error) {
            console.error('[SkillManager] 技能配置加载失败:', error);
            return false;
        } finally {
            this.m_loadingPromise = null;
        }
    }
    
    /**
     * 加载JSON资源
     */
    private loadJsonAsset(path: string): Promise<JsonAsset | null> {
        return new Promise((resolve) => {
            resources.load(path, JsonAsset, (err, asset) => {
                if (err) {
                    console.error(`[SkillManager] JSON文件加载失败: ${path}`, err);
                    resolve(null);
                } else {
                    resolve(asset);
                }
            });
        });
    }
    
    /**
     * 解析技能配置
     */
    private async parseSkillConfigs(skillsData: any[]): Promise<void> {
        this.m_skillConfigs.clear();
        
        for (const skillData of skillsData) {
            try {
                const config = this.parseSkillConfig(skillData);
                if (config) {
                    this.m_skillConfigs.set(config.id, config);
                    
                    if (this.debugMode) {
                        console.log(`[SkillManager] 解析技能: ${config.name} (${config.id})`);
                    }
                }
            } catch (error) {
                console.error('[SkillManager] 技能配置解析失败:', skillData, error);
            }
        }
    }
    
    /**
     * 解析单个技能配置
     */
    private parseSkillConfig(data: any): SkillConfig | null {
        if (!data.id || !data.name) {
            console.warn('[SkillManager] 技能配置缺少必要字段:', data);
            return null;
        }
        
        return {
            id: data.id,
            name: data.name,
            description: data.description || '',
            type: data.type || SkillType.ACTIVE,
            iconPath: data.iconPath || '',
            level: data.level || 1,
            attributes: data.attributes || {},
            effects: data.effects || [],
            requirements: data.requirements,
            upgradeConfig: data.upgradeConfig,
            animationConfig: data.animationConfig,
            audioConfig: data.audioConfig
        };
    }
    
    /**
     * 构建技能索引
     */
    private buildSkillIndices(): void {
        // 清空现有索引
        this.m_skillsByName.clear();
        for (const skillList of this.m_skillsByType.values()) {
            skillList.length = 0;
        }
        for (const skillList of this.m_skillsByEffect.values()) {
            skillList.length = 0;
        }
        
        // 重新构建索引
        for (const config of this.m_skillConfigs.values()) {
            // 按名称索引
            this.m_skillsByName.set(config.name, config);
            
            // 按类型分组
            const typeList = this.m_skillsByType.get(config.type);
            if (typeList) {
                typeList.push(config);
            }
            
            // 按效果类型分组
            for (const effect of config.effects) {
                const effectList = this.m_skillsByEffect.get(effect.type);
                if (effectList) {
                    effectList.push(config);
                }
            }
        }
    }
    
    /**
     * 更新统计信息
     */
    private updateStatistics(loadTime: number): void {
        this.m_statistics.totalSkills = this.m_skillConfigs.size;
        this.m_statistics.loadTime = loadTime;
        
        // 按类型统计
        this.m_statistics.skillsByType = {};
        for (const [type, skills] of this.m_skillsByType) {
            this.m_statistics.skillsByType[type] = skills.length;
        }
        
        // 按效果统计
        this.m_statistics.skillsByEffect = {};
        for (const [effect, skills] of this.m_skillsByEffect) {
            this.m_statistics.skillsByEffect[effect] = skills.length;
        }
        
        // 缓存命中率
        const totalAccess = this.m_cacheHits + this.m_cacheMisses;
        this.m_statistics.cacheHitRate = totalAccess > 0 ? this.m_cacheHits / totalAccess : 0;
    }
    
    // ========================= 技能获取方法 =========================
    
    /**
     * 根据ID获取技能配置
     */
    public getSkillConfig(skillId: number): SkillConfig | null {
        return this.m_skillConfigs.get(skillId) || null;
    }
    
    /**
     * 根据名称获取技能配置
     */
    public getSkillConfigByName(name: string): SkillConfig | null {
        return this.m_skillsByName.get(name) || null;
    }
    
    /**
     * 根据ID获取技能实例
     */
    public getSkill(skillId: number): Skill | null {
        // 检查缓存
        if (this.enableCache) {
            const cached = this.getFromCache(skillId);
            if (cached) {
                this.m_cacheHits++;
                return cached.skill;
            }
            this.m_cacheMisses++;
        }
        
        // 创建新实例
        const config = this.getSkillConfig(skillId);
        if (!config) {
            return null;
        }
        
        const skill = new Skill(config);
        
        // 加入缓存
        if (this.enableCache) {
            this.addToCache(skillId, skill);
        }
        
        return skill;
    }
    
    /**
     * 根据名称获取技能实例
     */
    public getSkillByName(name: string): Skill | null {
        const config = this.getSkillConfigByName(name);
        if (!config) {
            return null;
        }
        
        return this.getSkill(config.id);
    }
    
    /**
     * 创建技能实例
     */
    public createSkill(skillId: number): Skill | null {
        const config = this.getSkillConfig(skillId);
        if (!config) {
            console.warn(`[SkillManager] 技能配置不存在: ${skillId}`);
            return null;
        }
        
        const skill = new Skill(config);
        
        if (this.debugMode) {
            console.log(`[SkillManager] 创建技能实例: ${config.name} (${skillId})`);
        }
        
        return skill;
    }
    
    /**
     * 批量创建技能
     */
    public createSkills(skillIds: number[]): Skill[] {
        const skills: Skill[] = [];
        
        for (const skillId of skillIds) {
            const skill = this.createSkill(skillId);
            if (skill) {
                skills.push(skill);
            }
        }
        
        return skills;
    }
    
    // ========================= 技能查询方法 =========================
    
    /**
     * 查询技能
     */
    public querySkills(query: SkillQuery): SkillConfig[] {
        let results: SkillConfig[] = Array.from(this.m_skillConfigs.values());
        
        // 按ID过滤
        if (query.id !== undefined) {
            const config = this.getSkillConfig(query.id);
            return config ? [config] : [];
        }
        
        // 按名称过滤
        if (query.name) {
            results = results.filter(config => 
                config.name.toLowerCase().includes(query.name!.toLowerCase())
            );
        }
        
        // 按类型过滤
        if (query.type) {
            results = results.filter(config => config.type === query.type);
        }
        
        // 按效果类型过滤
        if (query.effectType) {
            results = results.filter(config =>
                config.effects.some(effect => effect.type === query.effectType)
            );
        }
        
        // 按目标类型过滤
        if (query.targetType) {
            results = results.filter(config =>
                config.effects.some(effect => effect.target === query.targetType)
            );
        }
        
        // 按等级范围过滤
        if (query.levelRange) {
            results = results.filter(config =>
                config.level >= query.levelRange!.min &&
                config.level <= query.levelRange!.max
            );
        }
        
        return results;
    }
    
    /**
     * 按类型获取技能列表
     */
    public getSkillsByType(type: SkillType): SkillConfig[] {
        return [...(this.m_skillsByType.get(type) || [])];
    }
    
    /**
     * 按效果类型获取技能列表
     */
    public getSkillsByEffect(effectType: SkillEffectType): SkillConfig[] {
        return [...(this.m_skillsByEffect.get(effectType) || [])];
    }
    
    /**
     * 获取所有技能配置
     */
    public getAllSkillConfigs(): SkillConfig[] {
        return Array.from(this.m_skillConfigs.values());
    }
    
    /**
     * 获取技能数量
     */
    public getSkillCount(): number {
        return this.m_skillConfigs.size;
    }
    
    /**
     * 检查技能是否存在
     */
    public hasSkill(skillId: number): boolean {
        return this.m_skillConfigs.has(skillId);
    }
    
    // ========================= 缓存管理 =========================
    
    /**
     * 从缓存获取技能
     */
    private getFromCache(skillId: number): SkillCache | null {
        const cached = this.m_skillCache.get(skillId);
        if (cached) {
            cached.lastAccessTime = Date.now();
            cached.accessCount++;
            return cached;
        }
        return null;
    }
    
    /**
     * 添加到缓存
     */
    private addToCache(skillId: number, skill: Skill): void {
        // 检查缓存大小
        if (this.m_skillCache.size >= this.maxCacheSize) {
            this.cleanOldestCache();
        }
        
        this.m_skillCache.set(skillId, {
            skill: skill,
            createTime: Date.now(),
            lastAccessTime: Date.now(),
            accessCount: 1
        });
    }
    
    /**
     * 清理过期缓存
     */
    private cleanExpiredCache(): void {
        if (!this.enableCache) return;
        
        const now = Date.now();
        const expireTime = this.cacheExpireTime * 1000;
        
        for (const [skillId, cached] of this.m_skillCache) {
            if (now - cached.lastAccessTime > expireTime) {
                this.m_skillCache.delete(skillId);
                
                if (this.debugMode) {
                    console.log(`[SkillManager] 清理过期缓存: ${skillId}`);
                }
            }
        }
    }
    
    /**
     * 清理最旧的缓存
     */
    private cleanOldestCache(): void {
        let oldestTime = Date.now();
        let oldestId = -1;
        
        for (const [skillId, cached] of this.m_skillCache) {
            if (cached.lastAccessTime < oldestTime) {
                oldestTime = cached.lastAccessTime;
                oldestId = skillId;
            }
        }
        
        if (oldestId !== -1) {
            this.m_skillCache.delete(oldestId);
        }
    }
    
    /**
     * 清空缓存
     */
    public clearCache(): void {
        this.m_skillCache.clear();
        this.m_cacheHits = 0;
        this.m_cacheMisses = 0;
        
        console.log('[SkillManager] 技能缓存已清空');
    }
    
    // ========================= 配置管理 =========================
    
    /**
     * 重新加载技能配置
     */
    public async reloadSkillConfigs(): Promise<boolean> {
        console.log('[SkillManager] 重新加载技能配置');
        
        // 清空现有数据
        this.m_skillConfigs.clear();
        this.clearCache();
        this.m_initialized = false;
        
        // 重新加载
        return await this.loadSkillConfigs();
    }
    
    /**
     * 添加技能配置
     */
    public addSkillConfig(config: SkillConfig): boolean {
        if (this.m_skillConfigs.has(config.id)) {
            console.warn(`[SkillManager] 技能ID已存在: ${config.id}`);
            return false;
        }
        
        this.m_skillConfigs.set(config.id, config);
        this.rebuildIndices();
        
        console.log(`[SkillManager] 添加技能配置: ${config.name} (${config.id})`);
        return true;
    }
    
    /**
     * 移除技能配置
     */
    public removeSkillConfig(skillId: number): boolean {
        if (!this.m_skillConfigs.has(skillId)) {
            return false;
        }
        
        this.m_skillConfigs.delete(skillId);
        this.m_skillCache.delete(skillId);
        this.rebuildIndices();
        
        console.log(`[SkillManager] 移除技能配置: ${skillId}`);
        return true;
    }
    
    /**
     * 重建索引
     */
    private rebuildIndices(): void {
        this.buildSkillIndices();
        this.updateStatistics(0);
    }
    
    // ========================= 状态查询 =========================
    
    /**
     * 是否已初始化
     */
    public isInitialized(): boolean {
        return this.m_initialized;
    }
    
    /**
     * 是否正在加载
     */
    public isLoading(): boolean {
        return this.m_loadingPromise !== null;
    }
    
    /**
     * 获取管理器配置
     */
    public getConfig(): SkillManagerConfig {
        return { ...this.m_config };
    }
    
    /**
     * 获取统计信息
     */
    public getStatistics(): SkillStatistics {
        this.updateStatistics(0);
        return { ...this.m_statistics };
    }
    
    // ========================= 调试方法 =========================
    
    /**
     * 打印技能列表
     */
    public debugPrintSkills(): void {
        console.log(`[SkillManager] 技能列表 (共${this.m_skillConfigs.size}个):`);
        
        for (const config of this.m_skillConfigs.values()) {
            console.log(`  - ${config.name} (${config.id}): ${config.type}, 效果数: ${config.effects.length}`);
        }
    }
    
    /**
     * 打印缓存状态
     */
    public debugPrintCache(): void {
        console.log(`[SkillManager] 缓存状态:`);
        console.log(`  缓存大小: ${this.m_skillCache.size}/${this.maxCacheSize}`);
        console.log(`  命中次数: ${this.m_cacheHits}`);
        console.log(`  未命中次数: ${this.m_cacheMisses}`);
        console.log(`  命中率: ${(this.m_statistics.cacheHitRate * 100).toFixed(2)}%`);
    }
    
    /**
     * 验证技能配置
     */
    public validateSkillConfigs(): boolean {
        let valid = true;
        
        for (const config of this.m_skillConfigs.values()) {
            if (!this.validateSkillConfig(config)) {
                valid = false;
            }
        }
        
        return valid;
    }
    
    /**
     * 验证单个技能配置
     */
    private validateSkillConfig(config: SkillConfig): boolean {
        if (!config.name || config.name.trim() === '') {
            console.error(`[SkillManager] 技能名称为空: ${config.id}`);
            return false;
        }
        
        if (config.effects.length === 0) {
            console.warn(`[SkillManager] 技能无效果: ${config.name} (${config.id})`);
        }
        
        return true;
    }
    
    // ========================= 清理方法 =========================
    
    /**
     * 清理资源
     */
    private cleanup(): void {
        this.clearCache();
        this.m_skillConfigs.clear();
        this.m_skillsByName.clear();
        
        for (const skillList of this.m_skillsByType.values()) {
            skillList.length = 0;
        }
        
        for (const skillList of this.m_skillsByEffect.values()) {
            skillList.length = 0;
        }
        
        console.log('[SkillManager] 资源清理完成');
    }
}