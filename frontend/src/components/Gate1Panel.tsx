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
  if (score >= 76) return "text-green-600";
  if (score >= 61) return "text-gray-700";
  if (score >= 41) return "text-yellow-600";
  return "text-red-500";
}

export default function Gate1Panel({ idea, isGate1Ready, runAction }: Props) {
  const result = idea.gate1_result;
  const score = idea.gate1_score;

  if (score == null || !result) {
    return (
      <section className="mb-16">
        <h2 className="text-xs text-gray-400 tracking-wider mb-6">门禁 1 · 价值判断</h2>
        <p className="text-sm text-gray-400">价值判断未完成。请确认后端 API Key 已配置。</p>
      </section>
    );
  }

  return (
    <section className="mb-16">
      <h2 className="text-xs text-gray-400 tracking-wider mb-6">门禁 1 · 价值判断</h2>
      <div className="flex items-baseline gap-2 mb-4">
        {score < 0 ? (
          <span className="text-lg text-red-400">评估失败</span>
        ) : (
          <>
            <span className="text-4xl font-light text-[#2c2c2c]">{score}</span>
            <span className="text-sm text-gray-400">/ 100</span>
          </>
        )}
      </div>
      {result.verdict && (
        <p className="text-sm text-gray-600 leading-relaxed mb-4">{result.verdict}</p>
      )}
      {result.dimensions && (
        <div className="mt-6 space-y-4">
          <h3 className="text-xs text-gray-400 tracking-wider mb-3">逐项评估</h3>
          {Object.entries(result.dimensions as Record<string, Gate1Dim>).map(([key, dim]) => {
            if (!dim || typeof dim.score !== "number") return null;
            return (
              <div key={key} className="border-b border-gray-50 pb-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{DIM_LABELS[key] || key}</span>
                  <span className={`text-sm font-mono ${dimColor(dim.score)}`}>{dim.score}</span>
                </div>
                {dim.plus && dim.plus.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {dim.plus.map((p, i) => (
                      <li key={i} className="text-xs text-green-600 pl-3">+ {p}</li>
                    ))}
                  </ul>
                )}
                {dim.minus && dim.minus.length > 0 && (
                  <ul className="mt-0.5 space-y-0.5">
                    {dim.minus.map((m, i) => (
                      <li key={i} className="text-xs text-red-400 pl-3">− {m}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
      {result.competitive_analysis && (
        <div className="mt-5">
          <h3 className="text-xs text-gray-400 tracking-wider mb-1">竞品分析</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{result.competitive_analysis}</p>
        </div>
      )}
      {result.advice && (
        <div className="mt-4">
          <h3 className="text-xs text-gray-400 tracking-wider mb-1">改进建议</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{result.advice}</p>
        </div>
      )}
      {result.error && <p className="text-sm text-red-500">{result.error}</p>}
      {isGate1Ready && (
        <div className="flex gap-6 mt-8">
          <button
            onClick={() => runAction(() => approveGate1(idea.id))}
            className="text-sm text-gray-800 hover:text-black transition"
          >
            通过，开始生产 →
          </button>
          <button
            onClick={() => runAction(() => rejectGate1(idea.id))}
            className="text-sm text-gray-400 hover:text-gray-600 transition"
          >
            驳回
          </button>
        </div>
      )}
    </section>
  );
}
