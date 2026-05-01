import React from 'react';
import Button from '../components/Button';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';

export default function CTA({ data }) {
    if (!data?.enabled) return null;
    return (
        <SectionFrame id="cta" name="Call to action" enabled={data.enabled}>
            <section className="cta-section">
                <div className="container">
                    <div className="cta-content reveal">
                        <EditableText
                            as="h2"
                            path="cta.title"
                            placeholder="CTA title"
                            className="headline-lg"
                        >
                            {data.title || ''}
                        </EditableText>
                        <EditableText
                            as="p"
                            path="cta.lead"
                            multiline
                            placeholder="CTA lead"
                            className="body-lg"
                        >
                            {data.lead || ''}
                        </EditableText>
                        {data.button ? (
                            <Button variant="primary" href={data.button.href || '/app'}>
                                <EditableText path="cta.button.label" placeholder="Button">
                                    {data.button.label || ''}
                                </EditableText>
                            </Button>
                        ) : null}
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}
