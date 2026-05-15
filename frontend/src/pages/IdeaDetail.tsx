import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getIdea, approveGate1, rejectGate1, produceContent,
  editReview, approveReview, rejectReview, markPublished,
} from "../api";
import type { Idea } from "../api";
import { CONTENT_TYPES, TYPE_LABELS, STATUS_LABELS } from "../constants";

export default function IdeaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([...CONTENT_TYPES]);
  const [editGzh, setEditGzh] = useState("");
  const [editXhs, setEditXhs] = useState("");
  const [editVideo, setEditVideo] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getIdea(id);
      setIdea(data);
      setEditGzh(data.content_gzh || "");
      setEditXhs(data.content_xhs || "");
      setEditVideo(data.content_video_script || "");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-gray-300 text-sm">加载中...</p>;
  if (!idea) return <p className="text-red-500 text-sm">{error || "未找到"}</p>;

  const isGate1Ready = idea.status === "pending_review";
  const isApproved = idea.status === "approved";
  const isProducing = idea.status === "in_production";
  const isCompleted = idea.status === "completed";
  const isPublished = idea.status === "published";

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => navigate("/")}
        className="text-xs text-gray-400 hover:text-gray-600 mb-10 transition"
      >
        ← 返回
      </button>

      {/* Title */}
      <h1 className="text-xl font-medium leading-relaxed mb-3 text-[#2c2c2c]">
        {idea.idea_text}
      </h1>
      <div className="flex gap-3 text-xs text-gray-400 mb-16">
        <span>{idea.track}</span>
        <span>·</span>
        <span>{new Date(idea.created_at).toLocaleString("zh-CN")}</span>
        <span>·</span>
        <span>{STATUS_LABELS[idea.status] || idea.status}</span>
      </div>

      {/* Gate 1 */}
      <section className="mb-16">
        <h2 className="text-xs text-gray-400 tracking-wider mb-6">
          门禁 1 · 价值判断
        </h2>
        {idea.gate1_score != null && idea.gate1_result ? (
          <div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-light text-[#2c2c2c]">{idea.gate1_score}</span>
              <span className="text-sm text-gray-400">/ 10</span>
            </div>
            {idea.gate1_result.verdict && (
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                {idea.gate1_result.verdict}
              </p>
            )}
            {idea.gate1_result.error && (
              <p className="text-sm text-red-500">{idea.gate1_result.error}</p>
            )}
            {isGate1Ready && (
              <div className="flex gap-6 mt-8">
                <button
                  onClick={async () => { await approveGate1(idea.id); load(); }}
                  className="text-sm text-gray-800 hover:text-black transition"
                >
                  通过，开始生产 →
                </button>
                <button
                  onClick={async () => { await rejectGate1(idea.id); load(); }}
                  className="text-sm text-gray-400 hover:text-gray-600 transition"
                >
                  驳回
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">价值判断未完成。请确认后端 API Key 已配置。</p>
        )}
      </section>

      {/* Production selector */}
      {isApproved && (
        <section className="mb-16">
          <h2 className="text-xs text-gray-400 tracking-wider mb-6">
            内容生产
          </h2>
          <div className="flex flex-wrap gap-2 mb-8">
            {CONTENT_TYPES.map((t) => {
              const selected = selectedTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    if (selected) setSelectedTypes(selectedTypes.filter((x) => x !== t));
                    else setSelectedTypes([...selectedTypes, t]);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full transition ${
                    selected
                      ? "bg-gray-800 text-white"
                      : "bg-[#f5f1ea] text-gray-500 border border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>
          <button
            onClick={async () => {
              if (selectedTypes.length === 0) return;
              try {
                await produceContent(idea.id, selectedTypes);
                await load();
              } catch (e: any) {
                setError(e.message);
                load();
              }
            }}
            className="text-sm text-gray-800 hover:text-black transition"
          >
            开始生成 →
          </button>
        </section>
      )}

      {/* Producing */}
      {isProducing && (
        <section className="mb-16">
          <p className="text-sm text-gray-400">AI 正在生成内容，请稍候...</p>
        </section>
      )}

      {/* Review */}
      {(isCompleted || isPublished) && (
        <section className="mb-16 space-y-10">
          <h2 className="text-xs text-gray-400 tracking-wider">门禁 2 · 内容审核</h2>

          {idea.title_suggestions && idea.title_suggestions.length > 0 && (
            <div>
              <h3 className="text-xs text-gray-400 mb-3">标题建议</h3>
              <div className="flex flex-wrap gap-2">
                {idea.title_suggestions.map((t, i) => (
                  <span key={i} className="text-xs px-3 py-1.5 bg-[#f5f1ea] text-gray-600 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {editGzh && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs text-gray-400">公众号长文</h3>
                {!isPublished && (
                  <button
                    onClick={async () => { await rejectReview(idea.id, "gzh"); load(); }}
                    className="text-xs text-gray-400 hover:text-red-500 transition"
                  >
                    重做
                  </button>
                )}
              </div>
              <textarea
                value={editGzh}
                onChange={(e) => setEditGzh(e.target.value)}
                className="w-full min-h-[240px] text-sm p-4 bg-white border border-gray-100 rounded resize-y focus:outline-none focus:border-gray-300 leading-relaxed"
              />
            </div>
          )}

          {editXhs && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs text-gray-400">小红书短文</h3>
                {!isPublished && (
                  <button
                    onClick={async () => { await rejectReview(idea.id, "xhs"); load(); }}
                    className="text-xs text-gray-400 hover:text-red-500 transition"
                  >
                    重做
                  </button>
                )}
              </div>
              <textarea
                value={editXhs}
                onChange={(e) => setEditXhs(e.target.value)}
                className="w-full min-h-[140px] text-sm p-4 bg-white border border-gray-100 rounded resize-y focus:outline-none focus:border-gray-300 leading-relaxed"
              />
            </div>
          )}

          {editVideo && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs text-gray-400">视频脚本</h3>
                {!isPublished && (
                  <button
                    onClick={async () => { await rejectReview(idea.id, "video"); load(); }}
                    className="text-xs text-gray-400 hover:text-red-500 transition"
                  >
                    重做
                  </button>
                )}
              </div>
              <textarea
                value={editVideo}
                onChange={(e) => setEditVideo(e.target.value)}
                className="w-full min-h-[140px] text-sm p-4 bg-white border border-gray-100 rounded resize-y focus:outline-none focus:border-gray-300 font-mono leading-relaxed"
              />
            </div>
          )}

          {!isPublished && (
            <div>
              <button
                onClick={async () => {
                  await editReview(idea.id, {
                    content_gzh: editGzh,
                    content_xhs: editXhs,
                    content_video_script: editVideo,
                  });
                  await approveReview(idea.id);
                  load();
                }}
                className="text-sm text-gray-800 hover:text-black transition"
              >
                审核通过 ✓
              </button>
            </div>
          )}
        </section>
      )}

      {/* Publish */}
      {isCompleted && !isPublished && (
        <section className="mb-16">
          <h2 className="text-xs text-gray-400 tracking-wider mb-6">发布</h2>
          <button
            onClick={async () => { await markPublished(idea.id); load(); }}
            className="text-sm text-gray-800 hover:text-black transition"
          >
            标记为已发布 →
          </button>
        </section>
      )}

      {isPublished && (
        <section className="mb-16">
          <p className="text-sm text-gray-500">✓ 已发布</p>
        </section>
      )}

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
