/**
 * Babel 配置 - 修复 @mysten/bcs BigInt 转译问题
 *
 * 问题：Rollup/Babel 会将 node_modules 中的 2n ** 64n 转译成 Math.pow(2n, 64n)
 * 解决：禁止转译 node_modules，保持 BigInt 语法不变
 */

module.exports = function (api) {
  api.cache(true);

  // 现代浏览器 preset（只用于我们自己的代码）
  const modernPreset = ['@babel/preset-env', {
    // 目标环境：支持 ES Modules 的现代浏览器
    targets: { esmodules: true },

    // 关键：不要把 ** 转译为 Math.pow
    exclude: ['transform-exponentiation-operator'],

    loose: false,
  }];

  return {
    // 按目录精确控制转译行为
    overrides: [
      {
        // 我们的代码：使用现代 preset
        test: /assets[\\/]scripts/,
        presets: [modernPreset],
      },
      {
        // 关键：node_modules 完全不转译
        // 保持 @mysten/bcs 的原始 BigInt 语法
        test: /node_modules/,
        presets: [],   // 不套任何 preset
        plugins: [],   // 不跑任何 plugin
      },
    ],
  };
};
