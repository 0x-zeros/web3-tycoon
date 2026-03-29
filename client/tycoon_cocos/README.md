# Web3 Tycoon - Cocos Creator Client

基于 Cocos Creator 3.8.7 的客户端项目。

## 首次启动前

新 clone 项目后，必须先安装依赖，否则 Cocos Creator 会报模块找不到的错误：

```bash
cd client/tycoon_cocos
npm install
```

> `postinstall` 会自动运行 `scripts/fix-sui-modules.js`，修复 @mysten/sui 与 Cocos Creator Rollup 打包的兼容性问题。

安装完成后，在 Cocos Creator 3.8.7 中打开本目录即可。
