import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type CrawlBatch,
  type CrawlItem,
  type FeedSource,
  type Track,
  crawlItemsToIdea,
  crawlItemsToTrack,
  createFeedSource,
  deleteBatch,
  deleteCrawlItem,
  deleteFeedSource,
  listBatchItems,
  listCrawlBatches,
  listFeedSources,
  listTracks,
  triggerCrawl,
  updateFeedSource,
} from "../api";

function fmtTime(s: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function CrawlDashboard() {
  const navigate = useNavigate();
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [batches, setBatches] = useState<CrawlBatch[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [items, setItems] = useState<CrawlItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    if (!activeBatchId) {
      setItems([]);
      return;
    }
    void (async () => {
      try {
        const list = await listBatchItems(activeBatchId);
        setItems(list);
        setSelected(new Set());
      } catch (e: any) {
        setErr(e.message);
      }
    })();
  }, [activeBatchId]);

  async function refreshAll() {
    setLoading(true);
    try {
      const [s, b, t] = await Promise.all([listFeedSources(), listCrawlBatches(), listTracks()]);
      setSources(s);
      setBatches(b);
      setTracks(t);
      if (b.length > 0 && !activeBatchId) setActiveBatchId(b[0].id);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCrawl() {
    if (sources.filter((s) => s.enabled).length === 0) {
      alert("请先添加并启用至少一个订阅源");
      setShowSources(true);
      return;
    }
    setCrawling(true);
    try {
      const batch = await triggerCrawl();
      const newBatches = await listCrawlBatches();
      setBatches(newBatches);
      setActiveBatchId(batch.id);
      alert(`抓取完成：${batch.item_count} 篇\n${batch.note || ""}`);
    } catch (e: any) {
      alert("抓取失败：" + e.message);
    } finally {
      setCrawling(false);
    }
  }

  async function handleDeleteBatch(bid: string) {
    if (!confirm("删除整个批次及其所有文章？不可恢复。")) return;
    await deleteBatch(bid);
    if (activeBatchId === bid) setActiveBatchId(null);
    setBatches(batches.filter((b) => b.id !== bid));
  }

  async function handleDeleteItem(iid: string) {
    if (!confirm("删除这篇文章？")) return;
    await deleteCrawlItem(iid);
    setItems(items.filter((i) => i.id !== iid));
  }

  function toggleSelect(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  }

  async function handleToTrack(itemIds: string[]) {
    if (tracks.length === 0) {
      alert("还没有赛道，请先去「内容库」创建赛道");
      return;
    }
    const tname = prompt(
      `加入哪个赛道？输入赛道名：\n\n${tracks.map((t, i) => `${i + 1}. ${t.name}`).join("\n")}`,
    );
    if (!tname) return;
    const target = tracks.find((t) => t.name === tname.trim() || t.name.includes(tname.trim()));
    if (!target) {
      alert("没找到该赛道");
      return;
    }
    try {
      const r = await crawlItemsToTrack(itemIds, target.id);
      alert(`已添加 ${r.created} 条到赛道「${target.name}」`);
      setSelected(new Set());
    } catch (e: any) {
      alert("失败：" + e.message);
    }
  }

  async function handleToIdea(itemIds: string[]) {
    const brief = prompt(
      `把选中的 ${itemIds.length} 篇文章合并为一个素材包，送去生成文章。\n\n可选：填写写作要求（不写就空着）`,
      "",
    );
    // brief === null 表示取消
    if (brief === null) return;
    try {
      const r = await crawlItemsToIdea(itemIds, brief || undefined);
      if (confirm(`已合并 ${r.merged_count} 篇为新点子，跳转去查看？`)) {
        navigate(`/ideas/${r.id}`);
      }
    } catch (e: any) {
      alert("失败：" + e.message);
    }
  }

  if (loading) return <div className="space-y-3"><div className="skeleton h-8 w-32" /><div className="skeleton h-64" /></div>;

  return (
    <div className="py-6">
      {err && (
        <div className="mb-4 p-3 bg-danger-50/60 border border-danger-500/30 rounded-lg text-sm text-danger-700">
          {err} <button onClick={() => setErr(null)} className="underline ml-2">x</button>
        </div>
      )}

      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="h-eyebrow mb-2">Crawl</p>
          <h1 className="h-display">信息爬取</h1>
          <p className="text-sm text-ink-500 mt-2">订阅 RSS / 微信公众号，定时抓取并入库</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSources(!showSources)}
            className="btn-secondary text-xs"
          >
            管理订阅源（{sources.length}）
          </button>
          <button
            onClick={handleCrawl}
            disabled={crawling}
            className="btn-primary text-xs disabled:opacity-50"
          >
            {crawling ? "抓取中…" : "🔄 一键抓取"}
          </button>
        </div>
      </div>

      {showSources && (
        <SourcePanel sources={sources} onChange={refreshAll} />
      )}

      <div className="grid grid-cols-[260px_1fr] gap-4 mt-2">
        {/* 左侧：批次历史 */}
        <div className="card overflow-hidden">
          <div className="px-3 py-2 bg-paper-100/60 border-b border-paper-300 text-sm font-medium text-ink-900">抓取历史</div>
          <div className="divide-y max-h-[70vh] overflow-y-auto">
            {batches.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-ink-400">还没有抓取记录</div>
            ) : (
              batches.map((b) => (
                <div
                  key={b.id}
                  className={`px-3 py-2 cursor-pointer hover:bg-paper-200/60 ${activeBatchId === b.id ? "bg-accent-50/60" : ""}`}
                  onClick={() => setActiveBatchId(b.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{fmtTime(b.triggered_at)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteBatch(b.id);
                      }}
                      className="text-xs text-danger-500 hover:text-danger-700 opacity-60 hover:opacity-100"
                    >
                      删
                    </button>
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {b.item_count} 篇 · {b.source_count} 源
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右侧：条目列表 */}
        <div className="card overflow-hidden">
          {activeBatchId && items.length > 0 && (
            <div className="px-3 py-2 bg-paper-100/60 border-b border-paper-300 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.size === items.length && items.length > 0}
                onChange={() => {
                  if (selected.size === items.length) setSelected(new Set());
                  else setSelected(new Set(items.map((i) => i.id)));
                }}
              />
              <span className="text-ink-500">{items.length} 篇</span>
              {selected.size > 0 && (
                <>
                  <span className="text-ink-400">|</span>
                  <span className="text-blue-700">已选 {selected.size}</span>
                  <button
                    onClick={() => handleToTrack(Array.from(selected))}
                    className="ml-2 px-2 py-0.5 text-xs border border-paper-300 rounded hover:bg-paper-200"
                  >
                    加入赛道
                  </button>
                  <button
                    onClick={() => handleToIdea(Array.from(selected))}
                    className="px-2 py-0.5 text-xs border border-paper-300 rounded hover:bg-paper-200"
                  >
                    合并送去生成文章
                  </button>
                </>
              )}
            </div>
          )}

          <div className="divide-y max-h-[70vh] overflow-y-auto">
            {!activeBatchId ? (
              <div className="px-6 py-16 text-center text-ink-400">从左侧选择一个批次查看</div>
            ) : items.length === 0 ? (
              <div className="px-6 py-16 text-center text-ink-400">这次没抓到内容</div>
            ) : (
              items.map((it) => (
                <div key={it.id} className="px-4 py-3 hover:bg-paper-200/60 flex gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(it.id)}
                    onChange={() => toggleSelect(it.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <a
                        href={it.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {it.title}
                      </a>
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5 flex gap-2">
                      {it.source_name && <span>{it.source_name}</span>}
                      {it.published_at && <span>· {fmtTime(it.published_at)}</span>}
                      {it.author && <span>· {it.author}</span>}
                    </div>
                    {it.summary && (
                      <div className="text-sm text-ink-700 mt-1 line-clamp-3">{it.summary}</div>
                    )}
                    <div className="flex gap-3 mt-2 text-xs">
                      <button onClick={() => handleToTrack([it.id])} className="text-blue-600 hover:underline">
                        加入赛道
                      </button>
                      <button onClick={() => handleToIdea([it.id])} className="text-blue-600 hover:underline">
                        送去写文章
                      </button>
                      <a href={it.link} target="_blank" rel="noopener noreferrer" className="text-ink-500 hover:underline">
                        打开原文 ↗
                      </a>
                      <button
                        onClick={() => handleDeleteItem(it.id)}
                        className="ml-auto text-danger-500 hover:text-danger-700 opacity-60 hover:opacity-100"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Source management panel ──────────────────────────────────

function SourcePanel({ sources, onChange }: { sources: FeedSource[]; onChange: () => Promise<void> }) {
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");

  async function add() {
    if (!newName.trim() || !newUrl.trim()) return;
    try {
      await createFeedSource({ name: newName.trim(), url: newUrl.trim() });
      setNewName("");
      setNewUrl("");
      await onChange();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="card-pad mb-4">
      <div className="text-sm font-medium mb-3">订阅源管理</div>

      <div className="flex gap-2 mb-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="名称（如：虎嗅）"
          className="flex-1 px-2 py-1 border border-paper-300 rounded text-sm"
        />
        <input
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="RSS URL（https://...）"
          className="flex-[2] px-2 py-1 border border-paper-300 rounded text-sm"
        />
        <button
          onClick={add}
          className="btn-primary text-xs"
        >
          + 添加
        </button>
      </div>

      {sources.length === 0 ? (
        <div className="text-sm text-ink-400 py-2">还没有订阅源</div>
      ) : (
        <div className="space-y-1">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-sm bg-white px-2 py-1 rounded border border-paper-300">
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={async () => {
                  await updateFeedSource(s.id, { enabled: !s.enabled });
                  await onChange();
                }}
                title={s.enabled ? "已启用" : "已暂停"}
              />
              <span className="font-medium w-32 truncate" title={s.name}>{s.name}</span>
              <span className="flex-1 text-xs text-ink-500 truncate" title={s.url}>{s.url}</span>
              {s.last_error && (
                <span className="text-xs text-danger-500" title={s.last_error}>⚠ 上次失败</span>
              )}
              {s.last_fetched_at && !s.last_error && (
                <span className="text-xs text-ink-400">{fmtTime(s.last_fetched_at)}</span>
              )}
              <button
                onClick={async () => {
                  if (!confirm(`删除订阅源「${s.name}」？`)) return;
                  await deleteFeedSource(s.id);
                  await onChange();
                }}
                className="text-xs text-danger-500 hover:text-danger-700"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
