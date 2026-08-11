import { History, Loader2, RotateCcw } from 'lucide-react';
import React from 'react';
import { useTranslation } from '../../../hooks/useTranslation';

// Unified version list for the detail drawer: hub catalogue versions joined
// with the local install ledger. Pure join/gating helpers are exported for
// unit tests.

/**
 * Join hub versions with local ledger rows by version string. Hub order is
 * kept (newest first from the hub); ledger-only versions (e.g. sideloads or
 * versions the hub no longer lists) are appended.
 */
export function mergeVersionRows(hubVersions, ledgerVersions) {
    const hub = (Array.isArray(hubVersions) ? hubVersions : []).filter((v) => v && v.version);
    const ledger = (Array.isArray(ledgerVersions) ? ledgerVersions : []).filter((v) => v && v.version);
    const ledgerByVersion = new Map(ledger.map((l) => [l.version, l]));
    const seen = new Set();
    const rows = [];
    for (const h of hub) {
        if (seen.has(h.version)) continue;
        seen.add(h.version);
        rows.push({
            version: h.version,
            channel: h.channel || null,
            changelog: h.changelog || null,
            yanked: !!h.yanked,
            ledger: ledgerByVersion.get(h.version) || null,
        });
    }
    for (const l of ledger) {
        if (seen.has(l.version)) continue;
        seen.add(l.version);
        rows.push({ version: l.version, channel: null, changelog: null, yanked: false, ledger: l });
    }
    return rows;
}

/** Rollback is only offered for retired versions whose package is still on disk. */
export function canRollback(row) {
    return !!(row && row.ledger && row.ledger.status === 'retired' && row.ledger.hasPackageFile);
}

// Ledger status → dict key (variable lookup; all values exist in the dict).
const STATUS_KEY = {
    active: 'modules.version_status_active',
    retired: 'modules.version_status_retired',
    staged: 'modules.version_status_staged',
    failed: 'modules.version_status_failed',
    incompatible: 'modules.version_status_incompatible',
    quarantined: 'modules.version_status_quarantined',
};

const STATUS_STYLE = {
    active: { background: 'rgba(16,185,129,0.15)', color: '#10b981' },
    staged: { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    failed: { background: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    incompatible: { background: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    quarantined: { background: 'rgba(239,68,68,0.15)', color: '#ef4444' },
};

export default function VersionHistory({ hubVersions, ledgerVersions, busy = false, onRollback, onActivateStaged }) {
    const { t } = useTranslation();
    const rows = mergeVersionRows(hubVersions, ledgerVersions);

    if (rows.length === 0) {
        return <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('modules.no_versions')}</p>;
    }

    return (
        <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }} data-testid="version-history">
            {rows.map((row) => {
                const status = row.ledger?.status || null;
                return (
                    <li key={row.version} className="py-2.5" data-testid={`version-row-${row.version}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                            <History className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>v{row.version}</span>
                            {row.channel && row.channel !== 'stable' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                                    {row.channel}
                                </span>
                            )}
                            {row.yanked && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                                    {t('modules.yanked')}
                                </span>
                            )}
                            {status && (
                                <span
                                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                    style={STATUS_STYLE[status] || { background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                                >
                                    {t(STATUS_KEY[status] || 'modules.version_status_retired')}
                                </span>
                            )}
                            <div className="flex-1" />
                            {status === 'staged' && onActivateStaged && (
                                <button
                                    onClick={() => onActivateStaged(row.version)}
                                    disabled={busy}
                                    className="px-2.5 py-1 rounded-lg text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                                    style={{ background: 'var(--accent-primary)', color: '#fff' }}
                                >
                                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                    {t('modules.activate_staged')}
                                </button>
                            )}
                            {canRollback(row) && onRollback && (
                                <button
                                    onClick={() => onRollback(row.version)}
                                    disabled={busy}
                                    className="px-2.5 py-1 rounded-lg text-xs font-medium border disabled:opacity-50 flex items-center gap-1"
                                    style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
                                    data-testid={`rollback-${row.version}`}
                                >
                                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                    {t('modules.rollback')}
                                </button>
                            )}
                        </div>
                        {row.changelog && (
                            <p className="text-xs mt-1 ml-5 leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                                {row.changelog}
                            </p>
                        )}
                        {row.ledger?.error && (
                            <p className="text-xs mt-1 ml-5" style={{ color: '#ef4444' }}>{row.ledger.error}</p>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
