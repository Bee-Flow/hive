import React from 'react';

const TONES = {
    neutral: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-default)]',
    info:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
    sky:     'bg-sky-500/10 text-sky-400 border-sky-500/30',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    danger:  'bg-rose-500/10 text-rose-400 border-rose-500/30',
    teal:    'bg-teal-500/10 text-teal-400 border-teal-500/30',
};

export function Badge({ tone = 'neutral', icon: Icon, children, className = '', size = 'md' }) {
    const dim = size === 'sm'
        ? 'text-[10px] px-1.5 py-0.5 gap-1'
        : 'text-[11px] px-2 py-0.5 gap-1';
    return (
        <span className={`inline-flex items-center font-semibold tracking-wide uppercase rounded-md border ${dim} ${TONES[tone]} ${className}`}>
            {Icon && <Icon className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />}
            {children}
        </span>
    );
}

export function Dot({ tone = 'neutral', className = '' }) {
    const colors = {
        neutral: 'bg-[var(--text-muted)]',
        info: 'bg-blue-400',
        sky: 'bg-sky-400',
        success: 'bg-emerald-400',
        warning: 'bg-amber-400',
        danger: 'bg-rose-400',
        teal: 'bg-teal-400',
    };
    return <span className={`inline-block w-2 h-2 rounded-full ${colors[tone]} ${className}`} />;
}
