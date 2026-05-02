FROM node:20

ARG TZ
ENV TZ="$TZ"

ARG CLAUDE_CODE_VERSION=latest
ARG CODEX_VERSION=latest

# Install basic development tools and iptables/ipset
RUN apt-get update && apt-get install -y --no-install-recommends \
  less \
  git \
  procps \
  sudo \
  fzf \
  zsh \
  man-db \
  unzip \
  gnupg2 \
  gh \
  bubblewrap \
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  aggregate \
  jq \
  nano \
  vim \
  curl \
  ca-certificates \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

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
  sudo dpkg -i "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
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
ENV PATH=/home/node/.local/bin:/home/node/.suiup/bin:$PATH
RUN curl -sSfL https://raw.githubusercontent.com/MystenLabs/suiup/main/install.sh | sh \
  && suiup install sui \
  && sui --version

# Copy and set up firewall script
COPY init-firewall.sh /usr/local/bin/
USER root
RUN chmod +x /usr/local/bin/init-firewall.sh && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall && \
  chmod 0440 /etc/sudoers.d/node-firewall
USER node
