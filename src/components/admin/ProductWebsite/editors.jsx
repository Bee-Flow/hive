import React from 'react';
import { TextField, TextArea, Toggle, IconField, ImageField, RepeatableList } from './fields';

// Each editor receives:
//   data:     this section's slice of the content tree
//   onChange: (next) => set the slice
// Editors should be tolerant of missing keys (data may come from defaults
// or from a freshly-added locale with `{}`).

const set = (data, key, value) => ({ ...(data || {}), [key]: value });

// ── Header ───────────────────────────────────────────────────────────────
export function HeaderEditor({ data = {}, onChange }) {
    return (
        <>
            <TextField label="Logo text" value={data.logoText} onChange={(v) => onChange(set(data, 'logoText', v))} />
            <TextField label="Login button label" value={data.loginLabel} onChange={(v) => onChange(set(data, 'loginLabel', v))} />
            <TextField label="CTA button label" value={data.ctaLabel} onChange={(v) => onChange(set(data, 'ctaLabel', v))} />
            <TextField label="CTA href" value={data.ctaHref} onChange={(v) => onChange(set(data, 'ctaHref', v))} hint="Defaults to /app" />
            <RepeatableList
                label="Nav links"
                items={data.navLinks || []}
                onChange={(v) => onChange(set(data, 'navLinks', v))}
                makeNew={() => ({ label: '', href: '#' })}
                renderItem={(item, update) => (
                    <>
                        <TextField label="Label" value={item.label} onChange={(v) => update({ ...item, label: v })} />
                        <TextField label="Href"  value={item.href}  onChange={(v) => update({ ...item, href: v })} />
                    </>
                )}
            />
        </>
    );
}

// ── Hero ─────────────────────────────────────────────────────────────────
export function HeroEditor({ data = {}, onChange }) {
    const badge = data.badge || {};
    const primary = data.primaryCta || {};
    const secondary = data.secondaryCta || {};
    const mockup = data.mockup || {};
    return (
        <>
            <TextField label="Eyebrow" value={data.eyebrow} onChange={(v) => onChange(set(data, 'eyebrow', v))} />
            <RepeatableList
                label="Title parts (toggle gradient per part)"
                items={data.titleParts || []}
                onChange={(v) => onChange(set(data, 'titleParts', v))}
                makeNew={() => ({ text: '', gradient: false })}
                renderItem={(item, update) => (
                    <>
                        <TextField label="Text" value={item.text} onChange={(v) => update({ ...item, text: v })} />
                        <Toggle label="Gradient fill" value={!!item.gradient} onChange={(v) => update({ ...item, gradient: v })} />
                    </>
                )}
            />
            <TextArea label="Lead paragraph" value={data.lead} onChange={(v) => onChange(set(data, 'lead', v))} />

            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Badge</div>
                <TextField label="Badge text" value={badge.text} onChange={(v) => onChange(set(data, 'badge', { ...badge, text: v }))} />
                <IconField label="Badge icon" value={badge.icon} onChange={(v) => onChange(set(data, 'badge', { ...badge, icon: v }))} />
            </div>

            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Primary CTA</div>
                <TextField label="Label" value={primary.label} onChange={(v) => onChange(set(data, 'primaryCta', { ...primary, label: v }))} />
                <TextField label="Href"  value={primary.href}  onChange={(v) => onChange(set(data, 'primaryCta', { ...primary, href: v }))} hint="Defaults to /app" />
            </div>

            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Secondary CTA</div>
                <TextField label="Label" value={secondary.label} onChange={(v) => onChange(set(data, 'secondaryCta', { ...secondary, label: v }))} />
                <TextField label="Href"  value={secondary.href}  onChange={(v) => onChange(set(data, 'secondaryCta', { ...secondary, href: v }))} />
            </div>

            <RepeatableList
                label="Mockup chat bubbles"
                items={mockup.chatBubbles || []}
                onChange={(v) => onChange(set(data, 'mockup', { ...mockup, chatBubbles: v }))}
                makeNew={() => ({ role: 'user', text: '' })}
                renderItem={(item, update) => (
                    <>
                        <FieldSelect
                            label="Role"
                            value={item.role}
                            options={[{ value: 'user', label: 'User' }, { value: 'ai', label: 'AI' }]}
                            onChange={(v) => update({ ...item, role: v })}
                        />
                        <TextArea label="Text" value={item.text} onChange={(v) => update({ ...item, text: v })} rows={2} />
                    </>
                )}
            />
        </>
    );
}

// ── Social Proof ────────────────────────────────────────────────────────
export function SocialProofEditor({ data = {}, onChange }) {
    return (
        <>
            <TextField label="Eyebrow" value={data.eyebrow} onChange={(v) => onChange(set(data, 'eyebrow', v))} />
            <RepeatableList
                label="Logos"
                items={data.logos || []}
                onChange={(v) => onChange(set(data, 'logos', v))}
                makeNew={() => ({ src: '', alt: '' })}
                renderItem={(item, update) => (
                    <>
                        <ImageField label="Logo image" value={item.src} onChange={(v) => update({ ...item, src: v })} />
                        <TextField label="Alt / fallback text" value={item.alt} onChange={(v) => update({ ...item, alt: v })} />
                    </>
                )}
            />
        </>
    );
}

// ── Features ────────────────────────────────────────────────────────────
export function FeaturesEditor({ data = {}, onChange }) {
    return (
        <>
            <TextField label="Eyebrow" value={data.eyebrow} onChange={(v) => onChange(set(data, 'eyebrow', v))} />
            <TextField label="Title"   value={data.title}   onChange={(v) => onChange(set(data, 'title', v))} />
            <TextArea  label="Lead"    value={data.lead}    onChange={(v) => onChange(set(data, 'lead', v))} />
            <RepeatableList
                label="Feature cards"
                items={data.items || []}
                onChange={(v) => onChange(set(data, 'items', v))}
                makeNew={() => ({ icon: '', title: '', body: '', techTag: '' })}
                renderItem={(item, update) => (
                    <>
                        <IconField label="Icon" value={item.icon} onChange={(v) => update({ ...item, icon: v })} />
                        <TextField label="Title" value={item.title} onChange={(v) => update({ ...item, title: v })} />
                        <TextArea  label="Body"  value={item.body}  onChange={(v) => update({ ...item, body: v })} />
                        <TextField label="Tech tag (optional)" value={item.techTag} onChange={(v) => update({ ...item, techTag: v })} />
                    </>
                )}
            />
        </>
    );
}

// ── Steps ───────────────────────────────────────────────────────────────
export function StepsEditor({ data = {}, onChange }) {
    return (
        <>
            <TextField label="Eyebrow" value={data.eyebrow} onChange={(v) => onChange(set(data, 'eyebrow', v))} />
            <TextField label="Title"   value={data.title}   onChange={(v) => onChange(set(data, 'title', v))} />
            <TextArea  label="Lead"    value={data.lead}    onChange={(v) => onChange(set(data, 'lead', v))} />
            <RepeatableList
                label="Steps"
                items={data.items || []}
                onChange={(v) => onChange(set(data, 'items', v))}
                makeNew={() => ({ number: '', title: '', body: '', example: '' })}
                renderItem={(item, update) => (
                    <>
                        <TextField label="Number / badge" value={item.number} onChange={(v) => update({ ...item, number: v })} />
                        <TextField label="Title" value={item.title} onChange={(v) => update({ ...item, title: v })} />
                        <TextArea  label="Body"  value={item.body}  onChange={(v) => update({ ...item, body: v })} />
                        <TextField label="Example (optional, italic)" value={item.example} onChange={(v) => update({ ...item, example: v })} />
                    </>
                )}
            />
        </>
    );
}

// ── Security ────────────────────────────────────────────────────────────
export function SecurityEditor({ data = {}, onChange }) {
    return (
        <>
            <TextField label="Eyebrow" value={data.eyebrow} onChange={(v) => onChange(set(data, 'eyebrow', v))} />
            <TextField label="Title"   value={data.title}   onChange={(v) => onChange(set(data, 'title', v))} />
            <TextArea  label="Lead"    value={data.lead}    onChange={(v) => onChange(set(data, 'lead', v))} />
            <RepeatableList
                label="Security cards"
                items={data.cards || []}
                onChange={(v) => onChange(set(data, 'cards', v))}
                makeNew={() => ({ icon: '', title: '', summary: '', details: [] })}
                renderItem={(item, update) => (
                    <>
                        <IconField label="Icon" value={item.icon} onChange={(v) => update({ ...item, icon: v })} />
                        <TextField label="Title" value={item.title} onChange={(v) => update({ ...item, title: v })} />
                        <TextArea  label="Summary" value={item.summary} onChange={(v) => update({ ...item, summary: v })} />
                        <RepeatableList
                            label="Details (revealed on click)"
                            items={item.details || []}
                            onChange={(v) => update({ ...item, details: v })}
                            makeNew={() => ''}
                            renderItem={(d, updD) => (
                                <TextField label="" value={d} onChange={(v) => updD(v)} />
                            )}
                            addLabel="Add detail"
                        />
                    </>
                )}
            />
        </>
    );
}

// ── Integrations ────────────────────────────────────────────────────────
export function IntegrationsEditor({ data = {}, onChange }) {
    return (
        <>
            <TextField label="Eyebrow" value={data.eyebrow} onChange={(v) => onChange(set(data, 'eyebrow', v))} />
            <TextField label="Title"   value={data.title}   onChange={(v) => onChange(set(data, 'title', v))} />
            <TextArea  label="Lead"    value={data.lead}    onChange={(v) => onChange(set(data, 'lead', v))} />
            <RepeatableList
                label="Categories"
                items={data.categories || []}
                onChange={(v) => onChange(set(data, 'categories', v))}
                makeNew={() => ({ heading: '', items: [] })}
                renderItem={(cat, updateCat) => (
                    <>
                        <TextField label="Heading" value={cat.heading} onChange={(v) => updateCat({ ...cat, heading: v })} />
                        <RepeatableList
                            label="Items"
                            items={cat.items || []}
                            onChange={(v) => updateCat({ ...cat, items: v })}
                            makeNew={() => ({ icon: '', label: '' })}
                            renderItem={(it, updIt) => (
                                <>
                                    <IconField label="Icon" value={it.icon} onChange={(v) => updIt({ ...it, icon: v })} />
                                    <TextField label="Label" value={it.label} onChange={(v) => updIt({ ...it, label: v })} />
                                </>
                            )}
                            addLabel="Add item"
                        />
                    </>
                )}
            />
        </>
    );
}

// ── Architecture ────────────────────────────────────────────────────────
export function ArchitectureEditor({ data = {}, onChange }) {
    return (
        <>
            <TextField label="Eyebrow" value={data.eyebrow} onChange={(v) => onChange(set(data, 'eyebrow', v))} />
            <TextField label="Title"   value={data.title}   onChange={(v) => onChange(set(data, 'title', v))} />
            <TextArea  label="Lead"    value={data.lead}    onChange={(v) => onChange(set(data, 'lead', v))} />
            <RepeatableList
                label="Layers"
                items={data.layers || []}
                onChange={(v) => onChange(set(data, 'layers', v))}
                makeNew={() => ({ label: '', tags: [] })}
                renderItem={(layer, updateLayer) => (
                    <>
                        <TextField label="Label" value={layer.label} onChange={(v) => updateLayer({ ...layer, label: v })} />
                        <RepeatableList
                            label="Tags"
                            items={layer.tags || []}
                            onChange={(v) => updateLayer({ ...layer, tags: v })}
                            makeNew={() => ''}
                            renderItem={(t, updT) => (
                                <TextField label="" value={t} onChange={(v) => updT(v)} />
                            )}
                            addLabel="Add tag"
                        />
                    </>
                )}
            />
        </>
    );
}

// ── Tech Stats ──────────────────────────────────────────────────────────
export function TechStatsEditor({ data = {}, onChange }) {
    return (
        <>
            <TextField label="Eyebrow" value={data.eyebrow} onChange={(v) => onChange(set(data, 'eyebrow', v))} />
            <TextField label="Title"   value={data.title}   onChange={(v) => onChange(set(data, 'title', v))} />
            <RepeatableList
                label="Stats"
                items={data.stats || []}
                onChange={(v) => onChange(set(data, 'stats', v))}
                makeNew={() => ({ number: '', label: '' })}
                renderItem={(item, update) => (
                    <>
                        <TextField label="Number" value={item.number} onChange={(v) => update({ ...item, number: v })} />
                        <TextField label="Label"  value={item.label}  onChange={(v) => update({ ...item, label: v })} />
                    </>
                )}
            />
        </>
    );
}

// ── CTA ─────────────────────────────────────────────────────────────────
export function CTAEditor({ data = {}, onChange }) {
    const button = data.button || {};
    return (
        <>
            <TextField label="Title" value={data.title} onChange={(v) => onChange(set(data, 'title', v))} />
            <TextArea  label="Lead"  value={data.lead}  onChange={(v) => onChange(set(data, 'lead', v))} />
            <TextField label="Button label" value={button.label} onChange={(v) => onChange(set(data, 'button', { ...button, label: v }))} />
            <TextField label="Button href"  value={button.href}  onChange={(v) => onChange(set(data, 'button', { ...button, href: v }))} hint="Defaults to /app" />
        </>
    );
}

// ── Footer ──────────────────────────────────────────────────────────────
export function FooterEditor({ data = {}, onChange }) {
    const brand = data.brand || {};
    return (
        <>
            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Brand block</div>
                <TextField label="Logo text" value={brand.logoText} onChange={(v) => onChange(set(data, 'brand', { ...brand, logoText: v }))} />
                <TextArea  label="Blurb"     value={brand.blurb}    onChange={(v) => onChange(set(data, 'brand', { ...brand, blurb: v }))} />
            </div>
            <RepeatableList
                label="Columns"
                items={data.columns || []}
                onChange={(v) => onChange(set(data, 'columns', v))}
                makeNew={() => ({ heading: '', links: [] })}
                renderItem={(col, updateCol) => (
                    <>
                        <TextField label="Heading" value={col.heading} onChange={(v) => updateCol({ ...col, heading: v })} />
                        <RepeatableList
                            label="Links"
                            items={col.links || []}
                            onChange={(v) => updateCol({ ...col, links: v })}
                            makeNew={() => ({ label: '', href: '#' })}
                            renderItem={(l, updL) => (
                                <>
                                    <TextField label="Label" value={l.label} onChange={(v) => updL({ ...l, label: v })} />
                                    <TextField label="Href"  value={l.href}  onChange={(v) => updL({ ...l, href: v })} />
                                </>
                            )}
                            addLabel="Add link"
                        />
                    </>
                )}
            />
            <RepeatableList
                label="Social links"
                items={data.socials || []}
                onChange={(v) => onChange(set(data, 'socials', v))}
                makeNew={() => ({ platform: 'github', href: '' })}
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
                            onChange={(v) => updS({ ...s, platform: v })}
                        />
                        <TextField label="URL" value={s.href} onChange={(v) => updS({ ...s, href: v })} />
                    </>
                )}
            />
            <TextField label="Copyright" value={data.copyright} onChange={(v) => onChange(set(data, 'copyright', v))} />
        </>
    );
}

// Local select used by Hero + Footer.
function FieldSelect({ value, onChange, options, label }) {
    return (
        <div className="flex flex-col gap-1.5 mb-3">
            {label ? <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label> : null}
            <select
                className="w-full px-3 py-2 rounded-md text-sm border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
            >
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );
}

// Section editor lookup table — used by the panel.
export const SECTION_EDITORS = {
    header:       { component: HeaderEditor,       label: 'Header' },
    hero:         { component: HeroEditor,         label: 'Hero' },
    socialProof:  { component: SocialProofEditor,  label: 'Social proof' },
    features:     { component: FeaturesEditor,     label: 'Features' },
    steps:        { component: StepsEditor,        label: 'How it works' },
    security:     { component: SecurityEditor,     label: 'Security' },
    integrations: { component: IntegrationsEditor, label: 'Integrations' },
    architecture: { component: ArchitectureEditor, label: 'Architecture' },
    techStats:    { component: TechStatsEditor,    label: 'Stats' },
    cta:          { component: CTAEditor,          label: 'Call to action' },
    footer:       { component: FooterEditor,       label: 'Footer' },
};

export const SECTION_ORDER = [
    'header', 'hero', 'socialProof', 'features', 'steps', 'security',
    'integrations', 'architecture', 'techStats', 'cta', 'footer',
];
