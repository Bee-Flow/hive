/**
 * LegalLeftTabs — the legal workspace's left drawer: a tab switcher over the
 * Sources / Research / Authorities panels. Extracted so the drawer can be passed
 * to NotebookWorkspace as a single node while keeping the legal-only panels here.
 */
import React from 'react';

export default function LegalLeftTabs({ tab, onTab, tabs }) {
    const active = tabs.find((t) => t.key === tab) || tabs[0];
    return (
        <div className="flex flex-col h-full">
            <div className="shrink-0 flex items-center gap-0.5 p-1.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                {tabs.map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => onTab(key)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                        aria-pressed={tab === key}
                        style={tab === key ? { background: 'var(--bg-tertiary)', color: 'var(--accent-primary)' } : { color: 'var(--text-secondary)' }}
                    >
                        <Icon className="w-3.5 h-3.5" /> {label}
                    </button>
                ))}
            </div>
            <div className="flex-1 overflow-hidden">{active?.node}</div>
        </div>
    );
}
