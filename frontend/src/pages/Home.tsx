import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createIdea, listIdeas, IdeaSummary } from "../api";

const TONES = [
  { slug: "gentle_comfort", label: "温柔抚慰" },
  { slug: "clear_empathy", label: "清醒共情" },
  { slug: "social_observe", label: "社会观察" },
  { slug: "psych_science", label: "心理科普" },
];

export default function Home() {
  const [ideas, setIdeas] = useState<IdeaSummary[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const data = await listIdeas();
      setIdeas(data);
    } catch {
      // backend probably not running
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    try {
      const idea = await createIdea(input.trim());
      setInput("");
      navigate(`/ideas/${idea.id}`);
    } catch (e: any) {
      setError(e.message || "提交失败");
    } finally {
      setLoading(false);
    }
  }

  const statusLabel: Record<string, string> = {
    draft: "草稿",
    pending_review: "待审核",
    approved: "已通过",
    in_production: "生产中",
    completed: "待发布",
    published: "已发布",
    rejected: "已驳回",
  };

  return (
    <div>
      {/* Input */}
      <div className="mb-10">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="输入你的内容点子，比如：原生家庭对亲密关系的影响..."
          className="w-full min-h-[120px] text-lg p-5 border border-gray-200 rounded-lg resize-y focus:outline-none focus:border-gray-400 bg-white"
          disabled={loading}
        />
        <div className="flex justify-between items-center mt-3">
          <div className="flex gap-2">
            {TONES.map((t) => (
              <span key={t.slug} className="text-xs text-gray-400 px-2 py-1 border border-gray-200 rounded">
                {t.label}
              </span>
            ))}
          </div>
          <button
            onClick={submit}
            disabled={loading || !input.trim()}
            className="px-6 py-2.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? "分析中..." : "提交点子 →"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {/* Idea list */}
      <div>
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">全部内容</h2>
        {ideas.length === 0 ? (
          <p className="text-gray-400 text-sm">还没有内容。在上方输入第一个点子开始。</p>
        ) : (
          <div className="space-y-2">
            {ideas.map((idea) => (
              <div
                key={idea.id}
                onClick={() => navigate(`/ideas/${idea.id}`)}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-gray-400 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{idea.idea_text}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(idea.created_at).toLocaleDateString("zh-CN")}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {idea.gate1_score != null && (
                    <span className="text-sm font-semibold text-gray-700">{idea.gate1_score}/10</span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded ${
                    idea.status === "published" ? "bg-green-50 text-green-700" :
                    idea.status === "rejected" ? "bg-red-50 text-red-600" :
                    idea.status === "in_production" ? "bg-blue-50 text-blue-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {statusLabel[idea.status] || idea.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
