/**
 * Resource Pack 工具函数
 */

import { NamespacedId, ModelRefInfo } from './types';

const NAMESPACE_DEFAULT = 'minecraft';

/**
 * 解析命名空间ID
 * @param s 输入字符串，如 "minecraft:stone" 或 "stone"
 * @param defaultNs 默认命名空间
 * @returns 解析后的命名空间ID
 */
export function parseNamespacedId(s: string, defaultNs: string = NAMESPACE_DEFAULT): NamespacedId {
    if (!s) {
        return { ns: defaultNs, path: '' };
    }
    
    const colonIndex = s.indexOf(':');
    if (colonIndex > 0 && colonIndex < s.length - 1) {
        return {
            ns: s.substring(0, colonIndex),
            path: s.substring(colonIndex + 1)
        };
    }
    
    return { ns: defaultNs, path: s };
}

/**
 * 解析模型或纹理引用
 * @param s 引用字符串，如 "minecraft:block/stone", "block/stone", "#side", "builtin/cross"
 * @param currentNs 当前命名空间
 * @param type 引用类型 ('model' 或 'texture')
 * @returns 解析后的引用信息
 */
export function parseModelOrTexRef(s: string, currentNs: string, type: 'model' | 'texture'): ModelRefInfo {
    if (!s) {
        return { ns: currentNs, name: 'missing' };
    }
    
    // 处理纹理变量引用
    if (s.startsWith('#')) {
        return {
            kind: 'var',
            ns: currentNs,
            name: s.substring(1)
        };
    }
    
    // 处理内置模型
    if (s.startsWith('builtin/')) {
        return {
            kind: 'builtin',
            builtin: true,
            ns: 'builtin',
            name: s.substring('builtin/'.length)
        };
    }
    
    // 解析命名空间
    const colonIndex = s.indexOf(':');
    if (colonIndex > 0) {
        // 有命名空间，如 "minecraft:block/stone"
        const ns = s.substring(0, colonIndex);
        const pathAfterNs = s.substring(colonIndex + 1);
        
        // 解析域和名称
        const slashIndex = pathAfterNs.indexOf('/');
        if (slashIndex > 0) {
            return {
                kind: 'path',
                ns: ns,
                domain: pathAfterNs.substring(0, slashIndex),
                name: pathAfterNs.substring(slashIndex + 1)
            };
        } else {
            // 没有域，默认为 block
            return {
                kind: 'path',
                ns: ns,
                domain: 'block',
                name: pathAfterNs
            };
        }
    }
    
    // 没有命名空间，如 "block/stone" 或 "stone"
    const slashIndex = s.indexOf('/');
    if (slashIndex > 0) {
        // 有域，如 "block/stone"
        return {
            kind: 'path',
            ns: currentNs,
            domain: s.substring(0, slashIndex),
            name: s.substring(slashIndex + 1)
        };
    } else {
        // 没有域，默认为 block
        return {
            kind: 'path',
            ns: currentNs,
            domain: 'block',
            name: s
        };
    }
}

/**
 * 标准化纹理路径
 * @param texturePath 纹理路径
 * @param currentNs 当前命名空间
 * @returns 标准化后的纹理路径
 */
export function normalizeTexturePath(texturePath: string, currentNs: string = NAMESPACE_DEFAULT): string {
    if (!texturePath) {
        return `${NAMESPACE_DEFAULT}:block/missing`;
    }
    
    // 去掉 # 前缀
    if (texturePath.startsWith('#')) {
        texturePath = texturePath.substring(1);
    }
    
    // 检查是否已经有命名空间
    if (texturePath.includes(':')) {
        return texturePath;
    }
    
    // 检查是否有域
    if (texturePath.includes('/')) {
        return `${currentNs}:${texturePath}`;
    }
    
    // 没有域和命名空间，添加默认的
    return `${currentNs}:block/${texturePath}`;
}

/**
 * 构建资源路径
 * @param ns 命名空间
 * @param type 资源类型 ('blockstates', 'models', 'textures')
 * @param domain 域 (如 'block', 'item')
 * @param name 资源名称
 * @returns 相对路径
 */
export function buildResourcePath(
    ns: string, 
    type: 'blockstates' | 'models' | 'textures',
    domain: string | null,
    name: string
): string {
    let path = `assets/${ns}/${type}`;
    
    if (domain) {
        path += `/${domain}`;
    }
    
    path += `/${name}`;
    
    // blockstates 和 models 需要 .json 后缀
    if (type === 'blockstates' || type === 'models') {
        path += '.json';
    } else if (type === 'textures') {
        // 纹理需要 .png 后缀
        path += '.png';
    }
    
    return path;
}

/**
 * 合并纹理映射（子级覆盖父级）
 * @param parent 父级纹理映射
 * @param child 子级纹理映射
 * @returns 合并后的纹理映射
 */
export function mergeTextures(
    parent: Record<string, string> | undefined,
    child: Record<string, string> | undefined
): Record<string, string> {
    if (!parent && !child) return {};
    if (!parent) return { ...(child || {}) };
    if (!child) return { ...parent };
    
    return { ...parent, ...child };
}

/**
 * 选择默认变体
 * @param variants 变体映射
 * @returns 选中的变体键
 */
export function pickDefaultVariant(variants: any): { key: string; variant: any } | null {
    if (!variants || typeof variants !== 'object') {
        return null;
    }
    
    // 优先选择空字符串键（默认变体）
    if (variants['']) {
        const v = variants[''];
        return {
            key: '',
            variant: Array.isArray(v) ? v[0] : v
        };
    }
    
    // 否则选择第一个可用的变体
    const keys = Object.keys(variants);
    if (keys.length > 0) {
        const firstKey = keys[0];
        const v = variants[firstKey];
        return {
            key: firstKey,
            variant: Array.isArray(v) ? v[0] : v
        };
    }
    
    return null;
}

/**
 * 检查资源是否存在（用于判断是否需要 fallback）
 * @param resourcePath 资源路径
 * @param searchRoots 搜索根目录列表
 * @returns 是否存在
 */
export function checkResourceExists(resourcePath: string, searchRoots: string[]): boolean {
    // 在实际实现中，这里应该检查 Cocos 资源系统
    // 暂时返回 true，后续可以完善
    return true;
}

/**
 * 获取优先纹理键
 * @param textures 纹理映射
 * @returns 优先的纹理键
 */
export function getPreferredTextureKey(textures: Record<string, string>): string | null {
    if (!textures || Object.keys(textures).length === 0) {
        return null;
    }
    
    // 优先级顺序
    const priority = ['all', 'side', 'top', 'front', 'north', 'east', 'south', 'west', 'up', 'down'];
    
    for (const key of priority) {
        if (textures[key]) {
            return key;
        }
    }
    
    // 返回第一个可用的键
    return Object.keys(textures)[0];
}

/**
 * 深度克隆对象
 * @param obj 要克隆的对象
 * @returns 克隆后的对象
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (obj instanceof Date) {
        return new Date(obj.getTime()) as any;
    }
    
    if (obj instanceof Array) {
        const clonedArr: any[] = [];
        for (const item of obj) {
            clonedArr.push(deepClone(item));
        }
        return clonedArr as any;
    }
    
    if (obj instanceof Object) {
        const clonedObj: any = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
    
    return obj;
}