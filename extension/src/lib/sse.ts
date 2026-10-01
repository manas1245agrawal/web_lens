export interface SSEEvent {
  type: 'token' | 'sources' | 'done' | 'error';
  text?: string;
  items?: Array<{
    id: number;
    snippet: string;
    section?: string;
    kind?: 'text' | 'table';
  }>;
  message?: string;
}

export async function* parseSSEResponse(
  response: Response
): AsyncGenerator<SSEEvent, void, unknown> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || ''; // Keep incomplete trailing chunk in buffer

    for (const part of parts) {
      const line = part.trim();
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim();
        if (jsonStr) {
          try {
            const event: SSEEvent = JSON.parse(jsonStr);
            yield event;
          } catch (e) {
            console.error('Failed to parse SSE JSON payload:', jsonStr, e);
          }
        }
      }
    }
  }

  // Flush remaining buffer if present
  if (buffer.trim().startsWith('data: ')) {
    const jsonStr = buffer.trim().slice(6).trim();
    if (jsonStr) {
      try {
        const event: SSEEvent = JSON.parse(jsonStr);
        yield event;
      } catch (e) {
        // Ignore partial chunk trailing
      }
    }
  }
}
