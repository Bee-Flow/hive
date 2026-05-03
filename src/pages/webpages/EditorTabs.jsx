import React from 'react';
import { Code, Palette, Cpu, Database, X } from 'lucide-react';

const PRIMARY_TABS = [
    { id: 'html', label: 'index.html', Icon: Code },
    { id: 'css',  label: 'style.css',  Icon: Palette },
    { id: 'js',   label: 'script.js',  Icon: Cpu },
];

export default function EditorTabs({ activeFile, onSelect, onClose, dirtyFiles = {} }) {
    const isDbActive = !!activeFile && typeof activeFile === 'object' && activeFile.kind === 'db';
    const tabs = isDbActive
        ? [...PRIMARY_TABS, { id: 'db', label: 'data.db', Icon: Database, payload: { kind: 'db' } }]
        : PRIMARY_TABS;
    return (
        <div
            className="flex items-end shrink-0 overflow-x-auto"
            style={{ height: 35, background: 'var(--vsc-tab-inactive-bg)', borderBottom: '1px solid var(--vsc-border)' }}
        >
            {tabs.map(({ id, label, Icon, payload }) => {
                const isActive = id === 'db' ? isDbActive : id === activeFile;
                const isDirty = !!dirtyFiles[id];
                return (
                    <div
                        key={id}
                        className="flex items-center h-full shrink-0 transition-colors border-r relative"
                        style={{
                            background: isActive ? 'var(--vsc-tab-active-bg)' : 'var(--vsc-tab-inactive-bg)',
                            color: isActive ? 'var(--vsc-tab-active-fg)' : 'var(--vsc-tab-inactive-fg)',
                            borderColor: 'var(--vsc-border)',
                            borderTop: isActive ? '1px solid var(--vsc-accent)' : '1px solid transparent',
                        }}
                    >
                        <button
                            onClick={() => onSelect(payload || id)}
                            className="flex items-center gap-1.5 pl-3 pr-2 h-full text-[12px]"
                            style={{ color: 'inherit' }}
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
                        {isActive && onClose && (
                            <button
                                onClick={onClose}
                                className="flex items-center justify-center h-full pr-2 opacity-60 hover:opacity-100"
                                title="Close editor (return to preview)"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
