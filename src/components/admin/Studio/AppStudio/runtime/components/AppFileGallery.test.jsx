import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppFileGallery, { formatBytes, iconForMime } from './AppFileGallery';
import { RuntimeProvider, buildScope, DEFAULT_RUNTIME } from '../RuntimeContext';

/**
 * 'file_gallery' — attachments as cards.
 *
 * The load-bearing assertion is a NEGATIVE one: rendering the gallery must not
 * touch the network. A mailbox attachment is a pending descriptor, and
 * redeeming one costs a provider round-trip; a grid that redeemed twelve on
 * mount would make every request screen slow and every provider quota shorter.
 */

const ROWS = [
    { id: 'att_1', filename: 'drawing.pdf', mime_type: 'application/pdf', size: 284213, file: { name: 'drawing.pdf', mimeType: 'application/pdf' } },
    { id: 'att_2', filename: 'photo.jpg', mime_type: 'image/jpeg', size: 900, file: { name: 'photo.jpg', mimeType: 'image/jpeg' } },
];

function node(rows = ROWS, extra = {}) {
    return {
        id: 'cmp_fg01', type: 'file_gallery',
        props: {
            source: { kind: 'static', value: rows },
            fileKey: 'file', titleKey: 'filename', subtitleKey: 'mime_type', sizeKey: 'size',
            columns: 3, rowLimit: 24, emptyText: 'No files yet.',
            ...extra,
        },
        style: {},
    };
}

function renderGallery(n, runtime = {}) {
    const value = {
        ...DEFAULT_RUNTIME,
        scope: buildScope({ now: '2020-01-01T00:00:00.000Z' }),
        mode: 'run',
        ...runtime,
    };
    return render(
        <RuntimeProvider value={value}>
            <AppFileGallery node={n} />
        </RuntimeProvider>,
    );
}

describe('AppFileGallery', () => {
    it('renders one card per file with its type and size, and fetches nothing', () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        renderGallery(node());
        expect(screen.getByText('drawing.pdf')).toBeInTheDocument();
        expect(screen.getByText(/application\/pdf · 278 kB/)).toBeInTheDocument();
        expect(screen.getByText('photo.jpg')).toBeInTheDocument();
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });

    it('publishes the whole row on click so a preview can redeem it', () => {
        const runAction = vi.fn();
        renderGallery({ ...node(), onRowClick: 'act_pick01' }, { runAction });
        fireEvent.click(screen.getByText('drawing.pdf').closest('button'));
        expect(runAction).toHaveBeenCalledWith('act_pick01', { formValues: ROWS[0] });
    });

    it('shows the empty state instead of an empty grid', () => {
        renderGallery(node([]));
        expect(screen.getByText('No files yet.')).toBeInTheDocument();
    });
});

describe('file gallery helpers', () => {
    it('formats sizes and drops nonsense ones', () => {
        expect(formatBytes(900)).toBe('900 B');
        expect(formatBytes(284213)).toBe('278 kB');
        expect(formatBytes(0)).toBeNull();
        expect(formatBytes('nope')).toBeNull();
    });

    it('picks an icon per family and falls back rather than throwing', () => {
        expect(iconForMime('image/png')).toBe(iconForMime('image/jpeg'));
        expect(iconForMime('application/pdf')).not.toBe(iconForMime('image/png'));
        expect(iconForMime(null)).toBeTruthy();
    });
});
