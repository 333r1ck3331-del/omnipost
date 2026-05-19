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

  return (
    <section className="mb-16 space-y-10">
      <h2 className="text-xs text-gray-400 tracking-wider">门禁 2 · 内容审核</h2>

      {idea.title_suggestions && idea.title_suggestions.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs text-gray-400">标题建议</h3>
            {isReviewing && (
              <button
                onClick={handleOptimizeTitles}
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
                onClick={handleTTS}
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
            onClick={handleApprove}
            className="text-sm text-gray-800 hover:text-black transition"
          >
            审核通过 ✓
          </button>
        </div>
      )}
    </section>
  );
}
