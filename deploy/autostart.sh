#!/usr/bin/env bash
# 容器重启时自动拉起 OmniPost supervisord
# 由 hermes-agent 容器的启动流程触发（或手动跑）
#
# 防重复启动：检测到 socket 存在就退出
set -e

ROOT="/opt/data/omnipost"
SOCK="$ROOT/deploy/supervisor.sock"
SUPERVISORD="$ROOT/backend/.venv/bin/supervisord"
CONF="$ROOT/deploy/supervisord.conf"

if [ -S "$SOCK" ]; then
  # 用 supervisorctl 探测 supervisord 是否真的活着
  if "$ROOT/backend/.venv/bin/supervisorctl" -c "$CONF" status >/dev/null 2>&1; then
    echo "OmniPost supervisord 已运行，跳过"
    exit 0
  fi
  # socket 残留但进程死了 → 清掉
  rm -f "$SOCK"
fi

echo "启动 OmniPost supervisord..."
"$SUPERVISORD" -c "$CONF"
sleep 1
"$ROOT/backend/.venv/bin/supervisorctl" -c "$CONF" status
