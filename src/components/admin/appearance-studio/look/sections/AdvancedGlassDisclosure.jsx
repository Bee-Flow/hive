import React from 'react';
import Disclosure from '../../../../shared/Disclosure';
import FormField from '../../../../shared/FormField';
import SegmentedControl from '../../../../shared/SegmentedControl';
import Slider from '../../../../shared/Slider';
import { SECTION_IDS } from '../useLookForm';

const TIER_DEFAULTS = {
    subtle:  { blur: 10, saturate: 170, brightness: 1.05 },
    default: { blur: 16, saturate: 170, brightness: 1.05 },
    opaque:  { blur: 60, saturate: 220, brightness: 1.05 },
};

const TIER_LABELS = {
    subtle:  'Subtle — sidebar, chrome',
    default: 'Default — cards, panels',
    opaque:  'Opaque — modals, popovers',
};

/**
 * AdvancedGlassDisclosure — collapsed drawer holding the rarely-used glass
 * knobs (animation, grain, border style) and the per-tier blur/saturate/
 * brightness overrides. Kept out of the main scroll so the editor stays
 * approachable; power users open it when they need to dig in.
 */
export default function AdvancedGlassDisclosure({ form, setForm, saving }) {
    return (
        <section
            id={SECTION_IDS.advanced}
            aria-labelledby={`${SECTION_IDS.advanced}-heading`}
        >
            <Disclosure
                title="Advanced glass options"
                hint="Animation, grain, border style, per-tier overrides"
                variant="card"
            >
                <div className="space-y-5 pt-2">
                    <FormField
                        label="Animation"
                        hint="Subtle: wallpaper drifts. Lively: adds a sweeping specular sheen."
                    >
                        <SegmentedControl
                            value={form.glassAnimation}
                            onChange={(v) => setForm((f) => ({ ...f, glassAnimation: v }))}
                            options={[
                                { value: 'off',    label: 'Off' },
                                { value: 'subtle', label: 'Subtle' },
                                { value: 'lively', label: 'Lively' },
                            ]}
                            disabled={saving}
                            ariaLabel="Glass animation"
                        />
                    </FormField>

                    <FormField
                        label="Grain"
                        hint="Adds a fractal-noise texture so glass reads as real frosted material."
                    >
                        <SegmentedControl
                            value={form.glassGrain}
                            onChange={(v) => setForm((f) => ({ ...f, glassGrain: v }))}
                            options={[
                                { value: 'off',     label: 'Off' },
                                { value: 'subtle',  label: 'Subtle' },
                                { value: 'frosted', label: 'Frosted' },
                            ]}
                            disabled={saving}
                            ariaLabel="Glass grain"
                        />
                    </FormField>

                    <FormField
                        label="Border"
                        hint="Thin specular ring on each glass surface. Iridescent uses a rainbow gradient."
                    >
                        <SegmentedControl
                            value={form.glassBorder}
                            onChange={(v) => setForm((f) => ({ ...f, glassBorder: v }))}
                            options={[
                                { value: 'none',       label: 'None' },
                                { value: 'subtle',     label: 'Subtle' },
                                { value: 'bright',     label: 'Bright' },
                                { value: 'iridescent', label: 'Iridescent' },
                            ]}
                            disabled={saving}
                            ariaLabel="Glass border"
                        />
                    </FormField>

                    <div
                        className="rounded-xl border p-4 space-y-4"
                        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)' }}
                        data-surface="default"
                    >
                        <div>
                            <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                Per-tier overrides
                            </h4>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                Override the intensity-derived blur / saturate / brightness for each tier individually.
                                Leave a tier off to keep the default.
                            </p>
                        </div>
                        {Object.keys(TIER_DEFAULTS).map((tierKey) => (
                            <TierEditor
                                key={tierKey}
                                tierKey={tierKey}
                                value={form[`glassTier${capitalize(tierKey)}`]}
                                onChange={(v) => setForm((f) => ({ ...f, [`glassTier${capitalize(tierKey)}`]: v }))}
                                disabled={saving}
                            />
                        ))}
                    </div>
                </div>
            </Disclosure>
        </section>
    );
}

function TierEditor({ tierKey, value, onChange, disabled }) {
    const enabled = !!value;
    const v = value || TIER_DEFAULTS[tierKey];
    return (
        <div>
            <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => onChange(e.target.checked ? TIER_DEFAULTS[tierKey] : null)}
                    style={{ accentColor: 'var(--accent-primary)' }}
                    disabled={disabled}
                />
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {TIER_LABELS[tierKey]}
                </span>
            </label>
            {enabled && (
                <div className="ml-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Slider
                        label="Blur"
                        min={0} max={60} step={1}
                        suffix="px"
                        value={v.blur}
                        onChange={(n) => onChange({ ...v, blur: n })}
                        disabled={disabled}
                    />
                    <Slider
                        label="Saturate"
                        min={100} max={300} step={5}
                        suffix="%"
                        value={v.saturate}
                        onChange={(n) => onChange({ ...v, saturate: n })}
                        disabled={disabled}
                    />
                    <Slider
                        label="Brightness"
                        min={0.8} max={1.3} step={0.01}
                        suffix="×"
                        value={v.brightness}
                        onChange={(n) => onChange({ ...v, brightness: n })}
                        disabled={disabled}
                    />
                </div>
            )}
        </div>
    );
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
