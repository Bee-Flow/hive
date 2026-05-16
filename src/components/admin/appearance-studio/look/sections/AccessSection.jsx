import { Users, Lock } from 'lucide-react';
import React from 'react';
import Toggle from '../../../../shared/Toggle';
import { SECTION_IDS } from '../useLookForm';

/**
 * AccessSection — per-user override toggle. When off, every user sees the
 * organisation theme exactly as set and the Settings → Appearance section
 * hides itself.
 */
export default function AccessSection({ form, setForm, saving }) {
    const allow = !!form.allowUserOverride;
    return (
        <section
            id={SECTION_IDS.access}
            aria-labelledby={`${SECTION_IDS.access}-heading`}
        >
            <h3
                id={`${SECTION_IDS.access}-heading`}
                className="text-base font-semibold mb-1"
                style={{ color: 'var(--text-primary)' }}
            >
                Member access
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                Control whether individual members can override this theme on their own device.
            </p>
            <div
                className="rounded-xl border p-4 flex items-center gap-3"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
            >
                <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{
                        background: allow
                            ? 'color-mix(in srgb, var(--accent-primary) 14%, transparent)'
                            : 'var(--bg-tertiary)',
                        color: allow ? 'var(--accent-primary)' : 'var(--text-muted)',
                    }}
                >
                    {allow ? <Users className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        Allow members to pick their own theme
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {allow
                            ? 'Members see a theme switcher in the sidebar and a section in their settings.'
                            : 'Members see this organisation theme regardless of any local preference.'}
                    </p>
                </div>
                <Toggle
                    checked={allow}
                    onChange={(next) => setForm((f) => ({ ...f, allowUserOverride: next }))}
                    disabled={saving}
                    ariaLabel="Allow members to pick their own theme"
                />
            </div>
        </section>
    );
}
