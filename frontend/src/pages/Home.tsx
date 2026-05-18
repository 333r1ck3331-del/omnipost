import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createIdea, listIdeas } from "../api";
import type { IdeaSummary } from "../api";
import { STATUS_LABELS } from "../constants";

export default function Home() {
  const [ideas, setIdeas] = useState<IdeaSummary[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const data = await listIdeas();
      setIdeas(data.items);
    } catch {
      setError("后端连接失败");
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

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-2">
        Omni<span className="text-gray-300">Post</span>
      </h1>
      <p className="text-xs text-gray-400 mb-2">v0.2 · 通用内容工具</p>
      <button
        onClick={() => navigate("/settings")}
        className="text-xs text-gray-300 hover:text-gray-500 mb-12 block"
      >
        设置 →
      </button>

      <div className="mb-16">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="比如：年轻人开始害怕接电话了......"
          className="w-full min-h-[100px] text-base italic p-0 bg-transparent border-0 border-b border-gray-200 resize-y focus:outline-none focus:border-gray-400 placeholder-gray-300"
          disabled={loading}
        />

        <div className="mt-8">
          <button
            onClick={submit}
            disabled={loading || !input.trim()}
            className="text-sm px-5 py-2 rounded bg-gray-800 text-white hover:bg-black disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {loading ? "分析中..." : "生成内容包 →"}
          </button>
        </div>
        {error && <p className="mt-4 text-xs text-red-500">{error}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs text-gray-400 tracking-wider">全部内容</h2>
          <button
            onClick={() => navigate("/review")}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            审核队列 →
          </button>
        </div>
        {ideas.length === 0 ? (
          <p className="text-gray-300 text-sm">还没有内容。</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {ideas.map((idea) => (
              <li
                key={idea.id}
                onClick={() => navigate(`/ideas/${idea.id}`)}
                className="py-5 cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-6">
                  <p className="text-sm text-[#2c2c2c] leading-relaxed flex-1 min-w-0 truncate group-hover:text-black">
                    {idea.idea_text}
                  </p>
                  <div className="flex items-center gap-4 shrink-0 text-xs text-gray-400">
                    <span>{new Date(idea.created_at).toLocaleDateString("zh-CN")}</span>
                    {idea.gate1_score != null && (
                      <span className="text-gray-500">{idea.gate1_score}/100</span>
                    )}
                    <span className="text-gray-400">
                      {STATUS_LABELS[idea.status] || idea.status}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
