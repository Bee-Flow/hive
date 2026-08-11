import React, { useState, useMemo } from 'react';
import { AlertCircle, AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { buildStepLabelMap, resolveOwningStepId, humanizeIssueText } from './flow/displayHelpers';

/**
 * Validation surface that lives at the bottom-right of the Build tab,
 * floating over the diagram canvas instead of pushing the whole layout
 * down. Same data shape as the old BuilderErrorBanner so the structured
 * `{code, path, message, hint}` records stay readable.
 *
 * Collapsed: a small pill with a count + severity icon.
 * Expanded:  the full record list above the pill.
 *
 * The pill renders nothing when there's nothing to surface, so a healthy
 * automation has zero visual noise.
 *
 * Records never show raw step ids — `def` (passed so we can resolve labels)
 * lets each record show the step's NAME instead, and clicking a record
 * (`onFocusStep`) jumps to that node on the canvas.
 */
export default function FloatingValidationPill({ fatalError, validation, aborted, onDismissFatal, def = null, onFocusStep = null }) {
    const [open, setOpen] = useState(false);
    // Hooks must run unconditionally — keep them above the empty-state return.
    const labelById = useMemo(() => buildStepLabelMap(def), [def]);
    const errors = validation?.errors || [];
    const warnings = validation?.warnings || [];
    const total = errors.length + warnings.length + (fatalError ? 1 : 0) + (aborted ? 1 : 0);
    if (total === 0) return null;

    const hasErrors = !!fatalError || errors.length > 0;
    const tone = hasErrors
        ? 'bg-red-500 text-white'
        : 'bg-amber-500 text-white';
    const Icon = hasErrors ? AlertCircle : AlertTriangle;
    // Only call it "Validation" when there are actual validation records; a
    // fatal connection/build error or an abort isn't a validation failure.
    const hasValidationRecords = errors.length > 0 || warnings.length > 0;
    const headerLabel = hasValidationRecords ? 'Validation' : (fatalError ? 'Build interrupted' : 'Builder');
    const fatalErrorText = humanizeIssueText(fatalError, labelById);

    return (
        <div className="absolute right-4 bottom-4 z-20 flex flex-col items-end gap-2 max-w-[420px]">
            {open && (
                <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl w-[420px] max-h-[50vh] overflow-y-auto">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)]">
                        <div className="text-xs uppercase tracking-wide font-semibold text-[var(--text-tertiary)]">
                            {headerLabel} ({total})
                        </div>
                        <button
                            onClick={() => setOpen(false)}
                            className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                            title="Collapse"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <div className="p-2 space-y-1.5 text-xs">
                        {fatalError && (
                            <div className="rounded bg-red-500/10 border border-red-500/30 px-2.5 py-2 text-red-600 dark:text-red-400 flex items-start gap-2">
                                <AlertCircle size={13} className="flex-shrink-0 mt-px" />
                                <div className="flex-1 min-w-0">
                                    <div>{fatalErrorText}</div>
                                </div>
                                {onDismissFatal && (
                                    <button onClick={onDismissFatal} className="text-[10px] underline hover:no-underline opacity-80 flex-shrink-0">
                                        dismiss
                                    </button>
                                )}
                            </div>
                        )}
                        {aborted && (
                            <div className="rounded bg-amber-500/10 border border-amber-500/30 px-2.5 py-2 text-amber-600 dark:text-amber-400 flex items-start gap-2">
                                <AlertTriangle size={13} className="flex-shrink-0 mt-px" />
                                <div className="flex-1">
                                    Builder stopped after {aborted.iterations} iterations without finalising — review the issues below and ask the builder to fix them.
                                </div>
                            </div>
                        )}
                        {errors.map((e, i) => <Record key={`e-${i}`} record={e} def={def} labelById={labelById} onFocusStep={onFocusStep} />)}
                        {warnings.map((w, i) => <Record key={`w-${i}`} record={w} def={def} labelById={labelById} onFocusStep={onFocusStep} />)}
                    </div>
                </div>
            )}
            <button
                onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-1.5 rounded-full ${tone} px-3 py-1.5 text-xs font-semibold shadow-lg hover:opacity-95 transition`}
                title={open ? 'Collapse' : `${total} validation issue${total === 1 ? '' : 's'}`}
            >
                <Icon size={13} />
                {total} {hasErrors ? 'issue' : 'warning'}{total === 1 ? '' : 's'}
                {open ? <ChevronDown size={12} className="opacity-80" /> : <ChevronUp size={12} className="opacity-80" />}
            </button>
        </div>
    );
}

function Record({ record, def, labelById, onFocusStep }) {
    const isErr = record.severity === 'error';
    const owningId = resolveOwningStepId(record, def);
    const stepLabel = owningId ? (labelById.get(owningId) || null) : null;
    const message = humanizeIssueText(record.message, labelById);
    const clickable = !!(onFocusStep && owningId);
    return (
        <div
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onFocusStep(owningId) : undefined}
            onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFocusStep(owningId); } } : undefined}
            className={`rounded px-2.5 py-1.5 ${isErr ? 'bg-red-500/5 border border-red-500/20' : 'bg-amber-500/5 border border-amber-500/20'} ${clickable ? 'cursor-pointer hover:brightness-95' : ''}`}
        >
            <div className={`flex items-start gap-1.5 ${isErr ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                <span className="font-mono text-[10px] mt-px opacity-70 flex-shrink-0">{record.code}</span>
                <span className="flex-1">
                    {stepLabel && <span className="font-semibold">{stepLabel}: </span>}
                    {message}
                </span>
            </div>
            {record.hint && (
                <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5 leading-snug">→ {humanizeIssueText(record.hint, labelById)}</div>
            )}
        </div>
    );
}
