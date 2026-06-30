import React from 'react';

/**
 * Shared severity palette + renderers for Security Studio so the sidebar chips,
 * the live panel, and the results view all stay in sync.
 * Palette: high=red, medium=amber, low=blue, info=neutral (NO purple/indigo).
 */
export const SEVERITY_META = {
    high: { label: 'High', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/40' },
    medium: { label: 'Medium', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/40' },
    low: { label: 'Low', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/40' },
    informational: { label: 'Info', color: 'text-[var(--text-secondary)]', bg: 'bg-[var(--bg-secondary)] border-[var(--border-default)]' },
};

export const SEVERITY_ORDER = ['high', 'medium', 'low', 'informational'];

/** Four severity count cards. */
export function SeveritySummary({ summary }) {
    return (
        <div className="grid grid-cols-4 gap-2">
            {SEVERITY_ORDER.map((sev) => {
                const meta = SEVERITY_META[sev];
                const count = summary?.[sev] ?? 0;
                return (
                    <div key={sev} className={`rounded border p-3 text-center ${meta.bg}`}>
                        <div className={`text-xl font-semibold ${meta.color}`}>{count}</div>
                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{meta.label}</div>
                    </div>
                );
            })}
        </div>
    );
}

/** Compact H/M/L chips for the sidebar scan cards. */
export function SeverityChips({ summary }) {
    if (!summary) return null;
    const chips = [['high', 'H'], ['medium', 'M'], ['low', 'L']];
    const any = chips.some(([k]) => (summary[k] ?? 0) > 0);
    if (!any) {
        return <span className="text-[10px] text-[var(--text-tertiary)]">No issues</span>;
    }
    return (
        <span className="flex items-center gap-1">
            {chips.map(([k, letter]) => {
                const n = summary[k] ?? 0;
                if (!n) return null;
                const meta = SEVERITY_META[k];
                return (
                    <span key={k} className={`text-[10px] px-1.5 py-px rounded border ${meta.bg} ${meta.color} font-medium`}>
                        {letter}{n}
                    </span>
                );
            })}
        </span>
    );
}
