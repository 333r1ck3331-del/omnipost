import { useNavigate } from "react-router-dom";
import type { IdeaSummary } from "../api";
import { STATUS_LABELS } from "../constants";

const STATUS_COLORS: Record<string, string> = {
  pending_review: "text-amber-600 bg-amber-50",
  in_production:  "text-blue-600 bg-blue-50",
  review:         "text-purple-600 bg-purple-50",
  completed:      "text-green-600 bg-green-50",
  published:      "text-gray-400 bg-gray-50",
  rejected:       "text-red-500 bg-red-50",
  production_failed: "text-red-600 bg-red-50",
};

type Props = {
  idea: IdeaSummary;
};

export default function IdeaListItem({ idea }: Props) {
  const navigate = useNavigate();
  const date = new Date(idea.created_at).toLocaleDateString("zh-CN");
  const scoreLabel =
    idea.gate1_score == null
      ? null
      : idea.gate1_score < 0
      ? "评估失败"
      : `${idea.gate1_score}/100`;

  const scoreColor =
    idea.gate1_score != null && idea.gate1_score >= 80 ? "text-green-600" :
    idea.gate1_score != null && idea.gate1_score >= 60 ? "text-gray-500"  :
    idea.gate1_score != null ? "text-red-500" : "";

  return (
    <li className="py-0">
      <button
        type="button"
        onClick={() => navigate(`/ideas/${idea.id}`)}
        className="w-full text-left py-4 px-3 hover:bg-gray-50 rounded cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
      >
        <div className="flex items-start justify-between gap-6 mb-2">
          <p className="text-sm text-[#2c2c2c] leading-relaxed flex-1 line-clamp-2 group-hover:text-black">
            {idea.idea_text}
          </p>
          <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${STATUS_COLORS[idea.status] ?? "text-gray-400 bg-gray-50"}`}>
            {STATUS_LABELS[idea.status] || idea.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span>{date}</span>
          {scoreLabel && (
            <span className={`font-mono ${scoreColor}`}>★ {scoreLabel}</span>
          )}
        </div>
      </button>
    </li>
  );
}
