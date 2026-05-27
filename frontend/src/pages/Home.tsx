import { useState, useEffect, useCallback, useId } from "react";
import { useNavigate } from "react-router-dom";
import { createIdea, listIdeas, listScenes } from "../api";
import type { IdeaSummary, SceneOption } from "../api";
import IdeaListItem from "../components/IdeaListItem";

export default function Home() {
  const [ideas, setIdeas] = useState<IdeaSummary[]>([]);
  const [input, setInput] = useState("");
  const [scene, setScene] = useState<string>("");
  const [scenes, setScenes] = useState<SceneOption[]>([]);
  const [referenceText, setReferenceText] = useState("");
  const [showReference, setShowReference] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const inputId = useId();
  const refInputId = useId();
  const navigate = useNavigate();

  const REFERENCE_MAX = 50000;

  const load = useCallback(async () => {
    try {
      const data = await listIdeas();
      setIdeas(data.items);
    } catch (e) {
      console.error("listIdeas failed:", e);
      setLoadError("后端连接失败");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    listScenes().then(setScenes).catch(() => {});
  }, []);

  async function submit() {
    if (loading || !input.trim()) return;
    setLoading(true);
    setError("");
    try {
      const idea = await createIdea(
        input.trim(),
        scene || null,
        referenceText.trim() || null,
      );
      setInput("");
      setReferenceText("");
      setShowReference(false);
      navigate(`/ideas/${idea.id}`);
    } catch (e: any) {
      setError(e.message || "提交失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* 标题区 */}
      <header className="mb-12">
        <p className="h-eyebrow mb-3">Idea → Content</p>
        <h1 className="h-display mb-2">
          把一闪而过的想法，<span className="text-accent-500">慢慢</span>写成文章
        </h1>
        <p className="text-sm text-ink-500 max-w-xl">
          写下你想到的一句话，OmniPost 会帮你做研究、起草、审稿、排版。
          你只需要保留判断力。
        </p>
      </header>

      {/* 创作输入卡 */}
      <section className="card-pad mb-16 hover:shadow-lift transition-shadow">
        <label htmlFor={inputId} className="h-eyebrow block mb-4">
          今天想聊什么
        </label>
        <textarea
          id={inputId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="比如：年轻人开始害怕接电话了……"
          className="w-full min-h-[120px] text-lg font-serif italic
                     p-0 bg-transparent border-0 resize-y
                     placeholder:text-ink-300 placeholder:italic
                     focus:outline-none text-ink-900 leading-relaxed"
          disabled={loading}
        />

        {/* 参考资料 — 可折叠展开 */}
        <div className="mt-5 pt-4 border-t border-paper-300">
          <button
            type="button"
            onClick={() => setShowReference((v) => !v)}
            className="text-xs text-ink-500 hover:text-ink-900 transition-colors flex items-center gap-1.5"
            disabled={loading}
          >
            <span className={`inline-block transition-transform ${showReference ? "rotate-90" : ""}`}>▸</span>
            <span>{showReference ? "收起参考资料" : "添加参考资料（可选）"}</span>
            {!showReference && referenceText.trim() && (
              <span className="text-accent-500 ml-1">· 已填 {referenceText.length} 字</span>
            )}
          </button>
          {showReference && (
            <div className="mt-3 fade-in">
              <label htmlFor={refInputId} className="text-xs text-ink-500 block mb-2">
                可粘贴一篇文章 / AI 给你的回复 / 研究笔记，AI 会基于它来评估和创作。
                <span className="text-ink-400">（最长 {REFERENCE_MAX.toLocaleString()} 字）</span>
              </label>
              <textarea
                id={refInputId}
                value={referenceText}
                onChange={(e) => setReferenceText(e.target.value.slice(0, REFERENCE_MAX))}
                placeholder="把你想让 AI 围绕展开的长文粘贴到这里…"
                className="w-full min-h-[140px] text-sm font-mono
                           p-3 bg-paper-100 border border-paper-300 rounded resize-y
                           placeholder:text-ink-300
                           focus:outline-none focus:border-accent-500 text-ink-900 leading-relaxed"
                disabled={loading}
              />
              <div className="mt-1 text-[11px] text-ink-400 text-right">
                {referenceText.length.toLocaleString()} / {REFERENCE_MAX.toLocaleString()}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-5 border-t border-paper-300 flex items-center gap-3 flex-wrap">
          <select
            value={scene}
            onChange={(e) => setScene(e.target.value)}
            disabled={loading}
            className="select max-w-[220px]"
            title="选择内容场景"
          >
            <option value="">通用 · 不限场景</option>
            {scenes.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <span className="text-[11px] text-ink-400 ml-auto hidden sm:inline">
            ⌘/Ctrl + Enter
          </span>
          <button
            onClick={submit}
            disabled={loading || !input.trim()}
            className="btn-primary min-w-[140px]"
          >
            {loading ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                正在分析
              </>
            ) : (
              <>生成内容包 →</>
            )}
          </button>
        </div>
        {error && (
          <p className="mt-4 text-sm text-danger-700 bg-danger-50 px-3 py-2 rounded fade-in" role="alert">
            {error}
          </p>
        )}
      </section>

      {/* 列表区 */}
      <section>
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <h2 className="h-section">最近的内容</h2>
            <p className="text-xs text-ink-500 mt-1">
              {ideas.length > 0 ? `共 ${ideas.length} 条` : "还没有内容"}
            </p>
          </div>
          <button
            onClick={() => navigate("/review")}
            className="btn-ghost text-xs"
          >
            审核队列 →
          </button>
        </div>

        {listLoading ? (
          <div className="space-y-3">
            <div className="skeleton h-16" />
            <div className="skeleton h-16" />
            <div className="skeleton h-16" />
          </div>
        ) : loadError ? (
          <div className="card-pad text-center text-danger-700">
            <p className="text-sm">{loadError}</p>
            <button
              onClick={() => { setLoadError(""); setListLoading(true); load(); }}
              className="btn-secondary mt-4 text-xs"
            >
              重试
            </button>
          </div>
        ) : ideas.length === 0 ? (
          <div className="card-pad text-center py-16">
            <p className="font-serif text-xl text-ink-400 italic mb-2">
              空白也是一种开始
            </p>
            <p className="text-xs text-ink-400">
              在上面写下第一句话，让它变成文章
            </p>
          </div>
        ) : (
          <ul className="card divide-y divide-paper-300 overflow-hidden">
            {ideas.map((idea) => <IdeaListItem key={idea.id} idea={idea} />)}
          </ul>
        )}
        {ideas.length >= 20 && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate("/ideas")}
              className="btn-ghost text-sm"
            >
              查看全部灵感库 →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
