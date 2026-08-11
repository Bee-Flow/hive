import React from 'react';
import SectionHeader from '../components/SectionHeader';
import AppIcon from '../../components/AppIcon';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';
import { resolveAssetUrl } from '../assetUrl';
import { sectionBgClass } from './sectionBg';
import { inlineTextStyle } from './textStyle';
import { getIntegrationLogo } from '../../utils/integrationLogos';

/* The product already ships official brand SVGs for every integration it can
   talk to (`utils/integrationLogos`). The marketing wall drew Lucide glyphs
   instead, so Gmail, Outlook and Jira all rendered as the same generic
   envelope/ticket outline in the same accent colour — the page said "44
   integrations" while looking like one. Reusing the product's registry keeps
   the two surfaces honest: if the app grows a mark, the website gets it. */
const brandLogo = (id) => (id ? getIntegrationLogo(id) : null);

function BrandMark({ id }) {
    const Logo = brandLogo(id);
    if (!Logo) return null;
    return (
        <span className="integration-logo-mark" aria-hidden="true">
            <Logo size={20} />
        </span>
    );
}

export default function Integrations({ data }) {
    if (!data?.enabled) return null;
    return (
        <SectionFrame id="integrations" name="Integrations" enabled={data.enabled}>
            <section id="integrations" className={sectionBgClass(data, 'alt-bg')}>
                <div className="container">
                    <SectionHeader
                        pathPrefix="integrations"
                        eyebrow={data.eyebrow} title={data.title} lead={data.lead}
                        eyebrowStyle={data.eyebrowStyle} titleStyle={data.titleStyle} leadStyle={data.leadStyle}
                        eyebrowAlign={data.eyebrowAlign} titleAlign={data.titleAlign} leadAlign={data.leadAlign} align={data.align}
                    />
                    <div className="integrations-categories">
                        {(data.categories || []).map((cat, i) => (
                            <div key={i} className="integration-category reveal">
                                {/* Heading, count and the rule that closes the row.
                                    The count is derived, never stored — an editor
                                    adding a tool should not have to remember to
                                    bump a number in the heading text. */}
                                <div className="integration-category-head">
                                    <EditableText
                                        as="h3"
                                        path={`integrations.categories.${i}.heading`}
                                        multiline
                                        placeholder="Category heading"
                                        style={inlineTextStyle(undefined, cat.headingAlign)}
                                    >
                                        {cat.heading || ''}
                                    </EditableText>
                                    {(cat.items || []).length > 0 ? (
                                        <span className="integration-count">{(cat.items || []).length}</span>
                                    ) : null}
                                </div>
                                <div className="integration-logos">
                                    {(cat.items || []).map((item, j) => (
                                        <span key={j} className="integration-item">
                                            {/* Real logo (grayscale, color on hover — the
                                                social-proof wall recipe) beats the Lucide
                                                icon; both absent ⇒ label-only chip. */}
                                            {item.logoSrc ? (
                                                <img
                                                    className="integration-logo"
                                                    src={resolveAssetUrl(item.logoSrc)}
                                                    alt=""
                                                    loading="lazy"
                                                />
                                            ) : brandLogo(item.logoId) ? (
                                                <BrandMark id={item.logoId} />
                                            ) : item.icon ? (
                                                <span className="icon-tile"><AppIcon name={item.icon} className="w-4 h-4" /></span>
                                            ) : null}
                                            <EditableText
                                                path={`integrations.categories.${i}.items.${j}.label`}
                                                placeholder="Tool name"
                                            >
                                                {item.label || ''}
                                            </EditableText>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}
