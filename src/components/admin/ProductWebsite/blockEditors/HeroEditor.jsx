import React from 'react';
import { TextField, Toggle, IconField, ImageField, RepeatableList, LinkField, FieldRow, AlignControl, inputCls } from '../fields';
import {
    InlineHint,
    CollapsibleCard,
    StyleTriplet,
    FieldSelect,
    CtaStyleSelect,
    BackgroundCard,
} from '../primitives';
import VariantPicker from './VariantPicker';
import { set } from './shared';

// ── Hero ──────────────────────────────────────────────────────────────

export function HeroEditor({ data = {}, pages = [], onChange }) {
    const badge       = data.badge       || {};
    const badgeStyle  = data.badgeStyle  || {};
    const titleStyle  = data.titleStyle  || {};
    const leadStyle   = data.leadStyle   || {};
    const primary     = data.primaryCta  || {};
    const secondary   = data.secondaryCta|| {};
    const mockup      = data.mockup      || {};
    const media       = data.media       || {};

    // Helpers — each one lets a card's contents read/write a sub-object
    // without re-implementing the spread on every onChange.
    const setBadge        = (patch) => onChange(set(data, 'badge',        { ...badge,       ...patch }));
    const setPrimary      = (patch) => onChange(set(data, 'primaryCta',   { ...primary,     ...patch }));
    const setSecondary    = (patch) => onChange(set(data, 'secondaryCta', { ...secondary,   ...patch }));
    const setMockup       = (patch) => onChange(set(data, 'mockup',       { ...mockup,      ...patch }));
    const setMedia        = (patch) => onChange(set(data, 'media',        { ...media,       ...patch }));

    const hasMedia = typeof media.src === 'string' && media.src.trim() !== '';

    // `enabled` defaults to true for old blocks that never stored the
    // field, so the toggles all start in the "on" position.
    const badgeOn     = badge.enabled     !== false;
    const leadOn      = data.leadEnabled  !== false;
    const primaryOn   = primary.enabled   !== false;
    const secondaryOn = secondary.enabled !== false;
    const mockupOn    = mockup.enabled    !== false;

    return (
        <>
            <VariantPicker
                type="hero"
                value={data.variant}
                onChange={v => onChange(set(data, 'variant', v))}
            />
            <InlineHint>Click the badge, title segments, lead, CTA labels, and chat bubbles in the preview to edit them inline. Use the panels below for structure and styling.</InlineHint>

            {/* ── Product media ───────────────────────────────────── */}
            <CollapsibleCard title="Product media" defaultOpen={true} persistKey="blk.hero.media">
                <InlineHint>A real product screenshot in a framed panel is the single biggest visual upgrade. When empty, the chat mockup (below) or a skeleton panel renders instead.</InlineHint>
                <FieldRow label="Image" hint="2x screenshot recommended; shown framed with a hairline border and glow.">
                    <ImageField value={media.src || ''} onChange={v => setMedia({ src: v })} />
                </FieldRow>
                <FieldRow label="Dark-theme image" hint="Optional. Shown instead of the image above while the site is in dark mode.">
                    <ImageField value={media.srcDark || ''} onChange={v => setMedia({ srcDark: v })} />
                </FieldRow>
                <TextField
                    label="Alt text"
                    value={media.alt || ''}
                    onChange={v => setMedia({ alt: v })}
                    placeholder="Describe the screenshot"
                />
                <FieldSelect
                    label="Frame"
                    value={media.frame || 'browser'}
                    options={[
                        { value: 'browser', label: 'Browser window' },
                        { value: 'hairline', label: 'Hairline only' },
                        { value: 'none', label: 'No frame' },
                    ]}
                    onChange={v => setMedia({ frame: v })}
                />
            </CollapsibleCard>

            {/* ── Badge ───────────────────────────────────────────── */}
            <CollapsibleCard title="Badge" defaultOpen={true} persistKey="blk.hero.badge">
                <Toggle
                    label="Show badge"
                    value={badgeOn}
                    onChange={v => setBadge({ enabled: v })}
                />
                {badgeOn ? (
                    <>
                        <TextField
                            label="Text"
                            value={badge.text || ''}
                            onChange={v => setBadge({ text: v })}
                            placeholder="e.g. New · v2.0"
                            align={data.badgeAlign || data.align || 'left'}
                            onAlignChange={v => onChange(set(data, 'badgeAlign', v))}
                        />
                        <IconField
                            label="Icon"
                            value={badge.icon}
                            onChange={v => setBadge({ icon: v })}
                        />
                        <StyleTriplet
                            label="Badge"
                            value={badgeStyle}
                            onChange={v => onChange(set(data, 'badgeStyle', v))}
                            sample="New · just shipped"
                            weight={500}
                            min={8} max={48}
                        />
                    </>
                ) : null}
            </CollapsibleCard>

            {/* ── Headline ────────────────────────────────────────── */}
            <CollapsibleCard title="Headline" persistKey="blk.hero.headline">
                <RepeatableList
                    label="Title segments"
                    items={data.titleParts || []}
                    onChange={v => onChange(set(data, 'titleParts', v))}
                    makeNew={() => ({ text: '', gradient: false })}
                    itemLabel={(it) => it.text || '(empty segment)'}
                    collapsible
                    renderItem={(item, update) => (
                        <>
                            <TextField
                                label="Text"
                                value={item.text || ''}
                                onChange={v => update({ ...item, text: v })}
                                placeholder="Segment text"
                            />
                            <Toggle
                                label="Gradient fill"
                                value={!!item.gradient}
                                onChange={v => update({ ...item, gradient: v })}
                            />
                        </>
                    )}
                    addLabel="Add segment"
                />
                <FieldRow label="Alignment">
                    <AlignControl
                        value={data.titleAlign || data.align || 'left'}
                        onChange={v => onChange(set(data, 'titleAlign', v))}
                    />
                </FieldRow>
                <StyleTriplet
                    label="Title"
                    value={titleStyle}
                    onChange={v => onChange(set(data, 'titleStyle', v))}
                    sample="The quick brown fox jumps"
                    weight={800}
                    min={16} max={160}
                />
            </CollapsibleCard>

            {/* ── Lead ────────────────────────────────────────────── */}
            <CollapsibleCard title="Lead paragraph" persistKey="blk.hero.lead">
                <Toggle
                    label="Show lead"
                    value={leadOn}
                    onChange={v => onChange(set(data, 'leadEnabled', v))}
                />
                {leadOn ? (
                    <>
                        <TextField
                            label="Text"
                            value={data.lead || ''}
                            onChange={v => onChange(set(data, 'lead', v))}
                            placeholder="Short paragraph below the headline."
                            align={data.leadAlign || data.align || 'left'}
                            onAlignChange={v => onChange(set(data, 'leadAlign', v))}
                        />
                        <StyleTriplet
                            label="Lead"
                            value={leadStyle}
                            onChange={v => onChange(set(data, 'leadStyle', v))}
                            sample="The quick brown fox jumps over the lazy dog."
                            weight={400}
                            min={12} max={48}
                        />
                    </>
                ) : null}
            </CollapsibleCard>

            {/* ── Primary CTA ─────────────────────────────────────── */}
            <CollapsibleCard title="Primary CTA" persistKey="blk.hero.primary-cta">
                <Toggle
                    label="Show primary CTA"
                    value={primaryOn}
                    onChange={v => setPrimary({ enabled: v })}
                />
                {primaryOn ? (
                    <>
                        <TextField
                            label="Label"
                            value={primary.label || ''}
                            onChange={v => setPrimary({ label: v })}
                            placeholder="Get started"
                        />
                        <LinkField
                            label="Destination"
                            value={primary.link}
                            pages={pages}
                            onChange={v => setPrimary({ link: v })}
                        />
                        <CtaStyleSelect
                            value={primary.style || 'primary'}
                            onChange={v => setPrimary({ style: v })}
                        />
                    </>
                ) : null}
            </CollapsibleCard>

            {/* ── Secondary CTA ───────────────────────────────────── */}
            <CollapsibleCard title="Secondary CTA" persistKey="blk.hero.secondary-cta">
                <Toggle
                    label="Show secondary CTA"
                    value={secondaryOn}
                    onChange={v => setSecondary({ enabled: v })}
                />
                {secondaryOn ? (
                    <>
                        <TextField
                            label="Label"
                            value={secondary.label || ''}
                            onChange={v => setSecondary({ label: v })}
                            placeholder="Learn more"
                        />
                        <LinkField
                            label="Destination"
                            value={secondary.link}
                            pages={pages}
                            onChange={v => setSecondary({ link: v })}
                        />
                        <CtaStyleSelect
                            value={secondary.style || 'secondary'}
                            onChange={v => setSecondary({ style: v })}
                        />
                    </>
                ) : null}
            </CollapsibleCard>

            {/* ── Mockup ──────────────────────────────────────────── */}
            <CollapsibleCard title="Chat mockup (fallback)" persistKey="blk.hero.mockup">
                {hasMedia ? (
                    <InlineHint>A product image is set above, so the chat mockup is not shown. Clear the image to bring it back.</InlineHint>
                ) : null}
                <Toggle
                    label="Show mockup"
                    value={mockupOn}
                    onChange={v => setMockup({ enabled: v })}
                />
                {mockupOn ? (
                    <RepeatableList
                        label="Chat bubbles"
                        items={mockup.chatBubbles || []}
                        onChange={v => setMockup({ chatBubbles: v })}
                        makeNew={() => ({ role: 'user', text: '' })}
                        itemLabel={(b) => b.text || '(empty)'}
                        collapsible
                        renderItem={(item, update) => (
                            <>
                                <FieldSelect
                                    label="Speaker"
                                    value={item.role}
                                    options={[{ value: 'user', label: 'User' }, { value: 'ai', label: 'AI' }]}
                                    onChange={v => update({ ...item, role: v })}
                                />
                                <FieldRow label="Text">
                                    <textarea
                                        rows={2}
                                        className={inputCls + ' resize-y'}
                                        value={item.text || ''}
                                        onChange={e => update({ ...item, text: e.target.value })}
                                        placeholder="Bubble text"
                                    />
                                </FieldRow>
                            </>
                        )}
                        addLabel="Add bubble"
                    />
                ) : null}
            </CollapsibleCard>

            {/* ── Background ──────────────────────────────────────── */}
            <BackgroundCard data={data} onChange={onChange} persistKey="blk.hero.background" />
        </>
    );
}
