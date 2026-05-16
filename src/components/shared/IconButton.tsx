import React from 'react';

/**
 * IconButton — small icon-only action button with consistent touch target,
 * hover affordance, and a11y. Replaces the recurring inline pattern:
 *
 *   <button className="p-1 rounded hover:bg-white/10 transition-colors"
 *           style={{ color: 'var(--text-tertiary)' }}
 *           onClick={...}>
 *     <Icon />
 *   </button>
 *
 * Always provide an `ariaLabel` — icon-only buttons have no accessible name
 * otherwise. The 'title' attribute is set from `ariaLabel` by default so
 * mouse users get a tooltip too.
 */

export type IconButtonSize = 'sm' | 'md' | 'lg';
export type IconButtonVariant = 'ghost' | 'subtle' | 'danger';

export interface IconButtonProps {
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    ariaLabel: string;
    /** Mouse tooltip text. Defaults to `ariaLabel`. */
    title?: string;
    size?: IconButtonSize;
    variant?: IconButtonVariant;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    children: React.ReactNode;
    className?: string;
}

const SIZE: Record<IconButtonSize, string> = {
    sm: 'p-1 [&>svg]:w-3.5 [&>svg]:h-3.5',
    md: 'p-1.5 [&>svg]:w-4 [&>svg]:h-4',
    lg: 'p-2 [&>svg]:w-5 [&>svg]:h-5',
};

const VARIANT: Record<IconButtonVariant, string> = {
    ghost: 'hover:bg-white/10 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
    subtle: 'bg-white/5 hover:bg-white/10 text-[var(--text-primary)]',
    danger: 'hover:bg-rose-500/10 text-[var(--text-tertiary)] hover:text-rose-500',
};

export default function IconButton({
    onClick,
    ariaLabel,
    title,
    size = 'md',
    variant = 'ghost',
    disabled = false,
    type = 'button',
    children,
    className = '',
}: IconButtonProps) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
            title={title ?? ariaLabel}
            className={
                'inline-flex items-center justify-center rounded transition-colors ' +
                'disabled:opacity-50 disabled:cursor-not-allowed ' +
                `${SIZE[size]} ${VARIANT[variant]} ${className}`
            }
        >
            {children}
        </button>
    );
}
