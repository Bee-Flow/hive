import React from 'react';
import { TextField } from '../fields';
import { InlineHint, FieldSelect } from '../primitives';
import { set, SectionHeaderFields } from './shared';

// ── Release notes ─────────────────────────────────────────────────────
//
// The block stores no entries. Published releases are fetched client-side
// from /api/release-notes/public at view time, so this editor only controls
// presentation. Entries themselves are written by the build pipeline and
// approved in Admin → Release notes — nothing reaches the public site until
// someone publishes it there.
//
// `variant` is structural and stays on the translation denylist, so a locale
// override can never flip the layout. `kindLabels` IS prose and translates.

export function ReleaseNotesEditor({ data = {}, onChange }) {
    const kindLabels = data.kindLabels || {};
    const setKind = (key, v) => onChange(set(data, 'kindLabels', { ...kindLabels, [key]: v }));

    return (
        <>
            <InlineHint>
                Entries come from the build pipeline and appear here once published in
                Admin → Release notes. This panel controls how they look.
            </InlineHint>

            <FieldSelect
                label="Layout"
                value={data.variant || 'compact'}
                onChange={v => onChange(set(data, 'variant', v))}
                options={[
                    { value: 'compact', label: 'Compact — latest release only' },
                    { value: 'full', label: 'Full — the changelog archive' },
                ]}
            />

            <SectionHeaderFields data={data} onChange={onChange} persistScope="release-notes" />

            <TextField
                label="How many releases to show"
                value={String(data.limit ?? '')}
                onChange={v => onChange(set(data, 'limit', v === '' ? '' : Number(v)))}
                placeholder="1"
            />

            <TextField
                label="Heading — new features"
                value={kindLabels.feature || ''}
                onChange={v => setKind('feature', v)}
                placeholder="New"
            />
            <TextField
                label="Heading — improvements"
                value={kindLabels.improvement || ''}
                onChange={v => setKind('improvement', v)}
                placeholder="Improved"
            />
            <TextField
                label="Heading — fixes"
                value={kindLabels.fix || ''}
                onChange={v => setKind('fix', v)}
                placeholder="Fixed"
            />

            <TextField
                label="Text when nothing is published yet"
                value={data.emptyText || ''}
                onChange={v => onChange(set(data, 'emptyText', v))}
                placeholder="Leave empty to hide the block entirely"
            />

            <TextField
                label="Link label"
                value={data.linkLabel || ''}
                onChange={v => onChange(set(data, 'linkLabel', v))}
                placeholder="See all releases"
            />
            <TextField
                label="Link URL"
                value={data.linkUrl || ''}
                onChange={v => onChange(set(data, 'linkUrl', v))}
                placeholder="/changelog"
            />
        </>
    );
}
