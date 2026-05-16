import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { History, RotateCcw, Eye, X } from 'lucide-react';
import useAutomationApi from '../../../../hooks/useAutomationApi';

/**
 * Lists every saved version for an automation and lets the user diff or
 * restore one. Pure UI on top of GET /:id/versions and POST
 * /:id/versions/:vid/restore — the server bumps the version counter when
 * a restore is applied, so the restore itself shows up as a new entry.
 *
 * Diff is rendered side-by-side with line-level highlighting (LCS-based
 * Myers-style script). Pure JS, no diff dependency. By default the
 * snapshot is compared against the current definition; the user can pick
 * any other saved version as the comparison target.
 */
export default function VersionHistoryPanel({ automation, onRestored }) {
    const api = useAutomationApi();
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [restoringId, setRestoringId] = useState(null);
    const [diffTargetVersion, setDiffTargetVersion] = useState(null);
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
                                    onClick={() => setDiffTargetVersion(v)}
                                    title="View diff"
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

            {diffTargetVersion && (
                <DiffModal
                    automationId={automation.id}
                    version={diffTargetVersion}
                    versions={versions}
                    onClose={() => setDiffTargetVersion(null)}
                />
            )}
        </div>
    );
}

/**
 * Side-by-side diff between two saved automation snapshots. By default
 * compares the user-clicked version against the current definition, but
 * any other saved version can be chosen as the "compare with" target.
 *
 * Implementation notes:
 *   - JSON is normalized via sorted-key stringify so key reorderings
 *     don't show up as diffs.
 *   - The diff is a textbook LCS reconstruction on lines — O(n*m) time
 *     and memory, which is fine for definition payloads (well under 200
 *     lines in practice).
 *   - Fetches use Promise.allSettled so a single failed leg still
 *     renders something useful, and an AbortController so we don't keep
 *     pending requests around after the user closes the modal.
 */
function DiffModal({ automationId, version, versions, onClose }) {
    const api = useAutomationApi();
    // `null` means "compare against current". A version object means
    // "compare against this snapshot".
    const [compareWith, setCompareWith] = useState(null);
    const [snapshot, setSnapshot] = useState(null);
    const [other, setOther] = useState(null);
    const [loadError, setLoadError] = useState(null);

    useEffect(() => {
        const ctrl = new AbortController();
        let alive = true;
        // Snapshot for the version the user opened the modal on.
        const snapshotP = api.getVersion(automationId, version.id).then(d => d?.version || null);
        // Comparison target: either another saved version or the current
        // automation row. We always fetch fresh (avoid stale local state).
        const otherP = compareWith
            ? api.getVersion(automationId, compareWith.id).then(d => d?.version || null)
            : api.getAutomation(automationId).then(d => d?.automation || null);

        Promise.allSettled([snapshotP, otherP]).then((results) => {
            if (!alive || ctrl.signal.aborted) return;
            const [snapRes, otherRes] = results;
            if (snapRes.status === 'fulfilled') setSnapshot(snapRes.value);
            if (otherRes.status === 'fulfilled') setOther(otherRes.value);
            const errs = results
                .filter((r) => r.status === 'rejected')
                .map((r) => r.reason?.message || String(r.reason));
            setLoadError(errs.length ? errs.join('; ') : null);
        });
        return () => { alive = false; ctrl.abort(); };
    }, [api, automationId, version.id, compareWith]);

    const snapDef = snapshot?.definition;
    const otherDef = other?.definition;

    const diffRows = useMemo(() => {
        if (!snapDef || !otherDef) return null;
        const left = stableStringify(otherDef).split('\n');
        const right = stableStringify(snapDef).split('\n');
        return diffLines(left, right);
    }, [snapDef, otherDef]);

    const compareLabel = compareWith
        ? `v${compareWith.version}`
        : (other ? `current (v${other.version ?? '—'})` : 'current');

    return (
        <div
            className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-[var(--bg-primary)] rounded-xl w-full max-w-5xl h-[80vh] flex flex-col shadow-xl border border-[var(--border-default)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)] gap-3">
                    <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        Diff · v{version.version} {version.savedAt ? `(${new Date(version.savedAt).toLocaleString()})` : ''}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <label className="text-[11px] text-[var(--text-tertiary)]">Compare with:</label>
                        <select
                            value={compareWith?.id || '__current__'}
                            onChange={(e) => {
                                const id = e.target.value;
                                if (id === '__current__') { setCompareWith(null); return; }
                                const v = versions.find((x) => x.id === id);
                                if (v && v.id !== version.id) setCompareWith(v);
                            }}
                            className="text-[12px] px-2 py-1 rounded border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-primary)]"
                        >
                            <option value="__current__">current</option>
                            {versions.filter((v) => v.id !== version.id).map((v) => (
                                <option key={v.id} value={v.id}>v{v.version}</option>
                            ))}
                        </select>
                        <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                            <X size={18} />
                        </button>
                    </div>
                </div>
                {loadError && (
                    <div className="px-5 py-2 text-xs text-red-600 bg-red-50 border-b border-red-200">
                        {loadError}
                    </div>
                )}
                <div className="flex-1 overflow-hidden grid grid-cols-2 gap-px bg-[var(--border-default)]">
                    <div className="bg-[var(--bg-primary)] flex flex-col min-h-0">
                        <div className="px-4 py-2 text-xs text-[var(--text-tertiary)] border-b border-[var(--border-default)] bg-[var(--bg-secondary)] flex-shrink-0">
                            {compareLabel}
                        </div>
                        <DiffPane rows={diffRows} side="left" placeholder={other ? null : 'Loading…'} />
                    </div>
                    <div className="bg-[var(--bg-primary)] flex flex-col min-h-0">
                        <div className="px-4 py-2 text-xs text-[var(--text-tertiary)] border-b border-[var(--border-default)] bg-[var(--bg-secondary)] flex-shrink-0">
                            v{version.version}
                        </div>
                        <DiffPane rows={diffRows} side="right" placeholder={snapshot ? null : 'Loading…'} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function DiffPane({ rows, side, placeholder }) {
    if (placeholder) {
        return <div className="flex-1 p-3 text-[12px] text-[var(--text-tertiary)]">{placeholder}</div>;
    }
    if (!rows) return <div className="flex-1" />;
    return (
        <div className="flex-1 overflow-auto p-0 text-[11px] font-mono leading-[1.45]">
            {rows.map((row, i) => {
                const line = side === 'left' ? row.left : row.right;
                const cls = row.kind === 'keep'
                    ? 'text-[var(--text-primary)]'
                    : row.kind === 'del' && side === 'left'
                        ? 'bg-red-500/15 text-red-700 dark:text-red-400'
                        : row.kind === 'ins' && side === 'right'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)]';
                return (
                    <div key={i} className={`px-3 whitespace-pre ${cls}`}>
                        {line == null ? ' ' : line || ' '}
                    </div>
                );
            })}
        </div>
    );
}

// Sort object keys recursively so a reordered-but-equivalent JSON doesn't
// produce noisy diffs. Arrays are left in their original order — order is
// semantically meaningful for `steps` / `edges`.
function stableStringify(value) {
    const sortObj = (v) => {
        if (Array.isArray(v)) return v.map(sortObj);
        if (v && typeof v === 'object') {
            const out = {};
            for (const k of Object.keys(v).sort()) out[k] = sortObj(v[k]);
            return out;
        }
        return v;
    };
    return JSON.stringify(sortObj(value ?? {}), null, 2);
}

// Build a side-by-side diff script via LCS. Returns rows of
// `{ kind: 'keep'|'del'|'ins', left, right }` where:
//   - keep: same line in both, displayed in both columns
//   - del:  only in left  (empty cell in right)
//   - ins:  only in right (empty cell in left)
function diffLines(a, b) {
    const n = a.length, m = b.length;
    // dp[i][j] = length of LCS of a[i..] and b[j..]
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i -= 1) {
        for (let j = m - 1; j >= 0; j -= 1) {
            dp[i][j] = a[i] === b[j]
                ? dp[i + 1][j + 1] + 1
                : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }
    const rows = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) {
            rows.push({ kind: 'keep', left: a[i], right: b[j] });
            i += 1; j += 1;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            rows.push({ kind: 'del', left: a[i], right: '' });
            i += 1;
        } else {
            rows.push({ kind: 'ins', left: '', right: b[j] });
            j += 1;
        }
    }
    while (i < n) { rows.push({ kind: 'del', left: a[i++], right: '' }); }
    while (j < m) { rows.push({ kind: 'ins', left: '', right: b[j++] }); }
    return rows;
}
