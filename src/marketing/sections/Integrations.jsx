import React from 'react';
import SectionHeader from '../components/SectionHeader';
import AppIcon from '../../components/AppIcon';

export default function Integrations({ data }) {
    if (!data?.enabled) return null;
    return (
        <section id="integrations" className="alt-bg">
            <div className="container">
                <SectionHeader eyebrow={data.eyebrow} title={data.title} lead={data.lead} />
                <div className="integrations-categories">
                    {(data.categories || []).map((cat, i) => (
                        <div key={i} className="integration-category reveal">
                            <h3>{cat.heading}</h3>
                            <div className="integration-logos">
                                {(cat.items || []).map((item, j) => (
                                    <span key={j} className="integration-item">
                                        {item.icon ? <span className="icon-tile"><AppIcon name={item.icon} className="w-4 h-4" /></span> : null}
                                        <span>{item.label}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
