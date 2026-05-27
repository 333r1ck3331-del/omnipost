import { useState } from "react";
import type { Idea } from "../api";

interface Props {
  idea: Idea;
}

/**
 * 素材增强清单 — 在审稿区上方，让作者一眼看 AI 用了什么资料。
 */
export default function EnrichmentCard({ idea }: Props) {
  const summary = idea.enrichment_summary;
  const [openKey, setOpenKey] = useState<string | null>(null);

  if (!summary || Object.keys(summary).length === 0) return null;
  const total = Object.values(summary).reduce((acc, v) => acc + (v?.count || 0), 0);

  return (
    <section className="mb-12">
      <p className="h-eyebrow mb-4">素材引用 · 共 {total} 条</p>
      <div className="card-pad">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-paper-300">
          <p className="text-xs text-ink-500">
            AI 在生成内容时引用了以下资料
          </p>
          <span className="text-xs text-warn-700">
            ⚠ 请核对真实性
          </span>
        </div>

        <div className="space-y-2">
          {Object.entries(summary).map(([key, group]) => {
            if (!group || group.count === 0) return null;
            const isOpen = openKey === key;
            return (
              <div key={key}>
                <button
                  onClick={() => setOpenKey(isOpen ? null : key)}
                  className={`w-full flex items-center justify-between text-left
                              px-3 py-2 rounded transition
                              ${isOpen ? "bg-paper-200" : "hover:bg-paper-200/60"}`}
                >
                  <span className="text-sm text-ink-900">
                    {group.label}
                    <span className="ml-2 text-xs text-ink-500">· {group.count} 条</span>
                  </span>
                  <span className="text-xs text-accent-600">
                    {isOpen ? "收起 ▴" : "展开 ▾"}
                  </span>
                </button>
                {isOpen && (
                  <ul className="mt-2 mb-3 pl-3 space-y-2 fade-in">
                    {group.items.map((it, i) => (
                      <li key={i} className="text-xs leading-relaxed border-l-2 border-accent-500/30 pl-3">
                        <a
                          href={it.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-600 hover:text-accent-700 hover:underline break-all"
                        >
                          {it.title || it.url}
                        </a>
                        <span className="ml-2 text-ink-400">
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
      </div>
    </section>
  );
}
