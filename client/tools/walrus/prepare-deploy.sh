#!/bin/bash

# Walrus 部署准备脚本
# 功能：将 Cocos Creator 构建的 web-walrus 文件复制到 walrus/web-walrus 目录
#      排除 remote 文件夹（远程资源），保留本地 assets 以实现自包含部署

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
SOURCE_DIR="$PROJECT_ROOT/client/tycoon_cocos/build/web-walrus"
TARGET_DIR="$SCRIPT_DIR/web-walrus"

echo -e "${GREEN}=== Walrus 部署准备 ===${NC}"
echo "项目根目录: $PROJECT_ROOT"
echo "源目录: $SOURCE_DIR"
echo "目标目录: $TARGET_DIR"
echo ""

# 检查源目录是否存在
if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}错误: 源目录不存在${NC}"
    echo "请先在 Cocos Creator 中构建 Web Walrus 版本"
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

# 复制文件（排除顶层 remote 目录）
echo -e "${GREEN}复制文件（排除顶层 remote 目录）...${NC}"

# 使用 rsync 或 cp 复制，只排除顶层 remote
if command -v rsync &> /dev/null; then
    # 使用 rsync（更高效）
    # 注意：--exclude='/remote' 中的 / 表示只匹配根目录的 remote
    rsync -av --exclude='/remote' "$SOURCE_DIR/" "$TARGET_DIR/"
else
    # 使用 cp（兼容性更好）
    cd "$SOURCE_DIR"
    for item in *; do
        if [ "$item" != "remote" ]; then
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

# 检查是否正确排除了顶层 remote
if [ -d "$TARGET_DIR/remote" ]; then
    echo -e "${RED}警告: 顶层 remote 目录未被排除！${NC}"
    exit 1
else
    echo -e "${GREEN}✓ 顶层 remote 目录已成功排除${NC}"
fi

# 检查 assets 是否保留
if [ -d "$TARGET_DIR/assets" ]; then
    echo -e "${GREEN}✓ assets 目录已保留（本地资源）${NC}"
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
echo "  ./site-builder deploy web-walrus --epochs 5"
echo ""

# 统计信息
echo -e "${GREEN}=== 统计信息 ===${NC}"

# 统计文件和目录数量
FILE_COUNT=$(find "$TARGET_DIR" -type f | wc -l | xargs)
DIR_COUNT=$(find "$TARGET_DIR" -type d | wc -l | xargs)

echo "文件数量: $FILE_COUNT 个"
echo "目录数量: $DIR_COUNT 个"

# 统计总大小
TOTAL_SIZE=$(du -sh "$TARGET_DIR" | awk '{print $1}')
echo "总大小: $TOTAL_SIZE"

# 分类统计主要目录
echo ""
echo "主要目录大小:"
for dir in assets cocos-js libs src; do
    if [ -d "$TARGET_DIR/$dir" ]; then
        SIZE=$(du -sh "$TARGET_DIR/$dir" 2>/dev/null | awk '{print $1}')
        FILES=$(find "$TARGET_DIR/$dir" -type f | wc -l | xargs)
        echo "  $dir/: $SIZE ($FILES 文件)"
    fi
done

echo ""
