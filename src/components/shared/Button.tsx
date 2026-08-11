import React from 'react';

/**
 * Canonical Button primitive. Consolidated here from the parallel
 * `admin/subscriptions/ui/Button` kit — that path now re-exports this. New
 * code should import from `components/shared/Button`.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger' | 'warning';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
    primary:   'bg-blue-600 hover:bg-blue-500 text-white border-transparent',
    secondary: 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] border-[var(--border-default)]',
    ghost:     'bg-transparent hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-transparent',
    success:   'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent',
    danger:    'bg-rose-600/10 hover:bg-rose-600 hover:text-white text-rose-400 border-rose-600/30',
    warning:   'bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-400 border-amber-500/30',
};

const SIZES: Record<Size, string> = {
    sm: 'px-2.5 py-1 text-xs gap-1 rounded-md',
    md: 'px-3.5 py-2 text-[13px] gap-1.5 rounded-lg',
    lg: 'px-4 py-2.5 text-sm gap-2 rounded-lg',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    icon?: React.ComponentType<{ className?: string }>;
    iconRight?: React.ReactNode;
    busy?: boolean;
}

export function Button({
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconRight,
    children,
    className = '',
    type = 'button',
    busy = false,
    ...rest
}: ButtonProps) {
    const base = 'inline-flex items-center justify-center font-semibold border transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 whitespace-nowrap';
    return (
        <button
            type={type}
            disabled={busy || rest.disabled}
            className={`${base} ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
            {...rest}
        >
            {Icon && <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
            {children}
            {iconRight}
        </button>
    );
}

export default Button;
