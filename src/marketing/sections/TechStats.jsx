import React from 'react';
import SectionHeader from '../components/SectionHeader';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';

export default function TechStats({ data }) {
    if (!data?.enabled) return null;
    return (
        <SectionFrame id="techStats" name="Stats" enabled={data.enabled}>
            <section id="tech-stats" className="alt-bg">
                <div className="container">
                    <SectionHeader pathPrefix="techStats" eyebrow={data.eyebrow} title={data.title} lead="" />
                    <div className="tech-stats">
                        {(data.stats || []).map((stat, i) => (
                            <div key={i} className={`tech-stat reveal reveal-delay-${Math.min(i + 1, 6)}`}>
                                <EditableText
                                    as="div"
                                    path={`techStats.stats.${i}.number`}
                                    placeholder="99%"
                                    className="number"
                                >
                                    {stat.number || ''}
                                </EditableText>
                                <EditableText
                                    as="div"
                                    path={`techStats.stats.${i}.label`}
                                    placeholder="Label"
                                    className="label-text"
                                >
                                    {stat.label || ''}
                                </EditableText>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}
