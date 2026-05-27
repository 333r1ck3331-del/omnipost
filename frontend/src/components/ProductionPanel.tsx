import { useState, useEffect } from "react";
import type { Idea, EnrichmentFlags, StyleSample } from "../api";
import { saveBrief, produceContent, listStyles } from "../api";
import { CONTENT_TYPES, TYPE_LABELS } from "../constants";

const ENRICHMENT_OPTIONS: { key: keyof EnrichmentFlags; label: string; hint: string }[] = [
  { key: "topic_articles", label: "同主题原文", hint: "搜 top 3 篇相关文章，喂全文给 AI 参考" },
  { key: "counter_views", label: "反观点罗列", hint: "找 2-3 条反方/质疑资料，避免一边倒" },
  { key: "data_cases", label: "数据/案例", hint: "找具体数字、案例、报告，要求 AI 标注来源" },
];

interface Props {
  idea: Idea;
  isApproved: boolean;
  isProducing: boolean;
  isProductionFailed: boolean;
  brief: string;
  setBrief: (v: string) => void;
  selectedTypes: string[];
  setSelectedTypes: (updater: (prev: string[]) => string[]) => void;
  pollSeconds: number;
  runAction: (fn: () => Promise<any>) => Promise<void>;
  load: () => Promise<void>;
}

export default function ProductionPanel({
  idea, isApproved, isProducing, isProductionFailed,
  brief, setBrief, selectedTypes, setSelectedTypes,
  pollSeconds, runAction, load,
}: Props) {
  // 点击到状态切到 in_production 之间会有 1-3 秒盲区，本地立刻显示"提交中"
  const [submitting, setSubmitting] = useState(false);
  const [enrichment, setEnrichment] = useState<EnrichmentFlags>({});
  const [styles, setStyles] = useState<StyleSample[]>([]);
  // styleId: undefined = 还没初始化, null = 不用风格, string = 指定 id
  const [styleId, setStyleId] = useState<string | null | undefined>(undefined);
  const toggleEnrichment = (k: keyof EnrichmentFlags) =>
    setEnrichment((prev) => ({ ...prev, [k]: !prev[k] }));
  const hasEnrichment = Object.values(enrichment).some(Boolean);

  useEffect(() => {
    listStyles()
      .then((xs) => {
        setStyles(xs);
        // 默认勾选 idea 已有 style_id，否则用 default 风格
        if (styleId === undefined) {
          if (idea.style_id) setStyleId(idea.style_id);
          else {
            const def = xs.find((s) => s.is_default);
            setStyleId(def ? def.id : null);
          }
        }
      })
      .catch((e) => console.warn("listStyles failed:", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idea.id]);

  return (
    <>
      {isApproved && (
        <section className="mb-16">
          <p className="h-eyebrow mb-5">内容生产</p>
          <div className="card-pad space-y-10">
            {/* 写作要求 */}
            <div>
              <label className="block mb-2">
                <span className="font-serif text-base text-ink-900">写作要求</span>
              </label>
              <p className="text-xs text-ink-500 mb-3">
                写清楚方向、角度、风格、篇幅、要避开的内容。AI 会按你的要求生成。
              </p>
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="例如：从社会心理学角度切入，引用 1–2 个真实案例，避免说教感，篇幅 1500 字左右，结尾要有留白……"
                className="textarea min-h-[140px] font-serif italic text-[15px] leading-relaxed"
              />
            </div>

            {/* 素材增强 */}
            <div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-serif text-base text-ink-900">素材增强</span>
                <span className="text-xs text-ink-400">可选 · 默认关</span>
              </div>
              <p className="text-xs text-ink-500 mb-4">
                勾选后会先抓取参考资料，详细清单写在生成结果上方，可逐条点开看 AI 用了什么。
              </p>
              <div className="space-y-2">
                {ENRICHMENT_OPTIONS.map((o) => (
                  <label
                    key={o.key}
                    className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition
                                ${enrichment[o.key]
                                  ? "border-accent-500/50 bg-accent-50/50"
                                  : "border-paper-300 bg-paper-100/40 hover:border-paper-400"}`}
                  >
                    <input
                      type="checkbox"
                      checked={!!enrichment[o.key]}
                      onChange={() => toggleEnrichment(o.key)}
                      className="mt-1 accent-accent-500"
                    />
                    <span>
                      <span className="text-sm text-ink-900">{o.label}</span>
                      <span className="block text-xs text-ink-500 mt-0.5">{o.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              {hasEnrichment && (
                <p className="mt-3 text-xs text-warn-700">
                  ⏱ 注意：会多消耗 5–30 秒抓取时间
                </p>
              )}
            </div>

            {/* 内容类型 */}
            <div>
              <label className="block mb-3">
                <span className="font-serif text-base text-ink-900">内容类型</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {CONTENT_TYPES.map((t) => {
                  const selected = selectedTypes.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        setSelectedTypes((prev) =>
                          prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                        )
                      }
                      className={`px-4 py-1.5 rounded-full text-sm transition border ${
                        selected
                          ? "bg-accent-500 text-white border-accent-500 shadow-warm"
                          : "bg-paper-50 text-ink-700 border-paper-300 hover:border-accent-400 hover:text-accent-600"
                      }`}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 写作风格 */}
            <div>
              <label className="block mb-2">
                <span className="font-serif text-base text-ink-900">写作风格</span>
                <span className="ml-2 text-xs text-ink-400">可选</span>
              </label>
              <p className="text-xs text-ink-500 mb-3">
                选一套保存好的风格，AI 会模仿其句式、用词。在
                <a href="/settings" className="text-accent-600 hover:underline mx-1">设置 → 风格库</a>
                里管理。
              </p>
              <select
                value={styleId ?? ""}
                onChange={(e) => setStyleId(e.target.value || null)}
                className="input text-sm max-w-md"
              >
                <option value="">— 不使用风格 —</option>
                {styles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.is_default ? "（默认）" : ""}
                  </option>
                ))}
              </select>
              {styles.length === 0 && (
                <p className="text-xs text-ink-400 mt-2 italic">还没有风格，前往设置创建第一个。</p>
              )}
            </div>

            <div className="pt-2 border-t border-paper-300">
              <button
                onClick={async () => {
                  if (!brief.trim() || selectedTypes.length === 0) return;
                  if (submitting) return;
                  setSubmitting(true);
                  try {
                    await runAction(async () => {
                      await saveBrief(idea.id, brief.trim());
                      await produceContent(idea.id, selectedTypes, hasEnrichment ? enrichment : undefined, styleId ?? null);
                    });
                  } finally {
                    // 即使后端状态没及时切到 in_production，2 秒后也复原按钮，避免卡死
                    setTimeout(() => setSubmitting(false), 2000);
                  }
                }}
                disabled={!brief.trim() || selectedTypes.length === 0 || submitting}
                className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    正在提交…
                  </>
                ) : (
                  <>开始生成 →</>
                )}
              </button>
              {!submitting && (!brief.trim() || selectedTypes.length === 0) && (
                <span className="ml-3 text-xs text-ink-400">
                  {!brief.trim() ? "请先填写写作要求" : "请至少选择一种内容类型"}
                </span>
              )}
              {submitting && (
                <span className="ml-3 text-xs text-accent-600 fade-in">
                  已收到，正在唤醒 AI…
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {isProducing && (
        <section className="mb-16">
          <div className="card-pad text-center py-12">
            <div className="inline-flex items-center gap-3 text-ink-700">
              <span className="inline-block w-4 h-4 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" />
              <span className="font-serif text-lg">AI 正在生产内容</span>
            </div>
            <p className="text-xs text-ink-500 mt-3">
              已等待 {Math.round(pollSeconds)}s
              {pollSeconds > 60 && (
                <button onClick={load} className="ml-3 text-accent-600 hover:text-accent-700 underline">
                  手动刷新
                </button>
              )}
            </p>
            <div className="mt-6 max-w-md mx-auto">
              <div className="h-1 rounded-full bg-paper-200 overflow-hidden">
                <div
                  className="h-full bg-accent-500 transition-all"
                  style={{ width: `${Math.min(95, pollSeconds * 1.2)}%` }}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {isProductionFailed && (
        <section className="mb-16">
          <div className="card-pad border-danger-500/30 bg-danger-50/40">
            <p className="h-eyebrow text-danger-700 mb-3">生产失败</p>
            <p className="text-sm text-ink-700 mb-5">内容生成中断或超时，可以重试。</p>
            <button
              disabled={submitting}
              onClick={async () => {
                if (submitting) return;
                setSubmitting(true);
                try {
                  await runAction(() =>
                    produceContent(idea.id, idea.selected_types || ["gzh"], undefined, idea.style_id ?? styleId ?? null)
                  );
                } finally {
                  // 兜底：状态切到 in_production 通常 1-3 秒，2 秒后清除即使 polling 还没更新也已经接管显示
                  setTimeout(() => setSubmitting(false), 2000);
                }
              }}
              className="btn-secondary border-danger-500/30 text-danger-700 hover:bg-danger-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "正在提交…" : "重新生成 →"}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
