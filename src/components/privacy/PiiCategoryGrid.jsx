import React from 'react';
import AppEmoji from '../AppEmoji';
import { guardrailCatalogIdFor } from '../../utils/guardrailCategories';

/**
 * Two-column grid of PII categories with All / None shortcuts. The full
 * label/icon list lives at the call site so the same grid can render
 * either the local detector's 8-category subset or Azure's full 18.
 *
 * Used by:
 *   - admin GuardrailsPanel (org-level PII categories)
 *   - personal ConsumerPrivacySection (user-level PII categories)
 */
export function PiiCategoryGrid({ value, onChange, categories, label = 'PII Categories', allLabel = 'All', noneLabel = 'None' }) {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (id) => {
        if (selected.includes(id)) onChange(selected.filter(x => x !== id));
        else onChange([...selected, id]);
    };
    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-muted">
                    {label} ({selected.length}/{categories.length})
                </label>
                <div className="flex gap-2">
                    <button
                        onClick={() => onChange(categories.map(c => c.id))}
                        className="text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors font-medium"
                        style={{ color: 'var(--accent-primary)' }}
                    >{allLabel}</button>
                    <button
                        onClick={() => onChange([])}
                        className="text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors text-muted"
                    >{noneLabel}</button>
                </div>
            </div>
            <div
                className="grid grid-cols-2 gap-2 p-4 rounded-xl border"
                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}
            >
                {categories.map(cat => (
                    <label
                        key={cat.id}
                        className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer p-2 rounded hover:bg-white/5 transition-colors"
                    >
                        <input
                            type="checkbox"
                            checked={selected.includes(cat.id)}
                            onChange={() => toggle(cat.id)}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0"
                        />
                        <AppEmoji id={guardrailCatalogIdFor(cat.id)} default={cat.icon} />
                        <span>{cat.label}</span>
                    </label>
                ))}
            </div>
        </div>
    );
}

export default PiiCategoryGrid;
