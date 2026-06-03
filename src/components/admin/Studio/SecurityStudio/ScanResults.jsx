import { Loader2, CheckCircle, XCircle, AlertTriangle, StopCircle, ExternalLink } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import useScanRunEvents from './useScanRunEvents';
import WebpagePreview from '../../../../pages/webpages/WebpagePreview';
import { API_BASE, authFetch } from '../../../../utils/helpers';

/**
 * ScanResults — opens an SSE stream for the given scanId and renders progress
 * while the worker drives each engine container. While the scan runs we show a
 * single-column console (no live browser view — engines run headless). When it
 * finishes we show the severity summary and render the generated report INLINE
 * by fetching the report webpage and feeding its slots to the sandboxed
 * WebpagePreview, plus a link to open it in Webpages.
 */
export default function ScanResults({ scanId, onClose, onCancelled }) {
    const { status, progressLines, severitySummary, reportWebpageId, error, closed } = useScanRunEvents(scanId);
    const [cancelling, setCancelling] = useState(false);

    const isFinal = ['completed', 'error', 'cancelled'].includes(status);

    const cancel = async () => {
        if (cancelling || isFinal) return;
        if (!window.confirm('Cancel this scan? Any progress so far is kept in the report.')) return;
        setCancelling(true);
        try {
            const res = await authFetch(`${API_BASE}/api/security/scans/${encodeURIComponent(scanId)}/cancel`, { method: 'POST' });
            if (!res.ok && res.status !== 409) {
                const data = await res.json().catch(() => ({}));
                window.alert(data?.message || data?.error || 'Failed to cancel');
            }
            onCancelled?.();
        } finally {
            setCancelling(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-default)]">
                <div className="flex items-center gap-2">
                    {!isFinal && <Loader2 className="animate-spin" size={16} />}
                    {status === 'completed' && <CheckCircle size={16} className="text-emerald-500" />}
                    {status === 'error' && <AlertTriangle size={16} className="text-amber-500" />}
                    {status === 'cancelled' && <StopCircle size={16} className="text-[var(--text-tertiary)]" />}
                    <span className="text-sm font-semibold">
                        Scan {scanId.slice(0, 8)} — {status || 'starting…'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {!isFinal && (
                        <button
                            onClick={cancel}
                            disabled={cancelling}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-red-500/40 text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                            title="Cancel this scan"
                        >
                            <StopCircle size={12} /> {cancelling ? 'Cancelling…' : 'Cancel'}
                        </button>
                    )}
                    {onClose && (
                        <button onClick={onClose} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                            Close
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-1 min-h-0 overflow-hidden p-5 flex flex-col">
                {!isFinal && (
                    <div className="font-mono text-xs bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded p-3 max-h-64 overflow-y-auto whitespace-pre-wrap">
                        {progressLines.length === 0
                            ? <span className="text-[var(--text-tertiary)] italic">Waiting for output…</span>
                            : progressLines.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                )}

                {error && (
                    <div className="mt-4 text-sm text-[var(--danger)] bg-red-500/10 border border-red-500/40 rounded p-3">
                        {error}
                    </div>
                )}

                {isFinal && severitySummary && <SeveritySummary summary={severitySummary} />}

                {isFinal && reportWebpageId && (
                    <div className="mt-4 flex-1 min-h-0 flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold text-[var(--text-secondary)]">Report</h4>
                            <button
                                onClick={() => window.open(`/app/studio/webpages/${reportWebpageId}`, '_blank', 'noopener')}
                                className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                title="Open the report in Webpages"
                            >
                                <ExternalLink size={12} /> Open in Webpages
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 rounded border border-[var(--border-default)] overflow-hidden">
                            <ReportInline webpageId={reportWebpageId} />
                        </div>
                    </div>
                )}

                {isFinal && !reportWebpageId && (
                    <div className="mt-4 text-sm text-[var(--text-secondary)]">
                        Scan finished with status <strong>{status}</strong> but no report was produced.
                        {progressLines.length > 0 && (
                            <pre className="mt-2 font-mono text-xs bg-[var(--bg-secondary)] p-3 rounded max-h-64 overflow-y-auto whitespace-pre-wrap">{progressLines.join('\n')}</pre>
                        )}
                    </div>
                )}

                {closed && !isFinal && (
                    <div className="mt-4 text-xs text-[var(--text-tertiary)]">Connection closed.</div>
                )}
            </div>
        </div>
    );
}

const SEVERITY_META = {
    high: { label: 'High', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/40' },
    medium: { label: 'Medium', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/40' },
    low: { label: 'Low', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/40' },
    informational: { label: 'Info', color: 'text-[var(--text-secondary)]', bg: 'bg-[var(--bg-secondary)] border-[var(--border-default)]' },
};

function SeveritySummary({ summary }) {
    const order = ['high', 'medium', 'low', 'informational'];
    return (
        <div className="grid grid-cols-4 gap-2">
            {order.map((sev) => {
                const meta = SEVERITY_META[sev];
                const count = summary?.[sev] ?? 0;
                return (
                    <div key={sev} className={`rounded border p-3 text-center ${meta.bg}`}>
                        <div className={`text-xl font-semibold ${meta.color}`}>{count}</div>
                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{meta.label}</div>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * ReportInline — fetches the report webpage's slots and renders them in the
 * shared sandboxed WebpagePreview. The GET /api/webpages/:id handler returns
 * the three primary slots under `files` ({ html, css, js }); WebpagePreview
 * composes them into a single sandboxed document for us.
 */
function ReportInline({ webpageId }) {
    const [doc, setDoc] = useState(null);
    const [err, setErr] = useState(null);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/webpages/${encodeURIComponent(webpageId)}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (!alive) return;
                const files = data.files || {};
                setDoc({ html: files.html || '', css: files.css || '', js: files.js || '' });
            } catch (e) {
                if (alive) setErr(e.message || 'Failed to load report');
            }
        })();
        return () => { alive = false; };
    }, [webpageId]);

    if (err) {
        return (
            <div className="p-3 text-xs text-[var(--danger)] bg-red-500/10 h-full">
                Failed to load report: {err}
            </div>
        );
    }
    if (!doc) {
        return (
            <div className="flex items-center justify-center h-full text-xs text-[var(--text-tertiary)]">
                <Loader2 className="animate-spin mr-2" size={14} /> Loading report…
            </div>
        );
    }
    return <WebpagePreview webpageId={webpageId} html={doc.html} css={doc.css} js={doc.js} />;
}
