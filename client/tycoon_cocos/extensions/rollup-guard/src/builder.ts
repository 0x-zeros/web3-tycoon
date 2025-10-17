/**
 * Rollup Guard - Cocos Creator 构建扩展
 * 功能：优化 Sui SDK 加载顺序，使用 System.import() 链式调用
 */

export interface IConfigs {
    [platform: string]: {
        hooks: string;
        options?: any;
    };
}

/**
 * 为 web-desktop 和 web-mobile 平台配置钩子
 */
export const configs: IConfigs = {
    'web-desktop': {
        hooks: './hooks'
    },
    'web-mobile': {
        hooks: './hooks'
    }
};
