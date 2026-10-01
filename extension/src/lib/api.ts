import { getInstallId } from './identity';
import { parseSSEResponse, SSEEvent } from './sse';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface IngestPayload {
  url: string;
  title: string;
  markdown: string;
  content_hash: string;
}

export interface IngestResponse {
  page_id: string;
  status: 'indexed' | 'cached' | 'reindexed';
  chunks: number;
  tables: number;
  mode: 'full' | 'rag';
  token_estimate: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
}

export interface HistoryResponse {
  messages: ChatMessage[];
  summary: string | null;
}

async function getHeaders(): Promise<Record<string, string>> {
  const installId = await getInstallId();
  return {
    'Content-Type': 'application/json',
    'X-Install-Id': installId,
  };
}

export async function apiIngest(payload: IngestPayload): Promise<IngestResponse> {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'ingest_failed' }));
    throw new Error(errorData.error || `Ingest failed with status ${res.status}`);
  }

  return res.json();
}

export async function apiGetHistory(threadId: string): Promise<HistoryResponse> {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE}/history?thread_id=${encodeURIComponent(threadId)}`, {
    headers,
  });

  if (!res.ok) {
    return { messages: [], summary: null };
  }

  return res.json();
}

export async function apiDeletePage(pageId: string): Promise<{ deleted: boolean }> {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE}/page?page_id=${encodeURIComponent(pageId)}`, {
    method: 'DELETE',
    headers,
  });

  if (!res.ok) {
    throw new Error(`Delete page failed with status ${res.status}`);
  }

  return res.json();
}

export async function* apiStreamChat(
  pageId: string,
  threadId: string,
  message: string,
  signal?: AbortSignal
): AsyncGenerator<SSEEvent, void, unknown> {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      page_id: pageId,
      thread_id: threadId,
      message,
    }),
    signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'chat_failed' }));
    throw new Error(errorData.error || `Chat failed with status ${res.status}`);
  }

  yield* parseSSEResponse(res);
}
