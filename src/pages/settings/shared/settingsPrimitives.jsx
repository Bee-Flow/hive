import React from 'react';

/**
 * Small presentational atoms shared by the org-level (admin) and personal
 * (settings) Nextcloud Talk → Meeting Notes panels, which re-declared them
 * byte-for-byte. Keep purely presentational — the panels own their own data.
 */

export const NC_BLUE = '#0082C9';

export const LANGS = [
    { code: 'nl', label: 'Dutch' }, { code: 'en', label: 'English' }, { code: 'de', label: 'German' },
    { code: 'fr', label: 'French' }, { code: 'es', label: 'Spanish' }, { code: 'it', label: 'Italian' }, { code: 'pt', label: 'Portuguese' },
];

export const Toggle = ({ on, onClick, disabled }) => (
    <button
        type="button" onClick={onClick} disabled={disabled} aria-pressed={on}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: on ? NC_BLUE : 'var(--border-default)', opacity: disabled ? 0.6 : 1 }}
    >
        <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
    </button>
);

export const Row = ({ title, desc, children }) => (
    <div className="flex items-center gap-4 px-5 py-3.5" style={{ background: 'var(--bg-secondary)' }}>
        <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{desc}</p>
        </div>
        {children}
    </div>
);

export const Select = ({ value, onChange, disabled, options }) => (
    <select
        value={value} onChange={onChange} disabled={disabled}
        className="w-40 px-3 py-1.5 rounded-lg border outline-none text-[13px]"
        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
    >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
);
