import React from 'react';
import { TextField, Toggle, ImageField, LinkField } from '../fields';
import {
    InlineHint,
    CollapsibleCard,
    StyleTriplet,
    FieldSelect,
    CtaStyleSelect,
    BackgroundCard,
} from '../primitives';
import { set } from './shared';

// ── Media + Text ─────────────────────────────────────────────────────

export function MediaTextEditor({ data = {}, pages = [], onChange }) {
    const setField = (key, value) => onChange(set(data, key, value));
    const media    = data.media || { kind: 'image', src: '', alt: '' };
    const cta      = data.cta || {};

    // Per-field style blobs — same `*Style.{fontFamily,fontSize,color}`
    // shape Hero uses (badgeStyle/titleStyle/leadStyle). Keeping the
    // storage shape stable means existing pages don't need migration and
    // the renderer's inlineTextStyle() reads keep working unchanged.
    const headingStyle    = data.headingStyle    || {};
    const subheadingStyle = data.subheadingStyle || {};
    const bodyStyle       = data.bodyStyle       || {};
    const ctaStyle        = data.ctaStyle        || {};

    const showSubheading = data.subheading !== null && data.subheading !== undefined;
    const showCta        = !!data.cta;

    const toggleSubheading = (next) => setField('subheading', next ? '' : null);
    const toggleCta        = (next) => setField('cta',
        next ? { label: 'Learn more', link: { kind: 'anchor', anchor: '' } } : null);

    const updateMedia = (key, value) => setField('media', { ...media, [key]: value });
    const updateCta   = (key, value) => setField('cta',   { ...cta, [key]: value });

    return (
        <>
            <InlineHint>Click the heading, subheading, body, and CTA label in the preview to edit them inline. Use the panels below for structure and styling.</InlineHint>

            {/* ── Heading ─────────────────────────────────────────── */}
            <CollapsibleCard title="Heading" defaultOpen={true} persistKey="blk.media-text.heading">
                <TextField
                    label="Text"
                    value={data.heading || ''}
                    onChange={v => setField('heading', v)}
                    placeholder="Heading"
                    align={data.headingAlign || data.align || 'left'}
                    onAlignChange={v => setField('headingAlign', v)}
                />
                <StyleTriplet
                    label="Heading"
                    value={headingStyle}
                    onChange={v => setField('headingStyle', v)}
                    sample={data.heading || 'Heading preview'}
                    weight={700}
                    min={12} max={96}
                />
            </CollapsibleCard>

            {/* ── Subheading ──────────────────────────────────────── */}
            <CollapsibleCard title="Subheading" defaultOpen={false} persistKey="blk.media-text.subheading">
                <Toggle
                    label="Show subheading"
                    value={showSubheading}
                    onChange={toggleSubheading}
                />
                {showSubheading ? (
                    <>
                        <TextField
                            label="Text"
                            value={data.subheading || ''}
                            onChange={v => setField('subheading', v)}
                            placeholder="Subheading"
                            align={data.subheadingAlign || data.align || 'left'}
                            onAlignChange={v => setField('subheadingAlign', v)}
                        />
                        <StyleTriplet
                            label="Subheading"
                            value={subheadingStyle}
                            onChange={v => setField('subheadingStyle', v)}
                            sample={data.subheading || 'Subheading preview'}
                            weight={500}
                            min={10} max={48}
                        />
                    </>
                ) : null}
            </CollapsibleCard>

            {/* ── Body ────────────────────────────────────────────── */}
            <CollapsibleCard title="Body" defaultOpen={false} persistKey="blk.media-text.body">
                <TextField
                    label="Text"
                    value={data.body || ''}
                    onChange={v => setField('body', v)}
                    placeholder="Body text"
                    align={data.bodyAlign || data.align || 'left'}
                    onAlignChange={v => setField('bodyAlign', v)}
                />
                <StyleTriplet
                    label="Body"
                    value={bodyStyle}
                    onChange={v => setField('bodyStyle', v)}
                    sample={data.body || 'The quick brown fox jumps over the lazy dog.'}
                    weight={400}
                    min={10} max={32}
                />
            </CollapsibleCard>

            {/* ── CTA ─────────────────────────────────────────────── */}
            <CollapsibleCard title="CTA" defaultOpen={false} persistKey="blk.media-text.cta">
                <Toggle
                    label="Show CTA"
                    value={showCta}
                    onChange={toggleCta}
                />
                {showCta ? (
                    <>
                        <TextField
                            label="Label"
                            value={cta.label || ''}
                            onChange={v => updateCta('label', v)}
                            placeholder="Learn more"
                        />
                        <LinkField
                            label="Destination"
                            value={cta.link}
                            pages={pages}
                            onChange={v => updateCta('link', v)}
                        />
                        <CtaStyleSelect
                            value={cta.style || 'primary'}
                            onChange={v => updateCta('style', v)}
                        />
                        <StyleTriplet
                            label="CTA"
                            value={ctaStyle}
                            onChange={v => setField('ctaStyle', v)}
                            sample={cta.label || 'Button label'}
                            weight={600}
                            min={10} max={32}
                        />
                    </>
                ) : null}
            </CollapsibleCard>

            {/* ── Media ───────────────────────────────────────────── */}
            <CollapsibleCard title="Media" defaultOpen={false} persistKey="blk.media-text.media">
                <FieldSelect
                    label="Media type"
                    value={media.kind || 'image'}
                    options={[
                        { value: 'image',        label: 'Image' },
                        { value: 'gif',          label: 'GIF / Animation' },
                        { value: 'video',        label: 'Video (embed URL)' },
                        { value: 'video-silent', label: 'Video loop (no audio)' },
                    ]}
                    onChange={v => updateMedia('kind', v)}
                />
                {media.kind === 'gif' ? (
                    <>
                        <ImageField
                            label="GIF / animation"
                            value={media.src || ''}
                            onChange={v => updateMedia('src', v)}
                            accept="image/gif,image/webp,image/apng,image/png,image/jpeg"
                            uploadLabel="Upload GIF"
                            placeholder="https://… or /api/cms/asset/cms/…"
                        />
                        <TextField
                            label="Alt text"
                            value={media.alt || ''}
                            onChange={v => updateMedia('alt', v)}
                            placeholder="Describe the animation"
                        />
                    </>
                ) : media.kind === 'video-silent' ? (
                    <>
                        <ImageField
                            label="Video"
                            value={media.src || ''}
                            onChange={v => updateMedia('src', v)}
                            accept="video/mp4,video/webm"
                            previewKind="video"
                            uploadLabel="Upload video"
                            placeholder="https://… or /api/cms/asset/cms/…"
                        />
                        <TextField
                            label="Alt text"
                            value={media.alt || ''}
                            onChange={v => updateMedia('alt', v)}
                            placeholder="Describe the video"
                        />
                    </>
                ) : media.kind === 'video' ? (
                    <TextField
                        label="Video embed URL"
                        value={media.src || ''}
                        onChange={v => updateMedia('src', v)}
                        placeholder="https://www.youtube.com/embed/… or https://player.vimeo.com/video/…"
                        hint="Use the embed URL, not the public watch URL."
                    />
                ) : (
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
                )}
                {/* Frame + dark-theme pair — image-ish kinds only (the
                    renderer routes framed images through FramedMedia;
                    video/embed rendering is unchanged). Empty frame =
                    legacy bare <img>, so old pages are untouched. */}
                {(!media.kind || media.kind === 'image' || media.kind === 'gif') ? (
                    <>
                        <FieldSelect
                            label="Frame"
                            value={media.frame || ''}
                            options={[
                                { value: '',         label: 'None (bare image)' },
                                { value: 'hairline', label: 'Hairline frame' },
                                { value: 'browser',  label: 'Browser window' },
                            ]}
                            onChange={v => updateMedia('frame', v)}
                        />
                        {media.frame === 'hairline' || media.frame === 'browser' ? (
                            <ImageField
                                label="Dark-theme image (optional)"
                                value={media.srcDark || ''}
                                onChange={v => updateMedia('srcDark', v)}
                            />
                        ) : null}
                    </>
                ) : null}
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
            </CollapsibleCard>

            <BackgroundCard data={data} onChange={onChange} persistKey="blk.media-text.background" />
        </>
    );
}
