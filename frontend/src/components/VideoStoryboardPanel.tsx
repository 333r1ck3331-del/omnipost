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
  const cls =
    risk === "高" ? "border-danger-500/30 bg-danger-50/40 text-danger-700"
    : risk === "中" ? "border-warn-500/30 bg-warn-50/40 text-warn-700"
    : risk === "低" ? "border-success-500/30 bg-success-50/40 text-success-700"
    : "border-paper-300 bg-paper-100 text-ink-700";
  return (
    <div className={`border rounded-lg p-4 text-sm ${cls}`}>
      <div className="font-serif text-base mb-2">
        BGM 推荐{risk && <span className="ml-2 text-xs">· 版权风险 {risk}</span>}
      </div>
      {bgm.mood && <div className="text-xs mb-1 opacity-90">情绪 · {bgm.mood}</div>}
      {bgm.reference && <div className="text-xs mb-1 opacity-90">参考 · {bgm.reference}</div>}
      {bgm.copyright_note && <div className="text-xs opacity-80">{bgm.copyright_note}</div>}
    </div>
  );
}

function ShotTable({ shots, hasChapter }: { shots: Shot[]; hasChapter: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-paper-300">
      <table className="min-w-full text-xs">
        <thead className="bg-paper-200 text-ink-700">
          <tr>
            <th className="px-3 py-2 text-left font-medium">#</th>
            <th className="px-3 py-2 text-left font-medium whitespace-nowrap">时间</th>
            {hasChapter && <th className="px-3 py-2 text-left font-medium">章节</th>}
            <th className="px-3 py-2 text-left font-medium">景别</th>
            <th className="px-3 py-2 text-left font-medium">画面</th>
            <th className="px-3 py-2 text-left font-medium">口播</th>
            <th className="px-3 py-2 text-left font-medium">字幕</th>
            <th className="px-3 py-2 text-left font-medium">音效</th>
            <th className="px-3 py-2 text-left font-medium">转场</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-paper-300">
          {shots.map((s, i) => (
            <tr key={i} className="align-top hover:bg-paper-100/60 transition-colors">
              <td className="px-3 py-2 text-ink-400 font-mono">{s.shot_id ?? i + 1}</td>
              <td className="px-3 py-2 whitespace-nowrap font-mono text-ink-700">{s.timecode || ""}</td>
              {hasChapter && <td className="px-3 py-2 text-ink-700">{s.chapter || ""}</td>}
              <td className="px-3 py-2 text-ink-700">{s.shot_type || ""}</td>
              <td className="px-3 py-2 text-ink-900 leading-relaxed">{s.visual || ""}</td>
              <td className="px-3 py-2 text-ink-900 leading-relaxed">{s.voiceover || ""}</td>
              <td className="px-3 py-2 text-ink-700">{s.on_screen_text || ""}</td>
              <td className="px-3 py-2 text-ink-500">{s.sfx || ""}</td>
              <td className="px-3 py-2 text-ink-500">{s.transition || ""}</td>
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
      <p className="h-eyebrow mb-5">视频分镜</p>

      {storyboard.video && (
        <div className="mb-8">
          <div className="flex items-baseline gap-3 mb-3">
            <span className="font-serif text-base text-ink-900">抖音</span>
            {storyboard.video.total_seconds ? (
              <span className="pill">{storyboard.video.total_seconds}s</span>
            ) : null}
          </div>
          {storyboard.video.shots && <ShotTable shots={storyboard.video.shots} hasChapter={false} />}
          <div className="mt-4"><BGMBlock bgm={storyboard.video.bgm} /></div>
        </div>
      )}

      {storyboard.bilibili && (
        <div>
          <div className="flex items-baseline gap-3 mb-3">
            <span className="font-serif text-base text-ink-900">B 站</span>
            {storyboard.bilibili.total_minutes ? (
              <span className="pill">{storyboard.bilibili.total_minutes} 分钟</span>
            ) : null}
          </div>
          {storyboard.bilibili.shots && <ShotTable shots={storyboard.bilibili.shots} hasChapter />}
          <div className="mt-4"><BGMBlock bgm={storyboard.bilibili.bgm} /></div>
        </div>
      )}
    </section>
  );
}
