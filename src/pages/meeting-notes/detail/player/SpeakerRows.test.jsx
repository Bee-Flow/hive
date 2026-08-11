import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SpeakerRows from './SpeakerRows';
import { NEUTRAL_SPEAKER_COLOR } from '../../../../config/meetingNotesConfig';
import { buildSpeakerRows, buildSpeakerColorMap } from '../../lib/playerData';

const DURATION = 6000;

/** 8 speakers back-to-back ×3 rounds; S0 talks longest → ranked first. */
function fixture() {
    const segments = [];
    let t = 0;
    for (let round = 0; round < 3; round++) {
        for (let i = 0; i < 8; i++) {
            const len = (8 - i) * 20 + 100;
            segments.push({ speaker: `S${i}`, start: t, end: t + len, text: `tekst van S${i}` });
            t += len + 0.5;
        }
    }
    const speakers = Array.from({ length: 8 }, (_, i) => ({ id: `S${i}`, speakingSeconds: (8 - i) * 60 + 300 }));
    return { segments, speakers };
}

function renderRows({ maxRows = 6, onSeekTo = vi.fn() } = {}) {
    const { segments, speakers } = fixture();
    const { rows, others } = buildSpeakerRows(segments, speakers, DURATION, { maxRows });
    const colorMap = buildSpeakerColorMap(speakers);
    const utils = render(
        <SpeakerRows
            rows={rows}
            others={others}
            colorMap={colorMap}
            duration={DURATION}
            segments={segments}
            onSeekTo={onSeekTo}
            maxRows={maxRows}
        />,
    );
    return { ...utils, rows, others, onSeekTo };
}

describe('SpeakerRows', () => {
    it('shows the top rows with labels plus a "+N more" toggle when collapsed', () => {
        renderRows();
        // top 6 speakers labeled
        for (let i = 0; i < 6; i++) expect(screen.getByText(`S${i}`)).toBeInTheDocument();
        expect(screen.queryByText('S7')).toBeNull();
        expect(screen.getByRole('button', { name: /show 2 more speakers/i })).toBeInTheDocument();
    });

    it('expands to all rows and collapses again via "Show less"', () => {
        renderRows();
        fireEvent.click(screen.getByRole('button', { name: /show 2 more speakers/i }));
        expect(screen.getByText('S7')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /show less/i }));
        expect(screen.queryByText('S7')).toBeNull();
        expect(screen.getByRole('button', { name: /show 2 more speakers/i })).toBeInTheDocument();
    });

    it('is a real control surface: group role, labeled seek buttons, not aria-hidden', () => {
        const { container } = renderRows();
        expect(screen.getByRole('group', { name: /speaker timeline/i })).toBeInTheDocument();
        expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
        expect(screen.getAllByRole('button', { name: /play S0 at/i }).length).toBeGreaterThan(0);
    });

    it('clicking a block seeks and plays at that spot in the recording', () => {
        const { rows, onSeekTo } = renderRows();
        const firstBlock = rows[0].blocks[0];
        const btn = screen.getAllByRole('button', { name: /play S0 at/i })[0];
        fireEvent.click(btn);
        const [seconds, opts] = onSeekTo.mock.calls[0];
        expect(seconds).toBeGreaterThanOrEqual(firstBlock.start);
        expect(seconds).toBeLessThanOrEqual(firstBlock.end);
        expect(opts).toEqual({ play: true });
    });

    it('the aggregate row renders neutral-colored blocks', () => {
        const { container } = renderRows();
        const neutral = Array.from(container.querySelectorAll('button')).filter(
            (b) => b.style.background && b.style.background !== '' && b.getAttribute('aria-label')?.includes('other speakers'),
        );
        expect(neutral.length).toBeGreaterThan(0);
        // jsdom normalizes hex to rgb — compare via a probe element.
        const probe = document.createElement('div');
        probe.style.background = NEUTRAL_SPEAKER_COLOR;
        expect(neutral[0].style.background).toBe(probe.style.background);
    });

    it('renders nothing without rows or duration', () => {
        const { container } = render(
            <SpeakerRows rows={[]} others={null} colorMap={{}} duration={DURATION} segments={[]} onSeekTo={() => {}} />,
        );
        expect(container.firstChild).toBeNull();
    });
});
