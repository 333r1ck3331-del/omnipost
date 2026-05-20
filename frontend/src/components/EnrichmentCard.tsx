import { useState } from "react";
import type { Idea } from "../api";

interface Props {
  idea: Idea;
}

/**
 * 素材增强清单 — 在审稿区上方，让作者一眼看 AI 用了什么资料。
 * 折叠式：默认只显示标题+条数，点开看完整列表（含来源 URL、抓取状态）。
 */
export default function EnrichmentCard({ idea }: Props) {
  const summary = idea.enrichment_summary;
  const [openKey, setOpenKey] = useState<string | null>(null);

  if (!summary || Object.keys(summary).length === 0) return null;

  const total = Object.values(summary).reduce((acc, v) => acc + (v?.count || 0), 0);

  return (
    <section className="mb-12 border border-gray-100 rounded p-5 bg-[#fcfaf6]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs text-gray-400 tracking-wider">
          素材增强清单 <span className="text-gray-300">· 共 {total} 条</span>
        </h2>
        <span className="text-xs text-gray-400">引用资料须自行核对真实性</span>
      </div>

      <div className="flex flex-col gap-2">
        {Object.entries(summary).map(([key, group]) => {
          if (!group || group.count === 0) return null;
          const isOpen = openKey === key;
          return (
            <div key={key} className="border-b border-gray-100 last:border-b-0 pb-2">
              <button
                onClick={() => setOpenKey(isOpen ? null : key)}
                className="w-full flex items-center justify-between text-left text-sm py-1 hover:text-black"
              >
                <span className="text-gray-700">
                  {group.label} <span className="text-gray-400 text-xs">· {group.count} 条</span>
                </span>
                <span className="text-gray-300 text-xs">{isOpen ? "收起" : "展开"}</span>
              </button>
              {isOpen && (
                <ul className="mt-2 mb-1 flex flex-col gap-1.5 text-xs">
                  {group.items.map((it, i) => (
                    <li key={i} className="leading-relaxed">
                      <a
                        href={it.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all"
                      >
                        {it.title || it.url}
                      </a>
                      <span className="ml-2 text-gray-400">
                        {it.fetched ? "✓ 已读全文" : "⚠ 仅摘要"}
                        {it.query ? ` · 反方词「${it.query}」` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
