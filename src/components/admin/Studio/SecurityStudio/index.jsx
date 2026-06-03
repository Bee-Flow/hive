import { Plus, ShieldCheck, StopCircle, Eye, Loader2 } from 'lucide-react';
import React, { useEffect, useState, useCallback } from 'react';
import ScanModal from './ScanModal';
import ScanResults from './ScanResults';
import useTranslation from '../../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import StudioShell from '../../../shared/StudioShell';
import { StatusDot } from '../TestsStudio/InsightsDashboard';

/**
 * SecurityStudio — Studio tab for active security scans (ZAP / Nuclei /
 * testssl) run inside isolated containers.
 *
 * Backend contract: /api/security/* (gated by security_scan license + beta).
 */
export default function SecurityStudio({ user, onNavigate, hasPermission }) {
    const { t } = useTranslation();

    const [activeScans, setActiveScans] = useState([]);
    const [showScanModal, setShowScanModal] = useState(false);
    const [activeScanId, setActiveScanId] = useState(null);

    const fetchActiveScans = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/security/scans/active`);
            if (res.ok) {
                const data = await res.json();
                setActiveScans(data.scans || (data.scan ? [data.scan] : []));
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

    const startScan = async ({ targetUrl, engines, authorized }) => {
        const res = await authFetch(`${API_BASE}/api/security/scans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUrl, engines, authorized }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || data?.error || 'failed_to_start');
        setShowScanModal(false);
        setActiveScanId(data.scanId);
        fetchActiveScans();
    };

    const running = activeScans.filter(r => r.status === 'running');
    const queued = activeScans.filter(r => r.status === 'queued');

    const engineLabel = (scan) => (scan.engines || []).map(e => e.engine).join(', ') || 'scan';

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
                    <div className="flex flex-col gap-2 p-3">
                        <button
                            onClick={() => setShowScanModal(true)}
                            className="flex items-center gap-2 text-xs px-3 py-2 rounded border border-dashed border-[var(--border-default)] hover:border-[var(--accent-primary)] text-[var(--text-secondary)]"
                        >
                            <Plus size={12} /> New scan
                        </button>

                        {(running.length > 0 || queued.length > 0) && (
                            <div className="text-[11px] rounded border border-amber-500/40 bg-amber-500/10 p-2 flex flex-col gap-1.5">
                                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                                    <Loader2 className="animate-spin" size={11} />
                                    {running.length} running{queued.length > 0 ? ` · ${queued.length} queued` : ''}
                                </div>
                            </div>
                        )}

                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mt-1 px-1">
                            Scans
                        </h4>
                        {activeScans.length === 0 && (
                            <div className="text-xs text-[var(--text-tertiary)] italic px-1">
                                {t('security_studio.no_scans') || 'No scans yet — start one with the + button.'}
                            </div>
                        )}
                        <div className="flex flex-col gap-1">
                            {activeScans.map(scan => {
                                const inFlight = scan.status === 'running' || scan.status === 'queued';
                                return (
                                    <button
                                        key={scan.id}
                                        onClick={() => setActiveScanId(scan.id)}
                                        className={`text-left text-xs px-3 py-2 rounded border ${activeScanId === scan.id
                                            ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                                            : 'border-transparent hover:bg-[var(--bg-secondary)]'}`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <StatusDot status={scan.status} />
                                            <span className="font-mono text-[10px] truncate text-[var(--text-secondary)] flex-1">
                                                {scan.id.slice(0, 8)} · {engineLabel(scan)}
                                            </span>
                                            {inFlight && (
                                                <span
                                                    onClick={(e) => { e.stopPropagation(); cancelScan(scan); }}
                                                    className="p-0.5 rounded text-red-500 hover:bg-red-500/10"
                                                    title="Cancel scan"
                                                >
                                                    <StopCircle size={11} />
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[var(--text-tertiary)] truncate mt-0.5">
                                            {scan.targetUrl}
                                        </div>
                                    </button>
                                );
                            })}
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
                />
            )}
        </>
    );
}

function EmptyState({ onCreate }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center gap-3 p-8">
            <ShieldCheck size={32} className="text-[var(--text-tertiary)]" />
            <div className="text-sm font-semibold text-[var(--text-secondary)]">No scan selected</div>
            <div className="text-xs text-[var(--text-tertiary)] max-w-sm">
                Start an authorized security scan against a target URL. Engines run in isolated
                containers and produce a severity-graded report when they finish.
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
