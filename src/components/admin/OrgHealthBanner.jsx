import { AlertTriangle, UserCheck } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../utils/helpers';

/**
 * OrgHealthBanner — org-admin surfacing of connector-health blockers, mounted
 * at the top of the OrgUsersPanel users section.
 *
 * Data: GET /auth/admin/connector-health/mine (org_admin). The server returns
 * sanitized, customer-safe copy — no billing/subscription internals — and this
 * component only adds soft framing on top.
 *
 * Silent-fail contract: renders null on ANY failure (non-200, network error,
 * malformed body), when health is 'ok', or when there is nothing actionable.
 * It must never break the users panel for non-connector orgs / older servers.
 */
export default function OrgHealthBanner({ onJumpToPending }) {
    const { t } = useTranslation();
    const [data, setData] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/auth/admin/connector-health/mine`);
                if (!res || !res.ok) return; // 403/404/500 → stay silent
                const d = await res.json().catch(() => null);
                if (!cancelled && d && typeof d === 'object') setData(d);
            } catch {
                /* network error → stay silent */
            }
        })();
        return () => { cancelled = true; };
    }, []);

    if (!data || data.health === 'ok') return null;

    const pending = Number(data.users?.pending) || 0;
    const problems = Array.isArray(data.problems) ? data.problems : [];
    const blocking = problems.filter(p => p && (p.severity === 'error' || p.severity === 'critical'));

    if (pending <= 0 && blocking.length === 0) return null;

    return (
        <div className="space-y-3 mb-4">
            {blocking.length > 0 && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-[var(--text-primary)]">
                                {t('admin.org_health_blocked', 'AI chat is not available for your organisation yet — a configuration step is still needed.')}
                            </div>
                            {blocking.map((p, i) => (
                                <div key={`${p.code}-${i}`} className="mt-1.5 text-xs text-[var(--text-secondary)] leading-relaxed">
                                    {p.message}
                                    {p.remediation && (
                                        <span className="block mt-0.5 text-[var(--text-tertiary)]">{p.remediation}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {pending > 0 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
                    <div className="flex items-start gap-3">
                        <UserCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-[var(--text-primary)]">
                                {t('admin.org_health_pending', '{count} user(s) are waiting for approval and cannot use AI yet.').replace('{count}', String(pending))}
                            </div>
                            <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                                {t('admin.org_health_pending_hint', 'Approve them in the member list below to unlock access.')}
                            </div>
                        </div>
                        {onJumpToPending && (
                            <button
                                onClick={onJumpToPending}
                                className="shrink-0 px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                            >
                                {t('admin.org_health_show_pending', 'Show pending')}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
