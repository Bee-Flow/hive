import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AppRenderer from '../AppRenderer';
import { closeAppModal, openAppModal } from './AppModal';

function defWith(children, actions = {}) {
    return {
        schemaVersion: 2,
        meta: { name: 'T', description: '', icon: 'LayoutGrid' },
        theme: { primary: '#0F766E', radius: 'md', density: 'comfortable', fontScale: 'md', appearance: 'auto' },
        homeScreenId: 'scr_t',
        screens: [{
            id: 'scr_t', name: 'T', icon: null, showInNav: true, maxWidth: 'medium',
            sections: [{ id: 'sec_t', style: { padding: 4, gap: 3, background: 'none' }, children }],
        }],
        actions,
    };
}

const render1 = (def, props = {}) => render(<AppRenderer definition={def} screenId="scr_t" {...props} />);

// ── Tabs ────────────────────────────────────────────────────────────────────

describe('AppTabs', () => {
    const tabsDef = defWith([{
        id: 'cmp_tabs', type: 'tabs', visible: true, props: {}, style: { span: 12, gap: 3, padding: 0 },
        children: [
            {
                id: 'cmp_taba', type: 'tab', visible: true, props: { label: 'First', icon: null }, style: { gap: 3, padding: 0 },
                children: [{ id: 'cmp_h1', type: 'heading', visible: true, props: { text: 'Alpha panel', level: 3 }, style: { span: 12 } }],
            },
            {
                id: 'cmp_tabb', type: 'tab', visible: true, props: { label: 'Second', icon: null }, style: { gap: 3, padding: 0 },
                children: [{ id: 'cmp_h2', type: 'heading', visible: true, props: { text: 'Beta panel', level: 3 }, style: { span: 12 } }],
            },
        ],
    }]);

    // Every panel MOUNTS (so a form's fields on an unopened tab still register
    // and still validate) — "showing" is now about which one is not `hidden`.
    // getByRole respects the accessibility tree, so a hidden panel's contents
    // are unreachable exactly as they were when they did not render at all.
    const panelOf = (text) => screen.getByText(text).closest('[data-app-tabpanel]');

    it('shows the first tab by default and switches on click (run)', () => {
        const { getByRole } = render1(tabsDef, { mode: 'run' });
        expect(panelOf('Alpha panel').dataset.appTabpanel).toBe('active');
        expect(panelOf('Beta panel').dataset.appTabpanel).toBe('inactive');
        expect(screen.queryByRole('heading', { name: 'Beta panel' })).toBeNull();

        fireEvent.click(getByRole('tab', { name: 'Second' }));
        expect(panelOf('Beta panel').dataset.appTabpanel).toBe('active');
        expect(panelOf('Alpha panel').dataset.appTabpanel).toBe('inactive');
        expect(screen.queryByRole('heading', { name: 'Alpha panel' })).toBeNull();
    });

    it('renders the tab strip in edit mode', () => {
        const { getByRole } = render1(tabsDef, { mode: 'edit' });
        expect(getByRole('tab', { name: 'First' })).toBeTruthy();
        expect(getByRole('tab', { name: 'Second' })).toBeTruthy();
    });

    // Regression: the strip was built from the RAW child definitions, so a
    // hidden/role-gated tab kept a clickable button opening an empty panel —
    // and, being first, it was the default tab.
    it('drops a hidden tab from the strip and starts on the next one (run)', () => {
        const def = defWith([{
            ...tabsDef.screens[0].sections[0].children[0],
            children: tabsDef.screens[0].sections[0].children[0].children.map((t, i) => (
                i === 0 ? { ...t, visible: false } : t
            )),
        }]);
        const { queryByRole, getByRole, queryByText } = render1(def, { mode: 'run' });
        expect(queryByRole('tab', { name: 'First' })).toBeNull();
        expect(getByRole('tab', { name: 'Second' })).toBeTruthy();
        expect(panelOf('Beta panel').dataset.appTabpanel).toBe('active');
        // A gated tab is dropped from `shown`, so its panel is not rendered at
        // all — that is stricter than merely hidden, and stays that way.
        expect(queryByText('Alpha panel')).toBeNull();
    });

    it('keeps a hidden tab editable on the canvas (edit)', () => {
        const def = defWith([{
            ...tabsDef.screens[0].sections[0].children[0],
            children: tabsDef.screens[0].sections[0].children[0].children.map((t, i) => (
                i === 0 ? { ...t, visible: false } : t
            )),
        }]);
        const { getByRole } = render1(def, { mode: 'edit' });
        expect(getByRole('tab', { name: 'First' })).toBeTruthy();
    });

    it('drops a role-gated tab from the strip in the view-as-role preview', () => {
        const def = defWith([{
            ...tabsDef.screens[0].sections[0].children[0],
            children: tabsDef.screens[0].sections[0].children[0].children.map((t, i) => (
                i === 1 ? { ...t, visibleToRoles: ['admin'] } : t
            )),
        }]);
        const { queryByRole, getByRole } = render1(def, { mode: 'run', previewRole: 'viewer' });
        expect(getByRole('tab', { name: 'First' })).toBeTruthy();
        expect(queryByRole('tab', { name: 'Second' })).toBeNull();
    });
});

// ── Modal ───────────────────────────────────────────────────────────────────

describe('AppModal', () => {
    const modalDef = defWith([{
        id: 'cmp_modal', type: 'modal', visible: true,
        props: { title: 'Details', size: 'md', triggerLabel: 'Open dialog' },
        style: { gap: 3, padding: 4 },
        children: [{ id: 'cmp_mh', type: 'heading', visible: true, props: { text: 'Dialog body', level: 3 }, style: { span: 12 } }],
    }]);

    it('opens the portaled dialog from the trigger button (run)', () => {
        const { getByText, queryByText } = render1(modalDef, { mode: 'run' });
        expect(queryByText('Dialog body')).toBeNull();
        fireEvent.click(getByText('Open dialog'));
        expect(screen.getByText('Dialog body')).toBeTruthy();
    });

    it('opens via the open_modal action seam (openAppModal)', () => {
        render1(modalDef, { mode: 'run' });
        expect(screen.queryByText('Dialog body')).toBeNull();
        act(() => openAppModal('cmp_modal'));
        expect(screen.getByText('Dialog body')).toBeTruthy();
    });

    // The dialog shipped with no visible way out at all: shared/Modal only draws
    // a close control when it is handed one, and none was passed.
    it('has a close control, and it closes the dialog', () => {
        render1(modalDef, { mode: 'run' });
        act(() => openAppModal('cmp_modal'));
        expect(screen.getByText('Dialog body')).toBeTruthy();
        fireEvent.click(screen.getByLabelText('Close dialog'));
        expect(screen.queryByText('Dialog body')).toBeNull();
    });

    // closeAppModal was exported and never called by anything: there was no
    // close_modal action or step, so an authored Cancel button — or a save
    // sequence wanting to put the dialog away — had nothing to wire to.
    it('closes via the close_modal action seam (closeAppModal)', () => {
        render1(modalDef, { mode: 'run' });
        act(() => openAppModal('cmp_modal'));
        expect(screen.getByText('Dialog body')).toBeTruthy();
        act(() => closeAppModal('cmp_modal'));
        expect(screen.queryByText('Dialog body')).toBeNull();
    });

    it('renders an inline labelled panel in edit mode', () => {
        const { container, getByText } = render1(modalDef, { mode: 'edit' });
        expect(container.querySelector('[data-app-modal="edit"]')).toBeTruthy();
        expect(getByText('Details')).toBeTruthy();
        expect(getByText('Dialog body')).toBeTruthy();
    });

    // Regression: the bus only reached MOUNTED instances, so open_modal aimed at
    // a modal inside an inactive tab (or on a screen still mounting) was dropped.
    it('opens a modal that mounts AFTER the open_modal action', () => {
        const late = defWith([{
            id: 'cmp_late', type: 'modal', visible: true,
            props: { title: 'Later', size: 'md', triggerLabel: null },
            style: { gap: 3, padding: 4 },
            children: [{ id: 'cmp_lh', type: 'heading', visible: true, props: { text: 'Late body', level: 3 }, style: { span: 12 } }],
        }]);
        act(() => openAppModal('cmp_late'));
        render1(late, { mode: 'run' });
        expect(screen.getByText('Late body')).toBeTruthy();
    });

    // Regression: a repeated subtree mounts one modal instance PER ROW under the
    // same node id — the bus opened them all and stacked identical overlays.
    it('opens exactly one instance of a modal repeated per row', () => {
        const repeated = defWith([{
            id: 'cmp_rep2', type: 'repeater', visible: true,
            forEach: { kind: 'static', value: [{ name: 'Ann' }, { name: 'Bo' }] },
            props: { source: { kind: 'static', value: [{ name: 'Ann' }, { name: 'Bo' }] }, itemActions: [], emptyText: 'None.' },
            style: { span: 12, gap: 3, padding: 0 },
            children: [{
                id: 'cmp_rmodal', type: 'modal', visible: true,
                props: { title: 'Row', size: 'md', triggerLabel: null },
                style: { gap: 3, padding: 4 },
                children: [{ id: 'cmp_rmh', type: 'heading', visible: true, props: { text: 'Row body', level: 3 }, style: { span: 12 } }],
            }],
        }]);
        render1(repeated, { mode: 'run' });
        act(() => openAppModal('cmp_rmodal'));
        expect(screen.getAllByText('Row body')).toHaveLength(1);
    });
});

// ── Repeater ─────────────────────────────────────────────────────────────────

describe('AppRepeater', () => {
    // The renderer repeats via the node's forEach binding (mirror of props.source);
    // the child text reads the per-item `item` scope through a computed prop.
    const items = [{ name: 'Ann' }, { name: 'Bo' }];
    const repeaterDef = (actions = {}) => defWith([{
        id: 'cmp_rep', type: 'repeater', visible: true,
        forEach: { kind: 'static', value: items },
        props: { source: { kind: 'static', value: items }, itemActions: [{ label: 'Pick', actionId: 'act_pick' }], emptyText: 'None.' },
        style: { span: 12, gap: 3, padding: 0 },
        children: [{ id: 'cmp_rt', type: 'text', visible: true, props: { text: '—', muted: false }, computed: { text: 'item.name' }, style: { span: 12 } }],
    }], actions);

    it('renders its child subtree once per item with per-item scope', () => {
        const { getByText } = render1(repeaterDef(), { mode: 'run' });
        expect(getByText('Ann')).toBeTruthy();
        expect(getByText('Bo')).toBeTruthy();
    });

    it('shows the empty state when the source is empty', () => {
        const def = defWith([{
            id: 'cmp_rep', type: 'repeater', visible: true,
            forEach: { kind: 'static', value: [] },
            props: { source: { kind: 'static', value: [] }, itemActions: [], emptyText: 'None.' },
            style: { span: 12 }, children: [{ id: 'cmp_rt', type: 'text', visible: true, props: { text: 'x' }, style: { span: 12 } }],
        }]);
        const { getByText } = render1(def, { mode: 'run' });
        expect(getByText('None.')).toBeTruthy();
    });

    it('fires an itemAction with the row as formValues', () => {
        const runAction = vi.fn();
        const { getAllByText } = render1(repeaterDef({ act_pick: { kind: 'toast', message: 'x', tone: 'info' } }), { mode: 'run', runAction });
        fireEvent.click(getAllByText('Pick')[0]);
        expect(runAction).toHaveBeenCalledWith('act_pick', { formValues: { name: 'Ann' } });
    });
});
