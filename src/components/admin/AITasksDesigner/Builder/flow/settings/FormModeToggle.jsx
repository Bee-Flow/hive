import { ChevronRight } from 'lucide-react';
import React from 'react';
import { useTranslation } from '../../../../../../hooks/useTranslation';
import SegmentedControl from '../../../../../shared/SegmentedControl';

/**
 * The Simple / All-options switch, in its two presentations:
 *
 *   'segmented' — the standing control in the step editor's header. Wraps
 *                 shared/SegmentedControl (radiogroup/radio + aria-checked;
 *                 note the prop is `ariaLabel`, not `aria-label`).
 *   'link'      — the one-line text button in the quick dialog's footer:
 *                 "Show all options (N)" / "Show fewer options". Same state,
 *                 different clothes — both drive the SAME persisted mode.
 *
 * The caller passes the RESOLVED mode (formDensity.resolveMode) — this
 * component never guesses from density.
 */
export default function FormModeToggle({
    mode,                  // 'simple' | 'advanced'
    onChange,              // (next: 'simple' | 'advanced') => void
    hiddenCount = 0,
    size = 'sm',
    variant = 'segmented',
}) {
    const { t } = useTranslation();

    if (variant === 'link') {
        const toAdvanced = mode !== 'advanced';
        const label = toAdvanced
            ? (hiddenCount > 0
                ? t('routines.builder.show_all_options_n', 'Show all options ({count})', { count: hiddenCount })
                : t('routines.builder.show_all_options', 'Show all options'))
            : t('routines.builder.show_fewer_options', 'Show fewer options');
        return (
            <button
                type="button"
                onClick={() => onChange?.(toAdvanced ? 'advanced' : 'simple')}
                className="inline-flex items-center gap-1 shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
            >
                {label} <ChevronRight size={12} className={toAdvanced ? '' : 'rotate-90'} />
            </button>
        );
    }

    return (
        <SegmentedControl
            value={mode}
            onChange={(next) => onChange?.(next)}
            size={size}
            ariaLabel={t('routines.builder.mode_toggle_label', 'How much of this step to show')}
            options={[
                { value: 'simple', label: t('routines.builder.mode_simple', 'Simple') },
                { value: 'advanced', label: t('routines.builder.mode_all_options', 'All options') },
            ]}
        />
    );
}
