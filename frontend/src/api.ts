const API = "/api";

export interface Idea {
  id: string;
  idea_text: string;
  scene: string | null;
  reference_text?: string | null;
  status: string;
  gate1_score: number | null;
  gate1_result: Gate1Result | null;
  gate1_passed: boolean;
  gate1_research: Gate1Research | null;
  selected_types: string[] | null;
  content_gzh: string | null;
  content_xhs: string | null;
  content_video_script: string | null;
  content_bilibili: string | null;
  title_suggestions: string[] | null;
  image_plans?: { gzh?: any; xhs?: any } | null;
  video_storyboard?: { video?: any; bilibili?: any } | null;
  final_content: Record<string, unknown> | null;
  review_log?: Record<string, { changed: boolean; issues: { quote: string; problem: string }[]; error?: string | null }> | null;
  enrichment_flags?: Record<string, boolean> | null;
  enrichment_summary?: Record<string, { label: string; count: number; items: { title: string; url: string; fetched: boolean; query?: string }[] }> | null;
  publish_url: string | null;
  notes: string | null;
  distribution_strategy: DistributionStrategy | null;
  style_id?: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface Gate1Dimension {
  score: number;
  plus?: string[];
  minus?: string[];
}
export interface Gate1Result {
  verdict?: string;
  dimensions?: Record<string, Gate1Dimension>;
  competitive_analysis?: string;
  advice?: string;
  error?: string;
}
export interface Gate1SearchHit {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
  [k: string]: any;
}
export interface Gate1Research {
  search_used?: boolean;
  search_results?: Gate1SearchHit[];
}
export interface DistributionStrategy {
  platforms?: Record<string, any>;
  audience_layers?: { core?: string; extend?: string; avoid?: string };
  risk_warning?: string;
  series_potential?: { suitable: boolean; reason?: string; follow_up_topics?: string[] };
  error?: string;
}

export interface IdeaSummary {
  id: string;
  idea_text: string;
  scene?: string | null;
  status: string;
  gate1_score: number | null;
  created_at: string;
}

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const text = await res.text();
  const ct = res.headers.get("content-type") || "";
  let data: any = null;
  if (text && ct.includes("json")) {
    try { data = JSON.parse(text); } catch { /* keep null */ }
  }
  if (!res.ok) {
    throw new Error(formatApiError(data, res.status));
  }
  return data;
}

/** 把后端错误（FastAPI 422 detail 是数组、500 是字符串、其它格式）规范成可读中文。 */
function formatApiError(data: any, status: number): string {
  // FastAPI 422: detail 是 [{loc, msg, type}, ...]
  const detail = data?.detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((e: any) => {
      const loc = Array.isArray(e?.loc) ? e.loc.filter((s: any) => s !== "body").join(".") : "";
      const msg = e?.msg || e?.message || "";
      // 校验长度类错误，给个更友好的中文提示
      if (typeof msg === "string" && /String should have at most (\d+) character/i.test(msg)) {
        const m = msg.match(/(\d+)/);
        return `${loc || "字段"} 内容超过最大长度限制（${m?.[1] || "?"} 字符）`;
      }
      if (typeof msg === "string" && /String should have at least (\d+) character/i.test(msg)) {
        return `${loc || "字段"} 内容不能为空`;
      }
      return loc ? `${loc}: ${msg}` : msg;
    }).filter(Boolean);
    if (parts.length) return parts.join("；");
  }
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    try { return JSON.stringify(detail); } catch { /* fallthrough */ }
  }
  if (typeof data?.message === "string") return data.message;
  return `请求失败 (${status})`;
}

export interface SceneOption {
  value: string;
  label: string;
}

export async function listScenes(): Promise<SceneOption[]> {
  const data = await fetchJSON(`${API}/ideas/scenes`) as { scenes: SceneOption[] };
  return data.scenes;
}

export async function createIdea(
  ideaText: string,
  scene?: string | null,
  referenceText?: string | null,
): Promise<Idea> {
  return fetchJSON(`${API}/ideas`, {
    method: "POST",
    body: JSON.stringify({
      idea_text: ideaText,
      scene: scene || null,
      reference_text: referenceText && referenceText.trim() ? referenceText : null,
    }),
  });
}

export async function listIdeas(params?: {
  status?: string;
  q?: string;
  scene?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: IdeaSummary[]; total: number; limit: number; offset: number }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.q) qs.set("q", params.q);
  if (params?.scene) qs.set("scene", params.scene);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const url = qs.toString() ? `${API}/ideas?${qs}` : `${API}/ideas`;
  return fetchJSON(url);
}

export async function fetchReviewQueue(): Promise<IdeaSummary[]> {
  return fetchJSON(`${API}/ideas/queue/review`);
}

export async function getIdea(id: string): Promise<Idea> {
  return fetchJSON(`${API}/ideas/${id}`);
}

export async function approveGate1(id: string) {
  return fetchJSON(`${API}/ideas/${id}/gate1/approve`, { method: "POST" });
}

export async function rejectGate1(id: string) {
  return fetchJSON(`${API}/ideas/${id}/gate1/reject`, { method: "POST" });
}

export interface EnrichmentFlags {
  topic_articles?: boolean;
  counter_views?: boolean;
  data_cases?: boolean;
}

export async function produceContent(
  id: string,
  types: string[],
  enrichment?: EnrichmentFlags,
  styleId?: string | null,
): Promise<Idea> {
  return fetchJSON(`${API}/ideas/${id}/produce`, {
    method: "POST",
    body: JSON.stringify({ types, enrichment: enrichment || null, style_id: styleId || null }),
  });
}

export async function saveBrief(id: string, briefText: string) {
  return fetchJSON(`${API}/ideas/${id}/brief`, {
    method: "POST",
    body: JSON.stringify({ brief_text: briefText }),
  });
}

export async function editReview(id: string, data: Record<string, string | number | null>) {
  return fetchJSON(`${API}/ideas/${id}/review/edit`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function approveReview(id: string) {
  return fetchJSON(`${API}/ideas/${id}/review/approve`, { method: "POST" });
}

export async function rejectReview(id: string, retryType: string) {
  return fetchJSON(`${API}/ideas/${id}/review/reject`, {
    method: "POST",
    body: JSON.stringify({ retry_type: retryType }),
  });
}

export async function markPublished(id: string, url?: string, notes?: string) {
  return fetchJSON(`${API}/ideas/${id}/publish`, {
    method: "POST",
    body: JSON.stringify({ publish_url: url, notes }),
  });
}

export async function optimizeTitles(id: string): Promise<{ titles: string[] }> {
  return fetchJSON(`${API}/ideas/${id}/optimize-titles`, { method: "POST" });
}

export async function generateTTS(id: string): Promise<{ url: string }> {
  return fetchJSON(`${API}/ideas/${id}/tts`, { method: "POST" });
}

// ── Config ──

export interface UserConfig {
  provider: string;
  api_key: string;
  model?: string;
  tavily_enabled: boolean;
  auto_review?: boolean;
  style_samples?: string;
}

/** Public view of config — API key is never exposed, only set status + hint. */
export interface UserConfigPublic {
  provider: string;
  api_key_set: boolean;
  api_key_hint: string;
  model?: string;
  tavily_enabled: boolean;
  auto_review?: boolean;
  style_samples?: string;
}

export async function getConfig(): Promise<UserConfigPublic> {
  return fetchJSON("/api/config");
}

export async function saveConfig(cfg: UserConfig): Promise<UserConfigPublic> {
  return fetchJSON("/api/config", {
    method: "POST",
    body: JSON.stringify(cfg),
  });
}


// ── Style Library ────────────────────────────────────────────────────

export interface StyleSample {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
  sort_order: number;
}

export interface StyleSampleInput {
  name: string;
  content: string;
  is_default: boolean;
  sort_order: number;
}

export async function listStyles(): Promise<StyleSample[]> {
  return fetchJSON(`${API}/styles`);
}

export async function createStyle(body: StyleSampleInput): Promise<StyleSample> {
  return fetchJSON(`${API}/styles`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateStyle(id: string, body: StyleSampleInput): Promise<StyleSample> {
  return fetchJSON(`${API}/styles/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteStyle(id: string): Promise<{ ok: boolean }> {
  return fetchJSON(`${API}/styles/${id}`, { method: "DELETE" });
}


// ── Phase 2: Content Library ─────────────────────────────────────────

export type EntryStatus = "to_edit" | "to_publish" | "published";

export interface Track {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  entry_count: number;
  created_at: string;
}

export interface ContentEntry {
  id: string;
  track_id: string;
  title: string;
  topic_direction: string | null;
  publish_date: string | null;
  status: EntryStatus;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function listTracks(): Promise<Track[]> {
  return fetchJSON(`${API}/tracks`);
}

export async function createTrack(name: string, description?: string): Promise<Track> {
  return fetchJSON(`${API}/tracks`, {
    method: "POST",
    body: JSON.stringify({ name, description: description || null }),
  });
}

export async function updateTrack(
  id: string,
  data: Partial<Pick<Track, "name" | "description" | "sort_order">>,
): Promise<Track> {
  return fetchJSON(`${API}/tracks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteTrack(id: string): Promise<void> {
  await fetch(`${API}/tracks/${id}`, { method: "DELETE" });
}

export async function clearTrackEntries(id: string): Promise<{ deleted: number }> {
  return fetchJSON(`${API}/tracks/${id}/entries`, { method: "DELETE" });
}

export async function listEntries(trackId: string, status?: EntryStatus): Promise<ContentEntry[]> {
  const qs = status ? `?status=${status}` : "";
  return fetchJSON(`${API}/tracks/${trackId}/entries${qs}`);
}

export async function createEntry(
  trackId: string,
  data: Partial<Omit<ContentEntry, "id" | "track_id" | "created_at" | "updated_at" | "sort_order">> & { title: string },
): Promise<ContentEntry> {
  return fetchJSON(`${API}/tracks/${trackId}/entries`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateEntry(
  entryId: string,
  data: Partial<Pick<ContentEntry, "title" | "topic_direction" | "publish_date" | "status" | "notes" | "sort_order">>,
): Promise<ContentEntry> {
  return fetchJSON(`${API}/entries/${entryId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteEntry(entryId: string): Promise<void> {
  await fetch(`${API}/entries/${entryId}`, { method: "DELETE" });
}

export async function batchUpdateEntries(ids: string[], status: EntryStatus): Promise<{ updated: number }> {
  return fetchJSON(`${API}/entries/batch`, {
    method: "PATCH",
    body: JSON.stringify({ ids, status }),
  });
}

export function exportTrackXlsxUrl(trackId: string): string {
  return `${API}/tracks/${trackId}/export`;
}

export async function importTrackXlsx(
  trackId: string,
  file: File,
): Promise<{ created: number; skipped: number; errors: string[] }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/tracks/${trackId}/import`, {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || `导入失败 (${res.status})`);
  return data;
}


// ── Phase 3: Feed crawling ─────────────────────────────────────

export interface FeedSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  last_fetched_at: string | null;
  last_error: string | null;
  sort_order: number;
  created_at: string;
}

export interface CrawlBatch {
  id: string;
  triggered_at: string;
  source_count: number;
  item_count: number;
  note: string | null;
}

export interface CrawlItem {
  id: string;
  batch_id: string;
  source_id: string | null;
  source_name: string | null;
  title: string;
  link: string;
  summary: string | null;
  author: string | null;
  published_at: string | null;
  created_at: string;
}

export async function listFeedSources(): Promise<FeedSource[]> {
  return fetchJSON(`${API}/feed-sources`);
}

export async function createFeedSource(data: { name: string; url: string; enabled?: boolean }): Promise<FeedSource> {
  return fetchJSON(`${API}/feed-sources`, { method: "POST", body: JSON.stringify(data) });
}

export async function updateFeedSource(id: string, data: Partial<Pick<FeedSource, "name" | "url" | "enabled" | "sort_order">>): Promise<FeedSource> {
  return fetchJSON(`${API}/feed-sources/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteFeedSource(id: string): Promise<void> {
  await fetch(`${API}/feed-sources/${id}`, { method: "DELETE" });
}

export async function triggerCrawl(): Promise<CrawlBatch> {
  return fetchJSON(`${API}/crawl/run`, { method: "POST" });
}

export async function listCrawlBatches(): Promise<CrawlBatch[]> {
  return fetchJSON(`${API}/crawl/batches`);
}

export async function listBatchItems(batchId: string): Promise<CrawlItem[]> {
  return fetchJSON(`${API}/crawl/batches/${batchId}/items`);
}

export async function deleteBatch(batchId: string): Promise<void> {
  await fetch(`${API}/crawl/batches/${batchId}`, { method: "DELETE" });
}

export async function deleteCrawlItem(itemId: string): Promise<void> {
  await fetch(`${API}/crawl/items/${itemId}`, { method: "DELETE" });
}

export async function crawlItemsToTrack(itemIds: string[], trackId: string): Promise<{ created: number; track_id: string }> {
  return fetchJSON(`${API}/crawl/items-to-track`, {
    method: "POST",
    body: JSON.stringify({ item_ids: itemIds, track_id: trackId }),
  });
}

export async function crawlItemsToIdea(itemIds: string[], brief?: string): Promise<{ id: string; merged_count: number }> {
  return fetchJSON(`${API}/crawl/items-to-idea`, {
    method: "POST",
    body: JSON.stringify({ item_ids: itemIds, brief }),
  });
}
