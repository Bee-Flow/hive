import React from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';

/**
 * One tile. Shape copied from connectorHealth/ConnectorHealthPanel's `Stat` so
 * the two admin overviews read as the same product.
 */
function Stat({ label, value, tone, onClick, title }) {
    const toneColor = tone === 'rose' ? '#ef4444'
        : tone === 'amber' ? '#f59e0b'
            : tone === 'green' ? '#22c55e'
                : 'var(--text-primary)';
    const Wrapper = onClick ? 'button' : 'div';
    return (
        <Wrapper
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            title={title}
            className={
                'flex-1 min-w-[120px] rounded-xl border border-[var(--border-subtle)] '
                + 'bg-[var(--bg-secondary)] px-4 py-3 text-left '
                + (onClick
                    ? 'hover:bg-white/5 transition-colors cursor-pointer '
                      + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]'
                    : '')
            }
        >
            <div className="text-2xl font-semibold" style={{ color: toneColor }}>{value}</div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] mt-0.5">{label}</div>
        </Wrapper>
    );
}

/**
 * The console's answer to "is anything wrong here" without opening a tab.
 *
 * The stale-reference tile is the one that earns its place: a deleted
 * collection still leaves ids behind in every org that referenced it, the
 * shield keeps resolving with fewer rules, and nothing anywhere says so today.
 */
const StatStrip = ({ rules, collections, orgsBound, orgsTotal, staleRefs, onShowStale }) => {
    const { t } = useTranslation();
    const staleCount = staleRefs?.length || 0;

    return (
        <div className="flex flex-wrap gap-3">
            <Stat label={t('admin.gr_stat_rules', 'Rules')} value={rules} />
            <Stat label={t('admin.gr_stat_collections', 'Collections')} value={collections} />
            <Stat
                label={t('admin.gr_stat_orgs_protected', 'Orgs protected')}
                value={orgsTotal > 0 ? `${orgsBound}/${orgsTotal}` : '—'}
                tone={orgsTotal > 0 && orgsBound === 0 ? 'amber' : undefined}
            />
            <Stat
                label={t('admin.gr_stat_stale', 'Stale references')}
                value={staleCount}
                tone={staleCount > 0 ? 'rose' : 'green'}
                onClick={staleCount > 0 ? onShowStale : undefined}
                title={staleCount > 0
                    ? t('admin.gr_stat_stale_title', 'A configuration points at a rule or collection that no longer exists.')
                    : undefined}
            />
        </div>
    );
};

export default StatStrip;
