import React, { useRef } from 'react';
import { Check, Pipette } from 'lucide-react';

/**
 * ColorPicker — swatch row + optional custom hex via the native colour input.
 * Used by the admin Look editor for the accent palette and by anything else
 * that needs "pick from a curated set + maybe go custom".
 */

export interface ColorPickerProps {
    value: string;
    onChange: (hex: string) => void;
    presets: readonly string[];
    allowCustom?: boolean;
    disabled?: boolean;
    /** Visual size of each preset swatch in pixels. */
    swatchSize?: number;
    ariaLabel?: string;
    className?: string;
}

export default function ColorPicker({
    value,
    onChange,
    presets,
    allowCustom = true,
    disabled = false,
    swatchSize = 32,
    ariaLabel,
    className = '',
}: ColorPickerProps) {
    const customRef = useRef<HTMLInputElement>(null);
    const isPreset = presets.some((p) => p.toLowerCase() === value.toLowerCase());
    const customColor = !isPreset && value.startsWith('#') ? value : null;

    return (
        <div
            role="radiogroup"
            aria-label={ariaLabel}
            className={`flex items-center gap-2 flex-wrap ${className}`}
        >
            {presets.map((c) => {
                const active = c.toLowerCase() === value.toLowerCase();
                return (
                    <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={c}
                        disabled={disabled}
                        onClick={() => onChange(c)}
                        className="relative rounded-full transition-transform"
                        style={{
                            width: swatchSize,
                            height: swatchSize,
                            background: c,
                            border: active ? '2px solid var(--text-primary)' : '2px solid transparent',
                            transform: active ? 'scale(1.08)' : 'scale(1)',
                            opacity: disabled ? 0.5 : 1,
                            cursor: disabled ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {active && (
                            <Check
                                className="absolute inset-0 m-auto drop-shadow"
                                style={{ width: swatchSize * 0.5, height: swatchSize * 0.5, color: '#fff' }}
                            />
                        )}
                    </button>
                );
            })}
            {allowCustom && (
                <>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => customRef.current?.click()}
                        className="relative inline-flex items-center justify-center rounded-full border-2 border-dashed transition-colors"
                        style={{
                            width: swatchSize,
                            height: swatchSize,
                            borderColor: customColor ? 'var(--text-primary)' : 'var(--border-default)',
                            background: customColor ?? 'transparent',
                            color: customColor ? '#fff' : 'var(--text-muted)',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                        }}
                        title="Custom colour"
                        aria-label="Custom colour"
                    >
                        {customColor ? (
                            <Check style={{ width: swatchSize * 0.45, height: swatchSize * 0.45 }} />
                        ) : (
                            <Pipette style={{ width: swatchSize * 0.45, height: swatchSize * 0.45 }} />
                        )}
                    </button>
                    <input
                        ref={customRef}
                        type="color"
                        value={customColor ?? value}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={disabled}
                        aria-label="Custom colour value"
                        className="sr-only"
                    />
                    {customColor && (
                        <code
                            className="text-xs font-mono"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            {customColor}
                        </code>
                    )}
                </>
            )}
        </div>
    );
}
