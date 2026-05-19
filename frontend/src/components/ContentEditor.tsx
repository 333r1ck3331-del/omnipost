import { useMemo } from "react";

const AI_PHRASES = [
  "首先", "其次", "再次", "最后", "总而言之", "综上所述",
  "在当今社会", "在这个", "随着...的发展", "不仅...而且",
  "让我们", "值得注意的是", "毋庸置疑", "众所周知",
];

const PLATFORM_LIMITS: Record<string, { soft: number; hard: number; hint: string }> = {
  gzh:      { soft: 2500, hard: 5000, hint: "公众号正文建议 1500–2500 字" },
  xhs:      { soft: 400,  hard: 800,  hint: "小红书正文 ≤400 字，最佳 250–400" },
  video:    { soft: 600,  hard: 1200, hint: "60–90s 短视频脚本约 200 字/分钟" },
  bilibili: { soft: 3000, hard: 8000,  hint: "B站中视频脚本建议 2000–4000 字" },
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
        ? `<mark class="bg-yellow-100 text-yellow-900 px-0.5 rounded">${seg}</mark>`
        : seg
    ).join("");
  }, [value, aiHits]);

  return (
    <div className="border border-gray-200 rounded">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 text-xs">
        <span className="text-gray-500">{limit.hint}</span>
        <span className={overHard ? "text-red-500 font-medium" : overSoft ? "text-orange-500" : "text-gray-400"}>
          {count} / {limit.soft}
          {overHard && " · 超出硬限制"}
        </span>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className="w-full p-3 text-sm leading-relaxed bg-transparent resize-y focus:outline-none font-mono"
        style={{ minHeight: minHeight ?? (platform === "gzh" || platform === "bilibili" ? 280 : 140) }}
        placeholder={`${platform} 内容...`}
      />

      {aiHits.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 bg-yellow-50">
          <div className="text-xs text-yellow-800 font-medium mb-1">
            ⚠ 检测到 {aiHits.reduce((s, h) => s + h.count, 0)} 处 AI 套话
          </div>
          <div className="flex flex-wrap gap-1">
            {aiHits.map(h => (
              <span key={h.phrase} className="text-[11px] px-1.5 py-0.5 bg-yellow-100 text-yellow-900 rounded">
                {h.phrase} ×{h.count}
              </span>
            ))}
          </div>
        </div>
      )}

      <details className="border-t border-gray-100">
        <summary className="px-3 py-2 text-xs text-gray-500 cursor-pointer hover:text-gray-700">
          预览（标记 AI 痕迹）
        </summary>
        <div
          className="px-3 py-3 text-sm leading-relaxed whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </details>
    </div>
  );
}
