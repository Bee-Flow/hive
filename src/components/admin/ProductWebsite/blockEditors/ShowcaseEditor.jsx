import React from 'react';
import { TextField, ImageField } from '../fields';
import { InlineHint, CollapsibleCard, FieldSelect, MonoTextarea, BackgroundCard } from '../primitives';
import VariantPicker from './VariantPicker';
import { set, SectionHeaderFields } from './shared';

// One FramedMedia slot editor — shared media shape
// { src, srcDark, alt, frame, kind }. Used for `media` and (in the pair
// layout) `mediaSecondary`.
function MediaSlotFields({ media = {}, onChange }) {
    const update = (key, value) => onChange({ ...media, [key]: value });
    const isVideo = media.kind === 'video';
    return (
        <>
            <FieldSelect
                label="Media type"
                value={isVideo ? 'video' : 'image'}
                options={[
                    { value: 'image', label: 'Image' },
                    { value: 'video', label: 'Video loop (no audio)' },
                ]}
                onChange={v => update('kind', v)}
            />
            {isVideo ? (
                <ImageField
                    label="Video"
                    value={media.src || ''}
                    onChange={v => update('src', v)}
                    accept="video/mp4,video/webm"
                    previewKind="video"
                    uploadLabel="Upload video"
                    placeholder="https://… or /api/cms/asset/cms/…"
                />
            ) : (
                <>
                    <ImageField
                        label="Image"
                        value={media.src || ''}
                        onChange={v => update('src', v)}
                    />
                    <ImageField
                        label="Dark-theme image (optional)"
                        value={media.srcDark || ''}
                        onChange={v => update('srcDark', v)}
                    />
                    <TextField
                        label="Alt text"
                        value={media.alt || ''}
                        onChange={v => update('alt', v)}
                        placeholder="Describe the screenshot"
                    />
                </>
            )}
            <FieldSelect
                label="Frame"
                value={['hairline', 'browser', 'none'].includes(media.frame) ? media.frame : 'browser'}
                options={[
                    { value: 'browser',  label: 'Browser window' },
                    { value: 'hairline', label: 'Hairline frame' },
                    { value: 'none',     label: 'None' },
                ]}
                onChange={v => update('frame', v)}
            />
        </>
    );
}

// ── Showcase ──────────────────────────────────────────────────────────
//
// Staged product proof. 'single' = one full-container framed shot with
// glow + fade-mask; 'pair' = two frames side by side; 'code-ui' = mono
// code panel + frame (5/7, deliberately no syntax highlighting).

export function ShowcaseEditor({ data = {}, onChange }) {
    const variant = ['pair', 'code-ui'].includes(data.variant) ? data.variant : 'single';
    const code = data.code || {};
    const updateCode = (key, value) => onChange(set(data, 'code', { ...code, [key]: value }));
    return (
        <>
            <VariantPicker
                type="showcase"
                value={data.variant}
                onChange={v => onChange(set(data, 'variant', v))}
            />
            <InlineHint>
                A real product screenshot is the whole point of this block — a light/dark
                pair keeps it sharp in both themes.
                {variant === 'code-ui' ? ' The code snippet is never auto-translated.' : ''}
            </InlineHint>
            <SectionHeaderFields data={data} onChange={onChange} persistScope="showcase" />
            <CollapsibleCard title={variant === 'pair' ? 'Media (left)' : 'Media'} defaultOpen={true} persistKey="blk.showcase.media">
                <MediaSlotFields
                    media={data.media}
                    onChange={v => onChange(set(data, 'media', v))}
                />
            </CollapsibleCard>
            {variant === 'pair' ? (
                <CollapsibleCard title="Media (right)" defaultOpen={true} persistKey="blk.showcase.media2">
                    <MediaSlotFields
                        media={data.mediaSecondary}
                        onChange={v => onChange(set(data, 'mediaSecondary', v))}
                    />
                </CollapsibleCard>
            ) : null}
            {variant === 'code-ui' ? (
                <CollapsibleCard title="Code panel" defaultOpen={true} persistKey="blk.showcase.code">
                    <TextField
                        label="Language label"
                        value={code.language || ''}
                        onChange={v => updateCode('language', v)}
                        placeholder="bash"
                    />
                    <MonoTextarea
                        rows={5}
                        value={code.snippet || ''}
                        onChange={v => updateCode('snippet', v)}
                        placeholder="docker compose up -d"
                        ariaLabel="Code snippet"
                    />
                </CollapsibleCard>
            ) : null}
            <BackgroundCard data={data} onChange={onChange} persistKey="blk.showcase.background" />
        </>
    );
}
