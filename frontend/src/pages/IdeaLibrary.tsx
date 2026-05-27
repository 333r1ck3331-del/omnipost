import { useEffect, useState, useCallback } from "react";
import { listIdeas, type IdeaSummary } from "../api";
import IdeaListItem from "../components/IdeaListItem";
import { STATUS_LABELS, SCENE_LABELS } from "../constants";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "pending_review", label: STATUS_LABELS.pending_review },
  { value: "in_production", label: STATUS_LABELS.in_production },
  { value: "review", label: STATUS_LABELS.review },
  { value: "completed", label: STATUS_LABELS.completed },
  { value: "published", label: STATUS_LABELS.published },
  { value: "rejected", label: STATUS_LABELS.rejected },
  { value: "production_failed", label: STATUS_LABELS.production_failed },
];

const SCENE_OPTIONS = [
  { value: "", label: "全部场景" },
  ...Object.entries(SCENE_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

export default function IdeaLibrary() {
  const [items, setItems] = useState<IdeaSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [status, setStatus] = useState("");
  const [scene, setScene] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listIdeas({
        status: status || undefined,
        scene: scene || undefined,
        q: q || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e: any) {
      setError(e?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [status, scene, q, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 筛选/搜索变化时回到第 1 页
  useEffect(() => { setPage(0); }, [q, status, scene]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setQ(qInput.trim());
  }

  return (
    <div className="space-y-8">
      {/* 标题 */}
      <header>
        <p className="h-eyebrow">所有做过的想法</p>
        <h1 className="h-display text-3xl">灵感库</h1>
        <p className="text-ink-500 mt-2 text-sm">
          搜一搜，翻一翻 —— 看看你都想过些什么。
        </p>
      </header>

      {/* 工具栏 */}
      <div className="card p-5 space-y-4">
        <form onSubmit={onSearchSubmit} className="flex gap-3 items-center">
          <input
            type="text"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="搜索想法或正文……"
            className="input flex-1"
          />
          <button type="submit" className="btn-primary shrink-0">搜索</button>
          {q && (
            <button
              type="button"
              onClick={() => { setQ(""); setQInput(""); }}
              className="btn-ghost shrink-0"
            >
              清除
            </button>
          )}
        </form>
        <div className="flex flex-wrap gap-3 items-center">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input max-w-[180px]">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={scene} onChange={(e) => setScene(e.target.value)} className="input max-w-[180px]">
            {SCENE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span className="text-xs text-ink-400 ml-auto">
            共 <span className="font-mono text-ink-700">{total}</span> 条
          </span>
        </div>
      </div>

      {/* 列表 */}
      <div className="card">
        {error && (
          <div className="p-5 text-danger-700 text-sm">{error}</div>
        )}
        {loading && items.length === 0 && (
          <div className="p-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-lg" />
            ))}
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="p-12 text-center text-ink-400 text-sm">
            没找到匹配的想法。换个关键词或筛选试试。
          </div>
        )}
        {items.length > 0 && (
          <ul className="divide-y divide-paper-300">
            {items.map((idea) => <IdeaListItem key={idea.id} idea={idea} />)}
          </ul>
        )}
      </div>

      {/* 分页 */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-400">
            第 {from}–{to} 条，共 {total} 条
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="btn-ghost disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← 上一页
            </button>
            <span className="text-ink-500 px-2">
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="btn-ghost disabled:opacity-40 disabled:cursor-not-allowed"
            >
              下一页 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
