import { Plus, ShieldCheck, StopCircle, Loader2, Bot } from 'lucide-react';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import ScanModal from './ScanModal';
import ScanResults from './ScanResults';
import { SeverityChips } from './severity';
import useTranslation from '../../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import StudioShell from '../../../shared/StudioShell';
import { StatusDot } from '../TestsStudio/InsightsDashboard';

/**
 * SecurityStudio — Studio tab for AI-agent security scans. The agent (on the
 * selected model tier) drives a full pentest toolbox inside one isolated
 * container; this surface starts scans,
 * lists them, and renders the live run + report.
 *
 * Backend contract: /api/security/* (gated by security_scan license + beta).
 */
export default function SecurityStudio({ user, onNavigate, hasPermission, modelTiers: modelTiersProp = {} }) {
    const { t } = useTranslation();

    const [activeScans, setActiveScans] = useState([]);
    const [finishedScans, setFinishedScans] = useState([]); // client-retained history
    const [showScanModal, setShowScanModal] = useState(false);
    const [activeScanId, setActiveScanId] = useState(null);
    const [modelTiers, setModelTiers] = useState(modelTiersProp);
    const [policy, setPolicy] = useState(null);
    const prevActiveIds = useRef(new Set());

    // Tiers: prefer the prop; otherwise self-fetch (mirrors AgentEditorUI).
    useEffect(() => {
        if (modelTiersProp && Object.keys(modelTiersProp).length) { setModelTiers(modelTiersProp); return; }
        let alive = true;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/ai/config/tiers-for-user?taskType=direct_chat`);
                if (res.ok && alive) {
                    setModelTiers((await res.json()) || {});
                }
            } catch (_) { /* selector falls back to the default model */ }
        })();
        return () => { alive = false; };
    }, [modelTiersProp]);

    // Aggression policy (levels + ceiling) so the wizard can lock above-ceiling levels.
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/security/scans/policy`);
                if (res.ok && alive) setPolicy(await res.json());
            } catch (_) { /* wizard falls back to defaults */ }
        })();
        return () => { alive = false; };
    }, []);

    const fetchActiveScans = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/security/scans/active`);
            if (!res.ok) return;
            const data = await res.json();
            const scans = data.scans || (data.scan ? [data.scan] : []);
            setActiveScans(scans);

            // Any scan that dropped out of the active set since the last poll has
            // gone terminal — fetch it once and keep it in client-side history
            // (there is no finished-scan list endpoint yet).
            const nowIds = new Set(scans.map((s) => s.id));
            const vanished = [...prevActiveIds.current].filter((id) => !nowIds.has(id));
            prevActiveIds.current = nowIds;
            for (const id of vanished) {
                authFetch(`${API_BASE}/api/security/scans/${encodeURIComponent(id)}`)
                    .then((r) => (r.ok ? r.json() : null))
                    .then((d) => {
                        const s = d?.scan;
                        if (s && ['completed', 'error', 'cancelled'].includes(s.status)) {
                            setFinishedScans((prev) => [s, ...prev.filter((p) => p.id !== s.id)].slice(0, 30));
                        }
                    })
                    .catch(() => {});
            }
        } catch (_) { /* ignore */ }
    }, []);

    // Poll in-flight scans so several concurrent scans stay live in the sidebar.
    useEffect(() => {
        fetchActiveScans();
        const id = setInterval(fetchActiveScans, 5000);
        return () => clearInterval(id);
    }, [fetchActiveScans]);

    const cancelScan = async (scan) => {
        if (!scan) return;
        if (!window.confirm('Cancel the running scan? Any progress so far is kept.')) return;
        const res = await authFetch(`${API_BASE}/api/security/scans/${encodeURIComponent(scan.id)}/cancel`, { method: 'POST' });
        if (res.ok || res.status === 409) {
            if (activeScanId === scan.id) setActiveScanId(null);
            fetchActiveScans();
        } else {
            const data = await res.json().catch(() => ({}));
            window.alert(data?.message || data?.error || 'Failed to cancel');
        }
    };

    const startScan = async ({ targetUrl, engines, authorized, modelTier, aggression, stepBudget, prewarmId }) => {
        const res = await authFetch(`${API_BASE}/api/security/scans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                targetUrl, engines, authorized,
                modelTier, aggression, prewarmId,
                metadata: Number.isFinite(stepBudget) ? { stepBudget } : undefined,
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || data?.error || 'failed_to_start');
        setShowScanModal(false);
        setActiveScanId(data.scanId);
        fetchActiveScans();
    };

    const running = activeScans.filter((r) => r.status === 'running');
    const queued = activeScans.filter((r) => r.status === 'queued');
    const inProgress = [...running, ...queued];
    // History excludes anything still in the active list.
    const activeIds = new Set(activeScans.map((s) => s.id));
    const history = finishedScans.filter((s) => !activeIds.has(s.id));

    return (
        <>
            <StudioShell
                sidebarTitle={(
                    <span className="flex items-center gap-2">
                        {t('security_studio.title') || 'Security'}
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">Beta</span>
                    </span>
                )}
                sidebarActions={(
                    <button
                        onClick={() => setShowScanModal(true)}
                        className="p-1 rounded hover:bg-[var(--bg-secondary)]"
                        title="New security scan"
                    >
                        <Plus size={14} />
                    </button>
                )}
                sidebar={(
                    <div className="flex flex-col gap-3 p-3">
                        <button
                            onClick={() => setShowScanModal(true)}
                            className="flex items-center gap-2 text-xs px-3 py-2 rounded border border-dashed border-[var(--border-default)] hover:border-[var(--accent-primary)] text-[var(--text-secondary)]"
                        >
                            <Plus size={12} /> New scan
                        </button>

                        {inProgress.length > 0 && (
                            <div>
                                <SectionHeader label={`In progress${queued.length ? ` · ${queued.length} queued` : ''}`} spinning />
                                <div className="flex flex-col gap-1.5">
                                    {inProgress.map((scan) => (
                                        <ScanCard
                                            key={scan.id}
                                            scan={scan}
                                            selected={activeScanId === scan.id}
                                            onSelect={() => setActiveScanId(scan.id)}
                                            onCancel={() => cancelScan(scan)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <SectionHeader label="History" />
                            {history.length === 0 && inProgress.length === 0 ? (
                                <div className="text-xs text-[var(--text-tertiary)] italic px-1">
                                    {t('security_studio.no_scans') || 'No scans yet — start one with the + button.'}
                                </div>
                            ) : history.length === 0 ? (
                                <div className="text-[11px] text-[var(--text-tertiary)] italic px-1">Finished scans appear here.</div>
                            ) : (
                                <div className="flex flex-col gap-1.5">
                                    {history.map((scan) => (
                                        <ScanCard
                                            key={scan.id}
                                            scan={scan}
                                            selected={activeScanId === scan.id}
                                            onSelect={() => setActiveScanId(scan.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            >
                {activeScanId ? (
                    <ScanResults
                        scanId={activeScanId}
                        onClose={() => { setActiveScanId(null); fetchActiveScans(); }}
                        onCancelled={() => { fetchActiveScans(); }}
                    />
                ) : (
                    <EmptyState onCreate={() => setShowScanModal(true)} />
                )}
            </StudioShell>

            {showScanModal && (
                <ScanModal
                    onClose={() => setShowScanModal(false)}
                    onStart={startScan}
                    modelTiers={modelTiers}
                    policy={policy}
                />
            )}
        </>
    );
}

function SectionHeader({ label, spinning }) {
    return (
        <h4 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5 px-1">
            {spinning && <Loader2 className="animate-spin" size={10} />}
            {label}
        </h4>
    );
}

function hostnameOf(url) {
    try { return new URL(url).hostname; } catch { return url || 'scan'; }
}

function relativeTime(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return '';
    const s = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.round(h / 24)}d`;
}

function ScanCard({ scan, selected, onSelect, onCancel }) {
    const inFlight = scan.status === 'running' || scan.status === 'queued';
    const when = scan.finishedAt || scan.createdAt;
    return (
        <button
            onClick={onSelect}
            className={`text-left text-xs px-3 py-2 rounded border ${selected
                ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                : 'border-transparent hover:bg-[var(--bg-secondary)]'}`}
        >
            <div className="flex items-center gap-1.5">
                <StatusDot status={scan.status} />
                <span className="font-medium truncate flex-1 text-[var(--text-primary)]">{hostnameOf(scan.targetUrl)}</span>
                <span className="text-[9px] uppercase tracking-wider px-1 py-px rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] flex items-center gap-0.5">
                    <Bot size={9} /> Agent
                </span>
                {inFlight && onCancel && (
                    <span
                        onClick={(e) => { e.stopPropagation(); onCancel(); }}
                        className="p-0.5 rounded text-red-500 hover:bg-red-500/10"
                        title="Cancel scan"
                    >
                        <StopCircle size={11} />
                    </span>
                )}
            </div>
            <div className="flex items-center justify-between gap-2 mt-1">
                {scan.status === 'completed'
                    ? <SeverityChips summary={scan.severitySummary} />
                    : <span className="text-[10px] text-[var(--text-tertiary)] capitalize">{scan.status}</span>}
                <span className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">{relativeTime(when)}</span>
            </div>
        </button>
    );
}

function EmptyState({ onCreate }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center gap-3 p-8">
            <ShieldCheck size={32} className="text-[var(--text-tertiary)]" />
            <div className="text-sm font-semibold text-[var(--text-secondary)]">No scan selected</div>
            <div className="text-xs text-[var(--text-tertiary)] max-w-sm">
                Start an authorized security scan against a target URL. An AI agent drives a full
                pentest toolbox inside one isolated container and produces a severity-graded report.
            </div>
            <button
                onClick={onCreate}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded text-white font-medium"
                style={{ background: 'var(--accent-primary)' }}
            >
                <Plus size={12} /> New scan
            </button>
        </div>
    );
}
