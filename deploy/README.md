# OmniPost 部署文档

## 当前架构

```
浏览器 → 阿里云:80 (宿主机 nginx)
                ↓
         ┌──────┴──────────────┐
         ↓                     ↓
   静态前端文件              FastAPI 后端
   frontend-dist/            172.18.0.2:8000
   (nginx 直接读)            (supervisord 守护)
```

**关键事实**：
- OmniPost 当前**寄生在 hermes-agent 容器内**（172.18.0.2）
- 容器 `unless-stopped` 策略 → 服务器重启会自动起容器
- 容器内 supervisord 守护 uvicorn → uvicorn 挂了自动拉
- 前端是**静态文件**，不依赖任何进程
- `/opt/data` 是 bind mount 到宿主机 `/root/hermes-agent/data` → **数据安全**

## 日常运维

### 改了代码后重新部署
```bash
cd /opt/data/omnipost
bash deploy/redeploy.sh           # 前端 + 后端
bash deploy/redeploy.sh backend   # 只重启后端
bash deploy/redeploy.sh frontend  # 只重新 build 前端
```

### 查看后端状态
```bash
cd /opt/data/omnipost/backend && source .venv/bin/activate
supervisorctl -c /opt/data/omnipost/deploy/supervisord.conf status
```

### 查看后端日志
```bash
tail -f /opt/data/omnipost/deploy/logs/backend.log         # stdout
tail -f /opt/data/omnipost/deploy/logs/backend.err.log     # stderr
tail -f /opt/data/omnipost/deploy/logs/supervisord.log     # supervisord 自身
```

### 重启 supervisord 本身（很少需要）
```bash
cd /opt/data/omnipost/backend && source .venv/bin/activate
supervisorctl -c /opt/data/omnipost/deploy/supervisord.conf shutdown
bash /opt/data/omnipost/deploy/autostart.sh
```

## 容器重启后自动恢复

hermes-agent 容器一旦重启（unless-stopped），需要**手动**执行一次：
```bash
bash /opt/data/omnipost/deploy/autostart.sh
```

> **未来改进**：把这条加进 hermes-agent 容器的启动钩子，做到全自动。当前需要 sudo 改宿主机 docker 配置，留待下一阶段。

## 备份

```bash
tar -czf /tmp/omnipost-backup-$(date +%Y%m%d).tar.gz \
  -C /opt/data omnipost \
  --exclude=omnipost/backend/.venv \
  --exclude=omnipost/frontend/node_modules \
  --exclude=omnipost/frontend/dist \
  --exclude=omnipost/backend/__pycache__ \
  --exclude='*.pyc'
```

## 迁移到新服务器

完整步骤见 `docs/MIGRATION.md`（核心：复制 `/opt/data/omnipost` → 装 Python/Node → 跑 `setup.sh` → 配 nginx）。

## 文件清单

| 路径 | 作用 |
|---|---|
| `deploy/supervisord.conf` | supervisord 主配置（守护 uvicorn） |
| `deploy/redeploy.sh` | 一键重新部署 |
| `deploy/autostart.sh` | 容器启动时调用 |
| `deploy/logs/` | supervisord + 后端日志 |
| `backend/requirements.txt` | Python 依赖锁定 |
| `frontend-dist/` | 前端静态文件（nginx 反代目标） |
