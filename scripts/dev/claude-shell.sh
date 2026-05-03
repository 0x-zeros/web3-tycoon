#!/bin/bash
# 进入当前项目的 devcontainer，跑一个交互 shell
# 使用方式：在项目根目录下 ./scripts/claude-shell.sh

set -e

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# 按 VS Code devcontainer 的 label 精确匹配
CONTAINER=$(docker ps \
  --filter "label=devcontainer.local_folder=${PROJECT_DIR}" \
  --format "{{.Names}}" \
  | head -1)

if [ -z "$CONTAINER" ]; then
  echo "❌ 没找到项目 ${PROJECT_DIR} 对应的容器"
  echo "请先在 VS Code 里执行: Dev Containers: Reopen in Container"
  exit 1
fi

echo "✅ 进入容器: $CONTAINER"

docker exec -it -u node -w /workspace "$CONTAINER" zsh

# docker exec -it -u node -w /workspace "$CONTAINER" \
#   zsh -c "claude --dangerously-skip-permissions"

# claude --dangerously-skip-permissions
# claude --permission-mode auto


# 跳过审批直接放行所有动作：
# codex --dangerously-bypass-approvals-and-sandbox

# 类似claude --permission-mode auto, 但是没有git add等权限
# codex --ask-for-approval never --sandbox workspace-write

# 类似claude --permission-mode auto
# codex --ask-for-approval never --sandbox workspace-write --add-dir /workspace/.git



  # - Claude auto
  #   最接近 Codex：--ask-for-approval never --sandbox workspace-write
  # - Claude bypassPermissions
  #   最接近 Codex：--dangerously-bypass-approvals-and-sandbox
  # - Codex --full-auto
  #   不是同级替代。官方定义是 workspace-write + on-request，还是会问
  # - Codex 默认 Auto
  #   也更保守。官方写的是：工作目录内读写和跑命令可以，但碰工作区外或网络仍会先问