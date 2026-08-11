import React from 'react';
import EditableText from '../components/EditableText';
import FramedMedia from '../components/FramedMedia';
import SectionFrame from '../components/SectionFrame';
import SectionHeader from '../components/SectionHeader';
import { sectionBgClass } from './sectionBg';

export default function Showcase({ data }) {
    if (!data?.enabled) return null;
    // 'single' is the default/fallback (no legacy layout): one full-container
    // framed shot with glow + fade-mask. 'pair' = two frames side by side;
    // 'code-ui' = mono code panel (no syntax highlighting) + frame, 5/7.
    const variant = ['pair', 'code-ui'].includes(data.variant) ? data.variant : 'single';
    const code = data.code || {};

    return (
        <SectionFrame id="showcase" name="Showcase" enabled={data.enabled}>
            <section id="showcase" className={sectionBgClass(data)}>
                <div className="container">
                    <SectionHeader
                        pathPrefix="showcase"
                        eyebrow={data.eyebrow} title={data.title} lead={data.lead}
                        eyebrowStyle={data.eyebrowStyle} titleStyle={data.titleStyle} leadStyle={data.leadStyle}
                        eyebrowAlign={data.eyebrowAlign} titleAlign={data.titleAlign} leadAlign={data.leadAlign} align={data.align}
                    />
                    {variant === 'pair' ? (
                        <div className="showcase-pair reveal">
                            <FramedMedia media={data.media} glow={false} />
                            <FramedMedia media={data.mediaSecondary} glow={false} />
                        </div>
                    ) : variant === 'code-ui' ? (
                        <div className="showcase-code-ui reveal">
                            {/* Mono code panel — deliberately NO syntax highlighting
                                (tokens only, quiet institutional register). */}
                            <div className="showcase-code">
                                <EditableText
                                    as="span"
                                    path="showcase.code.language"
                                    placeholder="bash"
                                    className="showcase-code-lang eyebrow-mono"
                                >
                                    {code.language || ''}
                                </EditableText>
                                <EditableText
                                    as="pre"
                                    path="showcase.code.snippet"
                                    multiline
                                    placeholder="$ …"
                                    className="showcase-code-snippet"
                                >
                                    {code.snippet || ''}
                                </EditableText>
                            </div>
                            <FramedMedia media={data.media} />
                        </div>
                    ) : (
                        <div className="showcase-single reveal">
                            <FramedMedia media={data.media} fadeMask />
                        </div>
                    )}
                </div>
            </section>
        </SectionFrame>
    );
}
