# 重构进度跟踪 — 2026-05-19

> **目的**：在进入 Phase 2 之前还掉关键技术债。本文档实时记录进度，对话丢失时读此文件即可续上。
>
> **核心原则**：每完成一步立刻 Git commit；当前状态写在「当前位置」。

---

## 当前位置

**正在做**：步骤 0 完成，**A 已跳过**（ROI 不足），准备开始 **F（加集成测试）**
**最近 commit**：`47de8b5` 重构进度跟踪文档
**Phase 1 联测**：⏸ 暂停（重构完成后一并验证）

### 决策记录
- **跳过 A 的理由**：实测后发现 Gate1 已用独立 prompt（value_judge.md），output_schema 已按平台过滤。system.md 拆分实际只能省 ~27% 单平台生产 token（之前估算 60% 是错的），LLM 内容质量不会改善，且有"prompt 拼接顺序变动导致 LLM 行为漂移"的小风险。投入产出比不如 B/C。

---

## 总体计划

| 步骤 | 内容 | 预估 | 状态 | Commit |
|---|---|---|---|---|
| 0 | Git commit Phase 1 改动 + 写进度文档 | 10min | ✅ | a297b15 |
| A | 拆 system.md → 多 prompt 模板 | 半天 | ⏸ 跳过 | — |
| F | 加 3-5 个核心 API 集成测试（pytest + httpx） | 半天 | ✅ | (next) |
| B | ideas.py 业务逻辑下沉到 services/idea_workflow.py | 1 天 | ⏳ pending | — |
| C | IdeaDetail.tsx 拆 Gate1Panel/ProductionPanel/ReviewPanel | 半天 | ⏳ pending | — |
| Z | Phase 1 端到端联测 | 0.5h | ⏳ pending | — |

**完成后再进 Phase 2**（内容库管理）。

---

## 步骤 A：拆分 system.md（详细）

### 现状
- `backend/prompts/system.md` 375 行，单一巨型 prompt
- 当前所有 LLM 调用（Gate1 评估、生产、标题优化）都加载整个文件
- 浪费的 token：Gate1 不需要"四平台写作规范"，生产公众号不需要"小红书规则"

### 目标拆分
```
backend/prompts/
  system_base.md          # 通用人设 + 全局规则（精简）
  gate1_eval.md           # Gate1 评估规则
  production_common.md    # 生产前置（搜索结果注入 + 通用 JSON schema 框架）
  production_gzh.md       # 公众号专属规范 + image_plans schema
  production_xhs.md       # 小红书专属规范 + image_plans schema
  production_douyin.md    # 抖音专属规范 + video_storyboard schema
  production_bilibili.md  # B站专属规范 + video_storyboard schema
  title_optimize.md       # 标题优化
```

### 实施步骤
1. 读 system.md 全文，按职责切块
2. 每块写到独立文件（保持原有规则不变）
3. 改 `prompt_loader.py`，新增 `load_prompts(*names)` 拼接接口
4. 改 `agents.py` 各调用点，按场景加载对应 prompts
5. 验证：跑一个 idea 完整流程，输出与原版本结构一致

### 风险
- 拆得太碎反而难维护 → 上限 8 个文件
- prompt 改动改变 LLM 行为 → 只切块、**不改文字**

### 预估收益
- Gate1 调用：375 行 → 约 80 行（base 50 + gate1 30），省 ~78% token
- 单平台生产：375 行 → 约 150 行（base 50 + common 50 + 平台 50），省 ~60% token

---

## 步骤 F：加集成测试

### 目标
覆盖 3-5 个核心场景，防止后续重构破坏 Phase 1 行为：
1. 创建 idea + Gate1 评估返回 score
2. Gate1 通过后 produce 生成全平台内容
3. produce 后含 image_plans / video_storyboard 字段
4. review 通过后 publish
5. 标题优化端点

### 实施
- 新建 `backend/tests/test_idea_flow.py`
- 用 pytest + httpx.AsyncClient 直接打路由
- LLM 调用用 monkeypatch mock 掉（返回固定 JSON），不消耗真实 API

---

## 步骤 B：拆分 ideas.py

### 现状
- `routers/ideas.py` 453 行，14 个端点
- 业务逻辑（DB 操作 + LLM 编排 + 状态机）全写在路由里

### 目标
- 路由层只做：参数校验 → 调 service → 包装响应
- `services/idea_workflow.py`：纯业务函数（create_idea / run_gate1 / run_production / approve_review / publish ...）

---

## 步骤 C：拆分 IdeaDetail.tsx

### 现状
- `frontend/src/pages/IdeaDetail.tsx` 613 行

### 目标
- `Gate1Panel.tsx`：Gate1 结果 + 通过/拒绝按钮
- `ProductionPanel.tsx`：四平台编辑器 + ImagePlansPanel + VideoStoryboardPanel
- `ReviewPanel.tsx`：审核控制
- IdeaDetail.tsx 只做状态分发

---

## Phase 2 设计原则（重构之外的约束）

进 Phase 2 时严格遵守：
- 内容库 = **独立模块** `routers/library.py` + `services/library.py`，不混入 ideas
- 信息爬取 = **独立模块** `routers/crawl.py` + `services/crawler.py`
- 定时任务 = **独立 worker 进程**（systemd timer 或单独 uvicorn），隔离 OOM 风险

---

## 重要文件路径速查

- 后端入口：`/opt/data/omnipost/backend/main.py`（注意：是 `main:app` 不是 `app.main:app`）
- 启动命令：`cd backend && source .venv/bin/activate && uvicorn main:app --host 127.0.0.1 --port 8000`
- DB：`backend/omnipost.db`（SQLite，已含 image_plans/video_storyboard 列）
- 全量备份：`/opt/data/backups/omnipost-full-20260519-011524.tar.gz`
- Phase 2 计划：`docs/plans/2026-05-15-phase2-enhancement.md`
