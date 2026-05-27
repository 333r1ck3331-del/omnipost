import { Link } from "react-router-dom";

interface Entry {
  version: string;
  date: string;
  title: string;
  highlights: string[];
  notes?: string;
}

const ENTRIES: Entry[] = [
  {
    version: "v0.4.1",
    date: "2026-05",
    title: "Prompt 提优：让 AI 真听用户的话",
    highlights: [
      "用户的内容要求被提到 prompt 最前面，标为「最高优先级」——之前被 8000 字主笔铁律盖过的问题修了",
      "公众号字数从硬卡 2500 字 → 默认 1500-2500，用户要求更长可到 6000 字",
      "段落规则放宽：去掉「每段 80-150 字」硬切片，改成按内容自然流动 + 必须有过渡逻辑",
      "科普类禁用「一二三」分点小标题凑结构，强制连贯叙述",
      "输出前自检 5 条：字数 / 角度 / 段落连贯 / 是否分点拼凑 / 参考资料是否用上——任一不达标重写",
      "system.md schema 同步更新公众号 body 字数描述",
    ],
    notes:
      "原来生成的内容动不动就「分点列表 + 小标题 + 80 字一段」糊出来，看起来像 AI 写的。这一版让 AI 先看用户的要求再写，并且写完回头自检。同样一句「华为韬定律科普 4000 字」，生成的东西终于像一篇文章而不是一份 PPT 大纲。",
  },
  {
    version: "v0.4",
    date: "2026-05",
    title: "风格库：让 AI 真的写得像我",
    highlights: [
      "风格库：保存多套写作风格（小红书风、公众号风、推特风…），生产时下拉选择",
      "Settings → 风格库管理：新建 / 编辑 / 删除 / 设默认，所见即所得",
      "ProductionPanel 加风格下拉，默认勾选上次用的风格，重试时自动复用",
      "后端 StyleSample 模型 + /api/styles CRUD，生产/自审/重试链路全部接受 style_id",
      "旧版「写作风格样本」字符串自动迁移成第一条默认风格，不丢数据",
      "重新生成按钮的「点击无反馈」彻底修掉：submitting 状态 + spinner + 文案切换",
      "测试隔离修复：reload_config 副作用导致 prompt_loader 读错 DB 的坑",
    ],
    notes:
      "原来「写作风格」是一段全局字符串，每次生成无差别注入，写小红书也带着公众号腔。现在它是一个库，按内容场景切换，AI 学得更准。",
  },
  {
    version: "v0.3",
    date: "2026-05",
    title: "稳了，开始有点像自己的工具",
    highlights: [
      "六大内容场景：观点 / 拆解 / 故事 / 教程 / 评论 / 资讯，按场景挑提示词",
      "AI 自审与风格学习：生成完先自检 AI 腔，再按你过往内容回炉一遍",
      "素材增强 3 选项：同主题原文 / 反观点 / 数据案例，按需注入研究简报",
      "OpenAI provider 接入 + Settings 按 provider 选模型",
      "Phase 3 信息流：RSS 订阅 → 一键抓取 → 时间轴 → 加入赛道 / 转 idea",
      "Phase 2 内容库：赛道 + 条目 + xlsx 导入导出 + 批量改状态",
      "前端拆分：IdeaDetail 拆成 4 个 Panel 组件，路由瘦身",
      "后端拆分：业务逻辑下沉到 services/idea_workflow，路由变薄壳",
      "部署：supervisord 守护 + redeploy.sh 自带测试 gate",
      "修了「重新生成」按钮无反馈的小 bug（点了像没反应那个）",
    ],
    notes:
      "这一版之后，整个流程在我自己手里跑通了一整套：从一句点子，到门禁打分，到带研究的成稿，再到投放策略。不再像是一堆零件，而是一个工具了。",
  },
  {
    version: "v0.2",
    date: "2026-04 ~ 05",
    title: "四平台齐活 + 投放策略",
    highlights: [
      "B 站平台支持，凑齐公众号 / 小红书 / 抖音 / B 站四件套",
      "审核通过后自动生成多平台投放策略（时间 / 标签 / Dou+ / 受众分层）",
      "生产前自动搜索 + URL 抓取，注入研究简报给 LLM",
      "Gate1 完整展示：五维度评分 + 竞品分析 + 改进建议",
      "AI 痕迹后端正则回扫（5 种模式）+ schema 强制 ai_trace",
      "审核硬门禁：review → 必须人工通过才能 completed",
      "Phase 1 增强：配图提示词 + 视频分镜",
      "Settings 接后端持久化（之前只在 localStorage）",
      "Tavily 竞品搜索集成 + 失败静默降级",
      "Edge TTS 视频脚本转中文语音",
    ],
  },
  {
    version: "v0.1",
    date: "2026-03 ~ 04",
    title: "MVP：从点子到一篇稿",
    highlights: [
      "FastAPI + React + SQLite 主干搭起来",
      "状态机：draft → pending_review → approved → in_production → review → completed → published",
      "门禁 1 价值判断 + 用户填 Brief 强制步骤",
      "DeepSeek 一次调用同时出公众号长文 + 小红书短文 + 视频脚本",
      "标题优化 Agent：3 个不同角度备选",
      "米色温柔风 UI 系统（btn-primary / card / pill 等复用 class）",
      "乐观锁 + 僵尸进程恢复 + 生产超时回退",
    ],
  },
];

export default function Changelog() {
  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-12">
        <p className="h-eyebrow mb-3">版本记录</p>
        <h1 className="h-display text-3xl mb-4">OmniPost 走过的路</h1>
        <p className="text-sm text-ink-500 leading-relaxed">
          这里记下每一版加了什么、修了什么、想清楚了什么。
          <br />
          一部分是给未来的自己看，一部分——是因为这个东西陪着我跑了一段时间，
          它也算是慢慢长出自己样子的。留个档。
        </p>
      </header>

      {/* v0.5 路线图 */}
      <section className="mb-14 relative pl-6 border-l border-dashed border-accent-300/60">
        <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 border-accent-400 bg-paper-50" />
        <div className="flex items-baseline gap-3 mb-2">
          <span className="font-serif text-xl text-accent-700">v0.5</span>
          <span className="text-xs text-ink-400 tracking-wider">下一站 · 规划中</span>
          <span className="pill text-[10px] tracking-wider border-accent-300/60 text-accent-700">
            预告
          </span>
        </div>
        <h2 className="font-serif text-lg text-ink-700 mb-4">
          让它再往前走一步
        </h2>
        <ul className="space-y-3 mb-4">
          <li className="text-sm text-ink-700 leading-relaxed">
            <span className="font-serif text-ink-900">📽 AI 视频剧本库</span>
            <span className="block text-ink-500 mt-1 pl-4 border-l border-paper-300">
              把故事梗概发进去，直接产出分镜 + 镜头描述 + 视频生成提示词（Sora /
              可灵 / Runway 通用），还能反复改，让它一版比一版顺。
            </span>
          </li>
          <li className="text-sm text-ink-700 leading-relaxed">
            <span className="font-serif text-ink-900">✍️ 内容质量再上一档</span>
            <span className="block text-ink-500 mt-1 pl-4 border-l border-paper-300">
              更狠的 AI 痕迹清洗，更准的风格学习——让生成的东西看起来不像 AI
              写的，而是像我写的。
            </span>
          </li>
          <li className="text-sm text-ink-700 leading-relaxed">
            <span className="font-serif text-ink-900">🌐 抓取扩到全网</span>
            <span className="block text-ink-500 mt-1 pl-4 border-l border-paper-300">
              不止 RSS。把社交平台、公众号、小红书、知乎、B 站、X 都接进来，
              让信息流真的成为我的素材池。
            </span>
          </li>
          <li className="text-sm text-ink-700 leading-relaxed">
            <span className="font-serif text-ink-900">📊 价值判断量化</span>
            <span className="block text-ink-500 mt-1 pl-4 border-l border-paper-300">
              门禁 1 引入多角度量化指标——搜索热度、竞品密度、时效窗口、受众体量，
              每一项都能给数据，不再只是 AI 一句"还行"。
            </span>
          </li>
          <li className="text-sm text-ink-700 leading-relaxed">
            <span className="font-serif text-ink-900">🚀 一键送到草稿箱</span>
            <span className="block text-ink-500 mt-1 pl-4 border-l border-paper-300">
              直接对接公众号、小红书、抖音、B 站的 API 或草稿箱，
              内容送到嘴边——只剩点"发布"那一下。
            </span>
          </li>
        </ul>
        <p className="text-xs text-ink-400 italic leading-relaxed pl-4 border-l-2 border-accent-300/40 py-2">
          以上是想做的方向，不是承诺。会按手感、按需要、按精力慢慢来。
          有些可能合并到 v0.5，有些会推到 v0.6 之后。
        </p>
      </section>

      <ol className="space-y-12">
        {ENTRIES.map((e, idx) => (
          <li key={e.version} className="relative pl-6 border-l border-paper-300">
            <span
              className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full ${
                idx === 0 ? "bg-accent-500" : "bg-paper-300"
              }`}
            />
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-serif text-xl text-ink-900">{e.version}</span>
              <span className="text-xs text-ink-400 tracking-wider">{e.date}</span>
              {idx === 0 && (
                <span className="pill text-[10px] tracking-wider">当前</span>
              )}
            </div>
            <h2 className="font-serif text-lg text-ink-700 mb-4">{e.title}</h2>
            <ul className="space-y-2 mb-4">
              {e.highlights.map((h) => (
                <li
                  key={h}
                  className="text-sm text-ink-700 leading-relaxed flex gap-3"
                >
                  <span className="text-accent-500 select-none">·</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
            {e.notes && (
              <p className="text-sm text-ink-500 italic leading-relaxed bg-paper-50/60 border-l-2 border-accent-300/50 pl-4 py-2">
                {e.notes}
              </p>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-16 text-center">
        <Link
          to="/"
          className="text-sm text-ink-500 hover:text-accent-600 transition"
        >
          ← 回到灵感
        </Link>
      </div>
    </div>
  );
}
