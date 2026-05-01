import React from 'react';
import SectionHeader from '../components/SectionHeader';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';

export default function Steps({ data }) {
    if (!data?.enabled) return null;
    return (
        <SectionFrame id="steps" name="How it works" enabled={data.enabled}>
            <section id="steps" className="alt-bg">
                <div className="container">
                    <SectionHeader pathPrefix="steps" eyebrow={data.eyebrow} title={data.title} lead={data.lead} />
                    <div className="steps">
                        {(data.items || []).map((step, i) => (
                            <div key={i} className={`step reveal reveal-delay-${Math.min(i + 1, 6)}`}>
                                <div className="step-number">
                                    <EditableText path={`steps.items.${i}.number`} placeholder={`${i + 1}`}>
                                        {step.number || ''}
                                    </EditableText>
                                </div>
                                <EditableText
                                    as="h3"
                                    path={`steps.items.${i}.title`}
                                    placeholder="Step title"
                                    className="headline-md"
                                >
                                    {step.title || ''}
                                </EditableText>
                                <EditableText
                                    as="p"
                                    path={`steps.items.${i}.body`}
                                    multiline
                                    placeholder="Step description"
                                    className="body-md"
                                >
                                    {step.body || ''}
                                </EditableText>
                                {(step.example !== undefined && step.example !== null) ? (
                                    <EditableText
                                        as="div"
                                        path={`steps.items.${i}.example`}
                                        placeholder="Example (optional)"
                                        className="step-example"
                                    >
                                        {step.example || ''}
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
