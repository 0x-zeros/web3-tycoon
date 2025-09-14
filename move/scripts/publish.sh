#! /usr/bin/env bash
# Copyright (c) Mysten Labs, Inc.
# SPDX-License-Identifier: Apache-2.0

# # 使用示例
# # 发布到测试网
# ./publish.sh testnet

# # 发布到主网
# ./publish.sh mainnet

# local
# ./publish.sh local

# # 带额外参数发布
# ./publish.sh testnet --gas-budget 10000000


# 设置错误时立即退出，如果任何命令返回非零状态码，脚本就会停止
set -e

# 切换到脚本所在目录，静默执行（防止目录名以-开头时被误认为选项）
cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null

# 检查依赖工具是否可用
# 设置SUI命令变量，优先使用环境变量SUI，否则默认为'sui'
SUI=${SUI:-sui}
# 循环检查jq和sui命令是否安装
for i in jq $SUI; do
  # 使用command -V检查命令是否存在，静默执行
  if ! command -V ${i} &>/dev/null; then
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
ENV=$1; shift
# 切换到指定的Sui网络环境
$SUI client switch --env $ENV

# 发布Move合约并获取JSON格式的结果
# ../move指定要发布的Move包目录，--json以JSON格式输出，$@传递所有剩余参数
PUBLISH=$($SUI client publish ../my_coin --json $@)

# 从发布结果中提取交易状态
# 使用jq命令解析JSON，-r参数输出原始字符串（不带引号）
STATUS=$(
    echo $PUBLISH |
        jq -r '.effects.status.status'
)

# 检查发布状态是否为成功
if [[ $STATUS != "success" ]]; then
    echo "Error: Move contract publishing failed. Status:"
    echo $PUBLISH | jq '.effects.status'
    exit 1
fi

# 从发布结果中提取包ID
# 遍历所有对象变更，筛选类型为"published"的变更，提取packageId
PACKAGE_ID=$(
    echo $PUBLISH |
        jq -r '.objectChanges[] | select(.type == "published") | .packageId'
)

# 从发布结果中提取升级权限对象ID
# 筛选类型为"created"且对象类型包含"UpgradeCap"的变更，提取objectId
UPGRADE_CAP=$(
    echo $PUBLISH |
        jq -r '.objectChanges[]
            | select(.type == "created")
            | select(.objectType | contains("0x2::package::UpgradeCap"))
            | .objectId'
)

# # 构建前端配置文件的绝对路径
# CONFIG="$(readlink -f ../ui/src)/env.$ENV.ts"
# # 生成前端TypeScript配置文件，使用here document语法
# cat > $CONFIG <<EOF
# // Copyright (c) Mysten Labs, Inc.
# // SPDX-License-Identifier: Apache-2.0

# export default {
# 	packageId: '$PACKAGE_ID',
# 	upgradeCap: '$UPGRADE_CAP',
# };
# EOF

# 构建CLI环境文件的绝对路径
ENV="$(readlink -f ../cli)/$ENV.env"
# 生成CLI环境变量配置文件，使用here document语法（-EOF忽略前导制表符）
cat > $ENV <<-EOF
PKG=$PACKAGE_ID
CAP=$UPGRADE_CAP
EOF

# 输出部署完成信息和生成的配置文件路径
echo "Contract Deployment finished!"
echo "Details written to $CONFIG and $ENV."
