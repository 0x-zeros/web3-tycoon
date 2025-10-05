#!/usr/bin/env bash

# # 使用示例
# # 发布到测试网
# ./publish.sh testnet

# # 发布到主网
# ./publish.sh mainnet

# local
# ./publish.sh local

# # 带额外参数发布
# ./publish.sh testnet --gas-budget 10000000


# 设置严格的错误处理模式
# -E: ERR trap会被shell函数继承
# -e: 命令失败时立即退出
# -u: 使用未定义变量时报错
# -o pipefail: 管道中任何命令失败都会导致整个管道失败
set -Eeuo pipefail

# 切换到脚本所在目录，静默执行（防止目录名以-开头时被误认为选项）
cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null

# 检查依赖工具是否可用
# 设置SUI命令变量，优先使用环境变量SUI，否则默认为'sui'
SUI=${SUI:-sui}
# 循环检查jq和sui命令是否安装
for i in jq $SUI; do
  # 使用command -v检查命令是否存在，静默执行
  if ! command -v "${i}" &>/dev/null; then
    echo "${i} is not installed"
    exit 1
  fi
done

# 检查是否提供了环境参数（如testnet、mainnet）
if [ -z "$1" ]; then
    echo "Error: No environment provided."
    exit 1
fi
# 保存环境参数并移除已处理的参数
ENV="$1"; shift
# 切换到指定的Sui网络环境
$SUI client switch --env "$ENV"

# 发布Move合约并获取JSON格式的结果
# ../tycoon指定要发布的Move包目录，--json以JSON格式输出，"$@"传递所有剩余参数
PUBLISH=$($SUI client publish ../tycoon --json "$@")

# 使用jq美化输出JSON结果
echo "================================================================================================"
echo "Publish Result:"
echo "------------------------------------------------"
printf '%s' "$PUBLISH" | jq '.'
echo "================================================================================================"

# 从发布结果中提取交易状态
# 使用jq命令解析JSON，-r参数输出原始字符串（不带引号）
STATUS=$(
    printf '%s' "$PUBLISH" |
        jq -r '.effects.status.status'
)

# 检查发布状态是否为成功
if [[ $STATUS != "success" ]]; then
    echo "Error: Move contract publishing failed. Status:"
    printf '%s' "$PUBLISH" | jq '.effects.status'
    exit 1
fi

# 从发布结果中提取包ID
# 遍历所有对象变更，筛选类型为"published"的变更，提取packageId
PACKAGE_ID=$(
    printf '%s' "$PUBLISH" |
        jq -r '.objectChanges[] | select(.type == "published") | .packageId'
)

# 从发布结果中提取升级权限对象ID
# 筛选类型为"created"且对象类型包含"UpgradeCap"的变更，提取objectId
UPGRADE_CAP=$(
    printf '%s' "$PUBLISH" |
        jq -r '.objectChanges[]
            | select(.type == "created")
            | select(.objectType | contains("0x2::package::UpgradeCap"))
            | .objectId'
)

# 提取游戏相关对象
echo "================================================================================================"
echo "Game Objects Analysis:"
echo "------------------------------------------------"

# 提取 AdminCap
ADMIN_CAP=$(printf '%s' "$PUBLISH" | jq -r '.objectChanges[] | select(.type == "created") | select(.objectType | contains("admin::AdminCap")) | .objectId' | head -1)
if [ -n "${ADMIN_CAP:-}" ]; then
    echo "AdminCap Object ID: $ADMIN_CAP"
else
    echo "AdminCap Object ID: Not found"
fi

# 提取 GameData（统一的游戏数据容器，包含所有注册表）
GAME_DATA=$(printf '%s' "$PUBLISH" | jq -r '.objectChanges[] | select(.type == "created") | select(.objectType | contains("tycoon::GameData")) | .objectId' | head -1)
if [ -n "${GAME_DATA:-}" ]; then
    echo "GameData Object ID: $GAME_DATA"
else
    echo "GameData Object ID: Not found"
fi

echo "================================================================================================"


# 构建前端配置文件路径
# $ENV 为local, 替换为localnet
if [ "$ENV" = "local" ]; then
    CONFIG_ENV="localnet"
else
    CONFIG_ENV="$ENV"
fi

# CLI配置文件
CLI_CONFIG_DIR="../cli/src/config"
mkdir -p "$CLI_CONFIG_DIR"
CLI_CONFIG="$CLI_CONFIG_DIR/env.$CONFIG_ENV.ts"
cat > "$CLI_CONFIG" <<EOF
const env = {
    packageId: '$PACKAGE_ID',
    upgradeCap: '$UPGRADE_CAP',
    adminCap: '$ADMIN_CAP',
    gameData: '$GAME_DATA',
};

export default env;
EOF

# Cocos工程配置文件
COCOS_CONFIG_DIR="../../client/tycoon_cocos/assets/scripts/config"
mkdir -p "$COCOS_CONFIG_DIR"
COCOS_CONFIG="$COCOS_CONFIG_DIR/env.$CONFIG_ENV.ts"
cat > "$COCOS_CONFIG" <<EOF
/**
 * Sui区块链环境配置
 * 自动生成于: $(date '+%Y-%m-%d %H:%M:%S')
 */
export const SuiEnvConfig = {
    packageId: '$PACKAGE_ID',
    upgradeCap: '$UPGRADE_CAP',
    adminCap: '$ADMIN_CAP',
    gameData: '$GAME_DATA',
    network: '$CONFIG_ENV',
};
EOF

# # 构建CLI环境文件的绝对路径
# ENV="$(readlink -f ../cli)/$ENV.env"
# # 生成CLI环境变量配置文件，使用here document语法（-EOF忽略前导制表符）
# cat > $ENV <<-EOF
# PKG=$PACKAGE_ID
# CAP=$UPGRADE_CAP
# EOF

# 输出部署完成信息和生成的配置文件路径
echo "================================================================================================"
echo "Deployment Summary:"
echo "------------------------------------------------"
echo "Package ID: $PACKAGE_ID"
echo "Upgrade Cap: $UPGRADE_CAP"
echo "Admin Cap: $ADMIN_CAP"
echo "Game Data: $GAME_DATA"
echo "================================================================================================"
echo "Tycoon Game Contract Deployment finished!"
echo "CLI config written to: $CLI_CONFIG"
echo "Cocos config written to: $COCOS_CONFIG"
