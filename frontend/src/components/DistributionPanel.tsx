import type { Idea } from "../api";

interface Props {
  idea: Idea;
}

// 用语义化的小图标 SVG 替代 emoji
function Icon({ d, className = "" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 inline-block shrink-0 ${className}`} fill="currentColor">
      <path d={d} />
    </svg>
  );
}
const ICONS = {
  clock: "M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5A5.5 5.5 0 118 2.5a5.5 5.5 0 010 11zM7.25 4v4.31l3.16 1.83.75-1.3-2.66-1.54V4z",
  list: "M2 4h12v1.5H2zM2 7.25h12v1.5H2zM2 10.5h12V12H2z",
  cover: "M2 3h12v10H2zm1.5 1.5v7h9v-7zm1 5l2-2 2 2 3-3 0.5 0.5v3.5h-8z",
  tag: "M7.5 2L14 2v6.5L7.5 15L2 9.5zM10.5 5a1 1 0 100 2 1 1 0 000-2z",
  hash: "M5.5 2l-.5 3H3v1.5h1.75l-.25 3H3V11h1.5l-.5 3h1.5l.5-3h2.5l-.5 3h1.5l.5-3H13V9.5h-2.25l.25-3H13V5h-1.5l.5-3h-1.5l-.5 3h-2.5l.5-3z",
  comment: "M2 3h12v8H8.5L5.5 14v-3H2z",
  target: "M8 1a7 7 0 100 14A7 7 0 008 1zm0 2a5 5 0 110 10A5 5 0 018 3zm0 2a3 3 0 100 6 3 3 0 000-6zm0 2a1 1 0 110 2 1 1 0 010-2z",
  warning: "M8 1.5L15 14H1zm0 3l-4.5 8h9zM7.25 6.5h1.5v3h-1.5zm0 4h1.5V12h-1.5z",
  link: "M6 5h2v1.5H6c-.83 0-1.5.67-1.5 1.5S5.17 9.5 6 9.5h2V11H6a3 3 0 010-6zm4 0h2a3 3 0 010 6h-2V9.5h2c.83 0 1.5-.67 1.5-1.5S12.83 6.5 12 6.5h-2zm-2.5 2.25h3v1.5h-3z",
  music: "M11 2v7.13c-.32-.08-.65-.13-1-.13a3 3 0 100 6c1.66 0 3-1.34 3-3V4h2V2z",
  money: "M8 1a7 7 0 100 14A7 7 0 008 1zm.75 3v1.07a2 2 0 011.5 1.93h-1.5a.5.5 0 00-1 0v.5c0 .28.22.5.5.5h.5a2 2 0 010 4v1H7.25v-1.07a2 2 0 01-1.5-1.93h1.5a.5.5 0 001 0V8.5c0-.28-.22-.5-.5-.5h-.5a2 2 0 010-4z",
  arrow: "M3 8h8.5L8 4.5l1-1L14 8.5l-5 5-1-1L11.5 9H3z",
  bell: "M8 1.5c-1.66 0-3 1.34-3 3v2.5L3.5 9v1h9V9L11 7V4.5c0-1.66-1.34-3-3-3zm-1.5 10a1.5 1.5 0 003 0z",
  check: "M6 11.5L2.5 8l1-1L6 9.5 12.5 3l1 1z",
  x: "M3.5 3.5l9 9m-9 0l9-9",
};

function Row({ icon, children }: { icon: keyof typeof ICONS; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 text-sm text-ink-700">
      <Icon d={ICONS[icon]} className="text-accent-500 translate-y-[2px]" />
      <span className="flex-1">{children}</span>
    </div>
  );
}

function PlatformBlock({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="card-pad">
      <h3 className="font-serif text-base text-ink-900 mb-3 pb-2 border-b border-paper-300">
        {name}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export default function DistributionPanel({ idea }: Props) {
  const ds = idea.distribution_strategy;
  if (!ds || ds.error) return null;
  const p = ds.platforms || {};

  return (
    <section className="mb-16">
      <p className="h-eyebrow mb-5">投放策略</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {p.gongzhonghao && (
          <PlatformBlock name="公众号">
            <Row icon="clock">{p.gongzhonghao.best_publish_time}</Row>
            <Row icon="list">{p.gongzhonghao.publish_rhythm}</Row>
            {p.gongzhonghao.share_copy && <Row icon="comment">转发文案：{p.gongzhonghao.share_copy}</Row>}
            {p.gongzhonghao.interaction_hook && <Row icon="comment">{p.gongzhonghao.interaction_hook}</Row>}
          </PlatformBlock>
        )}
        {p.xiaohongshu && (
          <PlatformBlock name="小红书">
            <Row icon="clock">{p.xiaohongshu.best_publish_time}</Row>
            {p.xiaohongshu.cover && (
              <Row icon="cover">封面：{p.xiaohongshu.cover.text}（{p.xiaohongshu.cover.style}）</Row>
            )}
            {p.xiaohongshu.tags && <Row icon="hash">{p.xiaohongshu.tags.join(" · ")}</Row>}
            {p.xiaohongshu.interaction_hook && <Row icon="comment">{p.xiaohongshu.interaction_hook}</Row>}
            {p.xiaohongshu.boost_advice && <Row icon="money">{p.xiaohongshu.boost_advice}</Row>}
          </PlatformBlock>
        )}
        {p.douyin && (
          <PlatformBlock name="抖音">
            <Row icon="clock">{p.douyin.best_publish_time}</Row>
            {p.douyin.music_style && <Row icon="music">{p.douyin.music_style}</Row>}
            {p.douyin.tags && <Row icon="hash">{p.douyin.tags.join(" · ")}</Row>}
            {p.douyin.dou_plus && (
              <Row icon="money">
                Dou+: <span className={p.douyin.dou_plus.recommend ? "text-success-700" : "text-ink-500"}>
                  {p.douyin.dou_plus.recommend ? "推荐" : "不推荐"}
                </span>{" "}
                {p.douyin.dou_plus.budget ? `· ${p.douyin.dou_plus.budget}` : ""}
                {" · "}{p.douyin.dou_plus.reason}
              </Row>
            )}
            {p.douyin.seed_comments?.length > 0 && (
              <div className="pl-5 pt-1">
                <p className="text-xs text-ink-400 mb-1">预埋评论</p>
                {p.douyin.seed_comments.map((c: string, i: number) => (
                  <p key={i} className="text-xs text-ink-500 leading-relaxed">· {c}</p>
                ))}
              </div>
            )}
          </PlatformBlock>
        )}
        {p.bilibili && (
          <PlatformBlock name="B 站">
            <Row icon="list">分区：{p.bilibili.partition}</Row>
            <Row icon="clock">{p.bilibili.best_publish_time}</Row>
            {p.bilibili.title_options && <Row icon="comment">标题：{p.bilibili.title_options.join(" / ")}</Row>}
            {p.bilibili.cover && <Row icon="cover">封面：{p.bilibili.cover.text}（{p.bilibili.cover.style}）</Row>}
            {p.bilibili.tags && <Row icon="hash">{p.bilibili.tags.join(" · ")}</Row>}
            {p.bilibili.danmaku_hooks?.length > 0 && <Row icon="comment">弹幕触发：{p.bilibili.danmaku_hooks.join(" / ")}</Row>}
            {p.bilibili.interaction_hook && <Row icon="comment">{p.bilibili.interaction_hook}</Row>}
            {p.bilibili.sanchang_strategy && <Row icon="bell">{p.bilibili.sanchang_strategy}</Row>}
            {p.bilibili.boost && (
              <Row icon="money">
                起飞：<span className={p.bilibili.boost.recommend ? "text-success-700" : "text-ink-500"}>
                  {p.bilibili.boost.recommend ? "推荐" : "不推荐"}
                </span>{" "}
                {p.bilibili.boost.budget ? `· ${p.bilibili.boost.budget}` : ""}
                {" · "}{p.bilibili.boost.reason}
              </Row>
            )}
            {p.bilibili.series_bridge && <Row icon="link">{p.bilibili.series_bridge}</Row>}
          </PlatformBlock>
        )}
      </div>

      {(ds.audience_layers || ds.risk_warning || ds.series_potential) && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {ds.audience_layers && (
            <PlatformBlock name="受众分层">
              {ds.audience_layers.core && <Row icon="target">核心：{ds.audience_layers.core}</Row>}
              {ds.audience_layers.extend && <Row icon="arrow">外延：{ds.audience_layers.extend}</Row>}
              {ds.audience_layers.avoid && <Row icon="warning">避开：{ds.audience_layers.avoid}</Row>}
            </PlatformBlock>
          )}
          {ds.risk_warning && (
            <div className="card-pad border-warn-500/30 bg-warn-50/40">
              <h3 className="font-serif text-base text-warn-700 mb-2">风险预警</h3>
              <p className="text-sm text-ink-700 leading-relaxed">{ds.risk_warning}</p>
            </div>
          )}
          {ds.series_potential && (
            <PlatformBlock name="系列化潜力">
              <p className="text-sm text-ink-700">
                {ds.series_potential.suitable ? "✓ 适合系列化" : "✗ 不适合系列化"}
                {ds.series_potential.reason && ` · ${ds.series_potential.reason}`}
              </p>
              {ds.series_potential.follow_up_topics && ds.series_potential.follow_up_topics.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {ds.series_potential.follow_up_topics.map((t: string, i: number) => (
                    <li key={i} className="text-xs text-ink-500 pl-3">→ {t}</li>
                  ))}
                </ul>
              )}
            </PlatformBlock>
          )}
        </div>
      )}
    </section>
  );
}
