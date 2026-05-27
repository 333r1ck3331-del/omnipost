import { useMemo } from "react";

const AI_PHRASES = [
  "首先", "其次", "再次", "最后", "总而言之", "综上所述",
  "在当今社会", "在这个", "随着...的发展", "不仅...而且",
  "让我们", "值得注意的是", "毋庸置疑", "众所周知",
];

const PLATFORM_LIMITS: Record<string, { soft: number; hard: number; hint: string }> = {
  gzh:      { soft: 2500, hard: 5000, hint: "公众号正文建议 1500–2500 字" },
  xhs:      { soft: 400,  hard: 800,  hint: "小红书正文 ≤400 字，最佳 250–400" },
  video:    { soft: 600,  hard: 1200, hint: "60–90s 短视频脚本约 200 字 / 分钟" },
  bilibili: { soft: 3000, hard: 8000, hint: "B 站中视频脚本建议 2000–4000 字" },
};

type Props = {
  platform: "gzh" | "xhs" | "video" | "bilibili";
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  minHeight?: number;
};

export default function ContentEditor({ platform, value, onChange, readOnly, minHeight }: Props) {
  const limit = PLATFORM_LIMITS[platform];
  const count = value.length;
  const overSoft = count > limit.soft;
  const overHard = count > limit.hard;
  const ratio = Math.min(100, (count / limit.soft) * 100);

  const aiHits = useMemo(() => {
    const hits: { phrase: string; count: number }[] = [];
    for (const p of AI_PHRASES) {
      const m = value.match(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g"));
      if (m) hits.push({ phrase: p, count: m.length });
    }
    return hits;
  }, [value]);

  const highlighted = useMemo(() => {
    if (!aiHits.length) return value;
    const escaped = AI_PHRASES.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`(${escaped.join("|")})`, "g");
    const parts = value.split(re);
    return parts.map((seg) =>
      AI_PHRASES.includes(seg)
        ? `<mark class="bg-warn-50 text-warn-700 px-1 rounded">${seg}</mark>`
        : seg
    ).join("");
  }, [value, aiHits]);

  return (
    <div className="border border-paper-300 rounded-lg overflow-hidden bg-paper-50">
      <div className="flex items-center justify-between px-4 py-2 border-b border-paper-300 text-xs bg-paper-100/50">
        <span className="text-ink-500">{limit.hint}</span>
        <span className={`font-mono ${overHard ? "text-danger-700 font-semibold" : overSoft ? "text-warn-700" : "text-ink-500"}`}>
          {count}
          <span className="text-ink-400"> / {limit.soft}</span>
          {overHard && " · 超限"}
        </span>
      </div>

      {/* 字数进度条 */}
      <div className="h-[2px] bg-paper-200">
        <div
          className={`h-full transition-all ${
            overHard ? "bg-danger-500" : overSoft ? "bg-warn-500" : "bg-accent-500/60"
          }`}
          style={{ width: `${ratio}%` }}
        />
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className="w-full p-4 text-sm leading-[1.85] bg-transparent resize-y
                   focus:outline-none text-ink-900 placeholder:text-ink-400"
        style={{
          minHeight: minHeight ?? (platform === "gzh" || platform === "bilibili" ? 320 : 160),
          fontFamily: '"Noto Serif SC", "Songti SC", Georgia, serif',
        }}
        placeholder={`${PLATFORM_LIMITS[platform].hint}…`}
      />

      {aiHits.length > 0 && (
        <div className="px-4 py-3 border-t border-paper-300 bg-warn-50/50">
          <div className="text-xs text-warn-700 font-medium mb-2">
            ⚠ 检测到 {aiHits.reduce((s, h) => s + h.count, 0)} 处 AI 套话
          </div>
          <div className="flex flex-wrap gap-1.5">
            {aiHits.map(h => (
              <span key={h.phrase} className="text-[11px] px-2 py-0.5 bg-warn-50 border border-warn-500/30 text-warn-700 rounded">
                {h.phrase} <span className="text-warn-700/70">×{h.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <details className="border-t border-paper-300">
        <summary className="px-4 py-2 text-xs text-ink-500 hover:text-ink-900 transition">
          预览（标记 AI 痕迹）
        </summary>
        <div
          className="px-4 py-4 text-sm leading-[1.85] whitespace-pre-wrap prose-warm fade-in"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </details>
    </div>
  );
}
