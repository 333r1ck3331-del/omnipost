import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchReviewQueue } from "../api";
import type { IdeaSummary } from "../api";
import { STATUS_LABELS } from "../constants";

export default function ReviewQueue() {
  const [items, setItems] = useState<IdeaSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchReviewQueue();
      setItems(data);
    } catch {
      setError("无法加载审核队列");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {/* 返回首页 */}
      <button
        onClick={() => navigate("/")}
        className="text-xs text-gray-400 hover:text-gray-600 mb-8 inline-block"
      >
        ← 返回
      </button>

      <h1 className="text-xl font-semibold tracking-tight mb-1">
        审核队列
      </h1>
      <p className="text-xs text-gray-400 mb-12">
        {items.length} 条待审核内容
      </p>

      {loading ? (
        <p className="text-gray-300 text-sm">加载中...</p>
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-300 text-sm">队列已清空 🎉</p>
          <p className="text-gray-300 text-xs mt-2">所有内容已审核完毕</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((item) => (
            <li
              key={item.id}
              onClick={() => navigate(`/ideas/${item.id}`)}
              className="py-5 cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#2c2c2c] leading-relaxed truncate group-hover:text-black">
                    {item.idea_text}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs text-gray-400">
                  <span>{new Date(item.created_at).toLocaleDateString("zh-CN")}</span>
                  {item.gate1_score != null && (
                    <span className="text-gray-500">{item.gate1_score}/10</span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    {STATUS_LABELS[item.status] || item.status}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
