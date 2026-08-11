import React, { useState } from 'react';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';
import SectionHeader from '../components/SectionHeader';
import { sectionBgClass } from './sectionBg';

// True when the event originated inside an inline-editable text node —
// clicking to edit a question/answer must never toggle the accordion.
function onEditable(e) {
    return !!(e.target.closest && e.target.closest('.cms-editable'));
}

export default function Faq({ data }) {
    // Controlled accordion (NOT <details>): EditableText needs real,
    // always-mounted DOM for both question and answer, and <details>
    // would swallow the click-to-edit interaction. One item open at a
    // time; the FIRST item starts open so editors (and visitors) always
    // see what an answer looks like. Hook declared before the `enabled`
    // early-return so the hook count never changes between renders.
    const [openIdx, setOpenIdx] = useState(0);

    if (!data?.enabled) return null;
    const items = data.items || [];
    const toggle = (i) => setOpenIdx(prev => (prev === i ? -1 : i));

    return (
        <SectionFrame id="faq" name="FAQ" enabled={data.enabled}>
            <section id="faq" className={sectionBgClass(data)}>
                <div className="container">
                    <SectionHeader
                        pathPrefix="faq"
                        eyebrow={data.eyebrow} title={data.title} lead={data.lead}
                        eyebrowStyle={data.eyebrowStyle} titleStyle={data.titleStyle} leadStyle={data.leadStyle}
                        eyebrowAlign={data.eyebrowAlign} titleAlign={data.titleAlign} leadAlign={data.leadAlign} align={data.align}
                    />
                    <div className="faq-list reveal">
                        {items.map((item, i) => {
                            const open = openIdx === i;
                            return (
                                <div key={i} className={`faq-item${open ? ' faq-item--open' : ''}`}>
                                    <div
                                        className="faq-q"
                                        role="button"
                                        tabIndex={0}
                                        aria-expanded={open}
                                        onClick={(e) => { if (!onEditable(e)) toggle(i); }}
                                        onKeyDown={(e) => {
                                            if ((e.key === 'Enter' || e.key === ' ') && !onEditable(e)) {
                                                e.preventDefault();
                                                toggle(i);
                                            }
                                        }}
                                    >
                                        <EditableText
                                            as="h3"
                                            path={`faq.items.${i}.question`}
                                            multiline
                                            placeholder="Question"
                                            className="faq-q-text"
                                        >
                                            {item.question || ''}
                                        </EditableText>
                                        {/* Inline SVG chevron — rotates 180° in --motion-fast (150ms). */}
                                        <svg
                                            className="faq-chevron"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <path d="m6 9 6 6 6-6" />
                                        </svg>
                                    </div>
                                    {/* Always mounted (grid-rows 0fr→1fr animates the reveal), so
                                        side-panel edits sync into closed answers too. */}
                                    <div className="faq-a-wrap" aria-hidden={!open}>
                                        <div className="faq-a-inner">
                                            <EditableText
                                                as="p"
                                                path={`faq.items.${i}.answer`}
                                                multiline
                                                placeholder="Answer"
                                                className="faq-a"
                                            >
                                                {item.answer || ''}
                                            </EditableText>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}
