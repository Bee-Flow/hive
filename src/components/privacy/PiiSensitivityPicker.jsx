import { SignalHigh, SignalLow, SignalMedium } from 'lucide-react';
import React, { useState } from 'react';

import ChoiceCards from '../shared/ChoiceCards';

/**
 * Three-level sensitivity picker over the raw PII confidence threshold.
 *
 * The stored value stays a float (`piiDetectionConfidenceThreshold`, the
 * guard's slider anchor math is untouched) — this component only translates
 * it for humans. "Confidence Threshold 50%" tells an end user nothing; worse,
 * the direction is inverted (a LOWER number detects MORE), which is exactly
 * the kind of dial people turn the wrong way. So: three named levels, the
 * calibrated default in the middle, and the raw slider tucked behind an
 * "advanced" fold for the admins who know why they want 0.65.
 *
 * Preset values are deliberate, not decorative:
 *   - 0.70 is the calibration anchor — every per-category floor in the guard
 *     (pii.py _PER_CATEGORY_THRESHOLD) is tuned AT this slider position, and
 *     every published quality number is measured here. That is what
 *     "recommended" means: the tested configuration.
 *   - 0.45 shifts every floor down 0.25 — the "rather a false alarm than a
 *     leak" stance.
 *   - 0.85 shifts every floor up 0.15 — fewer interruptions, accepts misses.
 *
 * Shared between the admin OrgShieldEditor and the personal
 * ConsumerPrivacySection so both stay visually and semantically aligned.
 */

// Display order: low → high, left to right — the direction people read a
// scale. (Note the underlying threshold runs the OPPOSITE way: low
// sensitivity = high threshold. That inversion is exactly why the raw slider
// confused people, and why these cards exist.)
export const PII_SENSITIVITY_PRESETS = [
    // Icons form a rising scale left to right, so the picture agrees with the
    // reading order and with the labels. Three unrelated pictograms (a target,
    // a scale, a magnifier) implied three different KINDS of thing rather than
    // three points on one axis.
    {
        id: 'strict',
        value: 0.85,
        Icon: SignalLow,
        label: 'Low sensitivity',
        desc: 'Only hides what we are very sure about. Fewer interruptions, but some personal data can slip through.',
    },
    {
        id: 'balanced',
        value: 0.70,
        Icon: SignalMedium,
        label: 'Balanced',
        badge: 'Recommended',
        desc: 'The tested setting. Every kind of data is tuned and measured at this level. Start here.',
    },
    {
        id: 'high',
        value: 0.45,
        Icon: SignalHigh,
        label: 'High sensitivity',
        desc: 'Hides as much as possible. Now and then it also hides ordinary text — a word that looks like a name, a number that looks like an ID.',
    },
];

// Wide enough to absorb float noise and the 0.05 slider steps around a
// preset; narrow enough that a deliberate custom value shows as custom.
const SNAP = 0.024;

export function presetFor(value) {
    const v = typeof value === 'number' ? value : 0.7;
    return PII_SENSITIVITY_PRESETS.find(p => Math.abs(p.value - v) < SNAP) || null;
}

export function PiiSensitivityPicker({ value, onChange, disabled = false, t }) {
    const tr = t || ((_key, fallback) => fallback);
    const v = typeof value === 'number' ? value : 0.7;
    const active = presetFor(v);
    // The advanced fold starts open when the stored value is custom —
    // hiding the only control that explains the state would be worse than
    // the raw slider ever was.
    const [showAdvanced, setShowAdvanced] = useState(active === null);

    // i18n keyed by preset id, so the display ORDER of the canonical array can
    // change without silently mislabeling a level.
    const presets = PII_SENSITIVITY_PRESETS.map(p => ({
        ...p,
        label: tr(`privacy.sensitivity_${p.id}`, p.label),
        desc: tr(`privacy.sensitivity_${p.id}_desc`, p.desc),
        badge: p.badge ? tr('privacy.sensitivity_recommended', p.badge) : undefined,
    }));

    return (
        <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted">
                    {tr('privacy.sensitivity_title', 'How strict should we be?')}
                </label>
                {active === null && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-primary)', color: 'var(--accent-primary)' }}>
                        {tr('privacy.sensitivity_custom', 'Custom')} · {Math.round(v * 100)}%
                    </span>
                )}
            </div>
            {/* A radio group, not three buttons: these are mutually exclusive
                and their selected state used to be carried by colour alone. */}
            <ChoiceCards
                value={active?.id ?? null}
                onChange={(id) => {
                    const opt = presets.find(p => p.id === id);
                    if (!opt) return;
                    onChange(opt.value);
                    // Choosing a level answers the question the advanced fold
                    // exists for — auto-hide it, so the raw slider only lingers
                    // while a value is genuinely custom or explicitly requested.
                    setShowAdvanced(false);
                }}
                disabled={disabled}
                columns={3}
                ariaLabel={tr('privacy.sensitivity_title', 'How strict should we be?')}
                options={presets.map(p => ({
                    value: p.id,
                    label: p.label,
                    description: p.desc,
                    Icon: p.Icon,
                    badge: p.badge,
                }))}
            />

            <button
                type="button"
                onClick={() => setShowAdvanced(s => !s)}
                className="text-[10px] mt-3 underline decoration-dotted"
                style={{ color: 'var(--text-muted)' }}
            >
                {showAdvanced
                    ? tr('privacy.sensitivity_advanced_hide', 'Hide the advanced setting')
                    : tr('privacy.sensitivity_advanced_show', 'Advanced: set an exact percentage')}
            </button>
            {showAdvanced && (
                <AdvancedThresholdSlider value={v} onChange={onChange} disabled={disabled} tr={tr} />
            )}
        </div>
    );
}

function AdvancedThresholdSlider({ value, onChange, disabled, tr }) {
    return (
        <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted">
                    {tr('privacy.sensitivity_advanced_note', 'Every kind of data has its own tuned level; this moves them all together. Lower = find more.')}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-primary)', color: 'var(--accent-primary)' }}>
                    {Math.round(value * 100)}%
                </span>
            </div>
            <input
                type="range" min="0.1" max="1.0" step="0.05"
                disabled={disabled}
                value={value}
                onChange={e => onChange(parseFloat(e.target.value))}
                className="w-full accent-[var(--accent-primary)]"
            />
            <div className="flex justify-between text-[10px] text-muted mt-1">
                <span>{tr('admin.shield_pii_detect_more', 'Find more (10%)')}</span>
                <span>{tr('admin.shield_pii_detect_less', 'Find less (100%)')}</span>
            </div>
        </div>
    );
}

export default PiiSensitivityPicker;
