const API = "/api";

export interface Idea {
  id: string;
  idea_text: string;
  status: string;
  gate1_score: number | null;
  gate1_result: Gate1Result | null;
  gate1_passed: boolean;
  selected_types: string[] | null;
  content_gzh: string | null;
  content_xhs: string | null;
  content_video_script: string | null;
  content_bilibili: string | null;
  title_suggestions: string[] | null;
  image_plans?: { gzh?: any; xhs?: any } | null;
  video_storyboard?: { video?: any; bilibili?: any } | null;
  final_content: Record<string, unknown> | null;
  publish_url: string | null;
  notes: string | null;
  distribution_strategy: DistributionStrategy | null;
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
    const msg = data?.detail || data?.message || `请求失败 (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function createIdea(ideaText: string): Promise<Idea> {
  return fetchJSON(`${API}/ideas`, {
    method: "POST",
    body: JSON.stringify({ idea_text: ideaText }),
  });
}

export async function listIdeas(status?: string): Promise<{ items: IdeaSummary[]; total: number }> {
  const url = status ? `${API}/ideas?status=${encodeURIComponent(status)}` : `${API}/ideas`;
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

export async function produceContent(id: string, types: string[]): Promise<Idea> {
  return fetchJSON(`${API}/ideas/${id}/produce`, {
    method: "POST",
    body: JSON.stringify({ types }),
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
  tavily_enabled: boolean;
}

/** Public view of config — API key is never exposed, only set status + hint. */
export interface UserConfigPublic {
  provider: string;
  api_key_set: boolean;
  api_key_hint: string;
  tavily_enabled: boolean;
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
