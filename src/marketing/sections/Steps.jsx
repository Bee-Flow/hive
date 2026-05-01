import React from 'react';
import SectionHeader from '../components/SectionHeader';

export default function Steps({ data }) {
    if (!data?.enabled) return null;
    return (
        <section id="steps" className="alt-bg">
            <div className="container">
                <SectionHeader eyebrow={data.eyebrow} title={data.title} lead={data.lead} />
                <div className="steps">
                    {(data.items || []).map((step, i) => (
                        <div key={i} className={`step reveal reveal-delay-${Math.min(i + 1, 6)}`}>
                            <div className="step-number">{step.number || (i + 1)}</div>
                            <h3 className="headline-md">{step.title}</h3>
                            <p className="body-md">{step.body}</p>
                            {step.example ? <div className="step-example">{step.example}</div> : null}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
