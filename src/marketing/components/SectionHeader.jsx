import React from 'react';

export default function SectionHeader({ eyebrow, title, lead }) {
    return (
        <div className="section-header reveal">
            {eyebrow ? <span className="label">{eyebrow}</span> : null}
            {title  ? <h2 className="headline-lg">{title}</h2>  : null}
            {lead   ? <p className="body-lg">{lead}</p>          : null}
        </div>
    );
}
