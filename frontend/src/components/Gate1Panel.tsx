import { useState } from "react";
import type { Idea } from "../api";
import { approveGate1, rejectGate1 } from "../api";

interface Gate1Dim {
  score: number;
  plus?: string[];
  minus?: string[];
}

interface Props {
  idea: Idea;
  isGate1Ready: boolean;
  runAction: (fn: () => Promise<any>) => Promise<void>;
}

const DIM_LABELS: Record<string, string> = {
  originality: "原创性",
  audience_appeal: "受众吸引力",
  content_richness: "内容厚度",
  timeliness: "时效性",
  feasibility: "执行可行性",
};

function dimColor(score: number): string {
  if (score >= 76) return "text-success-700";
  if (score >= 61) return "text-ink-700";
  if (score >= 41) return "text-warn-700";
  return "text-danger-700";
}

function scoreRing(score: number) {
  // 圆环样式（仅装饰）
  const color =
    score >= 76 ? "border-success-500" :
    score >= 61 ? "border-accent-500" :
    score >= 41 ? "border-warn-500" : "border-danger-500";
  return (
    <div className={`shrink-0 w-20 h-20 rounded-full border-[3px] ${color}
                     flex flex-col items-center justify-center bg-paper-50`}>
      <span className="font-serif text-3xl text-ink-900 leading-none">{score}</span>
      <span className="text-[10px] text-ink-500 mt-1">/ 100</span>
    </div>
  );
}

export default function Gate1Panel({ idea, isGate1Ready, runAction }: Props) {
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const handle = async (kind: "approve" | "reject", fn: () => Promise<any>) => {
    if (pending) return;
    setPending(kind);
    try {
      await runAction(fn);
    } finally {
      setTimeout(() => setPending(null), 1500);
    }
  };
  const result = idea.gate1_result;
  const score = idea.gate1_score;

  if (score == null || !result) {
    return (
      <section className="mb-16">
        <p className="h-eyebrow mb-4">门禁 1 · 价值判断</p>
        <div className="card-pad text-sm text-ink-500">
          价值判断未完成。请确认后端 API Key 已配置。
        </div>
      </section>
    );
  }

  return (
    <section className="mb-16">
      <p className="h-eyebrow mb-5">门禁 1 · 价值判断</p>

      <div className="card-pad mb-6">
        <div className="flex items-start gap-6 mb-5">
          {score < 0 ? (
            <div className="text-lg text-danger-700">评估失败</div>
          ) : scoreRing(score)}
          <div className="flex-1 min-w-0">
            {result.verdict && (
              <p className="font-serif text-lg text-ink-900 leading-relaxed mb-2">
                {result.verdict}
              </p>
            )}
            {result.advice && (
              <p className="text-sm text-ink-500 leading-relaxed">
                <span className="text-accent-600">建议</span> · {result.advice}
              </p>
            )}
          </div>
        </div>

        {result.dimensions && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-5 border-t border-paper-300">
            {Object.entries(result.dimensions as Record<string, Gate1Dim>).map(([key, dim]) => {
              if (!dim || typeof dim.score !== "number") return null;
              return (
                <div key={key}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm text-ink-700">{DIM_LABELS[key] || key}</span>
                    <span className={`text-sm font-mono ${dimColor(dim.score)}`}>
                      {dim.score}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-paper-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        dim.score >= 76 ? "bg-success-500" :
                        dim.score >= 61 ? "bg-accent-500" :
                        dim.score >= 41 ? "bg-warn-500" : "bg-danger-500"
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, dim.score))}%` }}
                    />
                  </div>
                  {dim.plus && dim.plus.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {dim.plus.map((p, i) => (
                        <li key={i} className="text-xs text-success-700">+ {p}</li>
                      ))}
                    </ul>
                  )}
                  {dim.minus && dim.minus.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {dim.minus.map((m, i) => (
                        <li key={i} className="text-xs text-danger-700">− {m}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {result.competitive_analysis && (
        <div className="card-pad mb-4">
          <p className="h-eyebrow mb-2">竞品分析</p>
          <p className="text-sm text-ink-700 leading-relaxed">{result.competitive_analysis}</p>
        </div>
      )}

      {idea.gate1_research && (
        <details className="card-pad mb-4">
          <summary className="h-eyebrow select-none">
            AI 看到的搜索结果
            {idea.gate1_research.search_results && idea.gate1_research.search_results.length > 0
              ? ` · ${idea.gate1_research.search_results.length} 条`
              : idea.gate1_research.search_used === false
              ? " · 未启用 / 无结果"
              : ""}
          </summary>
          <div className="mt-4 space-y-4">
            {idea.gate1_research.search_results && idea.gate1_research.search_results.length > 0 ? (
              idea.gate1_research.search_results.map((hit, i) => (
                <div key={i} className="border-l-2 border-accent-500/40 pl-4 py-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs text-ink-400 font-mono shrink-0">#{i + 1}</span>
                    {hit.url ? (
                      <a
                        href={hit.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-ink-900 hover:text-accent-600 hover:underline truncate"
                      >
                        {hit.title || hit.url}
                      </a>
                    ) : (
                      <span className="text-sm text-ink-700">{hit.title || "(无标题)"}</span>
                    )}
                  </div>
                  {hit.content && (
                    <p className="text-xs text-ink-500 leading-relaxed line-clamp-3">
                      {hit.content}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-ink-500 leading-relaxed">
                Tavily 未返回结果（API Key 未配置 / 关键词无匹配 / 搜索失败）。AI 评分基于自身知识。
              </p>
            )}
          </div>
        </details>
      )}

      {result.error && (
        <p className="text-sm text-danger-700 bg-danger-50 px-3 py-2 rounded">
          {result.error}
        </p>
      )}

      {isGate1Ready && (
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => handle("approve", () => approveGate1(idea.id))}
            disabled={pending !== null}
            className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {pending === "approve" ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                正在提交…
              </>
            ) : (
              <>通过，开始生产 →</>
            )}
          </button>
          <button
            onClick={() => handle("reject", () => rejectGate1(idea.id))}
            disabled={pending !== null}
            className="btn-ghost disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending === "reject" ? "处理中…" : "驳回"}
          </button>
        </div>
      )}
    </section>
  );
}
