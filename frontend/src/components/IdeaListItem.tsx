import { useNavigate } from "react-router-dom";
import type { IdeaSummary } from "../api";
import { STATUS_LABELS } from "../constants";

const STATUS_PILL: Record<string, string> = {
  pending_review:    "pill-warn",
  in_production:     "pill-accent",
  review:            "pill-accent",
  completed:         "pill-success",
  published:         "pill",
  rejected:          "pill-danger",
  production_failed: "pill-danger",
};

type Props = { idea: IdeaSummary };

export default function IdeaListItem({ idea }: Props) {
  const navigate = useNavigate();
  const date = new Date(idea.created_at).toLocaleDateString("zh-CN", {
    month: "2-digit", day: "2-digit",
  });
  const scoreLabel =
    idea.gate1_score == null
      ? null
      : idea.gate1_score < 0
      ? "评估失败"
      : `${idea.gate1_score}`;

  const scoreColor =
    idea.gate1_score != null && idea.gate1_score >= 80 ? "text-success-700" :
    idea.gate1_score != null && idea.gate1_score >= 60 ? "text-ink-700"  :
    idea.gate1_score != null ? "text-danger-700" : "";

  return (
    <li>
      <button
        type="button"
        onClick={() => navigate(`/ideas/${idea.id}`)}
        className="w-full text-left py-4 px-5 hover:bg-paper-200/60
                   transition-colors group focus:outline-none
                   focus-visible:bg-paper-200"
      >
        <div className="flex items-start justify-between gap-6 mb-2">
          <p className="text-[15px] text-ink-900 leading-relaxed flex-1 line-clamp-2
                        font-serif group-hover:text-accent-700 transition-colors">
            {idea.idea_text}
          </p>
          <span className={`${STATUS_PILL[idea.status] ?? "pill"} shrink-0`}>
            {STATUS_LABELS[idea.status] || idea.status}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-ink-400">
          <span>{date}</span>
          {scoreLabel && (
            <span className={`font-mono ${scoreColor}`}>
              ★ {scoreLabel}
              <span className="text-ink-300">/100</span>
            </span>
          )}
          <span className="ml-auto text-ink-300 group-hover:text-accent-500 transition">
            →
          </span>
        </div>
      </button>
    </li>
  );
}
