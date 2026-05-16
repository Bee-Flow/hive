import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * FormField — label + caption + control + optional error/hint wrapper.
 * Replaces the "tiny `<h3>` label + caption + child" pattern repeated across
 * admin settings panels.
 */

export interface FormFieldProps {
    label?: React.ReactNode;
    /** Caption text shown beneath the label, above the control. */
    description?: React.ReactNode;
    /** Hint text shown beneath the control. */
    hint?: React.ReactNode;
    /** Error message shown beneath the control (replaces hint when set). */
    error?: React.ReactNode;
    /** Optional element rendered to the right of the label. */
    trailing?: React.ReactNode;
    children: React.ReactNode;
    htmlFor?: string;
    className?: string;
}

export default function FormField({
    label,
    description,
    hint,
    error,
    trailing,
    children,
    htmlFor,
    className = '',
}: FormFieldProps) {
    const fallbackId = useId();
    const labelId = htmlFor || fallbackId;
    return (
        <div className={className}>
            {(label != null || trailing != null) && (
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    {label != null ? (
                        <label
                            htmlFor={labelId}
                            className="text-sm font-medium text-[var(--text-primary)]"
                        >
                            {label}
                        </label>
                    ) : <span />}
                    {trailing != null && <div className="shrink-0">{trailing}</div>}
                </div>
            )}
            {description != null && (
                <p className="text-xs text-[var(--text-muted)] mb-2">{description}</p>
            )}
            {children}
            {error != null ? (
                <p className="text-xs mt-1.5 inline-flex items-center gap-1.5" style={{ color: 'var(--danger, #ef4444)' }}>
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {error}
                </p>
            ) : hint != null ? (
                <p className="text-xs mt-1.5 text-[var(--text-muted)]">{hint}</p>
            ) : null}
        </div>
    );
}
