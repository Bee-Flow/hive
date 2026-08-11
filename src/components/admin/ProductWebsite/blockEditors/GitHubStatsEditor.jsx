import React from 'react';
import { TextField } from '../fields';
import { InlineHint } from '../primitives';
import { set, SectionHeaderFields } from './shared';

// ── GitHub stats ──────────────────────────────────────────────────────
//
// The block stores no numbers: stars and the latest release are fetched
// client-side from /api/public/github-stats at view time, so the section
// can never advertise a stale count. When that endpoint has nothing, the
// section renders a plain repo link instead of empty digits.

export function GitHubStatsEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Stars and releases are fetched live — nothing here goes stale.</InlineHint>
            <SectionHeaderFields data={data} onChange={onChange} persistScope="github-stats" />
            <TextField
                label="Repository URL"
                value={data.repoUrl || ''}
                onChange={v => onChange(set(data, 'repoUrl', v))}
                placeholder="https://github.com/owner/repo"
            />
            <TextField
                label="Link label"
                value={data.linkLabel || ''}
                onChange={v => onChange(set(data, 'linkLabel', v))}
                placeholder="Source on GitHub"
            />
        </>
    );
}
