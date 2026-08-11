// Sandboxed-iframe popup modal for the marketing card grids — replaces
// the duplicated overlay/dialog/close/iframe markup + style constants,
// Esc-to-close effect and body scroll lock that were open-coded in both
// Features.jsx and Security.jsx.
//
// Always portaled to document.body (so no section's stacking context can
// paint over it) and locks body scroll while mounted — mount it only
// while open:
//
//   {openItem ? (
//       <PopupModal
//           title={openItem.title}
//           embedHtml={openItem.popupEmbed}
//           onClose={() => setOpenIdx(-1)}
//           modalStyle={{ maxWidth: '800px', maxHeight: '80vh', overflowY: 'auto' }}
//           iframeStyle={{ height: 0 }}
//       />
//   ) : null}
//
// `modalStyle` / `iframeStyle` are merged over the shared base styles so
// each section keeps its own sizing. The embed HTML gets the shared
// HEIGHT_SCRIPT shim prepended, so a freshly pasted snippet auto-sizes
// without needing to know the reportHeight contract.

import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import usePopupIframeHeight, { HEIGHT_SCRIPT } from './usePopupIframeHeight';
import useOutsideDismiss from '../../hooks/useOutsideDismiss';

export default function PopupModal({ title, embedHtml, onClose, modalStyle, iframeStyle }) {
    const dialogRef = useRef(null);
    const iframeRef = usePopupIframeHeight();

    // Escape and any interaction outside the dialog (i.e. on the
    // overlay) close the popup. The component is only mounted while
    // open, so the listeners never linger.
    useOutsideDismiss(dialogRef, onClose);

    // Lock body scroll while the popup is open; cleanup restores it
    // even if the component unmounts mid-open.
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    return ReactDOM.createPortal(
        <div style={overlayStyle} role="presentation">
            <div
                ref={dialogRef}
                style={{ ...baseModalStyle, ...modalStyle }}
                role="dialog"
                aria-modal="true"
                aria-label={title || 'Card details'}
            >
                <button
                    type="button"
                    onClick={onClose}
                    style={closeStyle}
                    aria-label="Close"
                >
                    ×
                </button>
                <div style={iframeWrapStyle}>
                    <iframe
                        ref={iframeRef}
                        srcDoc={embedHtml ? HEIGHT_SCRIPT + embedHtml : ''}
                        sandbox="allow-scripts"
                        title={title || 'Card details'}
                        style={{ ...baseIframeStyle, ...iframeStyle }}
                    />
                </div>
            </div>
        </div>,
        document.body
    );
}

// Inline styles for the popup — kept here so the component stays self-
// contained and doesn't require additions to marketing.css.
const overlayStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 9999,
};

// Sizing (width/height caps and floors, scroll behavior) is left to the
// caller's `modalStyle` so each section keeps its own dimensions. Radius
// and shadow reference the marketing tokens (with hard fallbacks so the
// modal also renders correctly if portaled outside the marketing root);
// the token card shadow is layered under a deeper drop for the overlay
// context.
const baseModalStyle = {
    position: 'relative',
    background: 'var(--bg-primary, #ffffff)',
    borderRadius: 'var(--radius-lg, 16px)',
    boxShadow: 'var(--shadow-card, 0 4px 24px rgba(15, 23, 42, 0.08)), 0 30px 80px -20px rgba(0, 0, 0, 0.4)',
    zIndex: 10000,
};

const closeStyle = {
    position: 'absolute',
    top: '8px',
    right: '12px',
    width: '32px',
    height: '32px',
    border: 'none',
    background: 'transparent',
    borderRadius: 'var(--radius-sm, 8px)',
    fontSize: '24px',
    lineHeight: 1,
    cursor: 'pointer',
    color: 'var(--text-secondary, #475569)',
    zIndex: 1,
};

// overflow:hidden on the wrap so the iframe's own borders don't peek
// out before the height-report message lands.
const iframeWrapStyle = {
    overflow: 'hidden',
};

// Height is caller-supplied via `iframeStyle`: the reportHeight
// postMessage handler grows the iframe by writing the pixel value
// straight to iframe.style.height, which overrides whatever height
// the caller starts from (0, '100%', …) while min-height keeps any
// floor the caller sets.
const baseIframeStyle = {
    width: '100%',
    border: 0,
    display: 'block',
};
