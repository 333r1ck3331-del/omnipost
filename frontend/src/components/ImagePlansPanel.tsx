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

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function ImageCard({ plan, label }: { plan: ImagePlan; label: string }) {
  const [tab, setTab] = useState<"mj" | "dalle">("mj");
  const prompt = tab === "mj" ? plan.midjourney_prompt : plan.dalle_prompt;
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-gray-700">{label}</div>
        {plan.position && <div className="text-xs text-gray-400">{plan.position}</div>}
      </div>
      {plan.concept && <div className="text-sm text-gray-800 mb-1">{plan.concept}</div>}
      {plan.composition && <div className="text-xs text-gray-500 mb-1">构图：{plan.composition}</div>}
      {plan.style && <div className="text-xs text-gray-500 mb-3">风格：{plan.style}</div>}
      <div className="flex gap-1 mb-2">
        <button
          onClick={() => setTab("mj")}
          className={`text-xs px-2 py-0.5 rounded ${tab === "mj" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}
        >Midjourney</button>
        <button
          onClick={() => setTab("dalle")}
          className={`text-xs px-2 py-0.5 rounded ${tab === "dalle" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}
        >DALL-E</button>
        {prompt && (
          <button
            onClick={() => copyText(prompt)}
            className="ml-auto text-xs text-gray-500 hover:text-gray-900"
          >复制</button>
        )}
      </div>
      <pre className="text-xs bg-gray-50 p-2 rounded whitespace-pre-wrap break-words text-gray-700">
        {prompt || "（未生成）"}
      </pre>
    </div>
  );
}

export default function ImagePlansPanel({ imagePlans }: Props) {
  if (!imagePlans || (!imagePlans.gzh && !imagePlans.xhs)) return null;

  return (
    <section className="mb-12">
      <h2 className="text-xs text-gray-400 tracking-wider mb-4">配图方案</h2>

      {imagePlans.gzh && (
        <div className="mb-8">
          <div className="text-sm text-gray-700 mb-3">公众号</div>
          <div className="space-y-3">
            {imagePlans.gzh.cover && <ImageCard plan={imagePlans.gzh.cover} label="封面" />}
            {imagePlans.gzh.inline_images?.map((img, i) => (
              <ImageCard key={i} plan={img} label={`正文配图 ${i + 1}`} />
            ))}
          </div>
        </div>
      )}

      {imagePlans.xhs && (
        <div>
          <div className="text-sm text-gray-700 mb-3">小红书</div>
          <div className="space-y-3">
            {imagePlans.xhs.cover && <ImageCard plan={imagePlans.xhs.cover} label="封面" />}
            {imagePlans.xhs.carousel?.map((img, i) => (
              <ImageCard key={i} plan={img} label={`轮播图 ${img.index ?? i + 1}${img.role ? ` · ${img.role}` : ""}`} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
