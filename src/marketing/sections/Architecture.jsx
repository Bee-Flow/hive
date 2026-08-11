import React from 'react';
import SectionHeader from '../components/SectionHeader';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';
import { sectionBgClass } from './sectionBg';
import { inlineTextStyle } from './textStyle';

export default function Architecture({ data }) {
    if (!data?.enabled) return null;
    return (
        <SectionFrame id="architecture" name="Architecture" enabled={data.enabled}>
            <section id="architecture" className={sectionBgClass(data)}>
                <div className="container">
                    <SectionHeader
                        pathPrefix="architecture"
                        eyebrow={data.eyebrow} title={data.title} lead={data.lead}
                        eyebrowStyle={data.eyebrowStyle} titleStyle={data.titleStyle} leadStyle={data.leadStyle}
                        eyebrowAlign={data.eyebrowAlign} titleAlign={data.titleAlign} leadAlign={data.leadAlign} align={data.align}
                    />
                    <div className="arch-layer-stack">
                        {(data.layers || []).map((layer, i) => (
                            <div key={i} className={`arch-layer reveal reveal-delay-${Math.min(i + 1, 6)}`}>
                                <EditableText
                                    path={`architecture.layers.${i}.label`}
                                    multiline
                                    placeholder="Layer name"
                                    className="arch-layer-label"
                                    style={inlineTextStyle(undefined, layer.labelAlign)}
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
