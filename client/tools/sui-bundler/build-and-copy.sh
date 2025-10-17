#!/bin/bash
# 构建 Sui SDK 并复制到 Cocos Creator 模板目录

set -e

echo "=========================================="
echo "Sui SDK System.register 打包工具"
echo "=========================================="

# 目标目录
COCOS_ROOT="../../tycoon_cocos"
PREVIEW_LIBS="$COCOS_ROOT/preview-template/libs"
BUILD_MOBILE_LIBS="$COCOS_ROOT/build-templates/web-mobile/libs"
BUILD_DESKTOP_LIBS="$COCOS_ROOT/build-templates/web-desktop/libs"

# 1. 构建
echo "[Step 1] 构建 sui.system.js..."
npm run build

if [ ! -f "dist/sui.system.js" ]; then
    echo "ERROR: 构建失败，dist/sui.system.js 不存在"
    exit 1
fi

FILE_SIZE=$(du -h dist/sui.system.js | cut -f1)
echo "✓ 构建完成，文件大小: $FILE_SIZE"
echo ""

# 2. 复制到 preview-template
echo "[Step 2] 复制到 preview-template..."
mkdir -p "$PREVIEW_LIBS"
cp dist/sui.system.js "$PREVIEW_LIBS/"
echo "✓ 复制到: $PREVIEW_LIBS/sui.system.js"
echo ""

# 3. 复制到 build-templates（自动创建目录）
echo "[Step 3] 复制到 build-templates..."

# web-mobile
mkdir -p "$BUILD_MOBILE_LIBS"
cp dist/sui.system.js "$BUILD_MOBILE_LIBS/"
echo "✓ 复制到: $BUILD_MOBILE_LIBS/sui.system.js"

# web-desktop
mkdir -p "$BUILD_DESKTOP_LIBS"
cp dist/sui.system.js "$BUILD_DESKTOP_LIBS/"
echo "✓ 复制到: $BUILD_DESKTOP_LIBS/sui.system.js"

echo ""
echo "=========================================="
echo "✓ 完成！"
echo "=========================================="
echo ""
echo "下一步："
echo "1. 在 preview-template/index.ejs 添加："
echo "   <script src=\"/libs/sui.system.js\"></script>"
echo ""
echo "2. 在 build-templates/web-*/index.html 添加："
echo "   <script src=\"./libs/sui.system.js\"></script>"
echo ""
echo "3. 修改 loader.ts 使用 System.import()："
echo "   return await System.import('/libs/sui.system.js');"
