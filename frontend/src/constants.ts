export const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  pending_review: "待审核",
  approved: "已通过",
  in_production: "生产中",
  review: "审核中",
  completed: "待发布",
  published: "已发布",
  rejected: "已驳回",
  production_failed: "生产失败",
};

export const CONTENT_TYPES = ["gzh", "xhs", "video", "bilibili"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const TYPE_LABELS: Record<string, string> = {
  gzh: "公众号",
  xhs: "小红书",
  video: "短视频脚本",
  bilibili: "B站视频",
};

export const SCENE_LABELS: Record<string, string> = {
  kepu: "科普解释",
  guandian: "观点输出",
  gushi: "故事叙事",
  qinggan: "情感共鸣",
  ganhuo: "干货清单",
  redian: "热点评论",
};
