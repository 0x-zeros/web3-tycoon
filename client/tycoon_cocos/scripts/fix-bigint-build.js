#!/usr/bin/env node
/**
 * 构建后处理脚本：注入 Math.pow BigInt Polyfill
 *
 * 用法：node scripts/fix-bigint-build.js <build-dir>
 * 例如：node scripts/fix-bigint-build.js build/web-desktop-012
 */

const fs = require('fs');
const path = require('path');

const buildDir = process.argv[2] || 'build/web-desktop';
const indexPath = path.join(buildDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error(`❌ 找不到 ${indexPath}`);
  process.exit(1);
}

const polyfillScript = `
<script>
// Fix: Math.pow 不支持 BigInt 参数
// Rollup 会将 @mysten/bcs 中的 2n ** 64n 转译成 Math.pow(2n, 64n)
(function() {
  var originalPow = Math.pow;
  Math.pow = function(base, exponent) {
    if (typeof base === 'bigint' || typeof exponent === 'bigint') {
      return BigInt(base) ** BigInt(exponent);
    }
    return originalPow.call(Math, base, exponent);
  };
})();
console.log('[Fix] Math.pow BigInt polyfill loaded');
</script>
`;

let html = fs.readFileSync(indexPath, 'utf8');

// 在第一个 <script> 标签之前注入 polyfill
if (html.includes('Math.pow BigInt polyfill')) {
  console.log('✅ Polyfill 已存在，跳过');
} else {
  html = html.replace(/(<script[^>]*src=)/i, polyfillScript + '\n$1');
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('✅ 已在 index.html 中注入 Math.pow BigInt polyfill');
  console.log(`   文件: ${indexPath}`);
}
