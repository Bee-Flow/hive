/**
 * Drawer — an edge-docked workspace panel.
 *
 *  mode="push"     (desktop) renders inline in the flex row and animates its
 *                  width 0 ↔ W so the editor column reflows. No backdrop.
 *  mode="overlay"  (tablet)  slides over the editor with a scrim; click-scrim or
 *                  Escape closes. Used below the desktop breakpoint (wired in W6).
 *
 * The right drawer is resizable via a grab strip on its inner edge. Styling is
 * token-only so it adapts to every theme. This is deliberately NOT <Modal/>: a
 * push drawer must not trap focus or dim the page.
 */
import React, { useEffect } from 'react';

function ResizeStrip({ onMouseDown, side }) {
    return (
        <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={onMouseDown}
            className="w-[5px] shrink-0 cursor-col-resize transition-colors hover:bg-[var(--accent-primary)] z-10"
            style={{ [side === 'right' ? 'borderLeft' : 'borderRight']: '1px solid var(--border-subtle)' }}
        />
    );
}

export default function Drawer({
    side = 'left',
    open,
    width = 280,
    mode = 'push',
    resizable = false,
    onResizeStart,
    onClose,
    label,
    children,
}) {
    // Escape closes overlay drawers.
    useEffect(() => {
        if (mode !== 'overlay' || !open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [mode, open, onClose]);

    const panel = (
        <div
            className="flex-1 min-w-0 flex flex-col overflow-hidden"
            style={{ background: 'var(--bg-secondary)' }}
            role="complementary"
            aria-label={label}
        >
            {children}
        </div>
    );

    if (mode === 'overlay') {
        if (!open) return null;
        return (
            <>
                <div
                    className="absolute inset-0 z-20"
                    style={{ background: 'rgba(0,0,0,0.45)' }}
                    onClick={onClose}
                    aria-hidden="true"
                />
                <div
                    className={`absolute top-0 bottom-0 ${side === 'left' ? 'left-0' : 'right-0'} z-30 flex shadow-2xl`}
                    style={{ width }}
                >
                    {side === 'right' && resizable && <ResizeStrip side="right" onMouseDown={onResizeStart} />}
                    {panel}
                    {side === 'left' && resizable && <ResizeStrip side="left" onMouseDown={onResizeStart} />}
                </div>
            </>
        );
    }

    // push mode — collapse to width 0 when closed.
    return (
        <div
            className="shrink-0 flex overflow-hidden transition-[width] duration-200 ease-out"
            style={{ width: open ? width : 0 }}
        >
            {side === 'right' && resizable && open && <ResizeStrip side="right" onMouseDown={onResizeStart} />}
            <div
                className="flex flex-col overflow-hidden"
                style={{
                    width: resizable ? width - (open ? 5 : 0) : width,
                    background: 'var(--bg-secondary)',
                    borderRight: side === 'left' ? '1px solid var(--border-subtle)' : undefined,
                }}
            >
                {open && panel}
            </div>
            {side === 'left' && resizable && open && <ResizeStrip side="left" onMouseDown={onResizeStart} />}
        </div>
    );
}
