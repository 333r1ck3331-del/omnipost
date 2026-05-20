#!/usr/bin/env bash
# OmniPost 一键部署 / 重启脚本
#
# 用法：
#   bash deploy/redeploy.sh           # test + build 前端 + 重启后端
#   bash deploy/redeploy.sh backend   # test + 重启后端
#   bash deploy/redeploy.sh frontend  # build + 同步前端（不重启后端）
#   bash deploy/redeploy.sh --skip-tests   # 跳过测试（紧急 hotfix 才用）

set -euo pipefail

ROOT="/opt/data/omnipost"
SUPERVISORCTL="$ROOT/backend/.venv/bin/supervisorctl -c $ROOT/deploy/supervisord.conf"
SUPERVISORD="$ROOT/backend/.venv/bin/supervisord -c $ROOT/deploy/supervisord.conf"
PYTEST="$ROOT/backend/.venv/bin/pytest"
NGINX_DIR="/var/www/omnipost"

cd "$ROOT"

# ── 参数解析 ──────────────────────────────────────────────
SKIP_TESTS=0
TARGET="all"
for arg in "$@"; do
  case "$arg" in
    --skip-tests) SKIP_TESTS=1 ;;
    all|frontend|backend) TARGET="$arg" ;;
    *) echo "用法: $0 [all|frontend|backend] [--skip-tests]"; exit 1 ;;
  esac
done

# ── 测试 gate ─────────────────────────────────────────────
run_tests() {
  if [ "$SKIP_TESTS" -eq 1 ]; then
    echo ">> [test] 已跳过（--skip-tests）⚠️"
    return
  fi
  echo ">> [test] 跑 pytest..."
  if ! (cd "$ROOT/backend" && "$PYTEST" tests/ -q 2>&1 | tail -20); then
    echo ""
    echo "❌ 测试不通过，部署中止。"
    echo "   修好测试，或加 --skip-tests 强制部署（不推荐）。"
    exit 1
  fi
  echo ">> [test] 通过 ✓"
}

# ── 前端 ──────────────────────────────────────────────────
sync_to_nginx() {
  # 把 frontend-dist/ 同步到 /var/www/omnipost/
  # 优先尝试 sudo -n（免密），不行就提示用户手动跑
  # 宿主机上 frontend-dist 的真实路径（容器内是 $ROOT，宿主机是 /root/hermes-agent/data/omnipost）
  HOST_FRONTEND_DIST="/root/hermes-agent/data/omnipost/frontend-dist"
  if sudo -n true 2>/dev/null; then
    echo ">> [frontend] sudo 免密可用，自动同步到 $NGINX_DIR"
    sudo cp -r "$ROOT/frontend-dist/." "$NGINX_DIR/"
    sudo chown -R www-data:www-data "$NGINX_DIR"
    echo ">> [frontend] nginx 目录已更新 ✓"
  else
    echo ""
    echo "⚠️  自动 sudo 不可用，请在【宿主机 admin 终端】手动跑下面这条："
    echo ""
    echo "    sudo bash -c 'cp -r $HOST_FRONTEND_DIST/. $NGINX_DIR/ && chown -R www-data:www-data $NGINX_DIR'"
    echo ""
    echo "    跑完之后刷新浏览器看效果。"
    echo ""
  fi
}

deploy_frontend() {
  echo ">> [frontend] build..."
  cd "$ROOT/frontend"
  npx vite build
  echo ">> [frontend] sync dist → frontend-dist/"
  rm -rf "$ROOT/frontend-dist/assets" "$ROOT/frontend-dist/index.html"
  cp -r dist/. "$ROOT/frontend-dist/"
  echo ">> [frontend] build done"
  sync_to_nginx
}

# ── 后端 ──────────────────────────────────────────────────
restart_backend() {
  if [ ! -S "$ROOT/deploy/supervisor.sock" ]; then
    echo ">> [backend] supervisord 未运行，启动..."
    $SUPERVISORD
    sleep 1
  fi
  echo ">> [backend] 重启 uvicorn..."
  $SUPERVISORCTL restart omnipost-backend || $SUPERVISORCTL start omnipost-backend
  sleep 2
  $SUPERVISORCTL status omnipost-backend
}

# ── 主流程 ────────────────────────────────────────────────
case "$TARGET" in
  all)
    run_tests
    deploy_frontend
    restart_backend
    ;;
  frontend)
    # frontend 不动后端，但还是跑测试保证前端依赖的 API 没改坏
    run_tests
    deploy_frontend
    ;;
  backend)
    run_tests
    restart_backend
    ;;
esac

echo ""
echo ">> 完成。验证："
if curl -sf http://127.0.0.1:8000/api/health > /dev/null; then
  echo "   ✓ 后端 /api/health OK"
else
  echo "   ✗ 后端 /api/health 异常"
fi
if curl -sf -m 5 http://8.222.142.125/ > /dev/null; then
  echo "   ✓ 主页 http://8.222.142.125/ OK"
else
  echo "   ⚠️ 主页验证失败（可能是网络/防火墙，浏览器试一下）"
fi
