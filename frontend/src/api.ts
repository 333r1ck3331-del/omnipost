const API = "/api";

export interface Idea {
  id: string;
  idea_text: string;
  track: string;
  tone: string;
  status: string;
  gate1_score: number | null;
  gate1_result: any;
  gate1_passed: number;
  selected_types: string[] | null;
  content_gzh: string | null;
  content_xhs: string | null;
  content_video_script: string | null;
  title_suggestions: string[] | null;
  final_content: any;
  publish_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IdeaSummary {
  id: string;
  idea_text: string;
  status: string;
  track: string;
  tone: string;
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

export async function createIdea(ideaText: string, track = "psychology", tone = "gentle_comfort"): Promise<Idea> {
  return fetchJSON(`${API}/ideas`, {
    method: "POST",
    body: JSON.stringify({ idea_text: ideaText, track, tone }),
  });
}

export async function listIdeas(status?: string): Promise<{ items: IdeaSummary[]; total: number }> {
  const url = status ? `${API}/ideas?status=${status}` : `${API}/ideas`;
  return fetchJSON(url);
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
