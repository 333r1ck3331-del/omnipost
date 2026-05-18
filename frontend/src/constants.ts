export const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  pending_review: "待审核",
  approved: "已通过",
  in_production: "生产中",
  completed: "待发布",
  review: "审核中",
  published: "已发布",
  rejected: "已驳回",
};

export const CONTENT_TYPES = ["gzh", "xhs", "video"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const TYPE_LABELS: Record<string, string> = {
  gzh: "公众号",
  xhs: "小红书",
  video: "视频脚本",
};
