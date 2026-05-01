import React from 'react';
import { Code, Palette, Cpu, X } from 'lucide-react';

const TABS = [
    { id: 'html', label: 'index.html', Icon: Code },
    { id: 'css',  label: 'style.css',  Icon: Palette },
    { id: 'js',   label: 'script.js',  Icon: Cpu },
];

export default function EditorTabs({ activeFile, onSelect, dirtyFiles = {} }) {
    return (
        <div
            className="flex items-end shrink-0 overflow-x-auto"
            style={{ height: 35, background: 'var(--vsc-tab-inactive-bg)', borderBottom: '1px solid var(--vsc-border)' }}
        >
            {TABS.map(({ id, label, Icon }) => {
                const isActive = id === activeFile;
                const isDirty = !!dirtyFiles[id];
                return (
                    <button
                        key={id}
                        onClick={() => onSelect(id)}
                        className="flex items-center gap-1.5 px-3 h-full text-[12px] shrink-0 transition-colors border-r relative"
                        style={{
                            background: isActive ? 'var(--vsc-tab-active-bg)' : 'var(--vsc-tab-inactive-bg)',
                            color: isActive ? 'var(--vsc-tab-active-fg)' : 'var(--vsc-tab-inactive-fg)',
                            borderColor: 'var(--vsc-border)',
                            borderTop: isActive ? '1px solid var(--vsc-accent)' : '1px solid transparent',
                        }}
                    >
                        <Icon size={13} />
                        <span>{label}</span>
                        {isDirty && (
                            <span
                                className="w-2 h-2 rounded-full"
                                style={{ background: 'var(--vsc-fg-muted)' }}
                                title="Unsaved"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
