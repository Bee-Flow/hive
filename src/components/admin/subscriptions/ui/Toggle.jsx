import React from 'react';

export function Toggle({ checked, onChange, disabled = false, label, description, icon: Icon, iconClass = 'text-blue-400' }) {
    const inner = (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                checked ? 'bg-emerald-500' : 'bg-[var(--bg-tertiary)] border border-[var(--border-default)]'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                    checked ? 'translate-x-5' : 'translate-x-0.5'
                }`}
            />
        </button>
    );

    if (!label && !description) return inner;

    return (
        <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)]">
            <div className="min-w-0">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
                    {Icon && <Icon className={`w-4 h-4 ${iconClass}`} />}
                    <span>{label}</span>
                </div>
                {description && <p className="mt-0.5 text-[11px] text-[var(--text-muted)] leading-relaxed">{description}</p>}
            </div>
            {inner}
        </div>
    );
}

export function Checkbox({ checked, onChange, label, accent = 'blue', disabled = false }) {
    const colorMap = { blue: 'accent-blue-500', emerald: 'accent-emerald-500', amber: 'accent-amber-500', rose: 'accent-rose-500', teal: 'accent-teal-500' };
    return (
        <label className={`inline-flex items-center gap-2 text-[13px] text-[var(--text-primary)] ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={e => onChange(e.target.checked)}
                className={`w-4 h-4 ${colorMap[accent] || colorMap.blue}`}
            />
            <span>{label}</span>
        </label>
    );
}
