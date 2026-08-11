import React from 'react';
import { BLOCK_VARIANTS } from './catalogue';

// Human labels for variant slugs; unknown slugs fall back to the slug.
const VARIANT_LABELS = {
    classic:  'Classic',
    panel:    'Panel',
    split:    'Split',
    video:    'Video',
    bento:    'Bento',
    chapters: 'Chapters',
    ledger:   'Ledger',
    numbers:  'Numbers',
    quotes:    'Quotes',
    case:      'Case',
    spotlight: 'Spotlight',
    chips:     'Chips',
    detailed:  'Detailed',
    single:    'Single',
    pair:      'Pair',
    'code-ui': 'Code + UI',
};

/**
 * Layout-variant selector — the FIRST control in a block editor whose type
 * has entries in BLOCK_VARIANTS. Writes `content.variant`; an absent or
 * unknown value renders as the type's first (legacy) variant, so this
 * control is always safe to show.
 */
export default function VariantPicker({ type, value, onChange }) {
    const variants = BLOCK_VARIANTS[type];
    if (!Array.isArray(variants) || variants.length < 2) return null;
    const active = variants.includes(value) ? value : variants[0];
    return (
        <div className="mb-3">
            <div className="text-[11px] font-medium text-[var(--text-muted)] mb-1.5">Layout</div>
            <div className="inline-flex flex-wrap gap-1 rounded-lg bg-[var(--bg-tertiary)] p-1">
                {variants.map(v => (
                    <button
                        key={v}
                        type="button"
                        onClick={() => onChange(v)}
                        aria-pressed={v === active}
                        className={
                            v === active
                                ? 'px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                                : 'px-2.5 py-1 rounded-md text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }
                    >
                        {VARIANT_LABELS[v] || v}
                    </button>
                ))}
            </div>
        </div>
    );
}
