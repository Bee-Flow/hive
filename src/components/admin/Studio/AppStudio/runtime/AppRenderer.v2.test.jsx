import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AppRenderer from './AppRenderer';
import { V2_SHOWCASE } from '../state/sampleDefinitions';

function defWith(children, actions = {}) {
    return {
        schemaVersion: 1,
        meta: { name: 'Test app', description: '', icon: 'LayoutGrid' },
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

describe('AppRenderer v2 — visibleWhen', () => {
    const def = defWith([
        { id: 'cmp_h', type: 'heading', visible: true, visibleWhen: 'currentUser != null', props: { text: 'Hello you', level: 2 }, style: { span: 12 } },
    ]);

    it('hides a node whose visibleWhen is falsy in run mode', () => {
        const { queryByText } = render1(def, { mode: 'run' });
        expect(queryByText('Hello you')).toBeNull();
    });

    it('shows the node once the formula is truthy', () => {
        const { getByText } = render1(def, { mode: 'run', currentUser: { id: 'u1' } });
        expect(getByText('Hello you')).toBeTruthy();
    });

    it('keeps it findable in edit mode and flags a broken formula', () => {
        const bad = defWith([
            { id: 'cmp_b', type: 'heading', visible: true, visibleWhen: 'form.x ==', props: { text: 'Broken', level: 2 }, style: { span: 12 } },
        ]);
        const { container, getByText } = render1(bad, { mode: 'edit' });
        expect(getByText('Broken')).toBeTruthy(); // still on the canvas
        expect(container.querySelector('[data-app-formula-error]')).toBeTruthy();
    });
});

describe('AppRenderer v2 — enabledWhen', () => {
    it('wraps a node in the inert disabled wrapper when enabledWhen is false', () => {
        const def = defWith([
            { id: 'cmp_btn', type: 'button', visible: true, enabledWhen: 'false', onClick: 'a1', props: { label: 'Go', variant: 'primary', role: 'button' }, style: { span: 3 } },
        ], { a1: { kind: 'toast', message: 'hi', tone: 'info' } });
        const { container } = render1(def, { mode: 'run' });
        const wrap = container.querySelector('[data-app-disabled="true"]');
        expect(wrap).toBeTruthy();
        expect(wrap.querySelector('button')).toBeTruthy();
    });

    it('does not wrap when enabledWhen is truthy', () => {
        const def = defWith([
            { id: 'cmp_btn', type: 'button', visible: true, enabledWhen: 'true', onClick: 'a1', props: { label: 'Go', variant: 'primary', role: 'button' }, style: { span: 3 } },
        ], { a1: { kind: 'toast', message: 'hi', tone: 'info' } });
        const { container } = render1(def, { mode: 'run' });
        expect(container.querySelector('[data-app-disabled]')).toBeNull();
    });
});

describe('AppRenderer v2 — computed props', () => {
    it('a computed formula overrides the static prop at render', () => {
        const def = defWith([
            { id: 'cmp_t', type: 'text', visible: true, props: { text: 'original', muted: false }, computed: { text: 'currentUser.name' }, style: { span: 12 } },
        ]);
        const { getByText, queryByText } = render1(def, { mode: 'run', currentUser: { name: 'Zoe' } });
        expect(getByText('Zoe')).toBeTruthy();
        expect(queryByText('original')).toBeNull();
    });
});

describe('AppRenderer v2 — per-row item scope (repeat)', () => {
    it('renders a container child once per item with item/index scope', () => {
        const def = defWith([
            {
                id: 'cmp_card', type: 'card', visible: true,
                repeat: { kind: 'static', value: [{ name: 'Alpha' }, { name: 'Beta' }] },
                props: { title: null, description: null },
                style: { span: 12, padding: 3, gap: 3, background: 'surface' },
                children: [
                    { id: 'cmp_row', type: 'text', visible: true, props: { text: '—', muted: false }, computed: { text: 'item.name' }, style: { span: 12 } },
                ],
            },
        ]);
        const { getByText } = render1(def, { mode: 'run' });
        expect(getByText('Alpha')).toBeTruthy();
        expect(getByText('Beta')).toBeTruthy();
    });
});

describe('AppRenderer v2 — formula binding on a component', () => {
    it('a stat with a formula value resolves against scope', () => {
        const def = defWith([
            { id: 'cmp_s', type: 'stat', visible: true, props: { label: 'Sum', value: { kind: 'formula', expr: '40 + 2' }, caption: null, icon: null }, style: { span: 3 } },
        ]);
        const { getByText } = render1(def, { mode: 'run' });
        expect(getByText('42')).toBeTruthy();
    });
});

describe('AppRenderer v2 — showcase fixture', () => {
    it('renders the v2 showcase without crashing (formula stat + repeat)', () => {
        const { getByText } = render(<AppRenderer definition={V2_SHOWCASE} screenId="scr_v2main" mode="run" />);
        expect(getByText('4')).toBeTruthy();      // formula stat: 2 + 2
        expect(getByText('Alpha')).toBeTruthy();  // repeat item
        expect(getByText('Beta')).toBeTruthy();
    });
});
