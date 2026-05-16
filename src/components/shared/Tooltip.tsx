import React, { useId, useState, useRef, useEffect } from 'react';

/**
 * Tooltip — accessible hover/focus tooltip. CSS-only positioning so we don't
 * depend on a popper library. For non-trivial positioning (large content,
 * collision avoidance), prefer a popover primitive instead.
 *
 * Renders the trigger inline and positions the tooltip absolutely above (or
 * below) the trigger via a single relative wrapper. The tooltip is removed
 * from the DOM when not visible so it never traps the cursor.
 */

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactElement;
    side?: TooltipSide;
    /** Delay before showing in milliseconds. */
    delay?: number;
    className?: string;
}

export default function Tooltip({
    content,
    children,
    side = 'top',
    delay = 250,
    className = '',
}: TooltipProps) {
    const [visible, setVisible] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const id = useId();

    const show = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setVisible(true), delay);
    };
    const hide = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setVisible(false);
    };
    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    const triggerProps = {
        'aria-describedby': visible ? id : undefined,
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
    } as const;

    const sidePos: React.CSSProperties =
        side === 'top'
            ? { bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' }
            : side === 'bottom'
                ? { top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' }
                : side === 'left'
                    ? { right: 'calc(100% + 6px)', top: '50%', transform: 'translateY(-50%)' }
                    : { left: 'calc(100% + 6px)', top: '50%', transform: 'translateY(-50%)' };

    const child = React.cloneElement(children, triggerProps);

    return (
        <span className={`relative inline-flex ${className}`}>
            {child}
            {visible && (
                <span
                    role="tooltip"
                    id={id}
                    className="absolute z-50 px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap pointer-events-none shadow-lg"
                    style={{
                        background: 'var(--bg-tooltip, rgba(15, 23, 42, 0.92))',
                        color: 'var(--text-tooltip, #fafafa)',
                        ...sidePos,
                    }}
                >
                    {content}
                </span>
            )}
        </span>
    );
}
