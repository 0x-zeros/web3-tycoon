#!/bin/bash

# Walrus 部署准备脚本
# 功能：将 Cocos Creator 构建的 web-mobile 文件复制到 walrus/web-mobile 目录
#      排除 assets 文件夹以减少 Walrus 存储成本

set -e  # 遇到错误立即退出

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 获取脚本所在目录（支持从任何位置执行）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# 源目录和目标目录
SOURCE_DIR="$PROJECT_ROOT/client/tycoon_cocos/build/web-mobile"
TARGET_DIR="$SCRIPT_DIR/web-mobile"

echo -e "${GREEN}=== Walrus 部署准备 ===${NC}"
echo "项目根目录: $PROJECT_ROOT"
echo "源目录: $SOURCE_DIR"
echo "目标目录: $TARGET_DIR"
echo ""

# 检查源目录是否存在
if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}错误: 源目录不存在${NC}"
    echo "请先在 Cocos Creator 中构建 Web Mobile 版本"
    echo "路径: $SOURCE_DIR"
    exit 1
fi

# 确保目标目录存在
mkdir -p "$TARGET_DIR"

# 保存 ws-resources.json（如果存在）
WS_CONFIG="$TARGET_DIR/ws-resources.json"
TEMP_CONFIG="/tmp/ws-resources.json.backup.$$"

if [ -f "$WS_CONFIG" ]; then
    echo -e "${YELLOW}备份配置文件: ws-resources.json${NC}"
    cp "$WS_CONFIG" "$TEMP_CONFIG"
fi

# 清理目标目录（但保留 .gitignore）
echo -e "${YELLOW}清理目标目录...${NC}"
find "$TARGET_DIR" -mindepth 1 -not -name '.gitignore' -not -name 'ws-resources.json' -delete

# 复制文件（排除顶层 assets 目录）
echo -e "${GREEN}复制文件（排除顶层 assets 目录）...${NC}"

# 使用 rsync 或 cp 复制，只排除顶层 assets
if command -v rsync &> /dev/null; then
    # 使用 rsync（更高效）
    # 注意：--exclude='/assets' 中的 / 表示只匹配根目录的 assets
    rsync -av --exclude='/assets' "$SOURCE_DIR/" "$TARGET_DIR/"
else
    # 使用 cp（兼容性更好）
    cd "$SOURCE_DIR"
    for item in *; do
        if [ "$item" != "assets" ]; then
            echo "  复制: $item"
            cp -r "$item" "$TARGET_DIR/"
        fi
    done
    cd - > /dev/null
fi

# 恢复 ws-resources.json
if [ -f "$TEMP_CONFIG" ]; then
    echo -e "${YELLOW}恢复配置文件: ws-resources.json${NC}"
    mv "$TEMP_CONFIG" "$WS_CONFIG"
fi

# 显示统计信息
echo ""
echo -e "${GREEN}=== 复制完成 ===${NC}"
echo "目标目录内容:"
ls -lh "$TARGET_DIR" | grep -v "^total" | awk '{print "  " $9 " (" $5 ")"}'

# 检查是否正确排除了顶层 assets
if [ -d "$TARGET_DIR/assets" ]; then
    echo -e "${RED}警告: 顶层 assets 目录未被排除！${NC}"
    exit 1
else
    echo -e "${GREEN}✓ 顶层 assets 目录已成功排除${NC}"
fi

# 检查子目录的 assets 是否保留
if [ -d "$TARGET_DIR/cocos-js/assets" ]; then
    echo -e "${GREEN}✓ 子目录 cocos-js/assets 已保留${NC}"
fi

# 检查 ws-resources.json 是否存在
if [ -f "$WS_CONFIG" ]; then
    echo -e "${GREEN}✓ ws-resources.json 配置文件存在${NC}"
else
    echo -e "${YELLOW}⚠ ws-resources.json 不存在（首次部署会自动创建）${NC}"
fi

echo ""
echo -e "${GREEN}准备完成！现在可以执行部署命令：${NC}"
echo "  cd $SCRIPT_DIR"
echo "  ./site-builder deploy web-mobile --epochs 5"
echo ""
