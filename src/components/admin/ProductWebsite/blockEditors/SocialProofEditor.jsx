import React from 'react';
import { TextField, ImageField, RepeatableList } from '../fields';
import { InlineHint, CollapsibleCard } from '../primitives';
import VariantPicker from './VariantPicker';
import { set, SectionHeaderFields, LogoTintControl } from './shared';

// ── Social Proof ──────────────────────────────────────────────────────

export function SocialProofEditor({ data = {}, onChange }) {
    const variant = data.variant === 'numbers' ? 'numbers' : 'classic';
    // Eyebrow + Title (style controls + text fields) come from the
    // shared header helper. Social Proof has no `lead`, so showLead
    // is disabled — the helper skips that subsection entirely.
    return (
        <>
            <VariantPicker
                type="socialProof"
                value={data.variant}
                onChange={v => onChange(set(data, 'variant', v))}
            />
            <InlineHint>Click the eyebrow and title text in the preview to edit them inline. Style each independently below.</InlineHint>

            <SectionHeaderFields data={data} onChange={onChange} showLead={false} persistScope="socialProof" />

            {/* ── Hard numbers (variant 'numbers') ─────────────── */}
            {variant === 'numbers' ? (
                <CollapsibleCard title={`Numbers (${(data.stats || []).length})`} defaultOpen persistKey="blk.socialProof.stats">
                    <InlineHint>Quantified proof beats adjectives: stars, users, uptime — with the source as the label (e.g. “4.7★ / G2 rating”).</InlineHint>
                    <RepeatableList
                        label="Numbers"
                        items={data.stats || []}
                        onChange={v => onChange(set(data, 'stats', v))}
                        makeNew={() => ({ number: '', label: '' })}
                        itemLabel={(item) => item.number || item.label || '(empty)'}
                        renderItem={(item, update) => (
                            <>
                                <TextField label="Number" value={item.number || ''} onChange={v => update({ ...item, number: v })} placeholder="12,000+" />
                                <TextField label="Label" value={item.label || ''} onChange={v => update({ ...item, label: v })} placeholder="Teams on Bee Flow" />
                            </>
                        )}
                        addLabel="Add number"
                    />
                </CollapsibleCard>
            ) : null}

            {/* ── Logos ───────────────────────────────────────── */}
            <CollapsibleCard title={`Logos (${(data.logos || []).length})`} persistKey="blk.socialProof.logos">
                <RepeatableList
                    label="Logos"
                    items={data.logos || []}
                    onChange={v => onChange(set(data, 'logos', v))}
                    makeNew={() => ({ src: '', alt: 'New logo' })}
                    itemLabel={(item) => item.alt}
                    renderItem={(item, update) => (
                        <>
                            <ImageField label="Logo image (optional)" value={item.src} onChange={v => update({ ...item, src: v })} />
                            <TextField label="Alt text" value={item.alt || ''} onChange={v => update({ ...item, alt: v })} placeholder="Used as the logo's accessible name" />
                        </>
                    )}
                    addLabel="Add logo"
                />
                <LogoTintControl
                    value={Number.isFinite(data.logoTint) ? data.logoTint : 0}
                    onChange={v => onChange(set(data, 'logoTint', v))}
                />
            </CollapsibleCard>
        </>
    );
}
