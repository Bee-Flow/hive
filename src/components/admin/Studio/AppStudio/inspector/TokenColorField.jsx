import { Check } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { COLOR_ROLES, HEX_RE } from './styleKnobMeta';
import ColorPicker from '../../../../shared/ColorPicker';
import SegmentedControl from '../../../../shared/SegmentedControl';
import { ROLE_COLORS } from '../runtime/styleResolver';
import { APP_COLOR_PRESETS } from '../runtime/themeVars';

/**
 * TokenColorField — editor for the `colorOrRole` style knob.
 *
 * Value model (mirrors server/appStudio/componentSpecs.js, authoritative):
 *   null        → inherit the theme (no explicit color)
 *   'primary'…  → one of the six COLOR_ROLES
 *   '#rrggbb'   → a custom hex literal
 *
 * The mode tabs are local UI state seeded from the value: switching to
 * "Theme" commits null immediately (that IS the value), while "Role" and
 * "Custom" only commit once a swatch/color is actually picked.
 */

function modeForValue(value) {
    if (value == null) return 'theme';
    if (COLOR_ROLES.includes(value)) return 'role';
    return 'custom';
}

/** Display color for a role swatch. `primary` follows the app theme. */
function roleSwatchColor(role, themePrimary) {
    if (role === 'primary') return themePrimary || APP_COLOR_PRESETS[0];
    if (role === 'neutral') return 'var(--text-secondary)';
    return ROLE_COLORS[role];
}

const MODE_OPTIONS = [
    { value: 'theme', label: 'Theme' },
    { value: 'role', label: 'Role' },
    { value: 'custom', label: 'Custom' },
];

export default function TokenColorField({ value = null, onChange, themePrimary = null, disabled = false }) {
    const [mode, setMode] = useState(() => modeForValue(value));

    // Follow external value changes (e.g. selecting a different node).
    useEffect(() => {
        setMode(modeForValue(value));
    }, [value]);

    const pickMode = (next) => {
        setMode(next);
        // Theme = "inherit" is itself the value; Role/Custom wait for a pick.
        if (next === 'theme' && value !== null) onChange(null);
    };

    return (
        <div>
            <SegmentedControl
                value={mode}
                onChange={pickMode}
                options={MODE_OPTIONS}
                size="sm"
                fullWidth
                disabled={disabled}
                ariaLabel="Color source"
            />
            <div className="mt-2">
                {mode === 'theme' && (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <span
                            aria-hidden="true"
                            className="inline-block w-5 h-5 rounded-full border border-[var(--border-default)]"
                            style={{ background: themePrimary || APP_COLOR_PRESETS[0] }}
                        />
                        Inherits the app theme
                    </div>
                )}
                {mode === 'role' && (
                    <div role="radiogroup" aria-label="Color role" className="flex items-center gap-2 flex-wrap">
                        {COLOR_ROLES.map((role) => {
                            const active = value === role;
                            return (
                                <button
                                    key={role}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    aria-label={role}
                                    title={role}
                                    disabled={disabled}
                                    onClick={() => onChange(role)}
                                    className="relative w-7 h-7 rounded-full transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{
                                        background: roleSwatchColor(role, themePrimary),
                                        border: active ? '2px solid var(--text-primary)' : '2px solid transparent',
                                        transform: active ? 'scale(1.08)' : 'scale(1)',
                                    }}
                                >
                                    {active && <Check className="absolute inset-0 m-auto w-3.5 h-3.5 text-white drop-shadow" />}
                                </button>
                            );
                        })}
                    </div>
                )}
                {mode === 'custom' && (
                    <ColorPicker
                        value={typeof value === 'string' && HEX_RE.test(value) ? value : ''}
                        onChange={onChange}
                        presets={APP_COLOR_PRESETS}
                        allowCustom
                        disabled={disabled}
                        swatchSize={24}
                        ariaLabel="Custom color"
                    />
                )}
            </div>
        </div>
    );
}
