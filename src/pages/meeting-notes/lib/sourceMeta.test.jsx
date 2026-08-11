import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, it, expect } from 'vitest';

import { getSourceMeta } from './sourceMeta';
import MeetingHeader from '../detail/MeetingHeader';
import LibraryEmptyState from '../library/LibraryEmptyState';
import MeetingCard from '../library/MeetingCard';
import MeetingRow from '../library/MeetingRow';

describe('getSourceMeta', () => {
    it('maps talk and talk-auto to a Talk chip', () => {
        const talk = getSourceMeta('talk');
        expect(talk.label).toBe('Talk');
        expect(talk.color).toBe('#0082C9');
        expect(talk.Icon).toBeTruthy();
        expect(talk.title).toBeUndefined();

        const auto = getSourceMeta('talk-auto');
        expect(auto.label).toBe('Talk');
        expect(auto.color).toBe('#0082C9');
        expect(auto.title).toBe('Imported automatically');
    });

    it('maps gmeet to a Meet chip in Google green', () => {
        const meta = getSourceMeta('gmeet');
        expect(meta.label).toBe('Meet');
        expect(meta.color).toBe('#00832D');
        expect(meta.Icon).toBeTruthy();
    });

    it('maps nextcloud to a Nextcloud chip', () => {
        const meta = getSourceMeta('nextcloud');
        expect(meta.label).toBe('Nextcloud');
        expect(meta.color).toBe('#0082C9');
        expect(meta.Icon).toBeTruthy();
    });

    it('returns null for uploads, live recordings and unknown sources', () => {
        expect(getSourceMeta('upload')).toBeNull();
        expect(getSourceMeta('record')).toBeNull();
        expect(getSourceMeta('whatever')).toBeNull();
        expect(getSourceMeta(undefined)).toBeNull();
        expect(getSourceMeta(null)).toBeNull();
    });
});

const meeting = (source) => ({
    id: 't1', title: 'Weekly sync', createdAt: new Date().toISOString(),
    durationSeconds: 60, speakerCount: 2, source,
});

describe('source badges', () => {
    it('MeetingRow shows a Meet chip for gmeet and none for uploads', () => {
        const { rerender } = render(<MeetingRow meeting={meeting('gmeet')} onClick={() => {}} />);
        expect(screen.getByText('Meet')).toBeTruthy();
        rerender(<MeetingRow meeting={meeting('upload')} onClick={() => {}} />);
        expect(screen.queryByText('Meet')).toBeNull();
    });

    it('MeetingCard shows a Talk chip with the auto-import tooltip for talk-auto', () => {
        render(<MeetingCard meeting={meeting('talk-auto')} onClick={() => {}} />);
        const chip = screen.getByText('Talk');
        expect(chip.closest('[title="Imported automatically"]')).toBeTruthy();
    });

    it('MeetingHeader shows the source chip in its meta line', () => {
        render(<MeetingHeader meeting={meeting('nextcloud')} />);
        expect(screen.getByText('Nextcloud')).toBeTruthy();
    });
});

describe('LibraryEmptyState', () => {
    it('describes the real capture options instead of the removed bot', () => {
        render(<LibraryEmptyState onCapture={() => {}} />);
        expect(screen.getByText(/connect Nextcloud Talk or Google Meet/)).toBeTruthy();
        expect(screen.queryByText(/send a bot/)).toBeNull();
    });
});
