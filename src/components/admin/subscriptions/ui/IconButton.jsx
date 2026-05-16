import React from 'react';

const VARIANTS = {
    ghost:   'bg-transparent hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-transparent',
    neutral: 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-default)]',
    danger:  'bg-rose-600/10 hover:bg-rose-600 hover:text-white text-rose-400 border-rose-600/30',
};

export function IconButton({ icon: Icon, variant = 'ghost', title, onClick, className = '', size = 'md', ...rest }) {
    const dim = size === 'sm' ? 'w-7 h-7 [&>svg]:w-3.5 [&>svg]:h-3.5' : 'w-9 h-9 [&>svg]:w-4 [&>svg]:h-4';
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            onClick={onClick}
            className={`inline-flex items-center justify-center rounded-lg border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50 ${dim} ${VARIANTS[variant]} ${className}`}
            {...rest}
        >
            {Icon ? <Icon /> : rest.children}
        </button>
    );
}
