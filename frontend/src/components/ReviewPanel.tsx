import type { Idea } from "../api";
import {
  editReview, approveReview, rejectReview, optimizeTitles, generateTTS,
} from "../api";
import ContentEditor from "./ContentEditor";

interface Props {
  idea: Idea;
  isReviewing: boolean;
  isCompleted: boolean;
  isPublished: boolean;
  editGzh: string; setEditGzh: (v: string) => void;
  editXhs: string; setEditXhs: (v: string) => void;
  editVideo: string; setEditVideo: (v: string) => void;
  editBilibili: string; setEditBilibili: (v: string) => void;
  optTitles: string[]; setOptTitles: (v: string[]) => void;
  optimizing: boolean; setOptimizing: (v: boolean) => void;
  ttsUrl: string; setTtsUrl: (v: string) => void;
  ttsGenerating: boolean; setTtsGenerating: (v: boolean) => void;
  runAction: (fn: () => Promise<any>) => Promise<void>;
  setError: (msg: string) => void;
}

const PLATFORM_LABEL: Record<string, string> = {
  gzh: "公众号长文",
  xhs: "小红书短文",
  video: "视频脚本",
  bilibili: "B 站视频",
};

export default function ReviewPanel({
  idea, isReviewing, isCompleted, isPublished,
  editGzh, setEditGzh, editXhs, setEditXhs,
  editVideo, setEditVideo, editBilibili, setEditBilibili,
  optTitles, setOptTitles, optimizing, setOptimizing,
  ttsUrl, setTtsUrl, ttsGenerating, setTtsGenerating,
  runAction, setError,
}: Props) {
  if (!(isReviewing || isCompleted || isPublished)) return null;

  const handleOptimizeTitles = async () => {
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
  };

  const handleTTS = async () => {
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
  };

  const handleApprove = () =>
    runAction(async () => {
      await editReview(idea.id, {
        content_gzh: editGzh || null,
        content_xhs: editXhs || null,
        content_video_script: editVideo || null,
        content_bilibili: editBilibili || null,
        version: idea.version,
      });
      await approveReview(idea.id);
    });

  const renderBlock = (platform: "gzh" | "xhs" | "video" | "bilibili", value: string, setter: (v: string) => void, extra?: React.ReactNode) => (
    <div className="card-pad">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-serif text-base text-ink-900">{PLATFORM_LABEL[platform]}</h3>
        <div className="flex gap-3 items-center">
          {extra}
          {isReviewing && (
            <button
              onClick={() => runAction(() => rejectReview(idea.id, platform === "video" ? "video" : platform))}
              className="text-xs text-ink-400 hover:text-danger-700 transition"
            >
              重做
            </button>
          )}
        </div>
      </div>
      <ContentEditor platform={platform} value={value} onChange={setter} />
    </div>
  );

  return (
    <section className="mb-16">
      <p className="h-eyebrow mb-5">门禁 2 · 内容审核</p>

      <div className="space-y-6">
        {idea.title_suggestions && idea.title_suggestions.length > 0 && (
          <div className="card-pad">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-serif text-base text-ink-900">标题建议</h3>
              {isReviewing && (
                <button
                  onClick={handleOptimizeTitles}
                  disabled={optimizing}
                  className="text-xs text-accent-600 hover:text-accent-700 transition disabled:opacity-50"
                >
                  {optimizing ? "优化中…" : "✨ 让 AI 再优化"}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {(optTitles.length > 0 ? optTitles : idea.title_suggestions).map((t, i) => (
                <span key={i} className="pill-accent text-sm py-1 px-3">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {idea.content_gzh != null && renderBlock("gzh", editGzh, setEditGzh)}
        {idea.content_xhs != null && renderBlock("xhs", editXhs, setEditXhs)}
        {idea.content_video_script != null && renderBlock("video", editVideo, setEditVideo,
          <button
            onClick={handleTTS}
            disabled={ttsGenerating}
            className="text-xs text-accent-600 hover:text-accent-700 transition disabled:opacity-50"
          >
            {ttsGenerating ? "生成中…" : ttsUrl ? "重新生成语音" : "🎙 生成语音"}
          </button>
        )}
        {idea.content_video_script != null && ttsUrl && (
          <div className="card-pad py-3">
            <audio controls className="w-full" src={ttsUrl}>
              您的浏览器不支持音频播放
            </audio>
          </div>
        )}
        {idea.content_bilibili != null && renderBlock("bilibili", editBilibili, setEditBilibili)}

        {isReviewing && (
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleApprove}
              className="btn-primary"
            >
              ✓ 审核通过
            </button>
            <span className="text-xs text-ink-400 self-center">
              通过后将进入「已完成」状态
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
