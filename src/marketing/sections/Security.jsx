import React, { useState, useEffect, useRef } from 'react';
import SectionHeader from '../components/SectionHeader';
import AppIcon from '../../components/AppIcon';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';
import { inlineTextStyle } from './textStyle';

// Same height-report contract as Features.jsx — the popup iframe posts
// `{ type: 'reportHeight', height }` on load and on every body resize,
// and the parent grows the iframe to match.
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

export default function Security({ data }) {
    // Hooks must run unconditionally — declare them BEFORE the `enabled`
    // early-return so toggling enabled on/off doesn't change hook order.
    const [openIdx, setOpenIdx] = useState(-1);
    const popupIframeRef = useRef(null);

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

    useEffect(() => {
        if (openIdx === -1) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setOpenIdx(-1); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [openIdx]);

    if (!data?.enabled) return null;

    const cards = data.cards || [];
    const openCard = openIdx >= 0 ? cards[openIdx] : null;
    const popupSrcdoc = openCard?.popupEmbed
        ? HEIGHT_SCRIPT + openCard.popupEmbed
        : '';

    return (
        <SectionFrame id="security" name="Security" enabled={data.enabled}>
            <section id="security">
                <div className="container">
                    <SectionHeader
                        pathPrefix="security"
                        eyebrow={data.eyebrow} title={data.title} lead={data.lead}
                        eyebrowStyle={data.eyebrowStyle} titleStyle={data.titleStyle} leadStyle={data.leadStyle}
                        eyebrowAlign={data.eyebrowAlign} titleAlign={data.titleAlign} leadAlign={data.leadAlign} align={data.align}
                    />
                    <div className="security-grid">
                        {cards.map((card, i) => {
                            // cardAction drives the wrapper:
                            //   'link'  → <a> opening cardUrl in a new tab
                            //   'popup' → <div> with click → modal iframe
                            //   'none'  → plain static <div>
                            const cardAction = card.cardAction || 'none';
                            const hasLink  = cardAction === 'link'
                                && typeof card.cardUrl === 'string'
                                && card.cardUrl.trim() !== '';
                            const hasPopup = cardAction === 'popup'
                                && typeof card.popupEmbed === 'string'
                                && card.popupEmbed.trim() !== '';
                            const className = `security-card reveal reveal-delay-${Math.min(i + 1, 6)}`;

                            const inner = (
                                <>
                                    <div className="security-card-head">
                                        {card.icon ? (
                                            <div className="icon-tile"><AppIcon name={card.icon} className="w-5 h-5" /></div>
                                        ) : null}
                                        <div>
                                            <EditableText
                                                as="h3"
                                                path={`security.cards.${i}.title`}
                                                multiline
                                                placeholder="Card title"
                                                className="headline-md"
                                                style={inlineTextStyle(undefined, card.titleAlign)}
                                            >
                                                {card.title || ''}
                                            </EditableText>
                                            <EditableText
                                                as="p"
                                                path={`security.cards.${i}.summary`}
                                                multiline
                                                placeholder="Summary"
                                                className="body-md"
                                                style={inlineTextStyle(undefined, card.summaryAlign)}
                                            >
                                                {card.summary || ''}
                                            </EditableText>
                                        </div>
                                    </div>
                                    {card.details?.length ? (
                                        <div className="security-card-detail">
                                            <ul>
                                                {card.details.map((d, j) => (
                                                    <li key={j}>
                                                        <EditableText path={`security.cards.${i}.details.${j}`} placeholder="Detail">
                                                            {d || ''}
                                                        </EditableText>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : null}
                                </>
                            );

                            if (hasLink) {
                                // Anchor wrap — preserves the .security-card
                                // class so existing styles apply. onClick
                                // guard cancels link activation when the
                                // click landed on a contentEditable so
                                // inline-editing keeps working in preview.
                                return (
                                    <a
                                        key={i}
                                        href={card.cardUrl}
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

            {openCard ? (
                <div style={overlayStyle} onClick={() => setOpenIdx(-1)} role="presentation">
                    <div
                        style={modalStyle}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label={openCard.title || 'Card details'}
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
                                title={openCard.title || 'Card details'}
                                style={iframeStyle}
                            />
                        </div>
                    </div>
                </div>
            ) : null}
        </SectionFrame>
    );
}

// Inline styles for the popup — kept here so the block stays self-
// contained and doesn't require additions to marketing.css. Mirrors
// Features.jsx so both blocks share the same modal look.
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
    width: '100%',
    maxWidth: '800px',
    maxHeight: '80vh',
    overflowY: 'auto',
    background: 'var(--bg-primary, #ffffff)',
    borderRadius: '16px',
    boxShadow: '0 30px 80px -20px rgba(0, 0, 0, 0.4)',
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

const iframeWrapStyle = {
    overflow: 'hidden',
};

const iframeStyle = {
    width: '100%',
    height: 0,
    border: 0,
    display: 'block',
};
