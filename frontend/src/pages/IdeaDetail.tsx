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

  const runAction = useCallback(async (fn: () => Promise<any>) => {
    setError("");
    try {
      await fn();
      await load();
    } catch (e: any) {
      const msg = e?.message || "操作失败";
      setError(msg);
      setTimeout(() => setError((prev) => (prev === msg ? "" : prev)), 5000);
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
      <button
        onClick={() => navigate("/")}
        className="text-xs text-gray-400 hover:text-gray-600 mb-10 transition"
      >
        ← 返回
      </button>

      <WarningBanner idea={idea} />

      <h1 className="text-xl font-medium leading-relaxed mb-3 text-[#2c2c2c]">
        {idea.idea_text}
      </h1>
      <div className="flex gap-3 text-xs text-gray-400 mb-16 items-center">
        <span>{new Date(idea.created_at).toLocaleString("zh-CN")}</span>
        <span>·</span>
        <span>{STATUS_LABELS[idea.status] || idea.status}</span>
        {idea.scene && (
          <>
            <span>·</span>
            <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
              场景：{SCENE_LABELS[idea.scene] || idea.scene}
            </span>
          </>
        )}
      </div>

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
          <button
            onClick={() => setError("")}
            className="ml-3 opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
