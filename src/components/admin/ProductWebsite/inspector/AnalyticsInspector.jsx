import React, { useEffect, useState } from 'react';
import AppIcon from '../../../AppIcon';

// Also enforced server-side (cmsStore sanitizeAnalytics) and again in the
// public GoogleAnalyticsTracker — keep the three in sync.
const MEASUREMENT_ID_RE = /^G-[A-Z0-9]{4,20}$/;

// GA4 measurement-ID field — buffered like PageInspector's SlugField: commit
// on blur / Enter, Escape reverts, invalid non-empty input blocks the commit
// with a red border + message. Empty commits are allowed (clears GA).
function GaIdField({ value, onCommit }) {
    const [draft, setDraft] = useState(value || '');
    useEffect(() => { setDraft(value || ''); }, [value]);

    const normalized = draft.trim().toUpperCase();
    const invalid = normalized !== '' && !MEASUREMENT_ID_RE.test(normalized);

    const commit = () => {
        if (normalized === (value || '')) { setDraft(value || ''); return; }
        if (invalid) { setDraft(value || ''); return; }
        onCommit(normalized);
    };

    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[var(--text-muted)]">GA4 measurement ID</span>
            <input
                type="text"
                value={draft}
                spellCheck={false}
                placeholder="G-XXXXXXXXXX"
                onChange={e => setDraft(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
                    if (e.key === 'Escape') { e.preventDefault(); setDraft(value || ''); }
                }}
                className={`w-full px-2 py-1 rounded text-xs font-mono border bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none ${invalid ? 'border-red-400' : 'border-[var(--border-default)] focus:border-[var(--accent-primary)]'}`}
            />
            {invalid ? (
                <p className="text-[10px] leading-tight text-red-400">
                    ⚠ Not a GA4 measurement ID — it looks like G-XXXXXXXXXX (Esc reverts)
                </p>
            ) : (
                <p className="text-[10px] leading-tight text-[var(--text-muted)]">
                    Google Analytics → Admin → Data streams → your web stream. Leave empty to disable.
                </p>
            )}
        </div>
    );
}

/**
 * Site analytics settings — the `__analytics__` navigator entry.
 *
 * Google Analytics config lives ON the site doc (`site.analytics`), so it is
 * versioned, exported and duplicated with the site and — like everything else
 * on the doc — goes live on the next publish. Consent is non-negotiable:
 * the public tracker only loads after a cookie-banner accept, so a disabled
 * banner means GA stays off (warned about below, never silently shipped).
 */
export default function AnalyticsInspector({
    site,
    onChange,               // (nextAnalytics) → updateSiteAnalytics
    onOpenCookieSettings,   // () → select the cookie-banner entry
    onOpenAnalytics,        // () → the built-in visitor-stats admin tab (optional)
}) {
    const analytics = site?.analytics || {};
    const gaId = analytics.gaMeasurementId || '';
    const bannerDisabled = site?.cookieBanner?.enabled === false;

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 pt-4 pb-6 space-y-4">
                <div className="flex items-center gap-2">
                    <AppIcon name="BarChart3" className="w-4 h-4 text-[var(--accent-primary)]" />
                    <span className="text-sm font-semibold text-[var(--text-primary)]">Analytics</span>
                </div>

                <div className="space-y-1.5">
                    <p className="text-xs font-medium text-[var(--text-secondary)]">Google Analytics</p>
                    <GaIdField
                        value={gaId}
                        onCommit={(next) => onChange({ ...analytics, gaMeasurementId: next })}
                    />
                </div>

                {gaId && bannerDisabled && (
                    <div className="p-2.5 rounded-md border border-amber-500/30 bg-amber-500/10">
                        <p className="text-[11px] text-amber-500">
                            The cookie banner is disabled, so visitors can't consent and
                            Google Analytics will never load. Enable the banner to collect data.
                        </p>
                        {onOpenCookieSettings && (
                            <button
                                type="button"
                                onClick={onOpenCookieSettings}
                                className="mt-1.5 text-[11px] px-2 py-1 rounded border border-amber-500/40 text-amber-500 hover:bg-amber-500/15"
                            >
                                Open cookie banner settings
                            </button>
                        )}
                    </div>
                )}

                <div className="p-2.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50 space-y-1">
                    <p className="text-[11px] text-[var(--text-secondary)]">
                        Google Analytics sets cookies and sends visitor data to Google, so it
                        only loads after a visitor accepts the cookie banner — and is removed
                        again if they withdraw. Mention analytics in your banner text.
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                        Changes apply to the live site after you publish. Pages can opt out
                        individually via "Exclude from analytics" in their page settings.
                    </p>
                </div>

                {onOpenAnalytics && (
                    <button
                        type="button"
                        onClick={onOpenAnalytics}
                        className="text-xs text-[var(--accent-primary)] hover:underline"
                    >
                        Built-in visitor stats →
                    </button>
                )}
            </div>
        </div>
    );
}
