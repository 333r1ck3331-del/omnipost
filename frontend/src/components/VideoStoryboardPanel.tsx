interface Shot {
  shot_id?: number;
  chapter?: string;
  timecode?: string;
  shot_type?: string;
  visual?: string;
  voiceover?: string;
  on_screen_text?: string;
  sfx?: string;
  transition?: string;
}

interface BGM {
  mood?: string;
  reference?: string;
  copyright_note?: string;
}

interface PlatformBoard {
  shots?: Shot[];
  bgm?: BGM;
  total_seconds?: number;
  total_minutes?: number;
}

interface Props {
  storyboard: { video?: PlatformBoard; bilibili?: PlatformBoard } | null | undefined;
}

function BGMBlock({ bgm }: { bgm?: BGM }) {
  if (!bgm) return null;
  const risk = (bgm.copyright_note || "").match(/(高|中|低)/)?.[1];
  const riskColor =
    risk === "高" ? "bg-red-50 text-red-700 border-red-200"
    : risk === "中" ? "bg-yellow-50 text-yellow-700 border-yellow-200"
    : risk === "低" ? "bg-green-50 text-green-700 border-green-200"
    : "bg-gray-50 text-gray-700 border-gray-200";
  return (
    <div className={`border rounded p-3 text-sm ${riskColor}`}>
      <div className="font-medium mb-1">BGM 推荐{risk && ` · 版权风险：${risk}`}</div>
      {bgm.mood && <div className="text-xs mb-1">情绪：{bgm.mood}</div>}
      {bgm.reference && <div className="text-xs mb-1">参考：{bgm.reference}</div>}
      {bgm.copyright_note && <div className="text-xs opacity-80">{bgm.copyright_note}</div>}
    </div>
  );
}

function ShotTable({ shots, hasChapter }: { shots: Shot[]; hasChapter: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs border border-gray-200">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="border px-2 py-1 text-left">#</th>
            <th className="border px-2 py-1 text-left">时间</th>
            {hasChapter && <th className="border px-2 py-1 text-left">章节</th>}
            <th className="border px-2 py-1 text-left">景别</th>
            <th className="border px-2 py-1 text-left">画面</th>
            <th className="border px-2 py-1 text-left">口播</th>
            <th className="border px-2 py-1 text-left">字幕</th>
            <th className="border px-2 py-1 text-left">音效</th>
            <th className="border px-2 py-1 text-left">转场</th>
          </tr>
        </thead>
        <tbody>
          {shots.map((s, i) => (
            <tr key={i} className="align-top">
              <td className="border px-2 py-1 text-gray-500">{s.shot_id ?? i + 1}</td>
              <td className="border px-2 py-1 whitespace-nowrap">{s.timecode || ""}</td>
              {hasChapter && <td className="border px-2 py-1">{s.chapter || ""}</td>}
              <td className="border px-2 py-1">{s.shot_type || ""}</td>
              <td className="border px-2 py-1">{s.visual || ""}</td>
              <td className="border px-2 py-1">{s.voiceover || ""}</td>
              <td className="border px-2 py-1">{s.on_screen_text || ""}</td>
              <td className="border px-2 py-1">{s.sfx || ""}</td>
              <td className="border px-2 py-1">{s.transition || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function VideoStoryboardPanel({ storyboard }: Props) {
  if (!storyboard || (!storyboard.video && !storyboard.bilibili)) return null;

  return (
    <section className="mb-12">
      <h2 className="text-xs text-gray-400 tracking-wider mb-4">视频分镜</h2>

      {storyboard.video && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm text-gray-700">抖音</span>
            {storyboard.video.total_seconds ? (
              <span className="text-xs text-gray-400">总时长 {storyboard.video.total_seconds}s</span>
            ) : null}
          </div>
          {storyboard.video.shots && <ShotTable shots={storyboard.video.shots} hasChapter={false} />}
          <div className="mt-3"><BGMBlock bgm={storyboard.video.bgm} /></div>
        </div>
      )}

      {storyboard.bilibili && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm text-gray-700">B站</span>
            {storyboard.bilibili.total_minutes ? (
              <span className="text-xs text-gray-400">总时长 {storyboard.bilibili.total_minutes} 分钟</span>
            ) : null}
          </div>
          {storyboard.bilibili.shots && <ShotTable shots={storyboard.bilibili.shots} hasChapter />}
          <div className="mt-3"><BGMBlock bgm={storyboard.bilibili.bgm} /></div>
        </div>
      )}
    </section>
  );
}
