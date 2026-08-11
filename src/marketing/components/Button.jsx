import React from 'react';

const variantClass = {
    primary:   'btn btn-primary',
    secondary: 'btn btn-secondary',
    ghost:     'btn btn-ghost',
    link:      'btn btn-link',
    // Legacy alias kept for any caller that still passes 'login'.
    login:     'btn btn-login',
};

const isPreview = () =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('preview');

/**
 * `size` ('sm' | 'md' | 'lg') is a PER-INSTANCE override — site-wide button
 * sizing comes from the theme's `components.buttonSize` token instead, so
 * most call sites should omit it.
 *
 * `className` is merged rather than spread-overwritten: it used to be set
 * before {...rest}, so any caller passing className silently replaced
 * "btn btn-primary" and the button lost all of its styling.
 */
export default function Button({ variant = 'primary', size, href, onClick, className, children, ...rest }) {
    const cls = [
        variantClass[variant] || 'btn',
        size ? `btn--${size}` : '',
        className || '',
    ].filter(Boolean).join(' ');
    const handleClick = (e) => {
        // Suppress navigation during preview so the iframe stays on the
        // marketing page and admins can keep editing.
        if (isPreview() && href) e.preventDefault();
        if (onClick) onClick(e);
    };
    if (href) {
        return (
            <a href={href} className={cls} onClick={handleClick} {...rest}>
                {children}
            </a>
        );
    }
    return <button type="button" className={cls} onClick={handleClick} {...rest}>{children}</button>;
}
