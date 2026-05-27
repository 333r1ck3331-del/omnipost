import { useState } from "react";

interface ImagePlan {
  concept?: string;
  composition?: string;
  style?: string;
  midjourney_prompt?: string;
  dalle_prompt?: string;
  position?: string;
  index?: number;
  role?: string;
}

interface PlatformPlan {
  cover?: ImagePlan;
  inline_images?: ImagePlan[];
  carousel?: ImagePlan[];
}

interface Props {
  imagePlans: { gzh?: PlatformPlan; xhs?: PlatformPlan } | null | undefined;
}

function copyText(text: string, onDone?: () => void) {
  navigator.clipboard.writeText(text).then(() => onDone?.()).catch(() => {});
}

function ImageCard({ plan, label }: { plan: ImagePlan; label: string }) {
  const [tab, setTab] = useState<"mj" | "dalle">("mj");
  const [copied, setCopied] = useState(false);
  const prompt = tab === "mj" ? plan.midjourney_prompt : plan.dalle_prompt;

  const handleCopy = () => {
    if (!prompt) return;
    copyText(prompt, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="card-pad">
      <div className="flex items-center justify-between mb-3">
        <div className="font-serif text-sm text-ink-900">{label}</div>
        {plan.position && <div className="pill text-[10px]">{plan.position}</div>}
      </div>
      {plan.concept && <div className="text-sm text-ink-900 mb-2 leading-relaxed">{plan.concept}</div>}
      {(plan.composition || plan.style) && (
        <div className="text-xs text-ink-500 space-y-0.5 mb-3">
          {plan.composition && <div>构图 · {plan.composition}</div>}
          {plan.style && <div>风格 · {plan.style}</div>}
        </div>
      )}
      <div className="flex gap-1 mb-2 border-b border-paper-300">
        <button
          onClick={() => setTab("mj")}
          className={`text-xs px-3 py-1.5 transition border-b-2 -mb-px ${
            tab === "mj"
              ? "border-accent-500 text-accent-700"
              : "border-transparent text-ink-500 hover:text-ink-900"
          }`}
        >Midjourney</button>
        <button
          onClick={() => setTab("dalle")}
          className={`text-xs px-3 py-1.5 transition border-b-2 -mb-px ${
            tab === "dalle"
              ? "border-accent-500 text-accent-700"
              : "border-transparent text-ink-500 hover:text-ink-900"
          }`}
        >DALL·E</button>
        {prompt && (
          <button
            onClick={handleCopy}
            className="ml-auto text-xs text-accent-600 hover:text-accent-700 transition px-2"
          >
            {copied ? "✓ 已复制" : "复制 prompt"}
          </button>
        )}
      </div>
      <pre className="text-xs bg-paper-100 p-3 rounded whitespace-pre-wrap break-words text-ink-700 font-mono leading-relaxed">
        {prompt || "（未生成）"}
      </pre>
    </div>
  );
}

export default function ImagePlansPanel({ imagePlans }: Props) {
  if (!imagePlans || (!imagePlans.gzh && !imagePlans.xhs)) return null;

  return (
    <section className="mb-12">
      <p className="h-eyebrow mb-5">配图方案</p>

      {imagePlans.gzh && (
        <div className="mb-8">
          <div className="font-serif text-base text-ink-900 mb-3">公众号</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {imagePlans.gzh.cover && <ImageCard plan={imagePlans.gzh.cover} label="封面" />}
            {imagePlans.gzh.inline_images?.map((img, i) => (
              <ImageCard key={i} plan={img} label={`正文配图 ${i + 1}`} />
            ))}
          </div>
        </div>
      )}

      {imagePlans.xhs && (
        <div>
          <div className="font-serif text-base text-ink-900 mb-3">小红书</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {imagePlans.xhs.cover && <ImageCard plan={imagePlans.xhs.cover} label="封面" />}
            {imagePlans.xhs.carousel?.map((img, i) => (
              <ImageCard
                key={i}
                plan={img}
                label={`轮播图 ${img.index ?? i + 1}${img.role ? ` · ${img.role}` : ""}`}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
