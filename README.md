# OmniPost — 全平台 AI 内容运营系统

> **OmniPost = Omni（全、遍及）+ Post（发布）**
>
> 输入创意点子 → AI 完成价值判断、内容生产、策略生成 → 你审核 → 发布到多平台。

## 项目结构

```
omnipost/
├── backend/
│   ├── prompts/                    # 所有 Agent 提示词（与留白共享）
│   │   ├── system.md               # 全局角色定义
│   │   ├── rules.md                # 全局创作底线（7条铁律）
│   │   └── tones/                  # 语调模式
│   │       ├── gentle_comfort.md   # 温柔抚慰（场景陪伴）
│   │       ├── clear_empathy.md    # 清醒共情（认知重构）
│   │       ├── social_observe.md   # 社会观察（结构分析）
│   │       └── psych_science.md    # 心理科普（知识传递）
│   ├── schemas/
│   │   └── output_schema.json      # 输出 JSON 结构定义
│   └── config/
│       └── tracks/                 # 赛道配置（可扩展）
│           └── psychology.yaml     # 心理赛道（当前）
├── docs/
│   └── MVP瘦身版蓝图.md             # 开发蓝图
├── .gitignore
└── README.md
```

## 与留白 (liubai) 的关系

```
留白 (liubai)                      OmniPost
─────────────                      ─────────
单文件 HTML，浏览器打开就用           Web 应用，多页面 + 数据库
一键生成完整内容包                   门禁审核、逐条编辑、发布追踪
prompt 试验田（改了刷新即测）        内容生产引擎（共享同一套 prompt）
你的「创意实验室」                   你的「运营管理后台」

共享层：prompts/ 目录下的所有 prompt 和 schema
```

## 赛道扩展

新增赛道只需一步：在 `backend/config/tracks/` 下新建一个 YAML 文件。

```yaml
# 例如：backend/config/tracks/tech.yaml
track_name: tech
track_display: "科技+互联网+AI"
keywords:
  - 人工智能
  - 自动驾驶
  - ...
available_tones:
  - clear_empathy
  - social_observe
platforms:
  - douyin
  - bilibili
  - gongzhonghao
```

## 技术栈

- 后端：Python FastAPI + SQLAlchemy + SQLite
- 前端：React + Vite + shadcn/ui
- AI：DeepSeek API（与留白一致）/ Claude API
