/**
 * 通用列表过滤器
 * 支持多字段、AND/OR逻辑、子字符串模糊匹配
 */

/**
 * 过滤字段定义
 */
export interface FilterField<T> {
    /** 字段名（对应UI输入框名） */
    name: string;
    /** 值提取器（支持返回数组，如players的owner列表） */
    extractor: (item: T) => string | string[];
}

/**
 * 过滤配置
 */
export interface FilterConfig<T> {
    /** 过滤字段列表 */
    fields: FilterField<T>[];
    /** 字段间逻辑（默认 AND） */
    logic?: 'AND' | 'OR';
}

/**
 * 通用列表过滤器
 *
 * 使用示例：
 * ```typescript
 * const config: FilterConfig<Game> = {
 *     fields: [
 *         { name: 'gameid', extractor: (g) => g.id },
 *         { name: 'player', extractor: (g) => g.players.map(p => p.owner) }
 *     ],
 *     logic: 'AND'
 * };
 * const filter = new ListFilter(config);
 * filter.setData(games);
 * const result = filter.filter(new Map([['gameid', '0x123']]));
 * ```
 */
export class ListFilter<T> {
    private _config: FilterConfig<T>;
    private _originalData: T[] = [];

    constructor(config: FilterConfig<T>) {
        this._config = config;
    }

    /**
     * 设置原始数据（过滤前的完整列表）
     */
    setData(data: T[]): void {
        this._originalData = [...data];
    }

    /**
     * 执行过滤
     * @param searchValues 搜索值映射 { fieldName: searchValue }
     * @returns 过滤后的数据
     */
    filter(searchValues: Map<string, string>): T[] {
        // 检查是否有有效搜索值
        const hasValue = Array.from(searchValues.values()).some(v => v.trim() !== '');
        if (!hasValue) {
            return this._originalData;
        }

        return this._originalData.filter(item => this._matchItem(item, searchValues));
    }

    /**
     * 重置为原始数据
     */
    reset(): T[] {
        return this._originalData;
    }

    /**
     * 获取原始数据
     */
    getOriginalData(): T[] {
        return this._originalData;
    }

    /**
     * 匹配单个数据项
     */
    private _matchItem(item: T, searchValues: Map<string, string>): boolean {
        const logic = this._config.logic ?? 'AND';

        for (const field of this._config.fields) {
            const searchValue = searchValues.get(field.name)?.trim() ?? '';

            // 空搜索值跳过该字段
            if (searchValue === '') {
                continue;
            }

            const matched = this._matchField(item, field, searchValue);

            if (logic === 'OR' && matched) {
                return true;  // OR: 任一匹配即通过
            }
            if (logic === 'AND' && !matched) {
                return false; // AND: 任一不匹配即失败
            }
        }

        // AND: 所有都通过 | OR: 没有一个匹配
        return logic === 'AND';
    }

    /**
     * 匹配单个字段
     * 默认使用不区分大小写的子字符串匹配
     */
    private _matchField(item: T, field: FilterField<T>, searchValue: string): boolean {
        const fieldValue = field.extractor(item);
        const search = searchValue.toLowerCase();

        // 空值处理
        if (fieldValue == null) {
            return false;
        }

        // 支持数组值（如 players）
        if (Array.isArray(fieldValue)) {
            return fieldValue.some(v => v != null && v.toLowerCase().includes(search));
        }

        return fieldValue.toLowerCase().includes(search);
    }
}
