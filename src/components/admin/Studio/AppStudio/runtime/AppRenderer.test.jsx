import { render, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import AppRenderer from './AppRenderer';
import { APP_COMPONENT_TYPES, getComponentEntry, PALETTE_CATEGORIES } from './componentRegistry';
import { KITCHEN_SINK, V2_RICH, V21_BATCH } from '../state/sampleDefinitions';

// A permissive theme'd definition scaffold for one-off nodes.
function defWith(children, actions = {}) {
    return {
        schemaVersion: 1,
        meta: { name: 'Test app', description: '', icon: 'LayoutGrid' },
        theme: { primary: '#0F766E', radius: 'md', density: 'comfortable', fontScale: 'md', appearance: 'auto' },
        homeScreenId: 'scr_test01',
        screens: [{
            id: 'scr_test01',
            name: 'Test',
            icon: null,
            showInNav: true,
            maxWidth: 'medium',
            sections: [{ id: 'sec_test01', style: { padding: 4, gap: 3, background: 'none' }, children }],
        }],
        actions,
    };
}

function collectTypes(def) {
    const types = new Set();
    const walk = (nodes) => {
        for (const node of nodes || []) {
            types.add(node.type);
            if (Array.isArray(node.children)) walk(node.children);
        }
    };
    for (const screen of def.screens) for (const section of screen.sections) walk(section.children);
    return types;
}

// KITCHEN_SINK covers the v1 catalog; V2_RICH covers the v2 rich components;
// V21_BATCH covers the v2.1 batch. Rendering all four screens exercises every
// registry type in one pass.
function renderBothScreens(mode, props = {}) {
    return render(
        <>
            <AppRenderer definition={KITCHEN_SINK} screenId="scr_dash01" mode={mode} {...props} />
            <AppRenderer definition={KITCHEN_SINK} screenId="scr_form01" mode={mode} {...props} />
            <AppRenderer definition={V2_RICH} screenId="scr_rich01" mode={mode} {...props} />
            <AppRenderer definition={V21_BATCH} screenId="scr_v21a01" mode={mode} {...props} />
        </>,
    );
}

describe('componentRegistry', () => {
    it('covers exactly the 48 spec types, each with full palette metadata', () => {
        const types = Object.keys(APP_COMPONENT_TYPES);
        expect(types).toHaveLength(48);
        for (const type of types) {
            const entry = APP_COMPONENT_TYPES[type];
            expect(entry.Component, `${type}.Component`).toBeTypeOf('function');
            expect(entry.label, `${type}.label`).toBeTypeOf('string');
            expect(entry.icon, `${type}.icon`).toBeTruthy();
            expect(PALETTE_CATEGORIES, `${type}.category`).toContain(entry.category);
            expect(entry.defaultProps, `${type}.defaultProps`).toBeTypeOf('object');
            expect(entry.defaultStyle, `${type}.defaultStyle`).toBeTypeOf('object');
        }
        expect(getComponentEntry('heading')).toBe(APP_COMPONENT_TYPES.heading);
        expect(getComponentEntry('nope')).toBeNull();
    });

    it('the fixtures exercise every registry type', () => {
        const fixtureTypes = new Set([...collectTypes(KITCHEN_SINK), ...collectTypes(V2_RICH), ...collectTypes(V21_BATCH)]);
        for (const type of Object.keys(APP_COMPONENT_TYPES)) {
            expect(fixtureTypes.has(type), `fixture missing type '${type}'`).toBe(true);
        }
    });
});

describe('AppRenderer — run mode', () => {
    it('renders every registry type across the fixtures', () => {
        const { container } = renderBothScreens('run', { runAction: vi.fn() });
        for (const type of Object.keys(APP_COMPONENT_TYPES)) {
            // A CLOSED modal deliberately renders nothing in run mode — not
            // even its grid cell (an empty padded span-12 row painted a dead
            // band into every section hosting one). Its cell exists in edit
            // mode, which the edit-mode sweep below still pins.
            if (type === 'modal') {
                expect(
                    container.querySelector(`[data-app-type="${type}"]`),
                    'a closed modal must not leave a grid cell in run mode',
                ).toBeNull();
                continue;
            }
            expect(
                container.querySelector(`[data-app-type="${type}"]`),
                `type '${type}' did not render`,
            ).toBeTruthy();
        }
    });

    it('renders a neutral placeholder for an unknown type', () => {
        const def = defWith([{ id: 'cmp_wiz001', type: 'wizardry', props: {}, style: { span: 12 }, visible: true }]);
        const { getByText } = render(<AppRenderer definition={def} screenId="scr_test01" mode="run" />);
        expect(getByText(/Unknown component: wizardry/)).toBeTruthy();
    });

    it('a button click calls runAction with its action id', () => {
        const runAction = vi.fn();
        const { getByRole } = render(
            <AppRenderer definition={KITCHEN_SINK} screenId="scr_dash01" mode="run" runAction={runAction} />,
        );
        fireEvent.click(getByRole('button', { name: /Refresh/ }));
        expect(runAction).toHaveBeenCalledTimes(1);
        expect(runAction).toHaveBeenCalledWith('act_fetch1', {});
    });

    it('skips visible:false nodes entirely', () => {
        const def = defWith([
            { id: 'cmp_hide01', type: 'heading', props: { text: 'Secret', level: 2 }, style: { span: 12 }, visible: false },
            { id: 'cmp_show01', type: 'heading', props: { text: 'Public', level: 2 }, style: { span: 12 }, visible: true },
        ]);
        const { queryByText, getByText } = render(<AppRenderer definition={def} screenId="scr_test01" mode="run" />);
        expect(queryByText('Secret')).toBeNull();
        expect(getByText('Public')).toBeTruthy();
    });
});

describe('AppRenderer — edit mode', () => {
    it('renders every type through a custom NodeWrapper and reports clicks', () => {
        const clicks = [];
        const NodeWrapper = ({ node, className, style, children }) => (
            <div
                data-node-id={node.id}
                data-app-type={node.type}
                className={className}
                style={style}
                onClick={(e) => { e.stopPropagation(); clicks.push(node.id); }}
            >
                {children}
            </div>
        );
        const { container, getByText } = renderBothScreens('edit', { NodeWrapper });
        for (const type of Object.keys(APP_COMPONENT_TYPES)) {
            expect(
                container.querySelector(`[data-app-type="${type}"]`),
                `type '${type}' did not render in edit mode`,
            ).toBeTruthy();
        }
        fireEvent.click(getByText('Team dashboard'));
        expect(clicks).toContain('cmp_headg1');
    });

    it('shows visible:false nodes dimmed with a hidden badge', () => {
        const def = defWith([
            { id: 'cmp_hide01', type: 'heading', props: { text: 'Secret', level: 2 }, style: { span: 12 }, visible: false },
        ]);
        const { container, getByText } = render(<AppRenderer definition={def} screenId="scr_test01" mode="edit" />);
        expect(getByText('Secret')).toBeTruthy();
        const cell = container.querySelector('[data-node-id="cmp_hide01"]');
        expect(cell.style.opacity).toBe('0.4');
        expect(container.querySelector('[data-app-hidden-badge]')).toBeTruthy();
    });

    it('edit-mode buttons never fire actions', () => {
        const runAction = vi.fn();
        const { getByRole } = render(
            <AppRenderer definition={KITCHEN_SINK} screenId="scr_dash01" mode="edit" runAction={runAction} />,
        );
        fireEvent.click(getByRole('button', { name: /Refresh/ }));
        expect(runAction).not.toHaveBeenCalled();
    });
});

describe('AppRenderer — error containment', () => {
    afterEach(() => {
        delete APP_COMPONENT_TYPES.boomtest;
    });

    it('a crashing component renders the failure card while siblings survive', () => {
        APP_COMPONENT_TYPES.boomtest = {
            Component: () => { throw new Error('kaboom'); },
            label: 'Boom', icon: null, category: 'Content', defaultProps: {}, defaultStyle: { span: 12 },
        };
        const def = defWith([
            { id: 'cmp_boom01', type: 'boomtest', props: {}, style: { span: 6 }, visible: true },
            { id: 'cmp_safe01', type: 'heading', props: { text: 'Still standing', level: 2 }, style: { span: 6 }, visible: true },
        ]);
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const { getByText } = render(<AppRenderer definition={def} screenId="scr_test01" mode="run" />);
            expect(getByText('This component failed')).toBeTruthy();
            expect(getByText('Still standing')).toBeTruthy();
        } finally {
            errSpy.mockRestore();
        }
    });

    it('clears the boundary when a corrected prop makes the node render again', () => {
        // Throws only while props.explode is truthy — mirrors a bad prop that
        // the inspector later fixes.
        APP_COMPONENT_TYPES.boomtest = {
            Component: ({ node }) => {
                if (node.props?.explode) throw new Error('kaboom');
                return <div>recovered ok</div>;
            },
            label: 'Boom', icon: null, category: 'Content', defaultProps: {}, defaultStyle: { span: 12 },
        };
        const defExplode = defWith([
            { id: 'cmp_boom01', type: 'boomtest', props: { explode: true }, style: { span: 12 }, visible: true },
        ]);
        const defFixed = defWith([
            { id: 'cmp_boom01', type: 'boomtest', props: { explode: false }, style: { span: 12 }, visible: true },
        ]);
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const { getByText, queryByText, rerender } = render(
                <AppRenderer definition={defExplode} screenId="scr_test01" mode="edit" />,
            );
            expect(getByText('This component failed')).toBeTruthy();

            // Same node id, corrected prop → boundary resets and re-renders.
            rerender(<AppRenderer definition={defFixed} screenId="scr_test01" mode="edit" />);
            expect(queryByText('This component failed')).toBeNull();
            expect(getByText('recovered ok')).toBeTruthy();
        } finally {
            errSpy.mockRestore();
        }
    });

    it('keeps a still-broken node contained after an unrelated edit', () => {
        APP_COMPONENT_TYPES.boomtest = {
            Component: () => { throw new Error('kaboom'); },
            label: 'Boom', icon: null, category: 'Content', defaultProps: {}, defaultStyle: { span: 12 },
        };
        const defA = defWith([
            { id: 'cmp_boom01', type: 'boomtest', props: { note: 'a' }, style: { span: 12 }, visible: true },
        ]);
        const defB = defWith([
            { id: 'cmp_boom01', type: 'boomtest', props: { note: 'b' }, style: { span: 12 }, visible: true },
        ]);
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const { getByText, rerender } = render(
                <AppRenderer definition={defA} screenId="scr_test01" mode="edit" />,
            );
            expect(getByText('This component failed')).toBeTruthy();
            rerender(<AppRenderer definition={defB} screenId="scr_test01" mode="edit" />);
            // Still throwing → still contained, not a blank screen.
            expect(getByText('This component failed')).toBeTruthy();
        } finally {
            errSpy.mockRestore();
        }
    });
});

describe('AppRenderer — data bindings', () => {
    it('table shows emptyText when its bound action has no result', () => {
        const { container } = render(
            <AppRenderer definition={KITCHEN_SINK} screenId="scr_dash01" mode="run" actionState={{}} />,
        );
        const table = container.querySelector('[data-app-type="table"]');
        expect(within(table).getByText('Nothing to show yet.')).toBeTruthy();
    });

    it('table renders rows and em-dashes for missing keys', () => {
        const actionState = {
            act_fetch1: {
                status: 'success',
                result: { stats: { open: 4 }, rows: [{ title: 'Fix the printer' }] },
            },
        };
        const { container } = render(
            <AppRenderer definition={KITCHEN_SINK} screenId="scr_dash01" mode="run" actionState={actionState} />,
        );
        const table = container.querySelector('[data-app-type="table"]');
        expect(within(table).getByText('Fix the printer')).toBeTruthy();
        // status + createdAt are missing from the row → em-dash cells.
        expect(within(table).getAllByText('—')).toHaveLength(2);
        // The bound stat resolves its dot-path too.
        const stat = container.querySelector('[data-node-id="cmp_stat01"]');
        expect(within(stat).getByText('4')).toBeTruthy();
    });

    it('data components show a skeleton while the bound action runs', () => {
        const actionState = { act_fetch1: { status: 'running', result: undefined, error: null } };
        const { container } = render(
            <AppRenderer definition={KITCHEN_SINK} screenId="scr_dash01" mode="run" actionState={actionState} />,
        );
        const table = container.querySelector('[data-app-type="table"]');
        expect(table.querySelector('[data-app-loading]')).toBeTruthy();
    });
});

describe('AppRenderer — forms', () => {
    function renderForm(runAction) {
        return render(
            <AppRenderer definition={KITCHEN_SINK} screenId="scr_form01" mode="run" runAction={runAction} />,
        );
    }

    it('blocks submit and shows an inline error when a required field is empty', () => {
        const runAction = vi.fn();
        const { getByRole, getByText } = renderForm(runAction);
        fireEvent.click(getByRole('button', { name: /Send request/ }));
        expect(runAction).not.toHaveBeenCalled();
        expect(getByText('This field is required.')).toBeTruthy();
    });

    it('submits formValues keyed by input name (defaults included) with the form id', () => {
        const runAction = vi.fn();
        const { getByRole, getByLabelText } = renderForm(runAction);
        fireEvent.change(getByLabelText(/Subject/), { target: { value: 'New laptop' } });
        fireEvent.click(getByRole('button', { name: /Send request/ }));
        expect(runAction).toHaveBeenCalledTimes(1);
        const [actionId, opts] = runAction.mock.calls[0];
        expect(actionId).toBe('act_submit');
        expect(opts.formId).toBe('cmp_form01');
        expect(opts.formValues.subject).toBe('New laptop');
        expect(opts.formValues.quantity).toBe(1);        // input_number default
        expect(opts.formValues.priority).toBe('normal'); // input_select default
        expect(opts.formValues.notify).toBe(true);       // input_checkbox default
    });

    it('keeps field values after a failed submit attempt', () => {
        const runAction = vi.fn();
        const { getByRole, getByLabelText } = renderForm(runAction);
        fireEvent.change(getByLabelText(/Details/), { target: { value: 'It broke' } });
        fireEvent.click(getByRole('button', { name: /Send request/ })); // blocked: subject empty
        expect(runAction).not.toHaveBeenCalled();
        expect(getByLabelText(/Details/).value).toBe('It broke');
    });
});
