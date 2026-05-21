import React from 'react';
import SectionHeader from '../components/SectionHeader';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';
import { inlineTextStyle } from './textStyle';

export default function TechStats({ data }) {
    if (!data?.enabled) return null;
    return (
        <SectionFrame id="techStats" name="Stats" enabled={data.enabled}>
            <section id="tech-stats" className="alt-bg">
                <div className="container">
                    <SectionHeader
                        pathPrefix="techStats"
                        eyebrow={data.eyebrow} title={data.title} lead=""
                        eyebrowStyle={data.eyebrowStyle} titleStyle={data.titleStyle}
                        eyebrowAlign={data.eyebrowAlign} titleAlign={data.titleAlign} align={data.align}
                    />
                    <div className="tech-stats">
                        {(data.stats || []).map((stat, i) => (
                            <div key={i} className={`tech-stat reveal reveal-delay-${Math.min(i + 1, 6)}`}>
                                <EditableText
                                    as="div"
                                    path={`techStats.stats.${i}.number`}
                                    multiline
                                    placeholder="99%"
                                    className="number"
                                    style={inlineTextStyle(stat.numberStyle, stat.numberAlign)}
                                >
                                    {stat.number || ''}
                                </EditableText>
                                <EditableText
                                    as="div"
                                    path={`techStats.stats.${i}.label`}
                                    multiline
                                    placeholder="Label"
                                    className="label-text"
                                    style={inlineTextStyle(undefined, stat.labelAlign)}
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
