import React from 'react';

export function Tabs({ value, onChange, options, className = '' }) {
    return (
        <div className={`inline-flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] ${className}`}>
            {options.map(opt => {
                const active = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className={`px-3 py-1.5 text-[12px] font-semibold rounded-md transition-colors ${
                            active
                                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                        {opt.icon && <opt.icon className="inline w-3.5 h-3.5 -mt-px mr-1.5" />}
                        {opt.label}
                        {opt.count != null && (
                            <span className={`ml-1.5 inline-flex items-center justify-center min-w-[20px] px-1.5 py-px text-[10px] rounded-full ${
                                active ? 'bg-blue-500/15 text-blue-400' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                            }`}>{opt.count}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

export function FilterPills({ value, onChange, options, multi = false, className = '' }) {
    const toggle = v => {
        if (multi) {
            const arr = Array.isArray(value) ? value : [];
            onChange(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
        } else {
            onChange(v === value ? null : v);
        }
    };
    const isActive = v => multi ? Array.isArray(value) && value.includes(v) : v === value;

    return (
        <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
            {options.map(opt => {
                const active = isActive(opt.value);
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggle(opt.value)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                            active
                                ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                                : 'bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}
