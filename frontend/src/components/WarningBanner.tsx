import type { Idea } from "../api";

export default function WarningBanner({ idea }: { idea: Idea }) {
  const items: { level: "warn" | "info"; text: string }[] = [];

  const risk = idea.distribution_strategy?.risk_warning;
  if (risk && typeof risk === "string") {
    items.push({ level: "warn", text: `发布风险：${risk}` });
  }

  const advice = idea.gate1_result?.advice;
  if (advice && typeof advice === "string") {
    items.push({ level: "info", text: `改进建议：${advice}` });
  }

  if (idea.gate1_score != null && idea.gate1_score < 60) {
    items.push({ level: "warn", text: `Gate1 分数偏低（${idea.gate1_score}），建议重新打磨选题` });
  }

  if (!items.length) return null;

  return (
    <div className="mb-6 space-y-2">
      {items.map((it, i) => (
        <div
          key={i}
          className={`px-3 py-2 rounded text-xs border ${
            it.level === "warn"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-blue-50 border-blue-200 text-blue-700"
          }`}
        >
          {it.text}
        </div>
      ))}
    </div>
  );
}
