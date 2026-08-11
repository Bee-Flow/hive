import React from 'react';
import SectionHeader from '../components/SectionHeader';
import EditableText from '../components/EditableText';
import FramedMedia from '../components/FramedMedia';
import SectionFrame from '../components/SectionFrame';
import { sectionBgClass } from './sectionBg';
import { inlineTextStyle } from './textStyle';

// True inside the CMS editor's preview iframe (?preview), where placeholders
// are an affordance rather than a defect. Same one-liner the SocialProof /
// Media+Text sections use — kept local so a marketing section never imports
// admin code.
const isEditable = () =>
    typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('preview');

// One step's text stack — identical EditableText paths in both variants,
// so switching layout never breaks inline editing or locale overrides.
function StepCopy({ step, i, chapters }) {
    // The example is optional. Published site: an EMPTY example must not
    // render — the accent-ruled .step-example box with nothing in it reads
    // as a blank grey slab (three of them shipped on the homepage). The
    // editor keeps the placeholder whenever the field exists, because that
    // is how an author finds the field at all.
    const hasExample = typeof step.example === 'string' && step.example.trim() !== '';
    const exampleFieldExists = step.example !== undefined && step.example !== null;
    return (
        <>
            <EditableText
                as="h3"
                path={`steps.items.${i}.title`}
                multiline
                placeholder="Step title"
                className={chapters ? 'headline-lg' : 'headline-md'}
                style={inlineTextStyle(undefined, step.titleAlign)}
            >
                {step.title || ''}
            </EditableText>
            <EditableText
                as="p"
                path={`steps.items.${i}.body`}
                multiline
                placeholder="Step description"
                className="body-md"
                style={inlineTextStyle(undefined, step.bodyAlign)}
            >
                {step.body || ''}
            </EditableText>
            {(hasExample || (exampleFieldExists && isEditable())) ? (
                <EditableText
                    as="div"
                    path={`steps.items.${i}.example`}
                    multiline
                    placeholder="Example (optional)"
                    className="step-example"
                    style={inlineTextStyle(undefined, step.exampleAlign)}
                >
                    {step.example || ''}
                </EditableText>
            ) : null}
        </>
    );
}

export default function Steps({ data }) {
    if (!data?.enabled) return null;
    const items = data.items || [];
    // 'chapters' = numbered full-width chapters (mono "1.0" eyebrow,
    // alternating framed screenshots, hairline rules). Absent/unknown ⇒
    // the classic centered 3-up cards.
    const chapters = data.variant === 'chapters';
    return (
        <SectionFrame id="steps" name="How it works" enabled={data.enabled}>
            <section id="steps" className={sectionBgClass(data, 'alt-bg')}>
                <div className="container">
                    <SectionHeader
                        pathPrefix="steps"
                        eyebrow={data.eyebrow} title={data.title} lead={data.lead}
                        eyebrowStyle={data.eyebrowStyle} titleStyle={data.titleStyle} leadStyle={data.leadStyle}
                        eyebrowAlign={data.eyebrowAlign} titleAlign={data.titleAlign} leadAlign={data.leadAlign} align={data.align}
                    />
                    {chapters ? (
                        <div className="step-chapters">
                            {items.map((step, i) => {
                                const hasMedia = typeof step.media?.src === 'string' && step.media.src.trim() !== '';
                                return (
                                    <div
                                        key={i}
                                        // `--copy` rather than a :has() test: the layout for a
                                        // chapter with no screenshot is genuinely different
                                        // (the copy itself splits into two columns), and naming
                                        // it keeps those rules readable.
                                        className={'step-chapter reveal'
                                            + (hasMedia ? '' : ' step-chapter--copy')
                                            + (i % 2 === 1 ? ' step-chapter--flip' : '')}
                                    >
                                        <div className="step-chapter-copy">
                                            <div className="eyebrow-mono">
                                                <span className="eyebrow-index tnum">
                                                    <EditableText path={`steps.items.${i}.number`} placeholder={`${i + 1}`}>
                                                        {step.number || ''}
                                                    </EditableText>
                                                    .0
                                                </span>
                                            </div>
                                            <StepCopy step={step} i={i} chapters />
                                        </div>
                                        {hasMedia ? (
                                            <div className="step-chapter-media">
                                                <FramedMedia media={step.media} glow={false} />
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="steps">
                            {items.map((step, i) => (
                                <div key={i} className={`step reveal reveal-delay-${Math.min(i + 1, 6)}`}>
                                    <div className="step-number">
                                        <EditableText path={`steps.items.${i}.number`} placeholder={`${i + 1}`}>
                                            {step.number || ''}
                                        </EditableText>
                                    </div>
                                    <StepCopy step={step} i={i} chapters={false} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </SectionFrame>
    );
}
