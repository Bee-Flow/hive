import { ChevronDown } from 'lucide-react';
import { onBindingDragOver, getBindingDropPath } from './bindingDnd';
import React, { useCallback, useRef, useState } from 'react';
import { previewValue } from '../../../../../utils/bindingHelpers';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { denseInputClass } from '../flow/settings/formStyles';
import AnchoredMenu from '../../../../shared/AnchoredMenu';

/**
 * FieldKeyCombobox — a field-NAME picker for the collection ops (Dedupe
 * `keyField`, Aggregate/Summarize `field`). The value is a TOP-LEVEL key of
 * each array element — the only level the server can address (engine.js
 * reads `item?.[step.field]`, so dotted paths silently fail there).
 *
 * Free text is always allowed (the element shape may be unknown at design
 * time). Dropping / click-inserting a full path keeps only the LAST
 * segment, so the NDV Input panel's drag-to-map still lands sensibly.
 *
 * Props:
 *   value, onChange(nextKey)
 *   options — [{ key, sample }] from elementFieldOptions(resolveElementSample(...))
 *   onFocusField — same broadcast contract as BindingField/PathField
 */
export default function FieldKeyCombobox({
    value = '',
    onChange,
    options = [],
    placeholder = 'field name',
    label,
    onFocusField,
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const inputRef = useRef(null);
    const anchorRef = useRef(null);
    const close = useCallback(() => setOpen(false), []);

    const lastSegment = (path) => {
        const cleaned = String(path || '').trim().replace(/\[(?:\*|\d+)\]$/, '');
        const seg = cleaned.split('.').pop() || '';
        return seg.replace(/\[(?:\*|\d+)\]$/, '');
    };

    const emit = (next) => onChange?.(next);

    const onFocus = () => {
        setOpen(true);
        onFocusField?.({
            id: label || placeholder || 'field',
            label: label || placeholder || 'field',
            insert: (path) => emit(lastSegment(path)),
        });
    };
    // Deliberately NOT closed on blur any more. The old `onBlur` + 150 ms
    // timeout also fired when the author grabbed the list's own scrollbar,
    // which yanked the list away mid-drag (the same family of bug as
    // BFSF-328's backdrop). AnchoredMenu owns dismissal now: an outside press
    // that is not a scrollbar, or Escape.

    const onDragOver = onBindingDragOver;
    const onDrop = (e) => {
        const path = getBindingDropPath(e);
        if (!path) return;
        emit(lastSegment(path));
    };

    const trimmed = String(value || '').trim();
    let warning = null;
    if (/\./.test(trimmed)) {
        warning = t('routines.builder.field_key_dot', "Nested paths aren't supported here — pick a top-level field of each item.");
    } else if (trimmed && options.length > 0 && !options.some(o => o.key === trimmed)) {
        warning = t('routines.builder.field_key_unknown', 'Not seen in the sample items — double-check the spelling.');
    }

    return (
        <div className="space-y-1">
            <div className="relative" ref={anchorRef}>
                <input
                    ref={inputRef}
                    type="text"
                    value={value || ''}
                    onChange={(e) => emit(e.target.value)}
                    onFocus={onFocus}
                    // Also on click: picking an option keeps focus in the input
                    // (the option's mousedown is prevented), so a second focus
                    // event would never arrive to re-open the list.
                    onClick={onFocus}
                    onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false); } }}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    placeholder={placeholder}
                    className={denseInputClass('w-full pr-6 font-mono')}
                />
                {options.length > 0 && (
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
                )}
                <AnchoredMenu
                    open={open && options.length > 0}
                    onClose={close}
                    anchorRef={anchorRef}
                    align="stretch"
                    maxHeight={240}
                    className="divide-y divide-[var(--border-default)]"
                >
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] bg-[var(--bg-secondary)]/60 sticky top-0">
                        {t('routines.builder.fields_of_items', 'Fields of each item')}
                    </div>
                    {options.map(o => (
                        <button
                            key={o.key}
                            type="button"
                            // onMouseDown so the pick lands before the input's blur.
                            onMouseDown={(e) => { e.preventDefault(); emit(o.key); setOpen(false); }}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-[var(--bg-secondary)] ${trimmed === o.key ? 'bg-[var(--bg-secondary)]' : ''}`}
                        >
                            <span className="font-mono text-[var(--text-primary)] truncate">{o.key}</span>
                            <span className="ml-auto text-[10px] text-[var(--text-tertiary)] truncate max-w-[140px]">{previewValue(o.sample, 24)}</span>
                        </button>
                    ))}
                </AnchoredMenu>
            </div>
            {warning && (
                <div className="text-[10px] text-amber-500">{warning}</div>
            )}
        </div>
    );
}
