import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getIdea, approveGate1, rejectGate1, produceContent,
  editReview, approveReview, rejectReview, markPublished, optimizeTitles, generateTTS,
  saveBrief,
} from "../api";
import type { Idea } from "../api";
import { CONTENT_TYPES, TYPE_LABELS, STATUS_LABELS } from "../constants";
import ContentEditor from "../components/ContentEditor";
import WarningBanner from "../components/WarningBanner";

export default function IdeaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["gzh"]);
  const [editGzh, setEditGzh] = useState("");
  const [editXhs, setEditXhs] = useState("");
  const [editVideo, setEditVideo] = useState("");
  const [editBilibili, setEditBilibili] = useState("");
  const [optTitles, setOptTitles] = useState<string[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [ttsUrl, setTtsUrl] = useState("");
  const [ttsGenerating, setTtsGenerating] = useState(false);
  const [brief, setBrief] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getIdea(id);
      setIdea(data);
      setEditGzh(data.content_gzh || "");
      setEditXhs(data.content_xhs || "");
      setEditVideo(data.content_video_script || "");
      setEditBilibili(data.content_bilibili || "");
      if (data.selected_types && data.selected_types.length > 0) {
        setSelectedTypes(data.selected_types);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const runAction = useCallback(async (fn: () => Promise<any>) => {
    setError("");
    try { await fn(); await load(); }
    catch (e: any) {
      const msg = e?.message || "操作失败";
      setError(msg);
      setTimeout(() => setError(prev => prev === msg ? "" : prev), 5000);
      await load();
    }
  }, [load]);

  useEffect(() => {
    setOptTitles([]);
    setTtsUrl("");
    setBrief("");
    setError("");
    load();
  }, [load]);

  // Auto-poll: exponential backoff + pause when tab hidden
  const [pollSeconds, setPollSeconds] = useState(0);
  const pollRef = useRef<any>(null);
  useEffect(() => {
    if (idea?.status !== "in_production") { setPollSeconds(0); return; }
    let delay = 3000;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (document.hidden) { pollRef.current = setTimeout(tick, 5000); return; }
      try {
        await load();
        setPollSeconds(s => s + delay / 1000);
        delay = Math.min(delay * 1.2, 15000);
      } catch {
        delay = Math.min(delay * 2, 30000);
      }
      if (!cancelled) pollRef.current = setTimeout(tick, delay);
    };
    pollRef.current = setTimeout(tick, delay);
    return () => { cancelled = true; clearTimeout(pollRef.current); };
  }, [idea?.status, load]);

  if (loading) return <p className="text-gray-300 text-sm">加载中...</p>;
  if (!idea) return <p className="text-red-500 text-sm">{error || "未找到"}</p>;

  const isGate1Ready = idea.status === "pending_review";
  const isApproved = idea.status === "approved";
  const isProducing = idea.status === "in_production";
  const isProductionFailed = idea.status === "production_failed";
  const isReviewing = idea.status === "review";
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

      <WarningBanner idea={idea} />

      {/* Title */}
      <h1 className="text-xl font-medium leading-relaxed mb-3 text-[#2c2c2c]">
        {idea.idea_text}
      </h1>
      <div className="flex gap-3 text-xs text-gray-400 mb-16">
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
              {idea.gate1_score < 0 ? (
                <span className="text-lg text-red-400">评估失败</span>
              ) : (
                <>
                  <span className="text-4xl font-light text-[#2c2c2c]">{idea.gate1_score}</span>
                  <span className="text-sm text-gray-400">/ 100</span>
                </>
              )}
            </div>
            {idea.gate1_result.verdict && (
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                {idea.gate1_result.verdict}
              </p>
            )}
            {idea.gate1_result.dimensions && (
              <div className="mt-6 space-y-4">
                <h3 className="text-xs text-gray-400 tracking-wider mb-3">逐项评估</h3>
                {Object.entries(idea.gate1_result.dimensions as Record<string, {score:number;plus:string[];minus:string[]}>).map(([key, dim]) => {
                  if (!dim || typeof dim.score !== "number") return null;
                  const labels: Record<string,string> = {
                    originality: "原创性", audience_appeal: "受众吸引力",
                    content_richness: "内容厚度", timeliness: "时效性", feasibility: "执行可行性",
                  };
                  const color = dim.score >= 76 ? "text-green-600" : dim.score >= 61 ? "text-gray-700" : dim.score >= 41 ? "text-yellow-600" : "text-red-500";
                  return (
                    <div key={key} className="border-b border-gray-50 pb-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium">{labels[key] || key}</span>
                        <span className={`text-sm font-mono ${color}`}>{dim.score}</span>
                      </div>
                      {dim.plus?.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {dim.plus.map((p, i) => <li key={i} className="text-xs text-green-600 pl-3">+ {p}</li>)}
                        </ul>
                      )}
                      {dim.minus?.length > 0 && (
                        <ul className="mt-0.5 space-y-0.5">
                          {dim.minus.map((m, i) => <li key={i} className="text-xs text-red-400 pl-3">− {m}</li>)}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {idea.gate1_result.competitive_analysis && (
              <div className="mt-5">
                <h3 className="text-xs text-gray-400 tracking-wider mb-1">竞品分析</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{idea.gate1_result.competitive_analysis}</p>
              </div>
            )}
            {idea.gate1_result.advice && (
              <div className="mt-4">
                <h3 className="text-xs text-gray-400 tracking-wider mb-1">改进建议</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{idea.gate1_result.advice}</p>
              </div>
            )}
            {idea.gate1_result.error && (
              <p className="text-sm text-red-500">{idea.gate1_result.error}</p>
            )}
            {isGate1Ready && (
              <div className="flex gap-6 mt-8">
                <button
                  onClick={() => runAction(() => approveGate1(idea.id))}
                  className="text-sm text-gray-800 hover:text-black transition"
                >
                  通过，开始生产 →
                </button>
                <button
                  onClick={() => runAction(() => rejectGate1(idea.id))}
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

      {/* Content brief — mandatory step after Gate 1 approval */}
      {isApproved && (
        <section className="mb-16">
          <h2 className="text-xs text-gray-400 tracking-wider mb-6">
            内容要求
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            写清楚你想要的方向、角度、风格、篇幅要求、要避开的内容。AI 将根据你的要求生成内容。
          </p>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="例如：从社会心理学角度切入，引用1-2个真实案例，避免说教感，篇幅1500字左右，结尾要有留白..."
            className="w-full min-h-[120px] text-sm italic p-4 bg-white border border-gray-100 rounded resize-y focus:outline-none focus:border-gray-300 leading-relaxed placeholder-gray-300"
          />

          <h2 className="text-xs text-gray-400 tracking-wider mt-12 mb-6">
            内容类型
          </h2>
          <div className="flex flex-wrap gap-2 mb-8">
            {CONTENT_TYPES.map((t) => {
              const selected = selectedTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTypes((prev) =>
                    prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                  )}
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
            onClick={() => {
              if (!brief.trim() || selectedTypes.length === 0) return;
              runAction(async () => {
                await saveBrief(idea.id, brief.trim());
                await produceContent(idea.id, selectedTypes);
              });
            }}
            disabled={!brief.trim() || selectedTypes.length === 0}
            className={`text-sm transition ${
              !brief.trim() || selectedTypes.length === 0
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-800 hover:text-black"
            }`}
          >
            开始生成 →
          </button>
        </section>
      )}

      {/* Producing */}
      {isProducing && (
        <section className="mb-16">
          <p className="text-sm text-gray-400">AI 正在生成内容，请稍候...</p>
          <p className="text-xs text-gray-500 mt-1">
            已等待 {Math.round(pollSeconds)}s
            {pollSeconds > 60 && (
              <button onClick={load} className="ml-2 underline">手动刷新</button>
            )}
          </p>
        </section>
      )}

      {/* Production failed */}
      {isProductionFailed && (
        <section className="mb-16">
          <h2 className="text-xs text-gray-400 tracking-wider mb-4">生产失败</h2>
          <p className="text-sm text-gray-600 mb-6">内容生成中断或超时。请重试。</p>
          <button
            onClick={() => runAction(() => produceContent(idea.id, idea.selected_types || ["gzh"]))}
            className="text-sm px-4 py-2 bg-red-50 text-red-700 rounded hover:bg-red-100 transition"
          >
            重新生成 →
          </button>
        </section>
      )}

      {/* Review */}
      {(isReviewing || isCompleted || isPublished) && (
        <section className="mb-16 space-y-10">
          <h2 className="text-xs text-gray-400 tracking-wider">门禁 2 · 内容审核</h2>

          {idea.title_suggestions && idea.title_suggestions.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs text-gray-400">标题建议</h3>
                {isReviewing && (
                  <button
                    onClick={async () => {
                      setOptimizing(true);
                      setError("");
                      try {
                        const r = await optimizeTitles(idea.id);
                        setOptTitles(r.titles);
                      } catch (e: any) {
                        setError(e?.message || "优化失败");
                      } finally {
                        setOptimizing(false);
                      }
                    }}
                    disabled={optimizing}
                    className="text-xs text-gray-400 hover:text-gray-600 transition"
                  >
                    {optimizing ? "优化中..." : "优化标题"}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(optTitles.length > 0 ? optTitles : idea.title_suggestions).map((t, i) => (
                  <span key={i} className="text-xs px-3 py-1.5 bg-[#f5f1ea] text-gray-600 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {idea.content_gzh != null && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs text-gray-400">公众号长文</h3>
                {isReviewing && (
                  <button
                    onClick={() => runAction(() => rejectReview(idea.id, "gzh"))}
                    className="text-xs text-gray-400 hover:text-red-500 transition"
                  >
                    重做
                  </button>
                )}
              </div>
              <ContentEditor platform="gzh" value={editGzh} onChange={setEditGzh} />
            </div>
          )}

          {idea.content_xhs != null && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs text-gray-400">小红书短文</h3>
                {isReviewing && (
                  <button
                    onClick={() => runAction(() => rejectReview(idea.id, "xhs"))}
                    className="text-xs text-gray-400 hover:text-red-500 transition"
                  >
                    重做
                  </button>
                )}
              </div>
              <ContentEditor platform="xhs" value={editXhs} onChange={setEditXhs} />
            </div>
          )}

          {idea.content_video_script != null && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs text-gray-400">视频脚本</h3>
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      setTtsGenerating(true);
                      setError("");
                      try {
                        const r = await generateTTS(idea.id);
                        setTtsUrl(r.url);
                      } catch (e: any) {
                        setError(e?.message || "TTS 生成失败");
                      } finally {
                        setTtsGenerating(false);
                      }
                    }}
                    disabled={ttsGenerating}
                    className="text-xs text-gray-400 hover:text-gray-600 transition"
                  >
                    {ttsGenerating ? "生成中..." : ttsUrl ? "重新生成语音" : "生成语音"}
                  </button>
                  {isReviewing && (
                    <button
                      onClick={() => runAction(() => rejectReview(idea.id, "video"))}
                      className="text-xs text-gray-400 hover:text-red-500 transition"
                    >
                      重做
                    </button>
                  )}
                </div>
              </div>
              <ContentEditor platform="video" value={editVideo} onChange={setEditVideo} />
              {ttsUrl && (
                <audio controls className="mt-3 w-full" src={ttsUrl}>
                  您的浏览器不支持音频播放
                </audio>
              )}
            </div>
          )}

          {idea.content_bilibili != null && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs text-gray-400">B站视频</h3>
                {isReviewing && (
                  <button
                    onClick={() => runAction(() => rejectReview(idea.id, "bilibili"))}
                    className="text-xs text-gray-400 hover:text-red-500 transition"
                  >
                    重做
                  </button>
                )}
              </div>
              <ContentEditor platform="bilibili" value={editBilibili} onChange={setEditBilibili} />
            </div>
          )}

          {isReviewing && (
            <div>
              <button
                onClick={() => runAction(async () => {
                  await editReview(idea.id, {
                    content_gzh: editGzh || null,
                    content_xhs: editXhs || null,
                    content_video_script: editVideo || null,
                    content_bilibili: editBilibili || null,
                    version: idea.version,
                  });
                  await approveReview(idea.id);
                })}
                className="text-sm text-gray-800 hover:text-black transition"
              >
                审核通过 ✓
              </button>
            </div>
          )}
        </section>
      )}

      {/* Distribution Strategy — shows after review approval */}
      {isCompleted && idea.distribution_strategy && !idea.distribution_strategy.error && (
        <section className="mb-16">
          <h2 className="text-xs text-gray-400 tracking-wider mb-6">投放策略</h2>
          {(() => {
            const ds = idea.distribution_strategy;
            const p = ds.platforms || {};
            return (
              <div className="space-y-8">
                {/* Platform-specific */}
                {p.gongzhonghao && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">公众号</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>🕐 {p.gongzhonghao.best_publish_time}</p>
                      <p>📋 {p.gongzhonghao.publish_rhythm}</p>
                      {p.gongzhonghao.share_copy && <p>💬 转发文案：{p.gongzhonghao.share_copy}</p>}
                      {p.gongzhonghao.interaction_hook && <p>❓ {p.gongzhonghao.interaction_hook}</p>}
                    </div>
                  </div>
                )}
                {p.xiaohongshu && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">小红书</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>🕐 {p.xiaohongshu.best_publish_time}</p>
                      {p.xiaohongshu.cover && <p>🖼 封面：{p.xiaohongshu.cover.text}（{p.xiaohongshu.cover.style}）</p>}
                      {p.xiaohongshu.tags && <p>🏷 {p.xiaohongshu.tags.join(" · ")}</p>}
                      {p.xiaohongshu.interaction_hook && <p>❓ {p.xiaohongshu.interaction_hook}</p>}
                      {p.xiaohongshu.boost_advice && <p>📢 {p.xiaohongshu.boost_advice}</p>}
                    </div>
                  </div>
                )}
                {p.douyin && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">抖音</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>🕐 {p.douyin.best_publish_time}</p>
                      {p.douyin.music_style && <p>🎵 {p.douyin.music_style}</p>}
                      {p.douyin.tags && <p>🏷 {p.douyin.tags.join(" · ")}</p>}
                      {p.douyin.dou_plus && (
                        <p>💰 Dou+：{p.douyin.dou_plus.recommend ? "推荐" : "不推荐"} {p.douyin.dou_plus.budget ? `· ${p.douyin.dou_plus.budget}` : ""} · {p.douyin.dou_plus.reason}</p>
                      )}
                      {p.douyin.seed_comments?.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 mt-1">预埋评论：</p>
                          {p.douyin.seed_comments.map((c: string, i: number) => (
                            <p key={i} className="text-xs text-gray-500 pl-3">💬 {c}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* B站 distribution */}
                {p.bilibili && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">B站</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>📂 分区：{p.bilibili.partition}</p>
                      <p>🕐 {p.bilibili.best_publish_time}</p>
                      {p.bilibili.title_options && <p>📝 标题：{p.bilibili.title_options.join(" / ")}</p>}
                      {p.bilibili.cover && <p>🖼 封面：{p.bilibili.cover.text}（{p.bilibili.cover.style}）</p>}
                      {p.bilibili.tags && <p>🏷 {p.bilibili.tags.join(" · ")}</p>}
                      {p.bilibili.danmaku_hooks?.length > 0 && <p>💬 弹幕触发：{p.bilibili.danmaku_hooks.join(" / ")}</p>}
                      {p.bilibili.interaction_hook && <p>❓ {p.bilibili.interaction_hook}</p>}
                      {p.bilibili.sanchang_strategy && <p>🔔 {p.bilibili.sanchang_strategy}</p>}
                      {p.bilibili.boost && (
                        <p>💰 起飞：{p.bilibili.boost.recommend ? "推荐" : "不推荐"} {p.bilibili.boost.budget ? `· ${p.bilibili.boost.budget}` : ""} · {p.bilibili.boost.reason}</p>
                      )}
                      {p.bilibili.series_bridge && <p>🔗 {p.bilibili.series_bridge}</p>}
                    </div>
                  </div>
                )}

                {/* Audience layers */}
                {ds.audience_layers && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">受众分层</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      {ds.audience_layers.core && <p>🎯 核心：{ds.audience_layers.core}</p>}
                      {ds.audience_layers.extend && <p>📡 外延：{ds.audience_layers.extend}</p>}
                      {ds.audience_layers.avoid && <p>⚠️ 避开：{ds.audience_layers.avoid}</p>}
                    </div>
                  </div>
                )}

                {/* Risk */}
                {ds.risk_warning && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">风险预警</h3>
                    <p className="text-sm text-gray-600">{ds.risk_warning}</p>
                  </div>
                )}

                {/* Series potential */}
                {ds.series_potential && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">系列化潜力</h3>
                    <p className="text-sm text-gray-600">
                      {ds.series_potential.suitable ? "✅ 适合系列化" : "❌ 不适合系列化"}
                      {ds.series_potential.reason && ` · ${ds.series_potential.reason}`}
                    </p>
                    {ds.series_potential.follow_up_topics && ds.series_potential.follow_up_topics.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {ds.series_potential.follow_up_topics.map((t: string, i: number) => (
                          <li key={i} className="text-xs text-gray-500 pl-3">→ {t}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </section>
      )}

      {/* Publish */}
      {isCompleted && idea.distribution_strategy && !isPublished && (
        <section className="mb-16">
          <h2 className="text-xs text-gray-400 tracking-wider mb-6">发布</h2>
          <button
            onClick={() => runAction(() => markPublished(idea.id))}
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
        <div className="fixed bottom-6 right-6 bg-red-600 text-white text-xs px-4 py-3 rounded shadow-lg z-50 max-w-sm">
          {error}
          <button onClick={() => setError("")} className="ml-3 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}
    </div>
  );
}
