import React, { useRef } from 'react';
import CmdTip from './CmdTip';
import useCmdTip from './useCmdTip';

/**
 * A single ribbon command button: icon + label. `big` renders the headline
 * vertical style (icon over label); otherwise a compact icon-left row that
 * packs into a RibbonCluster's 2-row grid.
 *
 * Glyph resolution: `icon` (a lucide component, sized internally) wins over
 * `glyph` (a pre-sized ReactNode — e.g. an <IntegrationLogo/>). The glyph prop
 * keeps this file free of feature imports.
 *
 * Explaining what a command DOES: pass `desc` and the button grows a styled
 * screen tip (CmdTip) showing the full label, the description and `tipFooter`.
 * Without `desc` it keeps the plain `title` attribute, so callers that never had
 * a description (App Studio's ComponentRibbon) are untouched.
 *
 * dnd-kit support (App Studio palette) is opt-in and inert otherwise:
 *   buttonRef  — forwarded to the <button> (useDraggable's setNodeRef)
 *   dragging   — dims the button while its drag preview is out
 *   grabbable  — grab cursor + touchAction:none (required for touch drag)
 *   ...rest    — spread LAST so dnd glue (onPointerDown, aria-describedby)
 *                can never be clobbered; this component must not define its
 *                own onPointerDown.
 */

const COMPACT = 'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition disabled:opacity-50';
const BIG = 'flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-md text-[11px] font-semibold transition disabled:opacity-50';
// The accent variant is the ribbon's ONE highlighted command. Tinted rather
// than merely coloured: bare accent text next to near-black neighbours read as
// washed out — users took the AI step for a disabled button.
const BIG_ACCENT = 'text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/30 hover:bg-[var(--accent)]/20';
const BIG_PLAIN = 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]';
const GRAB = 'select-none cursor-grab active:cursor-grabbing';

function buttonClass({ big, accent, grabbable }) {
    const parts = big ? [BIG, accent ? BIG_ACCENT : BIG_PLAIN] : [COMPACT];
    if (grabbable) parts.push(GRAB);
    return parts.join(' ');
}

function buttonStyle({ dragging, grabbable }) {
    const style = {};
    if (dragging) style.opacity = 0.4;
    if (grabbable) style.touchAction = 'none';
    return style;
}

export default function CmdButton({
    icon: Icon = null,
    glyph = null,
    label,
    title,
    // The heading of the screen tip, when the button's own label is an
    // abbreviated form of the real name — an app shown as "Talk" inside a
    // cluster captioned NEXTCLOUD still has "Nextcloud Talk" as its name, and
    // the tip is where the full one belongs.
    tipTitle = null,
    desc = null,
    tipFooter = null,
    onClick,
    big = false,
    accent = false,
    disabled = false,
    dragging = false,
    grabbable = false,
    buttonRef = null,
    ...rest
}) {
    // The rich tip and the native tooltip are mutually exclusive: showing both
    // gives the user two overlapping explanations of the same button.
    const localRef = useRef(null);
    const anchorRef = buttonRef || localRef;
    const tipped = !!desc;
    const { open, hoverProps, dismiss } = useCmdTip(tipped);

    const button = (
        <button
            type="button"
            ref={anchorRef}
            disabled={disabled}
            title={tipped ? undefined : title}
            onClick={(e) => { dismiss?.(e); onClick?.(e); }}
            style={buttonStyle({ dragging, grabbable })}
            className={buttonClass({ big, accent, grabbable })}
            {...hoverProps}
            {...rest}
        >
            {Icon ? <Icon size={big ? 18 : 14} /> : glyph}
            {/* 10rem, not 8: at 8rem the longest labels were clipped mid-word on
                the ribbon — "Check for personal d…" — and the clipped one was
                the privacy step, the thing the product is for. The tip carries
                the full name either way, but a label you cannot read is not a
                label. `big` is a lone headline command with room to spare. */}
            <span className={big ? undefined : 'truncate max-w-[10rem]'}>{label}</span>
        </button>
    );

    if (!tipped) return button;
    return (
        <>
            {button}
            <CmdTip anchorRef={anchorRef} open={open && !disabled} title={tipTitle || label} desc={desc} footer={tipFooter} />
        </>
    );
}
