# OmniPost 当前架构（截至 2026-05-19）

> 这是项目**当前真实状态**的快照。历史计划/蓝图见 `docs/archive/`。

## 是什么

一站式内容运营工具：从信息源爬取 → AI 判断价值 → 生成多平台内容 → 人工审核 → 分发。

## 技术栈

- **后端**：Python 3.13 + FastAPI + SQLAlchemy(async) + SQLite
- **前端**：React 18 + TypeScript + Vite + Tailwind
- **部署**：supervisord 跑后端 + nginx 服务前端静态文件
- **公网**：http://8.222.142.125/

## 目录结构

```
omnipost/
├── backend/
│   ├── app/
│   │   ├── routers/          # 4 个 API 路由
│   │   │   ├── crawl.py      # 信息爬取（RSS 源、批次、转赛道/点子）
│   │   │   ├── ideas.py      # 点子全流程（gate1/produce/review/publish）
│   │   │   ├── library.py    # 内容库（赛道 + 条目 + Excel 导入导出）
│   │   │   └── config.py     # 用户配置（LLM provider + api_key）
│   │   ├── services/         # 7 个业务服务
│   │   │   ├── agents.py     # LLM Agent 调用层
│   │   │   ├── idea_workflow.py  # 点子状态机
│   │   │   ├── crawler.py    # RSS 抓取
│   │   │   ├── llm.py        # LLM 客户端（DeepSeek/Claude）
│   │   │   ├── search.py     # Tavily 联网搜索
│   │   │   ├── prompt_loader.py
│   │   │   └── tts.py
│   │   ├── core/             # config / database / platforms
│   │   ├── models.py         # 6 张 SQLAlchemy 表
│   │   └── schemas.py        # Pydantic 请求/响应模型
│   ├── prompts/              # LLM 提示词 .md 文件
│   ├── tests/                # 32 个 pytest 测试
│   └── .venv/
├── frontend/
│   └── src/
│       ├── pages/            # 6 个页面：Home/IdeaDetail/ReviewQueue/ContentLibrary/CrawlDashboard/Settings
│       ├── components/       # 10 个组件
│       └── api.ts
├── frontend-dist/            # 构建产物（部署到 /var/www/omnipost）
└── deploy/
    ├── redeploy.sh           # 一键部署脚本（带测试 gate + sudo 同步）
    └── supervisord.conf
```

## 数据库（6 张表）

| 表 | 用途 |
|---|---|
| `content_items` | 点子（idea）+ 生产物 + 状态 |
| `tracks` | 内容赛道（分类） |
| `content_entries` | 内容库条目（按赛道归档） |
| `feed_sources` | RSS 信息源 |
| `crawl_batches` | 每次抓取的批次 |
| `crawl_items` | 抓取到的单条信息 |

## 部署流程

```bash
bash deploy/redeploy.sh           # 全量：test → build → 同步 → 重启
bash deploy/redeploy.sh frontend  # 只前端
bash deploy/redeploy.sh backend   # 只后端
bash deploy/redeploy.sh --skip-tests  # 紧急 hotfix
```

**关键路径**：
- 容器内项目路径：`/opt/data/omnipost/`（= 宿主机 `/root/hermes-agent/data/omnipost/`）
- nginx 服务的前端目录：`/var/www/omnipost/`（前端构建后需 sudo 同步）
- 后端服务：`127.0.0.1:8000`（nginx 反代 `/api/`）

## 测试

- 32 个 pytest 测试，2 秒跑完
- 覆盖：health / config / 完整点子流程 / 状态守卫 / 并发 / 内容库 / 爬虫
- `redeploy.sh` 默认跑测试 gate，失败则中止部署

## 当前规模

- 业务代码 ~6100 行（后端 3200 + 前端 2900）
- Python 依赖 16 个，前端依赖 6 runtime + 12 dev
- 不算臃肿
