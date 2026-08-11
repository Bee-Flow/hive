import { render, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ThemePanel from './ThemePanel';

/**
 * Screen settings.
 *
 * `updateScreen` has always accepted a full patch, but its only caller passed
 * `{ name }`. So `maxWidth` defaulted to 'medium' (960px) with no hand-editable
 * way out: on a 2560px monitor an app used a third of the screen and the author
 * could do nothing about it. Same for refreshInterval / icon / showInNav — all
 * honoured by the runtime, all reachable only through the AI builder.
 */

const DEF = {
    schemaVersion: 2,
    meta: { name: 'T', description: '', icon: null },
    theme: {},
    homeScreenId: 'scr_1',
    screens: [
        { id: 'scr_1', name: 'One', maxWidth: 'medium', refreshInterval: 0, showInNav: true, icon: null, sections: [] },
        { id: 'scr_2', name: 'Two', maxWidth: 'medium', refreshInterval: 0, showInNav: true, icon: null, sections: [] },
    ],
    actions: {},
};

function renderPanel(screenId = 'scr_1') {
    const onCommit = vi.fn();
    const utils = render(<ThemePanel definition={DEF} onCommit={onCommit} screenId={screenId} />);
    // Scoped to the screen block: the theme controls above it reuse the same
    // S / M / L labels, so an unscoped query is ambiguous.
    const pick = (name) => fireEvent.click(within(utils.getByTestId('screen-settings')).getByRole('radio', { name }));
    return { ...utils, onCommit, pick };
}

describe('ThemePanel screen settings', () => {
    it('commits the width without touching anything else', () => {
        const { onCommit, pick } = renderPanel();
        pick('Full');

        expect(onCommit).toHaveBeenCalledTimes(1);
        const next = onCommit.mock.calls[0][0];
        expect(next.screens[0].maxWidth).toBe('full');
        // Surgical: the other screen, the theme and the meta are the same objects.
        expect(next.screens[1]).toBe(DEF.screens[1]);
        expect(next.theme).toBe(DEF.theme);
        expect(next.meta).toBe(DEF.meta);
    });

    it('stores the refresh interval as a number, not the string the DOM hands back', () => {
        // refreshInterval is an enum of NUMBERS server-side; committing "30"
        // would fail validation on save.
        const { onCommit, pick } = renderPanel();
        pick('30s');
        expect(onCommit.mock.calls[0][0].screens[0].refreshInterval).toBe(30);
    });

    it('edits the screen you are looking at', () => {
        const { onCommit, pick } = renderPanel('scr_2');
        pick('L');
        const next = onCommit.mock.calls[0][0];
        expect(next.screens[1].maxWidth).toBe('wide');
        expect(next.screens[0]).toBe(DEF.screens[0]);
    });

    it('re-picking the current value commits nothing', () => {
        const { onCommit, pick } = renderPanel();
        pick('M');
        expect(onCommit).not.toHaveBeenCalled();
    });

    it('hides the block when there is no screen to edit', () => {
        const { queryByTestId } = render(<ThemePanel definition={DEF} onCommit={vi.fn()} screenId={null} />);
        expect(queryByTestId('screen-settings')).toBeNull();
        expect(queryByTestId('theme-panel')).toBeTruthy();
    });
});
