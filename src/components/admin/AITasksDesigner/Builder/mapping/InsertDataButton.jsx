import { Braces } from 'lucide-react';
import React from 'react';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { useFormMode } from '../flow/settings/formDensity';
import { FOCUS_RING } from '../flow/settings/formStyles';

/**
 * The "insert data from a previous step" button that sits beside every
 * mapping-aware field (BindingField, PathField, TemplateField, the raw
 * condition expression). One component so the affordance reads the same
 * everywhere — and so the two form modes can disagree about how loud it is:
 *
 *   simple   — `{ } Insert data`, always fully visible. A bare {} glyph is
 *              editor-culture shorthand a non-technical author has never met,
 *              and the old opacity fade-in hid the button from exactly the
 *              people who needed to discover it.
 *   advanced — the compact icon-only {} with the hover/focus fade, unchanged;
 *              power users know it and the row stays quiet.
 *
 * The aria-label stays "Insert variable" in both modes — tests and assistive
 * tech match on it, and unlike the glyph it already says what it does.
 */
export default function InsertDataButton({ onClick, title = null, open = false, className = '' }) {
    const { t } = useTranslation();
    const simple = useFormMode() === 'simple';
    return (
        <button
            type="button"
            onClick={onClick}
            title={title || t('routines.builder.insert_from_step', 'Insert data from a previous step')}
            aria-label="Insert variable"
            aria-haspopup="dialog"
            aria-expanded={open}
            className={`shrink-0 px-2 rounded border border-[var(--border-default)] text-[11px] flex items-center justify-center gap-1 hover:bg-[var(--bg-secondary)] transition-opacity ${
                simple
                    ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] opacity-60 group-hover:opacity-100 group-focus-within:opacity-100'
            } ${FOCUS_RING} ${className}`}
        >
            <Braces size={12} />
            {simple && <span className="whitespace-nowrap">{t('routines.builder.insert_data_word', 'Insert data')}</span>}
        </button>
    );
}
