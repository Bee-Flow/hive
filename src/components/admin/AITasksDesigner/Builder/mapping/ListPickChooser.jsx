import { ChevronRight, Hash, List, Repeat, Type, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { bindingsForList, describeListPath, forEachPickFor, previewForEachPick } from './listShape';
import { usePopoverPosition } from './VariablePicker';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { previewValue, walkPath } from '../../../../../utils/bindingHelpers';

/**
 * "You picked a list — how should this field use it?"
 *
 * Opens when a click/drag/{} pick resolves to a LIST going into a field that
 * wants ONE value (expectShape 'scalar'). Without it the product silently
 * bound the array, previewed "[2 items]", and failed hours later inside the
 * provider — the array-into-scalar defect this whole surface exists to fix.
 *
 * The five answers are always the same five, in plain words. Every choice
 * emits only what the server engine really runs: a bare {kind:'ref'} or a
 * whitelisted first/last/join/count call (see listShape.js).
 *
 * Mechanics:
 *  - Portalled to document.body: the NDV's backdrop-blur creates a containing
 *    block for position:fixed, so an in-tree fixed popover would anchor to
 *    the dialog, not the viewport.
 *  - Escape closes THIS popover only, via a CAPTURE-phase document listener —
 *    NodeDetailView's own Escape handler listens on document too, and a
 *    bubble-phase stopPropagation would not reliably beat it.
 *  - Positioning reuses VariablePicker's measure-and-flip hook, so the two
 *    popovers a field can open never behave differently.
 */
// Sentinel for "something else…" — never a real separator value.
const CUSTOM_SEP = '__custom__';

export default function ListPickChooser({
    open,
    anchorEl,
    path,
    shape,                    // ListShape from listShape.js (never null while open)
    sampleRoot = null,
    stepLabelById = null,
    expectShape = 'unknown',  // the chooser only OPENS for 'scalar'; the prop keeps the copy honest
    allowForEach = false,     // !!onRequestForEach && the step is not in list mode
    fieldLabel = null,
    onChoose,                 // ({ mode, binding, forEach?, itemVar?, separator? }) => void
    onCancel,
}) {
    const { t } = useTranslation();
    const position = usePopoverPosition(anchorEl, open);
    const [separator, setSeparator] = useState(', ');
    const [customSep, setCustomSep] = useState('');

    // Escape → close this popover only (capture beats the NDV's own handler).
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            onCancel?.();
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [open, onCancel]);

    // Outside click closes (deferred a tick so the opening click survives).
    useEffect(() => {
        if (!open) return undefined;
        let attached = false;
        const handler = (e) => {
            if (e.target.closest('[data-list-pick-chooser]')) return;
            if (anchorEl && anchorEl.contains(e.target)) return;
            onCancel?.();
        };
        const timer = setTimeout(() => { document.addEventListener('mousedown', handler); attached = true; }, 0);
        return () => { clearTimeout(timer); if (attached) document.removeEventListener('mousedown', handler); };
    }, [open, onCancel, anchorEl]);

    const resolved = useMemo(
        () => (open ? walkPath(String(path || ''), sampleRoot) : undefined),
        [open, path, sampleRoot],
    );
    const list = Array.isArray(resolved) ? resolved : [];
    const effectiveSep = separator === CUSTOM_SEP ? customSep : separator;

    if (!open || !shape) return null;

    const n = shape.count ?? list.length;
    const isColumn = shape.kind === 'column';
    const friendly = describeListPath(path, stepLabelById, t);
    const foreachBlocked = shape.rowScopedListTail;
    const choose = (mode) => {
        if (mode === 'foreach') {
            const pick = forEachPickFor(path, sampleRoot);
            onChoose?.({ mode, binding: pick.binding, forEach: pick.forEach, itemVar: pick.itemVar });
            return;
        }
        const bindings = bindingsForList(path, { separator: effectiveSep });
        onChoose?.({ mode, binding: bindings[mode], separator: mode === 'join' ? effectiveSep : undefined });
    };

    const joinPreview = list.length
        ? previewValue(list.slice(0, 3).map(v => (typeof v === 'object' ? '…' : String(v))).join(effectiveSep), 40) + (list.length > 3 ? '…' : '')
        : null;
    const firstPreview = list.length ? previewValue(list[0], 40) : null;
    const foreachPreview = previewValue(previewForEachPick(path, sampleRoot), 40);

    const SEPARATORS = [
        { value: ', ', label: t('routines.builder.sep_comma_space', 'a comma and a space') },
        { value: ',', label: t('routines.builder.sep_comma', 'a comma') },
        { value: '; ', label: t('routines.builder.sep_semicolon', 'a semicolon') },
        { value: ' ', label: t('routines.builder.sep_space', 'a space') },
        { value: '\n', label: t('routines.builder.sep_newline', 'a new line') },
        { value: CUSTOM_SEP, label: t('routines.builder.sep_custom', 'something else…') },
    ];

    return createPortal(
        <div
            data-list-pick-chooser
            role="dialog"
            aria-label={fieldLabel
                ? `${t('routines.builder.list_chooser_title', 'How should this field use it?')} — ${fieldLabel}`
                : t('routines.builder.list_chooser_title', 'How should this field use it?')}
            // Above the NDV overlay (z-[1000]) and level with VariablePicker.
            className="fixed z-[1200] w-[340px] flex flex-col bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-md shadow-lg"
            style={{ left: position.left, top: position.top, maxHeight: position.maxHeight }}
        >
            <div className="flex items-start gap-2 px-3 py-2 border-b border-[var(--border-default)]">
                <List size={13} className="shrink-0 mt-0.5 text-[var(--text-secondary)]" />
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[var(--text-primary)]">
                        {t('routines.builder.list_chooser_title', 'How should this field use it?')}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] truncate" title={path}>
                        {isColumn
                            ? t('routines.builder.list_chooser_column', '“{field}” is one value from each of the {rows} rows.', { field: friendly, rows: shape.rows ?? n })
                            : t('routines.builder.list_chooser_list', '“{field}” is a list of {n} items.', { field: friendly, n })}
                    </div>
                    {expectShape === 'scalar' && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400">
                            {t('routines.builder.list_into_scalar', 'This field expects one value, so a list will probably fail when it runs.')}
                        </div>
                    )}
                </div>
                <button type="button" onClick={onCancel} aria-label={t('routines.builder.cancel', 'Cancel')} className="shrink-0 p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                    <X size={12} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
                {allowForEach && (
                    <ChoiceRow
                        icon={<Repeat size={13} />}
                        primary
                        disabled={foreachBlocked}
                        label={isColumn
                            ? t('routines.builder.choice_foreach_row', 'Run this step once for each row')
                            : t('routines.builder.choice_foreach_item', 'Run this step once for each item')}
                        detail={foreachBlocked
                            ? t('routines.builder.foreach_blocked_nested', 'Each row still holds a list here — pick a single value inside the row instead.')
                            : t('routines.builder.choice_foreach_detail', 'The step runs {n} times — once per row. This field gets that row’s value.', { n: shape.rows ?? n })}
                        preview={foreachBlocked ? null : foreachPreview}
                        onClick={() => choose('foreach')}
                    />
                )}
                <ChoiceRow
                    icon={<ChevronRight size={13} />}
                    label={t('routines.builder.choice_first', 'Just the first one')}
                    preview={firstPreview}
                    onClick={() => choose('first')}
                />
                <ChoiceRow
                    icon={<ChevronRight size={13} className="rotate-180" />}
                    label={t('routines.builder.choice_last', 'Just the last one')}
                    preview={list.length ? previewValue(list[list.length - 1], 40) : null}
                    onClick={() => choose('last')}
                />
                <ChoiceRow
                    icon={<Type size={13} />}
                    label={t('routines.builder.choice_join', 'All of them, joined into text')}
                    detail={t('routines.builder.choice_join_detail', 'Puts every value in one piece of text.')}
                    preview={joinPreview}
                    onClick={() => choose('join')}
                    extra={(
                        <span
                            className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]"
                            // The select must not trigger the row's pick.
                            onClick={(e) => e.stopPropagation()}
                        >
                            {t('routines.builder.separated_by', 'Separated by')}
                            <select
                                aria-label={t('routines.builder.separated_by', 'Separated by')}
                                value={separator}
                                onChange={(e) => setSeparator(e.target.value)}
                                className="px-1 py-0.5 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[10px] text-[var(--text-primary)]"
                            >
                                {SEPARATORS.map(s => <option key={s.label} value={s.value}>{s.label}</option>)}
                            </select>
                            {separator === CUSTOM_SEP && (
                                <input
                                    type="text"
                                    value={customSep}
                                    onChange={(e) => setCustomSep(e.target.value)}
                                    aria-label={t('routines.builder.sep_custom', 'something else…')}
                                    className="w-14 px-1 py-0.5 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[10px] text-[var(--text-primary)]"
                                />
                            )}
                        </span>
                    )}
                />
                <ChoiceRow
                    icon={<Hash size={13} />}
                    label={t('routines.builder.choice_count', 'How many there are')}
                    preview={String(n)}
                    onClick={() => choose('count')}
                />
                <ChoiceRow
                    icon={<List size={13} />}
                    label={t('routines.builder.choice_each', 'Keep the whole list')}
                    detail={expectShape === 'scalar'
                        ? t('routines.builder.choice_each_scalar_warn', 'Sends all {n} values as a list. Only fields that accept a list will work.', { n })
                        : t('routines.builder.choice_each_detail', 'Sends all {n} values as a list.', { n })}
                    onClick={() => choose('each')}
                />
            </div>

            <div className="px-3 py-1.5 border-t border-[var(--border-default)] text-[10px] text-[var(--text-tertiary)]">
                {t('routines.builder.alt_bypass_tip', 'Tip: hold Alt while you click or drag to skip this and insert the list as it is.')}
            </div>
        </div>,
        document.body,
    );
}

function ChoiceRow({ icon, label, detail = null, preview = null, extra = null, onClick, disabled = false, primary = false }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`w-full text-left px-3 py-2 flex items-start gap-2 transition ${
                disabled
                    ? 'opacity-55 cursor-not-allowed'
                    : 'hover:bg-[var(--bg-secondary)] cursor-pointer'
            }`}
        >
            <span className={`shrink-0 mt-0.5 ${primary && !disabled ? 'text-[var(--accent-primary-hover)]' : 'text-[var(--text-tertiary)]'}`}>{icon}</span>
            <span className="min-w-0 flex-1">
                <span className={`block text-xs ${primary && !disabled ? 'font-semibold' : 'font-medium'} text-[var(--text-primary)]`}>{label}</span>
                {detail && <span className="block text-[10px] leading-snug text-[var(--text-secondary)]">{detail}</span>}
                {extra}
                {preview != null && (
                    <span className="block text-[10px] font-mono text-[var(--text-tertiary)] truncate">→ {preview}</span>
                )}
            </span>
        </button>
    );
}
