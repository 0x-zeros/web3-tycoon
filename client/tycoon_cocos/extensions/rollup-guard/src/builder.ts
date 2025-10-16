/**
 * Rollup Guard - Cocos Creator 构建扩展
 * 强制 ES2020+，保护 BigInt/**，并通过 Import Map 外部化 @mysten/*
 */

export interface IConfigs {
    [platform: string]: {
        hooks: string;
        options?: any;
    };
}

/**
 * 为 web-desktop 和 web-mobile 平台配置钩子和构建面板选项
 */
export const configs: IConfigs = {
    'web-desktop': {
        hooks: './hooks',
        options: {
            retargetES2020: {
                label: '重压缩为 ES2020+（保留 BigInt/**）',
                description: '使用 Terser 以 ES2020 重新压缩输出 JS，防止 BigInt 和 ** 被降级',
                render: {
                    ui: 'ui-checkbox'
                },
                default: true
            },
            externalizeMysten: {
                label: '外部化 @mysten/*（Import Map）',
                description: '将 @mysten 包作为原生 ESM 加载，完全跳过打包/转译',
                render: {
                    ui: 'ui-checkbox'
                },
                default: true
            }
        }
    },
    'web-mobile': {
        hooks: './hooks',
        options: {
            retargetES2020: {
                label: '重压缩为 ES2020+（保留 BigInt/**）',
                description: '使用 Terser 以 ES2020 重新压缩输出 JS，防止 BigInt 和 ** 被降级',
                render: {
                    ui: 'ui-checkbox'
                },
                default: true
            },
            externalizeMysten: {
                label: '外部化 @mysten/*（Import Map）',
                description: '将 @mysten 包作为原生 ESM 加载，完全跳过打包/转译',
                render: {
                    ui: 'ui-checkbox'
                },
                default: true
            }
        }
    }
};
