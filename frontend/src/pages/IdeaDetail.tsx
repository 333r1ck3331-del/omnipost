import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getIdea, approveGate1, rejectGate1, produceContent,
  editReview, approveReview, rejectReview, markPublished,
  Idea,
} from "../api";

const TYPE_LABELS: Record<string, string> = {
  gzh: "公众号",
  xhs: "小红书",
  video: "视频脚本",
};

export default function IdeaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["gzh", "xhs", "video"]);
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

  if (loading) return <p className="text-gray-400 text-sm">加载中...</p>;
  if (!idea) return <p className="text-red-500">{error || "未找到"}</p>;

  const isGate1Ready = idea.status === "pending_review" || idea.status === "draft";
  const isApproved = idea.status === "approved";
  const isProducing = idea.status === "in_production";
  const isCompleted = idea.status === "completed";
  const isPublished = idea.status === "published";
  const isRejected = idea.status === "rejected";

  return (
    <div>
      {/* Back + title */}
      <button onClick={() => navigate("/")} className="text-sm text-gray-400 hover:text-gray-600 mb-4">
        ← 返回
      </button>
      <h1 className="text-xl font-semibold mb-1">{idea.idea_text}</h1>
      <div className="flex gap-3 text-xs text-gray-400 mb-8">
        <span>{idea.track}</span>
        <span>·</span>
        <span>{new Date(idea.created_at).toLocaleString("zh-CN")}</span>
        <span>·</span>
        <span className={`font-medium ${
          isPublished ? "text-green-600" : isRejected ? "text-red-500" : "text-gray-600"
        }`}>{idea.status}</span>
      </div>

      {/* Gate 1: Value Judgment */}
      <section className="mb-8 p-5 bg-white border border-gray-200 rounded-lg">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
          门禁 1 · 价值判断
        </h2>
        {idea.gate1_score != null && idea.gate1_result ? (
          <div>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-3xl font-bold">{idea.gate1_score}</span>
              <span className="text-sm text-gray-500">/10</span>
            </div>
            {idea.gate1_result.verdict && (
              <p className="text-sm text-gray-600 mb-3">{idea.gate1_result.verdict}</p>
            )}
            {idea.gate1_result.error && (
              <p className="text-sm text-red-500">{idea.gate1_result.error}</p>
            )}
            {isGate1Ready && (
              <div className="flex gap-3 mt-4">
                <button
                  onClick={async () => { await approveGate1(idea.id); load(); }}
                  className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition"
                >
                  通过，开始生产
                </button>
                <button
                  onClick={async () => { await rejectGate1(idea.id); load(); }}
                  className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 transition"
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
        <section className="mb-8 p-5 bg-white border border-gray-200 rounded-lg">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            内容生产
          </h2>
          <div className="flex gap-4 mb-4">
            {["gzh", "xhs", "video"].map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(t)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedTypes([...selectedTypes, t]);
                    else setSelectedTypes(selectedTypes.filter((x) => x !== t));
                  }}
                />
                {TYPE_LABELS[t]}
              </label>
            ))}
          </div>
          <button
            onClick={async () => {
              if (selectedTypes.length === 0) return;
              setIdea({ ...idea, status: "in_production" });
              try {
                const updated = await produceContent(idea.id, selectedTypes);
                setIdea(updated);
                setEditGzh(updated.content_gzh || "");
                setEditXhs(updated.content_xhs || "");
                setEditVideo(updated.content_video_script || "");
              } catch (e: any) {
                setError(e.message);
                load();
              }
            }}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition"
          >
            开始生成
          </button>
        </section>
      )}

      {/* Producing */}
      {isProducing && (
        <section className="mb-8 p-5 bg-white border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-500">AI 正在生成内容，请稍候...</p>
        </section>
      )}

      {/* Review (completed) */}
      {(isCompleted || isPublished) && (
        <section className="mb-8 space-y-6">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">门禁 2 · 内容审核</h2>

          {idea.title_suggestions && idea.title_suggestions.length > 0 && (
            <div className="p-5 bg-white border border-gray-200 rounded-lg">
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">标题建议</h3>
              <div className="flex flex-wrap gap-2">
                {idea.title_suggestions.map((t, i) => (
                  <span key={i} className="text-sm px-3 py-1 bg-gray-50 rounded-full">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* GZH */}
          {editGzh && (
            <div className="p-5 bg-white border border-gray-200 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-medium">公众号长文</h3>
                {!isPublished && (
                  <button
                    onClick={async () => {
                      await rejectReview(idea.id, "gzh");
                      load();
                    }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    重做
                  </button>
                )}
              </div>
              <textarea
                value={editGzh}
                onChange={(e) => setEditGzh(e.target.value)}
                className="w-full min-h-[200px] text-sm p-3 border border-gray-200 rounded resize-y focus:outline-none focus:border-gray-400"
              />
            </div>
          )}

          {/* XHS */}
          {editXhs && (
            <div className="p-5 bg-white border border-gray-200 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-medium">小红书短文</h3>
                {!isPublished && (
                  <button
                    onClick={async () => { await rejectReview(idea.id, "xhs"); load(); }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    重做
                  </button>
                )}
              </div>
              <textarea
                value={editXhs}
                onChange={(e) => setEditXhs(e.target.value)}
                className="w-full min-h-[120px] text-sm p-3 border border-gray-200 rounded resize-y focus:outline-none focus:border-gray-400"
              />
            </div>
          )}

          {/* Video */}
          {editVideo && (
            <div className="p-5 bg-white border border-gray-200 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-medium">视频脚本</h3>
                {!isPublished && (
                  <button
                    onClick={async () => { await rejectReview(idea.id, "video"); load(); }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    重做
                  </button>
                )}
              </div>
              <textarea
                value={editVideo}
                onChange={(e) => setEditVideo(e.target.value)}
                className="w-full min-h-[120px] text-sm p-3 border border-gray-200 rounded resize-y focus:outline-none focus:border-gray-400 font-mono"
              />
            </div>
          )}

          {/* Actions */}
          {!isPublished && (
            <div className="flex gap-3">
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
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition"
              >
                审核通过 ✓
              </button>
            </div>
          )}
        </section>
      )}

      {/* Publish */}
      {(isCompleted || isPublished) && !isPublished && (
        <section className="mb-8 p-5 bg-white border border-gray-200 rounded-lg">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">发布</h2>
          <button
            onClick={async () => { await markPublished(idea.id); load(); }}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
          >
            标记为已发布
          </button>
        </section>
      )}

      {isPublished && (
        <section className="mb-8 p-5 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">✓ 已发布</p>
        </section>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
      )}
    </div>
  );
}
