import { useEffect, useRef, useState } from "react";
import {
  type ContentEntry,
  type EntryStatus,
  type Track,
  batchUpdateEntries,
  createEntry,
  createTrack,
  deleteEntry,
  deleteTrack,
  clearTrackEntries,
  exportTrackXlsxUrl,
  importTrackXlsx,
  listEntries,
  listTracks,
  updateEntry,
} from "../api";

const STATUS_LABEL: Record<EntryStatus, string> = {
  to_edit: "待编辑",
  to_publish: "待发布",
  published: "已发布",
};

const STATUS_COLORS: Record<EntryStatus, string> = {
  to_edit: "bg-paper-200 text-ink-700 border border-paper-300",
  to_publish: "bg-warn-50 text-warn-700 border border-warn-500/30",
  published: "bg-success-50 text-success-700 border border-success-500/30",
};

export default function ContentLibrary() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<EntryStatus | "">("");
  const [showAddTrack, setShowAddTrack] = useState(false);

  // Load tracks on mount
  useEffect(() => {
    void refreshTracks();
  }, []);

  // Load entries whenever active track or filter changes
  useEffect(() => {
    if (!activeTrackId) {
      setEntries([]);
      return;
    }
    void refreshEntries();
  }, [activeTrackId, filter]);

  async function refreshTracks() {
    setLoading(true);
    setErr(null);
    try {
      const list = await listTracks();
      setTracks(list);
      if (!activeTrackId && list.length > 0) {
        setActiveTrackId(list[0].id);
      }
      if (activeTrackId && !list.some((t) => t.id === activeTrackId)) {
        setActiveTrackId(list[0]?.id ?? null);
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshEntries() {
    if (!activeTrackId) return;
    try {
      const list = await listEntries(activeTrackId, filter || undefined);
      setEntries(list);
      setSelected(new Set());
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function handleAddTrack(name: string, description: string) {
    try {
      const t = await createTrack(name, description);
      setShowAddTrack(false);
      await refreshTracks();
      setActiveTrackId(t.id);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleDeleteTrack(id: string) {
    if (!confirm("确定删除该赛道？该赛道下所有条目会一并删除。")) return;
    await deleteTrack(id);
    await refreshTracks();
  }

  async function handleAddEntry() {
    if (!activeTrackId) return;
    try {
      await createEntry(activeTrackId, { title: "新条目" });
      await refreshEntries();
      await refreshTracks(); // 更新 entry_count
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleEntryChange(entry: ContentEntry, patch: Partial<ContentEntry>) {
    try {
      await updateEntry(entry.id, patch as any);
      await refreshEntries();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleDeleteEntry(id: string) {
    if (!confirm("确定删除？")) return;
    await deleteEntry(id);
    await refreshEntries();
    await refreshTracks();
  }

  async function handleBatchStatus(status: EntryStatus) {
    if (selected.size === 0) return;
    await batchUpdateEntries([...selected], status);
    await refreshEntries();
  }

  const activeTrack = tracks.find((t) => t.id === activeTrackId) || null;

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-8 w-32" />
        <div className="skeleton h-10 w-full" />
        <div className="skeleton h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="mb-2">
        <p className="h-eyebrow mb-2">Library</p>
        <h1 className="h-display">内容库</h1>
        <p className="text-sm text-ink-500 mt-2">按赛道管理选题、编辑状态、批量导出导入</p>
      </header>

      {err && (
        <div className="px-4 py-3 bg-danger-50/60 border border-danger-500/30 text-danger-700 text-sm rounded-lg">
          {err}
        </div>
      )}

      {/* Tracks tab bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {tracks.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTrackId(t.id)}
            className={`px-4 py-2 rounded-lg text-sm transition border ${
              t.id === activeTrackId
                ? "bg-accent-500 text-white border-accent-500 shadow-warm"
                : "bg-paper-50 border-paper-300 text-ink-700 hover:border-accent-400"
            }`}
          >
            {t.name}
            <span className={`ml-2 text-xs ${t.id === activeTrackId ? "text-white/70" : "text-ink-400"}`}>
              {t.entry_count}
            </span>
          </button>
        ))}
        <button
          onClick={() => setShowAddTrack(true)}
          className="px-4 py-2 rounded-lg text-sm border border-dashed border-paper-300 text-ink-500 hover:border-accent-400 hover:text-accent-600 transition"
        >
          + 新建赛道
        </button>
      </div>

      {tracks.length === 0 && (
        <div className="card-pad text-center py-16">
          <p className="font-serif text-xl text-ink-400 mb-2">还没有赛道</p>
          <p className="text-xs text-ink-400">点击"新建赛道"开始整理你的内容计划</p>
        </div>
      )}

      {activeTrack && (
        <TrackPanel
          track={activeTrack}
          entries={entries}
          selected={selected}
          setSelected={setSelected}
          filter={filter}
          setFilter={setFilter}
          onAddEntry={handleAddEntry}
          onDeleteTrack={() => handleDeleteTrack(activeTrack.id)}
          onEntryChange={handleEntryChange}
          onDeleteEntry={handleDeleteEntry}
          onBatchStatus={handleBatchStatus}
          onImported={async () => {
            await refreshEntries();
            await refreshTracks();
          }}
        />
      )}

      {showAddTrack && (
        <AddTrackModal
          onClose={() => setShowAddTrack(false)}
          onSubmit={handleAddTrack}
        />
      )}
    </div>
  );
}

interface PanelProps {
  track: Track;
  entries: ContentEntry[];
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  filter: EntryStatus | "";
  setFilter: (s: EntryStatus | "") => void;
  onAddEntry: () => void;
  onDeleteTrack: () => void;
  onEntryChange: (e: ContentEntry, patch: Partial<ContentEntry>) => void;
  onDeleteEntry: (id: string) => void;
  onBatchStatus: (s: EntryStatus) => void;
  onImported: () => void;
}

function TrackPanel({
  track, entries, selected, setSelected, filter, setFilter,
  onAddEntry, onDeleteTrack, onEntryChange, onDeleteEntry, onBatchStatus, onImported,
}: PanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("导入会向当前赛道追加条目（不会去重 / 不会替换现有数据）。继续？")) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setImporting(true);
    try {
      const r = await importTrackXlsx(track.id, file);
      alert(`导入完成：新增 ${r.created}，跳过 ${r.skipped}${r.errors.length ? "，错误 " + r.errors.length : ""}`);
      onImported();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function toggleSelect(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  }

  function toggleSelectAll() {
    if (selected.size === entries.length) setSelected(new Set());
    else setSelected(new Set(entries.map((e) => e.id)));
  }

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-paper-300 flex-wrap bg-paper-100/40">
        <div className="flex items-baseline gap-2">
          <h2 className="font-serif text-lg text-ink-900">{track.name}</h2>
          {track.description && (
            <span className="text-sm text-ink-500">— {track.description}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filter}
            onChange={(ev) => setFilter(ev.target.value as EntryStatus | "")}
            className="px-3 py-1.5 text-sm border border-paper-300 rounded bg-paper-50"
          >
            <option value="">全部状态</option>
            <option value="to_edit">待编辑</option>
            <option value="to_publish">待发布</option>
            <option value="published">已发布</option>
          </select>
          <button onClick={onAddEntry} className="btn-primary text-xs">
            + 添加条目
          </button>
          <a href={exportTrackXlsxUrl(track.id)} className="btn-secondary text-xs">
            导出 Excel
          </a>
          <label className="btn-secondary text-xs cursor-pointer">
            {importing ? "导入中…" : "导入 Excel"}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              onChange={handleImport}
              className="hidden"
              disabled={importing}
            />
          </label>
          <button
            onClick={async () => {
              if (!confirm(`确定清空"${track.name}"下所有 ${entries.length} 条条目？（赛道保留，条目不可恢复）`)) return;
              try {
                const r = await clearTrackEntries(track.id);
                alert(`已清空 ${r.deleted} 条`);
                onImported();
              } catch (err: any) {
                alert(err.message);
              }
            }}
            disabled={entries.length === 0}
            className="px-3 py-1.5 text-xs text-warn-700 border border-warn-500/30 rounded hover:bg-warn-50/40 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            清空条目
          </button>
          <button
            onClick={onDeleteTrack}
            className="px-3 py-1.5 text-xs text-danger-700 border border-danger-500/30 rounded hover:bg-danger-50/40 transition"
          >
            删除赛道
          </button>
        </div>
      </div>

      {/* Batch actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-accent-50/60 border-b border-accent-500/20 text-sm fade-in">
          <span className="text-accent-700 font-medium">已选 {selected.size} 条</span>
          <span className="text-ink-400">|</span>
          <span className="text-ink-700">批量改状态：</span>
          <button onClick={() => onBatchStatus("to_edit")} className="px-2 py-0.5 rounded text-xs hover:bg-paper-200/60 transition">待编辑</button>
          <button onClick={() => onBatchStatus("to_publish")} className="px-2 py-0.5 rounded text-xs hover:bg-paper-200/60 transition">待发布</button>
          <button onClick={() => onBatchStatus("published")} className="px-2 py-0.5 rounded text-xs hover:bg-paper-200/60 transition">已发布</button>
        </div>
      )}

      {/* Table */}
      {entries.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-serif text-lg text-ink-400 mb-1">赛道空空如也</p>
          <p className="text-xs text-ink-400">点击"添加条目"或"导入 Excel"开始</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper-100/60 text-ink-500">
              <tr>
                <th className="w-10 px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === entries.length && entries.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium">标题</th>
                <th className="px-3 py-2 text-left font-medium">选题方向</th>
                <th className="px-3 py-2 text-left font-medium">发布日期</th>
                <th className="px-3 py-2 text-left font-medium">状态</th>
                <th className="px-3 py-2 text-left font-medium">备注</th>
                <th className="w-16 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-300">
              {entries.map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  checked={selected.has(e.id)}
                  onCheck={() => toggleSelect(e.id)}
                  onChange={(patch) => onEntryChange(e, patch)}
                  onDelete={() => onDeleteEntry(e.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  entry: ContentEntry;
  checked: boolean;
  onCheck: () => void;
  onChange: (patch: Partial<ContentEntry>) => void;
  onDelete: () => void;
}

function EntryRow({ entry, checked, onCheck, onChange, onDelete }: RowProps) {
  const [draft, setDraft] = useState(entry);
  // sync when entry changes from outside (e.g. after refetch)
  useEffect(() => setDraft(entry), [entry.id, entry.updated_at]);

  function commit<K extends keyof ContentEntry>(field: K, value: ContentEntry[K]) {
    if (entry[field] === value) return;
    onChange({ [field]: value } as any);
  }

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-3 py-2">
        <input type="checkbox" checked={checked} onChange={onCheck} />
      </td>
      <td className="px-3 py-2">
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          onBlur={() => commit("title", draft.title)}
          className="w-full bg-transparent focus:bg-white focus:border-gray-300 border border-transparent rounded px-1 py-0.5"
        />
      </td>
      <td className="px-3 py-2 align-top min-w-[240px]">
        <textarea
          value={draft.topic_direction || ""}
          onChange={(e) => setDraft({ ...draft, topic_direction: e.target.value })}
          onBlur={() => commit("topic_direction", draft.topic_direction || null)}
          rows={3}
          placeholder="选题方向、角度、想法、参考……可写多行"
          className="w-full bg-transparent focus:bg-white focus:border-gray-300 border border-transparent rounded px-1 py-0.5 resize-y leading-snug placeholder:text-ink-300"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="date"
          value={draft.publish_date || ""}
          onChange={(e) => {
            const v = e.target.value || null;
            setDraft({ ...draft, publish_date: v });
            commit("publish_date", v);
          }}
          className="bg-transparent focus:bg-white focus:border-gray-300 border border-transparent rounded px-1 py-0.5"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={draft.status}
          onChange={(e) => {
            const v = e.target.value as EntryStatus;
            setDraft({ ...draft, status: v });
            commit("status", v);
          }}
          className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[draft.status]}`}
        >
          <option value="to_edit">{STATUS_LABEL.to_edit}</option>
          <option value="to_publish">{STATUS_LABEL.to_publish}</option>
          <option value="published">{STATUS_LABEL.published}</option>
        </select>
      </td>
      <td className="px-3 py-2 align-top min-w-[240px]">
        <textarea
          value={draft.notes || ""}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          onBlur={() => commit("notes", draft.notes || null)}
          rows={3}
          placeholder="提纲、金句、参考链接、备忘……可写多行"
          className="w-full bg-transparent focus:bg-white focus:border-gray-300 border border-transparent rounded px-1 py-0.5 resize-y leading-snug placeholder:text-ink-300"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <button
          onClick={onDelete}
          className="text-xs text-red-600 hover:underline"
        >
          删除
        </button>
      </td>
    </tr>
  );
}

interface ModalProps {
  onClose: () => void;
  onSubmit: (name: string, description: string) => void;
}

function AddTrackModal({ onClose, onSubmit }: ModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div className="fixed inset-0 bg-ink-900/50 backdrop-blur-sm flex items-center justify-center z-30 fade-in" onClick={onClose}>
      <div
        className="bg-paper-50 border border-paper-300 shadow-lift rounded-xl p-6 w-96 max-w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-xl text-ink-900 mb-4">新建赛道</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-ink-700 mb-1.5">名称 <span className="text-danger-500">*</span></label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：心理赛道"
              className="input"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-ink-700 mb-1.5">描述（可选）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="textarea"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn-ghost">取消</button>
          <button
            onClick={() => name.trim() && onSubmit(name.trim(), description.trim())}
            disabled={!name.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
