import { Download, FileText, Loader2, RotateCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { API_BASE, authFetch } from '../../../../../../utils/helpers';
import { useDataContext } from '../DataContext';
import { resolveBinding } from '../resolveBinding';
import { useRuntime } from '../RuntimeContext';
import { isFill } from '../styleResolver';
import { EmptyText } from '../uiBits';
import { entryHref, entryName } from './AppInputFile';

/**
 * App Studio runtime — 'file_preview'. Spec: server/appStudio/componentSpecs.js.
 *
 * Named for FILES, not PDFs: a `file` column holds whatever arrived, and a
 * component that only handled PDFs would leave images and documents as a dead
 * end in the one place people look for them.
 *
 * WHY A BLOB URL AND NOT `<iframe src={API_BASE}/…>`, which would be simpler:
 *   • authFetch is the demo-mode choke point (utils/helpers setDemoTransport).
 *     A raw iframe src bypasses it entirely and turns an anonymous demo click
 *     into a real authenticated API call.
 *   • In the Nextcloud embedding API_BASE is a different origin behind the
 *     AppAPI proxy, where `frame-src 'self'` blocks it — and third-party cookie
 *     blocking would break the session anyway.
 * The same-origin blob is already CSP-legal in production (`frame-src blob:`,
 * added for the invoice viewer) and needs no nginx change.
 *
 * A mailbox attachment arrives as a PENDING descriptor pointing at the provider.
 * The first view redeems it (POST …/attachments/materialize) and it becomes an
 * ordinary stored file; every later view short-circuits server-side.
 */

const PREVIEWABLE_IMAGE = /^image\/(png|jpeg|gif|webp)$/i;

function friendlyError(status, message) {
    if (status === 404) return 'You do not have access to this file.';
    if (status === 403) return 'You do not have access to this file.';
    if (status === 409) return "This app's file storage is full — ask the owner to clean up.";
    if (status === 413) return 'That file is too large to open here.';
    if (status === 415) return 'That file type cannot be shown.';
    if (status === 422) return 'That file did not pass the malware scan.';
    return message || 'Could not open this file.';
}

/**
 * The first descriptor a binding resolved to — one file, no carousel.
 *
 * A `file` column is stored as JSON TEXT and nothing parses it on the read
 * path, so a records binding hands this component the raw string. Treating that
 * as a legacy URL is what rendered a filename like
 * `pdf\",\"size\":231504,\"isInline\":false}` — the tail of the JSON, split on
 * a slash.
 */
export function firstDescriptor(value) {
    let v = Array.isArray(value) ? value[0] : value;
    if (!v) return null;
    // Bounded unwrap, not a single parse: rows written while the connector
    // pre-stringified descriptors are DOUBLE-encoded — text starting with `"`
    // whose first parse yields another string. One parse returned that string,
    // nothing downstream saw a descriptor, and the preview never even asked
    // the server for the bytes.
    for (let i = 0; i < 3 && typeof v === 'string'; i++) {
        const s = v.trim();
        if (!s.startsWith('{') && !s.startsWith('[') && !s.startsWith('"')) {
            return s;                                   // legacy bare URL
        }
        try {
            const parsed = JSON.parse(s);
            v = Array.isArray(parsed) ? parsed[0] : parsed;
        } catch { return s; }                           // not JSON → legacy bare URL
    }
    return (v && typeof v === 'object') ? v : null;
}

const CENTERED = 'flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center';
const SMALL_BUTTON = 'inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-xs';
const BUTTON_STYLE = { borderColor: 'var(--border-default)', borderRadius: 'var(--app-radius)', color: 'var(--text-secondary)' };

/** Editing shows the shape without spending a request. */
function DesignPlaceholder({ name }) {
    return (
        <div className={`${CENTERED} gap-2`} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
            <FileText className="h-6 w-6" aria-hidden="true" />
            <span className="text-xs">{name}</span>
        </div>
    );
}

function Spinner() {
    return (
        <div className="flex h-full w-full items-center justify-center p-6" style={{ color: 'var(--text-muted)' }}>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
    );
}

function ErrorState({ message, onRetry }) {
    return (
        <div className={CENTERED}>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{message}</span>
            <button type="button" onClick={onRetry} className={SMALL_BUTTON} style={BUTTON_STYLE}>
                <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                Try again
            </button>
        </div>
    );
}

/**
 * The fallback for every type we will not render inline. Framing foreign HTML
 * or SVG on our own origin would make the app a phishing host, so unknown types
 * are downloads and nothing else.
 */
function DownloadCard({ name, url, allowDownload }) {
    return (
        <div className={CENTERED}>
            <FileText className="h-6 w-6" aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{name}</span>
            {allowDownload ? (
                <a href={url} download={name} className={SMALL_BUTTON} style={BUTTON_STYLE}>
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Download
                </a>
            ) : null}
        </div>
    );
}

export default function AppFilePreview({ node }) {
    const { mode, actionState, dataState, scope } = useRuntime();
    const { appId } = useDataContext();
    const { emptyText = 'No document selected.', allowDownload = true } = node.props || {};
    const { value } = resolveBinding(node.props?.source, { actionState, dataState, scope });

    const descriptor = firstDescriptor(value);
    const [state, setState] = useState({ status: 'idle', url: null, mime: null, name: null, error: null });
    const [attempt, setAttempt] = useState(0);
    const urlRef = useRef(null);

    // The identity of the file being shown — a plain string so the effect does
    // not re-run on every render just because the descriptor object is new.
    const key = descriptor
        ? (typeof descriptor === 'string'
            ? descriptor
            : `${descriptor.kind}:${descriptor.fileId || descriptor.attachmentId || ''}:${descriptor.recordId || ''}`)
        : null;

    // Editing must never fetch. The canvas re-renders on every keystroke, and a
    // fetch here would hammer the read limiter and, in a demo, leak real calls.
    const live = mode === 'run' && !!appId;

    useEffect(() => {
        if (!live || !descriptor) { setState({ status: 'idle', url: null, mime: null, name: null, error: null }); return undefined; }

        let alive = true;
        const revoke = () => { if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; } };

        (async () => {
            revoke();
            setState({ status: 'loading', url: null, mime: null, name: null, error: null });
            try {
                let entry = descriptor;

                // A pending mailbox pointer has no bytes of its own yet.
                if (entry && typeof entry === 'object' && entry.kind === 'mailbox_attachment') {
                    const res = await authFetch(
                        `${API_BASE}/api/studio-apps/${encodeURIComponent(appId)}/data/attachments/materialize`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            // The provider's id is all the server needs — it
                            // finds the row itself, under this viewer's own read
                            // access. The descriptor cannot carry a recordId:
                            // the connector writes it before the row has one.
                            body: JSON.stringify({ attachmentId: entry.attachmentId }),
                        },
                    );
                    const body = await res.json().catch(() => null);
                    if (!res.ok) throw Object.assign(new Error(body?.error || ''), { status: res.status });
                    entry = body?.attachment;
                }

                const href = entryHref(entry, appId);
                if (!href) throw Object.assign(new Error('That file cannot be opened.'), { status: 415 });

                const res = await authFetch(href);
                if (!res.ok) throw Object.assign(new Error(''), { status: res.status });
                const blob = await res.blob();
                if (!alive) return;

                const url = URL.createObjectURL(blob);
                urlRef.current = url;
                setState({
                    status: 'ready',
                    url,
                    mime: (entry && entry.mime) || blob.type || 'application/octet-stream',
                    name: entryName(entry),
                    error: null,
                });
            } catch (err) {
                if (!alive) return;
                setState({ status: 'error', url: null, mime: null, name: null, error: friendlyError(err.status, err.message) });
            }
        })();

        return () => { alive = false; revoke(); };
    }, [live, key, attempt, appId]); // eslint-disable-line react-hooks/exhaustive-deps

    const fill = isFill(node);
    const shell = (children) => (
        <div
            className={`w-full min-w-0 overflow-hidden${fill ? ' app-fill flex flex-col h-full min-h-0' : ''}`}
            style={{ borderRadius: 'inherit', ...(fill ? null : { minHeight: '24rem' }) }}
            data-app-filepreview={state.status}
        >
            {children}
        </div>
    );

    if (!descriptor) return shell(<EmptyText text={emptyText} />);

    if (!live) return shell(<DesignPlaceholder name={entryName(descriptor)} />);
    if (state.status === 'loading' || state.status === 'idle') return shell(<Spinner />);
    if (state.status === 'error') return shell(<ErrorState message={state.error} onRetry={() => setAttempt((n) => n + 1)} />);

    const isPdf = state.mime === 'application/pdf';
    const isImage = PREVIEWABLE_IMAGE.test(state.mime || '');

    // Anything we cannot vouch for renders as a link, never inline. Foreign HTML
    // or SVG in an iframe on our own origin is a phishing host waiting to happen.
    // Anything we cannot vouch for is a link, never inline.
    if (!isPdf && !isImage) {
        return shell(<DownloadCard name={state.name} url={state.url} allowDownload={allowDownload} />);
    }

    return shell(
        <>
            {allowDownload ? (
                <div className="flex shrink-0 items-center justify-between gap-2 px-2 py-1.5">
                    <span className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{state.name}</span>
                    <a
                        href={state.url}
                        download={state.name}
                        aria-label={`Download ${state.name}`}
                        className="inline-flex shrink-0 items-center gap-1 text-xs"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                </div>
            ) : null}
            {isPdf ? (
                <iframe
                    title={state.name || 'Document'}
                    src={state.url}
                    className={`w-full border-0${fill ? ' flex-1 min-h-0' : ' h-full min-h-[20rem]'}`}
                />
            ) : (
                <img
                    src={state.url}
                    alt={state.name || ''}
                    className={`w-full${fill ? ' flex-1 min-h-0' : ' h-full'}`}
                    style={{ objectFit: 'contain' }}
                />
            )}
        </>,
    );
}
