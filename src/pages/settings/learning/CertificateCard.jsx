import React from 'react';
import { Award, Lock, Eye, Sparkles, Loader2 } from 'lucide-react';

/**
 * CertificateCard — one certificate: progress toward eligibility, then a
 * "Get certified" CTA (issues it) or "View certificate" (opens the modal).
 * Honey/amber, no purple.
 */
export default function CertificateCard({ cert, busy, onEarn, onView, t }) {
    const { done = 0, total = 0 } = cert.progress || {};
    const pct = total ? Math.round((done / total) * 100) : 0;
    const earned = cert.issued;

    return (
        <div className="rounded-xl border p-4 flex items-center gap-4"
            style={{ borderColor: earned ? 'color-mix(in srgb, var(--accent-primary) 50%, var(--border-default))' : 'var(--border-default)', background: 'var(--bg-card)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{
                    background: earned ? 'color-mix(in srgb, var(--accent-primary) 16%, transparent)' : 'var(--bg-tertiary)',
                    border: earned ? '1.5px solid var(--accent-primary)' : '1.5px dashed var(--border-default)',
                    filter: earned ? 'none' : 'grayscale(0.6)', opacity: earned ? 1 : 0.85,
                }} aria-hidden="true">
                {earned ? '📜' : <Lock className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{cert.title}</h4>
                    {cert.level && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                            style={{ background: 'color-mix(in srgb, var(--accent-primary) 14%, transparent)', color: 'var(--accent-primary)' }}>
                            {cert.level}
                        </span>
                    )}
                </div>
                {!earned && (
                    <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--accent-primary)' }} />
                        </div>
                        <span className="text-[11px] tabular-nums flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                            {t('learn.cert.progress', '{a}/{b} courses').replace('{a}', String(done)).replace('{b}', String(total))}
                        </span>
                    </div>
                )}
                {earned && (
                    <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {cert.isPublic ? t('learn.cert.public', 'Public · shareable on LinkedIn') : t('learn.cert.earned', 'Earned — view, download or share')}
                    </p>
                )}
            </div>

            <div className="flex-shrink-0">
                {earned ? (
                    <button type="button" onClick={() => onView(cert)}
                        className="px-3 py-2 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 border transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                        <Eye className="w-4 h-4" /> {t('learn.cert.view', 'View certificate')}
                    </button>
                ) : cert.eligible ? (
                    <button type="button" onClick={() => onEarn(cert)} disabled={busy}
                        className="px-3 py-2 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 transition-opacity disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)', color: 'var(--accent-primary-fg, #fff)' }}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {t('learn.cert.get', 'Get certified')}
                    </button>
                ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded" style={{ color: 'var(--text-tertiary)' }}>
                        <Award className="w-3.5 h-3.5" /> {t('learn.cert.locked', 'In progress')}
                    </span>
                )}
            </div>
        </div>
    );
}
