import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

// Mock the auth helpers so the preview-token fetch is observable and offline.
const authFetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ token: 'tok-123', expiresAt: Date.now() + 60_000 }),
}));
vi.mock('../../utils/helpers', () => ({
    API_BASE: 'https://host.example',
    authFetch: (...args) => authFetch(...args),
}));

import WebpagePreview from './WebpagePreview';

// Dispatch a message event with a forced `source` (jsdom's MessageEvent
// constructor doesn't preserve source, so define it explicitly).
function postFrom(source, data) {
    const ev = new MessageEvent('message', { data });
    Object.defineProperty(ev, 'source', { value: source });
    window.dispatchEvent(ev);
}

describe('WebpagePreview token-refresh postMessage source check', () => {
    beforeEach(() => authFetch.mockClear());

    it('ignores a token-refresh from a window that is not the preview iframe', async () => {
        const { container } = render(<WebpagePreview webpageId="wp1" html="<p>hi</p>" css="" js="" />);
        // Wait for the initial on-mount token fetch.
        await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(1));

        // A message from `window` (not the iframe) must NOT trigger a mint.
        postFrom(window, { __beeflowTokenRefresh: true, requestId: 'r1' });
        await new Promise(r => setTimeout(r, 0));
        expect(authFetch).toHaveBeenCalledTimes(1);

        // A message from the actual preview iframe SHOULD trigger a mint.
        const iframe = container.querySelector('iframe');
        expect(iframe).toBeTruthy();
        postFrom(iframe.contentWindow, { __beeflowTokenRefresh: true, requestId: 'r2' });
        await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(2));
    });
});
