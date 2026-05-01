import React from 'react';
import SectionHeader from '../components/SectionHeader';

export default function TechStats({ data }) {
    if (!data?.enabled) return null;
    return (
        <section id="tech-stats" className="alt-bg">
            <div className="container">
                {(data.eyebrow || data.title) ? (
                    <SectionHeader eyebrow={data.eyebrow} title={data.title} lead="" />
                ) : null}
                <div className="tech-stats">
                    {(data.stats || []).map((stat, i) => (
                        <div key={i} className={`tech-stat reveal reveal-delay-${Math.min(i + 1, 6)}`}>
                            <div className="number">{stat.number}</div>
                            <div className="label-text">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
