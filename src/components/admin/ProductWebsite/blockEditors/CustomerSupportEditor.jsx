import React from 'react';
import { TextField } from '../fields';
import { InlineHint, CollapsibleCard, BackgroundVariantSelect } from '../primitives';
import { set } from './shared';

// ── Customer Support ──────────────────────────────────────────────────
//
// Public AI-first support form. Submits to POST /api/support/threads
// (source: 'marketing'); the AI replies inline and a human takes over on
// escalation.

export function CustomerSupportEditor({ data = {}, onChange }) {
    const setField = (key, value) => onChange(set(data, key, value));
    return (
        <>
            <InlineHint>Click the title and intro in the preview to edit them inline.</InlineHint>

            <BackgroundVariantSelect
                label="Background"
                value={data.backgroundVariant || 'surface'}
                onChange={v => setField('backgroundVariant', v)}
            />

            <CollapsibleCard title="Text" defaultOpen={true} persistKey="blk.customer-support.text">
                <TextField label="Title" value={data.title || ''} onChange={v => setField('title', v)} placeholder="Talk to us" />
                <TextField label="Intro" value={data.lead || ''} onChange={v => setField('lead', v)} placeholder="Short intro under the title" />
            </CollapsibleCard>

            <CollapsibleCard title="Form fields" defaultOpen={false} persistKey="blk.customer-support.form-fields">
                <TextField label="Name label"          value={data.nameLabel || ''}          onChange={v => setField('nameLabel', v)}          placeholder="Your name" />
                <TextField label="Name placeholder"    value={data.namePlaceholder || ''}    onChange={v => setField('namePlaceholder', v)}    placeholder="Jane Doe" />
                <TextField label="Email label"         value={data.emailLabel || ''}         onChange={v => setField('emailLabel', v)}         placeholder="Email" />
                <TextField label="Email placeholder"   value={data.emailPlaceholder || ''}   onChange={v => setField('emailPlaceholder', v)}   placeholder="you@company.com" />
                <TextField label="Subject label"       value={data.subjectLabel || ''}       onChange={v => setField('subjectLabel', v)}       placeholder="Subject" />
                <TextField label="Subject placeholder" value={data.subjectPlaceholder || ''} onChange={v => setField('subjectPlaceholder', v)} placeholder="How can we help?" />
                <TextField label="Message label"       value={data.messageLabel || ''}       onChange={v => setField('messageLabel', v)}       placeholder="Message" />
                <TextField label="Message placeholder" value={data.messagePlaceholder || ''} onChange={v => setField('messagePlaceholder', v)} placeholder="Tell us about your team…" />
                <TextField label="Submit button"       value={data.submitLabel || ''}        onChange={v => setField('submitLabel', v)}        placeholder="Send to Bee Flow" />
            </CollapsibleCard>

            <CollapsibleCard title="Confirmation message" defaultOpen={false} persistKey="blk.customer-support.confirmation">
                <TextField
                    label="Success title"
                    value={data.successTitle || ''}
                    onChange={v => setField('successTitle', v)}
                    placeholder="Thanks — we've got your message"
                />
                <TextField
                    label="Success body"
                    value={data.successBody || ''}
                    onChange={v => setField('successBody', v)}
                    placeholder="What the visitor sees after submitting"
                    hint="Shown while the AI prepares its first reply."
                />
            </CollapsibleCard>
        </>
    );
}
