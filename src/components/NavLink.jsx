import React from 'react';

/**
 * NavLink – renders an <a> tag that behaves as an SPA link on normal left-click
 * but exposes full browser link behaviour (right-click → open in new tab,
 * middle-click, Ctrl/Cmd+click, status-bar URL preview, etc.).
 *
 * Props:
 *   href        – the destination path (e.g. "/admin")
 *   onNavigate  – SPA navigation callback, invoked on plain left-click
 *   className   – forwarded to <a>
 *   style       – forwarded to <a>
 *   children    – content
 *   ...rest     – any other props forwarded to <a>
 */
const NavLink = ({ href, onNavigate, children, onClick, ...rest }) => {
    const handleClick = (e) => {
        // Let the browser handle modified clicks (new-tab shortcuts)
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

        e.preventDefault();
        if (onClick) onClick(e);
        if (onNavigate) onNavigate();
    };

    return (
        <a href={href} onClick={handleClick} {...rest}>
            {children}
        </a>
    );
};

export default NavLink;
