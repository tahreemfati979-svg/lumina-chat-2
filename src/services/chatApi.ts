import type { Role } from '../types/chat';

export interface ApiMessagePayload {
  role: Role;
  content: string;
}

export async function streamChatCompletion(
  messages: ApiMessagePayload[],
  onChunk: (chunkText: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    let errorMessage =
      response.status === 404
        ? 'Chat API endpoint not found (404). Make sure the server is running and try again.'
        : `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data && typeof data.error === 'string') {
        errorMessage = data.error;
      }
    } catch {
      // Fallback to HTTP status message
    }
    throw new Error(errorMessage);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream') || !response.body) {
    const data = await response.json();
    if (data?.error) {
      throw new Error(data.error);
    }
    const text = typeof data?.text === 'string' ? data.text : '';
    if (text) onChunk(text);
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const event of events) {
      const lines = event.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === '[DONE]') continue;

        let parsed: { text?: string; error?: string };
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }

        if (parsed.error) {
          throw new Error(parsed.error);
        }

        if (typeof parsed.text === 'string' && parsed.text.length > 0) {
          fullText += parsed.text;
          onChunk(parsed.text);
        }
      }
    }
  }

  return fullText;
}
