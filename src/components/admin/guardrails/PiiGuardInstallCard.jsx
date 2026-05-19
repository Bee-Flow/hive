import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, CheckCircle, AlertTriangle, XCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import { showToast } from './Toast';

const POLL_FAST_MS = 2000;
const POLL_SLOW_MS = 30000;

const STATUS_META = {
    'not-installed': { label: 'Not installed', tone: 'neutral', Icon: Shield },
    'installing':    { label: 'Installing…',   tone: 'busy',    Icon: Loader2 },
    'running':       { label: 'Running',       tone: 'good',    Icon: CheckCircle },
    'unhealthy':     { label: 'Unhealthy',     tone: 'bad',     Icon: AlertTriangle },
    'uninstalling':  { label: 'Uninstalling…', tone: 'busy',    Icon: Loader2 },
    'error':         { label: 'Error',         tone: 'bad',     Icon: XCircle },
};

const TONE_CLASSES = {
    neutral: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-secondary)]',
    busy:    'bg-amber-500/15 text-amber-600 border-amber-500/30',
    good:    'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    bad:     'bg-red-500/15 text-red-600 border-red-500/30',
};

export default function PiiGuardInstallCard() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const pollTimerRef = useRef(null);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/admin/guard/status`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setStatus(data);
            return data;
        } catch (err) {
            setStatus({ status: 'error', lastError: err.message, url: null, health: null, kubernetes: false });
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const tick = async () => {
            const data = await fetchStatus();
            if (cancelled) return;
            const interval = (data?.status === 'installing' || data?.status === 'uninstalling')
                ? POLL_FAST_MS
                : POLL_SLOW_MS;
            pollTimerRef.current = setTimeout(tick, interval);
        };
        tick();
        return () => {
            cancelled = true;
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        };
    }, [fetchStatus]);

    const handleInstall = async () => {
        setSubmitting(true);
        try {
            const body = {};
            if (apiKey) body.apiKey = apiKey;
            if (model) body.model = model;
            const res = await authFetch(`${API_BASE}/api/admin/guard/install`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${res.status}`);
            }
            showToast('Install started — this can take up to a minute while the model loads.', 'info');
            // Trigger an immediate status refresh so the badge flips to "installing".
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
            fetchStatus();
        } catch (err) {
            showToast(`Install failed: ${err.message}`, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUninstall = async () => {
        if (!window.confirm('Uninstall PII Guard?\n\nPII detection will be disabled until the guard is reinstalled — there is no fallback detector. The Redis cache volume is preserved (use the API with removeVolume to wipe it).')) {
            return;
        }
        setSubmitting(true);
        try {
            const res = await authFetch(`${API_BASE}/api/admin/guard/uninstall`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${res.status}`);
            }
            showToast('Uninstall started.', 'info');
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
            fetchStatus();
        } catch (err) {
            showToast(`Uninstall failed: ${err.message}`, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 mb-4 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading PII Guard status…
            </div>
        );
    }

    const current = status?.status || 'not-installed';
    const meta = STATUS_META[current] || STATUS_META['not-installed'];
    const StatusIcon = meta.Icon;
    const toneClass = TONE_CLASSES[meta.tone];
    // Install/uninstall lifecycle is owned by Docker. Only Kubernetes deploys
    // hand off to an external orchestrator (the Kapsule manifest).
    const isManaged = status?.kubernetes === true;
    const inProgress = current === 'installing' || current === 'uninstalling';
    const canInstall = !isManaged && (current === 'not-installed' || current === 'error');
    const canUninstall = !isManaged && (current === 'running' || current === 'unhealthy');

    return (
        <div className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 mb-4">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-4 h-4 text-[var(--accent-primary)]" />
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">PII Guard service</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${toneClass}`}>
                            <StatusIcon className={`w-3 h-3 ${meta.tone === 'busy' ? 'animate-spin' : ''}`} />
                            {meta.label}
                        </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        Multilingual PII detector (GLiNER) with a Redis-backed decision cache. <strong>Required for
                        PII detection</strong> — without it, the Privacy Shield&apos;s PII features are inactive.
                        Runs locally on your server; no chat content leaves your infrastructure. Apache-licensed model
                        (E3-JSI/gliner-multi-pii-domains-v1) covers names, emails, IBAN, BSN / national IDs, tax IDs,
                        medical conditions, medications, and more, with Dutch and 8 other languages fine-tuned.
                    </p>
                    {status?.url && (
                        <p className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">{status.url}</p>
                    )}
                </div>

                {!isManaged && (
                    <div className="flex flex-col gap-2 shrink-0">
                        {canInstall && (
                            <button
                                type="button"
                                onClick={handleInstall}
                                disabled={submitting || inProgress}
                                className="px-3 py-1.5 rounded-md bg-[var(--accent-primary)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Install
                            </button>
                        )}
                        {canUninstall && (
                            <button
                                type="button"
                                onClick={handleUninstall}
                                disabled={submitting || inProgress}
                                className="px-3 py-1.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-secondary)] text-xs font-medium hover:bg-[var(--bg-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Uninstall
                            </button>
                        )}
                        {inProgress && (
                            <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" /> Working…
                            </span>
                        )}
                    </div>
                )}
            </div>

            {inProgress && status?.progress && (
                <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[var(--text-muted)]">
                            {status.progress.message || 'Working…'}
                        </span>
                        {typeof status.progress.percent === 'number' && (
                            <span className="text-xs font-mono text-[var(--text-muted)]">
                                {Math.round(status.progress.percent)}%
                            </span>
                        )}
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                        {typeof status.progress.percent === 'number' ? (
                            <div
                                className="h-full bg-[var(--accent-primary)] transition-[width] duration-300 ease-out"
                                style={{ width: `${Math.max(2, Math.min(100, status.progress.percent))}%` }}
                            />
                        ) : (
                            // Indeterminate: animated stripe that traverses the track.
                            <div className="h-full w-1/3 bg-[var(--accent-primary)] animate-[pii-guard-indeterminate_1.4s_ease-in-out_infinite]" />
                        )}
                    </div>
                    <style>{`
                        @keyframes pii-guard-indeterminate {
                            0%   { transform: translateX(-100%); }
                            100% { transform: translateX(400%); }
                        }
                    `}</style>
                </div>
            )}

            {isManaged && (
                <div className="mt-3 px-3 py-2 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] text-xs text-[var(--text-muted)]">
                    Lifecycle managed by the Kubernetes manifest (deploy/scaleway-kapsule). Status only — install/uninstall not available from this UI.
                </div>
            )}

            {status?.lastError && (
                <div className="mt-3 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-xs text-red-600">
                    <strong>Last error:</strong> {status.lastError}
                </div>
            )}

            {canInstall && (
                <div className="mt-3">
                    <button
                        type="button"
                        onClick={() => setAdvancedOpen(o => !o)}
                        className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                        {advancedOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        Advanced
                    </button>
                    {advancedOpen && (
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <label className="text-xs text-[var(--text-muted)]">
                                API key (optional)
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Leave blank for unauthenticated"
                                    className="mt-1 w-full px-2 py-1 rounded border border-[var(--border-secondary)] bg-[var(--bg-primary)] text-xs text-[var(--text-primary)]"
                                />
                            </label>
                            <label className="text-xs text-[var(--text-muted)]">
                                Model override
                                <input
                                    type="text"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    placeholder="E3-JSI/gliner-multi-pii-domains-v1"
                                    className="mt-1 w-full px-2 py-1 rounded border border-[var(--border-secondary)] bg-[var(--bg-primary)] text-xs text-[var(--text-primary)]"
                                />
                            </label>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
