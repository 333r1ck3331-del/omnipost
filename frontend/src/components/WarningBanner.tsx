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
    <div className="mb-8 space-y-2 fade-in">
      {items.map((it, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 px-4 py-3 rounded-lg text-sm border ${
            it.level === "warn"
              ? "bg-warn-50/60 border-warn-500/30 text-warn-700"
              : "bg-accent-50/60 border-accent-500/30 text-accent-700"
          }`}
        >
          <span className="font-serif text-lg leading-none mt-0.5">
            {it.level === "warn" ? "⚠" : "✦"}
          </span>
          <span className="flex-1 leading-relaxed">{it.text}</span>
        </div>
      ))}
    </div>
  );
}
