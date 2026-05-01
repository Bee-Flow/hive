import React from 'react';
import Button from '../components/Button';
import AppIcon from '../../components/AppIcon';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';

export default function Hero({ data }) {
    if (!data?.enabled) return null;
    const titleParts = data.titleParts || [];
    const bubbles    = data.mockup?.chatBubbles || [];

    return (
        <SectionFrame id="hero" name="Hero" enabled={data.enabled}>
            <section className="hero" id="hero">
                <div className="container">
                    <div className="hero-content">
                        {data.badge?.text || data.badge?.icon ? (
                            <div className="hero-badge reveal">
                                {data.badge.icon ? <AppIcon name={data.badge.icon} className="w-4 h-4" /> : null}
                                <EditableText path="hero.badge.text" placeholder="Badge text">
                                    {data.badge.text || ''}
                                </EditableText>
                            </div>
                        ) : null}
                        <h1 className="headline-xl reveal reveal-delay-1">
                            {titleParts.map((part, i) => (
                                <EditableText
                                    key={i}
                                    path={`hero.titleParts.${i}.text`}
                                    placeholder="…"
                                    className={part.gradient ? 'gradient-text' : ''}
                                >
                                    {part.text || ''}
                                </EditableText>
                            ))}
                        </h1>
                        <EditableText
                            path="hero.lead"
                            as="p"
                            multiline
                            placeholder="Lead paragraph"
                            className="hero-lead body-lg reveal reveal-delay-2"
                        >
                            {data.lead || ''}
                        </EditableText>
                        <div className="hero-ctas reveal reveal-delay-3">
                            {data.primaryCta ? (
                                <Button variant="primary" href={data.primaryCta.href || '/app'}>
                                    <EditableText path="hero.primaryCta.label" placeholder="Primary action">
                                        {data.primaryCta.label || ''}
                                    </EditableText>
                                </Button>
                            ) : null}
                            {data.secondaryCta ? (
                                <Button variant="secondary" href={data.secondaryCta.href || '#features'}>
                                    <EditableText path="hero.secondaryCta.label" placeholder="Secondary action">
                                        {data.secondaryCta.label || ''}
                                    </EditableText>
                                </Button>
                            ) : null}
                        </div>
                    </div>
                    {bubbles.length ? (
                        <div className="hero-mockup reveal reveal-delay-4">
                            <div className="mockup-header">
                                <span className="mockup-dot" /><span className="mockup-dot" /><span className="mockup-dot" />
                            </div>
                            <div className="mockup-body">
                                {bubbles.map((b, i) => (
                                    <div
                                        key={i}
                                        className={`chat-bubble chat-bubble--${b.role === 'user' ? 'user' : 'ai'}`}
                                        style={{ animationDelay: `${0.5 + i * 0.4}s` }}
                                    >
                                        <EditableText
                                            path={`hero.mockup.chatBubbles.${i}.text`}
                                            multiline
                                            placeholder="Bubble text"
                                        >
                                            {b.text || ''}
                                        </EditableText>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            </section>
        </SectionFrame>
    );
}
