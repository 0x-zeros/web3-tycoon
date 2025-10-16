#!/bin/bash

# 清理 Cocos Creator 构建缓存脚本
# 用于解决 GraphQL shim 配置后需要清除旧缓存的问题

set -e

echo "🧹 开始清理 Cocos Creator 构建缓存..."

# 清理 temp 目录
if [ -d "temp" ]; then
    echo "  - 删除 temp/"
    rm -rf temp
fi

# 清理 library 目录
if [ -d "library" ]; then
    echo "  - 删除 library/"
    rm -rf library
fi

# 清理 build 目录
if [ -d "build" ]; then
    echo "  - 删除 build/"
    rm -rf build
fi

# 清理 node_modules/.cache（如果存在）
if [ -d "node_modules/.cache" ]; then
    echo "  - 删除 node_modules/.cache/"
    rm -rf node_modules/.cache
fi

echo ""
echo "✅ 缓存清理完成！"
echo ""
echo "📋 下一步操作："
echo "  1. 在 Cocos Creator 编辑器中重新打开项目"
echo "  2. 等待编译完成（可能需要几分钟）"
echo "  3. 执行构建测试，验证 GraphQL 错误是否已解决"
echo ""
echo "💡 提示："
echo "  - 如果仍有问题，尝试重启 Cocos Creator 编辑器"
echo "  - 如果错误信息提到 'graphql'，检查 tsconfig.json 的 paths 配置"
echo "  - 如果抛出 '[shim/graphql] XXX was called'，说明有代码意外使用了 GraphQL"
echo ""
