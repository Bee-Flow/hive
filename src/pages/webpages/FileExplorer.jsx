import React, { useState } from 'react';
import { ChevronDown, Code, Palette, Cpu } from 'lucide-react';

const FILES = [
    { id: 'html', label: 'index.html', Icon: Code },
    { id: 'css',  label: 'style.css',  Icon: Palette },
    { id: 'js',   label: 'script.js',  Icon: Cpu },
];

export default function FileExplorer({ activeFile, onFileSelect, dirtyFiles = {} }) {
    const [open, setOpen] = useState(true);

    return (
        <div className="flex flex-col h-full select-none" style={{ background: 'var(--vsc-sidebar-bg)', color: 'var(--vsc-fg)' }}>
            {/* Explorer header */}
            <div
                className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase"
                style={{ color: 'var(--vsc-fg-muted)', letterSpacing: '0.1em' }}
            >
                Explorer
            </div>

            {/* src folder */}
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1 px-2 py-0.5 text-[12px] w-full text-left hover:bg-[var(--vsc-hover-bg)] transition-colors"
                style={{ color: 'var(--vsc-fg)' }}
            >
                <ChevronDown
                    size={14}
                    style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}
                />
                <span className="font-medium">src</span>
            </button>

            {open && FILES.map(({ id, label, Icon }) => {
                const isActive = id === activeFile;
                const isDirty = !!dirtyFiles[id];
                return (
                    <button
                        key={id}
                        onClick={() => onFileSelect(id)}
                        className="flex items-center gap-2 pl-7 pr-2 py-0.5 text-[12px] w-full text-left transition-colors"
                        style={{
                            background: isActive ? 'var(--vsc-file-active-bg)' : 'transparent',
                            color: isActive ? 'var(--vsc-fg)' : 'var(--vsc-fg-muted)',
                        }}
                    >
                        <Icon size={13} />
                        <span className="flex-1 truncate">{label}</span>
                        {isDirty && (
                            <span
                                title="Unsaved changes"
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: 'var(--vsc-fg-muted)' }}
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
