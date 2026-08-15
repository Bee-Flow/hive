// §WS5 — shared form primitives extracted verbatim from SettingsForm.jsx
// (the "Chrome helpers" group). Used by SettingsForm and the per-type editors.
//
// The class strings themselves live in ./formStyles (pure, React-free) so that
// CollapsibleSection — which App Studio's inspector also renders — can share
// them without importing FieldHint. Everything is re-exported here so existing
// importers keep working unchanged.
import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import FieldHint from '../FieldHint';
import {
    fieldLabelClass, hintTextClass, optionalMarkClass, requiredChipClass,
} from './formStyles';

export {
    sectionHeaderClass, fieldLabelClass, subLabelClass, disclosureClass,
    bandClass, railClass, cardClass, requiredMarkClass, FOCUS_RING, FOCUS_RING_INSET,
    inputClass, textareaClass, denseInputClass, rowInputClass, controlSurfaceClass,
    hintTextClass, requiredChipClass, optionalMarkClass, actionButtonClass,
    listBadgeClass, AMBER_NOTE,
} from './formStyles';

/**
 * Labelled field row.
 *
 * `required` renders the word "Required" as a chip — an asterisk is
 * developer-form convention, not universal knowledge, and the ~12 fields the
 * validator actually blocks on used to look exactly as optional as "Max input
 * items". `optional` is the quiet counterpart for the rare field worth
 * reassuring about. Both render as SIBLINGS of the label span, never inside
 * it, so `getByText('URL')`-style queries keep matching the label alone.
 *
 * `htmlFor` upgrades the label span to a real <label>: clicking it focuses the
 * control and screen readers announce the association. Optional because most
 * existing rows wrap composite editors with no single focusable control.
 */
export function FormRow({ label, hint, required = false, optional = false, htmlFor = null, children }) {
    const LabelTag = htmlFor ? 'label' : 'span';
    return (
        <div>
            <div className="flex items-center gap-1.5 mb-1">
                <LabelTag htmlFor={htmlFor || undefined} className={fieldLabelClass()}>{label}</LabelTag>
                {required && <span className={requiredChipClass()}>Required</span>}
                {!required && optional && <span className={optionalMarkClass()}>optional</span>}
                <FieldHint title={label}>{hint}</FieldHint>
            </div>
            {children}
        </div>
    );
}

/**
 * One validation record. The machine code (`BF-1042`) used to open the
 * sentence — the least useful token in the message for the person reading it.
 * It now lives in the tooltip of a small marker dot, so support can still ask
 * for it, and the sentence starts with the words.
 */
export function ValidationLine({ record }) {
    const isErr = record.severity === 'error';
    return (
        <div className={`text-xs ${isErr ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'} mb-1`}>
            {record.code && (
                <span
                    title={record.code}
                    aria-label={`Code ${record.code}`}
                    className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1.5 align-middle opacity-70"
                />
            )}
            {record.message}
            {record.hint && <div className={`${hintTextClass()} mt-0.5`}>→ {record.hint}</div>}
        </div>
    );
}

/**
 * A short standing note inside a form section — replaces the hand-rolled
 * `text-amber-600 dark:text-amber-400` paragraphs that had drifted across the
 * step editors. `tone`:
 *   'info' — neutral explanation ("These run once per item, top to bottom.")
 *   'warn' — advisory ("A list here will probably fail when it runs.")
 */
export function SectionNote({ tone = 'info', children }) {
    const warn = tone === 'warn';
    const Icon = warn ? AlertTriangle : Info;
    return (
        <p className={`flex items-start gap-1.5 ${hintTextClass()} ${warn ? 'text-amber-600 dark:text-amber-400' : ''}`}>
            <Icon size={12} className="shrink-0 mt-0.5 opacity-80" aria-hidden="true" />
            <span className="min-w-0">{children}</span>
        </p>
    );
}

/** The consistent "nothing here yet" line for an empty section body. */
export function EmptySectionNote({ children }) {
    return <p className={`${hintTextClass()} italic text-[var(--text-tertiary)]`}>{children}</p>;
}
