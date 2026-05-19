import type { Idea } from "../api";

interface Props {
  idea: Idea;
}

export default function DistributionPanel({ idea }: Props) {
  const ds = idea.distribution_strategy;
  if (!ds || ds.error) return null;
  const p = ds.platforms || {};

  return (
    <section className="mb-16">
      <h2 className="text-xs text-gray-400 tracking-wider mb-6">投放策略</h2>
      <div className="space-y-8">
        {p.gongzhonghao && (
          <div>
            <h3 className="text-sm font-medium mb-2">公众号</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>🕐 {p.gongzhonghao.best_publish_time}</p>
              <p>📋 {p.gongzhonghao.publish_rhythm}</p>
              {p.gongzhonghao.share_copy && <p>💬 转发文案：{p.gongzhonghao.share_copy}</p>}
              {p.gongzhonghao.interaction_hook && <p>❓ {p.gongzhonghao.interaction_hook}</p>}
            </div>
          </div>
        )}
        {p.xiaohongshu && (
          <div>
            <h3 className="text-sm font-medium mb-2">小红书</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>🕐 {p.xiaohongshu.best_publish_time}</p>
              {p.xiaohongshu.cover && (
                <p>🖼 封面：{p.xiaohongshu.cover.text}（{p.xiaohongshu.cover.style}）</p>
              )}
              {p.xiaohongshu.tags && <p>🏷 {p.xiaohongshu.tags.join(" · ")}</p>}
              {p.xiaohongshu.interaction_hook && <p>❓ {p.xiaohongshu.interaction_hook}</p>}
              {p.xiaohongshu.boost_advice && <p>📢 {p.xiaohongshu.boost_advice}</p>}
            </div>
          </div>
        )}
        {p.douyin && (
          <div>
            <h3 className="text-sm font-medium mb-2">抖音</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>🕐 {p.douyin.best_publish_time}</p>
              {p.douyin.music_style && <p>🎵 {p.douyin.music_style}</p>}
              {p.douyin.tags && <p>🏷 {p.douyin.tags.join(" · ")}</p>}
              {p.douyin.dou_plus && (
                <p>
                  💰 Dou+：{p.douyin.dou_plus.recommend ? "推荐" : "不推荐"}{" "}
                  {p.douyin.dou_plus.budget ? `· ${p.douyin.dou_plus.budget}` : ""}
                  {" · "}{p.douyin.dou_plus.reason}
                </p>
              )}
              {p.douyin.seed_comments?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mt-1">预埋评论：</p>
                  {p.douyin.seed_comments.map((c: string, i: number) => (
                    <p key={i} className="text-xs text-gray-500 pl-3">💬 {c}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {p.bilibili && (
          <div>
            <h3 className="text-sm font-medium mb-2">B站</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>📂 分区：{p.bilibili.partition}</p>
              <p>🕐 {p.bilibili.best_publish_time}</p>
              {p.bilibili.title_options && (
                <p>📝 标题：{p.bilibili.title_options.join(" / ")}</p>
              )}
              {p.bilibili.cover && (
                <p>🖼 封面：{p.bilibili.cover.text}（{p.bilibili.cover.style}）</p>
              )}
              {p.bilibili.tags && <p>🏷 {p.bilibili.tags.join(" · ")}</p>}
              {p.bilibili.danmaku_hooks?.length > 0 && (
                <p>💬 弹幕触发：{p.bilibili.danmaku_hooks.join(" / ")}</p>
              )}
              {p.bilibili.interaction_hook && <p>❓ {p.bilibili.interaction_hook}</p>}
              {p.bilibili.sanchang_strategy && <p>🔔 {p.bilibili.sanchang_strategy}</p>}
              {p.bilibili.boost && (
                <p>
                  💰 起飞：{p.bilibili.boost.recommend ? "推荐" : "不推荐"}{" "}
                  {p.bilibili.boost.budget ? `· ${p.bilibili.boost.budget}` : ""}
                  {" · "}{p.bilibili.boost.reason}
                </p>
              )}
              {p.bilibili.series_bridge && <p>🔗 {p.bilibili.series_bridge}</p>}
            </div>
          </div>
        )}
        {ds.audience_layers && (
          <div>
            <h3 className="text-sm font-medium mb-2">受众分层</h3>
            <div className="text-sm text-gray-600 space-y-1">
              {ds.audience_layers.core && <p>🎯 核心：{ds.audience_layers.core}</p>}
              {ds.audience_layers.extend && <p>📡 外延：{ds.audience_layers.extend}</p>}
              {ds.audience_layers.avoid && <p>⚠️ 避开：{ds.audience_layers.avoid}</p>}
            </div>
          </div>
        )}
        {ds.risk_warning && (
          <div>
            <h3 className="text-sm font-medium mb-2">风险预警</h3>
            <p className="text-sm text-gray-600">{ds.risk_warning}</p>
          </div>
        )}
        {ds.series_potential && (
          <div>
            <h3 className="text-sm font-medium mb-2">系列化潜力</h3>
            <p className="text-sm text-gray-600">
              {ds.series_potential.suitable ? "✅ 适合系列化" : "❌ 不适合系列化"}
              {ds.series_potential.reason && ` · ${ds.series_potential.reason}`}
            </p>
            {ds.series_potential.follow_up_topics?.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {ds.series_potential.follow_up_topics.map((t: string, i: number) => (
                  <li key={i} className="text-xs text-gray-500 pl-3">→ {t}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
