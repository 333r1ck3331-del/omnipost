import { useState } from "react";

/** 详情页折叠展示用户提交时附带的参考资料长文。 */
export default function ReferenceMaterial({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const len = text.length;
  const preview = text.length > 100 ? text.slice(0, 100) + "…" : text;

  return (
    <div className="mb-4 border border-paper-300 rounded bg-paper-100">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 flex items-center gap-2 text-xs text-ink-600 hover:bg-paper-200 transition-colors"
      >
        <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        <span className="font-medium">📎 参考资料</span>
        <span className="text-ink-400">· {len.toLocaleString()} 字</span>
        {!open && <span className="text-ink-400 truncate ml-2 italic font-serif">{preview}</span>}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 fade-in">
          <pre className="whitespace-pre-wrap break-words text-sm text-ink-800 font-serif leading-relaxed max-h-[400px] overflow-y-auto">
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}
