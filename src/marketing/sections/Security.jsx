import React, { useState } from 'react';
import { inlineTextStyle } from './textStyle';
import AppIcon from '../../components/AppIcon';
import CardActionWrapper from '../components/CardActionWrapper';
import EditableText from '../components/EditableText';
import PopupModal from '../components/PopupModal';
import SectionFrame from '../components/SectionFrame';
import { sectionBgClass } from './sectionBg';
import SectionHeader from '../components/SectionHeader';

export default function Security({ data }) {
    // Hooks must run unconditionally — declared BEFORE the `enabled`
    // early-return so toggling enabled on/off doesn't change hook order.
    const [openIdx, setOpenIdx] = useState(-1);

    if (!data?.enabled) return null;

    const cards = data.cards || [];
    const openCard = openIdx >= 0 ? cards[openIdx] : null;
    // Layout variant (BLOCK_VARIANTS) — absent/unknown ⇒ 'classic', so
    // stored pages keep the legacy 2-up card grid byte-for-byte. 'ledger'
    // renders a 5/7 split: sticky left header, mono-indexed hairline rows.
    const variant = data.variant === 'ledger' ? 'ledger' : 'classic';

    if (variant === 'ledger') {
        return (
            <SectionFrame id="security" name="Security" enabled={data.enabled}>
                <section id="security" className={sectionBgClass(data)}>
                    <div className="container">
                        <div className="security-ledger">
                            <div className="security-ledger-head">
                                <SectionHeader
                                    pathPrefix="security"
                                    eyebrow={data.eyebrow} title={data.title} lead={data.lead}
                                    eyebrowStyle={data.eyebrowStyle} titleStyle={data.titleStyle} leadStyle={data.leadStyle}
                                    eyebrowAlign={data.eyebrowAlign} titleAlign={data.titleAlign} leadAlign={data.leadAlign} align={data.align}
                                />
                            </div>
                            <div className="security-ledger-rows">
                                {cards.map((card, i) => {
                                    // CardActionWrapper renders an <a> for the
                                    // 'link' card action — the per-card ledger
                                    // link must not nest inside it (invalid
                                    // HTML), so it only renders otherwise.
                                    const wrapperIsLink = (card.cardAction || 'none') === 'link'
                                        && typeof card.cardUrl === 'string'
                                        && card.cardUrl.trim() !== '';
                                    const hasRowLink = !wrapperIsLink && !!(card.link
                                        && ((card.link.label || '').trim() || (card.link.href || '').trim()));
                                    return (
                                        <CardActionWrapper
                                            key={i}
                                            card={card}
                                            className={`security-row reveal reveal-delay-${Math.min(i + 1, 6)}`}
                                            onOpenPopup={() => setOpenIdx(i)}
                                        >
                                            <span className="security-row-index eyebrow-mono tnum" aria-hidden="true">
                                                {String(i + 1).padStart(2, '0')}
                                            </span>
                                            <div className="security-row-body">
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
                                                {card.details?.length ? (
                                                    <div className="security-card-detail security-row-detail">
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
                                                {hasRowLink ? (
                                                    <a
                                                        className="security-row-link"
                                                        href={(card.link.href || '').trim() || '#'}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => {
                                                            // Never bubble into the card's popup
                                                            // action; keep inline editing usable.
                                                            e.stopPropagation();
                                                            if (e.target.closest && e.target.closest('.cms-editable')) e.preventDefault();
                                                        }}
                                                    >
                                                        <span aria-hidden="true">→</span>
                                                        <EditableText path={`security.cards.${i}.link.label`} placeholder="Link label">
                                                            {card.link.label || ''}
                                                        </EditableText>
                                                    </a>
                                                ) : null}
                                            </div>
                                        </CardActionWrapper>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </section>

                {openCard ? (
                    <PopupModal
                        title={openCard.title}
                        embedHtml={openCard.popupEmbed}
                        onClose={() => setOpenIdx(-1)}
                        modalStyle={{ width: '100%', maxWidth: '800px', maxHeight: '80vh', overflowY: 'auto' }}
                        iframeStyle={{ height: 0 }}
                    />
                ) : null}
            </SectionFrame>
        );
    }

    return (
        <SectionFrame id="security" name="Security" enabled={data.enabled}>
            <section id="security" className={sectionBgClass(data)}>
                <div className="container">
                    <SectionHeader
                        pathPrefix="security"
                        eyebrow={data.eyebrow} title={data.title} lead={data.lead}
                        eyebrowStyle={data.eyebrowStyle} titleStyle={data.titleStyle} leadStyle={data.leadStyle}
                        eyebrowAlign={data.eyebrowAlign} titleAlign={data.titleAlign} leadAlign={data.leadAlign} align={data.align}
                    />
                    <div className="security-grid">
                        {cards.map((card, i) => (
                            <CardActionWrapper
                                key={i}
                                card={card}
                                className={`security-card reveal reveal-delay-${Math.min(i + 1, 6)}`}
                                onOpenPopup={() => setOpenIdx(i)}
                            >
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
                            </CardActionWrapper>
                        ))}
                    </div>
                </div>
            </section>

            {openCard ? (
                <PopupModal
                    title={openCard.title}
                    embedHtml={openCard.popupEmbed}
                    onClose={() => setOpenIdx(-1)}
                    // Capped at 800px wide / 80vh tall; taller content scrolls
                    // inside the modal. The iframe starts at 0 and grows to
                    // the reported content height.
                    modalStyle={{ width: '100%', maxWidth: '800px', maxHeight: '80vh', overflowY: 'auto' }}
                    iframeStyle={{ height: 0 }}
                />
            ) : null}
        </SectionFrame>
    );
}
