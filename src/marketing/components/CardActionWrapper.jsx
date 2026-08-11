// Card wrapper for the marketing grids — replaces the duplicated
// link/popup/none `cardAction` logic that was open-coded in both
// Features.jsx and Security.jsx. The card's `cardAction` drives the
// wrapper element:
//   'link'  → <a> to cardUrl — same tab for an internal path,
//             new tab for anything off-site
//   'popup' → <div> with click/Enter/Space → onOpenPopup (modal iframe)
//   'none'  → plain static <div>
// Missing fields collapse to 'none' so old cards without these keys
// render exactly as before.
//
// Usage:
//   <CardActionWrapper
//       key={i}
//       card={item}
//       className={`feature-card reveal reveal-delay-${Math.min(i + 1, 6)}`}
//       onOpenPopup={() => setOpenIdx(i)}
//   >
//       {…inner card markup…}
//   </CardActionWrapper>
//
// The click guards let users keep inline-editing card text in preview:
// activation is cancelled when the click landed on a `.cms-editable`
// contentEditable.

import React from 'react';

/* A card link used to be assumed external, so the wrapper hard-coded
   target="_blank". Cards now also point at our own pages — the /compare hub
   routes to every comparison page this way — and sending a visitor to another
   tab to move within the same site is disorienting: the back button stops
   working and they end up with a tab per card.

   Internal means a root-relative path. `//evil.com` is protocol-relative and
   therefore external, which is why the second character is checked. */
function isInternalPath(url) {
    return typeof url === 'string'
        && url.startsWith('/')
        && !url.startsWith('//');
}

export default function CardActionWrapper({ card, className, onOpenPopup, children, ...rest }) {
    const cardAction = card.cardAction || 'none';
    const hasLink = cardAction === 'link'
        && typeof card.cardUrl === 'string'
        && card.cardUrl.trim() !== '';
    const hasPopup = cardAction === 'popup'
        && typeof onOpenPopup === 'function'
        && typeof card.popupEmbed === 'string'
        && card.popupEmbed.trim() !== '';

    if (hasLink) {
        // Anchor wrap — clicks anywhere on the card navigate. The
        // onClick guard cancels the default link activation when the
        // click landed on a contentEditable.
        const internal = isInternalPath(card.cardUrl.trim());
        return (
            <a
                {...rest}
                href={card.cardUrl}
                target={internal ? undefined : '_blank'}
                rel={internal ? undefined : 'noopener noreferrer'}
                className={className}
                style={linkStyle}
                onClick={(e) => {
                    if (e.target.closest && e.target.closest('.cms-editable')) {
                        e.preventDefault();
                    }
                }}
            >
                {children}
            </a>
        );
    }

    return (
        <div
            {...rest}
            className={className}
            onClick={hasPopup ? (e) => {
                if (e.target.closest && e.target.closest('.cms-editable')) return;
                onOpenPopup();
            } : undefined}
            style={hasPopup ? { cursor: 'pointer' } : undefined}
            role={hasPopup ? 'button' : undefined}
            tabIndex={hasPopup ? 0 : undefined}
            onKeyDown={hasPopup ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    if (e.target.closest && e.target.closest('.cms-editable')) return;
                    e.preventDefault();
                    onOpenPopup();
                }
            } : undefined}
        >
            {children}
        </div>
    );
}

// Neutralises the default anchor look so the section's card class
// stays in charge of the visuals.
const linkStyle = {
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
    cursor: 'pointer',
};
