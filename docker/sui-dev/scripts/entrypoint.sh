#!/usr/bin/env bash
# Entrypoint:
#   首次启动建 ADMIN/PLAYER_A/PLAYER_B keypairs (持久化在 sui-config volume)
#   每次启动用 --force-regenesis 起干净的 localnet
#   通过 faucet 给三个账户充钱
#   导出 .env.sui 给 host 上的 TS 脚本/CI 使用
#   最后 drop to bash
# 改自: https://github.com/MystenLabs/builder-scaffold/blob/main/docker/scripts/entrypoint.sh
set -e

SUI_CFG="${SUI_CONFIG_DIR:-/root/.sui}"
KEYSTORE="$SUI_CFG/sui.keystore"
CLIENT_YAML="$SUI_CFG/client.yaml"
INIT_MARKER="$SUI_CFG/.initialized"
ENV_FILE="/workspace/web3-tycoon/docker/sui-dev/.env.sui"

# ---------- first-run: 创建 keypairs ----------
if [ ! -f "$INIT_MARKER" ]; then
  echo "[sui-dev] First run — initialising keys..."
  mkdir -p "$SUI_CFG"
  printf '%s' '[]' >"$KEYSTORE"
  # local 和 localnet 都是 localhost:9000 的 alias，让 move/scripts/publish.sh 的 "local"
  # 和 sui CLI 标准命名 "localnet" 都能用
  cat >"$CLIENT_YAML" <<EOF
---
keystore:
  File: $KEYSTORE
envs:
  - alias: local
    rpc: "http://127.0.0.1:9000"
  - alias: localnet
    rpc: "http://127.0.0.1:9000"
  - alias: testnet
    rpc: "https://fullnode.testnet.sui.io"
active_env: localnet
active_address: ~
EOF

  printf 'y\n' | sui client switch --env localnet 2>/dev/null || true

  echo "[sui-dev] Creating keypairs: ADMIN, PLAYER_A, PLAYER_B..."
  for alias in ADMIN PLAYER_A PLAYER_B; do
    printf '\n' | sui client new-address ed25519 "$alias" || {
      echo "[sui-dev] ERROR: failed to create $alias" >&2
      exit 1
    }
  done
  touch "$INIT_MARKER"
  echo "[sui-dev] Keys created."
fi

# ---------- wait for postgres + reset indexer DB (仅当 SUI_INDEXER_DB_URL 设置时) ----------
# 由 compose.override.yml 注入；不挂载 override 时此变量为空，跳过整段
if [ -n "${SUI_INDEXER_DB_URL:-}" ]; then
  echo "[sui-dev] Waiting for Postgres to be ready..."
  POSTGRES_READY=0
  for i in {1..60}; do
    if pg_isready -d "$SUI_INDEXER_DB_URL" >/dev/null 2>&1; then
      echo "[sui-dev] Postgres is ready."
      POSTGRES_READY=1
      break
    fi
    sleep 1
  done

  if [ "$POSTGRES_READY" -ne 1 ]; then
    echo "[sui-dev] ERROR: Postgres did not become ready" >&2
    exit 1
  fi

  # 节点启动前先 DROP+CREATE indexer DB，避免老数据 + 残留连接阻断 DROP
  # URL 解析支持: postgresql://user:pass@host:port/dbname[?options]
  DB_NAME="$(printf '%s' "$SUI_INDEXER_DB_URL" | sed -E 's|.*://[^/]*/([^?]*).*|\1|')"

  if [ -z "$DB_NAME" ]; then
    echo "[sui-dev] ERROR: could not parse a database name from SUI_INDEXER_DB_URL" >&2
    exit 1
  fi

  # 安全校验：只允许字母数字下划线，首字符非数字（防 SQL 注入和奇怪字符）
  if ! printf '%s' "$DB_NAME" | grep -qE '^[a-zA-Z_][a-zA-Z0-9_]{0,62}$'; then
    echo "[sui-dev] ERROR: parsed DB_NAME '$DB_NAME' is not a valid identifier." >&2
    exit 1
  fi

  # 用 admin URL 连到默认的 'postgres' DB 来 DROP/CREATE 目标 DB
  ADMIN_DB_URL="$(printf '%s' "$SUI_INDEXER_DB_URL" | sed -E 's|(://[^/]*)/[^?]*|\1/postgres|')"

  echo "[sui-dev] Resetting indexer database '$DB_NAME' before node start..."
  psql "$ADMIN_DB_URL" \
    --set ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"${DB_NAME}\"" \
    -c "CREATE DATABASE \"${DB_NAME}\""
  echo "[sui-dev] Indexer database '$DB_NAME' ready."
fi

# ---------- start local node ----------
if [ -n "${SUI_INDEXER_DB_URL:-}" ]; then
  echo "[sui-dev] Starting local Sui node (--with-faucet --force-regenesis --with-indexer --with-graphql)..."
  sui start --with-faucet --force-regenesis \
    --with-indexer="$SUI_INDEXER_DB_URL" \
    --with-graphql=0.0.0.0:9125 &
else
  echo "[sui-dev] Starting local Sui node (--with-faucet --force-regenesis)..."
  sui start --with-faucet --force-regenesis &
fi
NODE_PID=$!
trap 'kill "$NODE_PID" 2>/dev/null || true' EXIT

echo "[sui-dev] Waiting for RPC on port 9000..."
for i in $(seq 1 60); do
  curl -s -o /dev/null http://127.0.0.1:9000 2>/dev/null && break
  if [ "$i" -eq 60 ]; then
    echo "[sui-dev] ERROR: RPC did not become ready" >&2
    kill "$NODE_PID" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done
echo "[sui-dev] RPC responding, waiting for full initialization..."
sleep 5
echo "[sui-dev] Node ready."

# ---------- fund accounts ----------
printf 'y\n' | sui client switch --env localnet 2>/dev/null || true
echo "[sui-dev] Funding accounts from faucet..."
for alias in ADMIN PLAYER_A PLAYER_B; do
  sui client switch --address "$alias"
  for attempt in 1 2 3; do
    sui client faucet 2>&1 && break
    [ "$attempt" -eq 3 ] && {
      echo "[sui-dev] Faucet failed for $alias" >&2
      exit 1
    }
    sleep 2
  done
done
sui client switch --address ADMIN

# ---------- write .env.sui ----------
get_address() { sui keytool export --key-identity "$1" --json 2>/dev/null | jq -r '.key.suiAddress'; }
get_key() { sui keytool export --key-identity "$1" --json 2>/dev/null | jq -r '.exportedPrivateKey'; }

require_val() {
  if [ -z "$2" ] || [ "$2" = "null" ]; then
    echo "[sui-dev] ERROR: failed to export $1" >&2
    exit 1
  fi
}

ADMIN_ADDRESS=$(get_address ADMIN)
PLAYER_A_ADDRESS=$(get_address PLAYER_A)
PLAYER_B_ADDRESS=$(get_address PLAYER_B)
ADMIN_PRIVATE_KEY=$(get_key ADMIN)
PLAYER_A_PRIVATE_KEY=$(get_key PLAYER_A)
PLAYER_B_PRIVATE_KEY=$(get_key PLAYER_B)

for var in ADMIN_ADDRESS PLAYER_A_ADDRESS PLAYER_B_ADDRESS \
  ADMIN_PRIVATE_KEY PLAYER_A_PRIVATE_KEY PLAYER_B_PRIVATE_KEY; do
  require_val "$var" "${!var}"
done

mkdir -p "$(dirname "$ENV_FILE")"
cat >"$ENV_FILE" <<EOF
# Generated by docker/sui-dev/scripts/entrypoint.sh — local Sui keys for TypeScript scripts
# 注意：addresses 跨重启不变（keys 持久化），但 chain state 每次 --force-regenesis 重置
SUI_NETWORK=localnet
SUI_RPC_URL=http://127.0.0.1:9000
SUI_FAUCET_URL=http://127.0.0.1:9123
ADMIN_ADDRESS=$ADMIN_ADDRESS
PLAYER_A_ADDRESS=$PLAYER_A_ADDRESS
PLAYER_B_ADDRESS=$PLAYER_B_ADDRESS
ADMIN_PRIVATE_KEY=$ADMIN_PRIVATE_KEY
PLAYER_A_PRIVATE_KEY=$PLAYER_A_PRIVATE_KEY
PLAYER_B_PRIVATE_KEY=$PLAYER_B_PRIVATE_KEY
EOF
chmod 600 "$ENV_FILE"

# ---------- ready ----------
echo ""
echo "================================================"
echo " Sui dev environment ready"
echo " RPC:     http://127.0.0.1:9000"
echo " Faucet:  http://127.0.0.1:9123"
if [ -n "${SUI_INDEXER_DB_URL:-}" ]; then
  echo " GraphQL: http://127.0.0.1:9125/graphql"
fi
echo " Keys:    docker/sui-dev/.env.sui"
echo "================================================"
echo ""
echo "Publish move/tycoon 到 localnet（用项目自带脚本，会自动写 Cocos config）:"
echo "  ./move/scripts/publish.sh local"
echo ""
echo "Move 单元测试（不需要起链）:"
echo "  cd move/tycoon && sui move test"
echo ""

exec "${@:-bash}"
