import React from 'react';
import SectionHeader from '../components/SectionHeader';
import AppIcon from '../../components/AppIcon';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';

export default function Features({ data }) {
    if (!data?.enabled) return null;
    return (
        <SectionFrame id="features" name="Features" enabled={data.enabled}>
            <section id="features">
                <div className="container">
                    <SectionHeader pathPrefix="features" eyebrow={data.eyebrow} title={data.title} lead={data.lead} />
                    <div className="features-grid">
                        {(data.items || []).map((item, i) => (
                            <div key={i} className={`feature-card reveal reveal-delay-${Math.min(i + 1, 6)}`}>
                                {item.icon ? (
                                    <div className="icon-tile"><AppIcon name={item.icon} className="w-6 h-6" /></div>
                                ) : null}
                                <EditableText
                                    as="h3"
                                    path={`features.items.${i}.title`}
                                    placeholder="Feature title"
                                    className="headline-md"
                                >
                                    {item.title || ''}
                                </EditableText>
                                <EditableText
                                    as="p"
                                    path={`features.items.${i}.body`}
                                    multiline
                                    placeholder="Feature description"
                                    className="body-md"
                                >
                                    {item.body || ''}
                                </EditableText>
                                {(item.techTag !== undefined && item.techTag !== null) ? (
                                    <EditableText
                                        as="span"
                                        path={`features.items.${i}.techTag`}
                                        placeholder="Tech tag (optional)"
                                        className="feature-tech-tag"
                                    >
                                        {item.techTag || ''}
                                    </EditableText>
                                ) : null}
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}
