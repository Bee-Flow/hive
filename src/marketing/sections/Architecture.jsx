import React from 'react';
import SectionHeader from '../components/SectionHeader';

export default function Architecture({ data }) {
    if (!data?.enabled) return null;
    return (
        <section id="architecture">
            <div className="container">
                <SectionHeader eyebrow={data.eyebrow} title={data.title} lead={data.lead} />
                <div className="arch-layer-stack">
                    {(data.layers || []).map((layer, i) => (
                        <div key={i} className={`arch-layer reveal reveal-delay-${Math.min(i + 1, 6)}`}>
                            <div className="arch-layer-label">{layer.label}</div>
                            <div className="arch-layer-tags">
                                {(layer.tags || []).map((tag, j) => (
                                    <span key={j} className="arch-tag">{tag}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
