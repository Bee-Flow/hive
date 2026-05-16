import React, { useState } from 'react';
import { SECTIONS } from './constants';

const ACCENT_BAR = {
    blue:    'bg-blue-500',
    sky:     'bg-sky-500',
    cyan:    'bg-cyan-500',
    amber:   'bg-amber-500',
    emerald: 'bg-emerald-500',
    rose:    'bg-rose-500',
    teal:    'bg-teal-500',
};
const ACCENT_ICON = {
    blue:    'text-blue-400',
    sky:     'text-sky-400',
    cyan:    'text-cyan-400',
    amber:   'text-amber-400',
    emerald: 'text-emerald-400',
    rose:    'text-rose-400',
    teal:    'text-teal-400',
};

export function SubscriptionsShell({ active, onChange, children }) {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="flex h-full overflow-hidden bg-[var(--bg-primary)]">
            {/* Sidebar — desktop ≥ md, drawer-style on mobile via top bar */}
            <aside className="hidden md:flex md:w-[220px] shrink-0 flex-col gap-1 px-3 py-4 bg-[var(--bg-secondary)] border-r border-[var(--border-default)]">
                <div className="px-3 mb-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Subscriptions</div>
                </div>
                {SECTIONS.map(sec => {
                    const Icon = sec.icon;
                    const isActive = active === sec.id;
                    return (
                        <button
                            key={sec.id}
                            onClick={() => onChange(sec.id)}
                            className={`group relative flex items-center gap-3 pl-4 pr-3 py-2 rounded-lg text-left transition-colors ${
                                isActive
                                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/60 hover:text-[var(--text-primary)]'
                            }`}
                        >
                            {isActive && <span className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full ${ACCENT_BAR[sec.accent]}`} />}
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? ACCENT_ICON[sec.accent] : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'}`} />
                            <span className="text-[13px] font-semibold">{sec.label}</span>
                        </button>
                    );
                })}
            </aside>

            {/* Mobile pill bar */}
            <div className="md:hidden flex-col w-full">
                <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
                    {SECTIONS.map(sec => {
                        const Icon = sec.icon;
                        const isActive = active === sec.id;
                        return (
                            <button
                                key={sec.id}
                                onClick={() => { onChange(sec.id); setMobileOpen(false); }}
                                className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-semibold border ${
                                    isActive
                                        ? `${ACCENT_ICON[sec.accent]} bg-[var(--bg-tertiary)] border-[var(--border-default)]`
                                        : 'text-[var(--text-muted)] bg-transparent border-transparent'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {sec.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <main className="flex-1 relative overflow-hidden">
                <div className="absolute inset-0 overflow-y-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
