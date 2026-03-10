import React from 'react';

/**
 * Vertical section navigation tabs, used in manager editor panels.
 * 
 * @param {{ id: string, label: string, icon: string }[]} sections - Tab definitions
 * @param {string} activeSection - Currently active section id
 * @param {function} onChange - Called with section id when user clicks a tab
 */
export default function SectionNav({ sections, activeSection, onChange }) {
    return (
        <div className="w-56 flex flex-col p-4 gap-1 border-r" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
            {sections.map(item => (
                <button
                    key={item.id}
                    onClick={() => onChange(item.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${activeSection === item.id
                        ? 'bg-[var(--accent-primary)] text-white shadow-md'
                        : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                        }`}
                >
                    <span className="text-lg">{item.icon}</span>
                    {item.label}
                </button>
            ))}
        </div>
    );
}
