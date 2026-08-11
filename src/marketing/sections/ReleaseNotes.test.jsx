/**
 * ReleaseNotes section — rendering and the fail-soft contract.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ReleaseNotes, { groupByKind, formatReleaseDate } from './ReleaseNotes';

const ENTRY = {
    id: 'e1',
    version: 'prod-2026.08.11-1',
    title: 'Faster chat',
    lead: 'A quicker, steadier chat.',
    publishedAt: '2026-08-11T10:00:00.000Z',
    items: [
        { kind: 'feature', title: 'Projects', body: 'Share a conversation with your team.' },
        { kind: 'fix', title: 'Attachments', body: 'Screenshots survive a long conversation.' },
    ],
};

function mockFetch(payload, { ok = true } = {}) {
    global.fetch = vi.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(payload) }));
}

beforeEach(() => { mockFetch({ entries: [] }); });
afterEach(() => { vi.restoreAllMocks(); });

// ── groupByKind ────────────────────────────────────────────────────────

describe('groupByKind', () => {
    it('orders buckets feature → improvement → fix', () => {
        const groups = groupByKind([
            { kind: 'fix', title: 'a' },
            { kind: 'feature', title: 'b' },
            { kind: 'improvement', title: 'c' },
        ]);
        expect(groups.map(g => g.kind)).toEqual(['feature', 'improvement', 'fix']);
    });

    it('omits empty buckets rather than rendering bare headings', () => {
        expect(groupByKind([{ kind: 'fix', title: 'a' }]).map(g => g.kind)).toEqual(['fix']);
    });

    it('AN UNKNOWN KIND IS KEPT, NOT DROPPED', () => {
        // Roadmap.jsx documents the same rule for an unrecognised status:
        // losing a real change is worse than a slightly wrong heading.
        const groups = groupByKind([{ kind: 'wat', title: 'a' }]);
        expect(groups).toHaveLength(1);
        expect(groups[0].items[0].title).toBe('a');
    });

    it('survives a non-array and junk members', () => {
        expect(groupByKind(null)).toEqual([]);
        expect(groupByKind([null, 5, 'x'])).toEqual([]);
    });

    it('does not mutate or reorder the caller\'s array', () => {
        // Locale overrides address items by numeric index — persisting a sort
        // would drag every translation onto a different item.
        const items = [{ kind: 'fix', title: 'a' }, { kind: 'feature', title: 'b' }];
        const snapshot = JSON.parse(JSON.stringify(items));
        groupByKind(items);
        expect(items).toEqual(snapshot);
    });
});

describe('formatReleaseDate', () => {
    it('returns null for missing or unparseable input rather than "Invalid Date"', () => {
        expect(formatReleaseDate(null)).toBeNull();
        expect(formatReleaseDate('nonsense')).toBeNull();
    });
    it('formats a real ISO date', () => {
        expect(formatReleaseDate('2026-08-11T10:00:00.000Z')).toBeTruthy();
    });
});

// ── Rendering ──────────────────────────────────────────────────────────

describe('ReleaseNotes', () => {
    it('renders a published entry with its version, headline and items', async () => {
        mockFetch({ entries: [ENTRY] });
        render(<ReleaseNotes data={{ enabled: true, title: 'What\'s new' }} />);
        await waitFor(() => expect(screen.getByText('Faster chat')).toBeInTheDocument());
        expect(screen.getByText('prod-2026.08.11-1')).toBeInTheDocument();
        expect(screen.getByText('Projects')).toBeInTheDocument();
        expect(screen.getByText(/Screenshots survive/)).toBeInTheDocument();
    });

    it('groups items under their kind headings', async () => {
        mockFetch({ entries: [ENTRY] });
        render(<ReleaseNotes data={{ enabled: true, kindLabels: { feature: 'Nieuw', fix: 'Opgelost' } }} />);
        await waitFor(() => expect(screen.getByText('Nieuw')).toBeInTheDocument());
        expect(screen.getByText('Opgelost')).toBeInTheDocument();
    });

    it('renders nothing when disabled', () => {
        const { container } = render(<ReleaseNotes data={{ enabled: false }} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('FAIL-SOFT: renders nothing on the live site when nothing is published', async () => {
        mockFetch({ entries: [] });
        const { container } = render(<ReleaseNotes data={{ enabled: true, title: 'What\'s new' }} />);
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it('FAIL-SOFT: a failed fetch renders nothing rather than an error', async () => {
        mockFetch(null, { ok: false });
        const { container } = render(<ReleaseNotes data={{ enabled: true }} />);
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it('a rejected fetch does not throw', async () => {
        global.fetch = vi.fn(() => Promise.reject(new Error('offline')));
        const { container } = render(<ReleaseNotes data={{ enabled: true }} />);
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it('honours the limit — compact shows one release, not the archive', async () => {
        const second = { ...ENTRY, id: 'e2', version: 'prod-2026.08.01-1', title: 'Older release' };
        mockFetch({ entries: [ENTRY, second] });
        render(<ReleaseNotes data={{ enabled: true, variant: 'compact', limit: 1 }} />);
        await waitFor(() => expect(screen.getByText('Faster chat')).toBeInTheDocument());
        expect(screen.queryByText('Older release')).not.toBeInTheDocument();
    });

    it('full variant shows more than one release', async () => {
        const second = { ...ENTRY, id: 'e2', version: 'prod-2026.08.01-1', title: 'Older release' };
        mockFetch({ entries: [ENTRY, second] });
        render(<ReleaseNotes data={{ enabled: true, variant: 'full' }} />);
        await waitFor(() => expect(screen.getByText('Faster chat')).toBeInTheDocument());
        expect(screen.getByText('Older release')).toBeInTheDocument();
    });

    it('reads from the public endpoint, which serves published entries only', async () => {
        mockFetch({ entries: [] });
        render(<ReleaseNotes data={{ enabled: true }} />);
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        expect(global.fetch.mock.calls[0][0]).toBe('/api/release-notes/public');
    });
});
