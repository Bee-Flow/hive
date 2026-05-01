import React from 'react';

const variantClass = {
    primary:   'btn btn-primary',
    secondary: 'btn btn-secondary',
    login:     'btn btn-login',
};

const isPreview = () =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('preview');

export default function Button({ variant = 'primary', href, onClick, children, ...rest }) {
    const className = variantClass[variant] || 'btn';
    const handleClick = (e) => {
        // Suppress navigation during preview so the iframe stays on the
        // marketing page and admins can keep editing.
        if (isPreview() && href) e.preventDefault();
        if (onClick) onClick(e);
    };
    if (href) {
        return (
            <a href={href} className={className} onClick={handleClick} {...rest}>
                {children}
            </a>
        );
    }
    return <button type="button" className={className} onClick={handleClick} {...rest}>{children}</button>;
}
