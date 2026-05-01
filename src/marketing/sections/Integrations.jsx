import React from 'react';
import SectionHeader from '../components/SectionHeader';
import AppIcon from '../../components/AppIcon';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';

export default function Integrations({ data }) {
    if (!data?.enabled) return null;
    return (
        <SectionFrame id="integrations" name="Integrations" enabled={data.enabled}>
            <section id="integrations" className="alt-bg">
                <div className="container">
                    <SectionHeader pathPrefix="integrations" eyebrow={data.eyebrow} title={data.title} lead={data.lead} />
                    <div className="integrations-categories">
                        {(data.categories || []).map((cat, i) => (
                            <div key={i} className="integration-category reveal">
                                <EditableText
                                    as="h3"
                                    path={`integrations.categories.${i}.heading`}
                                    placeholder="Category heading"
                                >
                                    {cat.heading || ''}
                                </EditableText>
                                <div className="integration-logos">
                                    {(cat.items || []).map((item, j) => (
                                        <span key={j} className="integration-item">
                                            {item.icon ? (
                                                <span className="icon-tile"><AppIcon name={item.icon} className="w-4 h-4" /></span>
                                            ) : null}
                                            <EditableText
                                                path={`integrations.categories.${i}.items.${j}.label`}
                                                placeholder="Tool name"
                                            >
                                                {item.label || ''}
                                            </EditableText>
                                        </span>
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
