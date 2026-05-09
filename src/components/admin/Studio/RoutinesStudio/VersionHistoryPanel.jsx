import React, { useEffect, useState, useCallback } from 'react';
import { History, RotateCcw, Eye, X } from 'lucide-react';
import useAutomationApi from '../../../../hooks/useAutomationApi';

/**
 * Lists every saved version for an automation and lets the user diff or
 * restore one. Pure UI on top of GET /:id/versions and POST
 * /:id/versions/:vid/restore — the server bumps the version counter when
 * a restore is applied, so the restore itself shows up as a new entry.
 *
 * Diff is rendered as a side-by-side <pre> of the two definition JSONs —
 * deliberately simple so we don't add a new diff dependency for a
 * power-user-only surface.
 */
export default function VersionHistoryPanel({ automation, onRestored }) {
    const api = useAutomationApi();
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [restoringId, setRestoringId] = useState(null);
    const [diffPair, setDiffPair] = useState(null); // { left:Version, right:Version }
    const [errorMsg, setErrorMsg] = useState(null);

    const reload = useCallback(async () => {
        if (!automation?.id) return;
        setLoading(true);
        try {
            const r = await api.listVersions(automation.id);
            setVersions(r.versions || []);
        } catch (e) {
            console.warn('[VersionHistoryPanel] listVersions failed:', e.message);
            setErrorMsg(e.message);
        } finally {
            setLoading(false);
        }
    }, [api, automation?.id]);

    useEffect(() => { reload(); }, [reload]);

    const onRestore = async (v) => {
        if (!window.confirm(`Restore version ${v.version}? The current definition will be replaced.`)) return;
        setRestoringId(v.id);
        setErrorMsg(null);
        try {
            const r = await api.restoreVersion(automation.id, v.id);
            await reload();
            onRestored?.(r?.automation);
        } catch (e) {
            setErrorMsg(e.message || 'Restore failed');
        } finally {
            setRestoringId(null);
        }
    };

    if (!automation?.id) return null;

    return (
        <div>
            <div className="flex items-center gap-2 mb-2 text-[var(--text-secondary)]">
                <History size={14} />
                <span className="text-[13px] font-medium">Version history</span>
                <span className="text-[11px] text-[var(--text-tertiary)]">{versions.length}</span>
            </div>
            {errorMsg && (
                <div className="text-[12px] text-red-600 mb-2">{errorMsg}</div>
            )}
            {loading && versions.length === 0 ? (
                <div className="text-[12px] text-[var(--text-tertiary)]">Loading…</div>
            ) : versions.length === 0 ? (
                <div className="text-[12px] text-[var(--text-tertiary)]">No saved versions yet.</div>
            ) : (
                <ul className="space-y-1">
                    {versions.map((v) => {
                        const isCurrent = v.version === automation.version;
                        return (
                            <li
                                key={v.id}
                                className="flex items-center gap-2 text-[12px] py-1.5 px-2 rounded-md hover:bg-[var(--bg-secondary)]"
                            >
                                <span className="font-mono text-[var(--text-primary)] w-12">v{v.version}</span>
                                <span className="text-[var(--text-tertiary)] flex-1 truncate">
                                    {v.savedAt ? new Date(v.savedAt).toLocaleString() : '—'}
                                </span>
                                {isCurrent && (
                                    <span className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded">
                                        current
                                    </span>
                                )}
                                <button
                                    onClick={() => setDiffPair({ left: v, right: null })}
                                    title="View JSON"
                                    className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                                >
                                    <Eye size={14} />
                                </button>
                                {!isCurrent && (
                                    <button
                                        onClick={() => onRestore(v)}
                                        disabled={restoringId === v.id}
                                        title="Restore this version"
                                        className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] disabled:opacity-60"
                                    >
                                        <RotateCcw size={14} />
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {diffPair && (
                <DiffModal
                    automationId={automation.id}
                    version={diffPair.left}
                    onClose={() => setDiffPair(null)}
                />
            )}
        </div>
    );
}

/**
 * Modal that fetches the automation row and shows the requested historical
 * definition next to it. We don't have a "get version definition" endpoint
 * yet — restore is the only way to read it from the server — so the modal
 * uses the saved version metadata + the current definition for context.
 *
 * To keep this a strict zero-dependency component, the diff view is just
 * the two JSON blobs side-by-side. A proper diff library can be added
 * later if power users ask for it.
 */
function DiffModal({ automationId, version, onClose }) {
    const api = useAutomationApi();
    const [current, setCurrent] = useState(null);
    const [snapshot, setSnapshot] = useState(null);
    const [loadError, setLoadError] = useState(null);

    useEffect(() => {
        let alive = true;
        Promise.all([
            api.getAutomation(automationId).then(d => d?.automation || null),
            api.getVersion(automationId, version.id).then(d => d?.version || null),
        ]).then(([cur, snap]) => {
            if (!alive) return;
            setCurrent(cur);
            setSnapshot(snap);
        }).catch((e) => {
            if (!alive) return;
            setLoadError(e.message || String(e));
        });
        return () => { alive = false; };
    }, [api, automationId, version.id]);

    return (
        <div
            className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-[var(--bg-primary)] rounded-xl w-full max-w-5xl h-[80vh] flex flex-col shadow-xl border border-[var(--border-default)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                        Version {version.version} · saved {version.savedAt ? new Date(version.savedAt).toLocaleString() : '—'}
                    </div>
                    <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                        <X size={18} />
                    </button>
                </div>
                {loadError && (
                    <div className="px-5 py-2 text-xs text-red-600 bg-red-50 border-b border-red-200">
                        {loadError}
                    </div>
                )}
                <div className="flex-1 overflow-hidden grid grid-cols-2 gap-px bg-[var(--border-default)]">
                    <div className="bg-[var(--bg-primary)] flex flex-col">
                        <div className="px-4 py-2 text-xs text-[var(--text-tertiary)] border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                            Current (v{current?.version ?? '—'})
                        </div>
                        <pre className="flex-1 overflow-auto m-0 p-3 text-[11px] font-mono text-[var(--text-primary)]">
                            {current ? JSON.stringify(current.definition || {}, null, 2) : 'Loading…'}
                        </pre>
                    </div>
                    <div className="bg-[var(--bg-primary)] flex flex-col">
                        <div className="px-4 py-2 text-xs text-[var(--text-tertiary)] border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                            Snapshot (v{version.version})
                        </div>
                        <pre className="flex-1 overflow-auto m-0 p-3 text-[11px] font-mono text-[var(--text-primary)]">
                            {snapshot ? JSON.stringify(snapshot.definition || {}, null, 2) : 'Loading…'}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}
