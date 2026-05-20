import { useState } from "react";
import type { Idea, EnrichmentFlags } from "../api";
import { saveBrief, produceContent } from "../api";
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
  const [enrichment, setEnrichment] = useState<EnrichmentFlags>({});
  const toggleEnrichment = (k: keyof EnrichmentFlags) =>
    setEnrichment((prev) => ({ ...prev, [k]: !prev[k] }));
  const hasEnrichment = Object.values(enrichment).some(Boolean);

  return (
    <>
      {isApproved && (
        <section className="mb-16">
          <h2 className="text-xs text-gray-400 tracking-wider mb-6">内容要求</h2>
          <p className="text-xs text-gray-400 mb-4">
            写清楚你想要的方向、角度、风格、篇幅要求、要避开的内容。AI 将根据你的要求生成内容。
          </p>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="例如：从社会心理学角度切入，引用1-2个真实案例，避免说教感，篇幅1500字左右，结尾要有留白..."
            className="w-full min-h-[120px] text-sm italic p-4 bg-white border border-gray-100 rounded resize-y focus:outline-none focus:border-gray-300 leading-relaxed placeholder-gray-300"
          />

          <h2 className="text-xs text-gray-400 tracking-wider mt-12 mb-3">素材增强 <span className="text-gray-300 font-normal">（可选，默认关）</span></h2>
          <p className="text-xs text-gray-400 mb-4">勾选后会先抓取参考资料，详细清单写在生成结果上方，可逐条点开看 AI 用了什么。</p>
          <div className="flex flex-col gap-2 mb-8">
            {ENRICHMENT_OPTIONS.map((o) => (
              <label key={o.key} className="flex items-start gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={!!enrichment[o.key]}
                  onChange={() => toggleEnrichment(o.key)}
                  className="mt-1"
                />
                <span>
                  <span className="text-gray-700">{o.label}</span>
                  <span className="text-xs text-gray-400 ml-2">{o.hint}</span>
                </span>
              </label>
            ))}
            {hasEnrichment && (
              <p className="text-xs text-amber-600 mt-1">注意：会多消耗 5-30 秒抓取时间</p>
            )}
          </div>

          <h2 className="text-xs text-gray-400 tracking-wider mb-6">内容类型</h2>
          <div className="flex flex-wrap gap-2 mb-8">
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
                  className={`text-xs px-3 py-1.5 rounded-full transition ${
                    selected
                      ? "bg-gray-800 text-white"
                      : "bg-[#f5f1ea] text-gray-500 border border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => {
              if (!brief.trim() || selectedTypes.length === 0) return;
              runAction(async () => {
                await saveBrief(idea.id, brief.trim());
                await produceContent(idea.id, selectedTypes, hasEnrichment ? enrichment : undefined);
              });
            }}
            disabled={!brief.trim() || selectedTypes.length === 0}
            className={`text-sm transition ${
              !brief.trim() || selectedTypes.length === 0
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-800 hover:text-black"
            }`}
          >
            开始生成 →
          </button>
        </section>
      )}

      {isProducing && (
        <section className="mb-16">
          <p className="text-sm text-gray-400">AI 正在生成内容，请稍候...</p>
          <p className="text-xs text-gray-500 mt-1">
            已等待 {Math.round(pollSeconds)}s
            {pollSeconds > 60 && (
              <button onClick={load} className="ml-2 underline">手动刷新</button>
            )}
          </p>
        </section>
      )}

      {isProductionFailed && (
        <section className="mb-16">
          <h2 className="text-xs text-gray-400 tracking-wider mb-4">生产失败</h2>
          <p className="text-sm text-gray-600 mb-6">内容生成中断或超时。请重试。</p>
          <button
            onClick={() => runAction(() => produceContent(idea.id, idea.selected_types || ["gzh"]))}
            className="text-sm px-4 py-2 bg-red-50 text-red-700 rounded hover:bg-red-100 transition"
          >
            重新生成 →
          </button>
        </section>
      )}
    </>
  );
}
