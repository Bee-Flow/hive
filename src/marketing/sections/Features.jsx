import React, { useState } from 'react';
import { inlineTextStyle } from './textStyle';
import AppIcon from '../../components/AppIcon';
import CardActionWrapper from '../components/CardActionWrapper';
import EditableText from '../components/EditableText';
import FramedMedia from '../components/FramedMedia';
import PopupModal from '../components/PopupModal';
import SectionFrame from '../components/SectionFrame';
import { sectionBgClass } from './sectionBg';
import SectionHeader from '../components/SectionHeader';

// Spotlight hover — writes the cursor position into CSS vars the
// .feature-card--spotlight::after radial highlight reads.
function trackSpotlight(e) {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
}

export default function Features({ data }) {
    // Hooks must run unconditionally — declared BEFORE the
    // `enabled` early-return so toggling enabled on/off doesn't
    // change the hook count between renders.
    const [openIdx, setOpenIdx] = useState(-1);

    if (!data?.enabled) return null;

    const items = data.items || [];
    const openItem = openIdx >= 0 ? items[openIdx] : null;

    // 'bento' variant: asymmetric spans + per-card media slots; absent/
    // unknown ⇒ the classic uniform 3-up grid. Spotlight hover is opt-in
    // (one grid per page keeps it a signature, not a gimmick).
    const variant = data.variant === 'bento' ? 'bento' : 'classic';
    const isBento = variant === 'bento';
    const spotlight = isBento && data.spotlight === true;
    const gridClass = `features-grid${isBento ? ' features-grid--bento' : ''}`;

    return (
        <SectionFrame id="features" name="Features" enabled={data.enabled}>
            <section id="features" className={sectionBgClass(data)}>
                <div className="container">
                    <SectionHeader
                        pathPrefix="features"
                        eyebrow={data.eyebrow} title={data.title} lead={data.lead}
                        eyebrowStyle={data.eyebrowStyle} titleStyle={data.titleStyle} leadStyle={data.leadStyle}
                        eyebrowAlign={data.eyebrowAlign} titleAlign={data.titleAlign} leadAlign={data.leadAlign} align={data.align}
                    />
                    <div className={gridClass}>
                        {items.map((item, i) => {
                            const span2 = isBento && Number(item.span) === 2;
                            const hasItemMedia = isBento &&
                                typeof item.media?.src === 'string' && item.media.src.trim() !== '';
                            const cardClass = [
                                'feature-card',
                                `reveal reveal-delay-${Math.min(i + 1, 6)}`,
                                span2 ? 'feature-card--span-2' : '',
                                spotlight ? 'feature-card--spotlight' : '',
                            ].filter(Boolean).join(' ');
                            return (
                                <CardActionWrapper
                                    key={i}
                                    card={item}
                                    className={cardClass}
                                    onOpenPopup={() => setOpenIdx(i)}
                                    {...(spotlight ? { onMouseMove: trackSpotlight } : {})}
                                >
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
                                    {hasItemMedia ? (
                                        <div className="feature-media">
                                            <FramedMedia media={item.media} glow={false} />
                                        </div>
                                    ) : null}
                                </CardActionWrapper>
                            );
                        })}
                    </div>
                </div>
            </section>

            {openItem ? (
                <PopupModal
                    title={openItem.title}
                    embedHtml={openItem.popupEmbed}
                    onClose={() => setOpenIdx(-1)}
                    // Fills most of the viewport: 90vw, capped at 1100px on
                    // wide screens. Floor of 80vh on modal and iframe so the
                    // modal feels substantial even when the popup content is
                    // short — reportHeight still grows the iframe past it.
                    modalStyle={{ width: '90vw', maxWidth: '1100px', height: 'auto', minHeight: '80vh' }}
                    iframeStyle={{ height: '100%', minHeight: '80vh' }}
                />
            ) : null}
        </SectionFrame>
    );
}
