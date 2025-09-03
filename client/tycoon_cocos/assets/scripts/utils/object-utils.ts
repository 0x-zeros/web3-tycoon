/**
 * Object utilities
 *
 * 提供兼容旧环境的 fromEntries 功能，不依赖 TS 目标库版本
 */

/**
 * Convert an iterable of key-value pairs into a plain object.
 *
 * 说明：
 * - 输入可以是 Map、数组的数组，或任何可迭代的 [key, value] 结构
 * - 返回值为普通对象，不保留原型
 */
export function fromEntries<K extends PropertyKey, V>(entries: Iterable<readonly [K, V]>): Record<K, V> {
    const result: any = {};
    // 使用 for...of 以兼容 Map 和数组
    for (const pair of entries as Iterable<[K, V]>) {
        if (!pair || pair.length < 2) continue;
        const key = pair[0];
        const value = pair[1];
        (result as Record<K, V>)[key] = value;
    }
    return result as Record<K, V>;
}

/**
 * Safe helper mirroring native signature shape
 * 便于替换 Object.fromEntries 用法
 */
export const ObjectUtils = {
    fromEntries,
};


