import React from 'react';
import FormField from '../../../../shared/FormField';
import { FONT_OPTIONS } from '../../../../ThemeContext';
import { SECTION_IDS } from '../useLookForm';

// Sample text shown next to each font so admins can preview at a glance.
const FONT_SAMPLE = 'The quick brown fox jumps over the lazy dog.';

const FONT_STACKS_PREVIEW = {
    system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    inter: "'Inter', sans-serif",
    plex: "'IBM Plex Sans', sans-serif",
    geist: "'Geist', sans-serif",
};

export default function TypographySection({ form, setForm, saving }) {
    return (
        <section
            id={SECTION_IDS.typography}
            aria-labelledby={`${SECTION_IDS.typography}-heading`}
        >
            <h3
                id={`${SECTION_IDS.typography}-heading`}
                className="text-base font-semibold mb-1"
                style={{ color: 'var(--text-primary)' }}
            >
                Typography
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                Applied app-wide. The first option uses the operating system's native UI font.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FONT_OPTIONS.map((font) => {
                    const active = form.font === font.id;
                    return (
                        <button
                            key={font.id}
                            type="button"
                            disabled={saving}
                            onClick={() => setForm((f) => ({ ...f, font: font.id }))}
                            aria-pressed={active}
                            className="text-left p-3 rounded-xl border transition-all"
                            style={{
                                borderColor: active ? 'var(--accent-primary)' : 'var(--border-default)',
                                background: active ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                                boxShadow: active
                                    ? '0 0 0 2px color-mix(in srgb, var(--accent-primary) 18%, transparent)'
                                    : 'none',
                                cursor: saving ? 'not-allowed' : 'pointer',
                            }}
                        >
                            <div
                                className="text-sm font-semibold"
                                style={{ color: 'var(--text-primary)', fontFamily: FONT_STACKS_PREVIEW[font.id] }}
                            >
                                {font.label}
                            </div>
                            <div
                                className="text-[11px] mt-1 truncate"
                                style={{ color: 'var(--text-muted)', fontFamily: FONT_STACKS_PREVIEW[font.id] }}
                            >
                                {FONT_SAMPLE}
                            </div>
                        </button>
                    );
                })}
            </div>
            <FormField
                hint="Switching the font triggers a download the first time. Subsequent loads are cached."
                className="mt-3"
            >
                <span />
            </FormField>
        </section>
    );
}
