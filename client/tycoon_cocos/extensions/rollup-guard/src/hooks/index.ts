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

    // 匹配所有 JS 文件（包括 src/chunks/）
    const patterns = [
        '**/*.js',          // 所有 JS 文件
        '!node_modules/**', // 排除 node_modules
        '!libs/**'          // 排除我们复制的 libs（已经是 ES2020+）
    ];

    const files = await fg(patterns, {
        cwd: outDir,
        absolute: true,
        suppressErrors: true
    });

    log(`找到 ${files.length} 个 JS 文件需要处理`);

    let processedCount = 0;
    let fixedBigIntCount = 0;

    for (const file of files) {
        try {
            let code = fs.readFileSync(file, 'utf8');

            // ⚠️ 关键修复：将 Math.pow(bigint, bigint) 回写为 ** 运算符
            // 匹配: Math.pow(2n, 64n) 或 Math.pow(e, t) 其中 e、t 可能是 BigInt
            const originalCode = code;
            code = code.replace(/Math\.pow\(([^,)]+n),\s*([^)]+n)\)/g, '($1 ** $2)');

            if (code !== originalCode) {
                fixedBigIntCount++;
                log(`  修复 BigInt Math.pow: ${path.basename(file)}`);
            }

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
            log(`处理失败 ${path.basename(file)}:`, error.message);
        }
    }

    log(`✓ 重新压缩完成，处理了 ${processedCount} 个文件`);
    if (fixedBigIntCount > 0) {
        log(`✓ 修复了 ${fixedBigIntCount} 个文件的 BigInt Math.pow 问题`);
    }
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
 * 修改 SystemJS Import Map（src/import-map.*.json）
 * 添加 @mysten/* 到真实 ESM 文件的映射
 */
function injectSystemJSImportMap(outDir: string): void {
    log('修改 SystemJS Import Map...');

    // 1. 查找 src/import-map.*.json
    const srcDir = path.join(outDir, 'src');
    if (!fs.existsSync(srcDir)) {
        log('WARN: src 目录不存在');
        return;
    }

    const srcFiles = fs.readdirSync(srcDir);
    let importMapFile: string | null = null;

    for (const file of srcFiles) {
        if (file.match(/^import-map\.[a-f0-9]+\.json$/)) {
            importMapFile = file;
            break;
        }
    }

    if (!importMapFile) {
        log('WARN: 未找到 SystemJS import-map 文件');
        return;
    }

    const importMapPath = path.join(srcDir, importMapFile);
    log(`  找到文件: src/${importMapFile}`);

    // 2. 读取现有的 import-map
    let importMapData: any;
    try {
        const content = fs.readFileSync(importMapPath, 'utf-8');
        importMapData = JSON.parse(content);
    } catch (error: any) {
        log('ERROR: 读取 import-map 失败:', error.message);
        return;
    }

    log('  原始内容:', JSON.stringify(importMapData));

    // 3. 添加 @mysten/* 映射
    if (!importMapData.imports) {
        importMapData.imports = {};
    }

    // 映射到 libs/ 目录（相对于 src/import-map.json 的路径）
    const mystenMappings = {
        '@mysten/sui/client': './../libs/_mysten_sui_client.js',
        '@mysten/sui/transactions': './../libs/_mysten_sui_transactions.js',
        '@mysten/sui/bcs': './../libs/_mysten_sui_bcs.js',
        '@mysten/sui/keypairs/ed25519': './../libs/_mysten_sui_keypairs_ed25519.js',
        '@mysten/sui/utils': './../libs/_mysten_sui_utils.js',
        '@mysten/wallet-standard': './../libs/_mysten_wallet-standard.js',
        '@mysten/bcs': './../libs/_mysten_bcs.js'
    };

    let addedCount = 0;
    for (const [spec, target] of Object.entries(mystenMappings)) {
        importMapData.imports[spec] = target;
        addedCount++;
    }

    log(`  添加了 ${addedCount} 个映射`);

    // 4. 写回文件
    fs.writeFileSync(importMapPath, JSON.stringify(importMapData, null, 2), 'utf-8');

    log('✓ SystemJS Import Map 已更新');
    log('  新内容:', JSON.stringify(importMapData, null, 2));
}

/**
 * 构建完成后执行（关键钩子）
 */
export async function onAfterBuild(options: any, result: any): Promise<void> {
    log('==========================================');
    log('onAfterBuild - 开始后处理...');

    try {
        const outDir = result.dest;
        // 从 outDir 反推 projectRoot（outDir = <project>/build/<platform>）
        const projectRoot = path.resolve(outDir, '../..');
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

            // 修改 SystemJS Import Map（src/import-map.*.json）
            injectSystemJSImportMap(outDir);
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
