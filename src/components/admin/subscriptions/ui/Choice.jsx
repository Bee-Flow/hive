import React from 'react';

/**
 * Big, friendly side-by-side selector — used for plan_type, billing_model, etc.
 * options: [{ value, label, description, icon }]
 */
export function ChoiceCards({ value, onChange, options, accent = 'blue', columns = 2 }) {
    const accentClasses = {
        blue:    { active: 'border-blue-500 bg-blue-500/10 text-blue-300',     iconActive: 'text-blue-400' },
        emerald: { active: 'border-emerald-500 bg-emerald-500/10 text-emerald-300', iconActive: 'text-emerald-400' },
        amber:   { active: 'border-amber-500 bg-amber-500/10 text-amber-300',  iconActive: 'text-amber-400' },
        teal:    { active: 'border-teal-500 bg-teal-500/10 text-teal-300',     iconActive: 'text-teal-400' },
        sky:     { active: 'border-sky-500 bg-sky-500/10 text-sky-300',        iconActive: 'text-sky-400' },
    };
    return (
        <div className={`grid grid-cols-${columns} gap-2`}>
            {options.map(opt => {
                const active = opt.value === value;
                const a = accentClasses[opt.accent || accent] || accentClasses.blue;
                const Icon = opt.icon;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className={`flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-xl border-2 transition-all ${
                            active
                                ? a.active
                                : 'border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                        {Icon && <Icon className={`w-5 h-5 ${active ? a.iconActive : 'text-[var(--text-muted)]'}`} />}
                        <span className="text-[13px] font-semibold">{opt.label}</span>
                        {opt.description && <span className="text-[10.5px] text-[var(--text-muted)]">{opt.description}</span>}
                    </button>
                );
            })}
        </div>
    );
}
