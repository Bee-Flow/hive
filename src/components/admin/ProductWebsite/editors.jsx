import React from 'react';
import { TextField, Toggle, IconField, ImageField, RepeatableList } from './fields';

/**
 * Section editors — only structural controls live here. Text content
 * (titles, leads, body copy, button labels, list-item text) is edited
 * directly by clicking on it in the live preview iframe.
 *
 * What you'll find in here:
 *   - Repeatable lists (add / remove / reorder items)
 *   - Icon pickers
 *   - Image uploads
 *   - URL / href fields
 *   - Per-element toggles (e.g. gradient text, social platform)
 */

const set = (data, key, value) => ({ ...(data || {}), [key]: value });
const InlineHint = ({ children }) => (
    <p className="text-xs text-[var(--text-muted)] italic mb-3 leading-relaxed">
        ✎ {children}
    </p>
);

// ── Header ───────────────────────────────────────────────────────────────
export function HeaderEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click the logo, login button, or CTA in the preview to edit their text.</InlineHint>
            <TextField label="CTA destination URL" value={data.ctaHref} onChange={(v) => onChange(set(data, 'ctaHref', v))} hint="Defaults to /app" />
            <RepeatableList
                label="Nav links"
                items={data.navLinks || []}
                onChange={(v) => onChange(set(data, 'navLinks', v))}
                makeNew={() => ({ label: 'New link', href: '#' })}
                renderItem={(item, update) => (
                    <>
                        <TextField label="Label (preview also editable)" value={item.label} onChange={(v) => update({ ...item, label: v })} />
                        <TextField label="Href" value={item.href} onChange={(v) => update({ ...item, href: v })} />
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
            <InlineHint>Click any text in the hero — eyebrow, title, lead, badge, CTA labels, chat bubbles — to edit it inline.</InlineHint>

            <RepeatableList
                label="Title segments"
                items={data.titleParts || []}
                onChange={(v) => onChange(set(data, 'titleParts', v))}
                makeNew={() => ({ text: '', gradient: false })}
                renderItem={(item, update) => (
                    <Toggle label="Gradient fill" value={!!item.gradient} onChange={(v) => update({ ...item, gradient: v })} />
                )}
                addLabel="Add segment"
            />

            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Badge</div>
                <IconField label="Icon" value={badge.icon} onChange={(v) => onChange(set(data, 'badge', { ...badge, icon: v }))} />
            </div>

            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Primary CTA</div>
                <TextField label="Destination URL" value={primary.href} onChange={(v) => onChange(set(data, 'primaryCta', { ...primary, href: v }))} hint="Defaults to /app" />
            </div>

            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Secondary CTA</div>
                <TextField label="Destination URL" value={secondary.href} onChange={(v) => onChange(set(data, 'secondaryCta', { ...secondary, href: v }))} />
            </div>

            <RepeatableList
                label="Mockup chat bubbles"
                items={mockup.chatBubbles || []}
                onChange={(v) => onChange(set(data, 'mockup', { ...mockup, chatBubbles: v }))}
                makeNew={() => ({ role: 'user', text: '' })}
                renderItem={(item, update) => (
                    <FieldSelect
                        label="Speaker"
                        value={item.role}
                        options={[{ value: 'user', label: 'User' }, { value: 'ai', label: 'AI' }]}
                        onChange={(v) => update({ ...item, role: v })}
                    />
                )}
                addLabel="Add bubble"
            />
        </>
    );
}

// ── Social Proof ────────────────────────────────────────────────────────
export function SocialProofEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click the eyebrow text to edit it. Logos with no image fall back to text — click the placeholder to rename.</InlineHint>
            <RepeatableList
                label="Logos"
                items={data.logos || []}
                onChange={(v) => onChange(set(data, 'logos', v))}
                makeNew={() => ({ src: '', alt: 'New logo' })}
                renderItem={(item, update) => (
                    <ImageField label="Logo image (optional)" value={item.src} onChange={(v) => update({ ...item, src: v })} />
                )}
                addLabel="Add logo"
            />
        </>
    );
}

// ── Features ────────────────────────────────────────────────────────────
export function FeaturesEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Eyebrow, title, lead, and each card's title / body / tag are editable directly in the preview.</InlineHint>
            <RepeatableList
                label="Feature cards"
                items={data.items || []}
                onChange={(v) => onChange(set(data, 'items', v))}
                makeNew={() => ({ icon: 'Sparkles', title: 'New feature', body: '', techTag: '' })}
                renderItem={(item, update) => (
                    <IconField label="Icon" value={item.icon} onChange={(v) => update({ ...item, icon: v })} />
                )}
                addLabel="Add card"
            />
        </>
    );
}

// ── Steps ───────────────────────────────────────────────────────────────
export function StepsEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click any step's number, title, body, or example in the preview to edit it.</InlineHint>
            <RepeatableList
                label="Steps"
                items={data.items || []}
                onChange={(v) => onChange(set(data, 'items', v))}
                makeNew={() => ({ number: '', title: 'New step', body: '', example: '' })}
                renderItem={() => null}
                addLabel="Add step"
            />
        </>
    );
}

// ── Security ────────────────────────────────────────────────────────────
export function SecurityEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click any card's title, summary, or detail bullet in the preview to edit. Click a card body to expand it.</InlineHint>
            <RepeatableList
                label="Security cards"
                items={data.cards || []}
                onChange={(v) => onChange(set(data, 'cards', v))}
                makeNew={() => ({ icon: 'ShieldCheck', title: 'New card', summary: '', details: [] })}
                renderItem={(item, update) => (
                    <>
                        <IconField label="Icon" value={item.icon} onChange={(v) => update({ ...item, icon: v })} />
                        <RepeatableList
                            label="Detail bullets"
                            items={item.details || []}
                            onChange={(v) => update({ ...item, details: v })}
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

// ── Integrations ────────────────────────────────────────────────────────
export function IntegrationsEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Category headings and tool names are editable in the preview.</InlineHint>
            <RepeatableList
                label="Categories"
                items={data.categories || []}
                onChange={(v) => onChange(set(data, 'categories', v))}
                makeNew={() => ({ heading: 'New category', items: [] })}
                renderItem={(cat, updateCat) => (
                    <RepeatableList
                        label="Tools"
                        items={cat.items || []}
                        onChange={(v) => updateCat({ ...cat, items: v })}
                        makeNew={() => ({ icon: 'Plug', label: 'Tool' })}
                        renderItem={(it, updIt) => (
                            <IconField label="Icon" value={it.icon} onChange={(v) => updIt({ ...it, icon: v })} />
                        )}
                        addLabel="Add tool"
                    />
                )}
                addLabel="Add category"
            />
        </>
    );
}

// ── Architecture ────────────────────────────────────────────────────────
export function ArchitectureEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click layer labels and tags in the preview to edit them.</InlineHint>
            <RepeatableList
                label="Layers"
                items={data.layers || []}
                onChange={(v) => onChange(set(data, 'layers', v))}
                makeNew={() => ({ label: 'New layer', tags: [] })}
                renderItem={(layer, updateLayer) => (
                    <RepeatableList
                        label="Tags"
                        items={layer.tags || []}
                        onChange={(v) => updateLayer({ ...layer, tags: v })}
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

// ── Tech Stats ──────────────────────────────────────────────────────────
export function TechStatsEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click any number or label in the preview to edit it.</InlineHint>
            <RepeatableList
                label="Stats"
                items={data.stats || []}
                onChange={(v) => onChange(set(data, 'stats', v))}
                makeNew={() => ({ number: '0', label: 'New metric' })}
                renderItem={() => null}
                addLabel="Add stat"
            />
        </>
    );
}

// ── CTA ─────────────────────────────────────────────────────────────────
export function CTAEditor({ data = {}, onChange }) {
    const button = data.button || {};
    return (
        <>
            <InlineHint>Title, lead, and button label are editable in the preview.</InlineHint>
            <TextField label="Button destination URL" value={button.href} onChange={(v) => onChange(set(data, 'button', { ...button, href: v }))} hint="Defaults to /app" />
        </>
    );
}

// ── Footer ──────────────────────────────────────────────────────────────
export function FooterEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Brand text, blurb, column headings, link labels, and the copyright line are all editable in the preview.</InlineHint>
            <RepeatableList
                label="Columns"
                items={data.columns || []}
                onChange={(v) => onChange(set(data, 'columns', v))}
                makeNew={() => ({ heading: 'New column', links: [] })}
                renderItem={(col, updateCol) => (
                    <RepeatableList
                        label="Links"
                        items={col.links || []}
                        onChange={(v) => updateCol({ ...col, links: v })}
                        makeNew={() => ({ label: 'New link', href: '#' })}
                        renderItem={(l, updL) => (
                            <TextField label="Href" value={l.href} onChange={(v) => updL({ ...l, href: v })} />
                        )}
                        addLabel="Add link"
                    />
                )}
                addLabel="Add column"
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
                addLabel="Add social"
            />
        </>
    );
}

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

export const SECTION_EDITORS = {
    header:       { component: HeaderEditor,       label: 'Header',          icon: 'PanelTop' },
    hero:         { component: HeroEditor,         label: 'Hero',            icon: 'Megaphone' },
    socialProof:  { component: SocialProofEditor,  label: 'Social proof',    icon: 'Users' },
    features:     { component: FeaturesEditor,     label: 'Features',        icon: 'Sparkles' },
    steps:        { component: StepsEditor,        label: 'How it works',    icon: 'ListOrdered' },
    security:     { component: SecurityEditor,     label: 'Security',        icon: 'ShieldCheck' },
    integrations: { component: IntegrationsEditor, label: 'Integrations',    icon: 'Plug' },
    architecture: { component: ArchitectureEditor, label: 'Architecture',    icon: 'Boxes' },
    techStats:    { component: TechStatsEditor,    label: 'Stats',           icon: 'BarChart3' },
    cta:          { component: CTAEditor,          label: 'Call to action',  icon: 'Target' },
    footer:       { component: FooterEditor,       label: 'Footer',          icon: 'PanelBottom' },
};

export const SECTION_ORDER = [
    'header', 'hero', 'socialProof', 'features', 'steps', 'security',
    'integrations', 'architecture', 'techStats', 'cta', 'footer',
];
