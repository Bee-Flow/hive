import React from 'react';
import Button from '../components/Button';
import AppIcon from '../../components/AppIcon';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';
import { inlineTextStyle } from './textStyle';

export default function Hero({ data }) {
    if (!data?.enabled) return null;

    // Sub-objects normalised once so the JSX below stays compact and we
    // don't repeat `data.x || {}` everywhere. Old hero blocks may not
    // have any of the new fields — every read here treats missing as
    // "use the original behaviour" (enabled defaults true, style empty,
    // labels fall back to hard-coded defaults).
    const titleParts = data.titleParts || [];
    const bubbles    = data.mockup?.chatBubbles || [];

    const badge   = data.badge        || {};
    const primary = data.primaryCta   || {};
    const second  = data.secondaryCta || {};
    const mockup  = data.mockup       || {};

    // Visibility gates — `enabled !== false` so old blocks (no `enabled`
    // key) render every section, matching today's behaviour.
    const showBadge     = (badge.text || badge.icon) && badge.enabled !== false;
    const showLead      = data.leadEnabled !== false;
    const showPrimary   = primary.enabled !== false;
    const showSecondary = second.enabled  !== false;
    const showMockup    = mockup.enabled  !== false;

    // Per-text inline styles — `inlineTextStyle` returns `undefined`
    // when nothing applies, so an unstyled block emits no inline style
    // attribute at all (and the CSS file's defaults still win). The
    // second arg is the field's own alignment (`{field}Align`), falling
    // back to the block's legacy single `align` when that field hasn't
    // been aligned individually yet.
    const badgeTextStyle = inlineTextStyle(data.badgeStyle);
    const titleStyle     = inlineTextStyle(data.titleStyle, data.titleAlign || data.align);
    const leadStyle      = inlineTextStyle(data.leadStyle, data.leadAlign || data.align);
    // Badge alignment positions the inline-flex pill within the hero
    // column, applied via a per-field wrapper's text-align.
    const badgeAlign     = data.badgeAlign || data.align || null;

    // legacyifyLinks (admin preview) flattens link → href; resolveLinksInTree
    // (public site) leaves it on link.href. Read both so the same component
    // works on both paths. Falls back to the old hard-coded `/app` and
    // `#features` defaults to preserve the original behaviour for blocks
    // that never explicitly set a link.
    const primaryHref   = primary.href || primary.link?.href || '/app';
    const secondaryHref = second.href  || second.link?.href  || '#features';

    // "Open in new tab" is stored on the link object by the shared
    // LinkField (`link.newTab`). Also accept a top-level `openInNewTab`
    // for forward-compat with blocks that put the flag on the CTA itself.
    const primaryNewTab   = !!(primary.link?.newTab || primary.openInNewTab);
    const secondaryNewTab = !!(second.link?.newTab  || second.openInNewTab);
    const newTabProps = (on) => (on ? { target: '_blank', rel: 'noopener noreferrer' } : null);

    // Background variant — same scale as Media + Text and Content blocks.
    // 'default' produces no extra class (page bg shows through); the
    // others map to the shared .cms-bg--* utilities in marketing.css.
    const bgVariant = data.backgroundVariant || 'default';
    const sectionClass = ['hero', bgVariant !== 'default' ? `cms-bg--${bgVariant}` : '']
        .filter(Boolean).join(' ');

    return (
        <SectionFrame id="hero" name="Hero" enabled={data.enabled}>
            <section className={sectionClass} id="hero">
                <div className="container">
                    <div className="hero-content">
                        {showBadge ? (
                            <div style={badgeAlign ? { textAlign: badgeAlign } : undefined}>
                                <div className="hero-badge reveal" style={badgeTextStyle}>
                                    {badge.icon ? <AppIcon name={badge.icon} className="w-4 h-4" /> : null}
                                    <EditableText path="hero.badge.text" placeholder="Badge text">
                                        {badge.text || ''}
                                    </EditableText>
                                </div>
                            </div>
                        ) : null}
                        <h1
                            className="headline-xl reveal reveal-delay-1"
                            style={{
                                fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                                hyphens: 'none',
                                overflowWrap: 'break-word',
                                wordBreak: 'break-word',
                                ...titleStyle,
                            }}
                        >
                            {titleParts.map((part, i) => (
                                <EditableText
                                    key={i}
                                    path={`hero.titleParts.${i}.text`}
                                    placeholder="…"
                                    multiline
                                    className={part.gradient ? 'gradient-text' : ''}
                                >
                                    {part.text || ''}
                                </EditableText>
                            ))}
                        </h1>
                        {showLead ? (
                            <EditableText
                                path="hero.lead"
                                as="p"
                                multiline
                                placeholder="Lead paragraph"
                                className="hero-lead body-lg reveal reveal-delay-2"
                                style={leadStyle}
                            >
                                {data.lead || ''}
                            </EditableText>
                        ) : null}
                        {(showPrimary || showSecondary) ? (
                            <div className="hero-ctas reveal reveal-delay-3">
                                {showPrimary ? (
                                    <Button variant={primary.style || 'primary'} href={primaryHref} {...newTabProps(primaryNewTab)}>
                                        <EditableText path="hero.primaryCta.label" placeholder="Primary action">
                                            {primary.label || 'Get started'}
                                        </EditableText>
                                    </Button>
                                ) : null}
                                {showSecondary ? (
                                    <Button variant={second.style || 'secondary'} href={secondaryHref} {...newTabProps(secondaryNewTab)}>
                                        <EditableText path="hero.secondaryCta.label" placeholder="Secondary action">
                                            {second.label || 'Learn more'}
                                        </EditableText>
                                    </Button>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                    {(showMockup && bubbles.length) ? (
                        <div className="hero-mockup reveal reveal-delay-4">
                            <div className="mockup-header">
                                <span className="mockup-dot" /><span className="mockup-dot" /><span className="mockup-dot" />
                            </div>
                            <div className="mockup-body">
                                {bubbles.map((b, i) => (
                                    <div
                                        key={i}
                                        className={`chat-bubble chat-bubble--${b.role === 'user' ? 'user' : 'ai'}`}
                                        style={{ animationDelay: `${0.5 + i * 0.4}s` }}
                                    >
                                        <EditableText
                                            path={`hero.mockup.chatBubbles.${i}.text`}
                                            multiline
                                            placeholder="Bubble text"
                                        >
                                            {b.text || ''}
                                        </EditableText>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            </section>
        </SectionFrame>
    );
}
