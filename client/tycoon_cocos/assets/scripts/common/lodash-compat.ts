/**
 * Lodash/Underscore 兼容工具函数库
 * 实现项目中实际使用的工具函数，提供完整的 TypeScript 类型支持
 */

export const _ = {
    /**
     * 生成指定范围内的随机整数
     * @param min 最小值
     * @param max 最大值
     * @returns 随机整数
     */
    random(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * 延迟执行函数
     * @param func 要执行的函数
     * @param wait 延迟时间（毫秒）
     * @param args 传递给函数的参数
     * @returns 定时器ID
     */
    delay<T extends any[]>(func: (...args: T) => void, wait: number, ...args: T): number {
        return setTimeout(() => func(...args), wait);
    },

    /**
     * 遍历集合
     * @param collection 要遍历的集合
     * @param iteratee 迭代函数
     */
    each(collection: any, iteratee: any): void {
        if (Array.isArray(collection)) {
            for (let i = 0; i < collection.length; i++) {
                iteratee(collection[i], i, collection);
            }
        } else if (collection && typeof collection === 'object') {
            for (const key in collection) {
                if (collection.hasOwnProperty(key)) {
                    iteratee(collection[key], key, collection);
                }
            }
        }
    },

    /**
     * 浅拷贝对象
     * @param obj 要克隆的对象
     * @returns 克隆的对象
     */
    clone<T>(obj: T): T {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (Array.isArray(obj)) {
            return [...obj] as unknown as T;
        }
        
        if (obj instanceof Date) {
            return new Date(obj.getTime()) as unknown as T;
        }
        
        return { ...obj };
    },

    /**
     * 移除数组中的falsy值
     * @param array 要处理的数组
     * @returns 过滤后的数组
     */
    compact<T>(array: (T | null | undefined | false | 0 | '')[]): T[] {
        return array.filter(Boolean) as T[];
    },

    /**
     * 获取当前时间戳
     * @returns 当前时间戳（毫秒）
     */
    now(): number {
        return Date.now();
    },

    /**
     * 打乱数组
     * @param array 要打乱的数组
     * @returns 打乱后的新数组
     */
    shuffle<T>(array: T[]): T[] {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    },

    /**
     * 生成数字范围数组
     * @param start 起始值或终止值（当只有一个参数时）
     * @param end 终止值
     * @param step 步长，默认为1
     * @returns 数字数组
     */
    range(start: number, end?: number, step: number = 1): number[] {
        if (end === undefined) {
            end = start;
            start = 0;
        }
        
        const result: number[] = [];
        if (step > 0) {
            for (let i = start; i < end; i += step) {
                result.push(i);
            }
        } else if (step < 0) {
            for (let i = start; i > end; i += step) {
                result.push(i);
            }
        }
        
        return result;
    }
};

// 默认导出，兼容不同的导入方式
export default _;