import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';

import InsightsPanel from './InsightsPanel';

// 10-minute meeting: Tom talks 0–5:00 (flagged monologue) and 6:40–7:30,
// Sandra fills the rest. Chapters split at 2:00.
const MEETING = {
    durationSeconds: 600,
    segments: [
        { speaker: 'Tom Kooy', start: 0, end: 300, text: 'lang verhaal' },
        { speaker: 'Sandra', start: 300, end: 400, text: 'reactie' },
        { speaker: 'Tom Kooy', start: 400, end: 450, text: 'vervolg' },
        { speaker: 'Sandra', start: 450, end: 500, text: 'afronding? echt?' },
    ],
    speakers: [
        { id: 'Tom Kooy', speakingSeconds: 350, summary: 'Tom demonstreerde de tool en nam de wensen op.' },
        { id: 'Sandra', speakingSeconds: 150 }, // no contribution written yet
    ],
    chapters: [
        { title: 'Opening', start: '00:00' },
        { title: 'MFA', start: '02:00' },
    ],
    actionItems: [
        { id: 'a1', text: 'MFA uitrollen', assignee: 'Tom Kooy', timestamp: '03:00', done: false },
        { id: 'a2', text: 'Nog te verdelen', assignee: 'Niet toegewezen', timestamp: '', done: false },
    ],
    decisions: [{ id: 'd1', text: 'We gaan door', timestamp: '04:00' }],
    questions: [{ id: 'q1', text: 'Wie regelt de licenties?', timestamp: '05:00', open: true }],
    attendees: ['Tom Kooy', 'Sandra', 'Marijke'],
};

/** The detail region is collapsed by default — open it before asserting. */
function openDetails() {
    fireEvent.click(screen.getByRole('button', { name: /Show details/i }));
}
function goToTab(name) {
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(name, 'i') }));
}

describe('InsightsPanel — headline + collapse', () => {
    beforeEach(() => window.localStorage.clear());
    afterEach(cleanup);

    it('always shows the three meeting-level chips, tabs stay folded away', () => {
        render(<InsightsPanel meeting={MEETING} onSeek={() => {}} />);
        expect(screen.getByText('Balance')).toBeTruthy();
        expect(screen.getByText('Interactivity')).toBeTruthy();
        expect(screen.getByText('Silence')).toBeTruthy();
        // The summary below must not be pushed off screen by default.
        expect(screen.queryByRole('tablist')).toBeNull();
    });

    it('opens and closes the detail region', () => {
        render(<InsightsPanel meeting={MEETING} onSeek={() => {}} />);
        const toggle = screen.getByRole('button', { name: /Show details/i });
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        fireEvent.click(toggle);
        expect(screen.getByRole('tablist')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /Hide details/i }));
        expect(screen.queryByRole('tablist')).toBeNull();
    });

    it('remembers the open state and the chosen tab across mounts', () => {
        const { unmount } = render(<InsightsPanel meeting={MEETING} onSeek={() => {}} />);
        openDetails();
        goToTab('People');
        unmount();

        render(<InsightsPanel meeting={MEETING} onSeek={() => {}} />);
        expect(screen.getByRole('tab', { name: /People/i }).getAttribute('aria-selected')).toBe('true');
    });

    it('ignores a stale stored tab id', () => {
        window.localStorage.setItem('mn-insights-open', '1');
        window.localStorage.setItem('mn-insights-tab', 'does-not-exist');
        render(<InsightsPanel meeting={MEETING} onSeek={() => {}} />);
        expect(screen.getByRole('tab', { name: /Overview/i }).getAttribute('aria-selected')).toBe('true');
    });

    it('wires the panel to the selected tab and switches content', () => {
        render(<InsightsPanel meeting={MEETING} onSeek={() => {}} />);
        openDetails();
        expect(screen.getByRole('tabpanel')).toBeTruthy();
        expect(screen.queryByRole('list', { name: 'Talk time' })).toBeNull();
        goToTab('People');
        expect(screen.getByRole('list', { name: 'Talk time' })).toBeTruthy();
    });

    it('renders the empty state for a meeting without segments', () => {
        render(<InsightsPanel meeting={{ durationSeconds: 0, segments: [], speakers: [] }} />);
        expect(screen.getByText(/Not enough data/i)).toBeTruthy();
        expect(screen.queryByRole('tablist')).toBeNull();
    });
});

describe('InsightsPanel — Overview tab', () => {
    beforeEach(() => window.localStorage.clear());
    afterEach(cleanup);

    it('summarises the headline facts and jumps to them', () => {
        const onSeek = vi.fn();
        render(<InsightsPanel meeting={MEETING} onSeek={onSeek} />);
        openDetails();
        expect(screen.getByText('Longest monologue')).toBeTruthy();
        expect(screen.getByText('Biggest topic')).toBeTruthy();
        expect(screen.getByText('People who spoke')).toBeTruthy();
        // Tom's longest uninterrupted stretch starts at 0.
        fireEvent.click(screen.getByRole('button', { name: '5:00' }));
        expect(onSeek).toHaveBeenCalledWith(0);
    });

    it('counts the silent invitee', () => {
        render(<InsightsPanel meeting={MEETING} onSeek={() => {}} />);
        openDetails();
        expect(screen.getByText('1 silent')).toBeTruthy();
    });
});

describe('InsightsPanel — People tab', () => {
    beforeEach(() => window.localStorage.clear());
    afterEach(cleanup);

    function renderPeople(props = {}) {
        render(<InsightsPanel meeting={MEETING} onSeek={() => {}} {...props} />);
        openDetails();
        goToTab('People');
    }

    it('ranks speakers by talk time and shows delivery numbers', () => {
        renderPeople();
        const rows = within(screen.getByRole('list', { name: 'Talk time' })).getAllByRole('listitem');
        expect(rows).toHaveLength(2);
        expect(rows[0].textContent).toContain('Tom Kooy');
        expect(rows[0].textContent).toContain('70%');
        expect(rows[1].textContent).toContain('30%');
        // Turns / questions / listening render per row.
        expect(rows[0].textContent).toContain('Turns');
        expect(rows[1].textContent).toContain('Questions');
    });

    it('floats the viewer to the top with a "you" badge', () => {
        renderPeople({ viewerName: 'Sandra' });
        const rows = within(screen.getByRole('list', { name: 'Talk time' })).getAllByRole('listitem');
        expect(rows[0].textContent).toContain('Sandra');
        expect(rows[0].textContent).toContain('you');
    });

    it('names the invitee who never spoke', () => {
        renderPeople();
        expect(screen.getByText('Did not speak')).toBeTruthy();
        expect(screen.getByText('Marijke')).toBeTruthy();
    });

    it('expands one contribution at a time, and none for a speaker without one', () => {
        renderPeople();
        expect(screen.getAllByRole('button', { name: /contribution/i })).toHaveLength(1);
        const toggle = screen.getByRole('button', { name: 'Show contribution' });
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        fireEvent.click(toggle);

        const prose = screen.getByText('Tom demonstreerde de tool en nam de wensen op.');
        const open = screen.getByRole('button', { name: 'Hide contribution' });
        expect(open.getAttribute('aria-controls')).toBe(prose.getAttribute('id'));
        fireEvent.click(open);
        expect(screen.queryByText('Tom demonstreerde de tool en nam de wensen op.')).toBeNull();
    });

    it('seeks to the longest monologue on click', () => {
        const onSeek = vi.fn();
        render(<InsightsPanel meeting={MEETING} onSeek={onSeek} />);
        openDetails();
        goToTab('People');
        fireEvent.click(screen.getByRole('button', { name: '5:00' }));
        expect(onSeek).toHaveBeenCalledWith(0);
    });
});

describe('InsightsPanel — Flow, Topics and Follow-up tabs', () => {
    beforeEach(() => window.localStorage.clear());
    afterEach(cleanup);

    it('shows conversation dynamics and jumps into a quiet stretch', () => {
        const onSeek = vi.fn();
        render(<InsightsPanel meeting={MEETING} onSeek={onSeek} />);
        openDetails();
        goToTab('Flow');
        expect(screen.getByText('Turn-taking rhythm')).toBeTruthy();
        expect(screen.getByText('Airtime over time')).toBeTruthy();
        expect(screen.getByText('Time in long monologues')).toBeTruthy();
        // 8:20 → 10:00 is the lead-out (nobody speaks after 500s).
        expect(screen.getByText('After the last word')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: '1:40' }));
        expect(onSeek).toHaveBeenCalledWith(500);
    });

    it('breaks topics down by time and owner, and seeks to one', () => {
        const onSeek = vi.fn();
        render(<InsightsPanel meeting={MEETING} onSeek={onSeek} />);
        openDetails();
        goToTab('Topics');
        expect(screen.getByText('Time per topic')).toBeTruthy();
        // MFA runs 2:00 → 10:00 and Tom holds most of it.
        expect(screen.getByRole('button', { name: /MFA.*8:00/ })).toBeTruthy();
        // Tom holds the floor in both chapters, so both rows name him.
        expect(screen.getAllByText(/Mostly Tom Kooy/)).toHaveLength(2);
        expect(screen.getByText('Action items per topic')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'MFA (2:00)' }));
        expect(onSeek).toHaveBeenCalledWith(120);
    });

    it('reports follow-up health and unanswered questions', () => {
        const onSeek = vi.fn();
        render(<InsightsPanel meeting={MEETING} onSeek={onSeek} />);
        openDetails();
        goToTab('Follow-up');
        expect(screen.getByText('Without an owner')).toBeTruthy();
        expect(screen.getByText('Decisions made')).toBeTruthy();
        expect(screen.getByText('Left unanswered')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: '5:00' }));
        expect(onSeek).toHaveBeenCalledWith(300);
    });

    it('disables a tab whose data is missing instead of hiding it', () => {
        const bare = { ...MEETING, chapters: [], tags: [], actionItems: [], decisions: [], questions: [] };
        render(<InsightsPanel meeting={bare} onSeek={() => {}} />);
        openDetails();
        expect(screen.getByRole('tab', { name: /Topics/i }).hasAttribute('disabled')).toBe(true);
        expect(screen.getByRole('tab', { name: /Follow-up/i }).hasAttribute('disabled')).toBe(true);
        expect(screen.getByRole('tab', { name: /Flow/i }).hasAttribute('disabled')).toBe(false);
    });
});

describe('InsightsPanel — per-person org gate', () => {
    beforeEach(() => window.localStorage.clear());
    afterEach(cleanup);

    it('keeps meeting-level numbers but never renders attribution', () => {
        render(<InsightsPanel meeting={MEETING} onSeek={() => {}} perPersonEnabled={false} />);
        expect(screen.getByText('Balance')).toBeTruthy();
        openDetails();
        expect(screen.getByText(/disabled by your organization/i)).toBeTruthy();
        expect(screen.getByRole('tab', { name: /People/i }).hasAttribute('disabled')).toBe(true);
        expect(screen.queryByRole('list', { name: 'Talk time' })).toBeNull();
        expect(screen.queryAllByRole('button', { name: /contribution/i })).toHaveLength(0);
        // No name reaches the DOM anywhere in the open panel.
        expect(document.body.textContent).not.toContain('Tom Kooy');
        expect(document.body.textContent).not.toContain('Sandra');
    });

    it('drops attribution from Flow and Topics too', () => {
        render(<InsightsPanel meeting={MEETING} onSeek={() => {}} perPersonEnabled={false} />);
        openDetails();
        goToTab('Flow');
        expect(screen.getByText('Turn-taking rhythm')).toBeTruthy();     // meeting-level: stays
        expect(screen.queryByText('Airtime over time')).toBeNull();      // per-person: gone
        expect(screen.queryByText('Who follows whom')).toBeNull();
        goToTab('Topics');
        expect(screen.getByText('Time per topic')).toBeTruthy();         // durations stay
        expect(screen.queryByText(/Mostly /)).toBeNull();                // owners do not
    });
});
