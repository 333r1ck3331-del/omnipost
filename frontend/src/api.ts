const API = "/api";

export interface Idea {
  id: string;
  idea_text: string;
  status: string;
  gate1_score: number | null;
  gate1_result: any;
  gate1_passed: number;
  selected_types: string[] | null;
  content_gzh: string | null;
  content_xhs: string | null;
  content_video_script: string | null;
  content_bilibili: string | null;
  title_suggestions: string[] | null;
  final_content: any;
  publish_url: string | null;
  notes: string | null;
  distribution_strategy: any;
  created_at: string;
  updated_at: string;
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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function createIdea(ideaText: string): Promise<Idea> {
  return fetchJSON(`${API}/ideas`, {
    method: "POST",
    body: JSON.stringify({ idea_text: ideaText }),
  });
}

export async function listIdeas(status?: string): Promise<{ items: IdeaSummary[]; total: number }> {
  const url = status ? `${API}/ideas?status=${status}` : `${API}/ideas`;
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

export async function produceContent(id: string, types: string[], tone?: string): Promise<Idea> {
  return fetchJSON(`${API}/ideas/${id}/produce`, {
    method: "POST",
    body: JSON.stringify({ types, tone }),
  });
}

export async function saveBrief(id: string, briefText: string) {
  return fetchJSON(`${API}/ideas/${id}/brief`, {
    method: "POST",
    body: JSON.stringify({ brief_text: briefText }),
  });
}

export async function editReview(id: string, data: Record<string, string | null>) {
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

export async function getConfig(): Promise<UserConfig> {
  return fetchJSON("/api/config");
}

export async function saveConfig(cfg: UserConfig): Promise<UserConfig> {
  return fetchJSON("/api/config", {
    method: "POST",
    body: JSON.stringify(cfg),
  });
}
