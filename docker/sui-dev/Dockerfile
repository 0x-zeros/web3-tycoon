# Sui dev environment: localnet + faucet + integration test runner
# Ubuntu 24.04 — Mysten 官方 sui binary 构建/测试目标平台 (glibc 2.39)
# 改自: https://github.com/MystenLabs/builder-scaffold/blob/main/docker/Dockerfile
FROM docker.io/library/ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# 基础工具 + Node.js 24.x（与 .devcontainer 保持一致）
# GPG fingerprint 校验确保 NodeSource key 没被替换
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    git \
    jq \
    dos2unix \
    postgresql-client \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key -o /tmp/nodesource-repo.gpg.key \
    && gpg --batch --quiet --show-keys --with-colons /tmp/nodesource-repo.gpg.key | grep -q "fpr.*:6F71F525282841EEDAF851B42F59B5F99B1BE0B4:" \
    && gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg /tmp/nodesource-repo.gpg.key \
    && rm -f /tmp/nodesource-repo.gpg.key \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Sui CLI via suiup (native binary, ARM/x86 自适配)
# echo y 防止 suiup 弹交互式 "set as default?" 提示卡住
ENV PATH="/root/.local/bin:/root/.suiup/bin:${PATH}"
RUN curl -sSfL https://raw.githubusercontent.com/MystenLabs/suiup/main/install.sh | sh \
    && echo y | suiup install sui \
    && sui --version

# /workspace/web3-tycoon 是 bind mount 进来的项目根（compose.yml 配置）
WORKDIR /workspace/web3-tycoon
ENV SUI_CONFIG_DIR=/root/.sui

# 把 entrypoint 放到 /opt 避免被 bind mount 覆盖
COPY scripts/ /opt/sui-dev/scripts/
RUN dos2unix /opt/sui-dev/scripts/*.sh && chmod +x /opt/sui-dev/scripts/*.sh

ENTRYPOINT ["/opt/sui-dev/scripts/entrypoint.sh"]
