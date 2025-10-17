/**
 * Rollup 配置 - 打包 Sui SDK 为 System.register 格式
 *
 * 关键配置：
 * - format: "system" (SystemJS 格式)
 * - ecma: 2020 (保留 BigInt 和 **)
 * - inlineDynamicImports: true (单文件输出)
 */

import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';

export default {
    input: 'src/index.ts',

    output: {
        file: 'dist/sui.system.js',
        format: 'system',  // ← 关键：SystemJS 格式
        sourcemap: false,
        inlineDynamicImports: true,  // ← 关键：单文件输出
        generatedCode: {
            preset: 'es2015',  // Rollup 只支持 es2015/es5
            constBindings: true  // 使用 const 而不是 var
        }
    },

    plugins: [
        // 替换环境变量
        replace({
            'process.env.NODE_ENV': JSON.stringify('production'),
            preventAssignment: true
        }),

        // 解析 node_modules
        resolve({
            browser: true,
            preferBuiltins: false,
            exportConditions: ['browser', 'module', 'import', 'default']
        }),

        // 转换 CommonJS
        commonjs(),

        // TypeScript 编译
        typescript({
            tsconfig: false,
            compilerOptions: {
                target: 'ES2020',  // ← 关键：ES2020 目标
                module: 'ESNext',
                moduleResolution: 'node',
                esModuleInterop: true,
                skipLibCheck: true,
                declaration: false
            }
        })

        // 压缩（暂时禁用以调试方法丢失问题）
        // terser({
        //     ecma: 2020,
        //     compress: {
        //         ecma: 2020,
        //         passes: 1
        //     },
        //     format: {
        //         ecma: 2020,
        //         comments: false
        //     },
        //     mangle: {
        //         keep_classnames: true,
        //         keep_fnames: true
        //     }
        // })
    ],

    // 外部化（如果有需要）
    external: []
};
