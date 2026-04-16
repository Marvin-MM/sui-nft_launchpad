// ── Types ─────────────────────────────────────────────────────────────────────

export type FeedbackCategory = 'bug' | 'feature' | 'ux' | 'performance' | 'general';
export type FeedbackStatus   = 'new' | 'in_progress' | 'resolved' | 'closed';
export type FeedbackPriority = 'low' | 'normal' | 'high' | 'critical';

export interface FeedbackItem {
  id:            string;
  category:      FeedbackCategory;
  message:       string;
  email:         string | null;
  name:          string | null;
  isAnonymous:   boolean;
  walletAddress: string | null;
  page:          string | null;
  status:        FeedbackStatus;
  adminNotes:    string | null;
  priority:      FeedbackPriority;
  createdAt:     string;
  updatedAt:     string;
}

export interface FeedbackStats {
  total:       number;
  byStatus:    Record<FeedbackStatus, number>;
  byCategory:  Record<FeedbackCategory, number>;
  byPriority:  Record<FeedbackPriority, number>;
}

export interface SubmitFeedbackPayload {
  category:       FeedbackCategory;
  message:        string;
  email?:         string;
  name?:          string;
  isAnonymous:    boolean;
  walletAddress?: string;
  page?:          string;
}

export interface ListFeedbackResponse {
  data:  FeedbackItem[];
  total: number;
  page:  number;
  limit: number;
}

export interface ListFeedbackParams {
  status?:   FeedbackStatus;
  category?: FeedbackCategory;
  priority?: FeedbackPriority;
  search?:   string;
  page?:     number;
  limit?:    number;
}

export interface UpdateFeedbackPayload {
  status?:     FeedbackStatus;
  adminNotes?: string;
  priority?:   FeedbackPriority;
}

// ── Internal fetch helper ─────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Submit new feedback — public, no auth required. */
export async function submitFeedback(
  payload: SubmitFeedbackPayload,
): Promise<{ id: string; message: string }> {
  return apiFetch('/api/feedback', {
    method: 'POST',
    body:   JSON.stringify(payload),
  });
}

// ── Admin API (requires ADMIN_API_KEY via Authorization header) ───────────────

/** List feedback items with optional filters + pagination. */
export async function listFeedback(
  adminKey: string,
  params:   ListFeedbackParams = {},
): Promise<ListFeedbackResponse> {
  const query = new URLSearchParams();
  if (params.status)   query.set('status',   params.status);
  if (params.category) query.set('category', params.category);
  if (params.priority) query.set('priority', params.priority);
  if (params.search)   query.set('search',   params.search);
  if (params.page)     query.set('page',     String(params.page));
  if (params.limit)    query.set('limit',    String(params.limit));

  const qs = query.toString();
  return apiFetch(`/api/feedback${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${adminKey}` },
  });
}

/** Fetch aggregate stats. */
export async function getFeedbackStats(adminKey: string): Promise<FeedbackStats> {
  return apiFetch('/api/feedback/stats', {
    headers: { Authorization: `Bearer ${adminKey}` },
  });
}

/** Fetch a single feedback item. */
export async function getFeedbackItem(adminKey: string, id: string): Promise<FeedbackItem> {
  return apiFetch(`/api/feedback/${id}`, {
    headers: { Authorization: `Bearer ${adminKey}` },
  });
}

/** Update status / adminNotes / priority. */
export async function updateFeedback(
  adminKey: string,
  id:       string,
  payload:  UpdateFeedbackPayload,
): Promise<FeedbackItem> {
  return apiFetch(`/api/feedback/${id}`, {
    method:  'PATCH',
    body:    JSON.stringify(payload),
    headers: { Authorization: `Bearer ${adminKey}` },
  });
}

/** Permanently delete a feedback item. */
export async function deleteFeedback(
  adminKey: string,
  id:       string,
): Promise<{ success: boolean }> {
  return apiFetch(`/api/feedback/${id}`, {
    method:  'DELETE',
    headers: { Authorization: `Bearer ${adminKey}` },
  });
}
