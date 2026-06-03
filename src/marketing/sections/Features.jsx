import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import SectionHeader from '../components/SectionHeader';
import AppIcon from '../../components/AppIcon';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';
import { inlineTextStyle } from './textStyle';

// Script prepended to every popup iframe's srcDoc. It reports the body's
// scroll height to the parent on load and on every resize, so the parent
// can grow the iframe to fit. Matches the documented contract used by
// the LiveComponent block, with a different message type so each block's
// listener only reacts to its own iframes.
const HEIGHT_SCRIPT = `<script>
function reportHeight() {
  window.parent.postMessage(
    { type: "reportHeight", height: document.body.scrollHeight },
    "*"
  );
}
window.addEventListener("load", reportHeight);
new ResizeObserver(reportHeight).observe(document.body);
<\/script>`;

export default function Features({ data }) {
    // Hooks must run unconditionally — declare them BEFORE the
    // `enabled` early-return so toggling enabled on/off doesn't
    // change the hook count between renders.
    const [openIdx, setOpenIdx] = useState(-1);
    const popupIframeRef = useRef(null);

    // Listen for height reports from the popup iframe and grow it to
    // match. Scoped to `type === 'reportHeight'` so unrelated postMessage
    // chatter (cms-edit, etc.) is ignored.
    useEffect(() => {
        const handler = (event) => {
            if (event.data && event.data.type === 'reportHeight') {
                const iframe = popupIframeRef.current;
                if (iframe && typeof event.data.height === 'number') {
                    iframe.style.height = event.data.height + 'px';
                }
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    // Esc closes the popup. Only registered while one is open.
    useEffect(() => {
        if (openIdx === -1) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setOpenIdx(-1); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [openIdx]);

    // Lock body scroll while the popup is open; cleanup restores it
    // even if the component unmounts mid-open.
    const open = openIdx !== -1;
    useEffect(() => {
        if (open) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    if (!data?.enabled) return null;

    const items = data.items || [];
    const openItem = openIdx >= 0 ? items[openIdx] : null;
    // Prepend the height-report shim to the user's HTML so a freshly
    // pasted snippet auto-sizes without needing to know the contract.
    const popupSrcdoc = openItem?.popupEmbed
        ? HEIGHT_SCRIPT + openItem.popupEmbed
        : '';

    return (
        <SectionFrame id="features" name="Features" enabled={data.enabled}>
            <section id="features">
                <div className="container">
                    <SectionHeader
                        pathPrefix="features"
                        eyebrow={data.eyebrow} title={data.title} lead={data.lead}
                        eyebrowStyle={data.eyebrowStyle} titleStyle={data.titleStyle} leadStyle={data.leadStyle}
                        eyebrowAlign={data.eyebrowAlign} titleAlign={data.titleAlign} leadAlign={data.leadAlign} align={data.align}
                    />
                    <div className="features-grid">
                        {items.map((item, i) => {
                            // cardAction drives the wrapper element:
                            //   'link'  → <a> opening cardUrl in a new tab
                            //   'popup' → <div> with click → modal iframe
                            //   'none'  → plain static <div>
                            // Missing fields collapse to 'none' so old cards
                            // without these keys render exactly as before.
                            const cardAction = item.cardAction || 'none';
                            const hasLink  = cardAction === 'link'
                                && typeof item.cardUrl === 'string'
                                && item.cardUrl.trim() !== '';
                            const hasPopup = cardAction === 'popup'
                                && typeof item.popupEmbed === 'string'
                                && item.popupEmbed.trim() !== '';
                            const className = `feature-card reveal reveal-delay-${Math.min(i + 1, 6)}`;

                            const inner = (
                                <>
                                    {item.icon ? (
                                        <div className="icon-tile"><AppIcon name={item.icon} className="w-6 h-6" /></div>
                                    ) : null}
                                    <EditableText
                                        as="h3"
                                        path={`features.items.${i}.title`}
                                        multiline
                                        placeholder="Feature title"
                                        className="headline-md"
                                        style={inlineTextStyle({ color: item.titleColor }, item.titleAlign)}
                                    >
                                        {item.title || ''}
                                    </EditableText>
                                    <EditableText
                                        as="p"
                                        path={`features.items.${i}.body`}
                                        multiline
                                        placeholder="Feature description"
                                        className="body-md"
                                        style={inlineTextStyle({ color: item.bodyColor }, item.bodyAlign)}
                                    >
                                        {item.body || ''}
                                    </EditableText>
                                </>
                            );

                            if (hasLink) {
                                // Anchor wrap — clicks anywhere on the card
                                // navigate. The onClick guard lets users keep
                                // inline-editing title/body in preview by
                                // cancelling the default link activation when
                                // the click landed on a contentEditable.
                                return (
                                    <a
                                        key={i}
                                        href={item.cardUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={className}
                                        style={{
                                            textDecoration: 'none',
                                            color: 'inherit',
                                            display: 'block',
                                            cursor: 'pointer',
                                        }}
                                        onClick={(e) => {
                                            if (e.target.closest && e.target.closest('.cms-editable')) {
                                                e.preventDefault();
                                            }
                                        }}
                                    >
                                        {inner}
                                    </a>
                                );
                            }

                            return (
                                <div
                                    key={i}
                                    className={className}
                                    onClick={hasPopup ? (e) => {
                                        if (e.target.closest && e.target.closest('.cms-editable')) return;
                                        setOpenIdx(i);
                                    } : undefined}
                                    style={hasPopup ? { cursor: 'pointer' } : undefined}
                                    role={hasPopup ? 'button' : undefined}
                                    tabIndex={hasPopup ? 0 : undefined}
                                    onKeyDown={hasPopup ? (e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            if (e.target.closest && e.target.closest('.cms-editable')) return;
                                            e.preventDefault();
                                            setOpenIdx(i);
                                        }
                                    } : undefined}
                                >
                                    {inner}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {openItem ? ReactDOM.createPortal(
                // Overlay click closes; modal click is stopped so it doesn't
                // bubble through to the overlay. Portaled to document.body
                // so no section's stacking context can paint over it.
                <div style={overlayStyle} onClick={() => setOpenIdx(-1)} role="presentation">
                    <div
                        style={modalStyle}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label={openItem.title || 'Card details'}
                    >
                        <button
                            type="button"
                            onClick={() => setOpenIdx(-1)}
                            style={closeStyle}
                            aria-label="Close"
                        >
                            ×
                        </button>
                        <div style={iframeWrapStyle}>
                            <iframe
                                ref={popupIframeRef}
                                srcDoc={popupSrcdoc}
                                sandbox="allow-scripts"
                                title={openItem.title || 'Card details'}
                                style={iframeStyle}
                            />
                        </div>
                    </div>
                </div>,
                document.body
            ) : null}
        </SectionFrame>
    );
}

// Inline styles for the popup — kept here so the block stays self-
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

const modalStyle = {
    position: 'relative',
    // Fills most of the viewport: 90vw, capped at 1100px on wide
    // screens. Floor of 80vh on the height so the modal feels
    // substantial even when the popup content is short.
    width: '90vw',
    maxWidth: '1100px',
    height: 'auto',
    minHeight: '80vh',
    background: 'var(--bg-primary, #ffffff)',
    borderRadius: '16px',
    boxShadow: '0 30px 80px -20px rgba(0, 0, 0, 0.4)',
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

const iframeStyle = {
    width: '100%',
    // Floor of 80vh so a short snippet still fills the modal. The
    // reportHeight postMessage handler still grows the iframe past
    // this floor when content is taller, by writing the pixel value
    // straight to iframe.style.height — that inline override beats
    // height:'100%' here while min-height keeps the floor.
    height: '100%',
    minHeight: '80vh',
    border: 0,
    display: 'block',
};
