import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AppFilePreview, { firstDescriptor } from './AppFilePreview';
import { DataProvider } from '../DataContext';
import { RuntimeProvider, DEFAULT_RUNTIME } from '../RuntimeContext';

/**
 * The inline file viewer.
 *
 * Two properties are load-bearing beyond "does it render":
 *   • it fetches through authFetch and shows a blob: URL, never a raw
 *     cross-origin `src` — authFetch is the demo-mode choke point, and a bare
 *     src would turn an anonymous demo click into a real API call.
 *   • it fetches NOTHING while designing. The canvas re-renders on every
 *     keystroke; a request per render would drain the read limiter.
 */

vi.mock('../../../../../../utils/helpers', () => ({
    API_BASE: 'https://api.test',
    authFetch: (...args) => globalThis.__authFetch(...args),
}));

const STUDIO = { kind: 'studio_attachment', fileId: 'f1', name: 'invoice.pdf', mime: 'application/pdf', size: 10 };
const PENDING = { kind: 'mailbox_attachment', connectorId: 'c1', messageId: 'm1', attachmentId: 'a1', name: 'invoice.pdf', mime: 'application/pdf', size: 10 };

function blobResponse(type) {
    return { ok: true, status: 200, blob: async () => new Blob(['x'], { type }) };
}

function renderPreview(value, { mode = 'run', props = {} } = {}) {
    const node = {
        id: 'cmp_fp',
        type: 'file_preview',
        props: { source: { kind: 'static', value }, emptyText: 'No document selected.', allowDownload: true, ...props },
        style: { span: 12, height: 'lg' },
    };
    return render(
        <DataProvider appId="app_1">
            <RuntimeProvider value={{ ...DEFAULT_RUNTIME, mode }}>
                <AppFilePreview node={node} />
            </RuntimeProvider>
        </DataProvider>,
    );
}

beforeEach(() => {
    globalThis.__authFetch = vi.fn(async () => blobResponse('application/pdf'));
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-1');
    globalThis.URL.revokeObjectURL = vi.fn();
});

afterEach(() => { vi.restoreAllMocks(); });

describe('AppFilePreview', () => {
    it('shows the empty text with nothing bound', () => {
        const { getByText } = renderPreview(null);
        expect(getByText('No document selected.')).toBeTruthy();
        expect(globalThis.__authFetch).not.toHaveBeenCalled();
    });

    it('fetches once and frames a PDF from a blob URL', async () => {
        const { container } = renderPreview(STUDIO);
        await waitFor(() => expect(container.querySelector('iframe')).toBeTruthy());

        expect(globalThis.__authFetch).toHaveBeenCalledTimes(1);
        expect(globalThis.__authFetch.mock.calls[0][0]).toContain('/data/attachments/f1');
        expect(container.querySelector('iframe').getAttribute('src')).toMatch(/^blob:/);
    });

    it('renders an image as an image, not in a frame', async () => {
        globalThis.__authFetch = vi.fn(async () => blobResponse('image/png'));
        const { container } = renderPreview({ ...STUDIO, mime: 'image/png', name: 'scan.png' });
        await waitFor(() => expect(container.querySelector('img')).toBeTruthy());
        expect(container.querySelector('iframe')).toBeNull();
    });

    it('offers a download for anything it will not render inline', async () => {
        // Never frame foreign HTML or SVG on our own origin — that is a phishing
        // host, not a preview.
        globalThis.__authFetch = vi.fn(async () => blobResponse('text/html'));
        const { container, getByText } = renderPreview({ ...STUDIO, mime: 'text/html', name: 'evil.html' });
        await waitFor(() => expect(getByText('Download')).toBeTruthy());
        expect(container.querySelector('iframe')).toBeNull();
        expect(container.querySelector('img')).toBeNull();
    });

    it('hands a generated CSV over as a named download', async () => {
        // The generate_file step's descriptor lands here: a CSV is never
        // framed inline, so the download card — carrying the exact filename
        // the portal expects — is the whole delivery mechanism.
        globalThis.__authFetch = vi.fn(async () => blobResponse('text/csv'));
        const { container, getByText } = renderPreview({ kind: 'studio_attachment', fileId: 'f9', name: 'PO19443.csv', mime: 'text/csv', size: 512 });
        await waitFor(() => expect(getByText('Download')).toBeTruthy());
        expect(container.querySelector('iframe')).toBeNull();
        const link = getByText('Download').closest('a');
        expect(link.getAttribute('download')).toBe('PO19443.csv');
        expect(link.getAttribute('href')).toMatch(/^blob:/);
    });

    it('redeems a mailbox attachment before showing it', async () => {
        const calls = [];
        globalThis.__authFetch = vi.fn(async (url, opts) => {
            calls.push({ url, method: opts?.method || 'GET' });
            if (String(url).includes('/materialize')) {
                return { ok: true, status: 200, json: async () => ({ success: true, attachment: STUDIO }) };
            }
            return blobResponse('application/pdf');
        });

        const { container } = renderPreview(PENDING);
        await waitFor(() => expect(container.querySelector('iframe')).toBeTruthy());

        expect(calls[0].method).toBe('POST');
        expect(calls[0].url).toContain('/materialize');
        expect(calls[1].url).toContain('/data/attachments/f1');
    });

    it('explains a 404 as access, and Try again re-fetches', async () => {
        globalThis.__authFetch = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }));
        const { getByText } = renderPreview(STUDIO);
        await waitFor(() => expect(getByText('You do not have access to this file.')).toBeTruthy());

        globalThis.__authFetch.mockClear();
        fireEvent.click(getByText('Try again'));
        await waitFor(() => expect(globalThis.__authFetch).toHaveBeenCalled());
    });

    it('releases the object URL on unmount', async () => {
        const { container, unmount } = renderPreview(STUDIO);
        await waitFor(() => expect(container.querySelector('iframe')).toBeTruthy());
        unmount();
        expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
    });

    it('fetches nothing at all while designing', async () => {
        const { getByText } = renderPreview(STUDIO, { mode: 'edit' });
        expect(getByText('invoice.pdf')).toBeTruthy();
        expect(globalThis.__authFetch).not.toHaveBeenCalled();
    });

    it('uses no purple', async () => {
        const { container } = renderPreview(STUDIO);
        await waitFor(() => expect(container.querySelector('iframe')).toBeTruthy());
        expect(container.innerHTML).not.toMatch(/indigo|violet|purple/i);
    });
});

describe('descriptor shapes', () => {
    it('parses a descriptor stored as JSON text', async () => {
        // A `file` column IS json text and nothing parses it on the read path,
        // so a records binding hands this component a string. Treating that as a
        // legacy URL rendered a "filename" of `pdf\",\"size\":231504,…` — the
        // tail of the JSON, split on a slash.
        const { container } = renderPreview(JSON.stringify(STUDIO));
        await waitFor(() => expect(container.querySelector('iframe')).toBeTruthy());
        expect(globalThis.__authFetch.mock.calls[0][0]).toContain('/data/attachments/f1');
    });

    it('takes the first of an array stored as JSON text', async () => {
        const { container } = renderPreview(JSON.stringify([STUDIO]));
        await waitFor(() => expect(container.querySelector('iframe')).toBeTruthy());
    });

    it('still treats a bare URL as a bare URL', () => {
        const { getByText } = renderPreview('https://example.test/a.pdf', { mode: 'edit' });
        expect(getByText('a.pdf')).toBeTruthy();
    });
});

describe('firstDescriptor — the encoding contract', () => {
    const descriptor = { kind: 'mailbox_attachment', attachmentId: 'a1', messageId: 'm1', name: 'factuur.pdf' };

    it('unwraps a DOUBLE-encoded descriptor (legacy rows)', () => {
        // Rows written while the connector pre-stringified descriptors are JSON
        // text whose first parse yields ANOTHER string. One parse returned that
        // string, nothing downstream saw a descriptor, and the preview never
        // even asked the server for the bytes — the "cannot open the PDF" bug.
        expect(firstDescriptor(JSON.stringify(JSON.stringify(descriptor)))).toEqual(descriptor);
    });

    it('keeps working on every shape it already accepted', () => {
        expect(firstDescriptor(descriptor)).toEqual(descriptor);
        expect(firstDescriptor(JSON.stringify(descriptor))).toEqual(descriptor);
        expect(firstDescriptor([descriptor])).toEqual(descriptor);
        expect(firstDescriptor(JSON.stringify([descriptor]))).toEqual(descriptor);
        expect(firstDescriptor('https://example.com/file.pdf')).toBe('https://example.com/file.pdf'); // legacy URL
        expect(firstDescriptor(null)).toBeNull();
        expect(firstDescriptor('')).toBeNull();
    });
});
