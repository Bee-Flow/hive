import React from 'react';
import Button from '../components/Button';

export default function CTA({ data }) {
    if (!data?.enabled) return null;
    return (
        <section className="cta-section">
            <div className="container">
                <div className="cta-content reveal">
                    {data.title ? <h2 className="headline-lg">{data.title}</h2> : null}
                    {data.lead  ? <p className="body-lg">{data.lead}</p>         : null}
                    {data.button?.label ? (
                        <Button variant="primary" href={data.button.href || '/app'}>{data.button.label}</Button>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
