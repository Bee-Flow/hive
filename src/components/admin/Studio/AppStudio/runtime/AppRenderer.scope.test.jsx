import { render } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import AppRenderer from './AppRenderer';
import { APP_COMPONENT_TYPES } from './componentRegistry';
import { useRuntime } from './RuntimeContext';

/**
 * AppRenderer — the per-row SCOPE and row IDENTITY contract.
 *
 * A repeated row's scope reaches its subtree through context, not through a
 * prop: every component resolves its own bindings against useRuntime().scope,
 * so anything passed only to RenderNode leaves `item.*` undefined inside the
 * row (empty lists, empty boards, empty nested repeaters). Rows are keyed by
 * record id so a reorder moves component state with its record.
 */

function defWith(children) {
    return {
        schemaVersion: 2,
        meta: { name: 'T', description: '', icon: 'LayoutGrid' },
        theme: { primary: '#0F766E', radius: 'md', density: 'comfortable', fontScale: 'md', appearance: 'auto' },
        homeScreenId: 'scr_t',
        screens: [{
            id: 'scr_t', name: 'T', icon: null, showInNav: true, maxWidth: 'medium',
            sections: [{ id: 'sec_t', style: { padding: 4, gap: 3, background: 'none' }, children }],
        }],
        actions: {},
    };
}

const render1 = (def, props = {}) => render(<AppRenderer definition={def} screenId="scr_t" {...props} />);

describe('AppRenderer — per-row scope reaches the components', () => {
    it('a stat inside a repeated row resolves its own formula against item', () => {
        const def = defWith([{
            id: 'cmp_card', type: 'card', visible: true,
            repeat: { kind: 'static', value: [{ id: 'a', count: 7 }, { id: 'b', count: 9 }] },
            props: { title: null, description: null },
            style: { span: 12, padding: 3, gap: 3, background: 'surface' },
            children: [
                {
                    id: 'cmp_stat', type: 'stat', visible: true,
                    props: { label: 'Count', value: { kind: 'formula', expr: 'item.count' }, caption: null, icon: null },
                    style: { span: 3 },
                },
            ],
        }]);
        const { getByText } = render1(def, { mode: 'run' });
        expect(getByText('7')).toBeTruthy();
        expect(getByText('9')).toBeTruthy();
    });

    it('a repeater NESTED in a repeated row resolves its source against the row', () => {
        const inner = {
            id: 'cmp_tasks', type: 'repeater', visible: true,
            forEach: { kind: 'formula', expr: 'item.tasks' },
            props: { source: { kind: 'formula', expr: 'item.tasks' }, itemActions: [], emptyText: 'No tasks.' },
            style: { span: 12, gap: 2, padding: 0 },
            children: [
                { id: 'cmp_task', type: 'text', visible: true, props: { text: '—', muted: false }, computed: { text: 'item.title' }, style: { span: 12 } },
            ],
        };
        const def = defWith([{
            id: 'cmp_people', type: 'repeater', visible: true,
            forEach: { kind: 'static', value: [
                { id: 'p1', name: 'Ann', tasks: [{ id: 't1', title: 'Call the printer' }] },
                { id: 'p2', name: 'Bo', tasks: [{ id: 't2', title: 'Email the landlord' }] },
            ] },
            props: { source: { kind: 'static', value: [{ id: 'p1' }, { id: 'p2' }] }, itemActions: [], emptyText: 'No people.' },
            style: { span: 12, gap: 3, padding: 0 },
            children: [inner],
        }]);
        const { getByText, queryByText } = render1(def, { mode: 'run' });
        expect(getByText('Call the printer')).toBeTruthy();
        expect(getByText('Email the landlord')).toBeTruthy();
        expect(queryByText('No tasks.')).toBeNull();
    });
});

describe('AppRenderer — rows are keyed by record, not by index', () => {
    // Renders "<the name this instance MOUNTED with>|<the name it shows now>":
    // state that stayed with its record reads the same on both sides.
    afterEach(() => { delete APP_COMPONENT_TYPES.rowprobe; });

    function registerProbe() {
        APP_COMPONENT_TYPES.rowprobe = {
            Component: function RowProbe() {
                const { scope } = useRuntime();
                const [mountedWith] = useState(scope.item?.name);
                return <div data-app-probe="true">{`${mountedWith}|${scope.item?.name}`}</div>;
            },
            label: 'Probe', icon: null, category: 'Content', defaultProps: {}, defaultStyle: { span: 12 },
        };
    }

    const probeDef = (items) => defWith([{
        id: 'cmp_rep', type: 'repeater', visible: true,
        forEach: { kind: 'static', value: items },
        props: { source: { kind: 'static', value: items }, itemActions: [], emptyText: 'None.' },
        style: { span: 12, gap: 3, padding: 0 },
        children: [{ id: 'cmp_probe', type: 'rowprobe', visible: true, props: {}, style: { span: 12 } }],
    }]);

    it('a reorder moves component state with the record, not with the position', () => {
        registerProbe();
        const ann = { id: 'a', name: 'Ann' };
        const bo = { id: 'b', name: 'Bo' };
        const { container, rerender } = render(
            <AppRenderer definition={probeDef([ann, bo])} screenId="scr_t" mode="run" />,
        );
        const texts = () => [...container.querySelectorAll('[data-app-probe]')].map((el) => el.textContent);
        expect(texts()).toEqual(['Ann|Ann', 'Bo|Bo']);

        rerender(<AppRenderer definition={probeDef([bo, ann])} screenId="scr_t" mode="run" />);
        expect(texts()).toEqual(['Bo|Bo', 'Ann|Ann']);
    });
});

describe('AppRenderer — a broken computed formula falls back to the authored prop', () => {
    const broken = defWith([{
        id: 'cmp_t', type: 'text', visible: true,
        props: { text: 'authored fallback', muted: false },
        computed: { text: 'currentUser.name ==' },
        style: { span: 12 },
    }]);

    it('keeps the authored prop instead of blanking the component', () => {
        const { getByText } = render1(broken, { mode: 'run', currentUser: { name: 'Zoe' } });
        expect(getByText('authored fallback')).toBeTruthy();
    });

    it('still flags the formula error in edit mode', () => {
        const { container, getByText } = render1(broken, { mode: 'edit', currentUser: { name: 'Zoe' } });
        expect(getByText('authored fallback')).toBeTruthy();
        expect(container.querySelector('[data-app-formula-error]')).toBeTruthy();
    });
});
