# Ubuntu 24.04 — Mysten 官方 sui binary 构建/测试目标平台 (glibc 2.39)
# 选用理由：suiup 安装的 sui CLI 在 ubuntu:24.04 上是 happy path，零兼容性顾虑
# 参考: https://github.com/MystenLabs/builder-scaffold/blob/main/docker/Dockerfile
FROM docker.io/library/ubuntu:24.04

ARG TZ
ENV TZ="$TZ"
# 避免 apt 在 build 时弹交互式提示
ENV DEBIAN_FRONTEND=noninteractive

ARG CLAUDE_CODE_VERSION=latest
ARG CODEX_VERSION=latest

# 基础工具 + iptables/ipset (firewall 用) + 通过 NodeSource 装 Node.js 24.x
# 选 24.x 因为：(1) 项目无 engines 限制 (2) host 是 24 与容器一致 (3) Node 20 已退出 LTS 维护
# GPG fingerprint 校验确保 NodeSource key 没被替换 (来源: builder-scaffold)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    gnupg \
    gnupg2 \
    git \
    jq \
    less \
    procps \
    sudo \
    fzf \
    zsh \
    man-db \
    unzip \
    gh \
    bubblewrap \
    iptables \
    ipset \
    iproute2 \
    dnsutils \
    aggregate \
    nano \
    vim \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key -o /tmp/nodesource-repo.gpg.key \
    && gpg --batch --quiet --show-keys --with-colons /tmp/nodesource-repo.gpg.key | grep -q "fpr.*:6F71F525282841EEDAF851B42F59B5F99B1BE0B4:" \
    && gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg /tmp/nodesource-repo.gpg.key \
    && rm -f /tmp/nodesource-repo.gpg.key \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ubuntu:24.04 默认 ubuntu 用户占了 UID 1000，删掉换成 node 用户保持和原 devcontainer 一致
# devcontainer.json 里 remoteUser=node, mounts 都是 /home/node/.claude 等路径，必须维持
RUN userdel -r ubuntu 2>/dev/null || true \
    && groupdel ubuntu 2>/dev/null || true \
    && groupadd --gid 1000 node \
    && useradd --uid 1000 --gid node --shell /bin/bash --create-home node

# Ensure default node user has access to /usr/local/share
RUN mkdir -p /usr/local/share/npm-global && \
  chown -R node:node /usr/local/share

ARG USERNAME=node

# Persist bash history.
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  && mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory

# Set `DEVCONTAINER` environment variable to help with orientation
ENV DEVCONTAINER=true

# Create workspace and config directories and set permissions
RUN mkdir -p /workspace /home/node/.claude /home/node/.codex && \
  chown -R node:node /workspace /home/node/.claude /home/node/.codex

WORKDIR /workspace

ARG GIT_DELTA_VERSION=0.18.2
RUN ARCH=$(dpkg --print-architecture) && \
  wget "https://github.com/dandavison/delta/releases/download/${GIT_DELTA_VERSION}/git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  dpkg -i "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  rm "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb"

# Set up non-root user
USER node

# Install global packages
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

# Set the default shell to zsh rather than sh
ENV SHELL=/bin/zsh

# Set the default editor and visual
ENV EDITOR=nano
ENV VISUAL=nano

# Default powerline10k theme
ARG ZSH_IN_DOCKER_VERSION=1.2.0
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v${ZSH_IN_DOCKER_VERSION}/zsh-in-docker.sh)" -- \
  -p git \
  -p fzf \
  -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
  -a "source /usr/share/doc/fzf/examples/completion.zsh" \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -x

# Install Claude
# 显式把平台原生包一起装，避免 optional dependency 被跳过导致 native binary 缺失
RUN ARCH=$(dpkg --print-architecture) && \
  case "$ARCH" in \
    arm64) NATIVE_PKG=@anthropic-ai/claude-code-linux-arm64 ;; \
    amd64) NATIVE_PKG=@anthropic-ai/claude-code-linux-x64 ;; \
    *) echo "Unsupported arch: $ARCH" && exit 1 ;; \
  esac && \
  npm install -g --include=optional \
    "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
    "${NATIVE_PKG}" \
  && node /usr/local/share/npm-global/lib/node_modules/@anthropic-ai/claude-code/install.cjs \
  && claude --version

# Install OpenAI Codex CLI
# codex 的 native binary 通过 npm alias 分发：@openai/codex-<platform> 不是独立发布的实包，
# 而是 "npm:@openai/codex@<platform>" 的 alias（同一个 @openai/codex 包的 platform dist-tag）。
# --include=optional 在 docker build 里不稳定（会静默跳过 alias 形式的 optional dep），
# 所以用 alias 语法显式把原生包装进全局 node_modules，让 loader 的 require.resolve 命中。
RUN ARCH=$(dpkg --print-architecture) && \
  case "$ARCH" in \
    arm64) PLATFORM=linux-arm64 ;; \
    amd64) PLATFORM=linux-x64 ;; \
    *) echo "Unsupported arch: $ARCH" && exit 1 ;; \
  esac && \
  npm install -g \
    "@openai/codex@${CODEX_VERSION}" \
    "@openai/codex-${PLATFORM}@npm:@openai/codex@${PLATFORM}" \
  && codex --version

# Install Sui CLI via suiup (Mysten 官方版本管理器, 自动适配 arm64/amd64 原生二进制)
# suiup 装到 ~/.suiup, sui binary 软链在 ~/.local/bin。需要时容器里可用 `suiup install sui` 升级
# echo y 防止 suiup 弹交互式确认导致 docker build 卡住
ENV PATH=/home/node/.local/bin:/home/node/.suiup/bin:$PATH
RUN curl -sSfL https://raw.githubusercontent.com/MystenLabs/suiup/main/install.sh | sh \
  && echo y | suiup install sui \
  && sui --version

# Copy and set up firewall script
COPY init-firewall.sh /usr/local/bin/
USER root
RUN chmod +x /usr/local/bin/init-firewall.sh && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall && \
  chmod 0440 /etc/sudoers.d/node-firewall
USER node
