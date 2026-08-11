/**
 * Nine marketing pages tell the reader "the demo has no network access".
 *
 * Every other call a demo makes goes through `authFetch`, which the demo
 * transport intercepts. These two do not: ThemeContext reloads branding with a
 * PLAIN `fetch`, deliberately, because authFetch turns the expected 401 into a
 * full page reload. That exemption is correct for the app and invisible from
 * the transport, so it is the one hole the fail-closed design cannot see — and
 * it was the last thing still leaving a demo page after the shell was sealed.
 *
 * Run: cd agent-hub && npx vitest run src/components/ThemeContext.demo.test.jsx
 */
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from './ThemeContext';

const setPath = (pathname) => {
    window.history.replaceState({}, '', pathname);
};

describe('ThemeContext on a public feature demo', () => {
    let fetchSpy;

    beforeEach(() => {
        fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ preset: 'light' }), {
                status: 200, headers: { 'Content-Type': 'application/json' },
            }),
        );
    });
    afterEach(() => { fetchSpy.mockRestore(); setPath('/'); });

    it('asks the server for nothing', async () => {
        setPath('/__demo__/privacy-shield');
        render(<ThemeProvider><div>demo</div></ThemeProvider>);
        // Give the mount effect every chance to fire before concluding it did not.
        await new Promise(r => setTimeout(r, 50));
        const branding = fetchSpy.mock.calls.filter(([url]) => String(url).includes('/api/branding/'));
        expect(branding, `demo page fetched ${branding.map(c => c[0]).join(', ')}`).toHaveLength(0);
    });

    it('still reconciles with the server everywhere else', async () => {
        setPath('/app/studio/agents');
        render(<ThemeProvider><div>app</div></ThemeProvider>);
        await waitFor(() => {
            expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('/api/branding/effective'))).toBe(true);
        });
    });
});
