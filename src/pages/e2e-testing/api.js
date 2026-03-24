/**
 * E2E Testing — API client & React context
 * All API calls are routed through /api/e2e/* on the main server.
 * Uses API_BASE from helpers.js so requests go to the correct server domain.
 */
import { createContext, useContext } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';

const safeJson = async (r) => {
  const text = await r.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
};

export function createApiClient() {
  const base = `${API_BASE}/api/e2e`;
  return {
    get: (url) => authFetch(`${base}${url.replace('/api', '')}`).then(safeJson),
    post: (url, data) =>
      authFetch(`${base}${url.replace('/api', '')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(safeJson),
    delete: (url) =>
      authFetch(`${base}${url.replace('/api', '')}`, { method: 'DELETE' }).then(safeJson),
    /** Full proxied URL for EventSource / images */
    url: (path) => `${base}${path.replace('/api', '')}`,
    /**
     * Connect to an SSE stream using fetch (supports cross-origin credentials).
     * Returns { close() } handle. Calls onMessage(parsedData) for each event.
     */
    stream: (path, { onMessage, onError, onDone } = {}) => {
      const controller = new AbortController();
      const url = `${base}${path.replace('/api', '')}`;

      (async () => {
        try {
          const res = await fetch(url, {
            credentials: 'include',
            signal: controller.signal,
            headers: { Accept: 'text/event-stream' },
          });

          if (!res.ok) {
            onError?.(new Error(`Stream failed: ${res.status}`));
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) { onDone?.(); break; }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  onMessage?.(data);
                } catch { /* skip non-JSON */ }
              }
            }
          }
        } catch (err) {
          if (err.name !== 'AbortError') onError?.(err);
        }
      })();

      return { close: () => controller.abort() };
    },
  };
}

export const ApiContext = createContext(null);

export function useApi() {
  return useContext(ApiContext);
}
