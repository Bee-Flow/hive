import React from 'react';
import Button from '../components/Button';
import AppIcon from '../../components/AppIcon';

export default function Hero({ data }) {
    if (!data?.enabled) return null;
    const titleParts = data.titleParts || [];
    const bubbles    = data.mockup?.chatBubbles || [];

    return (
        <section className="hero" id="hero">
            <div className="container">
                <div className="hero-content">
                    {data.badge?.text ? (
                        <div className="hero-badge reveal">
                            {data.badge.icon ? <AppIcon name={data.badge.icon} className="w-4 h-4" /> : null}
                            <span>{data.badge.text}</span>
                        </div>
                    ) : null}
                    <h1 className="headline-xl reveal reveal-delay-1">
                        {titleParts.map((part, i) => (
                            <span key={i} className={part.gradient ? 'gradient-text' : ''}>{part.text}</span>
                        ))}
                    </h1>
                    {data.lead ? <p className="hero-lead body-lg reveal reveal-delay-2">{data.lead}</p> : null}
                    <div className="hero-ctas reveal reveal-delay-3">
                        {data.primaryCta?.label ? (
                            <Button variant="primary" href={data.primaryCta.href || '/app'}>{data.primaryCta.label}</Button>
                        ) : null}
                        {data.secondaryCta?.label ? (
                            <Button variant="secondary" href={data.secondaryCta.href || '#features'}>{data.secondaryCta.label}</Button>
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
                                    {b.text}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
        </section>
    );
}
