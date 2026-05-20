# OmniPost Phase 2 增强实施计划

> **For Hermes:** Use Claude Code (claude_api.py) to generate code per task, then apply via Hermes tools.
>
> **Goal:** 架构升级（顶部导航）+ 内容生成增强（配图/视频企划/平台排版）+ 内容库管理 + 信息爬取模块
>
> **Architecture:** 保持现有 FastAPI + SQLite + React + Vite 技术栈。新增 3 张数据库表、2 个前端页面、多个 API 路由。不引入新依赖（爬取用 Tavily + requests 已有）。
>
> **Tech Stack:** Python 3.11 / FastAPI / SQLAlchemy / SQLite / React 18 / TypeScript / Vite / Tailwind CSS

---

## 复杂度评估（实事求是）

| 需求 | 后端新增 | 前端新增 | DB 新增 | 预估任务数 |
|------|---------|---------|--------|-----------|
| 架构调整（顶部导航） | 0 | 1 组件 | 0 | 2 |
| 需求一（内容生成增强） | 扩展 prompt + 解析 | IdeaDetail 展示扩展 | 3 列 | 6 |
| 需求二（内容库管理） | 2 路由 + Excel 处理 | 1 整页 | 2 表 | 10 |
| 需求三（信息爬取） | 2 路由 + 爬取引擎 | 1 整页 | 2 表 | 10 |
| **合计** | | | | **28** |

**实现策略：** 把 Claude API 当代码生成器，Hermes 当执行器+质量门。每个任务生成代码 → 应用 → 构建 → 测试 → 提交。

---

## Phase 0：架构调整 — 顶部导航

### Task 0.1: 创建 TopNav 组件
- **Create:** `frontend/src/components/TopNav.tsx`
- **Modify:** `frontend/src/App.tsx` — 引入 TopNav + 路由切换

### Task 0.2: 路由结构调整
- 现有路由：`/` (Home), `/idea/:id` (IdeaDetail), `/review` (ReviewQueue), `/settings` (Settings)
- 调整后：
  - `/inspire` → 灵感生成（原 Home）
  - `/inspire/:id` → 灵感详情（原 IdeaDetail）
  - `/crawl` → 信息爬取（占位 → 需求三）
  - `/library` → 内容库（占位 → 需求二）
  - `/review` → 审核队列
  - `/settings` → 设置

---

## Phase 1：需求一 — 内容生成增强

### Task 1.1: 扩展 agents.py 生产提示词 — 配图指导
- 修改 `assemble_content_production_prompt` 或直接在 system.md 中增加配图输出要求
- 输出 schema 新增 `images` 字段：`{"gzh": [{style, midjourney_prompt, dalle_prompt}], ...}`

### Task 1.2: 扩展 agents.py 生产提示词 — 视频企划
- 视频输出增加：`storyboard_prompts`（分镜图提示词）、`narration_text`（口播文案）、`bgm_suggestion`、`keywords`
- 更新 `run_content_production` 的解析逻辑

### Task 1.3: 扩展 agents.py 生产提示词 — 平台化排版
- 每个平台输出 `formatted_content` 字段（可直接复制的排版文本）
- 含 #标题、正文、---分割线、🏷️标签 等平台特定格式

### Task 1.4: 扩展 DB 模型 + Schema
- `ContentItem` 新增列：`image_prompts` (Text, JSON)、`video_plan` (Text, JSON)、`formatted_content` (Text, JSON)
- 更新 schemas.py 对应的 Pydantic 模型

### Task 1.5: 前端 IdeaDetail 展示配图
- 各平台内容区下增加「配图方案」折叠面板
- 每条配图显示：风格描述 + Midjourney 提示词（可复制）+ DALL-E 提示词（可复制）

### Task 1.6: 前端 IdeaDetail 展示视频企划
- 视频脚本区增加：分镜图提示词、口播文案、BGM 建议、关键词标签
- 新增「视频企划」折叠面板

---

## Phase 2：需求二 — 内容库与发布计划管理

### Task 2.1: 创建 DB 模型 Track
- `tracks` 表：id, name, description, sort_order, created_at
- 初始数据：示例赛道（如"心理赛道"、"AI 科技"）

### Task 2.2: 创建 DB 模型 ContentEntry
- `content_entries` 表：id, track_id (FK), title, topic_direction, publish_date, status (待编辑/待发布/已发布), notes, created_at, updated_at

### Task 2.3: 创建 Track API 路由
- GET /api/tracks — 列表
- POST /api/tracks — 创建
- DELETE /api/tracks/:id — 删除

### Task 2.4: 创建 ContentEntry API 路由
- GET /api/tracks/:id/entries — 某赛道下的清单
- POST /api/tracks/:id/entries — 添加
- PATCH /api/entries/:id — 编辑
- DELETE /api/entries/:id — 删除
- PATCH /api/entries/batch — 批量更新状态

### Task 2.5: Excel 导出功能
- GET /api/tracks/:id/export — 导出为 .xlsx
- 用 openpyxl（需添加到 requirements.txt）
- 列：标题、选题方向、发布日期、状态、备注

### Task 2.6: Excel 导入功能
- POST /api/tracks/:id/import — 上传 .xlsx，批量创建 ContentEntry
- 解析第一行作表头，逐行创建

### Task 2.7: 前端 ContentLibrary 页面 — 赛道 Tab
- 顶部 Tab 栏切换赛道
- 支持添加/删除赛道（弹窗）
- 默认选中第一个赛道

### Task 2.8: 前端 ContentLibrary 页面 — 内容清单表格
- 可编辑表格：标题、选题方向、发布日期、状态、备注
- 支持行内编辑、添加行、删除行
- 批量选择 + 批量修改状态

### Task 2.9: 前端 ContentLibrary 页面 — 导入导出按钮
- 「导出 Excel」按钮
- 「导入 Excel」按钮（上传文件）

### Task 2.10: API 客户端更新
- api.ts 新增 track + content entry 相关 API 函数

---

## Phase 3：需求三 — 信息爬取模块

### Task 3.1: 创建 DB 模型 CrawlSource
- `crawl_sources` 表：id, name, category (前沿科技/大佬社媒/政策发布/自定义), query_keywords, target_accounts, is_active, created_at

### Task 3.2: 创建 DB 模型 CrawlResult
- `crawl_results` 表：id, source_id (FK), title, summary, url, published_at, crawled_at

### Task 3.3: 创建爬取引擎
- `backend/app/services/crawler.py`
- 用 Tavily search API 根据 source 的关键词/账号搜索
- 提取：标题、摘要、链接、发布时间
- 去重（基于 URL）
- 保存到 crawl_results 表

### Task 3.4: 创建 CrawlSource API
- GET /api/crawl/sources — 列表
- POST /api/crawl/sources — 创建
- PATCH /api/crawl/sources/:id — 编辑
- DELETE /api/crawl/sources/:id — 删除
- POST /api/crawl/sources/:id/trigger — 手动触发爬取

### Task 3.5: 创建 CrawlResult API
- GET /api/crawl/results?source_id=&limit=&offset= — 分页列表
- GET /api/crawl/results/daily — 今日爬取汇总

### Task 3.6: 定时爬取任务
- 创建 cron job（使用 Hermes cronjob 系统）或 FastAPI 后台任务
- 每天 8:00 自动执行全量爬取
- ⚠️ 服务器资源有限（2核 1.6GB），爬取频率不宜过高

### Task 3.7: 前端 CrawlHub 页面 — 来源配置
- 来源列表（卡片/表格）
- 添加/编辑来源弹窗：名称、类别、关键词、账号
- 启用/禁用开关

### Task 3.8: 前端 CrawlHub 页面 — 爬取结果
- 结构化清单：标题（可点击跳转原文）、摘要、来源平台、发布时间
- 按来源分类折叠 / 按时间倒序
- 手动触发爬取按钮

### Task 3.9: 前端 CrawlHub 页面 — 每日摘要视图
- 今日爬取结果汇总
- 新增条数统计、按来源分布

### Task 3.10: API 客户端更新
- api.ts 新增 crawl 相关 API 函数

---

## 实施顺序（依赖关系）

```
Phase 0（架构调整）→ 先完成，后续页面才有地方放
  ↓
Phase 1（内容增强）→ 依赖 Phase 0 的路由结构，但可并行开发后端
Phase 2（内容库）  → 独立模块，可并行
Phase 3（信息爬取）→ 独立模块，可并行（但需要 Phase 0 的导航入口）
```

---

## 执行说明

每完成一个 Phase 后：
1. `find /opt/data/omnipost/backend -name '*.pyc' -delete`
2. 停旧后端进程 → 重启后端
3. 前端构建：`cd /opt/data/omnipost/frontend && npx vite build`
4. 部署到 `/opt/data/omnipost/frontend/dist/`
5. 跑测试：`cd /opt/data/omnipost/backend && .venv/bin/python test_full_flow.py`
6. `git add -A && git commit -m "feat: Phase N — [描述]"`

---

## 实事求是的时间估算

- **Phase 0:** 15-25 分钟
- **Phase 1:** 45-90 分钟（AI 提示词调优占大头）
- **Phase 2:** 60-120 分钟（Excel 导入导出是技术难点）
- **Phase 3:** 60-120 分钟（爬取引擎调试 + 前端交互）
- **总计:** 3-6 小时

**风险点（实事求是，不粉饰）：**
1. AI 提示词扩展后可能打破现有输出格式 → 需要多轮调优
2. Excel 导入导出（openpyxl）在低内存服务器上处理大文件可能 OOM
3. 爬取模块依赖 Tavily API，每日配额可能不够（需看 Tavily 限制）
4. SQLite 并发写限制——如果有定时爬取 + 用户操作同时发生
5. 前端状态管理变复杂 → 可能需要在后续引入状态管理库（当前纯 React state）
