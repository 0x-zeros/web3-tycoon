#!/usr/bin/env node
/**
 * 修复 @mysten/sui 模块在 Cocos Creator 构建中的问题
 *
 * 问题：Cocos Creator 打包时，某些 ES6 模块导入被破坏
 * 解决：在 npm install 后自动修补相关文件
 */

const fs = require('fs');
const path = require('path');

function fixSuiModules() {
    console.log('[fix-sui-modules] Starting to fix @mysten/sui modules...');

    // 修复 1: Transaction.js - 添加 resolveTransactionPlugin 的 fallback
    const transactionPath = path.join(__dirname, '../node_modules/@mysten/sui/dist/esm/transactions/Transaction.js');
    if (fs.existsSync(transactionPath)) {
        let content = fs.readFileSync(transactionPath, 'utf8');

        // 检查是否已经修复过
        if (!content.includes('// COCOS_FIX')) {
            // 在 prepareBuild_fn 函数中添加 fallback 处理
            const oldCode = 'await __privateMethod(this, _Transaction_instances, runPlugins_fn).call(this, [...__privateGet(this, _buildPlugins), resolveTransactionPlugin], options);';
            const newCode = `// COCOS_FIX: Ensure resolveTransactionPlugin is available and fix MapIterator issue
  const resolvePlugin = typeof resolveTransactionPlugin === 'function'
    ? resolveTransactionPlugin
    : (await import('./resolve.js')).resolveTransactionPlugin;
  if (typeof resolvePlugin !== 'function') {
    console.error('[Transaction] resolveTransactionPlugin still not a function!', resolvePlugin);
    throw new Error('resolveTransactionPlugin is not a function');
  }
  // COCOS_FIX: Convert MapIterator to Array if needed
  const buildPlugins = __privateGet(this, _buildPlugins);
  const pluginsArray = buildPlugins?.[Symbol.iterator] && !Array.isArray(buildPlugins)
    ? Array.from(buildPlugins)
    : (Array.isArray(buildPlugins) ? buildPlugins : []);
  await __privateMethod(this, _Transaction_instances, runPlugins_fn).call(this, [...pluginsArray, resolvePlugin], options);`;

            content = content.replace(oldCode, newCode);

            fs.writeFileSync(transactionPath, content, 'utf8');
            console.log('[fix-sui-modules] Fixed Transaction.js');
        } else {
            console.log('[fix-sui-modules] Transaction.js already fixed');
        }
    }

    // 修复 2: resolve.js - 确保导出正确
    const resolvePath = path.join(__dirname, '../node_modules/@mysten/sui/dist/esm/transactions/resolve.js');
    if (fs.existsSync(resolvePath)) {
        let content = fs.readFileSync(resolvePath, 'utf8');

        // 检查导出是否正确
        if (!content.includes('// COCOS_FIX_EXPORT')) {
            // 在文件末尾添加额外的导出确认
            content = content.replace(
                'export {\n  getClient,\n  needsTransactionResolution,\n  resolveTransactionPlugin\n};',
                `export {
  getClient,
  needsTransactionResolution,
  resolveTransactionPlugin
};

// COCOS_FIX_EXPORT: Ensure function is exported
if (typeof resolveTransactionPlugin !== 'function') {
  console.error('[resolve.js] resolveTransactionPlugin is not defined as function before export');
}`
            );

            fs.writeFileSync(resolvePath, content, 'utf8');
            console.log('[fix-sui-modules] Fixed resolve.js');
        } else {
            console.log('[fix-sui-modules] resolve.js already fixed');
        }
    }

    console.log('[fix-sui-modules] Fix completed!');
}

// 运行修复
fixSuiModules();