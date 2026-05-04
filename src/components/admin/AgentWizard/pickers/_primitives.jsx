// Tiny shared building blocks used across multiple pickers in this directory.
// Kept in one file because each is too small to warrant its own module and
// they have no internal state.

import React from 'react';
import { ChevronRight } from 'lucide-react';

export function CollapsibleSection({ title, open, onToggle, children }) {
    return (
        <div className="border-t border-[var(--border-default)] first:border-t-0">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-1 py-4 hover:opacity-80 transition text-left"
            >
                <span className="text-[15px] font-medium text-[var(--text-primary)]">{title}</span>
                <ChevronRight
                    size={18}
                    className={`text-[var(--text-tertiary)] transition-transform ${open ? 'rotate-90' : ''}`}
                />
            </button>
            {open && <div className="px-1 pb-5">{children}</div>}
        </div>
    );
}

export function Field({ label, children }) {
    return (
        <div>
            <div className="text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">{label}</div>
            {children}
        </div>
    );
}

export function ToggleRow({ label, help, checked, onChange }) {
    return (
        <label className="flex items-start gap-3 cursor-pointer">
            <input
                type="checkbox"
                checked={!!checked}
                onChange={(e) => onChange(e.target.checked)}
                className="mt-1"
            />
            <div className="flex-1">
                <div className="text-sm text-[var(--text-primary)]">{label}</div>
                {help && <div className="text-xs text-[var(--text-tertiary)]">{help}</div>}
            </div>
        </label>
    );
}
