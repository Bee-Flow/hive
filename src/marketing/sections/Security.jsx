import React, { useState } from 'react';
import SectionHeader from '../components/SectionHeader';
import AppIcon from '../../components/AppIcon';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';

export default function Security({ data }) {
    const [openIdx, setOpenIdx] = useState(-1);
    if (!data?.enabled) return null;

    return (
        <SectionFrame id="security" name="Security" enabled={data.enabled}>
            <section id="security">
                <div className="container">
                    <SectionHeader pathPrefix="security" eyebrow={data.eyebrow} title={data.title} lead={data.lead} />
                    <div className="security-grid">
                        {(data.cards || []).map((card, i) => {
                            const open = openIdx === i;
                            return (
                                <div
                                    key={i}
                                    className={`security-card reveal reveal-delay-${Math.min(i + 1, 6)} ${open ? 'open' : ''}`}
                                    onClick={(e) => {
                                        // Don't toggle when the user is clicking into editable text.
                                        if (e.target.closest('.cms-editable')) return;
                                        setOpenIdx(open ? -1 : i);
                                    }}
                                >
                                    <div className="security-card-head">
                                        {card.icon ? (
                                            <div className="icon-tile"><AppIcon name={card.icon} className="w-5 h-5" /></div>
                                        ) : null}
                                        <div>
                                            <EditableText
                                                as="h3"
                                                path={`security.cards.${i}.title`}
                                                placeholder="Card title"
                                                className="headline-md"
                                            >
                                                {card.title || ''}
                                            </EditableText>
                                            <EditableText
                                                as="p"
                                                path={`security.cards.${i}.summary`}
                                                multiline
                                                placeholder="Summary"
                                                className="body-md"
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
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}
