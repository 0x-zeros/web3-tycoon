#!/usr/bin/env bash

# # 使用示例
# # 发布到测试网
# ./publish-profiles.sh testnet

# # 发布到主网
# ./publish-profiles.sh mainnet

# local
# ./publish-profiles.sh local

# # 带额外参数发布
# ./publish-profiles.sh testnet --gas-budget 10000000


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
if [ "$#" -lt 1 ]; then
    echo "Error: No environment provided."
    echo "Usage: $0 <environment>"
    echo "Environment can be: testnet, mainnet, local, devnet"
    exit 1
fi
# 保存环境参数并移除已处理的参数
ENV="$1"; shift
# 切换到指定的Sui网络环境
$SUI client switch --env "$ENV"

# If on devnet or local/localnet, request gas from faucet
# Note: testnet requires manual faucet request from Discord or web interface
if [[ "$ENV" == "devnet" || "$ENV" == "localnet" || "$ENV" == "local" ]]; then
  echo "Requesting gas from faucet for $ENV..."
  $SUI client faucet
  sleep 2 #wait for faucet to be ready， 2s
  $SUI client addresses
  $SUI client balance
elif [[ "$ENV" == "testnet" ]]; then
  echo "Note: For testnet, please request tokens from https://discord.gg/sui or https://faucet.testnet.sui.io"
  echo "Current balance:"
  $SUI client balance
fi

# 发布 tycoon_profiles Move合约并获取JSON格式的结果
PUBLISH=$($SUI client publish ../tycoon_profiles --json "$@")

# 使用jq美化输出JSON结果
echo "================================================================================================"
echo "Publish Result:"
echo "------------------------------------------------"
printf '%s' "$PUBLISH" | jq '.'
echo "================================================================================================"

# 从发布结果中提取交易状态
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
PACKAGE_ID=$(
    printf '%s' "$PUBLISH" |
        jq -r '.objectChanges[] | select(.type == "published") | .packageId'
)

# 从发布结果中提取升级权限对象ID
UPGRADE_CAP=$(
    printf '%s' "$PUBLISH" |
        jq -r '.objectChanges[]
            | select(.type == "created")
            | select(.objectType | contains("0x2::package::UpgradeCap"))
            | .objectId'
)

# 构建前端配置文件路径
# $ENV 为local, 替换为localnet
if [ "$ENV" = "local" ]; then
    CONFIG_ENV="localnet"
else
    CONFIG_ENV="$ENV"
fi

# Cocos工程配置文件
COCOS_CONFIG_DIR="../../client/tycoon_cocos/assets/scripts/config"
COCOS_CONFIG="$COCOS_CONFIG_DIR/env.$CONFIG_ENV.ts"

# 检查配置文件是否存在
if [ ! -f "$COCOS_CONFIG" ]; then
    echo "Error: Config file not found: $COCOS_CONFIG"
    echo "Please run publish.sh first to create the base config file."
    exit 1
fi

# 增量更新配置文件中的 profilesPackageId 字段
# 使用 sed 替换，保持原有格式（带或不带逗号）
sed -i '' "s|profilesPackageId: '[^']*'|profilesPackageId: '$PACKAGE_ID'|" "$COCOS_CONFIG"

# 输出部署完成信息
echo "================================================================================================"
echo "Deployment Summary:"
echo "------------------------------------------------"
echo "Profiles Package ID: $PACKAGE_ID"
echo "Profiles Upgrade Cap: $UPGRADE_CAP"
echo "================================================================================================"
echo "Tycoon Profiles Contract Deployment finished!"
echo "Updated profilesPackageId in: $COCOS_CONFIG"
echo ""
echo "To verify, run: cat $COCOS_CONFIG"
