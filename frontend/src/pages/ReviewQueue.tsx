import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchReviewQueue } from "../api";
import type { IdeaSummary } from "../api";
import IdeaListItem from "../components/IdeaListItem";

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
    } catch (e) {
      console.error("fetchReviewQueue failed:", e);
      setError("无法加载审核队列");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <button
        onClick={() => navigate("/")}
        className="btn-ghost text-xs mb-8 -ml-3"
      >
        ← 返回
      </button>

      <header className="mb-10">
        <p className="h-eyebrow mb-2">Review Queue</p>
        <h1 className="h-display mb-2">审核队列</h1>
        <p className="text-sm text-ink-500">
          {items.length > 0 ? `${items.length} 条内容等待你的判断` : "暂无待审"}
        </p>
      </header>

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-16" />
          <div className="skeleton h-16" />
        </div>
      ) : error ? (
        <div className="card-pad text-center text-danger-700">
          <p className="text-sm">{error}</p>
          <button onClick={load} className="btn-secondary mt-4 text-xs">重试</button>
        </div>
      ) : items.length === 0 ? (
        <div className="card-pad text-center py-20">
          <p className="font-serif text-2xl text-ink-400 mb-2">队列已清空</p>
          <p className="text-xs text-ink-400">所有内容都审核完了，去喝杯茶吧 🍵</p>
        </div>
      ) : (
        <ul className="card divide-y divide-paper-300 overflow-hidden">
          {items.map((item) => (
            <IdeaListItem key={item.id} idea={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
