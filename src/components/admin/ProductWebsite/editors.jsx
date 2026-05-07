import React from 'react';
import { TextField, Toggle, IconField, ImageField, RepeatableList, LinkField } from './fields';

/**
 * Block editors — structural controls only. Text is edited inline via
 * the preview iframe (EditableText → postMessage → panel).
 *
 * Each editor receives:
 *   data    — block.content for block editors, site.header/footer for chrome
 *   pages   — public page index [ { id, slug, title, isHomepage } ]
 *   onChange(nextData) — called on every structural change
 */

const set = (data, key, value) => ({ ...(data || {}), [key]: value });

const InlineHint = ({ children }) => (
    <p className="text-xs text-[var(--text-muted)] italic mb-3 leading-relaxed">✎ {children}</p>
);

// ── Header ────────────────────────────────────────────────────────────

export function HeaderEditor({ data = {}, pages = [], onChange }) {
    const nav = data.nav || [];
    return (
        <>
            <InlineHint>Click logo text, login label, and CTA label in the preview to edit them.</InlineHint>
            <LinkField
                label="CTA destination"
                value={data.ctaLink}
                pages={pages}
                onChange={v => onChange(set(data, 'ctaLink', v))}
            />
            <RepeatableList
                label="Nav links"
                items={nav}
                onChange={v => onChange(set(data, 'nav', v))}
                makeNew={() => ({ id: `nav_${Math.random().toString(36).slice(2,8)}`, label: 'New link', link: { kind: 'external', url: '#' } })}
                renderItem={(item, update) => (
                    <>
                        <TextField
                            label="Label"
                            value={item.label}
                            onChange={v => update({ ...item, label: v })}
                        />
                        <LinkField
                            label="Link"
                            value={item.link}
                            pages={pages}
                            onChange={v => update({ ...item, link: v })}
                        />
                        <RepeatableList
                            label="Dropdown children (optional)"
                            items={item.children || []}
                            onChange={v => update({ ...item, children: v })}
                            makeNew={() => ({ id: `nav_${Math.random().toString(36).slice(2,8)}`, label: 'Child link', link: { kind: 'external', url: '#' } })}
                            renderItem={(child, updChild) => (
                                <>
                                    <TextField label="Label" value={child.label} onChange={v => updChild({ ...child, label: v })} />
                                    <LinkField label="Link" value={child.link} pages={pages} onChange={v => updChild({ ...child, link: v })} />
                                </>
                            )}
                            addLabel="Add child"
                        />
                    </>
                )}
            />
        </>
    );
}

// ── Hero ──────────────────────────────────────────────────────────────

export function HeroEditor({ data = {}, pages = [], onChange }) {
    const badge     = data.badge || {};
    const primary   = data.primaryCta || {};
    const secondary = data.secondaryCta || {};
    const mockup    = data.mockup || {};
    return (
        <>
            <InlineHint>Click eyebrow, title segments, lead, badge text, CTA labels, and chat bubbles to edit inline.</InlineHint>

            <RepeatableList
                label="Title segments"
                items={data.titleParts || []}
                onChange={v => onChange(set(data, 'titleParts', v))}
                makeNew={() => ({ text: '', gradient: false })}
                renderItem={(item, update) => (
                    <Toggle label="Gradient fill" value={!!item.gradient} onChange={v => update({ ...item, gradient: v })} />
                )}
                addLabel="Add segment"
            />

            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Badge</div>
                <IconField label="Icon" value={badge.icon} onChange={v => onChange(set(data, 'badge', { ...badge, icon: v }))} />
            </div>

            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Primary CTA</div>
                <LinkField
                    label="Destination"
                    value={primary.link}
                    pages={pages}
                    onChange={v => onChange(set(data, 'primaryCta', { ...primary, link: v }))}
                />
            </div>

            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Secondary CTA</div>
                <LinkField
                    label="Destination"
                    value={secondary.link}
                    pages={pages}
                    onChange={v => onChange(set(data, 'secondaryCta', { ...secondary, link: v }))}
                />
            </div>

            <RepeatableList
                label="Mockup chat bubbles"
                items={mockup.chatBubbles || []}
                onChange={v => onChange(set(data, 'mockup', { ...mockup, chatBubbles: v }))}
                makeNew={() => ({ role: 'user', text: '' })}
                renderItem={(item, update) => (
                    <FieldSelect
                        label="Speaker"
                        value={item.role}
                        options={[{ value: 'user', label: 'User' }, { value: 'ai', label: 'AI' }]}
                        onChange={v => update({ ...item, role: v })}
                    />
                )}
                addLabel="Add bubble"
            />
        </>
    );
}

// ── Social Proof ──────────────────────────────────────────────────────

export function SocialProofEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click the eyebrow text to edit. Logos with no image fall back to text.</InlineHint>
            <RepeatableList
                label="Logos"
                items={data.logos || []}
                onChange={v => onChange(set(data, 'logos', v))}
                makeNew={() => ({ src: '', alt: 'New logo' })}
                renderItem={(item, update) => (
                    <ImageField label="Logo image (optional)" value={item.src} onChange={v => update({ ...item, src: v })} />
                )}
                addLabel="Add logo"
            />
        </>
    );
}

// ── Content (generic flexible block) ─────────────────────────────────

export function ContentEditor({ data = {}, pages = [], onChange }) {
    const setField = (key, value) => onChange(set(data, key, value));

    const showSubheading = data.subheading !== null && data.subheading !== undefined;
    const showImage      = !!data.image;
    const showCta        = !!data.cta;

    const toggleSubheading = (next) => setField('subheading', next ? '' : null);
    const toggleImage      = (next) => setField('image', next ? { src: '', alt: '' } : null);
    const toggleCta        = (next) => setField('cta',
        next ? { label: 'Get started', link: { kind: 'anchor', anchor: '' } } : null);

    const updateImage = (key, value) => setField('image', { ...(data.image || {}), [key]: value });
    const updateCta   = (key, value) => setField('cta',   { ...(data.cta   || {}), [key]: value });

    return (
        <>
            <InlineHint>
                Click the heading, subheading, body, and CTA label in the preview to edit them.
                Use the toggles below to add or remove the optional pieces.
            </InlineHint>

            <Toggle label="Show subheading" value={showSubheading} onChange={toggleSubheading} />
            <Toggle label="Show image"      value={showImage}      onChange={toggleImage} />

            {showImage ? (
                <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                    <ImageField
                        label="Image"
                        value={data.image?.src || ''}
                        onChange={v => updateImage('src', v)}
                    />
                    <TextField
                        label="Alt text"
                        value={data.image?.alt || ''}
                        onChange={v => updateImage('alt', v)}
                        placeholder="Describe the image"
                    />
                </div>
            ) : null}

            <Toggle label="Show CTA" value={showCta} onChange={toggleCta} />

            {showCta ? (
                <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                    <LinkField
                        label="Destination"
                        value={data.cta?.link}
                        pages={pages}
                        onChange={v => updateCta('link', v)}
                    />
                </div>
            ) : null}

            <FieldSelect
                label="Image position"
                value={data.imagePosition || 'below'}
                options={[
                    { value: 'above', label: 'Above text' },
                    { value: 'below', label: 'Below text' },
                    { value: 'left',  label: 'Left of text' },
                    { value: 'right', label: 'Right of text' },
                ]}
                onChange={v => setField('imagePosition', v)}
            />

            <FieldSelect
                label="Text alignment"
                value={data.textAlign || 'left'}
                options={[
                    { value: 'left',   label: 'Left' },
                    { value: 'center', label: 'Center' },
                    { value: 'right',  label: 'Right' },
                ]}
                onChange={v => setField('textAlign', v)}
            />

            <FieldSelect
                label="Background"
                value={data.backgroundVariant || 'default'}
                options={[
                    { value: 'default', label: 'Default (page bg)' },
                    { value: 'surface', label: 'Surface (alt bg)' },
                    { value: 'primary', label: 'Primary (brand color)' },
                    { value: 'dark',    label: 'Dark (secondary color)' },
                ]}
                onChange={v => setField('backgroundVariant', v)}
            />
        </>
    );
}

// ── Media + Text ─────────────────────────────────────────────────────

export function MediaTextEditor({ data = {}, pages = [], onChange }) {
    const setField = (key, value) => onChange(set(data, key, value));
    const media    = data.media || { kind: 'image', src: '', alt: '' };

    const showSubheading = data.subheading !== null && data.subheading !== undefined;
    const showCta        = !!data.cta;

    const toggleSubheading = (next) => setField('subheading', next ? '' : null);
    const toggleCta        = (next) => setField('cta',
        next ? { label: 'Learn more', link: { kind: 'anchor', anchor: '' } } : null);

    const updateMedia = (key, value) => setField('media', { ...media, [key]: value });
    const updateCta   = (key, value) => setField('cta',   { ...(data.cta || {}), [key]: value });

    return (
        <>
            <InlineHint>
                Click the heading, subheading, body, and CTA label in the preview to edit them.
                Media (image / video) and the layout knobs live below.
            </InlineHint>

            <Toggle label="Show subheading" value={showSubheading} onChange={toggleSubheading} />
            <Toggle label="Show CTA"        value={showCta}        onChange={toggleCta} />

            {showCta ? (
                <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                    <LinkField
                        label="Destination"
                        value={data.cta?.link}
                        pages={pages}
                        onChange={v => updateCta('link', v)}
                    />
                </div>
            ) : null}

            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <FieldSelect
                    label="Media type"
                    value={media.kind || 'image'}
                    options={[
                        { value: 'image', label: 'Image' },
                        { value: 'video', label: 'Video (embed URL)' },
                    ]}
                    onChange={v => updateMedia('kind', v)}
                />

                {media.kind === 'image' ? (
                    <>
                        <ImageField
                            label="Image"
                            value={media.src || ''}
                            onChange={v => updateMedia('src', v)}
                        />
                        <TextField
                            label="Alt text"
                            value={media.alt || ''}
                            onChange={v => updateMedia('alt', v)}
                            placeholder="Describe the image"
                        />
                    </>
                ) : (
                    <TextField
                        label="Video embed URL"
                        value={media.src || ''}
                        onChange={v => updateMedia('src', v)}
                        placeholder="https://www.youtube.com/embed/… or https://player.vimeo.com/video/…"
                        hint="Use the embed URL, not the public watch URL."
                    />
                )}
            </div>

            <FieldSelect
                label="Media position"
                value={data.mediaPosition || 'left'}
                options={[
                    { value: 'left',  label: 'Left' },
                    { value: 'right', label: 'Right' },
                ]}
                onChange={v => setField('mediaPosition', v)}
            />

            <FieldSelect
                label="Media size"
                value={data.mediaSize || 'half'}
                options={[
                    { value: 'half',       label: 'Half (50 / 50)' },
                    { value: 'third',      label: 'One third (33 / 67)' },
                    { value: 'two-thirds', label: 'Two thirds (66 / 34)' },
                ]}
                onChange={v => setField('mediaSize', v)}
            />

            <FieldSelect
                label="Background"
                value={data.backgroundVariant || 'default'}
                options={[
                    { value: 'default', label: 'Default (page bg)' },
                    { value: 'surface', label: 'Surface (alt bg)' },
                    { value: 'primary', label: 'Primary (brand color)' },
                    { value: 'dark',    label: 'Dark (secondary color)' },
                ]}
                onChange={v => setField('backgroundVariant', v)}
            />
        </>
    );
}

// ── Features ──────────────────────────────────────────────────────────

export function FeaturesEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Eyebrow, title, lead, and each card's title / body / tag are editable in the preview.</InlineHint>
            <RepeatableList
                label="Feature cards"
                items={data.items || []}
                onChange={v => onChange(set(data, 'items', v))}
                makeNew={() => ({ icon: 'Sparkles', title: 'New feature', body: '', techTag: '' })}
                renderItem={(item, update) => (
                    <IconField label="Icon" value={item.icon} onChange={v => update({ ...item, icon: v })} />
                )}
                addLabel="Add card"
            />
        </>
    );
}

// ── Steps ─────────────────────────────────────────────────────────────

export function StepsEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click any step's number, title, body, or example in the preview to edit.</InlineHint>
            <RepeatableList
                label="Steps"
                items={data.items || []}
                onChange={v => onChange(set(data, 'items', v))}
                makeNew={() => ({ number: '', title: 'New step', body: '', example: '' })}
                renderItem={() => null}
                addLabel="Add step"
            />
        </>
    );
}

// ── Security ──────────────────────────────────────────────────────────

export function SecurityEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click any card's title, summary, or detail bullet to edit.</InlineHint>
            <RepeatableList
                label="Security cards"
                items={data.cards || []}
                onChange={v => onChange(set(data, 'cards', v))}
                makeNew={() => ({ icon: 'ShieldCheck', title: 'New card', summary: '', details: [] })}
                renderItem={(item, update) => (
                    <>
                        <IconField label="Icon" value={item.icon} onChange={v => update({ ...item, icon: v })} />
                        <RepeatableList
                            label="Detail bullets"
                            items={item.details || []}
                            onChange={v => update({ ...item, details: v })}
                            makeNew={() => 'New detail'}
                            renderItem={() => null}
                            addLabel="Add detail"
                        />
                    </>
                )}
                addLabel="Add card"
            />
        </>
    );
}

// ── Integrations ──────────────────────────────────────────────────────

export function IntegrationsEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Category headings and tool names are editable in the preview.</InlineHint>
            <RepeatableList
                label="Categories"
                items={data.categories || []}
                onChange={v => onChange(set(data, 'categories', v))}
                makeNew={() => ({ heading: 'New category', items: [] })}
                renderItem={(cat, updateCat) => (
                    <RepeatableList
                        label="Tools"
                        items={cat.items || []}
                        onChange={v => updateCat({ ...cat, items: v })}
                        makeNew={() => ({ icon: 'Plug', label: 'Tool' })}
                        renderItem={(it, updIt) => (
                            <IconField label="Icon" value={it.icon} onChange={v => updIt({ ...it, icon: v })} />
                        )}
                        addLabel="Add tool"
                    />
                )}
                addLabel="Add category"
            />
        </>
    );
}

// ── Architecture ──────────────────────────────────────────────────────

export function ArchitectureEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click layer labels and tags in the preview to edit them.</InlineHint>
            <RepeatableList
                label="Layers"
                items={data.layers || []}
                onChange={v => onChange(set(data, 'layers', v))}
                makeNew={() => ({ label: 'New layer', tags: [] })}
                renderItem={(layer, updateLayer) => (
                    <RepeatableList
                        label="Tags"
                        items={layer.tags || []}
                        onChange={v => updateLayer({ ...layer, tags: v })}
                        makeNew={() => 'tag'}
                        renderItem={() => null}
                        addLabel="Add tag"
                    />
                )}
                addLabel="Add layer"
            />
        </>
    );
}

// ── Tech Stats ────────────────────────────────────────────────────────

export function TechStatsEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click any number or label in the preview to edit.</InlineHint>
            <RepeatableList
                label="Stats"
                items={data.stats || []}
                onChange={v => onChange(set(data, 'stats', v))}
                makeNew={() => ({ number: '0', label: 'New metric' })}
                renderItem={() => null}
                addLabel="Add stat"
            />
        </>
    );
}

// ── CTA ───────────────────────────────────────────────────────────────

export function CTAEditor({ data = {}, pages = [], onChange }) {
    const button = data.button || {};
    return (
        <>
            <InlineHint>Title, lead, and button label are editable in the preview.</InlineHint>
            <LinkField
                label="Button destination"
                value={button.link}
                pages={pages}
                onChange={v => onChange(set(data, 'button', { ...button, link: v }))}
            />
        </>
    );
}

// ── CTA Banner ───────────────────────────────────────────────────────

export function CtaBannerEditor({ data = {}, pages = [], onChange }) {
    const setField = (key, value) => onChange(set(data, key, value));
    const primary  = data.primaryCta || { label: '', link: { kind: 'external', url: '' } };
    const showSecondary = !!data.secondaryCta;

    const toggleSecondary = (next) => setField('secondaryCta',
        next ? { label: 'Learn more', link: { kind: 'anchor', anchor: '' } } : null);

    const updatePrimary   = (key, value) => setField('primaryCta',   { ...primary,                    [key]: value });
    const updateSecondary = (key, value) => setField('secondaryCta', { ...(data.secondaryCta || {}),  [key]: value });

    return (
        <>
            <InlineHint>Click heading and subheading in the preview to edit inline.</InlineHint>

            <FieldSelect
                label="Layout"
                value={data.layout || 'centered'}
                options={[
                    { value: 'centered', label: 'Centered' },
                    { value: 'split',    label: 'Split (heading left, CTAs right)' },
                ]}
                onChange={v => setField('layout', v)}
            />

            <FieldSelect
                label="Background"
                value={data.backgroundVariant || 'primary'}
                options={[
                    { value: 'default', label: 'Default (page bg)' },
                    { value: 'surface', label: 'Surface (alt bg)' },
                    { value: 'primary', label: 'Primary (brand color)' },
                    { value: 'dark',    label: 'Dark (secondary color)' },
                ]}
                onChange={v => setField('backgroundVariant', v)}
            />

            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Primary CTA</div>
                <TextField
                    label="Button label"
                    value={primary.label || ''}
                    onChange={v => updatePrimary('label', v)}
                />
                <LinkField
                    label="Destination"
                    value={primary.link}
                    pages={pages}
                    onChange={v => updatePrimary('link', v)}
                />
            </div>

            <Toggle label="Show secondary CTA" value={showSecondary} onChange={toggleSecondary} />

            {showSecondary ? (
                <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                    <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Secondary CTA</div>
                    <TextField
                        label="Button label"
                        value={data.secondaryCta?.label || ''}
                        onChange={v => updateSecondary('label', v)}
                    />
                    <LinkField
                        label="Destination"
                        value={data.secondaryCta?.link}
                        pages={pages}
                        onChange={v => updateSecondary('link', v)}
                    />
                </div>
            ) : null}
        </>
    );
}

// ── Footer ────────────────────────────────────────────────────────────

export function FooterEditor({ data = {}, pages = [], onChange }) {
    return (
        <>
            <InlineHint>Brand text, blurb, column headings, link labels, and copyright are editable in the preview.</InlineHint>
            <RepeatableList
                label="Columns"
                items={data.columns || []}
                onChange={v => onChange(set(data, 'columns', v))}
                makeNew={() => ({ id: `fcol_${Math.random().toString(36).slice(2,8)}`, heading: 'New column', links: [] })}
                renderItem={(col, updateCol) => (
                    <RepeatableList
                        label="Links"
                        items={col.links || []}
                        onChange={v => updateCol({ ...col, links: v })}
                        makeNew={() => ({ id: `fl_${Math.random().toString(36).slice(2,8)}`, label: 'New link', link: { kind: 'external', url: '#' } })}
                        renderItem={(l, updL) => (
                            <LinkField
                                label="Link"
                                value={l.link}
                                pages={pages}
                                onChange={v => updL({ ...l, link: v })}
                            />
                        )}
                        addLabel="Add link"
                    />
                )}
                addLabel="Add column"
            />
            <RepeatableList
                label="Social links"
                items={data.socials || []}
                onChange={v => onChange(set(data, 'socials', v))}
                makeNew={() => ({ id: `soc_${Math.random().toString(36).slice(2,8)}`, platform: 'github', link: { kind: 'external', url: '' } })}
                renderItem={(s, updS) => (
                    <>
                        <FieldSelect
                            label="Platform"
                            value={s.platform}
                            options={[
                                { value: 'github',   label: 'GitHub' },
                                { value: 'twitter',  label: 'Twitter / X' },
                                { value: 'linkedin', label: 'LinkedIn' },
                                { value: 'other',    label: 'Other' },
                            ]}
                            onChange={v => updS({ ...s, platform: v })}
                        />
                        <LinkField
                            label="URL"
                            value={s.link}
                            pages={pages}
                            onChange={v => updS({ ...s, link: v })}
                        />
                    </>
                )}
                addLabel="Add social"
            />
        </>
    );
}

// ── shared internal ───────────────────────────────────────────────────

function FieldSelect({ value, onChange, options, label }) {
    return (
        <div className="flex flex-col gap-1.5 mb-3">
            {label ? <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label> : null}
            <select
                className="w-full px-3 py-2 rounded-md text-sm border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
            >
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );
}

// ── Catalogue + registries ────────────────────────────────────────────
//
// BLOCK_CATALOGUE   used by BlockList (add picker) and BlockRow (labels/icons)
// BLOCK_EDITORS     used by ProductWebsitePanel to render the active editor
// BLOCK_DEFAULTS    used by the panel when creating a new block

export const BLOCK_CATALOGUE = {
    hero:         { type: 'hero',         label: 'Hero',           icon: 'Megaphone',   category: 'Above the fold' },
    socialProof:  { type: 'socialProof',  label: 'Social proof',   icon: 'Users',       category: 'Above the fold' },
    content:      { type: 'content',      label: 'Content',        icon: 'Type',             category: 'Content' },
    'media-text': { type: 'media-text',   label: 'Media + Text',   icon: 'LayoutPanelLeft',  category: 'Content' },
    features:     { type: 'features',     label: 'Features',       icon: 'Sparkles',         category: 'Content' },
    steps:        { type: 'steps',        label: 'How it works',   icon: 'ListOrdered', category: 'Content' },
    security:     { type: 'security',     label: 'Security',       icon: 'ShieldCheck', category: 'Content' },
    integrations: { type: 'integrations', label: 'Integrations',   icon: 'Plug',        category: 'Content' },
    architecture: { type: 'architecture', label: 'Architecture',   icon: 'Boxes',       category: 'Content' },
    techStats:    { type: 'techStats',    label: 'Stats',          icon: 'BarChart3',   category: 'Content' },
    cta:          { type: 'cta',          label: 'Call to action', icon: 'Target',           category: 'Conversion' },
    'cta-banner': { type: 'cta-banner',   label: 'CTA Banner',     icon: 'Rocket',           category: 'Conversion' },
};

export const BLOCK_EDITORS = {
    hero:         { component: HeroEditor,         label: 'Hero',           icon: 'Megaphone'   },
    socialProof:  { component: SocialProofEditor,  label: 'Social proof',   icon: 'Users'       },
    content:      { component: ContentEditor,      label: 'Content',        icon: 'Type'             },
    'media-text': { component: MediaTextEditor,    label: 'Media + Text',   icon: 'LayoutPanelLeft'  },
    features:     { component: FeaturesEditor,     label: 'Features',       icon: 'Sparkles'         },
    steps:        { component: StepsEditor,        label: 'How it works',   icon: 'ListOrdered' },
    security:     { component: SecurityEditor,     label: 'Security',       icon: 'ShieldCheck' },
    integrations: { component: IntegrationsEditor, label: 'Integrations',   icon: 'Plug'        },
    architecture: { component: ArchitectureEditor, label: 'Architecture',   icon: 'Boxes'       },
    techStats:    { component: TechStatsEditor,    label: 'Stats',          icon: 'BarChart3'   },
    cta:          { component: CTAEditor,          label: 'Call to action', icon: 'Target'           },
    'cta-banner': { component: CtaBannerEditor,    label: 'CTA Banner',     icon: 'Rocket'           },
};

// Brand-neutral placeholder content used when the user clicks "+ Add block"
// in the panel. Kept in sync with server/i18n/defaults/cmsDefaults.js so a
// block created via the panel matches one created server-side.
export const BLOCK_DEFAULTS = {
    hero: {
        eyebrow: '',
        badge: { text: '', icon: '' },
        titleParts: [{ text: 'Your headline here', gradient: false }],
        lead: 'Describe your product or service',
        primaryCta:   { label: 'Get started', link: { kind: 'anchor', anchor: '' } },
        secondaryCta: { label: 'Learn more',  link: { kind: 'anchor', anchor: '' } },
        mockup: { chatBubbles: [] },
    },
    socialProof: {
        eyebrow: 'Add your client logos',
        logos: [],
    },
    content: {
        heading:           'Your heading here',
        subheading:        null,
        body:              'Add your content here.',
        image:             null,                       // { src, alt }
        cta:               null,                       // { label, link: { kind, ... } }
        imagePosition:     'below',                    // 'above' | 'below' | 'left' | 'right'
        textAlign:         'left',                     // 'left' | 'center' | 'right'
        backgroundVariant: 'default',                  // 'default' | 'surface' | 'primary' | 'dark'
    },
    'media-text': {
        heading:           'Your heading here',
        subheading:        null,
        body:              'Add your content here.',
        cta:               null,                       // { label, link: { kind, ... } }
        media: {
            kind: 'image',                              // 'image' | 'video'
            src:  '',
            alt:  '',
        },
        mediaPosition:     'left',                     // 'left' | 'right'
        mediaSize:         'half',                     // 'half' | 'third' | 'two-thirds'
        backgroundVariant: 'default',                  // 'default' | 'surface' | 'primary' | 'dark'
    },
    features: {
        eyebrow: 'Features',
        title: 'What we offer',
        lead: '',
        items: [
            { icon: 'Star',   title: 'Feature 1', body: 'Describe this feature', techTag: '' },
            { icon: 'Zap',    title: 'Feature 2', body: 'Describe this feature', techTag: '' },
            { icon: 'Shield', title: 'Feature 3', body: 'Describe this feature', techTag: '' },
        ],
    },
    steps: {
        eyebrow: '',
        title: 'How it works',
        lead: '',
        items: [
            { number: '1', title: 'Step 1', body: 'Describe what happens in this step', example: '' },
            { number: '2', title: 'Step 2', body: 'Describe what happens in this step', example: '' },
            { number: '3', title: 'Step 3', body: 'Describe what happens in this step', example: '' },
        ],
    },
    security: {
        eyebrow: '',
        title: 'Security',
        lead: '',
        cards: [
            { icon: 'Lock',        title: 'Data encryption', summary: 'Describe your encryption story', details: [] },
            { icon: 'KeyRound',    title: 'Access control',  summary: 'Describe your access controls',  details: [] },
            { icon: 'ShieldCheck', title: 'Compliance',      summary: 'Describe your compliance posture', details: [] },
        ],
    },
    integrations: {
        eyebrow: '',
        title: 'Integrations',
        lead: 'Add your integrations',
        categories: [],
    },
    architecture: {
        eyebrow: '',
        title: 'Architecture',
        lead: 'Describe your architecture',
        layers: [{ label: 'Layer 1', tags: [] }],
    },
    techStats: {
        eyebrow: '',
        title: 'Key numbers',
        stats: [
            { number: '100+', label: 'Customers' },
            { number: '99%',  label: 'Uptime' },
            { number: '24/7', label: 'Support' },
        ],
    },
    cta: {
        title: 'Ready to get started?',
        lead: 'Contact us today',
        button: { label: 'Get started', link: { kind: 'anchor', anchor: '' } },
    },
    'cta-banner': {
        heading:           'Ready to get started?',
        subheading:        'Join thousands of teams already using the platform.',
        layout:            'centered',                  // 'centered' | 'split'
        backgroundVariant: 'primary',                   // 'default' | 'surface' | 'primary' | 'dark'
        primaryCta: {
            label: 'Get started',
            link: { kind: 'external', url: '', newTab: false },
        },
        secondaryCta:      null,                        // null | { label, link: { kind, ... } }
    },
};

// Legacy aliases — kept so AdminDashboard and any other import that uses
// the old names doesn't break before it's updated.
export const SECTION_EDITORS = BLOCK_EDITORS;
export const SECTION_ORDER   = Object.keys(BLOCK_CATALOGUE);
