import React, { useState } from 'react';
import SectionHeader from '../components/SectionHeader';
import AppIcon from '../../components/AppIcon';

export default function Security({ data }) {
    const [openIdx, setOpenIdx] = useState(-1);
    if (!data?.enabled) return null;

    return (
        <section id="security">
            <div className="container">
                <SectionHeader eyebrow={data.eyebrow} title={data.title} lead={data.lead} />
                <div className="security-grid">
                    {(data.cards || []).map((card, i) => {
                        const open = openIdx === i;
                        return (
                            <div
                                key={i}
                                className={`security-card reveal reveal-delay-${Math.min(i + 1, 6)} ${open ? 'open' : ''}`}
                                onClick={() => setOpenIdx(open ? -1 : i)}
                            >
                                <div className="security-card-head">
                                    {card.icon ? (
                                        <div className="icon-tile"><AppIcon name={card.icon} className="w-5 h-5" /></div>
                                    ) : null}
                                    <div>
                                        <h3 className="headline-md">{card.title}</h3>
                                        <p className="body-md">{card.summary}</p>
                                    </div>
                                </div>
                                {card.details?.length ? (
                                    <div className="security-card-detail">
                                        <ul>
                                            {card.details.map((d, j) => <li key={j}>{d}</li>)}
                                        </ul>
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
