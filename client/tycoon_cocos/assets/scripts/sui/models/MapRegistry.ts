/**
 * MapRegistry 模型类
 * 对应 Move 端的 map::MapRegistry 结构
 *
 * 职责：
 * - 存储所有可用的地图模板 ID 列表
 * - 提供地图模板查询功能
 *
 * Move源文件: move/tycoon/sources/map.move
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

/**
 * MapRegistry 类
 * 对应 Move 的 map::MapRegistry 结构
 */
export class MapRegistry {

    // ========================= Move 端对应字段 =========================

    /** 注册表 ID */
    public readonly id: string;

    /** 地图模板 ID 列表（vector<ID>） */
    public readonly templates: string[];

    // ========================= 构造函数 =========================

    constructor(id: string, templates: string[]) {
        this.id = id;
        this.templates = templates;
    }

    // ========================= 静态工厂方法 =========================

    /**
     * 从 Move fields 加载 MapRegistry
     * @param fields Move 端的 MapRegistry 对象字段
     */
    public static loadFromFields(fields: any): MapRegistry {
        console.log('[MapRegistry] 从 fields 加载数据', fields);

        const id = fields.id?.id || fields.id || '';

        // 解析 templates vector<ID>
        const templatesData = fields.templates || [];
        const templates: string[] = [];

        for (const templateId of templatesData) {
            try {
                // ID 可能是字符串或 { bytes: "0x..." } 格式
                const id = this.parseID(templateId);
                if (id) {
                    templates.push(id);
                }
            } catch (error) {
                console.error('[MapRegistry] Failed to parse template ID:', error);
            }
        }

        console.log(`[MapRegistry] 加载了 ${templates.length} 个地图模板 ID`);

        return new MapRegistry(id, templates);
    }

    /**
     * 解析 ID 类型
     */
    private static parseID(value: any): string {
        if (typeof value === 'string') {
            return value;
        }
        if (value?.bytes) {
            return value.bytes;
        }
        if (value?.id) {
            return value.id;
        }
        return '';
    }

    // ========================= 查询方法 =========================

    /**
     * 获取所有模板 ID
     */
    public getTemplateIds(): string[] {
        return [...this.templates];
    }

    /**
     * 检查是否有指定模板
     */
    public hasTemplate(templateId: string): boolean {
        return this.templates.includes(templateId);
    }

    /**
     * 获取模板数量
     */
    public getTemplateCount(): number {
        return this.templates.length;
    }

    /**
     * 获取第 N 个模板 ID
     */
    public getTemplateAt(index: number): string | null {
        if (index >= 0 && index < this.templates.length) {
            return this.templates[index];
        }
        return null;
    }

    /**
     * 查找模板索引
     */
    public findTemplateIndex(templateId: string): number {
        return this.templates.indexOf(templateId);
    }

    // ========================= 调试方法 =========================

    /**
     * 打印所有模板 ID
     */
    public printAllTemplates(): void {
        console.log(`[MapRegistry] 共 ${this.templates.length} 个地图模板:`);
        this.templates.forEach((id, index) => {
            console.log(`  [${index}] ${id}`);
        });
    }

    /**
     * 调试输出
     */
    public debugInfo(): string {
        return JSON.stringify({
            id: this.id,
            templateCount: this.templates.length,
            templates: this.templates
        }, null, 2);
    }
}
