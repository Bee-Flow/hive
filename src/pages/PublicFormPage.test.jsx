import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';

const authFetch = vi.fn();
vi.mock('../utils/authFetch', () => ({ default: authFetch, authFetch }));

const { default: PublicFormPage } = await import('./PublicFormPage');

const TOKEN = 'a'.repeat(48);
const FORM = {
    title: 'Contact us',
    description: 'We answer within a day.',
    submitLabel: 'Send it',
    successMessage: 'Thanks — we got your answer.',
    theme: { primary: '#0F766E', radius: 'md', density: 'comfortable', fontScale: 'md', appearance: 'light' },
    fields: [
        { name: 'email', type: 'email', label: 'Your email', required: true, placeholder: 'you@work.nl' },
        { name: 'topic', type: 'select', label: 'Topic', required: false, options: [{ value: 'sales', label: 'Sales' }] },
        { name: 'note', type: 'textarea', label: 'Message', required: false },
    ],
};

function mockFetch(handlers) {
    return vi.fn(async (url, init = {}) => {
        const method = (init.method || 'GET').toUpperCase();
        const key = `${method} ${String(url).replace(/^.*\/api\/automation\/form/, '')}`;
        const h = handlers[key];
        if (!h) throw new Error(`unmocked fetch: ${key}`);
        const r = await h(init);
        return { ok: r.ok !== false, status: r.status || 200, json: async () => r.body ?? {} };
    });
}

const okLoad = { [`GET /${TOKEN}`]: async () => ({ body: { form: FORM, csrf: 'csrf-1', issuedAt: Date.now() - 10_000 } }) };

describe('PublicFormPage', () => {
    beforeEach(() => { cleanup(); authFetch.mockClear(); document.documentElement.removeAttribute('data-theme'); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('renders the form the server described', async () => {
        vi.stubGlobal('fetch', mockFetch(okLoad));
        render(<PublicFormPage token={TOKEN} />);
        expect(await screen.findByText('Contact us')).toBeTruthy();
        expect(screen.getByText('We answer within a day.')).toBeTruthy();
        expect(screen.getByLabelText(/Your email/)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Send it' })).toBeTruthy();
    });

    it('never calls authFetch — a 401 reload would trap an anonymous visitor', async () => {
        const f = mockFetch(okLoad);
        vi.stubGlobal('fetch', f);
        render(<PublicFormPage token={TOKEN} />);
        await screen.findByText('Contact us');
        expect(f).toHaveBeenCalled();
        expect(authFetch).not.toHaveBeenCalled();
    });

    it('stamps data-theme itself, because applyThemeToDocument never runs here', async () => {
        vi.stubGlobal('fetch', mockFetch(okLoad));
        const { unmount } = render(<PublicFormPage token={TOKEN} />);
        await screen.findByText('Contact us');
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        unmount();
        // …and puts it back, so the builder preview can't leak a theme.
        expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    });

    it('applies the author theme as --app-* custom properties', async () => {
        vi.stubGlobal('fetch', mockFetch(okLoad));
        const { container } = render(<PublicFormPage token={TOKEN} />);
        await screen.findByText('Contact us');
        const form = container.querySelector('form');
        expect(form.style.getPropertyValue('--app-primary')).toBe('#0F766E');
        expect(form.style.getPropertyValue('--app-radius')).toBe('8px');
    });

    it('a required field blocks submission client-side', async () => {
        const f = mockFetch(okLoad);
        vi.stubGlobal('fetch', f);
        render(<PublicFormPage token={TOKEN} />);
        await screen.findByText('Contact us');
        fireEvent.click(screen.getByRole('button', { name: 'Send it' }));
        expect(await screen.findByText('Your email is required.')).toBeTruthy();
        expect(f).toHaveBeenCalledTimes(1); // only the initial GET
    });

    it('a successful submission replaces the form with the thank-you message', async () => {
        let posted = null;
        vi.stubGlobal('fetch', mockFetch({
            ...okLoad,
            [`POST /${TOKEN}`]: async (init) => { posted = JSON.parse(init.body); return { status: 202, body: { accepted: true } }; },
        }));
        render(<PublicFormPage token={TOKEN} />);
        await screen.findByText('Contact us');
        fireEvent.change(screen.getByLabelText(/Your email/), { target: { value: 'a@b.nl' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send it' }));

        expect(await screen.findByText('Thanks — we got your answer.')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Send it' })).toBeNull();
        expect(posted.email).toBe('a@b.nl');
        // The anti-bot payload the server expects.
        expect(posted.csrf).toBe('csrf-1');
        expect(posted.website_url).toBe('');
        expect(typeof posted.nonce).toBe('string');
        expect(posted.issuedAt).toBeGreaterThan(0);
    });

    it('per-field server errors land on the right fields', async () => {
        vi.stubGlobal('fetch', mockFetch({
            ...okLoad,
            [`POST /${TOKEN}`]: async () => ({ ok: false, status: 400, body: { error: 'Some answers need attention', fields: [{ field: 'email', message: 'Your email is not a valid email address.' }] } }),
        }));
        render(<PublicFormPage token={TOKEN} />);
        await screen.findByText('Contact us');
        fireEvent.change(screen.getByLabelText(/Your email/), { target: { value: 'nope' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send it' }));
        expect(await screen.findByText('Your email is not a valid email address.')).toBeTruthy();
    });

    it('an unknown token shows one neutral message, not a hint that it once existed', async () => {
        vi.stubGlobal('fetch', mockFetch({ [`GET /${TOKEN}`]: async () => ({ ok: false, status: 404, body: { error: 'Not found' } }) }));
        render(<PublicFormPage token={TOKEN} />);
        expect(await screen.findByText('This form is not available')).toBeTruthy();
    });

    it('survives an unreachable server', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
        render(<PublicFormPage token={TOKEN} />);
        await waitFor(() => expect(screen.getByText('Could not reach the server')).toBeTruthy());
    });
});

// ── Multi-page ────────────────────────────────────────────────────────────
//
// A routine can pause at a form_page step. The visitor never leaves /f/<token>:
// the page polls its session and swaps in whatever comes back.

const SESSION = 'c'.repeat(48);
const MULTI = { ...FORM, multiPage: true };
const PAGE_2 = {
    title: 'Nearly there',
    description: '',
    submitLabel: 'Finish',
    successMessage: 'Done!',
    theme: FORM.theme,
    fields: [{ name: 'address', type: 'text', label: 'Your address', required: true }],
};

const multiLoad = { [`GET /${TOKEN}`]: async () => ({ body: { form: MULTI, csrf: 'csrf-1', issuedAt: Date.now() - 10_000 } }) };
const acceptFirst = { [`POST /${TOKEN}`]: async () => ({ status: 202, body: { accepted: true, sessionId: SESSION } }) };
const poll = (...responses) => {
    let i = 0;
    return async () => ({ body: responses[Math.min(i++, responses.length - 1)] });
};

describe('PublicFormPage — multi-page', () => {
    beforeEach(() => {
        cleanup();
        authFetch.mockClear();
        document.documentElement.removeAttribute('data-theme');
        window.history.replaceState(null, '', '/f/' + TOKEN);
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    /** Fill page one and submit it. */
    async function submitPageOne() {
        await screen.findByText('Contact us');
        fireEvent.change(screen.getByLabelText(/Your email/), { target: { value: 'a@b.nl' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send it' }));
    }

    it('the next page appears on the SAME url, without a navigation', async () => {
        vi.stubGlobal('fetch', mockFetch({
            ...multiLoad,
            ...acceptFirst,
            [`GET /${TOKEN}/s/${SESSION}`]: poll({ state: 'working' }, { state: 'form', form: PAGE_2, csrf: 'csrf-2', issuedAt: Date.now() }),
        }));
        const pathBefore = window.location.pathname;
        render(<PublicFormPage token={TOKEN} />);
        await submitPageOne();

        expect(await screen.findByText('Nearly there', {}, { timeout: 4000 })).toBeTruthy();
        expect(screen.getByLabelText(/Your address/)).toBeTruthy();
        expect(window.location.pathname).toBe(pathBefore);
        // Page one's answers are gone from the DOM — the form is remounted, so
        // nothing bleeds from one page into the next.
        expect(screen.queryByLabelText(/Your email/)).toBeNull();
    });

    it('the session id is mirrored into ?s= so a reload resumes instead of restarting', async () => {
        vi.stubGlobal('fetch', mockFetch({
            ...multiLoad,
            ...acceptFirst,
            [`GET /${TOKEN}/s/${SESSION}`]: poll({ state: 'form', form: PAGE_2, csrf: 'csrf-2', issuedAt: Date.now() }),
        }));
        render(<PublicFormPage token={TOKEN} />);
        await submitPageOne();
        await screen.findByText('Nearly there', {}, { timeout: 4000 });
        expect(new URLSearchParams(window.location.search).get('s')).toBe(SESSION);
    });

    it('landing with ?s= asks the session first and never re-submits page one', async () => {
        window.history.replaceState(null, '', `/f/${TOKEN}?s=${SESSION}`);
        const f = mockFetch({
            ...multiLoad,
            [`GET /${TOKEN}/s/${SESSION}`]: poll({ state: 'form', form: PAGE_2, csrf: 'csrf-2', issuedAt: Date.now() }),
        });
        vi.stubGlobal('fetch', f);
        render(<PublicFormPage token={TOKEN} />);

        expect(await screen.findByText('Nearly there')).toBeTruthy();
        // Page one was never fetched, let alone posted.
        const urls = f.mock.calls.map(c => String(c[0]));
        expect(urls.some(u => u.endsWith(`/s/${SESSION}`))).toBe(true);
        expect(urls.some(u => u.endsWith(TOKEN))).toBe(false);
    });

    it('a stale ?s= falls back to page one rather than dead-ending', async () => {
        window.history.replaceState(null, '', `/f/${TOKEN}?s=${SESSION}`);
        vi.stubGlobal('fetch', mockFetch({
            ...multiLoad,
            [`GET /${TOKEN}/s/${SESSION}`]: async () => ({ ok: false, status: 404, body: { error: 'Not found' } }),
        }));
        render(<PublicFormPage token={TOKEN} />);
        expect(await screen.findByText('Contact us')).toBeTruthy();
        expect(new URLSearchParams(window.location.search).get('s')).toBeNull();
    });

    it('page two posts to the session endpoint with that page\'s csrf', async () => {
        let posted = null;
        vi.stubGlobal('fetch', mockFetch({
            ...multiLoad,
            ...acceptFirst,
            [`GET /${TOKEN}/s/${SESSION}`]: poll(
                { state: 'form', form: PAGE_2, csrf: 'csrf-2', issuedAt: Date.now() },
                { state: 'done', ending: { title: 'All done', description: 'Ticket T-9', theme: FORM.theme } },
            ),
            [`POST /${TOKEN}/s/${SESSION}`]: async (init) => { posted = JSON.parse(init.body); return { status: 202, body: { accepted: true } }; },
        }));
        render(<PublicFormPage token={TOKEN} />);
        await submitPageOne();
        await screen.findByText('Nearly there', {}, { timeout: 4000 });

        fireEvent.change(screen.getByLabelText(/Your address/), { target: { value: 'Main Street 1' } });
        fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

        await waitFor(() => expect(posted).not.toBeNull());
        expect(posted.address).toBe('Main Street 1');
        expect(posted.csrf).toBe('csrf-2');
    });

    it('the closing page shows the summary the routine rendered', async () => {
        vi.stubGlobal('fetch', mockFetch({
            ...multiLoad,
            ...acceptFirst,
            [`GET /${TOKEN}/s/${SESSION}`]: poll({ state: 'done', ending: { title: 'All done', description: 'We created ticket T-9.', theme: FORM.theme } }),
        }));
        render(<PublicFormPage token={TOKEN} />);
        await submitPageOne();

        expect(await screen.findByText('All done', {}, { timeout: 4000 })).toBeTruthy();
        expect(screen.getByText('We created ticket T-9.')).toBeTruthy();
        // …and the finished journey drops ?s=, so a reload starts fresh.
        expect(new URLSearchParams(window.location.search).get('s')).toBeNull();
    });

    it('a run with no closing page still ends politely', async () => {
        vi.stubGlobal('fetch', mockFetch({
            ...multiLoad,
            ...acceptFirst,
            [`GET /${TOKEN}/s/${SESSION}`]: poll({ state: 'done', ending: null }),
        }));
        render(<PublicFormPage token={TOKEN} />);
        await submitPageOne();
        expect(await screen.findByText('Thanks — we got your answer.', {}, { timeout: 4000 })).toBeTruthy();
    });

    it('a failed run shows a neutral message, never the internal error', async () => {
        vi.stubGlobal('fetch', mockFetch({
            ...multiLoad,
            ...acceptFirst,
            [`GET /${TOKEN}/s/${SESSION}`]: poll({ state: 'error' }),
        }));
        render(<PublicFormPage token={TOKEN} />);
        await submitPageOne();
        expect(await screen.findByText('Something went wrong', {}, { timeout: 4000 })).toBeTruthy();
    });

    it('an expired session says so', async () => {
        vi.stubGlobal('fetch', mockFetch({
            ...multiLoad,
            ...acceptFirst,
            [`GET /${TOKEN}/s/${SESSION}`]: poll({ state: 'expired' }),
        }));
        render(<PublicFormPage token={TOKEN} />);
        await submitPageOne();
        expect(await screen.findByText('This form has expired', {}, { timeout: 4000 })).toBeTruthy();
    });

    it('a single-page form never polls — it shows its thank-you straight away', async () => {
        // The regression this guards: making every form wait on a session would
        // put a spinner in front of the simplest possible case.
        const f = mockFetch({ ...okLoad, ...acceptFirst });
        vi.stubGlobal('fetch', f);
        render(<PublicFormPage token={TOKEN} />);
        await submitPageOne();

        expect(await screen.findByText('Thanks — we got your answer.')).toBeTruthy();
        const urls = f.mock.calls.map(c => String(c[0]));
        expect(urls.some(u => u.includes('/s/'))).toBe(false);
    });

    it('an upload on a later page tells the server which page it is for', async () => {
        const withFile = { ...PAGE_2, fields: [...PAGE_2.fields, { name: 'proof', type: 'file', label: 'Proof', maxSizeMb: 5 }] };
        let uploadBody = null;
        vi.stubGlobal('fetch', mockFetch({
            ...multiLoad,
            ...acceptFirst,
            [`GET /${TOKEN}/s/${SESSION}`]: poll({ state: 'form', form: withFile, csrf: 'csrf-2', issuedAt: Date.now() }),
            [`POST /${TOKEN}/upload`]: async (init) => { uploadBody = init.body; return { body: { fileId: 'up_1', filename: 'p.pdf', size: 3 } }; },
        }));
        render(<PublicFormPage token={TOKEN} />);
        await submitPageOne();
        await screen.findByText('Nearly there', {}, { timeout: 4000 });

        const input = document.querySelector('input[type="file"]');
        fireEvent.change(input, { target: { files: [new File(['pdf'], 'p.pdf', { type: 'application/pdf' })] } });

        await waitFor(() => expect(uploadBody).not.toBeNull());
        expect(uploadBody.get('sessionId')).toBe(SESSION);
        expect(uploadBody.get('csrf')).toBe('csrf-2');
    });
});
