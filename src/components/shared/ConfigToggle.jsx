import React from 'react';

/**
 * Reusable config toggle (checkbox + label + description).
 * Replaces 20+ identical inline checkbox patterns across manager pages and admin panels.
 *
 * @param {string}   id          - Unique id for the checkbox
 * @param {string}   label       - Display label
 * @param {string}   [description] - Optional description text below the label
 * @param {string}   [icon]      - Optional emoji icon shown before label
 * @param {boolean}  checked     - Whether the toggle is checked
 * @param {function} onChange    - Called with the new boolean value
 */
export default function ConfigToggle({ id, label, description, icon, checked, onChange }) {
    return (
        <label
            htmlFor={id}
            className="flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
        >
            <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="accent-[var(--accent-primary)] mt-1 flex-shrink-0"
            />
            <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {icon && <span>{icon}</span>}
                    {label}
                </div>
                {description && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>
                )}
            </div>
        </label>
    );
}
