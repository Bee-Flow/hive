import React from 'react';
import SectionHeader from '../components/SectionHeader';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';

export default function Architecture({ data }) {
    if (!data?.enabled) return null;
    return (
        <SectionFrame id="architecture" name="Architecture" enabled={data.enabled}>
            <section id="architecture">
                <div className="container">
                    <SectionHeader pathPrefix="architecture" eyebrow={data.eyebrow} title={data.title} lead={data.lead} />
                    <div className="arch-layer-stack">
                        {(data.layers || []).map((layer, i) => (
                            <div key={i} className={`arch-layer reveal reveal-delay-${Math.min(i + 1, 6)}`}>
                                <EditableText
                                    path={`architecture.layers.${i}.label`}
                                    placeholder="Layer name"
                                    className="arch-layer-label"
                                >
                                    {layer.label || ''}
                                </EditableText>
                                <div className="arch-layer-tags">
                                    {(layer.tags || []).map((tag, j) => (
                                        <EditableText
                                            key={j}
                                            path={`architecture.layers.${i}.tags.${j}`}
                                            placeholder="tag"
                                            className="arch-tag"
                                        >
                                            {tag || ''}
                                        </EditableText>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}
