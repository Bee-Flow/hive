import { Loader2, CheckCircle, XCircle, AlertTriangle, StopCircle, ExternalLink, MousePointerClick, Terminal as TerminalIcon } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
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
    const { status, progressLines, severitySummary, reportWebpageId, error, closed, actionLog, currentAction, scanStat, terminalLines } = useScanRunEvents(scanId);
    const [cancelling, setCancelling] = useState(false);

    const isFinal = ['completed', 'error', 'cancelled'].includes(status);
    const isAgentRun = actionLog.length > 0 || !!scanStat || terminalLines.length > 0;

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
                {!isFinal && isAgentRun && (
                    <AgentScanLiveView
                        actionLog={actionLog}
                        currentAction={currentAction}
                        scanStat={scanStat}
                        terminalLines={terminalLines}
                        progressLines={progressLines}
                        isFinal={isFinal}
                    />
                )}

                {!isFinal && !isAgentRun && (
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

const SCAN_PHASE_LABELS = {
    spider: 'Spidering',
    passive: 'Passive scan',
    active: 'Active scan',
    nuclei: 'Nuclei',
    testssl: 'TLS audit',
    analyze: 'Analyzing',
};

/**
 * AgentScanLiveView — split live view for an AI-driven scan. The left column
 * shows the agent's action timeline and console; the right column stacks a
 * live-scan stats panel and a sandboxed terminal stream. Mirrors the Tests
 * Studio AgentLiveView layout (no live browser frame — scans are headless).
 */
function AgentScanLiveView({ actionLog, currentAction, scanStat, terminalLines, progressLines, isFinal }) {
    return (
        <div className="grid grid-cols-[minmax(300px,42%)_1fr] gap-4 h-full min-h-0">
            <div className="flex flex-col gap-3 min-h-0">
                <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Agent actions</h4>
                    <div className="text-xs bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded max-h-48 overflow-y-auto">
                        {actionLog.length === 0
                            ? <div className="px-3 py-2 italic text-[var(--text-tertiary)]">Agent is thinking…</div>
                            : actionLog.map((a, i) => (
                                <div key={i} className="px-3 py-1.5 border-b border-[var(--border-default)] last:border-b-0 flex items-start gap-2">
                                    <MousePointerClick size={11} className="mt-0.5 text-[var(--text-tertiary)] flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="font-mono text-[10px] text-[var(--text-secondary)]">
                                            {a.step}. {a.tool}
                                        </div>
                                        <div className="text-[10px] text-[var(--text-tertiary)] truncate">
                                            {a.summary || summarizeInput(a.input)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
                <div className="flex-1 min-h-0">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Console</h4>
                    <div className="font-mono text-[10px] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded p-2 h-full overflow-y-auto whitespace-pre-wrap">
                        {progressLines.length === 0
                            ? <span className="text-[var(--text-tertiary)] italic">Waiting…</span>
                            : progressLines.slice(-50).map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-3 min-h-0">
                <LiveScanPanel scanStat={scanStat} currentAction={currentAction} isFinal={isFinal} />
                <LiveTerminal terminalLines={terminalLines} />
            </div>
        </div>
    );
}

function LiveScanPanel({ scanStat, isFinal }) {
    const phase = scanStat?.phase;
    const phaseLabel = (phase && SCAN_PHASE_LABELS[phase]) || phase || 'Initializing';
    return (
        <div className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Live scan</h4>
                <span className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-secondary)]">
                    {!isFinal && <Loader2 className="animate-spin" size={10} />}
                    {phaseLabel}
                </span>
            </div>
            <div className="flex items-center gap-4">
                <div className="rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-center min-w-[88px]">
                    <div className="text-2xl font-semibold text-[var(--text-primary)]">{scanStat?.crawledUrls ?? 0}</div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">URLs crawled</div>
                </div>
                <div className="flex-1 min-w-0">
                    <SeveritySummary summary={scanStat?.alerts || { high: 0, medium: 0, low: 0, informational: 0 }} />
                </div>
            </div>
            <div className="text-[11px] italic text-[var(--text-tertiary)] truncate">
                {scanStat?.current || 'Waiting for first scan update…'}
            </div>
        </div>
    );
}

function LiveTerminal({ terminalLines }) {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, [terminalLines.length]);

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <h4 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                <TerminalIcon size={11} /> Terminal
            </h4>
            <div
                ref={ref}
                className="font-mono text-[11px] bg-[#0b0e14] text-slate-200 rounded border border-[var(--border-default)] p-3 max-h-72 overflow-y-auto"
            >
                {terminalLines.length === 0
                    ? <span className="text-slate-500 italic">No terminal output yet.</span>
                    : terminalLines.map((entry, i) => {
                        if (entry.kind === 'command') {
                            return <div key={i} className="text-emerald-400 whitespace-pre-wrap break-all">$ {entry.command}</div>;
                        }
                        if (entry.kind === 'exit') {
                            return <div key={i} className="text-slate-500">↳ exit {entry.exitCode}</div>;
                        }
                        return (
                            <div
                                key={i}
                                className={`whitespace-pre-wrap break-words ${entry.stream === 'stderr' ? 'text-red-400' : 'text-slate-200'}`}
                            >
                                {entry.chunk}
                            </div>
                        );
                    })}
            </div>
        </div>
    );
}

function summarizeInput(input) {
    if (!input || typeof input !== 'object') return '';
    const parts = [];
    if (input.url) parts.push(input.url);
    if (input.role || input.name) parts.push(`${input.role || ''}:${input.name || ''}`.replace(/^:|:$/, ''));
    if (input.selector) parts.push(input.selector);
    if (input.text) parts.push(`"${String(input.text).slice(0, 40)}"`);
    if (input.summary) parts.push(`— ${String(input.summary).slice(0, 60)}`);
    return parts.join(' ').slice(0, 120);
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
