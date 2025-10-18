#!/usr/bin/env node
/**
 * 构建后脚本：复制 logo.png 到构建目录
 *
 * 功能：
 * - 将 assets/resources/textures/logo.png 复制到 build/web-mobile/
 * - 支持预览模式（复制到项目根目录）
 *
 * 使用方法：
 * - 构建后手动运行: node scripts/copy-logo.js
 * - 或添加到 package.json scripts 中自动执行
 */

const fs = require('fs');
const path = require('path');

// 源文件路径
const SOURCE_LOGO = path.join(__dirname, '../assets/resources/textures/logo.png');

// 目标路径
const BUILD_TARGETS = [
    path.join(__dirname, '../build/web-mobile/logo.png'),      // 构建目录
    path.join(__dirname, '../build/web-desktop/logo.png'),     // 桌面构建
    path.join(__dirname, '../logo.png')                        // 预览模式（项目根目录）
];

/**
 * 复制文件
 */
function copyFile(source, dest) {
    try {
        // 检查源文件是否存在
        if (!fs.existsSync(source)) {
            console.error(`[copy-logo] 源文件不存在: ${source}`);
            return false;
        }

        // 确保目标目录存在
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) {
            console.log(`[copy-logo] 创建目录: ${destDir}`);
            fs.mkdirSync(destDir, { recursive: true });
        }

        // 复制文件
        fs.copyFileSync(source, dest);
        console.log(`[copy-logo] ✓ 复制成功: ${dest}`);
        return true;

    } catch (error) {
        console.error(`[copy-logo] ✗ 复制失败: ${dest}`);
        console.error(`  错误: ${error.message}`);
        return false;
    }
}

/**
 * 主函数
 */
function main() {
    console.log('[copy-logo] 开始复制 logo.png...');
    console.log(`[copy-logo] 源文件: ${SOURCE_LOGO}`);

    let successCount = 0;
    let skipCount = 0;

    for (const target of BUILD_TARGETS) {
        const targetDir = path.dirname(target);

        // 检查目标目录是否存在（跳过不存在的构建目录）
        if (!fs.existsSync(targetDir) && targetDir.includes('build/')) {
            console.log(`[copy-logo] ⊘ 跳过（目录不存在）: ${target}`);
            skipCount++;
            continue;
        }

        if (copyFile(SOURCE_LOGO, target)) {
            successCount++;
        }
    }

    console.log('\n[copy-logo] 完成！');
    console.log(`  成功: ${successCount}`);
    console.log(`  跳过: ${skipCount}`);
    console.log(`  失败: ${BUILD_TARGETS.length - successCount - skipCount}`);
}

// 执行
main();
