import React from 'react';
import SectionHeader from '../components/SectionHeader';
import AppIcon from '../../components/AppIcon';

export default function Features({ data }) {
    if (!data?.enabled) return null;
    return (
        <section id="features">
            <div className="container">
                <SectionHeader eyebrow={data.eyebrow} title={data.title} lead={data.lead} />
                <div className="features-grid">
                    {(data.items || []).map((item, i) => (
                        <div key={i} className={`feature-card reveal reveal-delay-${Math.min(i + 1, 6)}`}>
                            {item.icon ? (
                                <div className="icon-tile"><AppIcon name={item.icon} className="w-6 h-6" /></div>
                            ) : null}
                            <h3 className="headline-md">{item.title}</h3>
                            <p className="body-md">{item.body}</p>
                            {item.techTag ? <span className="feature-tech-tag">{item.techTag}</span> : null}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
