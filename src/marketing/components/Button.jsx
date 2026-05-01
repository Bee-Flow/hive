import React from 'react';

const variantClass = {
    primary:   'btn btn-primary',
    secondary: 'btn btn-secondary',
    login:     'btn btn-login',
};

export default function Button({ variant = 'primary', href, onClick, children, ...rest }) {
    const className = variantClass[variant] || 'btn';
    if (href) {
        return <a href={href} className={className} onClick={onClick} {...rest}>{children}</a>;
    }
    return <button type="button" className={className} onClick={onClick} {...rest}>{children}</button>;
}
