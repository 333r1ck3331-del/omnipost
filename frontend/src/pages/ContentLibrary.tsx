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
  to_edit: "bg-gray-100 text-gray-700",
  to_publish: "bg-yellow-100 text-yellow-800",
  published: "bg-green-100 text-green-800",
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
    return <div className="py-8 text-gray-500">加载中…</div>;
  }

  return (
    <div className="py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">内容库</h1>
      </div>

      {err && <div className="px-3 py-2 bg-red-50 text-red-700 text-sm rounded">{err}</div>}

      {/* Tracks tab bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {tracks.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTrackId(t.id)}
            className={`px-3 py-1.5 rounded text-sm transition ${
              t.id === activeTrackId
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {t.name}
            <span className={`ml-2 text-xs ${t.id === activeTrackId ? "text-gray-300" : "text-gray-400"}`}>
              {t.entry_count}
            </span>
          </button>
        ))}
        <button
          onClick={() => setShowAddTrack(true)}
          className="px-3 py-1.5 rounded text-sm border border-dashed border-gray-400 text-gray-600 hover:bg-gray-50"
        >
          + 新建赛道
        </button>
      </div>

      {tracks.length === 0 && (
        <div className="py-12 text-center text-gray-500 text-sm">
          还没有赛道。点击"新建赛道"开始。
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
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-100 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-gray-900">{track.name}</h2>
          {track.description && (
            <span className="text-sm text-gray-500">— {track.description}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filter}
            onChange={(ev) => setFilter(ev.target.value as EntryStatus | "")}
            className="px-2 py-1 text-sm border border-gray-300 rounded"
          >
            <option value="">全部状态</option>
            <option value="to_edit">待编辑</option>
            <option value="to_publish">待发布</option>
            <option value="published">已发布</option>
          </select>
          <button
            onClick={onAddEntry}
            className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-800"
          >
            + 添加条目
          </button>
          <a
            href={exportTrackXlsxUrl(track.id)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            导出 Excel
          </a>
          <label className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 cursor-pointer">
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
            onClick={onDeleteTrack}
            className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
          >
            删除赛道
          </button>
        </div>
      </div>

      {/* Batch actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100 text-sm">
          <span className="text-blue-900">已选 {selected.size} 条</span>
          <span className="text-gray-400">|</span>
          <span>批量改状态：</span>
          <button onClick={() => onBatchStatus("to_edit")} className="px-2 py-0.5 rounded hover:bg-blue-100">待编辑</button>
          <button onClick={() => onBatchStatus("to_publish")} className="px-2 py-0.5 rounded hover:bg-blue-100">待发布</button>
          <button onClick={() => onBatchStatus("published")} className="px-2 py-0.5 rounded hover:bg-blue-100">已发布</button>
        </div>
      )}

      {/* Table */}
      {entries.length === 0 ? (
        <div className="py-12 text-center text-gray-500 text-sm">
          赛道下还没有条目，点击"添加条目"或"导入 Excel"开始。
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="w-10 px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === entries.length && entries.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-3 py-2 text-left">标题</th>
                <th className="px-3 py-2 text-left">选题方向</th>
                <th className="px-3 py-2 text-left">发布日期</th>
                <th className="px-3 py-2 text-left">状态</th>
                <th className="px-3 py-2 text-left">备注</th>
                <th className="w-16 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
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
      <td className="px-3 py-2">
        <input
          value={draft.topic_direction || ""}
          onChange={(e) => setDraft({ ...draft, topic_direction: e.target.value })}
          onBlur={() => commit("topic_direction", draft.topic_direction || null)}
          className="w-full bg-transparent focus:bg-white focus:border-gray-300 border border-transparent rounded px-1 py-0.5"
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
      <td className="px-3 py-2">
        <input
          value={draft.notes || ""}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          onBlur={() => commit("notes", draft.notes || null)}
          className="w-full bg-transparent focus:bg-white focus:border-gray-300 border border-transparent rounded px-1 py-0.5"
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20" onClick={onClose}>
      <div
        className="bg-white rounded-lg p-6 w-96 max-w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-medium mb-4">新建赛道</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">名称 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：心理赛道"
              className="w-full px-3 py-1.5 border border-gray-300 rounded"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">描述（可选）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-1.5 border border-gray-300 rounded"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">取消</button>
          <button
            onClick={() => name.trim() && onSubmit(name.trim(), description.trim())}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
