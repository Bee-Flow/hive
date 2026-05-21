import React from 'react';
import { Field, NumberInput } from './Input';

export function LimitField({ field, value, onChange, planDefault, showOverride = false }) {
    const isOverridden = value !== null && value !== undefined;
    const placeholder = planDefault != null
        ? `Plan: ${planDefault.toLocaleString()}`
        : 'Unlimited';

    return (
        <Field
            label={
                <span className="inline-flex items-center gap-2 w-full">
                    <span>{field.label}</span>
                    {showOverride && (
                        <button
                            type="button"
                            onClick={e => { e.preventDefault(); onChange(isOverridden ? null : (planDefault ?? '')); }}
                            className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded ${
                                isOverridden
                                    ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300'
                                    : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            {isOverridden ? 'Override ✓' : 'Override'}
                        </button>
                    )}
                </span>
            }
            className="mb-3"
        >
            <NumberInput
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                step={field.type === 'currency' ? '0.01' : '1'}
                allowDecimal={field.type === 'currency'}
                disabled={showOverride && !isOverridden}
                className={showOverride && !isOverridden ? 'opacity-50' : ''}
            />
        </Field>
    );
}
