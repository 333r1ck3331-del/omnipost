import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getIdea, markPublished } from "../api";
import type { Idea } from "../api";
import { STATUS_LABELS, SCENE_LABELS } from "../constants";
import WarningBanner from "../components/WarningBanner";
import ImagePlansPanel from "../components/ImagePlansPanel";
import VideoStoryboardPanel from "../components/VideoStoryboardPanel";
import Gate1Panel from "../components/Gate1Panel";
import ProductionPanel from "../components/ProductionPanel";
import ReviewPanel from "../components/ReviewPanel";
import EnrichmentCard from "../components/EnrichmentCard";
import ReferenceMaterial from "../components/ReferenceMaterial";
import DistributionPanel from "../components/DistributionPanel";

export default function IdeaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [idea, setIdea] = useState<Idea | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Production form state
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["gzh"]);
  const [brief, setBrief] = useState("");

  // Review form state
  const [editGzh, setEditGzh] = useState("");
  const [editXhs, setEditXhs] = useState("");
  const [editVideo, setEditVideo] = useState("");
  const [editBilibili, setEditBilibili] = useState("");
  const [optTitles, setOptTitles] = useState<string[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [ttsUrl, setTtsUrl] = useState("");
  const [ttsGenerating, setTtsGenerating] = useState(false);

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

  // 防重入：用户重复点击/race condition 直接吞掉（视觉 disabled 状态留给后续 UI 改造）
  const actionInFlight = useRef(false);
  const runAction = useCallback(async (fn: () => Promise<any>) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setError("");
    try {
      await fn();
      await load();
    } catch (e: any) {
      const msg = e?.message || "操作失败";
      setError(msg);
      setTimeout(() => setError((prev) => (prev === msg ? "" : prev)), 5000);
      await load();
    } finally {
      actionInFlight.current = false;
    }
  }, [load]);

  useEffect(() => {
    setOptTitles([]);
    setTtsUrl("");
    setBrief("");
    setError("");
    load();
  }, [load]);

  // Auto-poll while in_production: exponential backoff + pause when tab hidden
  const [pollSeconds, setPollSeconds] = useState(0);
  const pollRef = useRef<any>(null);
  useEffect(() => {
    if (idea?.status !== "in_production") {
      setPollSeconds(0);
      return;
    }
    let delay = 3000;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (document.hidden) {
        pollRef.current = setTimeout(tick, 5000);
        return;
      }
      try {
        await load();
        setPollSeconds((s) => s + delay / 1000);
        delay = Math.min(delay * 1.2, 15000);
      } catch {
        delay = Math.min(delay * 2, 30000);
      }
      if (!cancelled) pollRef.current = setTimeout(tick, delay);
    };
    pollRef.current = setTimeout(tick, delay);
    return () => {
      cancelled = true;
      clearTimeout(pollRef.current);
    };
  }, [idea?.status, load]);

  if (loading) return (
    <div className="space-y-4">
      <div className="skeleton h-4 w-24" />
      <div className="skeleton h-8 w-3/4" />
      <div className="skeleton h-32" />
      <div className="skeleton h-64" />
    </div>
  );
  if (!idea) return (
    <div className="card-pad text-center text-danger-700">
      <p className="font-serif text-lg">{error || "未找到"}</p>
      <button onClick={() => navigate("/")} className="btn-secondary mt-4 text-xs">
        ← 返回首页
      </button>
    </div>
  );

  const isGate1Ready = idea.status === "pending_review";
  const isApproved = idea.status === "approved";
  const isProducing = idea.status === "in_production";
  const isProductionFailed = idea.status === "production_failed";
  const isReviewing = idea.status === "review";
  const isCompleted = idea.status === "completed";
  const isPublished = idea.status === "published";

  return (
    <div>
      <button
        onClick={() => navigate("/")}
        className="btn-ghost text-xs mb-8 -ml-3"
      >
        ← 返回
      </button>

      <WarningBanner idea={idea} />

      {/* 头部 - 大标题 */}
      <header className="mb-12">
        <p className="h-eyebrow mb-3">
          {STATUS_LABELS[idea.status] || idea.status}
        </p>
        <h1 className="font-serif text-2xl text-ink-900 leading-relaxed mb-4">
          {idea.idea_text}
        </h1>
        {idea.reference_text && idea.reference_text.trim() && (
          <ReferenceMaterial text={idea.reference_text} />
        )}
        <div className="flex flex-wrap gap-3 text-xs text-ink-400 items-center">
          <span>{new Date(idea.created_at).toLocaleString("zh-CN")}</span>
          {idea.scene && (
            <>
              <span>·</span>
              <span className="pill">
                {SCENE_LABELS[idea.scene] || idea.scene}
              </span>
            </>
          )}
        </div>
      </header>

      <Gate1Panel idea={idea} isGate1Ready={isGate1Ready} runAction={runAction} />

      <ProductionPanel
        idea={idea}
        isApproved={isApproved}
        isProducing={isProducing}
        isProductionFailed={isProductionFailed}
        brief={brief}
        setBrief={setBrief}
        selectedTypes={selectedTypes}
        setSelectedTypes={setSelectedTypes}
        pollSeconds={pollSeconds}
        runAction={runAction}
        load={load}
      />

      <EnrichmentCard idea={idea} />

      <ReviewPanel
        idea={idea}
        isReviewing={isReviewing}
        isCompleted={isCompleted}
        isPublished={isPublished}
        editGzh={editGzh} setEditGzh={setEditGzh}
        editXhs={editXhs} setEditXhs={setEditXhs}
        editVideo={editVideo} setEditVideo={setEditVideo}
        editBilibili={editBilibili} setEditBilibili={setEditBilibili}
        optTitles={optTitles} setOptTitles={setOptTitles}
        optimizing={optimizing} setOptimizing={setOptimizing}
        ttsUrl={ttsUrl} setTtsUrl={setTtsUrl}
        ttsGenerating={ttsGenerating} setTtsGenerating={setTtsGenerating}
        runAction={runAction}
        setError={setError}
      />

      {(idea.status === "review" || idea.status === "completed") && (
        <>
          <ImagePlansPanel imagePlans={idea.image_plans} />
          <VideoStoryboardPanel storyboard={idea.video_storyboard} />
        </>
      )}

      {isCompleted && <DistributionPanel idea={idea} />}

      {isCompleted && idea.distribution_strategy && !isPublished && (
        <section className="mb-16">
          <p className="h-eyebrow mb-5">发布</p>
          <div className="card-pad flex items-center justify-between">
            <div>
              <p className="font-serif text-base text-ink-900 mb-1">内容已就绪</p>
              <p className="text-xs text-ink-500">确认无误后标记为已发布</p>
            </div>
            <button
              onClick={() => runAction(() => markPublished(idea.id))}
              className="btn-primary"
            >
              ✓ 标记已发布
            </button>
          </div>
        </section>
      )}

      {isPublished && (
        <section className="mb-16">
          <div className="card-pad text-center py-10 bg-success-50/40 border-success-500/30">
            <p className="font-serif text-2xl text-success-700 mb-1">✓ 已发布</p>
            <p className="text-xs text-ink-500">这篇内容已经走完全程</p>
          </div>
        </section>
      )}

      {error && (
        <div
          role="alert"
          className="fixed bottom-6 right-6 bg-paper-50 border border-danger-500/30
                     shadow-lift rounded-lg px-4 py-3 z-50 max-w-sm fade-in
                     flex items-start gap-3"
        >
          <span className="text-danger-500 font-serif text-lg leading-none mt-0.5">⚠</span>
          <p className="text-sm text-ink-900 flex-1">{error}</p>
          <button
            onClick={() => setError("")}
            className="text-ink-400 hover:text-ink-900 transition text-sm"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
