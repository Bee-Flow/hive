// §WS5 — shared form primitives extracted verbatim from SettingsForm.jsx
// (the "Chrome helpers" group). Used by SettingsForm and the per-type editors.
//
// The class strings themselves live in ./formStyles (pure, React-free) so that
// CollapsibleSection — which App Studio's inspector also renders — can share
// them without importing FieldHint. Everything is re-exported here so existing
// importers keep working unchanged.
import React from 'react';
import FieldHint from '../FieldHint';
import { fieldLabelClass, requiredMarkClass } from './formStyles';

export {
    sectionHeaderClass, fieldLabelClass, subLabelClass, disclosureClass,
    bandClass, railClass, cardClass, requiredMarkClass, FOCUS_RING, FOCUS_RING_INSET,
    inputClass, textareaClass, denseInputClass, rowInputClass, controlSurfaceClass,
} from './formStyles';

export function FormRow({ label, hint, required = false, children }) {
    return (
        <div>
            <div className="flex items-center gap-1.5 mb-1">
                <span className={fieldLabelClass()}>{label}</span>
                {/* Sibling, never inside the label span — queries match on the
                    label text alone. */}
                {required && <span className={requiredMarkClass()} title="Required">*</span>}
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
