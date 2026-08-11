/**
 * Tiny pill(s) rendered under the user's message bubble:
 *
 *   • blue "N redacted"    — the server tokenised PII before the LLM saw it.
 *   • amber "Scan incomplete" — an uploaded file was too large / timed out to
 *     scan fully and (under the org's fail_open policy) the unscanned part was
 *     sent unredacted. This makes the pass-through VISIBLE, never silent.
 *
 * Click a pill → a dropdown with detail.
 *
 * The detail panels go through AnchoredMenu (portal to <body>) rather than a
 * plain `absolute … z-50` span (BFSF-303). Two separate faults produced the
 * reported "broken overlay":
 *
 *   1. Layering. The panel lived inside the message row, and in the glass
 *      themes every `[data-surface]` carries a backdrop-filter — which makes
 *      each message its own stacking context. `z-50` is then only local, so
 *      the panel painted UNDER the following chat bubbles instead of over
 *      them. A portal is the only escape; AnchoredMenu already solves exactly
 *      this for the node-config menus (BFSF-328) and flips/clamps to the
 *      viewport for free.
 *   2. Opacity. The panel painted `var(--bg-card)`, which is a deliberately
 *      translucent rgba(…, 0.55) in `glass`/`glass-dark`, so the chat text
 *      behind it bled straight through. The panel now carries
 *      `data-tokenised-popover`, and index.css gives that a solid tier-3
 *      surface + heavy backdrop blur in the glass themes — the same treatment
 *      the profile menu uses to stay legible over a wallpaper.
 */

import React, { useRef, useState } from 'react';
import { Lock, X, AlertTriangle } from 'lucide-react';
import AnchoredMenu from '../shared/AnchoredMenu';

function formatCategoryCounts(categories = []) {
    if (!Array.isArray(categories) || categories.length === 0) return [];
    const counts = new Map();
    for (const c of categories) {
        const key = String(c || 'Sensitive data');
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

function warningLine(w, t) {
    if (w.reason === 'overflow') {
        return t('dlp.attachment_overflow_truncated', 'too large to fully check; the rest was left out');
    }
    if (w.reason === 'timeout') {
        return t('dlp.attachment_timeout_truncated', 'check ran out of time; the rest was left out');
    }
    return t('dlp.attachment_degraded_truncated', 'checking unavailable; the rest was left out');
}

export default function TokenisedBadge({ count = 0, categories = [], warnings = [], t = (_k, d) => d }) {
    const [open, setOpen] = useState(null);   // null | 'redacted' | 'warn'
    const redactedRef = useRef(null);
    const warnRef = useRef(null);

    const hasRedactions = count && count >= 1;
    const hasWarnings = Array.isArray(warnings) && warnings.length > 0;
    if (!hasRedactions && !hasWarnings) return null;

    const breakdown = formatCategoryCounts(categories);
    const primaryLabel = breakdown[0]?.label;
    const summary = primaryLabel
        ? (count === 1 ? `1 ${primaryLabel.toLowerCase()} redacted` : `${count} items redacted`)
        : `${count} item${count === 1 ? '' : 's'} redacted`;

    const close = () => setOpen(null);

    return (
        <span className="relative inline-flex items-center gap-1.5">
            {hasRedactions && (
                <button
                    ref={redactedRef}
                    type="button"
                    onClick={() => setOpen(o => (o === 'redacted' ? null : 'redacted'))}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-colors"
                    style={{
                        background: 'rgba(59, 130, 246, 0.10)',
                        color: 'rgb(29, 78, 216)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                    }}
                    title="This message contained sensitive data — only placeholders were sent to the AI."
                >
                    <Lock className="w-2.5 h-2.5" />
                    <span>{summary}</span>
                </button>
            )}

            {hasWarnings && (
                <button
                    ref={warnRef}
                    type="button"
                    onClick={() => setOpen(o => (o === 'warn' ? null : 'warn'))}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-colors"
                    style={{
                        background: 'rgba(217, 119, 6, 0.12)',
                        color: 'rgb(180, 83, 9)',
                        border: '1px solid rgba(217, 119, 6, 0.30)',
                    }}
                    title={t('dlp.badge_scan_incomplete_tooltip', 'Some uploaded content could not be scanned and was sent to the AI unredacted.')}
                >
                    <AlertTriangle className="w-2.5 h-2.5" />
                    <span>{t('dlp.badge_scan_incomplete', 'Scan incomplete')}</span>
                </button>
            )}

            <AnchoredMenu
                open={open === 'redacted'}
                onClose={close}
                anchorRef={redactedRef}
                align="right"
                width={240}
                role="tooltip"
                data-tokenised-popover="redacted"
                data-testid="tokenised-badge-popover"
                className="p-3 text-xs leading-relaxed"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
            >
                <div className="flex items-start justify-between mb-1.5">
                    <span className="font-semibold">Sensitive data detected</span>
                    <button onClick={close} className="p-0.5 rounded hover:bg-[var(--bg-tertiary)]" aria-label="Close">
                        <X className="w-3 h-3" />
                    </button>
                </div>
                <p className="mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Only placeholders like <code className="px-1 rounded" style={{ background: 'var(--bg-tertiary)' }}>[email_1]</code> were sent to the AI. The real values stay here.
                </p>
                {breakdown.length > 0 && (
                    <ul className="space-y-1">
                        {breakdown.map(({ label, count: n }) => (
                            <li key={label} className="flex items-center justify-between">
                                <span>{label}</span>
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)' }}>×{n}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </AnchoredMenu>

            <AnchoredMenu
                open={open === 'warn'}
                onClose={close}
                anchorRef={warnRef}
                align="right"
                width={288}
                role="tooltip"
                data-tokenised-popover="warn"
                data-testid="tokenised-badge-warn-popover"
                className="p-3 text-xs leading-relaxed"
                style={{ background: 'var(--bg-card)', borderColor: 'rgba(217, 119, 6, 0.4)', color: 'var(--text-primary)' }}
            >
                <div className="flex items-start justify-between mb-1.5">
                    <span className="font-semibold" style={{ color: 'rgb(180, 83, 9)' }}>
                        {t('dlp.badge_scan_incomplete', 'Scan incomplete')}
                    </span>
                    <button onClick={close} className="p-0.5 rounded hover:bg-[var(--bg-tertiary)]" aria-label="Close">
                        <X className="w-3 h-3" />
                    </button>
                </div>
                <ul className="space-y-1.5">
                    {warnings.map((w, i) => {
                        const scanned = Number.isFinite(w.scannedPages) ? w.scannedPages : null;
                        const total = Number.isFinite(w.totalPages) ? w.totalPages : null;
                        return (
                            <li key={(w.filename || 'file') + i}>
                                <span className="font-medium">{w.filename || 'attachment'}</span>
                                {(scanned != null && total != null) && (
                                    <span style={{ color: 'var(--text-secondary)' }}>
                                        {' — '}{t('dlp.attachment_scanned_partial', 'Scanned {scanned} of {total} pages', { scanned, total })}
                                    </span>
                                )}
                                <div style={{ color: 'var(--text-secondary)' }}>⚠️ {warningLine(w, t)}</div>
                            </li>
                        );
                    })}
                </ul>
            </AnchoredMenu>
        </span>
    );
}
