// §WS5 — shared form primitives extracted verbatim from SettingsForm.jsx
// (the "Chrome helpers" group). Used by SettingsForm and the per-type editors.
import React from 'react';
import FieldHint from '../FieldHint';

export function FormRow({ label, hint, children }) {
    return (
        <div>
            <div className="flex items-center gap-1 mb-1">
                <span className="text-[11px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)]">{label}</span>
                <FieldHint title={label}>{hint}</FieldHint>
            </div>
            {children}
        </div>
    );
}

export function ValidationLine({ record }) {
    const isErr = record.severity === 'error';
    return (
        <div className={`text-xs ${isErr ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'} mb-1`}>
            <span className="font-mono text-[10px] mr-1.5 opacity-70">{record.code}</span>
            {record.message}
            {record.hint && <div className="text-[var(--text-tertiary)] mt-0.5">→ {record.hint}</div>}
        </div>
    );
}

export function inputClass() {
    return 'w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]';
}
export function textareaClass() {
    return 'w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-y';
}
