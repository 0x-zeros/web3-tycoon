#!/usr/bin/env node
/**
 * ESM 拷贝工具
 * 将 @mysten/* 和依赖包的 ESM 文件拷贝到 libs/ 目录
 * 并生成完整的 import-map.json（保留原有 shims 映射）
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const LIBS_DIR = path.join(PROJECT_ROOT, 'preview-template/libs');
const IMPORT_MAP_PATH = path.join(PROJECT_ROOT, 'preview-template/import-map.json');

// ===== 需要拷贝的包配置 =====

const PACKAGES = [
    // @mysten 系列（dist/esm/）
    {
        name: '@mysten/sui',
        esmDir: 'node_modules/@mysten/sui/dist/esm',
        entryFile: 'index.js',
        subpaths: [  // 精确子路径映射（用于解决缺少 index.js 的问题）
            'client',
            'transactions',
            'bcs',
            'keypairs/ed25519',
            'utils',
            'faucet'
        ]
    },
    {
        name: '@mysten/wallet-standard',
        esmDir: 'node_modules/@mysten/wallet-standard/dist/esm',
        entryFile: 'index.js',
        subpaths: []  // 根目录即可
    },
    {
        name: '@mysten/bcs',
        esmDir: 'node_modules/@mysten/bcs/dist/esm',
        entryFile: 'index.js',
        subpaths: []
    },
    // 注意：删除 @mysten/utils，避免与 @mysten/sui/utils 混淆

    // @noble 系列（esm/）
    {
        name: '@noble/curves',
        esmDir: 'node_modules/@noble/curves/esm',
        entryFile: 'index.js',
        subpaths: []  // 如果有子路径导入，后续补充
    },
    {
        name: '@noble/hashes',
        esmDir: 'node_modules/@noble/hashes/esm',
        entryFile: 'index.js',
        subpaths: []
    },

    // @scure 系列（lib/esm/）
    {
        name: '@scure/base',
        esmDir: 'node_modules/@scure/base/lib/esm',
        entryFile: 'index.js',
        subpaths: []
    },
    {
        name: '@scure/bip32',
        esmDir: 'node_modules/@scure/bip32/lib/esm',
        entryFile: 'index.js',
        subpaths: []
    },
    {
        name: '@scure/bip39',
        esmDir: 'node_modules/@scure/bip39/lib/esm',
        entryFile: 'index.js',
        subpaths: []
    }
];

// ===== 工具函数 =====

/**
 * 递归复制目录
 */
function copyDirRecursive(src, dest) {
    if (!fs.existsSync(src)) {
        console.warn(`WARN: 源目录不存在: ${src}`);
        return false;
    }

    // 创建目标目录
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }

    return true;
}

/**
 * 读取现有的 import-map.json
 */
function readExistingImportMap() {
    if (!fs.existsSync(IMPORT_MAP_PATH)) {
        return { imports: {} };
    }

    try {
        const content = fs.readFileSync(IMPORT_MAP_PATH, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error('ERROR: 读取 import-map.json 失败:', error.message);
        return { imports: {} };
    }
}

/**
 * 过滤原有映射，保留 shims
 */
function filterShims(imports) {
    const shims = {};
    for (const [key, value] of Object.entries(imports)) {
        // 保留指向 shims/ 的映射
        if (value.includes('/shims/')) {
            shims[key] = value;
        }
    }
    return shims;
}

// ===== 主逻辑 =====

function main() {
    console.log('='.repeat(60));
    console.log('ESM 拷贝工具');
    console.log('='.repeat(60));
    console.log('Project root:', PROJECT_ROOT);
    console.log('Libs directory:', LIBS_DIR);
    console.log('');

    // 1. 清理并创建 libs 目录
    console.log('[Step 1] 准备 libs 目录...');
    if (fs.existsSync(LIBS_DIR)) {
        console.log('  清理现有 libs/');
        fs.rmSync(LIBS_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(LIBS_DIR, { recursive: true });
    console.log('  ✓ libs/ 目录已创建');
    console.log('');

    // 2. 读取现有 import-map，保留 shims
    console.log('[Step 2] 读取现有 import-map...');
    const existingMap = readExistingImportMap();
    const shims = filterShims(existingMap.imports || {});
    console.log('  保留的 shims:', Object.keys(shims));
    console.log('');

    // 3. 拷贝所有包
    console.log('[Step 3] 拷贝 ESM 文件...');
    const newMappings = {};
    let copiedCount = 0;
    let skippedCount = 0;

    for (const pkg of PACKAGES) {
        console.log(`  [${pkg.name}]`);

        const srcDir = path.join(PROJECT_ROOT, pkg.esmDir);
        const destDir = path.join(LIBS_DIR, pkg.name);

        // 拷贝目录
        const success = copyDirRecursive(srcDir, destDir);

        if (success) {
            console.log(`    ✓ 拷贝成功: ${pkg.esmDir} -> libs/${pkg.name}/`);

            // 生成映射
            // 1. 包名 → 入口文件
            newMappings[pkg.name] = `./libs/${pkg.name}/${pkg.entryFile}`;

            // 2. 包名/ → 目录前缀（用于子路径解析）
            newMappings[`${pkg.name}/`] = `./libs/${pkg.name}/`;

            // 3. 精确子路径映射（关键：避免缺少 index.js 的问题）
            if (pkg.subpaths && pkg.subpaths.length > 0) {
                for (const subpath of pkg.subpaths) {
                    const specifier = `${pkg.name}/${subpath}`;
                    const targetFile = `./libs/${pkg.name}/${subpath}/index.js`;

                    // 验证文件是否存在
                    const fullPath = path.join(LIBS_DIR, pkg.name, subpath, 'index.js');
                    if (fs.existsSync(fullPath)) {
                        newMappings[specifier] = targetFile;
                        console.log(`    ✓ 子路径映射: ${specifier} -> ${targetFile}`);
                    } else {
                        console.warn(`    WARN: 子路径文件不存在: ${fullPath}`);
                    }
                }
            }

            copiedCount++;
        } else {
            console.log(`    ✗ 拷贝失败（源目录不存在）`);
            skippedCount++;
        }
    }

    console.log('');
    console.log(`  总计：${copiedCount} 个成功，${skippedCount} 个跳过`);
    console.log('');

    // 4. 合并映射并写入
    console.log('[Step 4] 生成 import-map.json...');

    const finalMap = {
        imports: {
            // 先放 shims（保持在前）
            ...shims,
            // 再放包映射
            ...newMappings
        }
    };

    fs.writeFileSync(
        IMPORT_MAP_PATH,
        JSON.stringify(finalMap, null, 2) + '\n',
        'utf-8'
    );

    console.log('  ✓ import-map.json 已生成');
    console.log(`  总映射数: ${Object.keys(finalMap.imports).length}`);
    console.log(`    - Shims: ${Object.keys(shims).length}`);
    console.log(`    - 包映射: ${Object.keys(newMappings).length}`);
    console.log('');

    // 5. 验证
    console.log('[Step 5] 验证结果...');
    console.log('  libs/ 目录内容:');
    const libsContents = fs.readdirSync(LIBS_DIR);
    for (const item of libsContents) {
        const itemPath = path.join(LIBS_DIR, item);
        if (fs.statSync(itemPath).isDirectory()) {
            console.log(`    - ${item}/`);
        }
    }
    console.log('');

    console.log('='.repeat(60));
    console.log('✓ 完成！');
    console.log('='.repeat(60));
    console.log('');
    console.log('下一步：');
    console.log('1. 检查 import-map.json 内容');
    console.log('2. 在 Cocos Creator 中关联 import-map.json');
    console.log('3. Preview in Editor/Chrome 测试');
}

// ===== 执行 =====

try {
    main();
} catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('✗ 错误');
    console.error('='.repeat(60));
    console.error(error);
    process.exit(1);
}
