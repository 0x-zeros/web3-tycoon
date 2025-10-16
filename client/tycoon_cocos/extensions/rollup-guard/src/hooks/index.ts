/**
 * Rollup Guard - 构建钩子（后处理方案）
 * 在构建完成后修改输出 JS，保留 ES2020+ 语法
 */

import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import { minify } from 'terser';

const PKG = 'rollup-guard';

function log(...args: any[]) {
    console.log(`[${PKG}]`, ...args);
}

function ensureDir(p: string) {
    if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
    }
}

/**
 * 使用 Terser 以 ES2020 重新压缩 JS 文件
 * 关键：设置 ecma: 2020 可以保留 BigInt 和 ** 运算符
 */
async function retargetToES2020(outDir: string): Promise<void> {
    log('开始以 ES2020 重新压缩输出 JS...');

    // 只处理 Web 平台产物的 JS（避免处理原生/DTS 等）
    const patterns = [
        'src/**/*.js',
        'assets/**/*.js'
    ];

    const files = await fg(patterns, {
        cwd: outDir,
        absolute: true,
        suppressErrors: true
    });

    log(`找到 ${files.length} 个 JS 文件需要处理`);

    let processedCount = 0;
    for (const file of files) {
        try {
            const code = fs.readFileSync(file, 'utf8');

            // 关键：使用 ecma >= 2020，避免把 ** / BigInt 降级为 Math.pow
            const result = await minify(code, {
                ecma: 2020,
                compress: {
                    ecma: 2020,
                    passes: 1
                },
                mangle: false,  // 为了调试方便，不混淆；如需混淆可改为 true
                format: {
                    ecma: 2020
                }
            });

            if (result.code) {
                fs.writeFileSync(file, result.code, 'utf8');
                processedCount++;
            }
        } catch (error: any) {
            log(`处理失败 ${file}:`, error.message);
        }
    }

    log(`✓ 重新压缩完成，处理了 ${processedCount} 个文件`);
}

/**
 * 复制 @mysten/* 的 ESM 文件到构建目录，并生成 Import Map
 *
 * 注意：需要根据实际 node_modules 中的包结构调整 ESM 入口路径
 */
function copyMystenESM(projectRoot: string, outDir: string): void {
    log('开始复制 @mysten/* ESM 文件...');

    // ESM 入口映射（根据实际 package.json 的 exports 字段调整）
    const mapping: Record<string, string> = {
        '@mysten/sui/client': 'node_modules/@mysten/sui/dist/esm/client/index.js',
        '@mysten/sui/transactions': 'node_modules/@mysten/sui/dist/esm/transactions/index.js',
        '@mysten/sui/bcs': 'node_modules/@mysten/sui/dist/esm/bcs/index.js',
        '@mysten/sui/keypairs/ed25519': 'node_modules/@mysten/sui/dist/esm/keypairs/ed25519/index.js',
        '@mysten/sui/utils': 'node_modules/@mysten/sui/dist/esm/utils/index.js',
        '@mysten/wallet-standard': 'node_modules/@mysten/wallet-standard/dist/esm/index.js',
        '@mysten/bcs': 'node_modules/@mysten/bcs/dist/esm/index.js'
    };

    const libsDir = path.join(outDir, 'libs');
    ensureDir(libsDir);

    const importMap: Record<string, string> = {};
    let copiedCount = 0;

    for (const [spec, rel] of Object.entries(mapping)) {
        const abs = path.join(projectRoot, rel);

        if (!fs.existsSync(abs)) {
            log(`WARN: 未找到 ${abs}`);
            log(`      请检查该包的 ESM 入口路径`);
            continue;
        }

        // 生成文件名（替换特殊字符）
        const fileName = spec.replace(/[@/]/g, '_') + '.js';
        const dest = path.join(libsDir, fileName);

        try {
            // 复制文件
            fs.copyFileSync(abs, dest);

            // 添加到 Import Map
            importMap[spec] = `./libs/${fileName}`;
            copiedCount++;

            log(`  ✓ ${spec} -> libs/${fileName}`);
        } catch (error: any) {
            log(`  ✗ 复制失败 ${spec}:`, error.message);
        }
    }

    // 写入 importmap.json
    if (Object.keys(importMap).length > 0) {
        const importMapData = {
            imports: importMap
        };

        const importMapPath = path.join(outDir, 'importmap.json');
        fs.writeFileSync(importMapPath, JSON.stringify(importMapData, null, 2), 'utf-8');

        log(`✓ Import Map 已写入: ${importMapPath}`);
        log(`  共 ${copiedCount} 个模块被外部化`);
    } else {
        log('WARN: 没有找到可用的 ESM 文件，Import Map 未生成');
    }
}

/**
 * 构建完成后执行（关键钩子）
 */
export async function onAfterBuild(options: any, result: any): Promise<void> {
    log('==========================================');
    log('onAfterBuild - 开始后处理...');

    try {
        const outDir = result.dest;
        const projectRoot = options?.project || options?.projectRoot || process.cwd();
        const platform = options?.platform || result?.platform || 'unknown';

        log('Platform:', platform);
        log('Output:', outDir);
        log('Project:', projectRoot);

        // 读取扩展面板选项
        const cfg = options?.packages?.[PKG] || {};
        const retargetES2020 = cfg.retargetES2020 !== false;
        const externalizeMysten = cfg.externalizeMysten !== false;

        log('配置: retargetES2020 =', retargetES2020);
        log('配置: externalizeMysten =', externalizeMysten);

        // 只处理 Web 平台
        if (!platform.startsWith('web')) {
            log('非 Web 平台，跳过处理');
            log('==========================================');
            return;
        }

        // 1. 重新压缩为 ES2020
        if (retargetES2020) {
            await retargetToES2020(outDir);
        }

        // 2. 外部化 @mysten/*
        if (externalizeMysten) {
            copyMystenESM(projectRoot, outDir);
        }

        log('✓ 后处理完成');
        log('==========================================');

    } catch (error: any) {
        log('✗ 后处理失败:', error);
        log('Stack:', error.stack);
        log('==========================================');
        // 不抛出异常，避免阻塞构建
    }
}
