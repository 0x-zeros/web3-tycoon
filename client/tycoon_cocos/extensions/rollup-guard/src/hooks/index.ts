/**
 * Rollup Guard - 构建钩子
 * 功能：优化 Sui SDK 加载顺序
 *
 * 问题：sui.system.js 使用 System.register()，但在 system.bundle.js 加载前执行会报错
 * 解决：将 sui.system.js 改为通过 System.import() 链式加载
 */

import * as fs from 'fs';
import * as path from 'path';

const PKG = 'rollup-guard';

function log(...args: any[]) {
    console.log(`[${PKG}]`, ...args);
}

/**
 * 在 index.html 中修改 sui.system.js 加载顺序
 * 改为使用 System.import() 链式调用，确保在 system.bundle.js 之后加载
 */
function injectSuiSystemLoader(outDir: string): void {
    const indexPath = path.join(outDir, 'index.html');

    if (!fs.existsSync(indexPath)) {
        log('WARN: index.html 不存在');
        return;
    }

    log('修改 sui.system.js 加载顺序...');

    let html = fs.readFileSync(indexPath, 'utf-8');
    let modified = false;

    // 1. 删除独立的 sui.system.js 脚本标签（如果存在）
    const suiScriptRegex = /<script[^>]*src=["']\.\/libs\/sui\.system\.js["'][^>]*><\/script>\s*/gi;
    if (suiScriptRegex.test(html)) {
        html = html.replace(suiScriptRegex, '');
        log('  ✓ 已删除独立的 sui.system.js 脚本标签');
        modified = true;
    }

    // 2. 查找并修改 System.import() 调用
    // 匹配整个 <script> 块，包含 System.import() 调用
    // 使用 .*? 非贪婪匹配 .catch() 中的任意内容（包括 function 和大括号）
    const scriptBlockRegex = /<script>\s*System\.import\(['"]([^'"]+)['"]\)\.catch\(.*?\)\s*<\/script>/gs;
    const match = scriptBlockRegex.exec(html);

    if (match) {
        const entryFile = match[1]; // 如 './index.b5968.js'
        const originalBlock = match[0];

        // 检查是否已经是链式调用
        if (!html.includes("System.import('./libs/sui.system.js')")) {
            // 构造新的完整 script 块（添加注释说明）
            const newBlock = `<script>
    // Sui SDK (System.register 格式，必须在应用入口 index.js 之前加载)
    System.import('./libs/sui.system.js')
      .then(() => System.import('${entryFile}'))
      .catch(console.error)
</script>`;

            html = html.replace(originalBlock, newBlock);
            log(`  ✓ 已修改为链式调用: sui.system.js -> ${entryFile}`);
            modified = true;
        } else {
            log('  sui.system.js 链式调用已存在，跳过');
        }
    } else {
        log('  WARN: 未找到 System.import() 调用');
    }

    if (modified) {
        fs.writeFileSync(indexPath, html, 'utf-8');
        log('✓ sui.system.js 加载顺序已优化');
    } else {
        log('  无需修改');
    }
}

/**
 * 构建完成后执行（关键钩子）
 */
export async function onAfterBuild(options: any, result: any): Promise<void> {
    log('==========================================');
    log('onAfterBuild - Sui System Loader');

    try {
        const outDir = result.dest;
        const platform = options?.platform || result?.platform || 'unknown';

        log('Platform:', platform);
        log('Output:', outDir);

        // 只处理 Web 平台
        if (!platform.startsWith('web')) {
            log('非 Web 平台，跳过处理');
            log('==========================================');
            return;
        }

        // 修改 sui.system.js 加载顺序
        injectSuiSystemLoader(outDir);

        log('✓ 处理完成');
        log('==========================================');

    } catch (error: any) {
        log('✗ 处理失败:', error);
        log('Stack:', error.stack);
        log('==========================================');
        // 不抛出异常，避免阻塞构建
    }
}
