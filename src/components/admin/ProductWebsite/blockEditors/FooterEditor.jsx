import React from 'react';
import { TextField, Toggle, RepeatableList, LinkField, FieldRow } from '../fields';
import {
    InlineHint,
    CollapsibleCard,
    ColorSwatch,
    FontRow,
    FieldSelect,
    mintId,
} from '../primitives';
import { set } from './shared';

// ── Footer ────────────────────────────────────────────────────────────

export function FooterEditor({ data = {}, pages = [], onChange }) {
    const themeSwitcherEnabled = !!data.themeSwitcher?.enabled;
    // Master footer-link styling. Sibling to columns/socials so it
    // applies across all footer link labels (both inside columns and
    // socials when wired). Matches the *Style naming used elsewhere.
    const linkStyle = data.linkStyle || {};
    const updateLinkStyle = (patch) => onChange(set(data, 'linkStyle', { ...linkStyle, ...patch }));

    return (
        <>
            <InlineHint>Brand text, blurb, column headings, link labels, and copyright are editable in the preview.</InlineHint>

            {/* Outer "Footer" card wraps the entire editor body. The
                SectionDivider above (rendered by SiteChromeEditor) is
                redundant — flagged for cleanup in a follow-up pass. */}
            <CollapsibleCard title="Footer" defaultOpen={true} persistKey="blk.footer.main">
                <Toggle
                    label="Show theme switcher"
                    value={themeSwitcherEnabled}
                    onChange={v => onChange(set(data, 'themeSwitcher', { ...(data.themeSwitcher || {}), enabled: v }))}
                />
                <Toggle
                    label="Show EN / NL language toggle"
                    value={data.showLanguageSwitcher === true}
                    onChange={v => onChange(set(data, 'showLanguageSwitcher', v))}
                />
                <Toggle
                    label={'Show "." after brand name'}
                    value={data.showBrandDot === true}
                    onChange={v => onChange(set(data, 'showBrandDot', v))}
                />

                {/* ── Master link style (no per-link overrides) ─── */}
                <CollapsibleCard title="Link style" persistKey="blk.footer.link-style">
                    <FontRow
                        label="Link font"
                        value={linkStyle.fontFamily || ''}
                        onChange={v => updateLinkStyle({ fontFamily: v })}
                        sample="Pricing  ·  Docs  ·  Blog"
                        weight={500}
                    />
                    <FieldRow label="Link color">
                        <ColorSwatch
                            value={linkStyle.color || ''}
                            onChange={v => updateLinkStyle({ color: v })}
                            title="Footer link color"
                        />
                    </FieldRow>
                </CollapsibleCard>

                {/* ── Columns ───────────────────────────────────── */}
                <CollapsibleCard title="Columns" persistKey="blk.footer.columns">
                    <RepeatableList
                        items={data.columns || []}
                        onChange={v => onChange(set(data, 'columns', v))}
                        makeNew={() => ({ id: mintId('fcol'), heading: 'New column', links: [] })}
                        itemLabel={(c) => c.heading || '(no heading)'}
                        collapsible
                        renderItem={(col, updateCol) => (
                            <>
                                <TextField
                                    label="Heading"
                                    value={col.heading || ''}
                                    onChange={v => updateCol({ ...col, heading: v })}
                                />
                                <RepeatableList
                                    label="Links"
                                    items={col.links || []}
                                    onChange={v => updateCol({ ...col, links: v })}
                                    makeNew={() => ({ id: mintId('fl'), label: 'New link', link: { kind: 'external', url: '#' } })}
                                    itemLabel={(l) => l.label || '(no label)'}
                                    collapsible
                                    renderItem={(l, updL) => (
                                        <>
                                            <TextField
                                                label="Label"
                                                value={l.label || ''}
                                                onChange={v => updL({ ...l, label: v })}
                                            />
                                            <LinkField
                                                label="Link"
                                                value={l.link}
                                                pages={pages}
                                                onChange={v => updL({ ...l, link: v })}
                                            />
                                        </>
                                    )}
                                    addLabel="Add link"
                                />
                            </>
                        )}
                        addLabel="Add column"
                    />
                </CollapsibleCard>

                {/* ── Accountability (trust surface) ────────────── */}
                <CollapsibleCard title="Accountability" persistKey="blk.footer.accountability">
                    <InlineHint>Address, registration and legal links make the footer a trust surface — important for GDPR-minded buyers. The row hides itself while everything is empty.</InlineHint>
                    <TextField
                        label="Address"
                        value={data.accountability?.address || ''}
                        onChange={v => onChange(set(data, 'accountability', { ...(data.accountability || {}), address: v }))}
                        placeholder="Street 1, 1234 AB City, Netherlands"
                    />
                    <TextField
                        label="Registration"
                        value={data.accountability?.registration || ''}
                        onChange={v => onChange(set(data, 'accountability', { ...(data.accountability || {}), registration: v }))}
                        placeholder="KvK 12345678"
                    />
                    <TextField
                        label="VAT"
                        value={data.accountability?.vat || ''}
                        onChange={v => onChange(set(data, 'accountability', { ...(data.accountability || {}), vat: v }))}
                        placeholder="NL123456789B01"
                    />
                    <RepeatableList
                        label="Legal links"
                        items={data.accountability?.links || []}
                        onChange={v => onChange(set(data, 'accountability', { ...(data.accountability || {}), links: v }))}
                        makeNew={() => ({ label: 'DPA', href: '' })}
                        itemLabel={(l) => l.label || '(no label)'}
                        renderItem={(l, updL) => (
                            <>
                                <TextField label="Label" value={l.label || ''} onChange={v => updL({ ...l, label: v })} placeholder="DPA / Impressum / Security" />
                                <TextField label="URL" value={l.href || ''} onChange={v => updL({ ...l, href: v })} placeholder="https://…" />
                            </>
                        )}
                        addLabel="Add link"
                    />
                </CollapsibleCard>

                {/* ── Social links ──────────────────────────────── */}
                <CollapsibleCard title="Social links" persistKey="blk.footer.socials">
                    <RepeatableList
                        items={data.socials || []}
                        onChange={v => onChange(set(data, 'socials', v))}
                        makeNew={() => ({ id: mintId('soc'), platform: 'github', link: { kind: 'external', url: '' } })}
                        itemLabel={(s) => s.platform || '(no platform)'}
                        collapsible
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
                </CollapsibleCard>
            </CollapsibleCard>
        </>
    );
}
