import { X, Wrench, ExternalLink } from 'lucide-react';
import React, { useEffect } from 'react';
import { HealthChip } from './ConnectorHealthPanel';
import { sevMeta } from './healthMeta';
import OrgEventTimeline from './OrgEventTimeline';
import { useTranslation } from '../../../hooks/useTranslation';

/**
 * OrgHealthDrawer — right-side drill-in for one Nextcloud-connected org:
 * current open problems (from the fleet payload) + the audit/event timeline.
 * ESC or backdrop click closes. Problems render the server-sanitized message
 * verbatim plus a distinct "How to fix" remediation block — never raw meta.
 */
export default function OrgHealthDrawer({ org, onClose, onNavigate }) {
    const { t } = useTranslation();

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    if (!org) return null;
    const problems = Array.isArray(org.problems) ? org.problems : [];

    return (
        <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div
                data-testid="drawer-backdrop"
                onClick={onClose}
                className="absolute inset-0"
                style={{ background: 'rgba(0,0,0,0.45)' }}
            />
            {/* Panel */}
            <div
                role="dialog"
                aria-label={org.name}
                className="absolute right-0 top-0 h-full w-full max-w-[560px] overflow-y-auto border-l border-[var(--border-default)] shadow-2xl"
                style={{ background: 'var(--bg-primary)' }}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 px-5 py-4 border-b border-[var(--border-subtle)]" style={{ background: 'var(--bg-primary)' }}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-semibold text-[var(--text-primary)] m-0 truncate">{org.name}</h3>
                                <HealthChip health={org.health} />
                            </div>
                            {org.ncBaseUrl && <div className="text-xs text-[var(--text-tertiary)] mt-1 truncate">{org.ncBaseUrl}</div>}
                            <div className="text-[11px] text-[var(--text-tertiary)] mt-1">
                                {org.ncProvisionedAt && <>{t('admin.ch_provisioned', 'Connected')}: {new Date(org.ncProvisionedAt).toLocaleDateString()}</>}
                                {org.ncProvisionedAt && org.ncLastSyncAt && ' · '}
                                {org.ncLastSyncAt && <>{t('admin.ch_last_sync', 'Last sync')}: {new Date(org.ncLastSyncAt).toLocaleString()}</>}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            title={t('admin.ch_close', 'Close')}
                            className="shrink-0 p-1.5 rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)]"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="px-5 py-4 space-y-6">
                    {/* Current problems */}
                    <section>
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                            {t('admin.ch_problems_title', 'Current problems')}
                        </h4>
                        {problems.length === 0 ? (
                            <div className="text-sm text-[var(--text-tertiary)] italic">
                                {t('admin.ch_no_problems', 'No open problems.')}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {problems.map((p, i) => {
                                    const sm = sevMeta(p.severity);
                                    return (
                                        <div key={`${p.code}-${i}`} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sm.dot }} />
                                                <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${sm.chip}`}>
                                                    {p.code}
                                                </span>
                                                <span className="text-[11px] text-[var(--text-tertiary)] ml-auto whitespace-nowrap">
                                                    {p.count > 1 && `${p.count}× · `}
                                                    {p.lastSeenAt ? new Date(p.lastSeenAt).toLocaleString() : ''}
                                                </span>
                                            </div>
                                            <div className="text-sm text-[var(--text-primary)] mt-2">{p.message}</div>
                                            {p.remediation && (
                                                <div className="mt-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-2.5">
                                                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                                                        <Wrench size={12} />
                                                        {t('admin.ch_remediation', 'How to fix')}
                                                    </div>
                                                    <div className="text-xs text-[var(--text-secondary)] leading-relaxed">{p.remediation}</div>
                                                </div>
                                            )}
                                            {p.code === 'chat.subscription_blocked' && onNavigate && (
                                                <button
                                                    onClick={() => onNavigate('admin/subscriptions')}
                                                    className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border-default)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                                                >
                                                    <ExternalLink size={12} />
                                                    {t('admin.ch_open_subscriptions', 'Open subscriptions')}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* Event timeline */}
                    <section>
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                            {t('admin.ch_timeline_title', 'Event timeline')}
                        </h4>
                        <OrgEventTimeline orgId={org.id} />
                    </section>
                </div>
            </div>
        </div>
    );
}
