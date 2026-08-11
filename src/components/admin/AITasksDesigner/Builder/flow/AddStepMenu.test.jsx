import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import AddStepMenu from './AddStepMenu';

const CATALOG = {
    apps: [
        {
            id: 'google-drive',
            label: 'Google Drive',
            available: true,
            actions: [
                { name: 'drive_search', label: 'drive search', description: 'Search for files', integrationId: 'google-drive', sideEffect: false },
                { name: 'drive_list_files', label: 'drive list files', description: 'List files', integrationId: 'google-drive', sideEffect: false },
            ],
        },
        {
            id: 'gmail',
            label: 'Gmail',
            available: true,
            actions: [{ name: 'gmail_read', label: 'gmail read', description: 'Read an email', integrationId: 'gmail', sideEffect: false }],
        },
    ],
};

const renderApps = () => {
    const onAdd = vi.fn();
    const { container } = render(<AddStepMenu scope={{ catalog: CATALOG }} showSearch={false} onAdd={onAdd} />);
    return { onAdd, container };
};

/** Text of the row, in DOM order, so "which side is the chevron on" is testable. */
function rowOrder(el) {
    return [...el.querySelectorAll('svg, span')]
        .map(n => (n.tagName.toLowerCase() === 'svg' ? 'CHEVRON' : n.textContent.trim()))
        .filter(Boolean);
}

describe('AddStepMenu — apps tree', () => {
    beforeEach(cleanup);

    it('expands a category from a chevron that LEADS the row', () => {
        renderApps();
        const category = screen.getAllByRole('button').find(b => b.textContent.includes('Google Workspace'))
            || screen.getAllByRole('button')[0];
        expect(rowOrder(category)[0]).toBe('CHEVRON');
    });

    it('a nested app row puts its chevron on the SAME side as the category (BFSF-337)', () => {
        // It used to sit after the action count, on the far right, so drilling
        // one level deeper moved the click target across the whole panel.
        renderApps();
        const categories = screen.getAllByRole('button');
        fireEvent.click(categories[0]);

        const appRow = screen.getAllByRole('button').find(b => b.textContent.includes('Google Drive'));
        expect(appRow).toBeTruthy();
        const order = rowOrder(appRow);
        expect(order[0]).toBe('CHEVRON');
        // …and the count stays on the right, where it was.
        expect(order[order.length - 1]).toBe('2');
    });

    it('the app chevron still toggles its actions', () => {
        renderApps();
        fireEvent.click(screen.getAllByRole('button')[0]);
        expect(screen.queryByText('drive search')).toBeNull();
        fireEvent.click(screen.getAllByRole('button').find(b => b.textContent.includes('Google Drive')));
        expect(screen.getByText('drive search')).toBeTruthy();
        expect(screen.getByText('drive list files')).toBeTruthy();
    });

    it('clicking an action adds it', () => {
        const { onAdd } = renderApps();
        fireEvent.click(screen.getAllByRole('button')[0]);
        fireEvent.click(screen.getAllByRole('button').find(b => b.textContent.includes('Google Drive')));
        fireEvent.click(screen.getByText('drive search'));
        expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ kind: 'integration_action', tool: 'drive_search' }));
    });

    it('the quick-add "+" is separate from the disclosure and adds the primary action', () => {
        const { onAdd } = renderApps();
        fireEvent.click(screen.getAllByRole('button')[0]);
        fireEvent.click(screen.getByTitle('Add Google Drive'));
        expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ tool: 'drive_search', label: 'Google Drive' }));
        // Adding must not have expanded the row.
        expect(screen.queryByText('drive list files')).toBeNull();
    });
});

/**
 * A step whose preconditions the current graph doesn't meet (today: the form
 * pages, which need a form trigger). It stays on the list so the author can
 * see it exists and read why it isn't available — but it must not be
 * addable by any route (BFSF-348).
 */
describe('AddStepMenu — a step the graph cannot accept', () => {
    beforeEach(cleanup);

    const renderFlow = (extra = { hasFormTrigger: false }) => {
        const onAdd = vi.fn();
        render(<AddStepMenu scope={{ catalog: { apps: [] }, ...extra }} showSearch onAdd={onAdd} />);
        return onAdd;
    };
    const formRow = () => screen.getAllByText(/Form: ask for more info/i)[0].closest('[role="button"]');

    it('is listed, explains itself, and is marked disabled', () => {
        renderFlow();
        const row = formRow();
        expect(row.getAttribute('aria-disabled')).toBe('true');
        expect(row.getAttribute('title')).toMatch(/form/i);
        expect(row.textContent).toMatch(/switch the trigger/i);
    });

    it('does nothing on click, Enter or Space', () => {
        const onAdd = renderFlow();
        const row = formRow();
        fireEvent.click(row);
        fireEvent.keyDown(row, { key: 'Enter' });
        fireEvent.keyDown(row, { key: ' ' });
        expect(onAdd).not.toHaveBeenCalled();
    });

    it('is not draggable onto the canvas either', () => {
        renderFlow();
        expect(formRow().getAttribute('draggable')).toBeNull();
    });

    /**
     * BFSF-348 remainder — the "Suggested next" / "Frequently used" rows were
     * built by the caller and rendered straight through, so they never met
     * `gated()`. Reaching for the same step from the top of the very same
     * menu still added it and still produced the guaranteed
     * `form_page.no_form_trigger` save error.
     */
    it('gates the Suggested / Frequently used rows too, not just the categories', () => {
        const reco = [{ key: 'form_page', Icon: () => null, label: 'Form: ask for more info', payload: { kind: 'form_page', mode: 'input', label: 'Ask for more info' } }];
        const onAdd = vi.fn();
        render(<AddStepMenu scope={{ catalog: { apps: [] }, hasFormTrigger: false, suggested: reco }} showSearch onAdd={onAdd} />);
        const row = screen.getAllByText(/Form: ask for more info/i)[0].closest('[role="button"]');
        expect(row.getAttribute('aria-disabled')).toBe('true');
        fireEvent.click(row);
        expect(onAdd).not.toHaveBeenCalled();
    });

    it('leaves the reco rows addable when a form trigger exists', () => {
        const reco = [{ key: 'form_page', Icon: () => null, label: 'Form: ask for more info', payload: { kind: 'form_page', mode: 'input', label: 'Ask for more info' } }];
        const onAdd = vi.fn();
        render(<AddStepMenu scope={{ catalog: { apps: [] }, hasFormTrigger: true, suggested: reco }} showSearch onAdd={onAdd} />);
        fireEvent.click(screen.getAllByText(/Form: ask for more info/i)[0].closest('[role="button"]'));
        expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ kind: 'form_page', mode: 'input' }));
    });

    it('adds normally once the routine has a form trigger', () => {
        const onAdd = renderFlow({ hasFormTrigger: true });
        const row = formRow();
        expect(row.getAttribute('aria-disabled')).toBeNull();
        fireEvent.click(row);
        expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ kind: 'form_page', mode: 'input' }));
    });

    it('does not claim it is impossible when the caller never said', () => {
        // The edge-drop popover passes no hasFormTrigger at all. Defaulting to
        // "blocked" made every form step permanently unreachable from there,
        // form trigger or not.
        const onAdd = renderFlow({});
        expect(formRow().getAttribute('aria-disabled')).toBeNull();
        fireEvent.click(formRow());
        expect(onAdd).toHaveBeenCalled();
    });
});

/**
 * BFSF-361 — "Suggested next" and "Frequently used" were rendered as two
 * independent blocks with no cross-filtering, so the step a user reaches for
 * most (and which is therefore also the obvious next one) appeared twice, back
 * to back, as if it were two different offers.
 */
describe('AddStepMenu — the two smart lists do not repeat each other', () => {
    beforeEach(cleanup);

    const row = (label) => screen.queryAllByText(label);
    const reco = (key, label, payload) => ({ key, Icon: () => null, label, payload });

    it('drops from "Frequently used" whatever "Suggested next" already offered', () => {
        render(<AddStepMenu
            scope={{
                catalog: { apps: [] },
                suggested: [reco('set', 'Edit data', { kind: 'set', label: 'Edit data' })],
                frequent: [
                    reco('set', 'Edit data', { kind: 'set', label: 'Edit data' }),
                    reco('loop', 'Loop Over Items', { kind: 'loop', label: 'Loop Over Items' }),
                ],
            }}
            showSearch={false}
            onAdd={() => {}}
        />);
        expect(screen.getByText('Suggested next')).toBeTruthy();
        expect(screen.getByText('Frequently used')).toBeTruthy();
        // Once in Suggested next, once in the Flow category list below — never
        // a second reco row.
        expect(row('Edit data')).toHaveLength(2);
        // The rest of Frequently used is untouched — it is still offered. It
        // appears ONCE under that text because a reco row carries the label the
        // user's own recorded usage had, while the category list below shows
        // the canonical palette name ("Repeat for each"), so the two do not
        // collide in the DOM.
        expect(row('Loop Over Items')).toHaveLength(1);
    });

    it('tells two app actions apart by what they would add, not by their label', () => {
        render(<AddStepMenu
            scope={{
                catalog: { apps: [] },
                suggested: [reco('gmail_send', 'Send email', { kind: 'integration_action', tool: 'gmail_send' })],
                frequent: [
                    reco('gmail_send', 'Send email', { kind: 'integration_action', tool: 'gmail_send' }),
                    reco('outlook_send', 'Send email', { kind: 'integration_action', tool: 'outlook_send' }),
                ],
            }}
            showSearch={false}
            onAdd={() => {}}
        />);
        // The duplicate tool goes; the same-labelled DIFFERENT tool stays.
        expect(row('Send email')).toHaveLength(2);
    });

    it('drops the whole heading when everything in it was already suggested', () => {
        render(<AddStepMenu
            scope={{
                catalog: { apps: [] },
                suggested: [reco('set', 'Edit data', { kind: 'set', label: 'Edit data' })],
                frequent: [reco('set', 'Edit data', { kind: 'set', label: 'Edit data' })],
            }}
            showSearch={false}
            onAdd={() => {}}
        />);
        expect(screen.queryByText('Frequently used')).toBeNull();
    });
});
