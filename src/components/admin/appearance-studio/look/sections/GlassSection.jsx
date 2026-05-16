import React from 'react';
import FormField from '../../../../shared/FormField';
import SegmentedControl from '../../../../shared/SegmentedControl';
import { SECTION_IDS } from '../useLookForm';

/**
 * GlassSection — the everyday glass knobs (intensity + tint + lensing).
 * Animation, grain, border-style, and per-tier overrides live in the
 * `AdvancedGlassDisclosure` drawer below to keep this page calm.
 */
export default function GlassSection({ form, setForm, saving }) {
    return (
        <section
            id={SECTION_IDS.glass}
            aria-labelledby={`${SECTION_IDS.glass}-heading`}
            className="space-y-5"
        >
            <header>
                <h3
                    id={`${SECTION_IDS.glass}-heading`}
                    className="text-base font-semibold mb-1"
                    style={{ color: 'var(--text-primary)' }}
                >
                    Glass
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Tune how the translucent surfaces feel — strength, warmth, and the iOS lens refraction.
                </p>
            </header>

            <FormField
                label="Intensity"
                hint="Scales blur + saturation + brightness across every glass surface."
            >
                <SegmentedControl
                    value={form.glassIntensity}
                    onChange={(v) => setForm((f) => ({ ...f, glassIntensity: v }))}
                    options={[
                        { value: 0, label: 'Subtle' },
                        { value: 1, label: 'Medium' },
                        { value: 2, label: 'Strong' },
                    ]}
                    disabled={saving}
                    ariaLabel="Glass intensity"
                />
            </FormField>

            <FormField
                label="Tint"
                hint="A faint amber (warm) or cyan (cool) wash to ground glass against your accent."
            >
                <SegmentedControl
                    value={form.glassTint}
                    onChange={(v) => setForm((f) => ({ ...f, glassTint: v }))}
                    options={[
                        { value: 'warm',    label: 'Warm' },
                        { value: 'neutral', label: 'Neutral' },
                        { value: 'cool',    label: 'Cool' },
                    ]}
                    disabled={saving}
                    ariaLabel="Glass tint"
                />
            </FormField>

            <FormField
                label="Lensing"
                hint="iOS Liquid-Glass refraction at glass edges. Costs a few ms per paint."
            >
                <SegmentedControl
                    value={form.glassLens}
                    onChange={(v) => setForm((f) => ({ ...f, glassLens: v }))}
                    options={[
                        { value: 'on',  label: 'On' },
                        { value: 'off', label: 'Off' },
                    ]}
                    disabled={saving}
                    ariaLabel="Glass lensing"
                />
            </FormField>
        </section>
    );
}
