#!/usr/bin/env bash
# OmniPost 全新机器一键安装
# 前提：Ubuntu 22.04+、有 sudo、能联网
#
# 用法：
#   bash setup.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "===== OmniPost setup @ $REPO_ROOT ====="

# 1. 系统依赖
echo ">> 检查系统依赖..."
need=()
command -v python3 >/dev/null || need+=(python3)
command -v node >/dev/null || need+=(nodejs npm)
command -v nginx >/dev/null || need+=(nginx)
if [ ${#need[@]} -gt 0 ]; then
  echo "缺少：${need[*]}，安装中（需 sudo）..."
  sudo apt update
  sudo apt install -y "${need[@]}"
fi

# 2. 后端 venv + 依赖
echo ">> 安装后端依赖..."
cd "$REPO_ROOT/backend"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 3. 初始化数据库
echo ">> 初始化数据库..."
python - <<'PY'
import asyncio
import app.models  # 注册所有表
from app.core.database import init_db
asyncio.run(init_db())
print("数据库表已就绪")
PY

# 4. 前端构建
echo ">> 构建前端..."
cd "$REPO_ROOT/frontend"
npm install
npx vite build
mkdir -p "$REPO_ROOT/frontend-dist"
rm -rf "$REPO_ROOT/frontend-dist/assets" "$REPO_ROOT/frontend-dist/index.html"
cp -r dist/* "$REPO_ROOT/frontend-dist/"

# 5. 启动后端 supervisord
echo ">> 启动后端守护..."
bash "$REPO_ROOT/deploy/autostart.sh"

echo
echo "✅ OmniPost 已就绪"
echo
echo "下一步："
echo "  - 配置 nginx 反代（参考 deploy/nginx.conf.example）"
echo "  - 详见 deploy/README.md"
