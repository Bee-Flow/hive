import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppShell from '../AppShell';
import { megaColumns } from './NavMega';

/**
 * nav.style 'mega' — the top bar whose groups open a panel.
 *
 * The assertions that matter are the two ways it can be worse than the tab row
 * it replaces: a group trigger that navigates somewhere on the first click
 * (so touch users can never open the panel), and a 'mega' app with no groups
 * rendering an empty bar.
 */

const scr = (id, name, extra = {}) => ({ id, name, icon: null, showInNav: true, sections: [], ...extra });

const DEF = {
    schemaVersion: 2,
    meta: { name: 'Quote intake', description: '', icon: 'LayoutGrid' },
    theme: { primary: '#0F766E', radius: 'md', density: 'comfortable', fontScale: 'md', appearance: 'auto' },
    homeScreenId: 'scr_home01',
    nav: {
        style: 'mega',
        groups: [
            { id: 'nvg_work01', label: 'Work', icon: null, screens: ['scr_home01', 'scr_req001'] },
            { id: 'nvg_set001', label: 'Setup', icon: null, screens: ['scr_set001'] },
        ],
    },
    screens: [
        scr('scr_home01', 'Inbox', { description: 'Triage what came in today' }),
        scr('scr_req001', 'Request', { description: 'The full workspace' }),
        scr('scr_set001', 'Materials'),
        scr('scr_free01', 'Pricing'),
    ],
};

function renderShell(definition = DEF, onNavigate = () => {}) {
    return render(
        <AppShell definition={definition} screenId="scr_home01" onNavigate={onNavigate}>
            <div>content</div>
        </AppShell>,
    );
}

describe('NavMega', () => {
    it('shows group triggers and ungrouped screens as plain links', () => {
        renderShell();
        const nav = screen.getByRole('navigation', { name: 'App screens' });
        expect(within(nav).getByRole('button', { name: /Work/ })).toBeInTheDocument();
        expect(within(nav).getByRole('button', { name: /Setup/ })).toBeInTheDocument();
        // An ungrouped screen is a link, not a menu.
        const pricing = within(nav).getByRole('button', { name: 'Pricing' });
        expect(pricing).not.toHaveAttribute('aria-haspopup');
    });

    it('a group trigger opens its panel instead of navigating', () => {
        const onNavigate = vi.fn();
        renderShell(DEF, onNavigate);
        const trigger = screen.getByRole('button', { name: /Work/ });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(trigger);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        // The trigger owns no destination — clicking it must not move anyone.
        expect(onNavigate).not.toHaveBeenCalled();

        const panel = screen.getByRole('menu', { name: 'Work' });
        expect(within(panel).getByText('Inbox')).toBeInTheDocument();
        // The description is the whole point of the shape.
        expect(within(panel).getByText('Triage what came in today')).toBeInTheDocument();

        fireEvent.click(within(panel).getByRole('menuitem', { name: /Request/ }));
        expect(onNavigate).toHaveBeenCalledWith('scr_req001');
        expect(screen.queryByRole('menu', { name: 'Work' })).toBeNull();
    });

    it('Escape closes the panel', () => {
        renderShell();
        fireEvent.click(screen.getByRole('button', { name: /Setup/ }));
        expect(screen.getByRole('menu', { name: 'Setup' })).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('menu', { name: 'Setup' })).toBeNull();
    });

    it('falls back to the tab row when the app declares no groups', () => {
        // Choosing 'mega' before organising the screens must not produce a bar
        // with nothing in it.
        const { nav: _dropped, ...noGroups } = DEF;
        const def = { ...noGroups, nav: { style: 'mega' } };
        renderShell(def);
        const nav = screen.getByRole('navigation', { name: 'App screens' });
        expect(within(nav).getAllByRole('button', { name: 'Inbox' }).length).toBeGreaterThan(0);
        expect(within(nav).getByRole('button', { name: 'Materials' })).toBeInTheDocument();
        expect(nav.querySelector('[aria-haspopup="menu"]')).toBeNull();
    });
});

describe('megaColumns', () => {
    it('keeps a small group in one column and splits a large one', () => {
        const six = Array.from({ length: 6 }, (_, i) => ({ id: `s${i}` }));
        expect(megaColumns(six)).toHaveLength(1);
        const seven = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}` }));
        expect(megaColumns(seven)).toHaveLength(2);
        // Never wider than three, however many screens a group collects.
        const forty = Array.from({ length: 40 }, (_, i) => ({ id: `s${i}` }));
        expect(megaColumns(forty)).toHaveLength(3);
        expect(megaColumns(forty).flat()).toHaveLength(40);
    });
});
